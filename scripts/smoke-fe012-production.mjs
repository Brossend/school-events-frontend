import fs from 'node:fs/promises';
import path from 'node:path';
const origin='http://127.0.0.1:3111', root=path.resolve('.output/server');
const manifest=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const chain=['node-forge','listhen','nitropack','deepmerge'];
const installed=[],imports=[],textual=[];
for(const name of chain){try{await fs.access(path.join(root,'node_modules',name));installed.push(name);}catch{/* absent */}}
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(/\.(mjs|cjs|js)$/.test(file)){const text=await fs.readFile(file,'utf8');if(/(?:\bfrom\s*|\bimport\s*\(?|\brequire\s*\()\s*['"](?:node-forge|listhen|nitropack|deepmerge)(?:\/|['"])/.test(text))imports.push(path.relative(root,file));if(/node-forge|listhen|nitropack|deepmerge/.test(text))textual.push(path.relative(root,file));}}}
await walk(root);
const routes=[];const assets=new Set();
for(const route of ['/login','/calendar','/school','/pilot','/system']){const response=await fetch(origin+route);const html=await response.text();routes.push({path:route,status:response.status,spaShell:html.includes('__nuxt'),normalApiOrigin:html.includes('http://localhost:8000')});for(const match of html.matchAll(/(?:src|href)="(\/_nuxt\/[^"?#]+)[^" ]*"/g))assets.add(match[1]);}
const files=[];for(const asset of assets){const response=await fetch(origin+asset);files.push({path:asset,status:response.status,bytes:(await response.arrayBuffer()).byteLength});}
const evidence={launch:'node .output/server/index.mjs',apiOrigin:'http://localhost:8000',routes,assets:files,runtimeDependencies:Object.keys(manifest.dependencies||{}),installedChainPackages:installed,chainImportMatches:imports,textualReferences:textual,note:'SPA shell smoke only; authenticated RBAC and logout were verified separately through live API/browser. Text comments mentioning nitropack are not imports.'};
await fs.writeFile('docs/fe012/production-smoke.json',JSON.stringify(evidence,null,2));
if(routes.some(r=>r.status!==200||!r.spaShell||!r.normalApiOrigin)||files.some(r=>r.status!==200||!r.bytes)||installed.length||imports.length)throw Error('Production smoke failed; inspect evidence');
console.log(JSON.stringify(evidence,null,2));
