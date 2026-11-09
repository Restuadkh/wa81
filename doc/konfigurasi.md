# Konfigurasi (`.env`)

Loader: `src/config/config.js`. File referensi: `.env` (terdapat juga backup `.env copy`).

## Watermark Daftar Variabel

| Variabel | Default | Keterangan |
|---|---|---|
| `TOKEN` | `''` | API key untuk middleware `keyCheck` |
| `PROTECT_ROUTES` | `false` | aktifkan proteksi route dengan TOKEN |
| `PORT` | `3333` | port HTTP Express |
| `RESTORE_SESSIONS_ON_START_UP` | `false` | restore `wa-81-adm` saat boot |
| `APP_URL` | — | basis URL ditampilkan di UI qr |
| `LOG_LEVEL` | `info` | level pino logger (Baileys & app) |
| `CLIENT_PLATFORM` | `Whatsapp MD` | client config Baileys |
| `CLIENT_BROWSER` | `Chrome` | idem |
| `CLIENT_VERSION` | `4.0.0` | idem |
| `INSTANCE_MAX_RETRY_QR` | `2` | maksimal retry QR sebelum logout |
| `MONGODB_ENABLED` | `false` | enable mongoose (saat ini mongoose connection dinonaktifkan di server.js; dipakai raw `mongodb` client) |
| `MONGODB_URL` | `mongodb://127.0.0.1:27017/Wa81instance` | URL Mongo |
| `WEBHOOK_ENABLED` | `false` | kirim event ke webhook eksternal |
| `WEBHOOK_URL` | — | base URL webhook |
| `WEBHOOK_BASE64` | `false` | sertakan media base64 di webhook |
| `WEBHOOK_ALLOWED_EVENTS` | `all` | daftar event dipisah koma |
| `MARK_MESSAGES_READ` | `false` | tandai pesan masuk dibaca |

## Nilai yang Saat Ini Hardcoded (di luar .env)

⚠️ Nilai-nilai berikut tidak dibaca dari `.env`; mengubahnya harus edit source:

| Nilai | Lokasi |
|---|---|
| Instance key `wa-81-adm` | `session.js:39`, `instance.js` |
| URL RabbitMQ `amqp://simrs:***@192.168.201.19:5672` | `mqWa81.js:4`, `workerMq.js` |
| gRPC host `192.168.201.19:5005` / `:5007` | `AdmisiSvc.js:26`, `P2gRpc.js:30` |
| ID grup kanal notif `ch.187` | `amQsend.js` |
| Nomor admin (`6281904000707`, `6289510778377`, `628121549688`, dll) | `instance.js:57-72` |
| Queue `wa_adm.notif`, `tm_queue`, `wa.notif` | `mqWa81.js`, `amQsend.js`, `workerMq.js` |
| Path session `../session/<key>` | `instance.js:135` |

Disarankan memindahkan semua ke `.env` + `config.js` (lihat rekomendasi).
