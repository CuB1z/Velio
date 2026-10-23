/**
 * Velio API contract, mirroring cycling-router/docs/api.md: don't invent fields.
 * Everything lives under /api/v1 except /api/health.
 */

/* ------------------------------------------------------------------- common */

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
  | 'OUT_OF_COVERAGE'
  | 'ALREADY_COVERED'
  | 'ROUTING_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

/** Error body shared by every endpoint: {error, message, details}. */
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

export type ProfileUpdate = { full_name: string }

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

/** Returned by login, refresh and the OAuth callback. */
export type AuthSession = {
  user: User
  tokens: Tokens
}

export type DeviceSession = {
  id: number
  created_at: string
  /** null when the client sent no User-Agent. */
  user_agent: string | null
  /** The caller's own session, flagged via the `sid` claim. */
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

/* -------------------------------------------------------------- route metrics */

/** Surface quality derived from Valhalla edge data. */
export type SurfaceScore = {
  /** 0-100, distance-weighted surface quality. */
  comfort: number
  /** Paved fraction of the route, 0-1. */
  paved_share: number
  /** Km per surface type, e.g. { dirt: 36.44, paved_smooth: 29.86 }. */
  surface_km: Record<string, number>
  /** Equivalent vertical metres of uphill grade. */
  climb_load_m: number
  max_grade_pct: number
}

/** Multi-factor 0-10 score. */
export type CyclingScore = {
  distance: number
  /** Traffic exposure, separate from surface: a car-free dirt park path is great cycling. */
  safety: number
  /** What's under the wheels, regardless of traffic. */
  surface: number
  /** Always present: required in the schema. */
  elevation: number
  overlap_penalty: number
  total: number
}

export type ElevationPoint = {
  lat: number
  lon: number
  distance_m: number
  elevation_m: number
  /** null on the first point (no previous segment). */
  grade_pct: number | null
}

/**
 * Bike type, which filters terrain; the engine's strongest lever. `city` is a
 * road bike avoiding traffic: bike lanes and greenways, no roadway, no mud.
 */
export type BikeType = 'road' | 'city' | 'gravel' | 'mtb'

/** How much climbing to seek; independent of the bike type. */
export type HillsPreference = 'flat' | 'rolling' | 'hilly'

export type BicycleType = 'Road' | 'Hybrid' | 'Mountain' | 'Cross'

/** Raw Valhalla costing overrides, applied on top of `bike` and `hills`. */
export type Costing = {
  bicycle_type?: BicycleType
  use_roads?: number
  use_hills?: number
  avoid_bad_surfaces?: number
}

export type ExportFormat = 'json' | 'gpx' | 'geojson'

/* ----------------------------------------------------------------- coverage */

export type CoverageRegion = {
  key: string
  name: string
  iso: string
}

export type CoverageGeometry = {
  type: 'MultiPolygon'
  coordinates: [number, number][][][]
}

export type Coverage = {
  regions: CoverageRegion[]
  bbox: [number, number, number, number]
  geometry: CoverageGeometry | null
}

export type CoverageRequestBody = {
  country: string
  email?: string
  note?: string
}

export type CoverageRequestResult = {
  country: string
  recorded: boolean
}

/* -------------------------------------------------------------------- loops */

export type LoopRequest = {
  origin: LatLon
  distance_km: number
  gain_m?: number
  via?: LatLon[]
  /** Distance tolerance as a fraction. Default 0.05. */
  tolerance?: number
  /** Elevation tolerance as a fraction. Default 0.20. */
  gain_tolerance?: number
  waypoint_count?: number
  max_iterations?: number
  bike?: BikeType
  hills?: HillsPreference
  /** >1 returns extra loops in `alternatives`, each vetoing the previous one's climbs. */
  routes?: number
  costing?: Costing
  include_profile?: boolean
}

export type LoopProgress = {
  seed: number
  seeds: number
  iteration: number
  distance_km: number | null
}

export type LoopResult = {
  distance_km: number
  gain_m: number
  loss_m: number
  /** false = best effort; the targets weren't reachable from that origin. */
  feasible: boolean
  iterations: number
  /** polyline6 (1e-6 precision). */
  polyline: string
  duration_min: number
  /** null when Valhalla returns no way ids. */
  overlap_ratio: number | null
  score: SurfaceScore | null
  /** null when the engine couldn't score the track. */
  cycling_score: CyclingScore | null
  profile?: ElevationPoint[] | null
  alternatives?: LoopResult[] | null
}

/* ------------------------------------------------------------------- routes */

export type RouteRequest = {
  /** 2 to 20 points, in order. */
  waypoints: LatLon[]
  bike?: BikeType
  hills?: HillsPreference
  costing?: Costing
  include_profile?: boolean
  /** Up to 2 extra tracks between the same points. */
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

/** Shared loop/route shape: everything the map, metrics and export need. */
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

/* ---------------------------------------------------------------- saved routes */

export type SavedRoute = {
  id: string
  name: string
  /** Raw response of the compute endpoint that produced it. */
  payload: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type CreateSavedRoute = {
  name: string
  payload: Record<string, unknown>
}
