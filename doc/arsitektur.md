# Arsitektur

## Diagram Komponen

```
                    ┌─────────────────────────────────────────────┐
                    │                 SIMRS Backend               │
                    │  192.168.201.19                             │
                    │  ┌──────────────┐   ┌─────────────────────┐ │
                    │  │ gRPC Adm     │   │ RabbitMQ            │ │
                    │  │ :5005 / :5007│   │ :5672 (simrs/rmq187)│ │
                    │  │ BookingQueue │   │ queues:             │ │
                    │  │ BookingChk   │   │  - wa_adm.notif  →  │ │
                    │  └──────▲───────┘   │  - tm_queue      ←  │ │
                    │         │           │  - wa.notif      ←  │ │
                    │         │           └──────────┬──────────┘ │
                    └─────────┼──────────────────────┼────────────┘
                              │ gRPC                 │ AMQP
┌─────────────────────────────┴──────────────────────▼─────────────┐
│                          wa81 (Node.js)                          │
│                                                                  │
│  ┌─────────────┐   ┌────────────────────┐    ┌────────────────┐  │
│  │ mqWa81.js   │   │ instance.js        │◄──►│ AdmisiSvc.js/  │  │
│  │ (consumer   ├──►│ WhatsAppInstance   │    │ P2gRpc.js      │  │
│  │  wa_adm.notif)  │ (Baileys socket,   │    │ (gRPC stubs,   │  │
│  └─────────────┘   │  handler pesan)    │    │  lock/retry)   │  │
│                    └─────────▲──────────┘    └────────────────┘  │
│                              │                                   │
│  ┌─────────────┐   ┌────────┴──────────┐    ┌────────────────┐  │
│  │ amQsend.js  │   │ Express API       │    │ MongoDB        │  │
│  │ (notif ops  │   │ /instance,/message│    │ (chat.model,   │  │
│  │  via worker)│   │ /group,/misc      │    │  instance db)  │  │
│  └─────────────┘   └───────────────────┘    └────────────────┘  │
└──────────────────────────────▲───────────────────────────────────┘
                               │ WhatsApp MD (Baileys websocket)
                        ┌──────┴──────┐
                        │   Pasien /  │
                        │  Admin WA   │
                        └─────────────┘
```

## Komponen Utama

| File | Peran |
|---|---|
| `src/server.js` | Entrypoint. Start Express, connect MongoDB (raw client, `global.mongoClient`), restore session, kirim notif restart. Tangani `uncaughtException`/`unhandledRejection` → notif WA lalu exit. |
| `src/config/config.js` | Loader env `.env` (port, token, mongo, webhook, browser config, dll). |
| `src/config/express.js` | Setup Express, router, middleware error. |
| `src/api/class/instance.js` | **Inti bot** (~3.700+ baris). Class `WhatsAppInstance`: init socket Baileys, handler `connection.update` (QR/reconnect), handler `messages.upsert` (parsing perintah pasien, format balasan, daftar/blacklist nomor), `updateMsg()` kirim WA, webhook posting, dsb. |
| `src/api/class/session.js` | `Session.restoreSessions()` — restore instance `wa-81-adm` (hardcoded), jadwalkan `MsgQueue` +88 detik. |
| `src/api/class/mqWa81.js` | `MsgQueue` — consumer RabbitMQ queue `wa_adm.notif`, teruskan pesan ke `updateMsg()`. Perintah khusus `.reStartService` untuk self-restart. |
| `src/api/class/AdmisiSvc.js` | Stub gRPC port `5005` (singleton, lock `busy`, retry, cancel-token). |
| `src/api/class/P2gRpc.js` | Stub gRPC port `5007` (per-request instance, lock, retry, cancel-token). |
| `src/api/protos/admition.proto` | Definisi proto: `AdmRequest{msg, sender, tm}`, `AdmReply{res, rem}`, service `Adm { BookingQueue, BookingChk }`. |
| `src/api/helper/amQsend.js` | Kirim notif ops via `worker_threads` (`workerMq.js`) ke queue `tm_queue` (default channel `ch.187`) atau `wa.notif`. |
| `src/api/helper/mongoAuthState.js` | Alternatif auth-state via Mongo (saat ini tidak dipakai; memakai `useMultiFileAuthState`). |
| `src/api/helper/validPhnNumber.js` | Validasi/normalisasi nomor WA (`62...`), helper string. |
| `src/api/models/chat.model.js` | Model chat + helper `connectDB`/`getCollection`. |

## State Daftar Kontak (di `instance.js`)

| Variabel | Fungsi |
|---|---|
| `lsGoodclient`, `lsTrustedClient`, `lsBotClient`, `lsTrialclient` | whitelist/pembatasan berdasarkan nomor |
| `lsBruteClient`, `lsBruteRm`, `clientIdnoBonus`, `lsXclients` | pembatasan anti-spam/brute |
| `lsCancel` (di service gRPC) | cancel-token anti double-request |
| `lsUnreadChats`, `lsRevCanceled`, `lsUnSent`, `lsExResp` | state pesan (unread, dibatalkan, gagal kirim) |

## Titik Masuk Pesan

Ada dua jalur pesan keluar-WA:

1. **Interaktif (bot)** — pasien chat langsung → handler `messages.upsert` di `instance.js` → balasan otomatis.
2. **Via queue (sistem lain)** — sistem/SIMRS publish ke `wa_adm.notif` → `mqWa81.send_msg()` → `instance.updateMsg()`.
