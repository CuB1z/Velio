/**
 * Checks src/types/api.ts against the backend's OpenAPI schema, using the
 * versioned contract/openapi.json snapshot so CI needs no running backend.
 * Refresh it with `pnpm contract:pull`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Backend schema name → frontend type name. */
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
  CoverageResponse: 'Coverage',
  CoverageRegion: 'CoverageRegion',
  CoverageGeometry: 'CoverageGeometry',
  CoverageRequestCreateRequest: 'CoverageRequestBody',
  CoverageRequestResponse: 'CoverageRequestResult',
}

export function loadSpec() {
  return JSON.parse(readFileSync(join(ROOT, 'contract/openapi.json'), 'utf8'))
}

/** Deliberately naive parser: contract types are flat objects. */
export function parseTypes(source = readFileSync(join(ROOT, 'src/types/api.ts'), 'utf8')) {
  const types = {}
  // Strip comments first: some contain braces (`{ dirt: 36.44 }`) that would cut a block short.
  source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const blocks = source.matchAll(/export type (\w+) = \{([\s\S]*?)\n?\}/g)
  for (const [, name, body] of blocks) {
    const fields = {}
    // Handles single-line (`{ lat: number; lon: number }`) and multi-line types.
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

/** A schema field is nullable if its type says so or it is anyOf with null. */
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
      problems.push(`${schemaName}: not in the backend schema`)
      continue
    }
    const type = types[typeName]
    if (!type) {
      problems.push(`${typeName}: not in src/types/api.ts (schema ${schemaName})`)
      continue
    }

    const required = new Set(schema.required ?? [])
    for (const [field, sub] of Object.entries(schema.properties ?? {})) {
      const mine = type[field]
      if (!mine) {
        problems.push(`${typeName}.${field}: missing in the frontend`)
        continue
      }
      const { nullable } = specField(sub)
      if (nullable && !mine.nullable && !mine.optional) {
        problems.push(
          `${typeName}.${field}: nullable in the backend but not in the frontend (${mine.raw})`,
        )
      }
      if (required.has(field) && mine.optional) {
        problems.push(`${typeName}.${field}: required by the backend but optional in the frontend`)
      }
    }

    for (const field of Object.keys(type)) {
      if (!(field in (schema.properties ?? {}))) {
        problems.push(`${typeName}.${field}: not in schema ${schemaName}`)
      }
    }
  }
  return problems
}

/** Paths the frontend actually calls, scraped from src/api/*.ts. */
export function usedPaths() {
  const dir = join(ROOT, 'src/api')
  const found = new Map()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const source = readFileSync(join(dir, file), 'utf8')
    for (const match of source.matchAll(
      /\b(?:request<[^>]*>|stream)\(\s*[`'"]([^`'"]+)[`'"]([\s\S]{0,160}?)\)/g,
    )) {
      const path = match[1].replace(/\$\{[^}]+\}/g, '{param}')
      const method = match[2].match(/method:\s*'(\w+)'/)?.[1] ?? 'GET'
      found.set(`${method} ${path}`, { path, method })
    }
  }
  return [...found.values()]
}

/** The backend names path params; the frontend interpolates them. */
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
    // An interpolated first segment (`/${endpoint}`) picks between endpoints; not checkable here.
    if (path.startsWith('/{param}')) continue
    const key = `${method.toUpperCase()} ${normalise(base + path)}`
    if (!known.has(key)) problems.push(`${key}: called by the frontend but not exposed by the backend`)
  }
  return problems
}
