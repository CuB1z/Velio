import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'
import { preview } from 'vite'

import { DEFAULT_LANGUAGE, LANGUAGES } from '../src/i18n/languages.ts'

const siteUrl = (process.env.SITE_URL ?? 'https://velio.cub1z.es').replace(/\/$/, '')
const outDir = path.resolve('dist/prerender')
const pages = ['/', '/privacy', '/terms'].flatMap((pathname) =>
  LANGUAGES.map((lang) => {
    const route = lang === DEFAULT_LANGUAGE ? pathname : `/${lang}${pathname === '/' ? '' : pathname}`
    return { lang, route, file: route === '/' ? 'index.html' : `${route.slice(1)}.html` }
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
} finally {
  await browser.close()
  await server.close()
}
