import { describe, expect, it } from 'vitest'

import { compare, comparePaths } from '../../scripts/checkContract.mjs'

/**
 * El frontend y el backend son dos repositorios: nada obliga a que sus
 * contratos coincidan salvo esta prueba.
 *
 * Nació de un fallo real en producción de desarrollo: `cycling_score` es
 * nullable en el esquema y estaba transcrito como obligatorio, así que al
 * llegar un null la aplicación entera se caía sin red.
 *
 * Se contrasta contra contract/openapi.json, una instantánea versionada.
 * Cuando el backend cambie: `pnpm contract:pull` y volver a pasar esto.
 */
describe('contrato con el backend', () => {
  it('los tipos coinciden con el esquema OpenAPI', () => {
    expect(compare()).toEqual([])
  })

  it('todas las rutas que llama el frontend existen en el backend', () => {
    expect(comparePaths()).toEqual([])
  })
})
