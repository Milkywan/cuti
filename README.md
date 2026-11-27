# KAN Timesheet & Leave Simulator

Aplikasi simulasi jadwal roster 5:2, Tabungan Cuti (`TC`), Cuti Tahunan (`CT`), dan kuota tiket karyawan dengan arsitektur modular berbasis **`config.js`**.

## Struktur File

| File | Fungsi |
|---|---|
| `index.html` | Struktur halaman utama (tanpa logika bisnis hardcode) |
| `config.js` | **Pusat seluruh variabel lapangan** (kode `X`/`TC`/`OFF`/`C`/`CT`, warna, minimal hari, kuota tiket, teks saran HR) |
| `styles.css` | Tampilan modern pastel & layout cetak PDF A4 Landscape |
| `app.js` | Mesin simulasi roster, alokasi CT, inspektor sel, dan Export Excel `.xlsx` |
| `firebase.json` | Konfigurasi siap pakai saat nanti deploy ke Firebase Hosting (dengan header `no-cache` khusus `config.js`) |

---

## Cara Mengubah Variabel di `config.js`

Buka `config.js` (bisa langsung diedit lewat tombol pensil ✏️ di GitHub):

1. **Ubah Kode Matriks** (misal hari kerja di lapangan pakai `Y`, bukan `X`):
   ```js
   codes: {
     work: 'Y',          // otomatis berubah jadi Y1, Y2, dst. di seluruh aplikasi & Excel!
     tc: 'TC',
     off: 'OFF',
     leave: 'C',
     annualLeave: 'CT',
     postLeaveGap: 'TRV?'
   }
   ```
2. **Ubah Aturan SOP** (minimal hari cuti, kuota tiket perusahaan, syarat hari kerja mingguan):
   ```js
   rules: {
     workDaysPerWeek: 5,
     minHomeLeaveDays: 9,
     companyTicketQuotaPerYear: 3,
     annualLeaveEntitlementDays: 15,
     annualLeaveMinServiceMonths: 12
   }
   ```
3. **Ubah Warna Pastel** di bagian `colors` — otomatis sinkron ke tampilan web, Print PDF, dan hasil Export Excel (`.xlsx`).

---

## Upload ke GitHub & Aktifkan GitHub Pages (Sementara)

1. Buat repository baru di GitHub (misal `kan-timesheet-simulator`), pilih **Public** (atau Private jika pakai GitHub Pro).
2. Klik **Add file → Upload files**, lalu drag-and-drop semua file hasil ekstrak ZIP (`index.html`, `config.js`, `styles.css`, `app.js`, `firebase.json`, `README.md`) langsung ke root repository.
3. Klik **Commit changes**.
4. Masuk ke **Settings → Pages**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` dan folder `/ (root)` → klik **Save**.
5. Tunggu ±1 menit, aplikasi langsung aktif di `https://<username>.github.io/kan-timesheet-simulator/`.

> Karena semua path file memakai relative path (`./config.js`, `./styles.css`, `./app.js`), aplikasi otomatis berjalan mulus baik di subfolder GitHub Pages maupun saat dibuka lokal (`file://`).

---

## Deploy ke Firebase Hosting (Tahap Berikutnya)

File `firebase.json` sudah disiapkan di dalam paket ini (termasuk `Cache-Control: no-cache` untuk `config.js` agar setiap perubahan variabel langsung terbaca user tanpa stuck di cache browser).

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Di folder proyek ini, hubungkan ke project Firebase Anda:
   ```bash
   firebase use --add
   ```
4. Deploy langsung:
   ```bash
   firebase deploy --only hosting
   ```
