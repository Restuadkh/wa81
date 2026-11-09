# Alur Layanan Pendaftaran Pasien

## 1. Pendaftaran Interaktif (pasien chat langsung)

```
Pasien                     wa81 (instance.js)                SIMRS (gRPC Adm)
  │                                │                                │
  │ "Daftar" (WA)                  │                                │
  ├───────────────────────────────►│                                │
  │                                │ validasi: jam layanan (≥06:00  │
  │                                │ WIB), blacklist/brute guard,   │
  │                                │ normalisasi nomor              │
  │                                │                                │
  │                                │ BookingQueue(AdmRequest{       │
  │                                │   msg, sender, tm})            │
  │                                ├───────────────────────────────►│
  │                                │        AdmReply{res, rem}      │
  │                                │◄───────────────────────────────┤
  │ balasan: info poliklinik/      │                                │
  │ jadwal / "Pendaftaran berhasil"│                                │
  │◄───────────────────────────────┤                                │
```

- Perintah dikenali via regex `^daftar` (`instance.js` sekitar baris 1536).
- Pendaftaran **belum dibuka sebelum jam 06:00 WIB** — bot membalas
  *"Pendaftaran belum dibuka, silakan coba lagi mulai jam 06:00 WIB"*.
- Balasan backend difilter dengan serangkaian regex (`^✅`, `^Pendaftaran berhasil`,
  `^Belum ada reservasi RM`, poliklinik libur/tutup, dll) untuk formatting kartu reservasi.
- Bisa dibatalkan: mekanisme `batal`/`daftar` token (`lsCancel`) di service gRPC.

## 2. Anti Double-Request

Di `AdmisiSvc.reservation()` / `P2gRpc.reservation()`:

1. Setiap request diberi `token` (disimpan di `lsCancel`).
2. Jika token sama masuk lagi selama proses `busy`, request kedua ditolak
   ("double request, silakan coba beberapa saat lagi").
3. `list2Cancel(token)` dipanggil dari luar untuk membatalkan; token dihapus otomatis
   (juga di-reset tiap periode > 39.000 ms / harian).
4. gRPC error code `14` (unavailable) → re-init stub + retry (`__do_rsv`, max 2x).

## 3. Notifikasi dari Sistem Lain (via RabbitMQ)

```
SIMRS/layanan lain ──► queue wa_adm.notif ──► mqWa81.send_msg() ──► updateMsg() ──► WA pasien
```

Format payload:

```json
{
  "key": "#81",
  "phn": "628xxxxxxxxxx",
  "mx": "isi pesan (boleh multi-baris, markdown WA)",
  "img": "opsional: path /Download/tm/... atau url",
  "note": "opsional: caption/note"
}
```

Aturan:

- `key` wajib `"#81"`, `phn` dan `mx` wajib string — selain itu diabaikan (kecuali
  `_phn_priority_` → update daftar `lsGoodclient`, atau `.reStartService`).
- Nomor dinormalisasi via `validPhnNumber()`; hanya nomor berawalan `6`/`9`
  (format `62...`) yang dikirim.
- Gagal kirim di-retry hingga 2x dengan jeda.

## 4. Perintah Operasional Khusus

| Pesan | Efek |
|---|---|
| `.reStartService` | Jika uptime layanan > 2 menit sejak cek terakhir → `process.exit(1)` (service manager/PM2 akan restart). Kredensial sesi tetap aman. |
| `_phn_priority_` payload | Update daftar `lsGoodclient` dari sistem lain. |

## 5. Multicast Notifikasi Ops (internal)

- `amQsend(msg)` → worker thread → publish ke queue `tm_queue`, channel `ch.187`
  (digunakan untuk alert grup WA admin: online/offline/restart/error/QR).
- `gw_notif2(msg)` → queue `wa.notif`, `key:'#187'` ke nomor tertentu
  (`6281904000707@s.whatsapp.net`).
