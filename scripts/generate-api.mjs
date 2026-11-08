import fs from 'node:fs/promises'
import path from 'node:path'
import openapiTS, { astToString } from 'openapi-typescript'

const source = path.resolve(process.env.BACKEND_OPENAPI || '../school/docs/openapi.yaml')
const ast = await openapiTS(new URL(`file:///${source.replaceAll('\\', '/')}`))
await fs.mkdir('app/types', { recursive: true })
await fs.writeFile('app/types/openapi.d.ts', astToString(ast))
console.log(`Generated DTOs from ${source}`)
