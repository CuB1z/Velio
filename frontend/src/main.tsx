import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import i18n, { DEFAULT_LANGUAGE } from '@/i18n'
import { swapLang } from '@/lib/paths'
import '@/styles/globals.css'
import App from './App'

if (i18n.language !== DEFAULT_LANGUAGE) {
  const preferred = swapLang(location.pathname, i18n.language)
  if (preferred !== location.pathname) {
    history.replaceState(history.state, '', preferred + location.search + location.hash)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
