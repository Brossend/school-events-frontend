import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.output/server')
const packages = ['node-forge', 'listhen', 'nitropack']
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const installed = []
for (const name of packages) {
  try { await fs.access(path.join(root, 'node_modules', name)); installed.push(name) } catch { /* absent */ }
}
const imports = []
const references = []
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (/\.(?:mjs|cjs|js)$/.test(file)) {
      const text = await fs.readFile(file, 'utf8')
      if (/(?:\bfrom\s*|\bimport\s*\(?|\brequire\s*\()\s*['"](?:node-forge|listhen|nitropack)(?:\/|['"])/.test(text)) imports.push(path.relative(root, file).replaceAll('\\', '/'))
      if (/node-forge|listhen|nitropack/.test(text)) references.push(path.relative(root, file).replaceAll('\\', '/'))
    }
  }
}
await walk(root)
const response = await fetch('http://127.0.0.1:3001/login')
const evidence = {
  launch: 'node .output/server/index.mjs', httpStatus: response.status,
  runtimeDependencies: Object.keys(manifest.dependencies), installedChainPackages: installed,
  chainImportMatches: imports, textualReferences: references,
  referenceExplanation: 'renderer.mjs contains a comment describing a nitropack v2 host; this is not an import.',
}
await fs.writeFile('docs/evidence/production-runtime.json', JSON.stringify(evidence, null, 2))
console.log(JSON.stringify(evidence, null, 2))
if (installed.length || imports.length || response.status !== 200) process.exitCode = 1
