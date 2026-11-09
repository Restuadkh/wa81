# Integrasi gRPC (SIMRS Admisi)

Nama proto: `src/api/protos/admition.proto`.

```proto
message AdmRequest {
    string msg = 1;     // isi request/komando dari pasien
    string sender = 2;  // nomor pengirim
    string tm = 3;      // timestamp
}

message AdmReply {
    string res = 1;     // balasan utama (akan diformat lalu dikirim ke pasien)
    string rem = 2;     // remark
}

service Adm {
    rpc BookingQueue(AdmRequest) returns (AdmReply) {}
    rpc BookingChk(AdmRequest) returns (AdmReply) {}
}
```

Target server:

| Class | Alamat | Pola |
|---|---|---|
| `AdmisiSvc` | `192.168.201.19:5005` | Singleton (`getInstance`), lock `busy` global |
| `P2gRpc` | `192.168.201.19:5007` | Instance per-request (`getInstance(port)`) |

Koneksi `credentials.createInsecure()` (tanpa TLS — jaringan internal).

## Perilaku `reservation(req, token)`

1. **Cancel-token**: jika `token` sudah ada di `lsCancel` → request dianggap duplikat
   → balas "double request, silakan coba beberapa saat lagi" (atau `🙏🏻` untuk token pendek).
2. **Busy-wait**: selama `busy == true`, loop tunggu (interval 1s) dengan timeout besar
   (`AdmisiSvc` ≈188k iterasi, `P2gRpc` ≈9.898 iterasi). Resume jika `busy == false`
   atau token dicancel.
3. **Reset harian**: token yang lebih tua dari satu hari otomatis dibersihkan
   (perhitungan `(ts - 1_684_861_200_000) % 86_400_000 > 39_000`).
4. **Eksekusi**: set `busy = true` → `admStub.BookingQueue(req, cb)` → kembalikan `AdmReply`.
5. **Error**: jika gRPC code `14` (UNAVAILABLE) → rebuild stub (`__startStub`) lalu retry
   (maks 2 percobaan, jeda 321–757 ms). Selain itu kembalikan pesan error lengkap
   beserta timestamp & stack — yang akan diteruskan ke pasien bila tidak difilter.

## Catatan

- Fungsi `BookingChk` didefinisikan di proto tapi belum dipakai di kedua class
  (potensi untuk cek status antrean/alert).
- `AdmisiSvc` mengembalikan error-nya sebagai pesan `{ err: ... }` — pastikan
  handler pemanggil membedakan `res` vs `err`.
