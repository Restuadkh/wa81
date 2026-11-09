# 03 — Konfigurasi & Cara Menjalankan

## Environment Variables (semua dari `src/config/config.js`)

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `5033` | Port HTTP server |
| `TOKEN` | '' | Token global (wajib jika `PROTECT_ROUTES=true`) |
| `PROTECT_ROUTES` | `false` | `true` = semua endpoint butuh header token |
| `RESTORE_SESSIONS_ON_START_UP` | `false` | Restore sesi setelah restart |
| `APP_URL` | `false` | URL publik (opsional saat menampilkan QR) |
| `LOG_LEVEL` | `info` | Pino log level |
| `INSTANCE_MAX_RETRY_QR` | `2` | Berapa kali QR boleh regenerate sebelum socket ditutup |
| `CLIENT_PLATFORM` | `Whatsapp MD` | Browser platform yang dilaporkan ke WA |
| `CLIENT_BROWSER` | `Chrome` | Browser name |
| `CLIENT_VERSION` | `4.0.0` | Browser version |
| `MONGODB_ENABLED` | `false` | Aktif/nonaktifkan MongoDB |
| `MONGODB_URL` | `mongodb://127.0.0.1:27017/WhatsAppInstance` | Koneksi Mongo |
| `WEBHOOK_ENABLED` | `false` | Aktif/nonaktifkan webhook |
| `WEBHOOK_URL` | (none) | URL webhook tujuan (base URL axios instance) |
| `WEBHOOK_BASE64` | `false` | Kirim base64 di webhook |
| `WEBHOOK_ALLOWED_EVENTS` | `['all']` | Event webhook yang diizinkan (comma-separated) |
| `MARK_MESSAGES_READ` | `false` | Auto mark-read (di kode saat ini nonaktif, hardcoded terkirim) |
| `RMQ_URL` | (dipakai di mqConsumer/amQsend/mqTmNotif1) | **Wajib** untuk koneksi RabbitMQ, mis. `amqp://user:pass@host:5672` |

## Menjalankan

```bash
npm install
# buat .env sesuai tabel di atas, minimal:
#   PORT=5033
#   MONGODB_ENABLED=true
#   MONGODB_URL=mongodb://127.0.0.1:27017/WhatsAppInstance
#   RESTORE_SESSIONS_ON_START_UP=true
#   RMQ_URL=amqp://guest:guest@127.0.0.1:5672
npm start           # produksi
npm run dev         # nodemon (config di nodemon.json)
```

Pairing pertama: buka `GET /instance/qr?key=wa-187-gw` di browser → scan QR via WhatsApp > Perangkat Tertaut.

## Docker

```bash
docker-compose up -d
```
Membangun `api` (port `PORT`) + `mongodb`. Tambahkan `RMQ_URL` di `.env` sebelum menjalankan.

## Tools Pengembangan

| Perintah | Fungsi |
|---|---|
| `npm run format:write` | Prettier |
| `npm run lint:fix` | ESLint |
| `npm test` | Mocha + supertest (`tests/*.test.js`) |
| `npm run configure-husky` | Setup pre-commit hook |

## Pemeliharaan yang Dianjurkan

- Set `PROTECT_ROUTES=true` dan set `TOKEN` sebelum dipakai di produksi.
- Sebaiknya process manager (`pm2` / `systemd`) digunakan karena kode sering memanggil `process.exit()` sebagai ft-restart.
- Tambahkan pengaturan max-fail / rate-limit jika mau lebih stabil dari spam kirim massal.
