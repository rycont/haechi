import { listenAndServe } from "https://deno.land/std@0.107.0/http/server.ts";
import { join as joinPath, extname as getExtname } from "https://deno.land/std@0.109.0/path/mod.ts";
import { TerminalSpinner } from "https://deno.land/x/spinners@v1.1.2/mod.ts";

import { FunctionalHandler, Module, RequestArgument } from "./types.ts";
import { asyncIterableToArray } from "./utils/asyncIterableToArray.ts";

let BASE_PATH = Deno.cwd()

let sequence = 0

const resFactory = (header: Record<string, string>) => (content?: string, config?: ResponseInit) => {
    const res = new Response(content, config)
    Object.entries(header).map(([key, value]) => res.headers.set(key, value))
    return res
}

const watchDir = async (path: string, event: (e: Deno.FsEvent) => void) => {
    const security = Deno.watchFs(path, {
        recursive: true
    });

    for await (const change of security) {
        event(change)
    }
}

const pathToModuleName = (path: string) => {
    const moduleName = path.slice(BASE_PATH.length, -getExtname(path).length)
    return moduleName.endsWith('/index') ? moduleName.slice(0, -5) : moduleName
}

const cachelessImport = (path: string) => import(path + '?seq=' + sequence++)


const flattenLoader = async (path: string): Promise<Record<string, Module>> => {
    return (await asyncIterableToArray(Deno.readDir(path))).reduce<Promise<Record<string, Module>>>(async (list, current) => {
        const prevList = await list
        const itemAbsPath = joinPath(path, current.name)

        if (current.isFile) return {
            ...prevList,
            [pathToModuleName(itemAbsPath)]: {
                ...await cachelessImport(itemAbsPath)
            } as Module
        }
        if (current.isDirectory) return { ...prevList, ...await flattenLoader(itemAbsPath) }
        return list
    }, Promise.resolve({} as Record<string, Module>))
}

const unpackResolvedContent = async (resolved: unknown, reqData: RequestArgument) => {
    const resolvedType = typeof resolved
    if (resolvedType === 'function') {
        const unpacked = (<FunctionalHandler>resolved)(reqData)
        if (unpacked instanceof Promise) return await unpacked
        return unpacked
    }
    return resolved
}

class HttpError extends Error {
    statusCode: number
    constructor(content: {
        message: string
        statusCode: number
    }) {
        super(content.message)
        this.statusCode = content.statusCode
    }
}

const readableToString = async (stream: ReadableStream<ArrayBuffer>) => {
    const content = await stream.getReader().read()
    const decoder = new TextDecoder()
    return decoder.decode(content.value)
}

const parameterRouteToRegex = (route: string) => RegExp(route.replace(/\[[^/]*?\]/, "[^/]*?"))

export const GoHaechi = async (port: number, path: string, option: {
    allowCors?: boolean | string
} = {}, afterInit?: () => void) => {
    BASE_PATH = joinPath(Deno.cwd(), path)

    const app = await flattenLoader(BASE_PATH)
    const regexTable = Object.keys(app).map(e => [parameterRouteToRegex(e), e] as [RegExp, string])

    watchDir(BASE_PATH, async e => {
        console.log("SOMETHING CHANGED", e.kind)
        const delta0 = +new Date()
        if (!['modify', 'create'].includes(e.kind)) return

        const terminalSpinner = new TerminalSpinner("🦐 Reloading Files...\n");
        terminalSpinner.start()
        for (const modifyPath of e.paths) {
            try {
                const reloadedModule = { ...await cachelessImport(modifyPath) }
                const moduleName = pathToModuleName(modifyPath)
                app[moduleName] = reloadedModule
                const precachedRegexIndex = regexTable.findIndex(e => e[1] === moduleName)
                if (precachedRegexIndex !== -1)
                    regexTable[precachedRegexIndex] = [
                        parameterRouteToRegex(moduleName),
                        moduleName,
                    ]
            } catch (_e) {
                console.log("Cannot load some file, skipping...")
            }
        }

        terminalSpinner.succeed(`Successfully reloaded ${e.paths.length} files in ${+new Date() - delta0}ms`)
    })

    const createResponse = resFactory(option.allowCors ? {
        'Access-Control-Allow-Origin': (option.allowCors === true) ? '*' : option.allowCors
    } : {})

    afterInit?.()
    console.log(`🚀 Haechi is running on port ${port} 🚀`)

    listenAndServe(":" + port, async req => {
        const url = new URL(req.url)
        const path = url.pathname

        console.log(`[${req.method}] ${path}`)

        if (req.method === 'OPTIONS') {
            const res = createResponse()
            res.headers.append('Allow', "OPTIONS, GET, HEAD, POST")
            res.headers.append("Access-Control-Allow-Headers", "*")
            return res
        }

        try {
            let resolved = app[path]?.[req.method.toLowerCase()]
            if (!resolved) {
                const regexQuery = regexTable.find(([regex]) => regex.test(path))
                if (!regexQuery)
                    throw new HttpError({
                        message: "Resource not found " + path,
                        statusCode: 404
                    })

                resolved = app[regexQuery[1]]?.[req.method.toLowerCase()]
            }

            const reqData = {
                url: Object.fromEntries(url.searchParams.entries()),
                jsonBody: req.body && JSON.parse(await readableToString(req.body))
            }

            const content = await unpackResolvedContent(resolved, reqData)
            const contentType = typeof content

            if (contentType === 'object') {
                const res = createResponse(JSON.stringify(content))
                return res
            }

            const res = createResponse(String(content))
            return res
        } catch (e) {
            if (e instanceof HttpError) {
                const res = createResponse(e.message, {
                    status: e.statusCode
                })
                return res
            }

            throw new HttpError({
                message: "Internal Server Error",
                statusCode: 500
            })
        }
    });
}
