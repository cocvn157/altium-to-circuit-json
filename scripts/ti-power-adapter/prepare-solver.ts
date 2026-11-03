import { cp, readdir, readFile, writeFile, rm, symlink } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Altium AST nodes use instanceof; the source helpers and the npm converter
// must share one parser instance even when installed in separate workspaces.
const sourceLayers = fileURLToPath(import.meta.resolve("altium-source/pcb/layers/index.ts"))
const rootParser = resolve(dirname(sourceLayers),"../../../node_modules/altiumts")
const localParser = resolve("node_modules/altiumts")
const version = JSON.parse(await readFile(resolve(rootParser,"package.json"),"utf8")).version
if (version !== "0.0.95") throw new Error(`Unexpected native parser version ${version}`)
await rm(localParser,{recursive:true,force:true})
await symlink(rootParser,localParser,"dir")

await cp("solver-base/lib","solver/lib",{recursive:true})
await cp("solver-overrides/lib","solver/lib",{recursive:true})
for (const entry of await readdir("solver/lib",{recursive:true,withFileTypes:true})) {
  if (!entry.isFile()||!entry.name.endsWith(".ts")) continue
  const path=resolve(entry.parentPath,entry.name)
  const source=await readFile(path,"utf8")
  const patched=source.replaceAll(/"lib\/([^"]+)"/gu,(_match,target)=>{
    const path=relative(dirname(resolve(entry.parentPath,entry.name)),resolve("solver/lib",target))
    return JSON.stringify(path.startsWith(".")?path:`./${path}`)
  })
  await writeFile(path,patched)
}
