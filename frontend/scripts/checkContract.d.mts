/** Types for the JS contract checker. */
export declare function compare(): string[]
export declare function comparePaths(): string[]
export declare function usedPaths(): { path: string; method: string }[]
export declare function parseTypes(source?: string): Record<string, unknown>
export declare function loadSpec(): unknown
export declare const SCHEMA_TO_TYPE: Record<string, string>
