/**
 * ============================================================================
 * MULTI-COMPANY TIMESHEET & LEAVE SIMULATOR — CONFIGURATION (config.js v3.0)
 * ============================================================================
 * Mendukung 2 Entitas Perusahaan:
 *   1. PT Kalimantan Agro Nusantara (KAN) — Roster 5:2, TC, Carry-Over & POH
 *   2. PT Baja Jaya Lestari (BJL)         — Roster X56/X63/X70, Pola 13:1/6:1/2:1,
 *      Cuti Periodik 14 hr, Cuti Ekstra (pembagi 4 / 4,5 / 5), TRV 0/1/2,
 *      Bracket CT Masa Kerja (12-15 hr), POH SOP BJL-H-SOP-HRGA-005T & Lumpsum.
 *
 * Tips:
 * - Ubah akun login, aturan SOP, tarif Lumpsum, atau blok tanda tangan di sini.
 * - Setelah mengubah nilai, simpan file lalu refresh browser (Ctrl+F5).
 * ============================================================================
 */

/**
 * ============================================================================
 * KAN TIMESHEET & LEAVE SIMULATOR — CONFIGURATION FILE (config.js) v2.0.0
 * ============================================================================
 * Pusat seluruh variabel lapangan, kode matriks, aturan SOP, P.O.H (Point of Hire),
 * override manual, daftar hari libur nasional, palet warna, dan blok tanda tangan.
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
    subtitle: 'Simulasi Roster 5:2, P.O.H, Kunci Periode, Carry-Over TC, Override Manual & Libur Nasional',
    companyName: 'PT Kalimantan Agro Nusantara (KAN)',
    departmentDefault: 'Operasional / Site',
    version: '2.0.0'
  },

  // 2. KODE KETERANGAN MATRIKS (Ubah di sini jika kode lapangan berubah, misal 'X' -> 'Y')
  codes: {
    work: 'X',
    tc: 'TC',
    off: 'OFF',
    leave: 'C',
    annualLeave: 'CT',
    postLeaveGap: 'TRV?',
    preStart: '',
    nonDate: ''
  },

  // 3. ATURAN P.O.H (POINT OF HIRE) & KATEGORI JABATAN
  pohRules: {
    ring1: {
      label: 'Ring 1 — Lokal Site (Non-Tiket)',
      shortLabel: 'Ring 1 (Lokal)',
      ticketQuotaPerYear: 0,
      ticketLabel: 'Non-Tiket (Lokal Site)',
      selfTicketLabel: 'Non-Tiket (Lokal Site)',
      defaultCity: 'Lokal Site'
    },
    ring2: {
      label: 'Ring 2 — Lokal Provinsi (Darat/Laut)',
      shortLabel: 'Ring 2 (Provinsi)',
      ticketQuotaPerYear: 3,
      ticketLabel: 'Transport POH Perusahaan',
      selfTicketLabel: 'Transport Mandiri',
      defaultCity: 'Balikpapan / Samarinda'
    },
    ring3: {
      label: 'Ring 3 — Non-Lokal (Pesawat)',
      shortLabel: 'Ring 3 (Non-Lokal)',
      ticketQuotaPerYear: 3,
      ticketLabel: 'Tiket Perusahaan',
      selfTicketLabel: 'Tiket Mandiri',
      defaultCity: 'Surabaya (SUB)'
    }
  },

  employeeGrades: [
    'Non-Staff',
    'Staff',
    'SPV / Manager'
  ],

  // 4. TIPE OVERRIDE MANUAL (Ubah countsAsWork sesuai SOP site Anda)
  overrideTypes: {
    sick:      { code: 'S',    label: 'Sakit (Surat Dokter)',  countsAsWork: false },
    permit:    { code: 'I',    label: 'Izin Resmi',            countsAsWork: false },
    duty:      { code: 'DL',   label: 'Dinas Luar / Training', countsAsWork: true  },
    alpha:     { code: 'A',    label: 'Mangkir / Alpha',       countsAsWork: false },
    customOff: { code: 'OFF*', label: 'OFF Manual / Tukar',    countsAsWork: false }
  },

  // 5. ATURAN BISNIS & SOP
  rules: {
    workDaysPerWeek: 5,
    minHomeLeaveDays: 9,
    maxHomeLeaveDays: 30,
    defaultHomeLeaveDays: 14,
    homeLeavePresets: [9, 10, 11, 14, 21],

    companyTicketQuotaPerYear: 3,          // Fallback kuota tiket tahunan (otomatis ikut pohRules)
    ticketQuotaResetMode: 'calendar_year', // 'calendar_year' | 'simulation_window'

    annualLeaveEntitlementDays: 15,
    annualLeaveMinServiceMonths: 12,

    defaultWorkCounterMode: 'site_day',    // 'site_day' | 'work_day'
    defaultOffDay: 'auto',                 // 'auto' | 0..6
    defaultDepartureMode: 'work_day6',     // 'work_day6' | 'leave_after_day5'
    defaultGrayBoxMode: 'work',            // 'work' (langsung mulai X1) | 'trv' (tampilkan kotak abu-abu TRV?)
    defaultViewMode: 'full_year',          // 'full_year' | 'rolling_12'
    defaultShowHolidays: true,

    allowDecimalCT: false
  },

  // 6. NILAI DEFAULT FORM SAAT PERTAMA KALI DIBUKA
  defaults: {
    employeeName: 'Budi Santoso',
    employeeNik: 'KAN-2025-0142',
    employeeRole: 'Asisten Afdeling / Staff Site',
    employeeGrade: 'Staff',
    pohCategory: 'ring3',
    pohCity: 'Surabaya (SUB)',
    joinDate: '2025-02-01',
    startDate: '2026-01-05',
    annualLeaveBalance: 15,
    initialTcBalance: 0
  },

  // 7. LABEL BAHASA & PENAMAAN
  labels: {
    ticketCompany: 'Tiket Perusahaan',
    ticketSelf: 'Tiket Mandiri',
    workCounterModes: {
      site_day: 'Counter Hari di Site (X1–X5, TC1, OFF, X8…)',
      work_day: 'Murni Hari Kerja Fisik (X1–X5, TC1, OFF, X6…)'
    },
    departureModes: {
      work_day6: 'Masuk kerja penuh di hari ke-6 (TC terakhir terbit & dihitung jadi jatah C)',
      leave_after_day5: 'Berangkat setelah hari kerja ke-5 berakhir — Malam / Hari ke-6 dinihari-pagi (Hari ke-6 jadi OFF, jatah C berkurang 1)'
    },
    grayBoxModes: {
      work: 'Langsung Masuk Kerja X1 Hari Berikutnya (Tanpa Jeda)',
      trv: 'Tampilkan Kotak Abu-Abu Transisi (TRV? / Perjalanan Kembali)'
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

  // 8. PALET WARNA PASTEL (Otomatis sinkron ke UI Matriks, Legenda, Print PDF & Excel)
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
    nonDate:      { bg: '#CBD5E1', text: '#64748B', border: '#CBD5E1', label: 'Tanggal Non-Kalender' },
    // Warna Override Manual
    sick:         { bg: '#FFE4E6', text: '#9F1239', border: '#FDA4AF', label: 'Override: Sakit (S)' },
    permit:       { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC', label: 'Override: Izin (I)' },
    duty:         { bg: '#CFFAFE', text: '#155E75', border: '#67E8F9', label: 'Override: Dinas Luar (DL)' },
    alpha:        { bg: '#FECACA', text: '#991B1B', border: '#F87171', label: 'Override: Mangkir / Alpha (A)' },
    customOff:    { bg: '#E0F2FE', text: '#0C4A6E', border: '#38BDF8', label: 'Override: OFF Manual (OFF*)' }
  },

  // 9. HARI LIBUR NASIONAL & CUTI BERSAMA INDONESIA (Sesuaikan dgn SKB 3 Menteri)
  // type: 'national' (Libur Nasional) | 'joint' (Cuti Bersama)
  holidays: {
    // --- 2025 ---
    '2025-01-01': { name: 'Tahun Baru 2025 Masehi', type: 'national' },
    '2025-01-27': { name: 'Isra Mikraj Nabi Muhammad SAW', type: 'national' },
    '2025-01-28': { name: 'Cuti Bersama Tahun Baru Imlek', type: 'joint' },
    '2025-01-29': { name: 'Tahun Baru Imlek 2576 Kongzili', type: 'national' },
    '2025-03-28': { name: 'Cuti Bersama Hari Suci Nyepi', type: 'joint' },
    '2025-03-29': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1947)', type: 'national' },
    '2025-03-31': { name: 'Hari Raya Idulfitri 1446 H', type: 'national' },
    '2025-04-01': { name: 'Hari Raya Idulfitri 1446 H', type: 'national' },
    '2025-04-02': { name: 'Cuti Bersama Idulfitri 1446 H', type: 'joint' },
    '2025-04-03': { name: 'Cuti Bersama Idulfitri 1446 H', type: 'joint' },
    '2025-04-04': { name: 'Cuti Bersama Idulfitri 1446 H', type: 'joint' },
    '2025-04-07': { name: 'Cuti Bersama Idulfitri 1446 H', type: 'joint' },
    '2025-04-18': { name: 'Wafat Yesus Kristus', type: 'national' },
    '2025-04-20': { name: 'Kebangkitan Yesus Kristus (Paskah)', type: 'national' },
    '2025-05-01': { name: 'Hari Buruh Internasional', type: 'national' },
    '2025-05-12': { name: 'Hari Raya Waisak 2569 BE', type: 'national' },
    '2025-05-29': { name: 'Kenaikan Yesus Kristus', type: 'national' },
    '2025-06-01': { name: 'Hari Lahir Pancasila', type: 'national' },
    '2025-06-06': { name: 'Hari Raya Iduladha 1446 H', type: 'national' },
    '2025-06-27': { name: '1 Muharam Tahun Baru Islam 1447 H', type: 'national' },
    '2025-08-17': { name: 'Hari Kemerdekaan RI', type: 'national' },
    '2025-09-05': { name: 'Maulid Nabi Muhammad SAW', type: 'national' },
    '2025-12-25': { name: 'Hari Raya Natal', type: 'national' },
    '2025-12-26': { name: 'Cuti Bersama Hari Raya Natal', type: 'joint' },

    // --- 2026 ---
    '2026-01-01': { name: 'Tahun Baru 2026 Masehi', type: 'national' },
    '2026-01-16': { name: 'Isra Mikraj Nabi Muhammad SAW', type: 'national' },
    '2026-02-16': { name: 'Cuti Bersama Tahun Baru Imlek', type: 'joint' },
    '2026-02-17': { name: 'Tahun Baru Imlek 2577 Kongzili', type: 'national' },
    '2026-03-18': { name: 'Cuti Bersama Hari Suci Nyepi', type: 'joint' },
    '2026-03-19': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', type: 'national' },
    '2026-03-20': { name: 'Hari Raya Idulfitri 1447 H', type: 'national' },
    '2026-03-21': { name: 'Hari Raya Idulfitri 1447 H', type: 'national' },
    '2026-03-23': { name: 'Cuti Bersama Idulfitri 1447 H', type: 'joint' },
    '2026-03-24': { name: 'Cuti Bersama Idulfitri 1447 H', type: 'joint' },
    '2026-04-03': { name: 'Wafat Yesus Kristus', type: 'national' },
    '2026-04-05': { name: 'Kebangkitan Yesus Kristus (Paskah)', type: 'national' },
    '2026-05-01': { name: 'Hari Buruh Internasional', type: 'national' },
    '2026-05-14': { name: 'Kenaikan Yesus Kristus', type: 'national' },
    '2026-05-15': { name: 'Cuti Bersama Kenaikan Yesus Kristus', type: 'joint' },
    '2026-05-27': { name: 'Hari Raya Iduladha 1447 H', type: 'national' },
    '2026-05-28': { name: 'Cuti Bersama Iduladha 1447 H', type: 'joint' },
    '2026-05-31': { name: 'Hari Raya Waisak 2570 BE', type: 'national' },
    '2026-06-01': { name: 'Hari Lahir Pancasila', type: 'national' },
    '2026-06-16': { name: '1 Muharam Tahun Baru Islam 1448 H', type: 'national' },
    '2026-08-17': { name: 'Hari Kemerdekaan RI', type: 'national' },
    '2026-08-25': { name: 'Maulid Nabi Muhammad SAW', type: 'national' },
    '2026-12-24': { name: 'Cuti Bersama Hari Raya Natal', type: 'joint' },
    '2026-12-25': { name: 'Hari Raya Natal', type: 'national' },

    // --- 2027 ---
    '2027-01-01': { name: 'Tahun Baru 2027 Masehi', type: 'national' },
    '2027-01-05': { name: 'Isra Mikraj Nabi Muhammad SAW', type: 'national' },
    '2027-02-06': { name: 'Tahun Baru Imlek 2578 Kongzili', type: 'national' },
    '2027-03-09': { name: 'Hari Suci Nyepi (Tahun Baru Saka 1949)', type: 'national' },
    '2027-03-10': { name: 'Hari Raya Idulfitri 1448 H', type: 'national' },
    '2027-03-11': { name: 'Hari Raya Idulfitri 1448 H', type: 'national' },
    '2027-03-26': { name: 'Wafat Yesus Kristus', type: 'national' },
    '2027-03-28': { name: 'Kebangkitan Yesus Kristus (Paskah)', type: 'national' },
    '2027-05-01': { name: 'Hari Buruh Internasional', type: 'national' },
    '2027-05-06': { name: 'Kenaikan Yesus Kristus', type: 'national' },
    '2027-05-17': { name: 'Hari Raya Iduladha 1448 H', type: 'national' },
    '2027-05-20': { name: 'Hari Raya Waisak 2571 BE', type: 'national' },
    '2027-06-01': { name: 'Hari Lahir Pancasila', type: 'national' },
    '2027-06-06': { name: '1 Muharam Tahun Baru Islam 1449 H', type: 'national' },
    '2027-08-15': { name: 'Maulid Nabi Muhammad SAW', type: 'national' },
    '2027-08-17': { name: 'Hari Kemerdekaan RI', type: 'national' },
    '2027-12-25': { name: 'Hari Raya Natal', type: 'national' }
  },

  // 10. TEMPLATE PESAN & SARAN HR
  messages: {
    work: {
      title: 'Hari Kerja Reguler ({code})',
      desc: 'Hari kerja aktif di site pada Siklus ke-{cycle}. Terhitung menuju syarat minimal {minWork} hari kerja per minggu untuk menerbitkan {tcCode}.',
      advice: 'Pastikan absensi tercatat normal agar akumulasi hari kerja minggu berjalan tidak terputus.'
    },
    workPartial: {
      title: 'Hari Kerja — Minggu Belum Genap ({code})',
      desc: 'Hari ini adalah H-1 sebelum hari {offCode}, namun akumulasi hari kerja minggu berjalan baru {weekWork} hari (kurang dari syarat {minWork} hari). Sesuai SOP, {tcCode} belum terbit dan hari ini dihitung hari kerja reguler.',
      advice: 'Perolehan {tcCode} akan terbit pada minggu berikutnya setelah genap {minWork} hari kerja penuh.'
    },
    tc: {
      title: 'Tabungan Cuti ({code})',
      desc: 'Terbit setelah menyelesaikan genap {minWork} hari kerja pada minggu berjalan (Siklus ke-{cycle}). Setiap 1 {tcCode} setara 1 hari hak {cCode}.',
      advice: 'Hari ke-6 ini tetap aktif bekerja di site sambil mengumpulkan hak cuti pulang.'
    },
    tcLast: {
      title: 'TC Terakhir Sebelum Pulang ({code})',
      desc: 'Tabungan cuti terakhir pada Siklus ke-{cycle}. Dengan bekerja penuh hari ini, jatah {cCode} Anda terpenuhi dan besok langsung masuk hari {offCode} awal pulang.',
      advice: 'Saran HR: Jika ingin berangkat di hari ini, koordinasikan izin keberangkatan sore/malam setelah jam kerja selesai agar status {tcCode} tetap sah.'
    },
    offSite: {
      title: 'Libur Mingguan di Site ({code})',
      desc: 'Hari istirahat mingguan di site pada Siklus ke-{cycle}. Penghitung hari kerja mingguan di-reset untuk minggu berikutnya.',
      advice: 'Gunakan untuk istirahat rutin di mes/site.'
    },
    offDepart: {
      title: 'Hari Keberangkatan / Tidak Terbit TC ({code})',
      desc: 'Opsi berangkat setelah hari kerja ke-5 berakhir aktif. Karena tidak bekerja di hari ke-6, {tcCode} terakhir tidak terbit sehingga jatah {cCode} berkurang 1 hari.',
      advice: 'Total hari di luar site tetap sesuai target, dengan komposisi 2 hari {offCode} di awal diikuti sisa hak {cCode}.'
    },
    offLeave: {
      title: 'Hari OFF Awal Periode Cuti ({code})',
      desc: 'Hari libur mingguan pembuka periode pulang Siklus ke-{cycle}, langsung disambung rangkaian hari {cCode}.',
      advice: 'Pastikan formulir pengajuan cuti & tiket telah disetujui atasan dan HR Site minimal H-14.'
    },
    leave: {
      title: 'Cuti dari Tabungan TC ({code})',
      desc: 'Penggunaan hak cuti hasil tabungan {tcCode} (termasuk carry-over jika ada) pada Siklus ke-{cycle}.',
      advice: 'Perhatikan tanggal kembali ke site agar tidak memotong hak kehadiran siklus berikutnya.'
    },
    annualLeave: {
      title: 'Cuti Tahunan ({code})',
      desc: 'Tambahan hari libur di rumah dari saldo Cuti Tahunan (Opsi A: menambah durasi di rumah tanpa mengurangi hak {cCode}).',
      advice: 'Saldo Cuti Tahunan otomatis terpotong sesuai jumlah hari {ctCode} yang dialokasikan pada periode ini.'
    },
    postLeaveGap: {
      title: 'Kotak Transisi Pasca-Cuti ({code})',
      desc: 'Hari jeda/transisi antara hari cuti terakhir dan dimulainya hari kerja {workCode}1 siklus berikutnya (hari perjalanan balik ke site).',
      advice: 'Konfirmasi kebijakan HR Site: apakah hari perjalanan kembali dihitung hari travel terpisah atau wajib sudah masuk {workCode}1.'
    },
    sick: {
      title: 'Override Manual: Sakit ({code})',
      desc: 'Tanggal ini ditandai Sakit secara manual pada Siklus ke-{cycle}. Secara default tidak menambah hitungan hari kerja fisik minggu berjalan sehingga dapat menggeser penerbitan {tcCode}.',
      advice: 'Lampirkan Surat Keterangan Dokter (SKD) ke HR Site. Jika SOP site Anda tetap mengakui Sakit untuk TC, ubah countsAsWork: true di config.js.'
    },
    permit: {
      title: 'Override Manual: Izin Resmi ({code})',
      desc: 'Tanggal ini ditandai Izin secara manual pada Siklus ke-{cycle}. Akumulasi hari kerja minggu berjalan berkurang 1 hari.',
      advice: 'Pastikan formulir izin telah ditandatangani atasan langsung dan HR Site.'
    },
    duty: {
      title: 'Override Manual: Dinas Luar / Training ({code})',
      desc: 'Tanggal ini ditandai Dinas Luar / Training pada Siklus ke-{cycle}. Tetap dihitung sebagai hari kerja sah sehingga hak {tcCode} mingguan tetap aman.',
      advice: 'Simpan Surat Perintah Perjalanan Dinas (SPPD) untuk validasi absensi akhir bulan.'
    },
    alpha: {
      title: 'Override Manual: Mangkir / Alpha ({code})',
      desc: 'Tanggal ini ditandai Alpha pada Siklus ke-{cycle}. Syarat {minWork} hari kerja minggu berjalan tidak tercapai sehingga {tcCode} minggu ini tidak terbit.',
      advice: 'Kehadiran tanpa keterangan dapat memengaruhi evaluasi disiplin dan menggeser jadwal pulang 1 minggu.'
    },
    customOff: {
      title: 'Override Manual: OFF Tambahan / Tukar ({code})',
      desc: 'Tanggal ini ditandai OFF manual pada Siklus ke-{cycle}. Hari kerja minggu berjalan tidak bertambah pada tanggal ini.',
      advice: 'Jika merupakan tukar hari libur, pastikan persetujuan kepala departemen tercatat di absensi.'
    }
  },

  // 11. BLOK TANDA TANGAN (Otomatis sejajar 1 baris berapapun jumlahnya saat Print / PDF)
  signatures: [
    { title: 'Dibuat Oleh,', role: 'Karyawan' },
    { title: 'Diperiksa Oleh,', role: 'HR Site' },
    { title: 'Diketahui Oleh,', role: 'Atasan Langsung' },
    { title: 'Disetujui Oleh,', role: 'HR Manager' }
  ]
};


// Update versi KAN ke 3.0.0 agar sinkron
if (window.KAN_CONFIG && window.KAN_CONFIG.app) {
  window.KAN_CONFIG.app.version = '3.0.0';
}

window.BJL_CONFIG = {
  "app": {
    "title": "BJL Timesheet, Leave & Lumpsum Simulator",
    "subtitle": "Simulasi Roster Site BJL (X56/X63/X70), Pola 13:1/6:1/2:1, Cuti Periodik, Cuti Ekstra, TRV, CT & Lumpsum",
    "companyName": "PT Baja Jaya Lestari (BJL)",
    "siteLocation": "Smelter Site Kawasi (Pulau Obi)",
    "sopRef": "BJL-H-SOP-HRGA-005T (Rev.0)",
    "version": "3.0.0"
  },
  "codes": {
    "work": "X",
    "off": "OFF",
    "trvDepart": "TRV",
    "trvReturn": "TRV",
    "periodicLeave": "CP",
    "extraLeave": "CE",
    "annualLeave": "CT",
    "preStart": "",
    "nonDate": ""
  },
  "rosters": {
    "X56": {
      "code": "X56",
      "label": "X56 — SPT (Superintendent)",
      "roleHint": "SPT",
      "siteDays": 56,
      "periodicLeaveDays": 14,
      "extraLeaveDivisor": 4
    },
    "X63": {
      "code": "X63",
      "label": "X63 — SPV (Supervisor)",
      "roleHint": "SPV",
      "siteDays": 63,
      "periodicLeaveDays": 14,
      "extraLeaveDivisor": 4.5
    },
    "X70": {
      "code": "X70",
      "label": "X70 — Non-SPV & Non-SPT",
      "roleHint": "Selain SPV & SPT",
      "siteDays": 70,
      "periodicLeaveDays": 14,
      "extraLeaveDivisor": 5
    }
  },
  "workPatterns": {
    "13:1": {
      "label": "Pola 13:1 (13 Kerja, 1 OFF Site)",
      "workDays": 13,
      "offDays": 1
    },
    "6:1": {
      "label": "Pola 6:1 (6 Kerja, 1 OFF Site)",
      "workDays": 6,
      "offDays": 1
    },
    "2:1": {
      "label": "Pola 2:1 (2 Kerja, 1 OFF Site)",
      "workDays": 2,
      "offDays": 1
    }
  },
  "trvZones": {
    "halsel_malut": {
      "label": "POH Halsel Malut (TRV 0 — Tanpa Tiket Pesawat)",
      "shortLabel": "Halsel Malut",
      "trvDays": 0,
      "trvDepart": 0,
      "trvReturn": 0,
      "hasFlightTicket": false,
      "ticketLabel": "Non-Tiket Pesawat (Darat/Laut Lokal)"
    },
    "malut_non_halsel": {
      "label": "POH Malut Non-Halsel (TRV 1 — Tanpa Tiket Pesawat)",
      "shortLabel": "Malut Non-Halsel",
      "trvDays": 1,
      "trvDepart": 1,
      "trvReturn": 0,
      "hasFlightTicket": false,
      "ticketLabel": "Non-Tiket Pesawat (Laut/Ferry Ternate)"
    },
    "non_malut": {
      "label": "POH Non-Malut (TRV 2 — Dapat Tiket Pesawat)",
      "shortLabel": "Non-Malut (Pesawat)",
      "trvDays": 2,
      "trvDepart": 1,
      "trvReturn": 1,
      "hasFlightTicket": true,
      "ticketLabel": "Tiket Pesawat Perusahaan (PP)"
    }
  },
  "ctBrackets": [
    {
      "minYears": 0,
      "maxYears": 4,
      "days": 12,
      "label": "0 s/d < 4 tahun (12 hari)"
    },
    {
      "minYears": 4,
      "maxYears": 7,
      "days": 13,
      "label": ">= 4 s/d < 7 tahun (13 hari)"
    },
    {
      "minYears": 7,
      "maxYears": 10,
      "days": 14,
      "label": ">= 7 s/d < 10 tahun (14 hari)"
    },
    {
      "minYears": 10,
      "maxYears": 999,
      "days": 15,
      "label": ">= 10 tahun (15 hari)"
    }
  ],
  "grades": [
    "S1",
    "S2",
    "S3",
    "S4",
    "P1",
    "P2",
    "P3",
    "P4",
    "P5",
    "P6",
    "M1",
    "M2",
    "M3",
    "M4",
    "M5",
    "M6",
    "M7",
    "M8",
    "X1",
    "X2",
    "X3",
    "Y",
    "Z"
  ],
  "gradeToLumpsumGroup": {
    "X1": "G1",
    "X2": "G1",
    "X3": "G1",
    "P5": "G2",
    "M5": "G2",
    "M6": "G2",
    "M7": "G2",
    "S4": "G3",
    "P3": "G3",
    "P4": "G3",
    "M3": "G3",
    "M4": "G3",
    "S1": "G4",
    "S2": "G4",
    "S3": "G4",
    "P1": "G4",
    "P2": "G4",
    "M1": "G4",
    "M2": "G4",
    "P6": "CUSTOM_P6",
    "M8": "CUSTOM_M8",
    "Y": "CUSTOM_Y",
    "Z": "CUSTOM_Z"
  },
  "lumpsumGroups": {
    "G1": {
      "label": "X1, X2, X3",
      "isCustom": false
    },
    "G2": {
      "label": "P5, M5, M6, M7",
      "isCustom": false
    },
    "G3": {
      "label": "S4, P3, P4, M3, M4",
      "isCustom": false
    },
    "G4": {
      "label": "S1, S2, S3, P1, P2, M1, M2",
      "isCustom": false
    },
    "CUSTOM_P6": {
      "label": "Grade P6 (Input Mandiri)",
      "isCustom": true
    },
    "CUSTOM_M8": {
      "label": "Grade M8 (Input Mandiri)",
      "isCustom": true
    },
    "CUSTOM_Y": {
      "label": "Grade Y (Input Mandiri)",
      "isCustom": true
    },
    "CUSTOM_Z": {
      "label": "Grade Z (Input Mandiri)",
      "isCustom": true
    }
  },
  "pohCities": [
    {
      "name": "Kawasi",
      "region": "Maluku Utara (Halsel)",
      "zone": "halsel_malut",
      "depart": {
        "G1": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G2": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G3": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G4": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        }
      },
      "return": {
        "G1": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G2": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G3": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G4": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        }
      }
    },
    {
      "name": "Kawasi ( KTP Lingkar Obi )",
      "region": "Maluku Utara (Halsel)",
      "zone": "halsel_malut",
      "depart": {
        "G1": {
          "leg1": 0,
          "leg2": 150000,
          "total": 150000
        },
        "G2": {
          "leg1": 0,
          "leg2": 150000,
          "total": 150000
        },
        "G3": {
          "leg1": 0,
          "leg2": 150000,
          "total": 150000
        },
        "G4": {
          "leg1": 0,
          "leg2": 150000,
          "total": 150000
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 0,
          "total": 150000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 0,
          "total": 150000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 0,
          "total": 150000
        },
        "G4": {
          "leg1": 150000,
          "leg2": 0,
          "total": 150000
        }
      }
    },
    {
      "name": "Bacan",
      "region": "Maluku Utara (Halsel)",
      "zone": "halsel_malut",
      "depart": {
        "G1": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G2": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G3": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G4": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        }
      },
      "return": {
        "G1": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G2": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G3": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G4": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        }
      }
    },
    {
      "name": "Labuha",
      "region": "Maluku Utara (Halsel)",
      "zone": "halsel_malut",
      "depart": {
        "G1": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G2": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G3": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        },
        "G4": {
          "leg1": 0,
          "leg2": 30000,
          "total": 30000
        }
      },
      "return": {
        "G1": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G2": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G3": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        },
        "G4": {
          "leg1": 30000,
          "leg2": 0,
          "total": 30000
        }
      }
    },
    {
      "name": "Ternate",
      "region": "Maluku Utara (Non-Halsel)",
      "zone": "malut_non_halsel",
      "depart": {
        "G1": {
          "leg1": 0,
          "leg2": 545000,
          "total": 545000
        },
        "G2": {
          "leg1": 0,
          "leg2": 545000,
          "total": 545000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 0,
          "total": 585000
        },
        "G4": {
          "leg1": 0,
          "leg2": 545000,
          "total": 545000
        }
      },
      "return": {
        "G1": {
          "leg1": 590000,
          "leg2": 0,
          "total": 590000
        },
        "G2": {
          "leg1": 590000,
          "leg2": 0,
          "total": 590000
        },
        "G3": {
          "leg1": 0,
          "leg2": 635000,
          "total": 635000
        },
        "G4": {
          "leg1": 590000,
          "leg2": 0,
          "total": 590000
        }
      }
    },
    {
      "name": "Ambon",
      "region": "Maluku",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 137500,
          "total": 357500
        },
        "G2": {
          "leg1": 200000,
          "leg2": 137500,
          "total": 337500
        },
        "G3": {
          "leg1": 585000,
          "leg2": 137500,
          "total": 722500
        },
        "G4": {
          "leg1": 545000,
          "leg2": 137500,
          "total": 682500
        }
      },
      "return": {
        "G1": {
          "leg1": 137500,
          "leg2": 275000,
          "total": 412500
        },
        "G2": {
          "leg1": 137500,
          "leg2": 250000,
          "total": 387500
        },
        "G3": {
          "leg1": 137500,
          "leg2": 635000,
          "total": 772500
        },
        "G4": {
          "leg1": 137500,
          "leg2": 590000,
          "total": 727500
        }
      }
    },
    {
      "name": "Jakarta",
      "region": "Jawa",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 200000,
          "total": 420000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 200000,
          "total": 400000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 200000,
          "total": 785000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 200000,
          "total": 745000
        }
      },
      "return": {
        "G1": {
          "leg1": 200000,
          "leg2": 275000,
          "total": 475000
        },
        "G2": {
          "leg1": 250000,
          "leg2": 250000,
          "total": 500000
        },
        "G3": {
          "leg1": 200000,
          "leg2": 635000,
          "total": 835000
        },
        "G4": {
          "leg1": 200000,
          "leg2": 590000,
          "total": 790000
        }
      }
    },
    {
      "name": "Semarang",
      "region": "Jawa",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 125000,
          "total": 670000
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 125000,
          "leg2": 590000,
          "total": 715000
        }
      }
    },
    {
      "name": "Solo",
      "region": "Jawa",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 125000,
          "total": 670000
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 125000,
          "leg2": 590000,
          "total": 715000
        }
      }
    },
    {
      "name": "Yogyakarta",
      "region": "Jawa",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 150000,
          "total": 370000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 150000,
          "total": 350000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 150000,
          "total": 735000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 150000,
          "total": 695000
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 275000,
          "total": 425000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 250000,
          "total": 400000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 635000,
          "total": 785000
        },
        "G4": {
          "leg1": 150000,
          "leg2": 590000,
          "total": 740000
        }
      }
    },
    {
      "name": "Surabaya",
      "region": "Jawa",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 150000,
          "total": 370000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 150000,
          "total": 350000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 150000,
          "total": 735000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 150000,
          "total": 695000
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 275000,
          "total": 425000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 250000,
          "total": 400000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 635000,
          "total": 785000
        },
        "G4": {
          "leg1": 150000,
          "leg2": 590000,
          "total": 740000
        }
      }
    },
    {
      "name": "Manado",
      "region": "Sulawesi",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 100000,
          "total": 320000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 100000,
          "total": 300000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 100000,
          "total": 685000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 100000,
          "total": 645000
        }
      },
      "return": {
        "G1": {
          "leg1": 100000,
          "leg2": 275000,
          "total": 375000
        },
        "G2": {
          "leg1": 100000,
          "leg2": 250000,
          "total": 350000
        },
        "G3": {
          "leg1": 100000,
          "leg2": 635000,
          "total": 735000
        },
        "G4": {
          "leg1": 100000,
          "leg2": 590000,
          "total": 690000
        }
      }
    },
    {
      "name": "Makassar",
      "region": "Sulawesi",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 125000,
          "total": 670000
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 125000,
          "leg2": 590000,
          "total": 715000
        }
      }
    },
    {
      "name": "Balikpapan",
      "region": "Kalimantan",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 125000,
          "total": 670000
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 125000,
          "leg2": 590000,
          "total": 715000
        }
      }
    },
    {
      "name": "Samarinda",
      "region": "Kalimantan",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 200000,
          "total": 420000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 200000,
          "total": 400000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 200000,
          "total": 785000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 200000,
          "total": 745000
        }
      },
      "return": {
        "G1": {
          "leg1": 200000,
          "leg2": 275000,
          "total": 475000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 250000,
          "total": 450000
        },
        "G3": {
          "leg1": 200000,
          "leg2": 635000,
          "total": 835000
        },
        "G4": {
          "leg1": 200000,
          "leg2": 590000,
          "total": 790000
        }
      }
    },
    {
      "name": "Tarakan",
      "region": "Kalimantan",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 100000,
          "total": 320000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 100000,
          "total": 300000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 100000,
          "total": 685000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 100000,
          "total": 645000
        }
      },
      "return": {
        "G1": {
          "leg1": 100000,
          "leg2": 275000,
          "total": 375000
        },
        "G2": {
          "leg1": 100000,
          "leg2": 250000,
          "total": 350000
        },
        "G3": {
          "leg1": 100000,
          "leg2": 635000,
          "total": 735000
        },
        "G4": {
          "leg1": 100000,
          "leg2": 590000,
          "total": 690000
        }
      }
    },
    {
      "name": "Banjarmasin",
      "region": "Kalimantan",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 125000,
          "total": 670000
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 125000,
          "leg2": 590000,
          "total": 715000
        }
      }
    },
    {
      "name": "Palangkaraya",
      "region": "Kalimantan",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 100000,
          "total": 320000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 100000,
          "total": 300000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 100000,
          "total": 685000
        },
        "G4": {
          "leg1": 545000,
          "leg2": 100000,
          "total": 645000
        }
      },
      "return": {
        "G1": {
          "leg1": 100000,
          "leg2": 275000,
          "total": 375000
        },
        "G2": {
          "leg1": 100000,
          "leg2": 250000,
          "total": 350000
        },
        "G3": {
          "leg1": 100000,
          "leg2": 635000,
          "total": 735000
        },
        "G4": {
          "leg1": 100000,
          "leg2": 590000,
          "total": 690000
        }
      }
    },
    {
      "name": "Medan",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 200000,
          "total": 420000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 200000,
          "total": 400000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 200000,
          "total": 785000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 200000,
          "leg2": 275000,
          "total": 475000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 250000,
          "total": 450000
        },
        "G3": {
          "leg1": 200000,
          "leg2": 635000,
          "total": 835000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Batam",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 150000,
          "total": 370000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 150000,
          "total": 350000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 150000,
          "total": 735000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 275000,
          "total": 425000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 250000,
          "total": 400000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 635000,
          "total": 785000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Pekanbaru",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 100000,
          "total": 320000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 100000,
          "total": 300000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 100000,
          "total": 685000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 100000,
          "leg2": 275000,
          "total": 375000
        },
        "G2": {
          "leg1": 100000,
          "leg2": 250000,
          "total": 350000
        },
        "G3": {
          "leg1": 100000,
          "leg2": 635000,
          "total": 735000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Palembang",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 150000,
          "total": 370000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 150000,
          "total": 350000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 150000,
          "total": 735000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 275000,
          "total": 425000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 250000,
          "total": 400000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 635000,
          "total": 785000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Jambi",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 125000,
          "total": 345000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 125000,
          "total": 325000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 125000,
          "total": 710000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 125000,
          "leg2": 275000,
          "total": 400000
        },
        "G2": {
          "leg1": 125000,
          "leg2": 250000,
          "total": 375000
        },
        "G3": {
          "leg1": 125000,
          "leg2": 635000,
          "total": 760000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Padang",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 150000,
          "total": 370000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 150000,
          "total": 350000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 150000,
          "total": 735000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 150000,
          "leg2": 275000,
          "total": 425000
        },
        "G2": {
          "leg1": 150000,
          "leg2": 250000,
          "total": 400000
        },
        "G3": {
          "leg1": 150000,
          "leg2": 635000,
          "total": 785000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Lampung",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 175000,
          "total": 395000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 175000,
          "total": 375000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 175000,
          "total": 760000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 175000,
          "leg2": 275000,
          "total": 450000
        },
        "G2": {
          "leg1": 175000,
          "leg2": 250000,
          "total": 425000
        },
        "G3": {
          "leg1": 175000,
          "leg2": 635000,
          "total": 810000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    },
    {
      "name": "Bangka/Belitung",
      "region": "Sumatra",
      "zone": "non_malut",
      "depart": {
        "G1": {
          "leg1": 220000,
          "leg2": 100000,
          "total": 320000
        },
        "G2": {
          "leg1": 200000,
          "leg2": 100000,
          "total": 300000
        },
        "G3": {
          "leg1": 585000,
          "leg2": 100000,
          "total": 685000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      },
      "return": {
        "G1": {
          "leg1": 100000,
          "leg2": 275000,
          "total": 375000
        },
        "G2": {
          "leg1": 100000,
          "leg2": 250000,
          "total": 350000
        },
        "G3": {
          "leg1": 100000,
          "leg2": 635000,
          "total": 735000
        },
        "G4": {
          "leg1": 0,
          "leg2": 0,
          "total": 0
        }
      }
    }
  ],
  "pohSopRules": {
    "minServiceYearsForChange": 2,
    "changeIntervalYears": 2,
    "minPerformance": "Minimal nilai kinerja 'C' dan 'C' selama 2 semester terakhir & bebas SP aktif",
    "effectiveRule": "Berlaku mulai tanggal 1 bulan berikutnya setelah disetujui (diterapkan pada cuti periodik berikutnya)",
    "restrictedGrades": {
      "S1": [
        "Kawasi",
        "Kawasi ( KTP Lingkar Obi )",
        "Bacan",
        "Labuha",
        "Ternate",
        "Makassar",
        "Manado",
        "Ambon"
      ],
      "P1": [
        "Kawasi",
        "Kawasi ( KTP Lingkar Obi )",
        "Bacan",
        "Labuha",
        "Ternate",
        "Makassar",
        "Manado",
        "Ambon",
        "Balikpapan",
        "Surabaya"
      ],
      "S2": [
        "Kawasi",
        "Kawasi ( KTP Lingkar Obi )",
        "Bacan",
        "Labuha",
        "Ternate"
      ]
    }
  },
  "lumpsumTerms": [
    "1. Perhatikan untuk pemberian uang lumpsum hanya diberikan untuk 1 (satu) kali perjalanan.",
    "2. Untuk pemberian cash hanya diberikan pada saat mau cuti, sedangkan untuk kembali setelah dicuti akan diberikan setiba di lokasi site.",
    "3. Maksimal pemberian uang cuti oleh Finance Site akan diberikan terakhir H+7 setelah SKC diverifikasi oleh Dept Head dan HR.",
    "4. Highlight Hijau untuk BERANGKAT CUTI (Site → POH) dan Highlight Oranye untuk KEMBALI CUTI (POH → Site)."
  ],
  "overrideTypes": {
    "sick": {
      "code": "S",
      "label": "Sakit (Surat Dokter)",
      "countsAsSite": false
    },
    "permit": {
      "code": "I",
      "label": "Izin Resmi",
      "countsAsSite": false
    },
    "duty": {
      "code": "DL",
      "label": "Dinas Luar / Training",
      "countsAsSite": true
    },
    "alpha": {
      "code": "A",
      "label": "Mangkir / Alpha",
      "countsAsSite": false
    },
    "customOff": {
      "code": "OFF*",
      "label": "OFF Manual / Tukar",
      "countsAsSite": true
    }
  },
  "defaults": {
    "employeeName": "Ahmad Fauzi",
    "employeeNik": "BJL-2024-0318",
    "employeeDepartment": "Smelter Operations",
    "employeeRole": "Production Supervisor",
    "employeeGrade": "M3",
    "rosterCode": "X63",
    "workPattern": "13:1",
    "siteCountMode": "calendar_site",
    "trv1Placement": "depart",
    "extraLeaveRounding": "round",
    "pohCity": "Surabaya",
    "joinDate": "2022-03-01",
    "startDate": "2026-01-05",
    "viewMode": "full_year",
    "showHolidays": true
  },
  "colors": {
    "work": {
      "bg": "#FFFFFF",
      "text": "#1E293B",
      "border": "#CBD5E1",
      "label": "Hari Kerja On-Site (X)"
    },
    "offSite": {
      "bg": "#E0F2FE",
      "text": "#0369A1",
      "border": "#7DD3FC",
      "label": "OFF Pola Kerja di Site (OFF)"
    },
    "extendWork": {
      "bg": "#FEF3C7",
      "text": "#92400E",
      "border": "#FCD34D",
      "label": "Kerja Extend / Tunda Cuti (Hitung CE)"
    },
    "trvDepart": {
      "bg": "#D1FAE5",
      "text": "#065F46",
      "border": "#34D399",
      "label": "Travel Berangkat (TRV — Site → POH)"
    },
    "periodicLeave": {
      "bg": "#DCFCE7",
      "text": "#166534",
      "border": "#86EFAC",
      "label": "Cuti Periodik (CP)"
    },
    "extraLeave": {
      "bg": "#FEF9C3",
      "text": "#854D0E",
      "border": "#FACC15",
      "label": "Cuti Ekstra (CE)"
    },
    "annualLeave": {
      "bg": "#F3E8FF",
      "text": "#6B21A8",
      "border": "#C084FC",
      "label": "Cuti Tahunan (CT)"
    },
    "trvReturn": {
      "bg": "#FFEDD5",
      "text": "#9A3412",
      "border": "#FB923C",
      "label": "Travel Kembali (TRV — POH → Site)"
    },
    "preStart": {
      "bg": "#F8FAFC",
      "text": "#94A3B8",
      "border": "#E2E8F0",
      "label": "Pra-Mulai Roster"
    },
    "nonDate": {
      "bg": "#CBD5E1",
      "text": "#64748B",
      "border": "#CBD5E1",
      "label": "Tanggal Non-Kalender"
    },
    "sick": {
      "bg": "#FFE4E6",
      "text": "#9F1239",
      "border": "#FDA4AF",
      "label": "Override: Sakit (S)"
    },
    "permit": {
      "bg": "#E0E7FF",
      "text": "#3730A3",
      "border": "#A5B4FC",
      "label": "Override: Izin (I)"
    },
    "duty": {
      "bg": "#CFFAFE",
      "text": "#155E75",
      "border": "#67E8F9",
      "label": "Override: Dinas Luar (DL)"
    },
    "alpha": {
      "bg": "#FECACA",
      "text": "#991B1B",
      "border": "#F87171",
      "label": "Override: Mangkir / Alpha (A)"
    },
    "customOff": {
      "bg": "#E0F2FE",
      "text": "#0C4A6E",
      "border": "#38BDF8",
      "label": "Override: OFF Manual (OFF*)"
    }
  },
  "signatures": [
    {
      "title": "Diajukan Oleh,",
      "role": "Pekerja",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Department Head",
      "name": ""
    },
    {
      "title": "Diverifikasi Oleh,",
      "role": "HR & GA Site / Kantor Perwakilan",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Head of HR & GA",
      "name": ""
    }
  ],
  "signaturePresets": [
    {
      "title": "Diajukan Oleh,",
      "role": "Pekerja",
      "name": ""
    },
    {
      "title": "Diketahui Oleh,",
      "role": "Atasan Langsung",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Department Head",
      "name": ""
    },
    {
      "title": "Diverifikasi Oleh,",
      "role": "HR & GA Site / Kantor Perwakilan",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Head of HR & GA",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Executive Deputy Site GM",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "Site General Manager",
      "name": ""
    },
    {
      "title": "Disetujui Oleh,",
      "role": "JV Deputy General Manager",
      "name": ""
    }
  ]
};

// Bagikan kalender libur nasional & label tanggal Indonesia dari KAN_CONFIG ke BJL_CONFIG
window.BJL_CONFIG.holidays = window.KAN_CONFIG.holidays;
window.BJL_CONFIG.labels = window.KAN_CONFIG.labels;

window.APP_CONFIG = {
  version: '3.0.0',
  appName: 'Timesheet & Leave Simulator Suite',
  auth: {
    enabled: true,
    sessionKey: 'ts_sim_auth_session_v3',
    users: [
      {
        username: 'irwans',
        password: '123456',
        displayName: 'Irwan S.',
        role: 'Super Admin',
        companies: ['BJL', 'KAN'],
        defaultCompany: 'BJL'
      },
      {
        username: 'userkan',
        password: '123456',
        displayName: 'User KAN',
        role: 'HR / User KAN',
        companies: ['KAN'],
        defaultCompany: 'KAN'
      },
      {
        username: 'userbjl',
        password: '123456',
        displayName: 'User BJL',
        role: 'HR / User BJL',
        companies: ['BJL'],
        defaultCompany: 'BJL'
      }
    ]
  },
  companies: {
    KAN: {
      code: 'KAN',
      shortName: 'PT KAN',
      fullName: 'PT Kalimantan Agro Nusantara (KAN)',
      badgeColor: '#0F766E'
    },
    BJL: {
      code: 'BJL',
      shortName: 'PT BJL',
      fullName: 'PT Baja Jaya Lestari (BJL)',
      badgeColor: '#1E3A5F'
    }
  }
};
