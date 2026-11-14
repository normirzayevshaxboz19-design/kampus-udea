/**
 * Chat uchun oddiy odob filtri.
 * Maqsad — haqorat va so'kinishlarni ushlab qolish, murakkab moderatsiya emas.
 */
const BANNED = [
  "ahmoq",
  "tentak",
  "nodon",
  "johil",
  "laqma",
  "besharm",
  "haromzoda",
  "itvachcha",
  "qo'toq",
  "siktir",
  "sikish",
  "blyat",
  "блядь",
  "бля",
  "сука",
  "хуй",
  "пизда",
  "дурак",
  "идиот",
  "дебил",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
];

const RULES = BANNED.map((word) => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // So'z oxiriga qo'shimcha qo'shilgan shakllarni ham ushlaydi: "ahmoq" → "ahmoqsan".
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}\\p{L}{0,4}(?=$|[^\\p{L}\\p{N}])`, "iu");
});

export const ETIQUETTE_NOTE =
  "Hurmat va odob — majburiy. Haqorat, so'kinish, spam va birovning shaxsiy ma'lumotini yozish taqiqlanadi.";

/** Xabar matnida odob buzilishi bo'lsa xato matnini qaytaradi. */
export function etiquetteError(text: string): string | null {
  const normal = text.replace(/[’ʻ`]/g, "'");
  if (RULES.some((re) => re.test(normal))) {
    return "Iltimos, odob saqlang — haqorat va so'kinishga yo'l qo'yilmaydi.";
  }
  return null;
}
