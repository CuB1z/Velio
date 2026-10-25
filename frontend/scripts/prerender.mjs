import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'
import { preview } from 'vite'

import { DEFAULT_LANGUAGE, LANGUAGES } from '../src/i18n/languages.ts'
import { SITE } from '../src/lib/site.ts'

const siteUrl = (process.env.SITE_URL ?? 'https://velio.cub1z.es').replace(/\/$/, '')
const outDir = path.resolve('dist/prerender')
const localized = (pathname, lang) => (lang === DEFAULT_LANGUAGE ? pathname : `/${lang}${pathname === '/' ? '' : pathname}`)
const pages = ['/', '/privacy', '/terms'].flatMap((pathname) =>
  LANGUAGES.map((lang) => {
    const route = localized(pathname, lang)
    return { lang, pathname, route, file: route === '/' ? 'index.html' : `${route.slice(1)}.html` }
  }),
)

const server = await preview({ logLevel: 'silent', preview: { port: 0 } })
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await chromium.launch()
console.log(`prerendering ${pages.length} pages for ${siteUrl}`)

try {
  for (const { lang, route, file } of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(base + route, { waitUntil: 'networkidle' })
    await page.waitForSelector('h1')
    await page.evaluate(async () => {
      const step = window.innerHeight / 2
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
    })
    let previous = ''
    for (;;) {
      const text = await page.evaluate(() => document.body.innerText)
      if (text === previous) break
      previous = text
      await page.waitForTimeout(500)
    }
    const captured = await page.evaluate(() => document.documentElement.outerHTML)
    await page.close()
    const html = `<!doctype html>\n${captured.replace(/^(<html[^>]*?) style="[^"]*"/, '$1').replaceAll(base, siteUrl)}`

    for (const needle of ['<h1', `lang="${lang}"`, `<link rel="canonical" href="${siteUrl}${route === '/' ? '/' : route}">`]) {
      if (!html.includes(needle)) throw new Error(`${route}: prerendered HTML is missing ${needle}`)
    }
    await mkdir(path.dirname(path.join(outDir, file)), { recursive: true })
    await writeFile(path.join(outDir, file), html)
    console.log(`${route.padEnd(12)} → dist/prerender/${file} (${(html.length / 1024).toFixed(0)} kB)`)
  }

  const alternates = (pathname) =>
    [...LANGUAGES.map((lang) => [lang, localized(pathname, lang)]), ['x-default', localized(pathname, DEFAULT_LANGUAGE)]]
      .map(([hreflang, route]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${siteUrl}${route}"/>`)
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...pages.flatMap(({ pathname, route }) => ['  <url>', `    <loc>${siteUrl}${route}</loc>`, ...alternates(pathname), '  </url>']),
    '</urlset>',
    '',
  ].join('\n')
  await writeFile(path.resolve('dist/sitemap.xml'), sitemap)
  await writeFile(path.resolve('dist/robots.txt'), `User-agent: *\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`)
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  await mkdir(path.resolve('dist/.well-known'), { recursive: true })
  await writeFile(
    path.resolve('dist/.well-known/security.txt'),
    `Contact: mailto:${SITE.contactEmail}\nExpires: ${expires}\nPreferred-Languages: en, es\nCanonical: ${siteUrl}/.well-known/security.txt\n`,
  )
  console.log(`sitemap.xml (${pages.length} urls), robots.txt and .well-known/security.txt → dist/`)
} finally {
  await browser.close()
  await server.close()
}
