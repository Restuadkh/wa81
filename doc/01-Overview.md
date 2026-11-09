# 01 — Overview Proyek

## Identitas Aplikasi

| Item | Nilai |
|---|---|
| Nama | **WA Gateway Hotline SIMRS** (base: `whatsapp-api-nodejs` v3.0.8, karya salman0ansari, MIT) |
| Peran | Gateway WhatsApp → SIMRS untuk hotline RSUD |
| Port default | `5033` (env `PORT`) |
| Runtime | Node.js + Express |
| Engine WhatsApp | Baileys (`@whiskeysockets/baileys` ^7.0.0-rc13) — **unofficial**, bukan WhatsApp Business API |
| Instance utama | Hard-coded key `wa-187-gw` |

## Fungsi Utama

1. **Menjalankan satu sesi WhatsApp** (bukan multi-instance; key selalu `wa-187-gw`) yang terhubung ke nomor hotline RSUD.
2. **Menerima pesan masuk** dari pasien/client, meneruskannya ke pipeline SIMRS via **RabbitMQ**, lalu mengirim balasan otomatis ("Pesan akan diteruskan ke SIMRS", "🙂🙏🏻", dll).
3. **Mengirim notifikasi dari SIMRS ke pasien** dengan mengonsumsi queue `wa.notif` (pesan dari SIMRS diforward ke nomor tujuan).
4. **Monitoring & alarm**: semua log/kejadian dikirim ke RabbitMQ (`tm_queue`, `tmgw.notif`) dan PT (WA-81 / 0819 0400 0707) menerima notifikasi disconnect/reconnect.
5. Chat tersimpan di **MongoDB** (collection `chat` per instance key).

## Kontak & ID Internal (hard-coded di `src/api/class/instance.js`)

| Konstanta | Nilai | Keterangan |
|---|---|---|
| `key` | `wa-187-gw` | Instance key tetap |
| `ID_rsdPS` | `6281904000707@s.whatsapp.net` | "WA-81", nomor monitoring/operator |
| `ID_rsdPS_lid` | `169874680737794@lid` | Versi LID dari nomor di atas |
| `ID_rsdGw` | `6289510778377@s.whatsapp.net` | Nomor tujuan notifikasi (grup/privat) |
| `ID_yh` / `ID_restu` | `6285172020817@s.whatsapp.net` | Nomor pembina/developer |
| `lsMuteResp` | `['6281904000707','628999800123']` | Nomor yang di-mute (tidak auto-reply) |

## Alur Besar

```
Pasien WA ──► Baileys (messages.upsert)
                │  filter: skip status@broadcast & grup
                │  download media → /Download/wa-<id>.<ext>
                │  log/error ──────► RMQ: tm_queue  (amQsend)
                │  normal chat ────► RMQ: tmgw.notif (tm_notif1 → SIMRS)
                │  auto-reply ◄──── langsung dari gateway
                └─► webhook (opsional)

SIMRS ──► RMQ: wa.notif ──► MsgQueue (consumer) ──► updateMsg() ──► Baileys ──► Pasien
```

## Risiko Umum yang Perlu Diketahui

- Baileys bersifat **unofficial**; nomor berisiko dibanned WhatsApp.
- Auto-reply massal + broadcast ⇒ semakin tinggi risiko/kebutuhan throttling.
- `process.exit()` dipakai sebagai mekanisme restart interior (diharapkan ada supervisor: pm2/Procfile/consul).
- Tidak ada `.env` di repo — konfigurasi lewat environment variables (lihat `03-Konfigurasi.md`).

Disclaimer penggunaan: untuk keperluan internal rumah sakit; pengembang wajib patuh pada kebijakan penggunaan WhatsApp.
