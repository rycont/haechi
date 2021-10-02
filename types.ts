export interface RequestArgument {
    url: Record<string, string>
    jsonBody: Record<string, string>
}

export type FunctionalHandler = (req: RequestArgument) => unknown
export interface ComplexHandler {
    handler: FunctionalHandler,
    reqChecker: {
        type: keyof RequestArgument,
        checker: (req: RequestArgument) => boolean
    }
}

type StaticData = unknown
type Handler = FunctionalHandler | StaticData

export interface Module {
    get: Handler
    post: Handler
    [key: string]: Handler
}

export interface Dir {
    name: string;
    content: {
        dirs: Dir[]
        files: Module[]
    }
}
