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
