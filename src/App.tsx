import { AppProviders } from '@/providers/appProviders'
import { AppRouter } from '@/routes/router'

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
