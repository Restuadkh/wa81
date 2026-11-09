# Temuan Masalah & Rekomendasi

Hasil audit awal (2026-11). Urutan berdasarkan prioritas.

## Kritis

### 1. Kredensial sesi WhatsApp ter-commit di repo
Folder `session/wa-81-adm/` berisi `creds.json`, device-list dll — penyerang yang
mengakses repo dapat membajak nomor layanan.
**Rekomendasi**:
- Tambahkan `session/` ke `.gitignore`, `git rm -r --cached session/`.
- Rotasi: logout sesi lama + scan QR baru.
- Pertimbangkan pindah auth state ke Mongo (`mongoAuthState.js` sudah tersedia).

### 2. Kredensial & konfigurasi hardcoded
- RabbitMQ `amqp://simps...` (user/password di source) — `mqWa81.js`, `workerMq.js`.
- IP gRPC (5005/5007), nomor-nomor admin, ID kanal (`ch.187`), queue names,
  instance key — semua di source.
**Rekomendasi**: pindahkan ke `.env`/`config.js`, rotasi password RMQ.

## Konsistensi & Keandalan

### 3. Tidak ada auto-reconnect RabbitMQ
`MsgQueue`: pada error koneksi hanya `throw` di callback (tidak berlaku) dan
`setTimeout` kosong — consumer mati permanen sampai restart proses.
**Rekomendasi**: implementasi reconnect + re-create channel; hindari `noAck: true`
(atau setidaknya ack setelah `updateMsg()` sukses agar pesan tak hilang saat crash).

### 4. "Sleep" tapi tidak benar-benar menunggu
Beberapa tempat: `new Promise(resolve => setTimeout(resolve, ms))` **tanpa `await`**
di `mqWa81.js:30`, `setTimeout(function(){}, 87_000)` tidak menunggu, `setTimeout`
dengan callback kosong. Retry terlihat cepat/spam, dan delay pelindung tidak efektif.
**Rekomendasi**: gunakan helper `sleep()` (`src/api/helper/sleep.js`) dengan `await`.

### 5. Race-condition pada anti-double-request
Flag boolean `busy` + polling `while` di `AdmisiSvc/P2gRpc` tidak atomic; dua request
berbarengan masih bisa lolos. Ganti dengan antrean (Promise-chain / async-mutex)
atau idempotency-key di sisi SIMRS.

## Maintainability

### 6. `instance.js` terlalu besar
±3.700+ baris, puluhan array state global, banyak dead code (`instance.js.bak`,
blok komentar besar di `session.js`).
**Rekomendasi**: pisah modul — `session/connection.js`, `message-router.js`,
`reply-formatter.js`, `contact-policy.js` (whitelist/blacklist), `grpc-client.js`;
tambah unit test untuk parser pesan dan formatter.

### 7. Duplikasi AdmisiSvc vs P2gRpc
Dua class gRPC hampir identik (nilai timeout, pesan, perilaku mirip).
**Rekomendasi**: satu parameterized class (`host:port`, timeouts) + config.

### 8. Depensi tak terpakai / usang
- `mongoose` dikoneksikan tapi server memakai raw `mongodb` (mongoose code di-comment).
- `@adiwajshing/keyed-db`, `express-exception-handler`, `sharp` perlu dicek pemakaian.
- Baileys `7.0.0-rc13` — pantau release non-RC.
- Node deps multer 1.4.5-lts.1 (ada cabang LTS-2.x dengan fix keamanan).

## Keamanan Lainnya

### 9. gRPC tanpa TLS, pesan error diteruskan mentah ke pasien
Gagal gRPC mengembalikan `{err: ... + stack}` yang berpotensi terkirim ke chat pasien.
**Rekomendasi**: mapping error internal → pesan ramah pasien; log penuh hanya di server.

### 10. proteksi endpoint
`keyCheck` bergantung `PROTECT_ROUTES=true` + TOKEN; pastikan TOKEN kuat dan
service tidak diekspos ke jaringan publik (portal pasien hanya perlu jalur WA).

## Quick Wins

1. `.gitignore` + hapus `session/` & `.env` dari tracking; rotasi kredensial RMQ.
2. Baca hardcoded config dari env.
3. Perbaiki pola `await sleep()` untuk semua retry.
4. Tambah auto-reconnect RMQ dan ack setelah sukses.
5. Hapus `instance.js.bak`, dead code, dan selaraskan `.env copy`.
