import { describe, expect, it } from 'vitest'

import { parseGpx } from './gpx'
import { decodePolyline } from './polyline'

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Salida del domingo</name>
    <trkseg>
      <trkpt lat="40.5964" lon="-3.6318"><ele>710</ele></trkpt>
      <trkpt lat="40.6112" lon="-3.6001"><ele>745</ele></trkpt>
      <trkpt lat="40.6488" lon="-3.5772"><ele>802</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('lectura de GPX', () => {
  it('extrae la traza y la codifica como polyline6', () => {
    const track = parseGpx(GPX)
    expect(track).not.toBeNull()
    expect(track?.pointCount).toBe(3)
    expect(track?.name).toBe('Salida del domingo')

    const decoded = decodePolyline(track!.encoded)
    expect(decoded).toHaveLength(3)
    expect(decoded[0][1]).toBeCloseTo(40.5964, 5)
  })

  it('rechaza lo que no trae puntos de traza', () => {
    expect(parseGpx('<gpx></gpx>')).toBeNull()
    expect(parseGpx('esto no es xml <<<')).toBeNull()
  })
})
