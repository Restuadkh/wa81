# 📚 Dokumentasi — WA Gateway Hotline SIMRS

Set dokumentasi untuk proyek gateway WhatsApp hotline SIMRS (base: `whatsapp-api-nodejs` v3.0.8 + Baileys MD).

## Daftar Isi

| No | File | Isi |
|---|---|---|
| 01 | [Overview](01-Overview.md) | Ringkasan proyek, peran, kontak internal, aluu besar, risiko |
| 02 | [Arsitektur](02-Arsitektur.md) | Struktur folder, komponen inti, infrastruktur terkait |
| 03 | [Konfigurasi](03-Konfigurasi.md) | Semua env variable, cara jalan / Docker, pairing QR |
| 04 | [Alur Chat](04-Alur-Chat.md) | Detail alur `messages.upsert`, klasifikasi pesan, auto-reply |
| 05 | [REST API](05-API.md) | Referensi endpoint instance/message/group/misc |
| 06 | [RabbitMQ](06-RMQ.md) | 3 queue utama (`tm_queue`, `tmgw.notif`, `wa.notif`), payload & retry |
| 07 | [Keamanan & Monitoring](07-Keamanan-Monitoring.md) | Token, CORS, tracking unread/unresp, hal untuk diperbaiki |
| 08 | [Operasional](08-Operasional.md) | Perintah operator, arti log, troubleshooting common case |

## Ringkihan Sangat Singkat

```
 Pasien (WA) ─► Baileys Gateway ─► RabbitMQ (tmgw.notif) ─► SIMRS
 Pasien (WA) ◄─ Baileys Gateway ◄─ RabbitMQ (wa.notif)  ◄─ SIMRS
       log/diagnostic ──►  RabbitMQ (tm_queue)  ──►  monitoring + WA-81
```

Port default `5033`, instance key `wa-187-gw`, session Baileys di `session/wa-187-gw/`.
