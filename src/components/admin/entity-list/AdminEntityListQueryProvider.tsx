"use client";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function shouldRetry(failureCount: number, error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : null;
  if (status && [400, 401, 403, 404].includes(status)) return false;
  return failureCount < 2;
}

export default function AdminEntityListQueryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: shouldRetry,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
