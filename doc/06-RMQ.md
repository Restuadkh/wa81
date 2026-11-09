# 06 — Integrasi RabbitMQ (SIMRS ↔ Gateway)

## Daftar Queue

| Queue | Arah | Penerbit | Konsumen |
|---|---|---|---|
| `tm_queue` | Gateway → monitoring | `amQsend()` | Monitoring/TM |
| `tmgw.notif` | Gateway → SIMRS | `tm_notif1()` | SIMRS/Telegram-bridge |
| `wa.notif` | SIMRS → Gateway | SimRS | `MsgQueue` (di dalam gateway) |

## Format

### tm_queue (log/monitoring)
```json
{ "msg": "teks log", "to": "ch.187", "phn": "" }
```

### tmgw.notif (chat pasien yang diteruskan)
```json
{ "msg": "isi pesan", "to": "ch.wa-gw" | "group", "phn": "<jid pasien>", "pict": "/Download/wa-xxx.jpg" }
```

### wa.notif (perintah kirim dari SIMRS)
```json
{
  "key": "#187",
  "phn": "62xxxxxxxxxx@s.whatsapp.net",
  "mx":  "isi pesan",
  "img": "happybday.jpg" | "/Download/tm/xxx.jpg" | ""
  "note": "msg tambahan (ops)"
}
```
Aturan validasi:
- `key` harus persis `#187`.
- `phn`: nomor valid (`62…`, `8…`, `0…` hasil normalisasi) **dan tidak di bawah `628…`** (`phnId > '628'` — artinya pengecualian nomor jalur khusus).
- `img > 'A'` → path relatif ke `Media/`; `img.indexOf('/Download/tm/') === 0` → path absolute ke folder Telegram download.
- `mx = '.reStartService'` → memicu restart service (saat ini log saja).
- Jika `happybday.jpg` → pasien ditandai di list hari-birthday (tidak diforward ke grup).

## Retry / Melimpahkan Gagal Kirim

Sisi consumer (`MsgQueue`):
- maksimal 3 percobaan per pesan (np = 1 → 2 lass, per semuanya `#4-np`).
- jeda antar percobaan: 87 detik (harus cukup longgar untuk Baileys reconnect).

Sisi `updateMsg`:
- retry internal 3 kali per pesan media (`i < 3`, sleep 1800 ms).
- `statusCode 428` → `this.init()` + tunggu 7 detik.
- Tiga failed (`e1/e2/e4`) dicatat via `amQsend()`.

## Kebutuhan Konsumer Sisi SIMRS

Saat mengirim ke `wa.notif`, disarankan `noAck: true` dihindari di sisi publisher (publisher yang hanya `sendToQueue`). Pastikan:
- queue dibuat `durable` di produksi bila butuh menahan pesan saat gateway restart; implementasi sekarang `assertQueue` tanpa option → default non-durable. Bisa di-upgrade.
- Tambahan `persistent: true` di pesan + `durable` queue bila dibutuhkan.

## Catatan Penting

- `amQsend` / `tm_notif1` **membuat koneksi RMQ baru per pesan** (dan menutupnya setelah 255 ms). Berat pada throughput tinggi — pertimbangkan pooled/single connection class `MsgQueue` yang di-reuse.
- Koneksi `MsgQueue` menolak reconnect otomatis setelah `connection.close()` dengan delay 87 detik; pastikan RMQ reachable atau pesan hilang.
