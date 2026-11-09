# 02 — Arsitektur & Struktur Kode

## Struktur Folder

```
src/
├── server.js                  # Entry point: dotenv, mongoose, listen, graceful shutdown
├── config/
│   ├── express.js             # App Express: CORS, body 50mb, view EJS, routes, error handler
│   └── config.js              # Semua konfigurasi dari env → module.exports
├── api/
│   ├── routes/                # instance.route, message.route, group.route, misc.route, index
│   ├── controllers/           # instance, message, group, misc controller
│   ├── middlewares/           # keyCheck (key valid?), loginCheck (online?), tokenCheck, error
│   ├── class/
│   │   ├── instance.js        # ⭐ Kelas inti WhatsAppInstance (±2000 baris)
│   │   ├── session.js         # Restore sesi dari MongoDB saat startup
│   │   └── mqConsumer.js      # Konsumer queue `wa.notif` dari SIMRS
│   ├── helper/
│   │   ├── amQsend.js         # Publish logNotif → queue `tm_queue`
│   │   ├── mqTmNotif1.js      # Forward chat pasien → queue `tmgw.notif` (ke SIMRS)
│   │   ├── validPhnNumber.js  # Normalisasi nomor (08…/8…/@lid/@g.us → JID)
│   │   ├── downloadMsg.js     # Unduh buffer media dari msg Baileys
│   │   ├── mongoAuthState.js  # (sudah tidak dipakai aktif; auth sekarang file-based)
│   │   ├── processbtn.js, genVc.js, sleep.js, connectMongoClient.js
│   ├── models/chat.model.js   # Model Mongo `chat` { key, chat }
│   ├── views/qrcode.ejs       # Halaman tampil QR pairing
│   └── errors/                # extendable.error, api.error
└── tests/status.route.test.js # Mocha + supertest
```

File duplikat yang terlihat: `mqTmNotif1 - Copy.js`, `mqConsumer copy.js` — cadangan manual, tidak di-require.

## Komponen Utama

### 1. `WhatsAppInstance` (instance.js)
- **init()** — fetch versi Baileys (fallback `[2,3000,1043857760]`), auth state file-based (`session/<key>/`), `makeWASocket`, pasang handler, buat `MsgQueue`, kirim info "init" ke RMQ.
- **setHandler()** — listener Baileys:
  - `connection.update`: logika **reconnect bertingkat**
    - `restart required` → `process.exit(-1)` (supervisor yang me-restart)
    - disconnect biasa → tunggu 33s → init() ulang; hitung `cnt01`
    - disconnect ke-2 → alarm ke `ID_rsdGw`
    - `Method Not Allowed` & cnt>2 → tunggu 10 menit
    - `stream errored / 440 / cnt>19` → `process.exit(-1)`
    - `loggedOut` → **hapus folder session** lalu init() ulang (perlu scan QR baru)
    - `open` → notif "up" ke RMQ; jika sebelumnya down → kirim notif dan `process.exit(1)` untuk restart bersih
    - QR → simpan base64, hitung retry sesuai `INSTANCE_MAX_RETRY_QR`, timer countdown 60 detik
  - `messages.upsert`: (detail di 04-Alur-Chat.md)
  - `messages.update`: pantau status bic (delivered/read), kumpulkan daftar chat "unrespMsg" dan laporkan
  - `chats.set/upsert/update/delete`: mirror chat ke memori + MongoDB; lacak `unreadCount`
  - callback call (CB:call): reply "Maaf tidak dapat menerima tlp🙏🏻" + webhook
- **updateMsg(phn, text, img, note)** — pengirim pesan keluar dari intent SIMRS:
  - `img > 'A'` → kirim file dari `Media/` (misal `happybday.jpg`)
  - `img ~ /Download/tm/...` → kirim image/video dari folder download Telegram
  - selain itu → `sendTextMessage()`
  - retry 3× internally (e1), reconnect saat statusCode 428, catat ke RMQ saat gagal.

### 2. `MsgQueue` (mqConsumer.js)
- Konsumen queue **`wa.notif`** (`noAck: true`).
- Validasi payload: `{ key: '#187', phn: <string>, mx: <string>, img?: string, note?: string }`
- Retry kirim 2× dengan jeda 87 detik jika gagal (mis. connection down).
- Perintah `.reStartService` ditangani (saat ini hanya log).

### 3. `Session` (session.js)
- `restoreSessions()` saat startup (jika `RESTORE_SESSIONS_ON_START_UP=true`): buat instance untuk setiap collection Mongo; **`wa-187-gw` dipaksa selalu dibuat terakhir agar tidak dobel socket**.

### 4. Express (config/express.js)
- CORS `*`, JSON body limit 50 MB, view EJS untuk halaman QR.
- `PROTECT_ROUTES=true` → semua endpoint diawali `tokenCheck` (header `token` vs `TOKEN` env).
- `global.WhatsAppInstances = {}` registry instance.

## Infrastruktur Terkait

| Komponen | Fungsi |
|---|---|
| RabbitMQ (`RMQ_URL`) | Bus antara gateway ↔ SIMRS ↔ monitoring. Queue: `tm_queue` (log), `tmgw.notif` (forward chat), `wa.notif` (perintah kirim). Consumer routing key `ch.wa-gw`/`ch.187`/`group`. |
| MongoDB (`MONGODB_URL`) | Penyimpan session-instance (curang lama koleksi) & dokumen `chat`. |
| Folder `session/<key>/` | Auth state Baileys (file-based). Hati-hati: **dihapus otomatis saat loggedOut**. |
| Folder `/Download/` | File media yang masuk dari pasien disimpan di root drive `/Download/` (absolute path Windows/Unix — perlu diperiksa di deployment). |

## Catatan Deployment

- `Dockerfile`, `docker-compose.yml` tersedia (Mongo + app). Namun RMQ URL perlu di-set via `.env`.
- `Procfile` untuk Heroku/PM2-style start.
