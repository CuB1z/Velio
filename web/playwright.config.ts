import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 5173)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm dev --port ${port} --strictPort`, url: baseURL, reuseExistingServer: true },
  projects: [
    { name: 'mocked', testDir: 'e2e/mocked', testIgnore: /responsive/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mocked-mobile', testDir: 'e2e/mocked', testMatch: /responsive/, use: { ...devices['Pixel 7'] } },
    { name: 'live', testDir: 'e2e/live', timeout: 180_000, use: { ...devices['Desktop Chrome'] } },
  ],
})
