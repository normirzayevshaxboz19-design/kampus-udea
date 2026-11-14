# Kampus UDEA — talabalar platformasi

UDEA universiteti uchun yagona platforma: tadbirlar, klublar, QR chiptalar (Pulse), navbat
(waitlist), jamoalar va tashkilotchilar paneli.

## Imkoniyatlar

- **Tadbirlar** — e'lon, filtr, ro'yxatdan o'tish, joylar nazorati, navbatga avtomatik o'tish
- **Pulse** — shaxsiy chiptalar, QR kod, o'qish davomida tekshirish (skaner)
- **Klublar** — a'zolik arizalari, koordinatorlar, ichki (internal) tadbirlar
- **Jamoalar** — tadbir doirasida jamoa tuzish (6 kishigacha)
- **Tashkilotchilar paneli** — tadbir CRUD, ishtirokchilar, davomat, CSV eksport, vazifalar, reja
- **Interfeys** — o'zbek / rus / ingliz, yorug' va qorong'i tema, mobil va Telegram Mini App

## Texnologiyalar

- Next.js 15 (App Router, server actions) + React 19
- SQLite (`better-sqlite3`) — sxema `lib/schema.ts`, migratsiyalar `lib/db.ts`
- Tailwind CSS 4, `@fontsource` shriftlari
- Docker image (Node 22) + `/data` volume

## Ishga tushirish

```bash
npm install
npm run dev          # http://localhost:3002
```

Birinchi ochilishda `/setup` sahifasida bosh admin hisobi yaratiladi.

Baza fayli: `data/kampus.db` (`DATABASE_FILE` bilan almashtiriladi).

## Deploy

Batafsil: [DEPLOY.md](DEPLOY.md) — Dockerfile, volume, muhit o'zgaruvchilari və health-check.

- `DATABASE_FILE=/data/kampus.db`
- `SETUP_TOKEN=<tasodifiy kalit>` — birinchi adminni faqat kalit egasi yaratadi
- health-check: `/api/health`

## Xavfsizlik

Parollar scrypt bilan xeshlanadi, sessiyalar `httpOnly` cookie'da, login/ro'yxatdan o'tish va
skaner API'sida rate limit, ichki tadbirlar va chatlar a'zolik bilan cheklangan, CSP/HSTS
sarlavhalari `next.config.ts` da.
