// Backend adresi build sırasında NEXT_PUBLIC_API_URL'den gelir.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Backend'in tutarlı hata gövdesi: {"detail": "...", "field": "..."} */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/** JSON dönen bir backend isteği yapar; 2xx dışındaki cevaplarda ApiError fırlatır. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.detail ?? "Beklenmeyen bir hata oluştu", body?.field);
  }

  // 204 No Content (örn. silme) gövde döndürmez.
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
