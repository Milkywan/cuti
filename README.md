# Timesheet & Leave Simulator Suite (v3.0 — Multi-Company PT KAN & PT BJL)

Aplikasi web modular berbasis browser (tanpa backend) untuk simulasi jadwal roster, cuti, hari travel, P.O.H, uang Lumpsum, kunci periode (history lock), override manual, ekspor Excel (`.xlsx`), dan cetak PDF A4 Landscape untuk dua entitas perusahaan:

1. **PT Baja Jaya Lestari (BJL)** — Roster Site `X56` / `X63` / `X70`, pola kerja `13:1` / `6:1` / `2:1`, Cuti Periodik (CP), Extend On-Site → Cuti Ekstra (CE), Hari Travel (`TRV 0/1/2`), Bracket CT Masa Kerja (`12–15 hr`), Master Tarif Lumpsum 26 Kota (Berangkat Hijau / Kembali Oranye) + Input Mandiri Grade `P6`, `M8`, `Y`, `Z`, validasi SOP POH `BJL-H-SOP-HRGA-005T`, serta Export Excel 4 Sheet.
2. **PT Kalimantan Agro Nusantara (KAN)** — Fitur lengkap v2.0 dipertahankan 100% utuh: Roster `5:2`, Tabungan & Carry-Over `TC`, Profil P.O.H Ring 1/2/3, Kunci Periode, Durasi Fleksibel per Periode, Override Manual (`S`/`I`/`DL`/`A`/`OFF*`), Libur Nasional 2025–2027, dan Export Excel `.xlsx`.

## Akun Login Default (`config.js`)

| Username | Password | Role | Akses Modul |
|---|---|---|---|
| `irwans` | `123456` | Super Admin | PT BJL & PT KAN (Switcher aktif) |
| `userbjl` | `123456` | HR / User BJL | Khusus PT BJL |
| `userkan` | `123456` | HR / User KAN | Khusus PT KAN |

> Akun, password, aturan SOP, master Lumpsum, hari libur nasional, dan default tanda tangan dapat diubah langsung di `config.js`.

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama Multi-Company (Login, Topbar Switcher, Workspace BJL, Workspace KAN, dan semua Modal) |
| `config.js` | Pusat konfigurasi `KAN_CONFIG`, `BJL_CONFIG` (termasuk 26 kota Lumpsum), dan `APP_CONFIG` (login & entitas) |
| `bjl-module.js` | Engine simulasi roster, CE, TRV, CT bracket, Lumpsum, skenario, dan Export Excel 4 Sheet PT BJL |
| `kan-module.js` | Engine simulasi roster 5:2, TC carry-over, POH Ring 1–3, skenario, dan Export Excel PT KAN |
| `app.js` | Shell controller global: autentikasi, switcher entitas, editor Tarif Lumpsum, dan editor Tanda Tangan PDF |
| `styles.css` | Stylesheet responsif tema PT KAN & PT BJL + layout cetak PDF A4 Landscape |
| `firebase.json` | Konfigurasi Firebase Hosting (`no-cache` untuk `config.js`) |

## Cara Menjalankan & Deploy

- **Lokal:** Ekstrak ZIP lalu buka `index.html` langsung di browser modern (Chrome / Edge / Safari / Firefox).
- **GitHub Pages:** Upload semua file hasil ekstrak ke root repository (`main`), lalu aktifkan di **Settings → Pages**.
- **Firebase Hosting:** Jalankan `firebase use --add` lalu `firebase deploy --only hosting`.
