import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'

import { useDocumentHead } from '@/hooks/useDocumentHead'

const links = () =>
  [...document.head.querySelectorAll('link')].map((link) => [link.rel, link.hreflang, link.href].filter(Boolean).join(' '))

it('adds canonical, alternates, robots and description while mounted', () => {
  const { unmount } = renderHook(() =>
    useDocumentHead({
      description: 'Rutas',
      canonical: 'https://velio.test/es',
      alternates: { es: 'https://velio.test/es', en: 'https://velio.test/en' },
      noindex: true,
    }),
  )

  expect(links()).toEqual([
    'canonical https://velio.test/es',
    'alternate es https://velio.test/es',
    'alternate en https://velio.test/en',
  ])
  expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Rutas')

  unmount()
  expect(links()).toEqual([])
  expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  expect(document.head.querySelector('meta[name="description"]')).toBeNull()
})

it('updates and restores an existing description', () => {
  const meta = document.createElement('meta')
  meta.name = 'description'
  meta.content = 'before'
  document.head.append(meta)

  const { rerender, unmount } = renderHook((description: string) => useDocumentHead({ description }), {
    initialProps: 'one',
  })
  expect(meta.content).toBe('one')
  rerender('two')
  expect(meta.content).toBe('two')

  unmount()
  expect(meta.content).toBe('before')
  meta.remove()
})

it('replaces head tags left by a prerendered page', () => {
  document.head.insertAdjacentHTML(
    'beforeend',
    '<link rel="canonical" href="https://velio.test/"><link rel="alternate" hreflang="es" href="https://velio.test/es"><meta name="robots" content="noindex">',
  )

  const { unmount } = renderHook(() =>
    useDocumentHead({ canonical: 'https://velio.test/es', alternates: { en: 'https://velio.test/' } }),
  )

  expect(links()).toEqual(['canonical https://velio.test/es', 'alternate en https://velio.test/'])
  expect(document.head.querySelector('meta[name="robots"]')).toBeNull()

  unmount()
  expect(links()).toEqual([])
})

it('adds the Open Graph and Twitter card tags while mounted', () => {
  const property = (name: string) => document.head.querySelector(`meta[property="${name}"]`)?.getAttribute('content')
  const { unmount } = renderHook(() =>
    useDocumentHead({
      social: {
        title: 'Velio · Circuitos',
        description: 'Rutas',
        url: 'https://velio.test/',
        image: 'https://velio.test/og-es.png',
        imageAlt: 'Perfil',
        locale: 'es_ES',
      },
    }),
  )

  expect(property('og:title')).toBe('Velio · Circuitos')
  expect(property('og:image')).toBe('https://velio.test/og-es.png')
  expect(property('og:locale')).toBe('es_ES')
  expect(document.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image')

  unmount()
  expect(document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')).toHaveLength(0)
})
