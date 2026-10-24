import { describe, expect, it } from 'vitest'

import { parseUserAgent } from '@/lib/userAgent'

const CHROME_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
const EDGE_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'

describe('parseUserAgent', () => {
  it('names the browser and platform', () => {
    expect(parseUserAgent(CHROME_LINUX)).toEqual({ browser: 'Chrome', platform: 'Linux', mobile: false })
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ browser: 'Safari', platform: 'iPhone', mobile: true })
    expect(parseUserAgent(FIREFOX_WINDOWS)).toEqual({ browser: 'Firefox', platform: 'Windows', mobile: false })
    expect(parseUserAgent(EDGE_MAC)).toEqual({ browser: 'Edge', platform: 'macOS', mobile: false })
  })

  it('gives up quietly on missing or unknown strings', () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, platform: null, mobile: false })
    expect(parseUserAgent('curl/8.5.0')).toEqual({ browser: null, platform: null, mobile: false })
  })
})
