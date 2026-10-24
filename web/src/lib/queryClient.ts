import { QueryClient } from '@tanstack/react-query'

import { isRetryable } from '@/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // Retrying a 422 or bad credentials only burns quota.
      retry: (attempt, error) => attempt < 2 && isRetryable(error),
    },
    mutations: {
      retry: false,
    },
  },
})
