// "İşlem yapan kişi": auth olmadığı için değişikliği kimin yaptığı arayüzde seçilir.
// Seçim localStorage'da tutulur; sayfa yenilense de kalır. İsteklerde actor_id olarak gider.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "actorId";

// Seçim değişince haber verilecek bileşenler (başlıktaki seçici, formlar).
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStoredActor() {
  return localStorage.getItem(STORAGE_KEY);
}

// Sunucuda localStorage yok; sunucu render'ında "seçilmemiş" kabul edilir.
function readActorOnServer() {
  return null;
}

/** Seçili kişinin id'si (yoksa null) ve seçimi değiştiren fonksiyon. */
export function useActor() {
  // useSyncExternalStore: React dışındaki bir kaynağı (localStorage) okur. Render sırasında
  // localStorage'a dokunmadığı için sunucu ve tarayıcı çıktısı çakışmaz (hydration hatası olmaz).
  const stored = useSyncExternalStore(subscribe, readStoredActor, readActorOnServer);
  const actorId = stored ? Number(stored) : null;

  function setActorId(id: number | null) {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
    listeners.forEach((listener) => listener());
  }

  return { actorId, setActorId };
}
