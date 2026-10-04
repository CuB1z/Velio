/**
 * Contrato real de la API de Velio.
 * Reflejo fiel de cycling-router/docs/api.md — no inventar campos aquí.
 * Todo cuelga de /api/v1 salvo /api/health.
 */

/* ------------------------------------------------------------------ comunes */

export type LatLon = { lat: number; lon: number }

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NO_LOCAL_PASSWORD'
  | 'DELETE_ERROR'
  | 'VERIFY_ERROR'
  | 'RESET_ERROR'
  | 'OAUTH_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_SUSPENDED'
  | 'NOT_FOUND'
  | 'UNKNOWN_PROVIDER'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'ROUTING_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

/** Cuerpo de error común a todos los endpoints: {error, message, details}. */
export type ApiErrorBody = {
  error: ErrorCode
  message: string
  details?: Record<string, unknown>
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  total_pages: number
  is_last: boolean
}

export type Paginated<T> = {
  data: T[]
  meta: PaginationMeta
}

export type HealthResponse = { status: string; version: string }

/* --------------------------------------------------------------------- auth */

export type AccountStatus = 'pending' | 'active' | 'suspended'

export type User = {
  id: string
  email: string
  full_name: string
  status: AccountStatus
}

export type Tokens = {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
}

/** login, refresh y el callback de OAuth devuelven esta forma. */
export type AuthSession = {
  user: User
  tokens: Tokens
}

export type DeviceSession = {
  id: number
  created_at: string
  /** Un cliente puede no enviar User-Agent. */
  user_agent: string | null
  /** El backend marca la sesión del propio llamante vía el claim `sid`. */
  current: boolean
}

export type RegisterRequest = { email: string; password: string; full_name?: string }
export type VerifyRequest = { email: string; code: string }
export type LoginRequest = { email: string; password: string }
export type ForgotPasswordRequest = { email: string }
export type ResetPasswordRequest = { email: string; code: string; new_password: string }
export type ChangePasswordRequest = { current_password: string; new_password: string }
export type DeleteAccountRequest = { code: string }

export type OAuthProvider = 'google'

/* ------------------------------------------------------- métricas de una ruta */

/** Calidad del firme derivada de los datos de arista de Valhalla. */
export type SurfaceScore = {
  /** 0-100, calidad de firme ponderada por distancia. */
  comfort: number
  /** Fracción del recorrido sobre firme asfaltado, 0-1. */
  paved_share: number
  /** Kilómetros por tipo de firme, p. ej. { dirt: 36.44, paved_smooth: 29.86 }. */
  surface_km: Record<string, number>
  /** Metros equivalentes verticales de pendiente positiva. */
  climb_load_m: number
  max_grade_pct: number
}

/** Valoración multifactor 0-10. `elevation` solo aparece cuando hubo objetivo de desnivel. */
export type CyclingScore = {
  distance: number
  /**
   * Exposición al tráfico. Es un eje aparte del firme a propósito: un camino
   * de parque cerrado a coches es ciclismo estupendo aunque sea de tierra.
   */
  safety: number
  /** Qué hay bajo las ruedas, con independencia de quién más circule por ahí. */
  surface: number
  /** Siempre presente: el esquema lo declara obligatorio. */
  elevation: number
  overlap_penalty: number
  total: number
}

export type ElevationPoint = {
  lat: number
  lon: number
  distance_m: number
  elevation_m: number
  /** null en el primer punto: no hay tramo previo con el que calcular pendiente. */
  grade_pct: number | null
}

/**
 * Con qué bici sales, que es lo que filtra el terreno. Es la palanca más
 * fuerte del motor: medido sobre el mismo tramo, `road` sale con un 0,4% de
 * pista y `mtb` con un 53%. `city` es la de carretera que rehúye el tráfico:
 * carril bici y vías verdes, sin calzada y sin barro.
 */
export type BikeType = 'road' | 'city' | 'gravel' | 'mtb'

/** Cuánto desnivel buscar. Independiente de la bici: cualquier combinación vale. */
export type HillsPreference = 'flat' | 'rolling' | 'hilly'

export type BicycleType = 'Road' | 'Hybrid' | 'Mountain' | 'Cross'

/** Sobrescrituras crudas del costing de Valhalla, por encima de `bike` y `hills`. */
export type Costing = {
  bicycle_type?: BicycleType
  use_roads?: number
  use_hills?: number
  avoid_bad_surfaces?: number
}

export type ExportFormat = 'json' | 'gpx' | 'geojson'

/* -------------------------------------------------------------------- loops */

export type LoopRequest = {
  origin: LatLon
  distance_km: number
  gain_m?: number
  via?: LatLon[]
  /** Tolerancia de distancia, fracción. Por defecto 0.05. */
  tolerance?: number
  /** Tolerancia de desnivel, fracción. Por defecto 0.20. */
  gain_tolerance?: number
  waypoint_count?: number
  max_iterations?: number
  bike?: BikeType
  hills?: HillsPreference
  /** >1 devuelve circuitos extra en `alternatives`, cada uno vetando los puertos del anterior. */
  routes?: number
  costing?: Costing
  include_profile?: boolean
}

export type LoopResult = {
  distance_km: number
  gain_m: number
  loss_m: number
  /** false = mejor intento posible; no se alcanzaron los objetivos desde ese origen. */
  feasible: boolean
  iterations: number
  /** polyline6 (precisión 1e-6). */
  polyline: string
  duration_min: number
  /** null cuando Valhalla no aporta way ids. */
  overlap_ratio: number | null
  score: SurfaceScore | null
  /** null cuando el motor no ha podido puntuar el trazado. */
  cycling_score: CyclingScore | null
  profile?: ElevationPoint[] | null
  alternatives?: LoopResult[] | null
}

/* ------------------------------------------------------------------- routes */

export type RouteRequest = {
  /** De 2 a 20 puntos, en orden. */
  waypoints: LatLon[]
  bike?: BikeType
  hills?: HillsPreference
  costing?: Costing
  include_profile?: boolean
  /** Hasta 2 trazados extra entre los mismos puntos. */
  alternatives?: number
}

export type RouteResult = {
  distance_km: number
  gain_m: number
  loss_m: number
  polyline: string
  duration_min: number
  overlap_ratio: number | null
  score: SurfaceScore | null
  cycling_score: CyclingScore | null
  profile?: ElevationPoint[] | null
  alternatives?: RouteResult[] | null
}

/** Lo que comparten loop y route: todo lo que necesitan mapa, métricas y export. */
export type AnyRouteResult = RouteResult & Partial<Pick<LoopResult, 'feasible' | 'iterations'>>

/* -------------------------------------------------------- analyze / elevation */

export type AnalyzeRequest = {
  polyline: string
  target_km?: number
  target_gain_m?: number
}

export type AnalyzeResult = {
  distance_km: number
  gain_m: number
  loss_m: number
  overlap_ratio: number | null
  score: SurfaceScore | null
  cycling_score: CyclingScore | null
}

export type ElevationRequest = { polyline: string }

export type ElevationResult = {
  distance_km: number
  gain_m: number
  loss_m: number
  max_uphill_grade_pct: number
  max_downhill_grade_pct: number
  profile: ElevationPoint[]
}

/* ------------------------------------------------------------- rutas guardadas */

export type SavedRoute = {
  id: string
  name: string
  /** Respuesta literal del endpoint de cálculo que la produjo. */
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type CreateSavedRoute = {
  name: string
  payload: Record<string, unknown>
}
