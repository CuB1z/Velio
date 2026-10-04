import { describe, expect, it } from 'vitest'

import { DEFAULT_LOOP_FORM, toLoopRequest } from './loopFormValue'

describe('toLoopRequest', () => {
  it('envía los dos filtros y ningún costing crudo', () => {
    /*
     * Regresión: el formulario mandaba `profile: 'safe'` junto a
     * `costing: { bicycle_type: 'Hybrid' }`, y el costing crudo gana en el
     * backend. El selector de estilo no cambiaba nada: siempre se enrutaba
     * como híbrida. Ahora la bici *es* el bicycle_type, así que no hay dos
     * sitios donde decir lo mismo.
     */
    const request = toLoopRequest({ ...DEFAULT_LOOP_FORM, bike: 'gravel', hills: 'hilly' })

    expect(request?.bike).toBe('gravel')
    expect(request?.hills).toBe('hilly')
    expect(request?.costing).toBeUndefined()
  })

  it('omite el objetivo de desnivel cuando está apagado', () => {
    const request = toLoopRequest({ ...DEFAULT_LOOP_FORM, gainEnabled: false })

    expect(request?.gain_m).toBeUndefined()
    expect(request?.gain_tolerance).toBeUndefined()
    // La preferencia de desnivel es independiente del objetivo exacto.
    expect(request?.hills).toBe('rolling')
  })

  it('counts alternatives on top of the main loop', () => {
    expect(toLoopRequest(DEFAULT_LOOP_FORM)?.routes).toBeUndefined()
    expect(toLoopRequest({ ...DEFAULT_LOOP_FORM, alternatives: 3 })?.routes).toBe(4)
  })

  it('no pide ruta sin origen', () => {
    expect(toLoopRequest({ ...DEFAULT_LOOP_FORM, origin: null })).toBeNull()
  })
})
