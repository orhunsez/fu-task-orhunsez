"use client";

import { useQuery } from "@tanstack/react-query";

import { API_URL, apiFetch } from "@/lib/api";

export default function HomePage() {
  // Şimdilik sadece backend bağlantısını gösterir; görev listesi sonraki adımda gelecek.
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ status: string }>("/health"),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Saha Bakım Görev Takip</h1>
      <p className="mt-1 text-sm text-muted-foreground">Rüzgar santrali saha bakım ekibi</p>

      <div className="mt-8 rounded-lg border p-4 text-sm">
        <span className="font-medium">Backend: </span>
        {health.isPending && <span>bağlanılıyor…</span>}
        {health.isError && (
          <span className="text-destructive">
            ulaşılamadı ({API_URL}) — {health.error.message}
          </span>
        )}
        {health.isSuccess && <span className="text-green-600">bağlı ({health.data.status})</span>}
      </div>
    </main>
  );
}
