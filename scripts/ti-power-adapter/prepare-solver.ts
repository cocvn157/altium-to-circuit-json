import { cp, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"

await cp("solver-base/lib","solver/lib",{recursive:true})
await cp("solver-overrides/lib","solver/lib",{recursive:true})
for (const entry of await readdir("solver/lib",{recursive:true,withFileTypes:true})) {
  if (!entry.isFile()||!entry.name.endsWith(".ts")) continue
  const path=resolve(entry.parentPath,entry.name)
  const source=await readFile(path,"utf8")
  const patched=source.replaceAll(/"lib\/([^\"]+)"/gu,(_match,target)=>{
    const path=relative(dirname(resolve(entry.parentPath,entry.name)),resolve("solver/lib",target))
    return JSON.stringify(path.startsWith(".")?path:`./${path}`)
  })
  await writeFile(path,patched)
}
