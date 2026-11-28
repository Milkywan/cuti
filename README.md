# Timesheet & Leave Simulator Suite (v3.1 — Multi-Company PT KAN & PT BJL)

Aplikasi web modular berbasis browser (tanpa backend) untuk simulasi jadwal roster, cuti, hari travel, P.O.H, uang Lumpsum, kunci periode (history lock), override manual, ekspor Excel (`.xlsx`), dan cetak PDF A4 Landscape untuk dua entitas perusahaan:

1. **PT Baja Jaya Lestari (BJL)** — Roster Site `X56` / `X63` / `X70` (basis Hari Kalender di Site), pola kerja `13:1` / `6:1` / `2:1` (dengan **Tanggal Acuan Hari OFF Pertama** per karyawan), Cuti Periodik (CP), Extend On-Site dengan batas SOP **42 hari** (simulasi s/d 90 hr & peringatan warna merah hari ke-43 dst.), Tabungan Hak Cuti Ekstra (`earnedCE`) + stepper **Ambil CE** bebas periode, Hari Travel PP (`TRV 0`, `TRV 1` & `TRV 2` otomatis 1 brgkt + 1 plg), Override **`S`** (X lanjut) & **`IS`** (Ijin Sakit Tanpa SKD — reset X1), Bracket CT Masa Kerja (`12–15 hr`), Master Tarif Lumpsum 26 Kota (Berangkat Hijau / Kembali Oranye) + Input Mandiri Grade `P6`, `M8`, `Y`, `Z`, validasi SOP POH `BJL-H-SOP-HRGA-005T`, serta Export Excel 4 Sheet.
2. **PT Kalimantan Agro Nusantara (KAN)** — Fitur lengkap v2.0 dipertahankan 100% utuh: Roster `5:2`, Tabungan & Carry-Over `TC`, Profil P.O.H Ring 1/2/3, Kunci Periode, Durasi Fleksibel per Periode, Override Manual (`S`/`I`/`DL`/`A`/`OFF*`), Libur Nasional 2025–2027, dan Export Excel `.xlsx`.

## Ringkasan Pembaruan Modul BJL (v3.0 → v3.1)

1. **Pola Kerja 2:1:** Dipertahankan (`workDays: 2, offDays: 1`) dengan label tegas **Pola 2:1 (2 Hari Kerja : 1 Hari OFF — Siklus 3 Hr)**.
2. **Basis Hitung Roster (Card 2):** Dropdown `bjlSiteCountMode` dihapus; target roster (`X56`, `X63`, `X70`) selalu menghitung **Hari Kalender di Site**.
3. **Extend Site → CE (Batas SOP 42 Hari):** Ditambahkan `maxExtendSopDays: 42` dengan simulasi s/d 90 hari; hari extend ke-43 dst. otomatis berwarna merah peringatan (`extendOverSop`) lengkap dengan badge reminder SOP di tabel periode & KPI.
4. **Tabungan & Pemakaian Cuti Ekstra (CE):** Extend hanya menambah **Saldo Hak CE (`earnedCE`)** ke tabungan karyawan. Tersedia stepper **Ambil CE** (default `0`) pada tiap periode untuk memilih periode & jumlah pemakaian CE sesuai saldo tersedia.
5. **Sakit Surat Dokter (`S`):** Diubah menjadi `countsAsSite: true` — hitungan hari roster (`X`) tetap berlanjut tanpa terputus.
6. **Ijin Sakit Tanpa Surat Dokter (`IS`):** Status override baru dengan `resetsRosterX: true` — memutus hitungan `X` dan memulai ulang dari `X1` pada hari aktif berikutnya.
7. **Travel Day (`TRV 1` & `TRV 2`) PP:** Keduanya otomatis mendapat 1 hari berangkat + 1 hari pulang (total 2 hari PP); dropdown `bjlTrv1Placement` dihapus.
8. **Tanggal Acuan Hari OFF Karyawan:** Input opsional **Tanggal Hari OFF Pertama (Acuan Pola)** di Card 2 untuk menyinkronkan fase OFF pola `13:1`, `6:1`, atau `2:1` per karyawan secara konsisten ke depan.

## Akun Login Default (`config.js`)

| Username | Password | Role | Akses Modul |
|---|---|---|---|
| `irwans` | `123456` | Super Admin | PT BJL & PT KAN (Switcher aktif) |
| `userbjl` | `123456` | HR / User BJL | Khusus PT BJL |
| `userkan` | `123456` | HR / User KAN | Khusus PT KAN |

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama Multi-Company (Login, Topbar Switcher, Workspace BJL v3.1, Workspace KAN, dan semua Modal) |
| `config.js` | Pusat konfigurasi `KAN_CONFIG`, `BJL_CONFIG` (v3.1 + 26 kota Lumpsum), dan `APP_CONFIG` |
| `bjl-module.js` | Engine simulasi roster v3.1, acuan OFF, SOP extend 42 hr, tabungan CE, `S`/`IS`, TRV PP, Lumpsum & Export Excel 4 Sheet |
| `kan-module.js` | Engine simulasi roster 5:2, TC carry-over, POH Ring 1–3, skenario, dan Export Excel PT KAN |
| `app.js` | Shell controller global: autentikasi, switcher entitas, editor Tarif Lumpsum, dan editor Tanda Tangan PDF |
| `styles.css` | Stylesheet responsif tema PT KAN & PT BJL v3.1 + layout cetak PDF A4 Landscape |
| `firebase.json` | Konfigurasi Firebase Hosting (`no-cache` untuk `config.js`) |

## Cara Menjalankan & Deploy

- **Lokal:** Ekstrak ZIP lalu buka `index.html` langsung di browser modern (Chrome / Edge / Safari / Firefox).
- **GitHub Pages:** Upload semua file hasil ekstrak ke root repository (`main`), lalu aktifkan di **Settings → Pages**.
- **Firebase Hosting:** Jalankan `firebase use --add` lalu `firebase deploy --only hosting`.
