/**
 * ============================================================================
 * KAN TIMESHEET & LEAVE SIMULATOR — CONFIGURATION FILE (config.js)
 * ============================================================================
 * Ubah variabel di file ini untuk menyesuaikan kode, aturan SOP, label,
 * warna, dan teks saran sesuai kondisi aktual di lapangan — TANPA perlu
 * mengubah kode inti di app.js atau index.html.
 *
 * Tips:
 * - Setelah mengubah nilai di bawah, simpan file lalu refresh browser (Ctrl+F5).
 * - Pastikan tanda kutip ('...') dan koma (,) tetap rapi.
 * ============================================================================
 */

window.KAN_CONFIG = {
  // 1. IDENTITAS APLIKASI & PERUSAHAAN
  app: {
    title: 'KAN Timesheet & Leave Simulator',
    subtitle: 'Simulasi Roster 5:2, Tabungan Cuti (TC), Cuti Tahunan (CT), & Kuota Tiket',
    companyName: 'PT Kalimantan Agro Nusantara (KAN)',
    departmentDefault: 'Operasional / Site',
    version: '1.0.0'
  },

  // 2. KODE KETERANGAN MATRIKS (Ubah di sini jika kode lapangan berubah, misal 'X' -> 'Y')
  codes: {
    work: 'X',              // Kode Hari Kerja Reguler (otomatis jadi X1, X2, dst.)
    tc: 'TC',               // Kode Tabungan Cuti (otomatis jadi TC1, TC2, dst.)
    off: 'OFF',             // Kode Libur Mingguan / Awal Pulang / Hari Keberangkatan
    leave: 'C',             // Kode Cuti dari Tabungan TC (otomatis jadi C1, C2, dst.)
    annualLeave: 'CT',      // Kode Cuti Tahunan (otomatis jadi CT1, CT2, dst.)
    postLeaveGap: 'TRV?',   // Kode Kotak Abu-Abu transisi pasca-cuti sebelum X1 siklus baru
    preStart: '',           // Isi sel sebelum tanggal mulai X1
    nonDate: ''             // Isi sel tanggal yang tidak ada (misal 30 Feb)
  },

  // 3. ATURAN BISNIS & SOP
  rules: {
    workDaysPerWeek: 5,              // Wajib genap 5 hari kerja (X) sebelum TC terbit pada minggu berjalan
    minHomeLeaveDays: 9,             // Kunci minimal pengajuan cuti di rumah (1 OFF + 8 C = 9 hari)
    maxHomeLeaveDays: 30,            // Batas atas input simulasi durasi cuti di rumah
    defaultHomeLeaveDays: 14,        // Nilai awal durasi cuti di rumah
    homeLeavePresets: [9, 10, 14, 21], // Tombol preset cepat (semua >= minHomeLeaveDays)

    companyTicketQuotaPerYear: 3,    // Periode 1..3 = Tiket Perusahaan, Periode 4+ = Tiket Mandiri
    ticketQuotaResetMode: 'calendar_year', // 'calendar_year' (reset tiap ganti tahun kalender) | 'simulation_window'

    annualLeaveEntitlementDays: 15,  // Hak cuti tahunan default setelah genap 1 tahun kerja
    annualLeaveMinServiceMonths: 12, // Masa kerja minimal (bulan) agar hak CT aktif

    defaultWorkCounterMode: 'site_day',    // 'site_day' (X1-X5, TC1, OFF, X8...) | 'work_day' (X1-X5, TC1, OFF, X6...)
    defaultOffDay: 'auto',                 // 'auto' (ikut siklus 5:2 dari X1) atau angka 0 (Min) s/d 6 (Sab)
    defaultDepartureMode: 'work_day6',     // 'work_day6' (kerja penuh hari ke-6, TC terakhir terbit) | 'leave_after_day5' (berangkat stlh hari ke-5)
    defaultGrayBoxMode: 'trv',             // 'trv' (tampilkan kotak abu-abu TRV?) | 'work' (langsung mulai X1)
    defaultViewMode: 'full_year',          // 'full_year' (Jan-Des tahun X1) | 'rolling_12' (12 bulan berjalan)

    allowDecimalCT: false                  // Biarkan false (CT selalu hari penuh)
  },

  // 4. NILAI DEFAULT FORM SAAT PERTAMA KALI DIBUKA
  defaults: {
    employeeName: 'IrwanS',
    employeeNik: 'KAN-2026-007',
    employeeRole: 'HR Manager / Manager Site',
    joinDate: '2025-02-01',          // YYYY-MM-DD (untuk cek masa kerja >= 1 tahun hak CT)
    startDate: '2026-01-05',         // YYYY-MM-DD (tanggal mulai X1 di site)
    annualLeaveBalance: 15           // Sisa saldo Cuti Tahunan (CT) saat ini
  },

  // 5. LABEL BAHASA & PENAMAAN
  labels: {
    ticketCompany: 'Tiket Perusahaan',
    ticketSelf: 'Tiket Pribadi',
    workCounterModes: {
      site_day: 'Counter Hari di Site (X1–X5, TC1, OFF, X8…)',
      work_day: 'Murni Hari Kerja Fisik (X1–X5, TC1, OFF, X6…)'
    },
    departureModes: {
      work_day6: 'Masuk kerja penuh di hari ke-6 (TC terakhir terbit & dihitung jadi jatah C)',
      leave_after_day5: 'Berangkat setelah hari kerja ke-5 berakhir — Malam / Hari ke-6 dinihari-pagi (Hari ke-6 jadi OFF, jatah C berkurang 1)'
    },
    grayBoxModes: {
      trv: 'Tampilkan Kotak Abu-Abu Transisi (TRV? / Perjalanan Kembali)',
      work: 'Langsung Masuk Kerja X1 Hari Berikutnya (Tanpa Jeda)'
    },
    viewModes: {
      full_year: 'Tahun Penuh (Jan – Des)',
      rolling_12: '12 Bulan Berjalan (dari Bulan X1)'
    },
    dayNamesShort: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    dayNamesFull: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    monthNamesFull: [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
  },

  // 6. PALET WARNA PASTEL (Otomatis sinkron ke UI Matriks, Legenda, Print PDF, dan Export Excel)
  colors: {
    work:         { bg: '#FFFFFF', text: '#1E293B', border: '#CBD5E1', label: 'Hari Kerja Reguler' },
    workPartial:  { bg: '#F8FAFC', text: '#334155', border: '#CBD5E1', label: 'Hari Kerja (Minggu < 5 Hari, Belum TC)' },
    tc:           { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D', label: 'Tabungan Cuti (TC)' },
    tcLast:       { bg: '#FFEDD5', text: '#9A3412', border: '#FB923C', label: 'TC Terakhir (Kandidat Travel Pulang)' },
    offSite:      { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC', label: 'OFF Mingguan di Site' },
    offDepart:    { bg: '#BAE6FD', text: '#075985', border: '#38BDF8', label: 'OFF Keberangkatan (Pulang stlh Hari ke-5)' },
    offLeave:     { bg: '#CCFBF1', text: '#115E59', border: '#5EEAD4', label: 'OFF Awal Cuti Pulang' },
    leave:        { bg: '#DCFCE7', text: '#166534', border: '#86EFAC', label: 'Cuti Tabungan (C)' },
    annualLeave:  { bg: '#F3E8FF', text: '#6B21A8', border: '#C084FC', label: 'Cuti Tahunan (CT)' },
    postLeaveGap: { bg: '#E2E8F0', text: '#475569', border: '#94A3B8', label: 'Transisi Pasca-Cuti (Konfirmasi HR)' },
    preStart:     { bg: '#F8FAFC', text: '#94A3B8', border: '#E2E8F0', label: 'Pra-Mulai Roster' },
    nonDate:      { bg: '#CBD5E1', text: '#64748B', border: '#CBD5E1', label: 'Tanggal Non-Kalender' }
  },

  // 7. TEMPLATE PESAN & SARAN HR (Untuk Popover / Inspector saat sel diklik)
  // Placeholder tersedia: {code}, {workCode}, {tcCode}, {offCode}, {cCode}, {ctCode}, {cycle}, {weekWork}, {minWork}
  messages: {
    work: {
      title: 'Hari Kerja Reguler ({code})',
      desc: 'Hari kerja aktif di site pada Siklus ke-{cycle}. Terhitung menuju syarat minimal {minWork} hari kerja per minggu untuk menerbitkan {tcCode}.',
      advice: 'Pastikan absensi tercatat normal agar akumulasi hari kerja minggu berjalan tidak terputus.'
    },
    workPartial: {
      title: 'Hari Kerja — Minggu Belum Genap ({code})',
      desc: 'Hari ini adalah H-1 sebelum hari {offCode} tetap, namun akumulasi hari kerja minggu berjalan baru {weekWork} hari (kurang dari syarat {minWork} hari). Sesuai SOP, {tcCode} belum terbit dan hari ini dihitung hari kerja reguler.',
      advice: 'Perolehan {tcCode} akan mulai normal pada minggu berikutnya setelah genap {minWork} hari kerja penuh.'
    },
    tc: {
      title: 'Tabungan Cuti ({code})',
      desc: 'Terbit setelah menyelesaikan genap {minWork} hari kerja pada minggu berjalan (Siklus ke-{cycle}). Setiap 1 {tcCode} setara 1 hari hak {cCode}.',
      advice: 'Hari ke-6 ini tetap aktif bekerja di site sambil mengumpulkan hak cuti pulang.'
    },
    tcLast: {
      title: 'TC Terakhir Sebelum Pulang ({code})',
      desc: 'Tabungan cuti terakhir pada Siklus ke-{cycle}. Dengan bekerja penuh hari ini, jatah {cCode} Anda utuh maksimal dan besok langsung masuk hari {offCode} awal pulang.',
      advice: 'Saran HR: Jika ingin berangkat di hari ini, pastikan koordinasi izin keberangkatan sore/malam setelah jam kerja selesai agar status {tcCode} tetap sah.'
    },
    offSite: {
      title: 'Libur Mingguan di Site ({code})',
      desc: 'Hari istirahat mingguan di site pada Siklus ke-{cycle}. Penghitung hari kerja mingguan di-reset untuk minggu berikutnya.',
      advice: 'Gunakan untuk istirahat rutin di mes/site.'
    },
    offDepart: {
      title: 'Hari Keberangkatan / Tidak Terbit TC ({code})',
      desc: 'Anda memilih opsi berangkat setelah hari kerja ke-5 berakhir (malam hari ke-5 atau dinihari/pagi hari ke-6). Karena tidak bekerja di hari ke-6, {tcCode} terakhir tidak terbit sehingga jatah {cCode} berkurang 1 hari.',
      advice: 'Total hari di luar site tetap sama dengan target, namun komposisinya menjadi 2 hari {offCode} di awal diikuti sisa hak {cCode}.'
    },
    offLeave: {
      title: 'Hari OFF Awal Periode Cuti ({code})',
      desc: 'Hari libur mingguan yang menjadi pembuka periode pulang Siklus ke-{cycle}, langsung disambung rangkaian hari {cCode}.',
      advice: 'Pastikan formulir pengajuan cuti & tiket telah disetujui atasan dan HR Site minimal H-14.'
    },
    leave: {
      title: 'Cuti dari Tabungan TC ({code})',
      desc: 'Penggunaan hak cuti hasil tabungan {tcCode} pada Siklus ke-{cycle}.',
      advice: 'Perhatikan tanggal kembali ke site agar tidak memotong hak kehadiran siklus berikutnya.'
    },
    annualLeave: {
      title: 'Cuti Tahunan ({code})',
      desc: 'Tambahan hari libur di rumah dari saldo Cuti Tahunan (Opsi A: menambah durasi di rumah tanpa mengurangi hak {cCode}). Hanya aktif setelah masa kerja genap 1 tahun.',
      advice: 'Saldo Cuti Tahunan otomatis terpotong sesuai jumlah hari {ctCode} yang dialokasikan pada periode ini.'
    },
    postLeaveGap: {
      title: 'Kotak Transisi Pasca-Cuti ({code})',
      desc: 'Hari jeda/transisi antara hari cuti terakhir dan dimulainya hari kerja {workCode}1 siklus berikutnya (biasanya digunakan sebagai hari perjalanan balik ke site).',
      advice: 'Konfirmasi kebijakan HR Site: apakah hari perjalanan kembali dihitung sebagai hari travel terpisah atau wajib sudah masuk {workCode}1.'
    }
  },

  // 8. BLOK TANDA TANGAN (Muncul saat Cetak / Export PDF)
  signatures: [
    { title: 'Dibuat Oleh,', role: 'Karyawan' },
    { title: 'Diperiksa Oleh,', role: 'Atasan Langsung / KTU' },
    { title: 'Disetujui Oleh,', role: 'HR Site / Estate Manager' }
  ]
};
