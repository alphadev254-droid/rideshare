import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { extractApiError, isDriverNotOnboardedError } from "@/lib/api";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (isDriverNotOnboardedError(error)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silent) return;
        if (isDriverNotOnboardedError(error)) return;
        toast.error(extractApiError(error, "Failed to load data"));
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return;
        if (isDriverNotOnboardedError(error)) return;
        toast.error(extractApiError(error, "Something went wrong"));
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

