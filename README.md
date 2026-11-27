# KAN Timesheet & Leave Simulator (v2.0 — Fase 1 Modular)

Aplikasi simulasi jadwal roster 5:2, **P.O.H (Point of Hire)**, **Kunci Periode (History Lock)**, **Carry-Over TC**, **Override Manual (`S`/`I`/`DL`/`A`/`OFF*`)**, **Hari Libur Nasional Indonesia (2025–2027)**, **Share Link & Scenario Manager**, serta Export Excel `.xlsx` & Print PDF A4 Landscape.

## Yang Baru di v2.0

1. **Profil P.O.H & Kategori Jabatan:** Pilih `Ring 1 (Lokal Site)`, `Ring 2 (Provinsi Darat/Laut)`, atau `Ring 3 (Non-Lokal Pesawat)` + Kota/Bandara P.O.H. Hak & kuota tiket otomatis mengikuti aturan di `config.js` (`pohRules`).
2. **Kunci Periode (`🔒 Kunci Periode`):** Kunci Periode 1 (misal 9 hari) sebagai realisasi/history. Saat karyawan kembali kerja dan mengubah target cuti global (misal jadi 11 hari) untuk Periode 2 ke depan, Periode 1 yang terkunci tetap utuh tidak bergeser.
3. **Durasi Fleksibel per Periode & Carry-Over TC:** Atur saldo awal TC, ubah durasi tiap periode secara independen, dan tabung sisa TC ke periode berikutnya.
4. **Kalender Hari Libur Nasional Indonesia (2025–2027):** Penanda sudut merah (Libur Nasional) & amber (Cuti Bersama) di matriks, notifikasi irisan hari raya di tabel periode, dan rekap jumlah tanggal merah kerja di KPI.
5. **Custom Override Sel Manual (`S`, `I`, `DL`, `A`, `OFF*`):** Klik tanggal mana saja untuk menandai Sakit/Izin/Dinas Luar/Alpha beserta catatan. Status non-kerja otomatis menggugurkan syarat 5 hari kerja minggu berjalan sehingga penerbitan TC & jadwal pulang bergeser secara realistis.
6. **Bagikan Link (`#s=...`) & Kelola Skenario (`.json`):** Salin link simulasi langsung ke WhatsApp/HR atau simpan & ekspor banyak skenario ke file JSON.
7. **Layout Print PDF 4 Tanda Tangan Sejajar & Default Langsung X1:** Blok tanda tangan otomatis sejajar 1 baris berapapun jumlah kolomnya, dan Jeda Pasca-Cuti default langsung masuk `X1`.

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Struktur halaman utama (tanpa logika bisnis hardcode) |
| `config.js` | **Pusat seluruh variabel lapangan** (kode, SOP, `pohRules`, override, libur nasional, warna, tanda tangan) |
| `styles.css` | Tampilan modern pastel & layout cetak PDF A4 Landscape |
| `app.js` | Mesin simulasi roster v2.0, kunci periode, carry-over TC, override, skenario & Export Excel `.xlsx` |
| `firebase.json` | Konfigurasi siap pakai untuk deploy ke Firebase Hosting (`no-cache` khusus `config.js`) |

## Deploy ke GitHub Pages / Firebase Hosting

- **GitHub Pages:** Upload semua file hasil ekstrak ZIP langsung ke root repository (`main` branch), lalu aktifkan di **Settings → Pages**.
- **Firebase Hosting:** Jalankan `firebase use --add` lalu `firebase deploy --only hosting`.
