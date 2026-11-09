# 05 — REST API Reference

Base URL: `http://<host>:<PORT>/`
Semua parameter instance dikirim via **query `key`**. Jika `PROTECT_ROUTES=true`, tambahkan header `token: <TOKEN>` di semua request.

## Status

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| GET | `/status` | – | Cek service hidup → `OK` |

## Instance (`/instance`)

| Method | Endpoint | Middleware | Fungsi |
|---|---|---|---|
| GET | `/instance/init?key=<KEY>` | – | Membuat instance baru (di deployment ini selalu kembali ke `wa-187-gw`) |
| GET | `/instance/qr?key=<KEY>` | key | Tampilkan QR pairing (halaman EJS) |
| GET | `/instance/qrbase64?key=<KEY>` | key | QR dalam base64 |
| GET | `/instance/info?key=<KEY>` | key | Detail instance (phone_connected, user dll) |
| GET | `/instance/restore` | – | Restore sesi satu kali |
| DELETE | `/instance/logout?key=<KEY>` | key, login | Keluar sesi |
| DELETE | `/instance/delete?key=<KEY>` | key | Hapus instance + dokumen Mongo |
| GET | `/instance/list` | – | Daftar instance aktif |
| POST | `/instance/reconect?key=<KEY>` | – | Reconnect



## Message (`/message`)

| Method | Endpoint | Body | Fungsi |
|---|---|---|---|
| POST | `/message/text` | `id`, `text` | Kirim teks |
| POST | `/message/image` | `id`, `caption`, upload `file` | Kirim gambar |
| POST | `/message/video` | `id`, `caption`, upload `file` | Kirim video |
| POST | `/message/audio` | `id`, upload `file` (`ptt=true`) | Kirim audio (voice) |
| POST | `/message/doc` | `id`, `caption`, `filename`, upload `file` | Kirim dokumen |
| POST | `/message/mediaurl` | `id`, `type`, `url`, `mimetype`, `caption` | Kirim media dari URL |
| POST | `/message/button` | `id`, `text`, `footerText`, `buttons` | Tombol |
| POST | `/message/contact` | `id`, `fullName`, `organization`, dll | Kartu kontak |
| POST | `/message/list` | `id`, `title`, `buttonText`, `sections` | List |
| PUT | `/message/setstatus` | `id`, `status` | Set presence |
| POST | `/message/mediabutton` | `id`, `mediaType`, `image`, dll | Tombol dengan media |
| POST | `/message/read` | `id` | Tandai read |
| POST | `/message/react` | `id`, `key`, `emoji` | Reaction |

## Group (`/group`)

`create`, `listall`, `leave`, `inviteuser`, `makeadmin`, `demoteadmin`, `getinvitecode`, `getinstanceinvitecode`, `getallgroups`, `participantsupdate`, `settingsupdate`, `updatesubject`, `updatedescription`, `inviteinfo`, `groupjoin`.

Endpoint grup sebagian besar tidak dipakai untuk hotline (thought lain: RSUD jauh lebih memerlukan broadcast pasien), tapi tetap tersedia di API original.

## Misc (`/misc`)

| Endpoint | Fungsi |
|---|---|
| GET `/misc/onwhatsapp?id=` | Cek apakah nomor terdaftar di WhatsApp |
| GET `/misc/downProfile?id=` | Get profile picture URL |
| GET `/misc/getStatus?id=` | Bio/status orang |
| GET `/misc/blockUser?id=&action=` | Block / unblock |
| POST `/misc/updateProfilePicture` | Ubah profile gateway |
| GET `/misc/getuserorgroupbyid?id=` | Info user / grup dari DB |

## Error Response Standar

- `403` `{"error": true, "message": "no key query was present"}` / `"invalid key supplied"`
- `401` `{"error": true, "message": "phone isn't connected"}` – sesi belum pairing.
