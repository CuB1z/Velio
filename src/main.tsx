import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/globals.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
