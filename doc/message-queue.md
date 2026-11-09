# Message Queue (RabbitMQ)

Server: `192.168.201.19:5672`, user `simrs` (kredensial **hardcoded** di
`src/api/class/mqWa81.js` — lihat [masalah-rekomendasi.md](masalah-rekomendasi.md)).

## Ringkasan Queue

| Queue | Arah | Modul | Fungsi |
|---|---|---|---|
| `wa_adm.notif` | konsumsi | `mqWa81.js` | Pesan notifikasi ke WA pasien (#81) |
| `tm_queue` | publish | `workerMq.js` via `amQsend()` | Notifikasi ops ke grup/kanal admin (`ch.187`) |
| `wa.notif` | publish | `workerMq.js` via `gw_notif2()` | Notifikasi WA ke nomor admin (`key:'#187'`) |

## Consumer `wa_adm.notif`

- Dibangun di constructor `MsgQueue` (dipanggil dari `Session.restoreSessions()`
  setelah delay ±88 detik agar koneksi WA siap dahulu).
- Menunggu instance `online` (poll maksimal 310 x 555ms — catatan: implementasi
  `await` sleep-nya tidak efektif, lihat masalah).
- Consume dengan `noAck: true` → pesan hilang bila consumer crash saat memproses.
- Payload: `{key:'#81', phn, mx, img?, note?}` — detail lihat [alur-pendaftaran.md](alur-pendaftaran.md).

## Producer `amQsend.js`

```js
amQsend(msg, tch = 'ch.187')   // → worker thread → queue tm_queue, dt = {to, msg, phn:''}
gw_notif2(msg)                 // → worker thread → queue wa.notif, dt = {phn, mx, key:'#187'}
```

- Menggunakan `worker_threads` (`src/api/helper/workerMq.js`) agar koneksi AMQP
  tidak memblokir event loop utama.
- Kegunaan: alert admin ketika service restart, restore sesi, connecting/offline,
  QR diminta, unexpected error (`server.js`, `instance.js`).

## Event yang Mengirim Notifikasi Ops

| Event | Pesan |
|---|---|
| Startup / restore | `⚠️WA.81 Restarting...🤔⚠️ Session Restored: N` |
| Instance online | `🟢WA-Pendaftaran is now Online` (ke grup) |
| Requesting QR | `⚡️ WA-Pendaftaran requesting QRCode!` |
| Logged out | `🔴WA-Pendaftaran loggedOut ...` |
| Connecting loop | `⚡️⚠️Wa81.connecting... #N {payload disconnect}` |
| Unexpected error | `⚠️🥵WA.81 unexpectedErrorHandler {error}` |
| Shutdown | `⚠️🥵WA.81 Server closed !!!` |
