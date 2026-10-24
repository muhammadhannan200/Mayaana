import { readdirSync,readFileSync } from "node:fs";
import { join } from "node:path";

// Check the actual built browser assets without printing any key or asset text.
const secret=process.env.SUPABASE_SECRET_KEY;
if(secret){
  const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(directory,entry.name)):[join(directory,entry.name)]);
  for(const file of walk(".next/static")){
    if(/\.(js|json|map)$/.test(file)&&readFileSync(file,"utf8").includes(secret))throw new Error("A server-only Supabase key was found in browser assets");
  }
  console.log("Server-only Supabase key is absent from built browser assets.");
}
