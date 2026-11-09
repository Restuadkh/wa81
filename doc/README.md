# wa81 — WhatsApp Gateway Pendaftaran Pasien

Dokumentasi untuk project **wa81**, gateway WhatsApp untuk layanan pendaftaran pasien
RSUD Panembahan Senopati. Dibangun di atas fork project open-source
[`whatsapp-api-nodejs`](https://github.com/salman0ansari/whatsapp-api-nodejs) (Baileys-MD)
yang dimodifikasi berat untuk kebutuhan SIMRS rumah sakit.

## Daftar Dokumen

| Dokumen | Isi |
|---|---|
| [arsitektur.md](arsitektur.md) | Gambaran arsitektur, komponen, dan struktur folder |
| [alur-pendaftaran.md](alur-pendaftaran.md) | Alur end-to-end layanan pendaftaran via WhatsApp |
| [api.md](api.md) | REST API (instance, message, group, misc) |
| [integrasi-grpc.md](integrasi-grpc.md) | Integrasi gRPC ke backend SIMRS (AdmisiSvc / P2gRpc) |
| [message-queue.md](message-queue.md) | Integrasi RabbitMQ (consumer & producer notifikasi) |
| [konfigurasi.md](konfigurasi.md) | Daftar variabel `.env` dan konfigurasi runtime |
| [runbook.md](runbook.md) | Panduan operasional: start, restore sesi, restart remote, troubleshooting |
| [masalah-rekomendasi.md](masalah-rekomendasi.md) | Temuan masalah & rekomendasi perbaikan |

## Ringkasan Singkat

- **Fungsi utama**: pasien mengirim perintah `Daftar` lewat WhatsApp, bot meneruskan
  request ke backend SIMRS via **gRPC** (`Adm.BookingQueue`), lalu membalas hasil
  reservasi (jadwal poliklinik, nomor antrean, dsb).
- **Sesi WhatsApp**: satu instance hardcoded `wa-81-adm`, kredensial disimpan di
  folder `session/wa-81-adm/` (multi-file auth state Baileys), di-restore saat startup.
- **Integrasi masuk**: pesan notifikasi dari sistem lain dikirim via **RabbitMQ**
  queue `wa_adm.notif` (format `{key:'#81', phn, mx, img, note}`), di-consume dan
  dikirim sebagai pesan WhatsApp.
- **Notifikasi ops**: kejadian penting (restart, error, online/offline, QR) dikirim
  ke grup/channel admin via queue `tm_queue` (`amQsend`) dan `wa.notif` (`gw_notif2`).
- **Server backend SIMRS**: `192.168.201.19` (gRPC port `5005` dan `5007`,
  RabbitMQ port `5672`).

## Cara Menjalankan

```bash
# development (nodemon)
npm run dev

# production
npm start            # node src/server.js, port sesuai PORT di .env (default 3333)

# test
npm test             # mocha, saat ini hanya tests/status.route.test.js
```

Pastikan `.env` sudah terisi (lihat [konfigurasi.md](konfigurasi.md)) dan MongoDB
sudah berjalan sebelum start.
