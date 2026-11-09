# 08 — Operasional & Troubleshooting

## Ringkasan Kontras

| Bila ingin melakukan... | Cara |
|---|---|
| Restart service | Chat `/svc.rst` dari WA-81 (`6281904000707`) ATAU kirim queue `wa.notif` dengan `mx='.reStartService'` |
| Lihat status koneksi | Chat WA-81 dengan isi chat bebas — respon otomatis di log RMQ; atau `GET /instance/info` |
| Pairing ulang | `GET /instance/qrbase64?key=wa-187-gw` → scan |
| Logout | `DELETE /instance/logout?key=wa-187-gw` |
| Picu restart bersih | `process.exit(1)` hanya bisa dari WA-81 / restart launcher |

## Mapping Notifikasi RMQ

| Prefix emoji | Arti |
|---|---|
| `🟢WaGw connection up` | Sesi WA kembali online |
| `⚡️⛑WaGw disconnected #n` | Disconnect (alarm saat ke-2) |
| `🔴WaGw loggedOut` | Sesi keluar; perlu pairing baru |
| `🔘WaGw requesting QRcode!` | Menunggu scan QR |
| `💡WaGw UnrespMsg` | Pesan belum delivered per `messages.update` status |
| `⚡️WaGw unreadC #n` | Chat belum dibaca oleh WA (biasanya saat reconnect) |
| `⛑ WAGw Fail on sendMsg` | Gagal kirim SMS WA (biasanya pasien non-WA) |
| `🤔WaGw::` | Error internal (caption, media, dll) |
| `WAGw: <no>☑️` | Pesan WA tak digalakan ke nomor tsb terkirim |
| `WAGw: <no>❌` | Nomor tidak terdaftar (tidak WA) |

## Skenario masalah umum

### 1. Notifikasi tidak terkirim ke pasien, tapi RMQ `wa.notif` terisi
- Periksa log `[Message send]ch.187::…` di gateway: apakah muncul `task::…`.
- Cek apakah `phn` dikirim dalam format `62xxx` atau jid lengkap.
- Lihat `WAGw: <no>❌` → nomor tidak WA; tidak perlu kirim ulang.
- Lihat `428` → Baileys koneksi putus; tunggu reconnect ≤ 33 detik.

### 2. QR tidak muncul
- Pastikan `GET /instance/qrbase64` — bukan `/instance/qr` — origin CORS.
- Jika QR 2x gagal (default `INSTANCE_MAX_RETRY_QR`), socket terminasi: needs `GET /instance/init` ulang.

### 3. Pesan pasien masuk tapi tidak diteruskan ke SIMRS
- Cek jumlah `#` di pesan: butuh >= 3 tag hash atau format `#…`.
- Cek `lsMuteResp` di `instance.js` — pasien dapat di-mute (muncul prefix `🧐WaGw::`).
- Cek RMQ URL & apakah queue `tmgw.notif` hidup.

### 4. Restart terus-menerus (loop restart)
- Periksa log `restart required` / `stream errored / 440 / cnt>19` — semua memanggil `process.exit`.
- Pastikan process manager membuat restart; jika hanya dijalankan via `npm start`, butuh pm2 / task scheduler untuk coundown.
- Hapus folder `session/` bila sisi session korup, lalu pairing ulang.

### 5. Media pasien tidak tersimpan
- `/Download/…` di root filesystem; buat foldernya atau ubah konstanta `cFile = '/Download/…'` di `instance.js` (3 lokasi: sticker/image/video/audio/document).
- Media WhatsApp besar kadang `FAIL downloadMessage`; cek RMQ pesan `🤔` + JSON msg.

### 6. Gagal mengirim balasan `🙂🙏🏻` setelah chat pertama
- Biasanya nomor tidak ter-hitung di `verifyId(onWhatsApp)`.
- Jika pasien LID-mask (sudah sering di iOS terbaru), `remoteJidAlt` seharusnya di-cacah; pastikan parser sudah menangani.

## Saran peningkatan Opsional (Medium-Term)

1. Pindahkan konfigurasi `key`, `ID_rsdPS`, dsb. ke `.env` — lebih fleksibel.
2. Implementasi yang lebih bersih: pisahkan logika monitoring dari `instance.js` ke modul terpisah (bisa testing).
3. Lazimnya mode `p1_busy`, `m81_cntr` lebih baik diover ke library `p-queue` untuk kendali kecepatan.
4. Tulis unit test di `src/api/class/instance.js` untuk flow `messages.upsert` (bisa moc Baileys via `fake-socket`).
