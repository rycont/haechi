**WARNING: THIS IS NOT FOR PRODUCTION-LEVEL PROJECT**

Haechi is started for applying to maintainer's toy project, so it is buggy and feature-lack.

# Haechi
Casual backend framework for Deno, with dir-structured auto routing. Inspired by NextJS

## Feature
- **Directory Based Auto Routing**: Init Haechi, Create File, then Everything Finished. Just focusing at writing Backend source. 
- **Auto reloading**: You don't need to restart Deno if you have changed handlers only.

## Minimal Example
You should run Haechi with network, read permission.
```bash
deno run --allow-net --allow-read ./app.ts
# 🚀 Haechi is running on port 8000 🚀
```

```ts
// app.ts
import { GoHaechi } from "https://raw.githubusercontent.com/rycont/haechi/main/main.ts";

GoHaechi(
    8000, // Listening port
    './service', // Resource Directory
    { // Configuration

        allowCors: "haechi.com",
        /* Or,
        allowCors: true
        */
    },
    () => console.log("Haechi Go!") // Run when server has initialized
)
```

Haechi will server your files under specified directory.

## Step-by-Step tutorial
1. Create and open main.ts file:
```bash
touch ./main.ts
code ./main.ts # or your favorite editor
```

2. Import `haechi`
```ts
// main.ts
import { GoHaechi } from "https://raw.githubusercontent.com/rycont/haechi/main/main.ts";
```

3. Create a directory where the handlers will be placed
```bash
mkdir ./service # or your favoriate name
```

5. Create example handler.   
```ts
// service/hello.ts
let num = 0
export const get = () => `Hello ${num} times`
```

4. Init Haechi in `main.ts` file
```ts
GoHaechi(8000, './service')
```

5. Run your server file
```bash
deno run --allow-net --allow-read ./main.ts
# 🚀 Haechi is running on port 8000 🚀
```

6. Open your browser and navigate to   
`http://localhost:8000/hello`


## Supported Handler
### Functional Handler
```ts
export get = (req: FunctionalHandler) => {
    return "Hello, I'm functional handler!"
}
export post = async (req: FunctionalHandler) => {
    return "And, We can be a Async Function"
}
```
+ Json File, Number, String and other static datas also  in experimental support
