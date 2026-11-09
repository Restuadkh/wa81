# 07 — Keamanan, Monitoring & Penyimpanan

## Keamanan

| Aspek | Kondisi saat ini | Rekomendasi |
|---|---|---|
| Token | Dinonaktifkan (`PROTECT_ROUTES` default `false`) | Aktifkan + set `TOKEN` yang kuat |
| CORS | `origin: '*'` | Batas ke domain dashboard |
| Broadcast | Auto-reply aktif ke semua non-operator | Tambah whitelist / rate-limit |
| Session | Disimpan file `session/<key>/` dan **otomatis dihapus saat loggedOut** | Pastikan backup sesi bila perlu restore cepat |
| Nomor internal | Hard-coded (`ID_rsdPS`, `ID_yh`) di source | Pindahkan ke env agar aman digabung dengan repo share |
| Kredensial | Tidak ada di repo tapi `RMQ_URL` bisa berisi user/pass | Simpan sebagai env; jangan commit `.env` |
| Webhook | Tidak ada otentikasi pada receiver, `axiosInstance` base dari env | Tambah HMAC di webhook jika berupa API pihak 3 |

## Monitoring yang Tersedia

- **RMQ log pusat** (`tm_queue`) untuk semua kejadian: init, disconnect, error download, unreadCount, unrespMsg (delivered).
- **Pesan chat langsung ke WA-81** (nomor `6281904000707`) saat:
  - disconnect ke-2 → `⚡️⛑WaGw disconnected #n`
  - back online → `🟢WaGw connection up`
  - loggedOut → `🔴WaGw loggedOut`
- **Health REST**: `GET /status` mengembalikan `OK`.

## Unread / Unresponsive tracking

- `lsUnreadChats` — daftar chat yang belum terbaca; jika masih ada → kirim ke RMQ.
- `lsUnrespMsg` — chat yang belum delivered > 3 status; di-track lewat `messages.update`. Laporan `💡WaGw has UnrespMsg`.
- `pingWa81` — setiap `>7 menit` kosong chat (m81_cntr > 1), ping WA-81 (`/🔔`) untuk cek connection.

## Penyimpanan File di Gateway

| Lokasi | Isi |
|---|---|
| `/Download/wa-<id>.jpg` | Foto / video / audio / dokumen masuk pasien (absolute path, di root file system) |
| `/Download/tm/…` | Media yang diantrekan SIMRS (dibuat oleh sisi Telegram-bridge) |
| `Media/` | File kecil (audio gif `sonata.mp3`, gambar `octopus.webp`, `happybday.jpg`, dll) |
| `session/<key>/` | Auth Baileys (bot creds, keys) |

⚠️ Path `/Download/…` di Windows perlu diperiksa; jika di server Linux → harus ada folder root `/Download` dengan `chown node:node`.

## Backup & Recovery

- Folder `session/` = **sangat penting**. Hilang → harus pairing ulang → nomor WA beda device.
- MongoDB `whatsapp-api` collection `chat` — backup tiap hari.
- RabbitMQ punya resend ation? No ack? Currently non-durable (persinya hard-coded di consumer). Jika downtime lama, pesan SIMRS hilang — perbaiki dengan:
  1. `assertQueue(name, { durable: true })`
  2. `publish` di publisher dengan `persistent: true`.

## Poin yang Perlu Diperbaiki di Kode (prioritas)

1. **Deadlock risk** — `SendWebhook` dan `messages.upsert` banyak `setTimeout` async tanpa guard; saat Baileys disconnect state, beberapa handler bisa tetap mengirim.
2. **Kredensial rentan terlihat** — nilai `ID_rsdPS`, `ID_rsdGw`, `lsMuteResp` hard-coded → pindahkan ke `.env`.
3. **`/Download/` absolute path** — buat configurable `DOWNLOAD_DIR` env.
4. **RabbitMQ: non-durable queue + no-ack consumer** → kehilangan data saat restart.
5. **`mqTmNotif1` membuka koneksi baru per pesan** — bikin satu koneksi di bootstrap dan pass-kan `channel` ke helper.
6. **File " - Copy.js"** — hapus untuk mencegah kebingungan maintenance.
7. **Reconnect penuh setelah `loggedOut`** memanggil `init()` dengan session folder yang baru saja dihapus → QR pairing benar, tapi konfirmasi kebijakan ini: apakah memang ingin begitu dulu atau sebaiknya alarm dulu tanpa auto re-pair?
8. **Logika di `session.js` memakai `mongoClient` global** (`global.mongoClient` di server.js) — rapikan dengan DI agar mudah di-test.
