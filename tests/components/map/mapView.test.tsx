import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { MapView } from '@/components/map/mapView'
import i18n from '@/i18n'

const fake = vi.hoisted(() => {
  type Handler = (event?: unknown) => void

  class FakeMap {
    static instances: FakeMap[] = []
    static tilesLoadedOnCreate = true
    options: Record<string, unknown>
    handlers = new Map<string, Set<Handler>>()
    sources = new Map<string, { setData: (data: unknown) => void; data: unknown }>()
    layers = new Set<string>()
    removed = false
    style = { _loaded: true }
    tilesLoaded: boolean

    constructor(options: Record<string, unknown>) {
      this.options = options
      this.tilesLoaded = FakeMap.tilesLoadedOnCreate
      FakeMap.instances.push(this)
    }
    on(type: string, handler: Handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set())
      this.handlers.get(type)?.add(handler)
      return this
    }
    off(type: string, handler: Handler) {
      this.handlers.get(type)?.delete(handler)
      return this
    }
    fire(type: string, event?: unknown) {
      for (const handler of this.handlers.get(type) ?? []) handler(event)
    }
    isStyleLoaded() {
      return this.style._loaded && this.tilesLoaded
    }
    setStyle() {}
    addSource(id: string, spec: { data: unknown }) {
      const source = { data: spec.data, setData: (data: unknown) => (source.data = data) }
      this.sources.set(id, source)
    }
    getSource(id: string) {
      return this.sources.get(id)
    }
    addLayer(layer: { id: string }) {
      this.layers.add(layer.id)
    }
    getLayer(id: string) {
      return this.layers.has(id) ? { id } : undefined
    }
    getLayoutProperty() {
      return undefined
    }
    setLayoutProperty() {}
    hasImage() {
      return false
    }
    addImage() {}
    fitBounds() {}
    easeTo() {}
    getZoom() {
      return 11
    }
    getCanvas() {
      return document.createElement('canvas')
    }
    zoomIn() {}
    zoomOut() {}
    remove() {
      this.removed = true
    }
  }

  class FakeMarker {
    static added = 0
    setLngLat() {
      return this
    }
    addTo() {
      FakeMarker.added += 1
      return this
    }
    remove() {
      FakeMarker.added -= 1
    }
  }

  return { FakeMap, FakeMarker }
})

vi.mock('maplibre-gl', () => ({ Map: fake.FakeMap, Marker: fake.FakeMarker }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

beforeEach(async () => {
  fake.FakeMap.instances = []
  fake.FakeMap.tilesLoadedOnCreate = true
  fake.FakeMarker.added = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  await i18n.changeLanguage('es')
})

it('creates one map bounded to Spain and destroys it on unmount', () => {
  const { unmount } = render(<MapView styleId="map" />)
  expect(fake.FakeMap.instances).toHaveLength(1)
  const [map] = fake.FakeMap.instances
  expect(map.options.maxBounds).toEqual([
    [-19.5, 26.5],
    [5.5, 44.5],
  ])

  unmount()
  expect(map.removed).toBe(true)
})

it('reports clicks as [lon, lat]', () => {
  const onMapClick = vi.fn()
  render(<MapView styleId="map" onMapClick={onMapClick} />)
  fake.FakeMap.instances[0].fire('click', { lngLat: { lng: -3.7038, lat: 40.4168 } })
  expect(onMapClick).toHaveBeenCalledWith([-3.7038, 40.4168])
})

it('draws every route as a LineString and places the markers', () => {
  render(
    <MapView
      styleId="map"
      routes={[
        { id: 'a', coordinates: [[-3.7, 40.4], [-3.6, 40.5]], colorIndex: 0, selected: true },
        { id: 'b', coordinates: [[-3.7, 40.4], [-3.8, 40.3]], colorIndex: 1, selected: false },
      ]}
      markers={[
        { id: 'start', coordinate: [-3.7, 40.4], kind: 'start' },
        { id: 'end', coordinate: [-3.6, 40.5], kind: 'end' },
      ]}
    />,
  )
  const map = fake.FakeMap.instances[0]
  map.fire('styledata')

  const data = map.sources.get('velio-routes')?.data as {
    features: { geometry: { type: string }; properties: { selected: number } }[]
  }
  expect(data.features.map((feature) => feature.geometry.type)).toEqual(['LineString', 'LineString'])
  expect(data.features.filter((feature) => feature.properties.selected === 1)).toHaveLength(1)
  expect(map.layers.has('velio-routes-selected-line')).toBe(true)
  expect(fake.FakeMarker.added).toBe(2)
})

it('draws the route as soon as the style is parsed, without waiting for tiles', () => {
  fake.FakeMap.tilesLoadedOnCreate = false
  render(
    <MapView
      styleId="satellite"
      routes={[{ id: 'a', coordinates: [[-3.7, 40.4], [-3.6, 40.5]], colorIndex: 0, selected: true }]}
    />,
  )
  const map = fake.FakeMap.instances[0]
  map.fire('styledata')

  expect(map.isStyleLoaded()).toBe(false)
  expect(map.sources.has('velio-routes')).toBe(true)
  expect(map.layers.has('velio-routes-selected-line')).toBe(true)
})

it('waits while the style itself is still loading', () => {
  render(<MapView styleId="map" routes={[]} />)
  const map = fake.FakeMap.instances[0]
  map.sources.clear()
  map.layers.clear()
  map.style._loaded = false
  map.fire('styledata')
  expect(map.sources.size).toBe(0)
})
