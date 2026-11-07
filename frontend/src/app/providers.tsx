"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState ile her tarayıcı oturumunda tek bir QueryClient oluşur (render'da yeniden yaratılmaz).
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
