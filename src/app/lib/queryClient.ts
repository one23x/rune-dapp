import { QueryClient } from "@tanstack/react-query";

/**
 * THE app QueryClient — main.tsx provides this exact instance via
 * <QueryClientProvider>. It must stay a singleton: module-level
 * `queryClient.invalidateQueries(...)` calls (copy-trading shared.tsx etc.)
 * only work because they hit the same cache the components render from.
 * (main.tsx previously `new QueryClient()`-ed its own instance, turning every
 * imported-singleton invalidation into a silent no-op — 2026-06-06 fix.)
 *
 * Defaults match what main.tsx used to provide, so query behaviour is
 * unchanged; hooks that need different staleTime/retry set their own.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
