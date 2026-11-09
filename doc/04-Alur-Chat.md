# 04 — Alur Chat Pasien (messages.upsert)

Sumber: `src/api/class/instance.js`, handler `sock.ev.on('messages.upsert')`.

## Langkah-langkah

1. **Filter awal**
   - skip `type !== 'notify' && type !== 'append'` kirim ke webhook `excl-messages`.
   - skip `status@broadcast`, grup `@g.us`, `key.fromMe`, tanpa `msg.message`.
   - identitas pasien = prioritas `remoteJid > remoteJidAlt > participant > participantAlt` yang ber-`@s.whatsapp.net` (Mendukung LID → nomor asli).
   - skip tipe internal (`protocolMessage`, `senderKeyDistributionMessage`).
2. **Ekstraksi isi**
   - `conversation` → `messageText`
   - `extendedTextMessage` → `text`
   - `highlyStructuredMessage` → template
   - `imageMessage / videoMessage / audioMessage / documentMessage / stickerMessage` → `downloadMessage()` → simpan di:
     - gambar  → `/Download/wa-<id>.jpeg`
     - video   → `/Download/wa-<id>.mp4`
     - audio   → `/Download/wa-<id>.mp3`
     - document→ `/Download/wa-<id>-<nama>.x`
     - sticker → `/Download/wa-<id>.webp`
   - nama file download selalu dimulai dari root `/Download/…` — bukan relative. Ini berpotensi masalah permission di produksi (khususnya Docker/Linux).
3. **Event special**
   - `reactionMessage` → dibalas emoji 🙏🏻 via `reactMessage`.
   - `editedMessage` → coba ambil caption image/video/conversation baru.
4. **Klasifikasi tujuan**
   - Jika sender = `ID_rsdPS` / `ID_rsdPS_lid` / `ID_yh` / `ID_restu` → dianggap sebagai chat internal:
     - log ke RMQ (`Rx from Wa81`)
     - command `/svc.rst` (8 karakter pertama) → **restart service** (`process.exit(1)`).
   - Jika sender bukan operator → dianggap pasien:
     - nomor di `lsMuteResp` → hanya dicatat ke RMQ.
     - jumlah `#` di pesan < 3 → reply ringan ke pasien, tidak diteruskan.
     - `tag >= 3` + kata "daftar" → balas info agar daftar online ke WA-81.
     - `tag >= 3` dan bukan kasus lain → kirim ke `tmgw.notif` (RabbitMQ) untuk diteruskan ke SIMRS.
     - selain itu (≥ tanpa flag khusus) → masuk RMQ log biasa.
5. **Auto-reply (parallel)**
   - Jika ada `#` dan panjang `< 33` atau tag > 2 → balas "Pesan akan diteruskan ke SIMRS" / info daftar / "Maaf pesan tidak terbaca, mohon diulang".
   - Selain itu → sticker/talk kecil "🙂🙏🏻" (kemudian dihapus 60 detik jika tujuan = ID_yh).
6. **Mark as read** → `readMessage()` selalu dijalankan (`config.markMessagesRead` tidak lagi dijalankan; hard-coded read).
7. **Webhook** → jika diizinkan (`WEBHOOK_ALLOWED_EVENTS`), POST `{type:'message', body: webhookData, instanceKey}` ke `WEBHOOK_URL` base yang dibuat saat init. Terdapat delay 88 ms dari `SendWebhook`.

## Format Pesan yang Dikirim ke SIMRS (queue `tmgw.notif`)

```json
{
  "msg": "isi pesan pasien",
  "to": "ch.wa-gw | group",
  "phn": "628xxxxxxxxxx@s.whatsapp.net",
  "pict": "/Download/wa-xxx.jpeg"
}
```

Logika `tm_notif1` juga bisa menentukan `to: 'group'` (forward ke grup internal SIMRS) jika:
- bukan happybday-list, bukan `#Feedback-Presensi`, atau
- mengandung "lapor" (posisi <5), / "sim" (<7), atau
- ada `#` di posisi < 5.

Perhatian: variabel `lsSimrsGroup` & `lshappybday` hanya in-memory (hilang saat restart), tidak disekronisasi.

## Perintah Operator

| Pesan | Efek |
|---|---|
| `/svc.rst` (dari WA-81) | `process.exit(1)` — service restart |
| `"cek"` (dari WA-81 saat connection undefined) | ping ulang WA-81 |
| Anything dari WA-81 | masuk log RMQ, bisa jadi reset perhitungan pending |
