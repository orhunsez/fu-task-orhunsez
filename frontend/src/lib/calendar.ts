// Takvim ızgarası için saf tarih fonksiyonları (paket yok, düz Date).
// Günler "YYYY-MM-DD" metniyle taşınır ve görevin due_date'iyle doğrudan karşılaştırılır.
// Hesaplar Date.UTC ve getUTC* ile yapılır; böylece tarayıcının saat dilimi günü kaydıramaz.
// "Bugün" ise format.ts'teki todayInIstanbul()'dan gelir.

export const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** Izgaranın sütun başlıkları; hafta Pazartesi başlar. */
export const WEEKDAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// getUTCDay sırası: 0 = Pazar.
const WEEKDAY_LONG = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

/** Takvimde görünen ay. month 1-12 arası. */
export type YearMonth = { year: number; month: number };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "2026-11-08" -> { year: 2026, month: 11 } */
export function monthOf(isoDate: string): YearMonth {
  const [year, month] = isoDate.split("-").map(Number);
  return { year, month };
}

/** delta ay sonrası (+1) ya da öncesi (-1). Date.UTC taşmayı düzeltir: 13. ay sonraki yılın Ocak'ı olur. */
export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Ayın günleri: ["2026-11-01", ..., "2026-11-30"]. */
export function daysOfMonth({ year, month }: YearMonth): string[] {
  // Sonraki ayın 0. günü bu ayın son günüdür; getUTCDate gün sayısını verir.
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: dayCount }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`);
}

/** Pazartesi başlangıçlı ızgarada ayın 1'inden önceki boş hücre sayısı. */
export function leadingBlanks({ year, month }: YearMonth): number {
  // getUTCDay Pazar'ı 0 verir; +6 ve mod 7 ile Pazartesi 0, Pazar 6 olur.
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

/** { 2026, 11 } -> "Kasım 2026" */
export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-11-08" -> "8 Kasım Pazar" */
export function dayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${day} ${MONTH_NAMES[month - 1]} ${WEEKDAY_LONG[weekday]}`;
}
