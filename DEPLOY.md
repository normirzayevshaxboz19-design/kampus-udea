# Deploy — Kampus (UDEA)

Loyiha Next.js 15 (Node server) + SQLite (`better-sqlite3`). SQLite **doimiy disk** talab qiladi,
shuning uchun serverless platformalar (Vercel, Netlify, Cloudflare Workers) bu holatda ishlamaydi.
Quyidagi variantlar Docker image yoki Node server bilan ishlaydi.

## Kerakli muhit o'zgaruvchilari

| Nomi | Qiymat | Izoh |
| --- | --- | --- |
| `DATABASE_FILE` | `/data/kampus.db` | SQLite fayli — volume ichida bo'lishi shart |
| `SETUP_TOKEN` | tasodifiy uzun kalit | Bosh adminni faqat shu kalit egasi yaratadi |
| `PORT` | `3000` | Platforma beradigan port (Next `PORT` ni o'zi o'qiydi) |
| `NODE_ENV` | `production` | Dockerfile ichida allaqachon bor |

Kalit yaratish: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`

Health-check manzili: **`/api/health`** → `{"ok":true,"uptime":N}`

## 1-variant: Northflank Sandbox (bepul, uxlamaydi)

Free Sandbox: 2 servis + 1 baza, «always on, no sleeping», karta talab qilinmaydi, volume qo'llab-quvvatlanadi.

1. https://app.northflank.com/signup → GitHub bilan kirish.
2. **Create project** → `kampus`.
3. **Create service** → **Build from repository** (GitHub repo) yoki **External image** (Dockerfile bilan build qilingan image).
   - Dockerfile rejimi: `Dockerfile` avtomatik topiladi, build konteksti — repo ildizi.
4. **Networking**: ichki port `3000`, HTTP health check `/api/health`.
5. **Volumes**: yangi volume → mount path `/data` (1 GB yetarli).
6. **Environment**: `DATABASE_FILE=/data/kampus.db`, `SETUP_TOKEN=<kalit>`.
7. **Deploy** → URL tayyor bo'lgach birinchi bo'lib oching:
   `https://<domen>/setup?token=<kalit>` va bosh admin hisobini yarating.
   Kalitni yaratib bo'lgach `SETUP_TOKEN` ni o'chirib qo'ysangiz ham bo'ladi (baza bo'sh bo'lmagani uchun
   `/setup` baribir yopiq).

> Diqqat: Northflank 2026-yilda xavfsizlik insidentini e'lon qilgan. U yerda boshqa saytlaringiz bilan
> bir xil parol ishlatmang va faqat shu loyihaga tegishli kalitlarni saqlang.

## 2-variant: Fly.io (volume bilan, arzon)

```bash
fly launch --no-deploy            # Dockerfile avtomatik aniqlanadi
fly volumes create kampus_data --size 1
fly secrets set SETUP_TOKEN=<kalit>
# fly.toml ichida: [mounts] source="kampus_data" destination="/data"
# va [env] DATABASE_FILE="/data/kampus.db"
fly deploy
```

Eng kichik machine ≈ $2.19/oy; kichik hisob-fakturalar ko'pincha hisoblanmaydi, lekin karta talab qilinadi.

## Tavsiya etilmaydigan variantlar

- **Render free** — bepul web service'da doimiy disk yo'q, har restart/deploy'da SQLite fayli o'chib ketadi.
  Faqat pullik instans + disk bilan ishlaydi.
- **Vercel / Netlify / Cloudflare Workers** — fayl tizimi yo'q va `better-sqlite3` native moduli ishlamaydi.
  Bu yo'l uchun bazani D1/Postgres/Turso'ga ko'chirish (butun `lib/db.ts` va so'rovlarni async qilish) kerak.

## Yangilanish (deploy qilish)

Repo'ga push → platforma avtomatik qayta build qiladi. Volume `/data` saqlanib qoladi,
ya'ni foydalanuvchilar, tadbirlar va chiptalar yo'qolmaydi.

## Backup

Volume ichidagi `kampus.db` (va `-wal`) — butun baza. Platformaning shell/konsol'idan:

```bash
sqlite3 /data/kampus.db ".backup /data/backup-$(date +%F).db"
```

Keyin faylni yuklab oling. Kunlik/oraliq backup uchun shu buyruqni cron job sifatida qo'shish mumkin.

## Lokal production tekshiruvi

```bash
npm run build
PORT=3020 DATABASE_FILE=/tmp/prod.db SETUP_TOKEN=test npm run start
curl http://localhost:3020/api/health   # {"ok":true,...}
```
