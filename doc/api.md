# REST API

Semua endpoint berada di bawah prefix utama yang di-mount `src/config/express.js`
(default root `/v1` — cek `express.js` untuk prefix). Server listen di `PORT` `.env`
(default `3333`).

Autentikasi:

- `keyCheck` — validasi header/param `key` sama dengan `TOKEN` `.env` (aktif jika `PROTECT_ROUTES=true`).
- `loginCheck` — memastikan instance WhatsApp sudah logged-in.
- Route `/text` huruf kecil adalah endpoint **pengiriman pesan**; `Mediaurl`, `Button`, dsb. lihat controller di `src/api/controllers/`.

## Instance — `src/api/routes/instance.route.js`

| Method | Path | Keterangan |
|---|---|---|
| GET | `/instance/init` | Init instance baru / existing key |
| GET | `/instance/qr` ⚙️ | Ambil QR code (scan untuk login) |
| GET | `/instance/qrbase64` ⚙️ | QR dalam bentuk base64 |
| GET | `/instance/info` ⚙️ | Info instance (status, online, qrRetry) |
| GET | `/instance/restore` | Restore semua session tersimpan |
| DELETE | `/instance/logout` ⚙️🔒 | Logout instance |
| DELETE | `/instance/delete` ⚙️ | Hapus instance |
| GET | `/instance/list` | Daftar instance aktif |

⚙️ = butuh `keyCheck`, 🔒 = butuh juga `loginCheck`.

> Naskah: pada deployment ini hanya dipakai key hardcoded `wa-81-adm`;
> fitur multi-instance praktis tidak dipakai.

## Message — `src/api/routes/message.route.js`

Semua POST kecuali `setstatus` (PUT), semua butuh `keyCheck` + `loginCheck`.
Endpoint upload (`image`, `video`, `audio`, `doc`) menerima `multipart/form-data` field `file`.

| Path | Keterangan |
|---|---|
| `/message/text` | Kirim text `{ number, message }` |
| `/message/image` | Kirim gambar (+caption) |
| `/message/video` | Kirim video |
| `/message/audio` | Kirim audio |
| `/message/doc` | Kirim dokumen |
| `/message/mediaurl` | Kirim media dari URL |
| `/message/button` | Kirim button message |
| `/message/mediabutton` | Kirim media + button |
| `/message/contact` | Kirim kontak/vcard |
| `/message/list` | Kirim list message |
| `/message/setstatus` | Set status profil |
| `/message/read` | Tandai chat dibaca |
| `/message/react` | Kirim reaksi emoji |

## Group — `src/api/routes/group.route.js`

Semua butuh `keyCheck` + `loginCheck`.

Create / list:

| Method | Path |
|---|---|
| POST | `/group/create` |
| GET | `/group/listall` |
| GET | `/group/getallgroups` |

Anggota:

| Method | Path |
|---|---|
| POST | `/group/inviteuser` (add) |
| POST | `/group/makeadmin` |
| POST | `/group/demoteadmin` |
| POST | `/group/participantsupdate` |
| GET | `/group/leave` |

Setting & invite:

| Method | Path |
|---|---|
| GET | `/group/getinvitecode` |
| GET | `/group/getinstanceinvitecode` |
| POST | `/group/settingsupdate` (announcements/locked) |
| POST | `/group/updatesubject` |
| POST | `/group/updatedescription` |
| POST | `/group/inviteinfo` |
| POST | `/group/groupjoin` |

## Misc — `src/api/routes/misc.route.js`

Semua butuh `keyCheck` + `loginCheck`.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/misc/onwhatsapp` | Cek nomor terdaftar WA |
| GET | `/misc/downProfile` | Download foto profil |
| GET | `/misc/getStatus` | Ambil status user |
| GET | `/misc/blockUser` | Blok/unblok user |
| POST | `/misc/updateProfilePicture` | Ganti foto profil |
| GET | `/misc/getuserorgroupbyid` | Info user/group by id |

## Lain-lain

- `GET /status` → health check (`OK`).
- Koleksi Postman lengkap: `whatsapp-api-nodejs.postman_collection.json` di root.
