/**
 * Contrasta src/types/api.ts con el esquema OpenAPI del backend.
 *
 * Nació de un fallo real: `cycling_score` es nullable en el esquema pero yo lo
 * había transcrito como obligatorio, y al llegar un null la página entera se
 * caía. Este contraste existe para que ese tipo de deriva la cante una prueba
 * y no el usuario.
 *
 * Se compara contra contract/openapi.json, una instantánea versionada, para
 * que CI no dependa de un backend en marcha. Se refresca con:
 *   pnpm contract:pull
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Nombre del esquema en el backend → nombre del tipo en el frontend. */
export const SCHEMA_TO_TYPE = {
  LoopResponse: 'LoopResult',
  RouteResponse: 'RouteResult',
  AnalysisResponse: 'AnalyzeResult',
  ElevationResponse: 'ElevationResult',
  UserResponse: 'User',
  TokenPair: 'Tokens',
  AuthSession: 'AuthSession',
  SessionResponse: 'DeviceSession',
  SavedRouteResponse: 'SavedRoute',
  Quality: 'SurfaceScore',
  CyclingScore: 'CyclingScore',
  ProfilePoint: 'ElevationPoint',
  Waypoint: 'LatLon',
  PageMeta: 'PaginationMeta',
  LoopCreateRequest: 'LoopRequest',
  RouteCreateRequest: 'RouteRequest',
  CostingOptions: 'Costing',
  LoginRequest: 'LoginRequest',
  RegisterRequest: 'RegisterRequest',
  VerifyRequest: 'VerifyRequest',
  ForgotPasswordRequest: 'ForgotPasswordRequest',
  ResetPasswordRequest: 'ResetPasswordRequest',
  ChangePasswordRequest: 'ChangePasswordRequest',
  DeleteAccountRequest: 'DeleteAccountRequest',
  SavedRouteCreateRequest: 'CreateSavedRoute',
}

export function loadSpec() {
  return JSON.parse(readFileSync(join(ROOT, 'contract/openapi.json'), 'utf8'))
}

/** Parseo deliberadamente tonto: los tipos del contrato son objetos planos. */
export function parseTypes(source = readFileSync(join(ROOT, 'src/types/api.ts'), 'utf8')) {
  const types = {}
  // Los comentarios se quitan antes de trocear: alguno contiene llaves
  // (`{ dirt: 36.44 }`) y le cortaban el bloque al buscador.
  source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const blocks = source.matchAll(/export type (\w+) = \{([\s\S]*?)\n?\}/g)
  for (const [, name, body] of blocks) {
    const fields = {}
    // Un tipo puede venir en una línea (`{ lat: number; lon: number }`) o en
    // varias; se normaliza a una lista de campos en ambos casos.
    for (const line of body.split(/[\n;]/)) {
      const clean = line.trim()
      const match = clean.match(/^(\w+)(\?)?:\s*(.+?)$/)
      if (!match) continue
      const [, field, optional, raw] = match
      fields[field] = {
        optional: Boolean(optional),
        nullable: /\|\s*null/.test(raw),
        raw: raw.replace(/,$/, '').trim(),
      }
    }
    types[name] = fields
  }
  return types
}

/** Un campo del esquema es nullable si su tipo lo dice o si es anyOf con null. */
function specField(schema) {
  const nullable =
    schema.type === 'null' ||
    (Array.isArray(schema.type) && schema.type.includes('null')) ||
    (schema.anyOf ?? []).some((s) => s.type === 'null')
  return { nullable }
}

export function compare(spec = loadSpec(), types = parseTypes()) {
  const problems = []
  const schemas = spec.components?.schemas ?? {}

  for (const [schemaName, typeName] of Object.entries(SCHEMA_TO_TYPE)) {
    const schema = schemas[schemaName]
    if (!schema) {
      problems.push(`${schemaName}: no está en el esquema del backend`)
      continue
    }
    const type = types[typeName]
    if (!type) {
      problems.push(`${typeName}: no está en src/types/api.ts (esquema ${schemaName})`)
      continue
    }

    const required = new Set(schema.required ?? [])
    for (const [field, sub] of Object.entries(schema.properties ?? {})) {
      const mine = type[field]
      if (!mine) {
        problems.push(`${typeName}.${field}: falta en el frontend`)
        continue
      }
      const { nullable } = specField(sub)
      if (nullable && !mine.nullable && !mine.optional) {
        problems.push(
          `${typeName}.${field}: el backend lo declara nullable y el frontend no (${mine.raw})`,
        )
      }
      if (required.has(field) && mine.optional) {
        problems.push(`${typeName}.${field}: el backend lo exige y el frontend lo hace opcional`)
      }
    }

    for (const field of Object.keys(type)) {
      if (!(field in (schema.properties ?? {}))) {
        problems.push(`${typeName}.${field}: no existe en el esquema ${schemaName}`)
      }
    }
  }
  return problems
}

/** Rutas que el frontend llama de verdad, sacadas de src/api/*.ts. */
export function usedPaths() {
  const dir = join(ROOT, 'src/api')
  const found = new Map()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const source = readFileSync(join(dir, file), 'utf8')
    for (const match of source.matchAll(
      /request<[^>]*>\(\s*[`'"]([^`'"]+)[`'"]([\s\S]{0,160}?)\)/g,
    )) {
      const path = match[1].replace(/\$\{[^}]+\}/g, '{param}')
      const method = match[2].match(/method:\s*'(\w+)'/)?.[1] ?? 'GET'
      found.set(`${method} ${path}`, { path, method })
    }
  }
  return [...found.values()]
}

/** El backend nombra los parámetros de ruta; el frontend los interpola. */
function normalise(path) {
  return path.replace(/\{[^}]+\}/g, '{param}')
}

export function comparePaths(spec = loadSpec()) {
  const problems = []
  const base = '/api/v1'
  const known = new Map()
  for (const [path, ops] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(ops)) {
      known.set(`${method.toUpperCase()} ${normalise(path)}`, true)
    }
  }
  for (const { path, method } of usedPaths()) {
    // Un primer segmento interpolado (`/${endpoint}`) no es un parámetro de
    // ruta sino una elección entre endpoints: no se puede verificar aquí.
    if (path.startsWith('/{param}')) continue
    const key = `${method.toUpperCase()} ${normalise(base + path)}`
    if (!known.has(key)) problems.push(`${key}: el frontend la llama y el backend no la expone`)
  }
  return problems
}
