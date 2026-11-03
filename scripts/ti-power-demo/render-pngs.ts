import {readdir,readFile,writeFile} from "node:fs/promises"
import {Resvg} from "@resvg/resvg-js"
for(const name of await readdir("dist/assets")){
 if(!name.endsWith(".svg"))continue
 const svg=await readFile(`dist/assets/${name}`,"utf8")
 const png=new Resvg(svg,{background:name.includes("original")?"#071a16":"#0b171a",fitTo:{mode:"width",value:1200}}).render().asPng()
 await writeFile(`dist/assets/${name.replace(/\.svg$/u,".png")}`,png)
}
