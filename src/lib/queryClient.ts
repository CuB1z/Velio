import { QueryClient } from '@tanstack/react-query'

import { isRetryable } from '@/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Insistir ante un 422 o unas credenciales malas solo gasta cuota.
      retry: (attempt, error) => attempt < 2 && isRetryable(error),
    },
    mutations: {
      retry: false,
    },
  },
})
