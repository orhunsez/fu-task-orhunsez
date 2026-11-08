import { CircleAlertIcon, InboxIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Sayfaların ortak yükleniyor / hata / boş görünümleri. Kendi kutuları yok; bulundukları
// kartın içinde ortalanırlar, böylece tablo, detay ve takvimde aynı görünürler.

/** Veri gelene kadar gri, yanıp sönen satırlar. */
export function LoadingRows({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2.5 py-2" aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

/** İstek başarısız oldu: hata mesajı ve "Tekrar dene" düğmesi. */
export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-10 text-center">
      <CircleAlertIcon className="size-8 text-destructive" aria-hidden="true" />
      <p className="mt-3 font-medium text-destructive">Veriler yüklenemedi</p>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        Tekrar dene
      </Button>
    </div>
  );
}

/** Gösterilecek kayıt yok. children ile bir düğme eklenebilir (örn. "Filtreleri temizle"). */
export function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-muted-foreground">{message}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
