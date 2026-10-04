/** Refresca contract/openapi.json desde un backend en marcha. */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.env.VELIO_API_URL ?? 'http://localhost:8000'
const resp = await fetch(`${url}/openapi.json`)
if (!resp.ok) throw new Error(`${url}/openapi.json → HTTP ${resp.status}`)

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'contract/openapi.json')
writeFileSync(target, `${JSON.stringify(await resp.json(), null, 2)}\n`)
console.log(`contract/openapi.json actualizado desde ${url}`)
