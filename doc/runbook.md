# Runbook Operasional

## Start / Stop

```bash
npm run dev      # development (nodemon)
npm start        # production (node src/server.js)
```

Procfile tersedia untuk deploy Heroku-like (`web: node src/server.js`).

## Checklist Boot Sukses

Output menunjukkan:

1. `Listening on port <PORT>`
2. `Restoring Sessions...` → `1 Session(s) Restored` (jika `RESTORE_SESSIONS_ON_START_UP=true`)
3. `[+] Wait MsgQueue on queue wa_adm.notif` (muncul ±88 detik setelah boot)
4. Notifikasi grup admin: `⚠️WA.81 Restarting...` lalu `🟢WA-Pendaftaran is now Online`

## Login Ulang Nomor WhatsApp (Scan QR)

Saat sesi terputus/perlu re-login:

1. Log akan menampilkan `⚡️ WA-Pendaftaran requesting QRCode!`
2. Scan QR:
   - via endpoint `GET /instance/qrbase64?key=...` (render QR), atau
   - file session lama rusak → delete isi `session/wa-81-adm/` lalu scan ulang.
3. Setelah `🟢 Online`, notifikasi otomatis terkirim.

Catatan: max retry QR = `INSTANCE_MAX_RETRY_QR` (default 2) sebelum berhenti.

## Restart Jarak Jauh

Kirim pesan `.reStartService` ke queue `wa_adm.notif`:
service akan `process.exit(1)` (hanya jika uptime > 2 menit) — biarkan systemd/PM2
menaikan kembali. Kredensial session tetap tersimpan.

## Kegagalan Umum & Penanganan

| Gejala | Penyebab | Aksi |
|---|---|---|
| `RMQ CONNECTION ERROR` di log | RabbitMQ down / kredensial salah | cek `192.168.201.19:5672` & user `simrs`; restart setelah server pulih (tidak ada auto-reconnect!) |
| Balasan `*double request*⚠️` | token request sama masih diproses | tunggu sejenak; restart service otomatis membersihkan `lsCancel` |
| gRPC `Error 14` | SIMRS service down | cek service di `192.168.201.19:5005/5007`; app auto re-init stub + retry 2x |
| Nomor tidak dapat balasan | nomor di blacklist/brute list atau bukan awalan `62/63` atau dkk | cek `lsBruteClient`, normalisasi ke `62...` |
| Kirim pesan tidak masuk | instance offline / session expired | lihat notifikasi admin, scan QR ulang |

## Health Check

```
GET http://localhost:<PORT>/status   → "OK"
```

## Backup Penting

- `session/wa-81-adm/` — **kredensial akun WhatsApp**. Jangan hilang; jika hilang,
  harus scan QR ulang dari nomor tersebut.
- Database Mongo (auth state alternatif + chat model, `wa81-a`, `Wa81instance`).
