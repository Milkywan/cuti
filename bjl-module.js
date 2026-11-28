/**
 * ============================================================================
 * PT BAJA JAYA LESTARI (BJL) — TIMESHEET, LEAVE & LUMPSUM ENGINE (bjl-module.js)
 * ============================================================================
 * Fitur Lengkap BJL v3.1:
 * - Siklus Roster X56 (SPT, pembagi CE 4), X63 (SPV, pembagi CE 4,5), X70 (Lainnya, pembagi CE 5) — basis Hari Kalender di Site
 * - Pola Sistem Hari Kerja: 13:1, 6:1, dan 2:1 (2 Hari Kerja : 1 Hari OFF) + Tanggal Acuan Hari OFF Pertama per karyawan
 * - Extend Kerja On-Site (batas SOP 42 hr, simulasi s/d 90 hr dengan warna peringatan merah hari ke-43 dst.)
 * - Tabungan Hak Cuti Ekstra (earnedCE) & Stepper Ambil CE bebas pilih periode selama saldo mencukupi
 * - Hari Travel (TRV): TRV 0 (0 hr), TRV 1 & TRV 2 otomatis 1 hr berangkat + 1 hr pulang (2 hr PP)
 * - Bracket Cuti Tahunan (CT) Otomatis Berdasarkan Masa Kerja (12–15 hr)
 * - Master Uang Lumpsum 26 Kota dari Excel (Berangkat Hijau / Kembali Oranye) + Slot Mandiri P6, M8, Y, Z
 * - Validasi SOP Penetapan & Perubahan POH (BJL-H-SOP-HRGA-005T)
 * - Kunci Periode (History Lock), Override Manual (S X-lanjut / IS reset-X1 / I / DL / A / OFF*), Libur Nasional 2025-2027
 * - Blok Tanda Tangan PDF Dinamis & Export Excel (.xlsx) 4 Sheet + Print PDF A4 Landscape
 * ============================================================================
 */

(function () {
  'use strict';

  const CFG = window.BJL_CONFIG;
  if (!CFG) return;

  const STORAGE_KEY = 'bjl_timesheet_state_v3';
  const SCENARIOS_KEY = 'bjl_timesheet_scenarios_v3';
  const CUSTOM_LUMPSUM_KEY = 'bjl_custom_lumpsum_v3';
  const SIG_STORAGE_KEY = 'ts_sim_signatures_BJL_v3';
  const MAX_EXTEND_SOP = Number(CFG.maxExtendSopDays) || 42;
  const MAX_EXTEND_INPUT = Number(CFG.maxExtendInputDays) || 90;

  // ---------- DEFAULT STATE ----------
  function createDefaultState() {
    const d = CFG.defaults;
    const initBracket = calcCtBracket(parseISODate(d.joinDate), parseISODate(d.startDate));
    return {
      employeeName: d.employeeName,
      employeeNik: d.employeeNik,
      employeeDepartment: d.employeeDepartment,
      employeeRole: d.employeeRole,
      employeeGrade: d.employeeGrade,
      rosterCode: d.rosterCode,
      workPattern: d.workPattern,
      firstOffRefDate: d.firstOffRefDate || '',
      extraLeaveRounding: d.extraLeaveRounding, // 'round' | 'floor' | 'ceil'
      pohCity: d.pohCity,
      joinDate: d.joinDate,
      startDate: d.startDate,
      autoCtFromBracket: true,
      annualLeaveBalance: initBracket.days,
      defaultPeriodicDays: 14,
      viewMode: d.viewMode,
      showHolidays: d.showHolidays !== false,
      cycleExtends: {},      // { [cycle]: extraSiteDays }
      ceAllocations: {},     // { [cycle]: ceDaysTaken }
      cyclePeriodicDays: {}, // { [cycle]: customCPDays }
      ctAllocations: {},     // { [cycle]: ctDays }
      lockedCycles: {},      // { [cycle]: { extendDays, ceDays, cpDays, ctDays, rosterCode, workPattern, pohCity } }
      manualOverrides: {},   // { [iso]: { type, note } }
      selectedDateKey: null
    };
  }

  const state = createDefaultState();
  let lastSim = null;

  // ---------- UTILITIES ----------
  function parseISODate(str) {
    if (!str || typeof str !== 'string') return null;
    const p = str.split('-').map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    const d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2] ? d : null;
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function diffCalendarDays(dateA, dateB) {
    const utcA = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
    const utcB = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
    return Math.round((utcA - utcB) / 86400000);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function clampInt(val, min, max, fallback) {
    const n = Math.floor(Number(val));
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDateID(d, shortMonth) {
    if (!d) return '-';
    const months = shortMonth ? CFG.labels.monthNamesShort : CFG.labels.monthNamesFull;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateFullID(d) {
    if (!d) return '-';
    return `${CFG.labels.dayNamesFull[d.getDay()]}, ${formatDateID(d, false)}`;
  }

  function formatRp(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return 'Belum Diisi';
    return 'Rp ' + Math.round(Number(n)).toLocaleString('id-ID');
  }

  function getHoliday(iso) {
    return (CFG.holidays && CFG.holidays[iso]) ? CFG.holidays[iso] : null;
  }

  function getRosterSpec(code) {
    return CFG.rosters[code || state.rosterCode] || CFG.rosters.X63;
  }

  function getPatternSpec(pat) {
    return CFG.workPatterns[pat || state.workPattern] || CFG.workPatterns['13:1'];
  }

  function getCityObj(cityName) {
    return CFG.pohCities.find(c => c.name === (cityName || state.pohCity)) || CFG.pohCities[0];
  }

  function getTrvZoneSpec(cityObj) {
    const z = cityObj ? cityObj.zone : 'non_malut';
    return CFG.trvZones[z] || CFG.trvZones.non_malut;
  }

  function calcServiceYears(joinDateObj, refDateObj) {
    if (!joinDateObj || !refDateObj) return { years: 0, months: 0, totalYears: 0 };
    if (refDateObj < joinDateObj) return { years: 0, months: 0, totalYears: 0 };
    let years = refDateObj.getFullYear() - joinDateObj.getFullYear();
    let months = refDateObj.getMonth() - joinDateObj.getMonth();
    if (refDateObj.getDate() < joinDateObj.getDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    years = Math.max(0, years);
    return { years, months, totalYears: years + (months / 12) };
  }

  function calcCtBracket(joinDateObj, refDateObj) {
    const svc = calcServiceYears(joinDateObj, refDateObj);
    const y = svc.totalYears;
    for (const b of CFG.ctBrackets) {
      if (y >= b.minYears && y < b.maxYears) {
        return { ...b, ...svc };
      }
    }
    const last = CFG.ctBrackets[CFG.ctBrackets.length - 1];
    return { ...last, ...svc };
  }

  function calcExtraLeaveDays(extendDays, divisor, mode) {
    if (!extendDays || extendDays <= 0 || !divisor) return { raw: 0, days: 0 };
    const raw = extendDays / divisor;
    let days = Math.round(raw);
    if (mode === 'floor') days = Math.floor(raw);
    else if (mode === 'ceil') days = Math.ceil(raw);
    return { raw, days };
  }

  // ---------- CUSTOM LUMPSUM STORAGE (for P6, M8, Y, Z & overrides) ----------
  function getCustomLumpsumStore() {
    try {
      const raw = localStorage.getItem(CUSTOM_LUMPSUM_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveCustomLumpsumStore(store) {
    try {
      localStorage.setItem(CUSTOM_LUMPSUM_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function getLumpsumForGradeAndCity(grade, cityName) {
    const groupKey = CFG.gradeToLumpsumGroup[grade] || 'G4';
    const groupMeta = CFG.lumpsumGroups[groupKey] || { label: grade, isCustom: false };
    const cityObj = getCityObj(cityName);
    const customStore = getCustomLumpsumStore();

    const customCity = customStore[groupKey] && customStore[groupKey][cityObj.name];
    if (customCity) {
      const d1 = Number(customCity.departLeg1) || 0;
      const d2 = Number(customCity.departLeg2) || 0;
      const r1 = Number(customCity.returnLeg1) || 0;
      const r2 = Number(customCity.returnLeg2) || 0;
      return {
        groupKey,
        groupLabel: groupMeta.label,
        isConfigured: true,
        isCustomValue: true,
        depart: { leg1: d1, leg2: d2, total: d1 + d2 },
        return: { leg1: r1, leg2: r2, total: r1 + r2 },
        grandTotal: d1 + d2 + r1 + r2
      };
    }

    if (groupMeta.isCustom) {
      return {
        groupKey,
        groupLabel: groupMeta.label,
        isConfigured: false,
        isCustomValue: true,
        depart: { leg1: null, leg2: null, total: null },
        return: { leg1: null, leg2: null, total: null },
        grandTotal: null
      };
    }

    const dep = cityObj.depart[groupKey] || { leg1: 0, leg2: 0, total: 0 };
    const ret = cityObj.return[groupKey] || { leg1: 0, leg2: 0, total: 0 };
    return {
      groupKey,
      groupLabel: groupMeta.label,
      isConfigured: true,
      isCustomValue: false,
      depart: dep,
      return: ret,
      grandTotal: (dep.total || 0) + (ret.total || 0)
    };
  }

  function checkPohSopWarning(grade, cityName) {
    const r = CFG.pohSopRules.restrictedGrades || {};
    if (r[grade] && !r[grade].includes(cityName)) {
      return `Perhatian SOP BJL-H-SOP-HRGA-005T (6.1.2.6): Grade ${grade} memiliki batas POH standar (${r[grade].join(', ')}). Pengecualian wajib persetujuan Head of HR & GA.`;
    }
    const lump = getLumpsumForGradeAndCity(grade, cityName);
    if (lump.isConfigured && lump.grandTotal === 0) {
      return `Catatan Tabel Excel Lumpsum: Kombinasi Grade ${grade} (${lump.groupLabel}) dengan POH ${cityName} bernilai Rp 0 (tidak termasuk dalam jatah lumpsum grup ini).`;
    }
    return '';
  }

  // ---------- CORE BJL SIMULATION ENGINE ----------
  function runSimulation() {
    const startDate = parseISODate(state.startDate) || parseISODate(CFG.defaults.startDate) || new Date();
    const joinDate = parseISODate(state.joinDate);
    const firstOffRefDate = parseISODate(state.firstOffRefDate);
    const ctBracket = calcCtBracket(joinDate, startDate);
    if (state.autoCtFromBracket) {
      state.annualLeaveBalance = ctBracket.days;
    }

    // 12-month display window
    const months = [];
    if (state.viewMode === 'rolling_12') {
      for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else {
      const y = startDate.getFullYear();
      for (let m = 0; m < 12; m++) months.push({ year: y, month: m });
    }

    const windowStart = new Date(months[0].year, months[0].month, 1);
    const lastM = months[months.length - 1];
    const windowEnd = new Date(lastM.year, lastM.month, daysInMonth(lastM.year, lastM.month));
    const simEnd = addDays(windowEnd, 140);

    const dayMap = new Map();
    const cycles = [];

    let curDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    let cycleNum = 1;
    let remainingCT = Math.max(0, clampInt(state.annualLeaveBalance, 0, 60, ctBracket.days));
    let ceBalance = 0;

    while (curDate <= simEnd && cycleNum <= 10) {
      const locked = state.lockedCycles[cycleNum] || null;
      const rosterCode = locked ? locked.rosterCode : state.rosterCode;
      const workPattern = locked ? locked.workPattern : state.workPattern;
      const pohCity = locked ? locked.pohCity : state.pohCity;
      const extendDays = clampInt(locked ? locked.extendDays : (state.cycleExtends[cycleNum] || 0), 0, MAX_EXTEND_INPUT, 0);
      const cpDays = clampInt(locked ? locked.cpDays : (state.cyclePeriodicDays[cycleNum] ?? state.defaultPeriodicDays), 1, 30, 14);
      const reqCT = clampInt(locked ? locked.ctDays : (state.ctAllocations[cycleNum] || 0), 0, 30, 0);
      const actualCT = Math.min(reqCT, remainingCT);
      remainingCT -= actualCT;

      const rosterSpec = getRosterSpec(rosterCode);
      const patSpec = getPatternSpec(workPattern);
      const cityObj = getCityObj(pohCity);
      const trvSpec = getTrvZoneSpec(cityObj);
      const ceCalc = calcExtraLeaveDays(extendDays, rosterSpec.extraLeaveDivisor, state.extraLeaveRounding);

      // Tabungan Hak CE (earnedCE masuk saldo, pengambilan via stepper Ambil CE)
      const earnedCE = ceCalc.days;
      const ceBalanceBefore = ceBalance;
      const ceAvailable = ceBalanceBefore + earnedCE;
      const reqCE = clampInt(locked ? (locked.ceDays ?? 0) : (state.ceAllocations[cycleNum] || 0), 0, 90, 0);
      const actualCE = Math.min(reqCE, ceAvailable);
      ceBalance = ceAvailable - actualCE;

      // SOP Extend 42 hari check
      const overSopExtendDays = Math.max(0, extendDays - MAX_EXTEND_SOP);
      const isExtendOverSop = overSopExtendDays > 0;

      // Travel split (TRV 1 & TRV 2 otomatis 1 berangkat + 1 kembali PP)
      const trvDepartDays = trvSpec.trvDepart;
      const trvReturnDays = trvSpec.trvReturn;

      const siteStart = new Date(curDate.getTime());
      const baseTarget = rosterSpec.siteDays;
      const totalSiteTarget = baseTarget + extendDays;

      let countedDays = 0;
      let physicalWorkDays = 0;
      let siteOffDays = 0;
      let resetCount = 0;
      let patternStep = 0; // dipakai jika firstOffRefDate tidak diisi
      const cycleLen = patSpec.workDays + patSpec.offDays;

      // Phase 1: On-Site Period (selalu menghitung Hari Kalender di Site: calendar_site)
      while (countedDays < totalSiteTarget && curDate <= simEnd) {
        const iso = toISODate(curDate);
        const ov = state.manualOverrides[iso] || null;
        const isExtend = countedDays >= baseTarget;

        if (ov && CFG.overrideTypes[ov.type]) {
          const ovSpec = CFG.overrideTypes[ov.type];
          if (ovSpec.resetsRosterX) {
            // Ijin Sakit Tanpa Surat Dokter (IS): hitungan X terputus & reset ke X1 pada hari aktif berikutnya
            const prevCount = countedDays;
            countedDays = 0;
            resetCount += 1;
            if (!firstOffRefDate) patternStep = 0;
            dayMap.set(iso, {
              date: new Date(curDate.getTime()),
              iso,
              cycle: cycleNum,
              kind: ov.type,
              code: ovSpec.code,
              isOverride: true,
              resetsRosterX: true,
              overrideNote: ov.note || '',
              holiday: getHoliday(iso),
              detail: `Override ${ovSpec.label} — Hitungan X terputus (reset dari hari ke-${prevCount} → mulai ulang X1 pada hari aktif berikutnya)${ov.note ? ' • ' + ov.note : ''}`
            });
          } else if (ovSpec.countsAsSite) {
            // Termasuk Sakit Surat Dokter (S), Dinas Luar (DL), OFF Manual (OFF*) -> hitungan X tetap lanjut
            countedDays += 1;
            const nextDetail = `Override ${ovSpec.label} — Hitungan roster lanjut (Hari ke-${countedDays}/${totalSiteTarget})${ov.note ? ' • ' + ov.note : ''}`;
            dayMap.set(iso, {
              date: new Date(curDate.getTime()),
              iso,
              cycle: cycleNum,
              kind: ov.type,
              code: ovSpec.code,
              isOverride: true,
              overrideNote: ov.note || '',
              holiday: getHoliday(iso),
              detail: nextDetail
            });
            patternStep = (patternStep + 1) % cycleLen;
          } else {
            // Izin Resmi (I), Alpha (A): hitungan X tertahan
            dayMap.set(iso, {
              date: new Date(curDate.getTime()),
              iso,
              cycle: cycleNum,
              kind: ov.type,
              code: ovSpec.code,
              isOverride: true,
              overrideNote: ov.note || '',
              holiday: getHoliday(iso),
              detail: `Override ${ovSpec.label} — Hitungan roster tertahan di ke-${countedDays}/${totalSiteTarget}${ov.note ? ' • ' + ov.note : ''}`
            });
          }
        } else {
          // Tentukan hari OFF berdasarkan Tanggal Acuan Hari OFF Pertama (jika diisi) atau step dari startDate
          let isPatternOff = false;
          if (firstOffRefDate) {
            const diff = diffCalendarDays(curDate, firstOffRefDate);
            const mod = ((diff % cycleLen) + cycleLen) % cycleLen;
            isPatternOff = mod < patSpec.offDays;
          } else {
            isPatternOff = patternStep >= patSpec.workDays;
          }

          if (isPatternOff) {
            siteOffDays += 1;
            countedDays += 1;
            const extIdx = countedDays - baseTarget;
            const isOverSopDay = isExtend && extIdx > MAX_EXTEND_SOP;
            dayMap.set(iso, {
              date: new Date(curDate.getTime()),
              iso,
              cycle: cycleNum,
              kind: 'offSite',
              code: CFG.codes.off,
              holiday: getHoliday(iso),
              detail: `OFF Pola ${workPattern} di Site (Hari siklus ke-${countedDays}/${totalSiteTarget}${isOverSopDay ? ' • ⚠️ Extend >' + MAX_EXTEND_SOP + ' hr SOP' : ''})`
            });
          } else {
            physicalWorkDays += 1;
            countedDays += 1;
            const dayNumLabel = countedDays;
            const extDayNum = countedDays - baseTarget;
            const isOverSopDay = isExtend && extDayNum > MAX_EXTEND_SOP;
            const cellKind = isExtend ? (isOverSopDay ? 'extendOverSop' : 'extendWork') : 'work';
            dayMap.set(iso, {
              date: new Date(curDate.getTime()),
              iso,
              cycle: cycleNum,
              kind: cellKind,
              code: `${CFG.codes.work}${dayNumLabel}`,
              holiday: getHoliday(iso),
              detail: isExtend
                ? (isOverSopDay
                    ? `⚠️ Extend On-Site hari ke-${extDayNum} (Melebihi Batas SOP ${MAX_EXTEND_SOP} hr! Akumulasi Hak CE ÷ ${rosterSpec.extraLeaveDivisor})`
                    : `Extend On-Site hari ke-${extDayNum}/${extendDays} (Akumulasi Hak CE ÷ ${rosterSpec.extraLeaveDivisor})`)
                : `Hari Kerja On-Site (${rosterCode}, Pola ${workPattern}) ke-${dayNumLabel}`
            });
          }
          patternStep = (patternStep + 1) % cycleLen;
        }
        curDate = addDays(curDate, 1);
      }

      const siteEnd = addDays(curDate, -1);
      const departDate = new Date(curDate.getTime());
      const holidaysInLeave = [];

      const pushLeaveDay = (kind, code, detail) => {
        if (curDate > simEnd) return;
        const iso = toISODate(curDate);
        const hol = getHoliday(iso);
        if (hol) holidaysInLeave.push({ iso, ...hol });
        dayMap.set(iso, {
          date: new Date(curDate.getTime()),
          iso,
          cycle: cycleNum,
          kind,
          code,
          holiday: hol,
          detail
        });
        curDate = addDays(curDate, 1);
      };

      // Phase 2: TRV Depart
      for (let i = 1; i <= trvDepartDays; i++) {
        pushLeaveDay('trvDepart', CFG.codes.trvDepart, `Perjalanan Berangkat Site → ${cityObj.name} (${trvSpec.trvCode || 'TRV'} — ${trvSpec.shortLabel})`);
      }
      // Phase 3: Cuti Periodik (CP)
      for (let i = 1; i <= cpDays; i++) {
        pushLeaveDay('periodicLeave', CFG.codes.periodicLeave, `Cuti Periodik (${rosterCode}) hari ke-${i} dari ${cpDays}`);
      }
      // Phase 4: Cuti Ekstra (CE) — sesuai pengambilan stepper Ambil CE
      for (let i = 1; i <= actualCE; i++) {
        pushLeaveDay('extraLeave', CFG.codes.extraLeave, `Pemakaian Cuti Ekstra (CE) hari ke-${i} dari ${actualCE} (Sisa Saldo CE setelah periode ini: ${ceBalance} hr)`);
      }
      // Phase 5: Cuti Tahunan (CT)
      for (let i = 1; i <= actualCT; i++) {
        pushLeaveDay('annualLeave', CFG.codes.annualLeave, `Cuti Tahunan (CT) hari ke-${i} dari ${actualCT}`);
      }
      // Phase 6: TRV Return
      for (let i = 1; i <= trvReturnDays; i++) {
        pushLeaveDay('trvReturn', CFG.codes.trvReturn, `Perjalanan Kembali ${cityObj.name} → Site (${trvSpec.trvCode || 'TRV'} — ${trvSpec.shortLabel})`);
      }

      const leaveEndDate = addDays(curDate, -1);
      const returnSiteDate = new Date(curDate.getTime());
      const totalAwayDays = trvDepartDays + cpDays + actualCE + actualCT + trvReturnDays;
      const lumpsum = getLumpsumForGradeAndCity(state.employeeGrade, cityObj.name);

      if (departDate <= windowEnd || siteStart <= windowEnd) {
        cycles.push({
          cycle: cycleNum,
          isLocked: !!locked,
          rosterCode,
          rosterDivisor: rosterSpec.extraLeaveDivisor,
          workPattern,
          pohCity: cityObj.name,
          pohRegion: cityObj.region,
          trvZone: trvSpec,
          siteStart,
          siteEnd,
          baseTarget,
          extendDays,
          overSopExtendDays,
          isExtendOverSop,
          resetCount,
          physicalWorkDays,
          siteOffDays,
          departDate,
          leaveEndDate,
          returnSiteDate,
          trvDepartDays,
          trvReturnDays,
          trvTotalDays: trvDepartDays + trvReturnDays,
          cpDays,
          ceRaw: ceCalc.raw,
          earnedCE,
          ceBalanceBefore,
          ceAvailable,
          ceDays: actualCE,
          ceBalanceAfter: ceBalance,
          ctDays: actualCT,
          totalAwayDays,
          lumpsum,
          holidaysInLeave,
          departsInWindow: departDate >= windowStart && departDate <= windowEnd
        });
      }

      cycleNum += 1;
    }

    // Build 12 x 31 matrix
    const totals = {
      work: 0, extendWork: 0, extendOverSop: 0, offSite: 0, trv: 0, cp: 0, ce: 0, ct: 0,
      overrides: 0, holidaysOnWork: 0
    };

    const matrixMonths = months.map(({ year, month }) => {
      const dim = daysInMonth(year, month);
      const stats = { work: 0, off: 0, trv: 0, cp: 0, ce: 0, ct: 0 };
      const cells = [];

      for (let d = 1; d <= 31; d++) {
        if (d > dim) {
          cells.push({ kind: 'nonDate', code: '', iso: null, day: d });
          continue;
        }
        const dt = new Date(year, month, d);
        const iso = toISODate(dt);
        const hol = getHoliday(iso);
        if (dt < startDate) {
          cells.push({ kind: 'preStart', code: '', iso, date: dt, day: d, holiday: hol, detail: 'Sebelum tanggal mulai roster' });
          continue;
        }
        const entry = dayMap.get(iso) || { kind: 'preStart', code: '', iso, date: dt, holiday: hol, detail: '-' };
        cells.push({ ...entry, day: d });

        if (entry.kind === 'work') { stats.work++; totals.work++; if (hol) totals.holidaysOnWork++; }
        else if (entry.kind === 'extendWork') { stats.work++; totals.work++; totals.extendWork++; if (hol) totals.holidaysOnWork++; }
        else if (entry.kind === 'extendOverSop') { stats.work++; totals.work++; totals.extendWork++; totals.extendOverSop++; if (hol) totals.holidaysOnWork++; }
        else if (entry.kind === 'offSite') { stats.off++; totals.offSite++; }
        else if (entry.kind === 'trvDepart' || entry.kind === 'trvReturn') { stats.trv++; totals.trv++; }
        else if (entry.kind === 'periodicLeave') { stats.cp++; totals.cp++; }
        else if (entry.kind === 'extraLeave') { stats.ce++; totals.ce++; }
        else if (entry.kind === 'annualLeave') { stats.ct++; totals.ct++; }
        else if (entry.isOverride) { totals.overrides++; }
      }

      return {
        year,
        month,
        label: `${CFG.labels.monthNamesShort[month]} ${year}`,
        cells,
        stats
      };
    });

    const visibleCycles = cycles.filter(c => c.departsInWindow);
    const totalLumpsumDepart = visibleCycles.reduce((s, c) => s + (c.lumpsum.depart.total || 0), 0);
    const totalLumpsumReturn = visibleCycles.reduce((s, c) => s + (c.lumpsum.return.total || 0), 0);
    const totalLumpsumAll = visibleCycles.reduce((s, c) => s + (c.lumpsum.grandTotal || 0), 0);
    const anyUnconfiguredLumpsum = visibleCycles.some(c => !c.lumpsum.isConfigured);
    const flightCount = visibleCycles.filter(c => c.trvZone.hasFlightTicket).length;

    const totalEarnedCE = visibleCycles.reduce((s, c) => s + c.earnedCE, 0);
    const totalUsedCE = visibleCycles.reduce((s, c) => s + c.ceDays, 0);
    const remainingCE = visibleCycles.length ? visibleCycles[visibleCycles.length - 1].ceBalanceAfter : ceBalance;
    const overSopCycles = visibleCycles.filter(c => c.isExtendOverSop);
    const overSopCyclesCount = overSopCycles.length;
    const maxCycleExtendDays = visibleCycles.reduce((m, c) => Math.max(m, c.extendDays), 0);

    return {
      startDate,
      joinDate,
      firstOffRefDate,
      ctBracket,
      remainingCT,
      usedCT: Math.max(0, state.annualLeaveBalance - remainingCT),
      totalEarnedCE,
      totalUsedCE,
      remainingCE,
      overSopCyclesCount,
      maxCycleExtendDays,
      cityObj: getCityObj(state.pohCity),
      trvSpec: getTrvZoneSpec(getCityObj(state.pohCity)),
      rosterSpec: getRosterSpec(state.rosterCode),
      patternSpec: getPatternSpec(state.workPattern),
      months: matrixMonths,
      cycles,
      visibleCycles,
      totals,
      totalLumpsumDepart,
      totalLumpsumReturn,
      totalLumpsumAll,
      anyUnconfiguredLumpsum,
      flightCount,
      dayMap
    };
  }

  // ---------- RENDERING ----------
  function renderSignatures() {
    const sigGrid = document.getElementById('bjlPrintSignatures');
    if (!sigGrid) return;
    let sigs = CFG.signatures;
    try {
      const saved = localStorage.getItem(SIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) sigs = parsed;
      }
    } catch (_) {}

    sigGrid.innerHTML = sigs.map(s => `
      <div class="sig-box">
        <div>${escapeHtml(s.title)}</div>
        <div class="sig-space"></div>
        <div><strong>${escapeHtml(s.role)}</strong></div>
        ${s.name ? `<div class="sig-name-sub">(${escapeHtml(s.name)})</div>` : ''}
      </div>
    `).join('');
  }

  function renderStaticControls() {
    // Grades dropdown
    const gradeSel = document.getElementById('bjlGrade');
    if (gradeSel) {
      gradeSel.innerHTML = CFG.grades.map(g => {
        const gk = CFG.gradeToLumpsumGroup[g];
        const isCustom = CFG.lumpsumGroups[gk]?.isCustom;
        return `<option value="${escapeHtml(g)}">${escapeHtml(g)}${isCustom ? ' (Tarif Input Mandiri)' : ''}</option>`;
      }).join('');
    }

    // Roster dropdown
    const rosterSel = document.getElementById('bjlRoster');
    if (rosterSel) {
      rosterSel.innerHTML = Object.values(CFG.rosters).map(r =>
        `<option value="${r.code}">${escapeHtml(r.label)} — CP ${r.periodicLeaveDays} hr, Pembagi CE ${String(r.extraLeaveDivisor).replace('.', ',')}</option>`
      ).join('');
    }

    // Work pattern dropdown
    const patSel = document.getElementById('bjlPattern');
    if (patSel) {
      patSel.innerHTML = Object.entries(CFG.workPatterns).map(([k, v]) =>
        `<option value="${k}">${escapeHtml(v.label)}</option>`
      ).join('');
    }

    // POH Cities grouped by region
    const pohSel = document.getElementById('bjlPohCity');
    if (pohSel) {
      const groups = {};
      CFG.pohCities.forEach(c => {
        if (!groups[c.region]) groups[c.region] = [];
        groups[c.region].push(c);
      });
      pohSel.innerHTML = Object.entries(groups).map(([reg, list]) => {
        const opts = list.map(c => {
          const z = CFG.trvZones[c.zone];
          return `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} — ${escapeHtml(z.trvCode || ('TRV ' + z.trvDays))} (${z.trvDays} hr PP)${z.hasFlightTicket ? ' + Pesawat' : ''}</option>`;
        }).join('');
        return `<optgroup label="${escapeHtml(reg)}">${opts}</optgroup>`;
      }).join('');
    }

    // Terms list
    const termsEl = document.getElementById('bjlLumpsumTermsList');
    if (termsEl) {
      termsEl.innerHTML = CFG.lumpsumTerms.map(t => `<li>${escapeHtml(t)}</li>`).join('');
    }

    renderLegend();
    renderSignatures();
  }

  function renderLegend() {
    const bar = document.getElementById('bjlLegendBar');
    if (!bar) return;
    const keys = ['work', 'offSite', 'extendWork', 'extendOverSop', 'trvDepart', 'periodicLeave', 'extraLeave', 'annualLeave', 'trvReturn', 'sick', 'sickNoDoc', 'permit', 'duty', 'alpha'];
    bar.innerHTML = keys.map(k => {
      const sp = CFG.colors[k];
      if (!sp) return '';
      return `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${sp.bg};border-color:${sp.border};"></span>
          <span>${escapeHtml(sp.label)}</span>
        </div>
      `;
    }).join('') + `
      <div class="legend-item"><span class="legend-holiday-dot nat"></span><span>Libur Nasional</span></div>
      <div class="legend-item"><span class="legend-holiday-dot jnt"></span><span>Cuti Bersama</span></div>
    `;
  }

  function syncFormInputs() {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && el.value !== String(v ?? '')) el.value = String(v ?? ''); };
    setVal('bjlName', state.employeeName);
    setVal('bjlNik', state.employeeNik);
    setVal('bjlDept', state.employeeDepartment);
    setVal('bjlRole', state.employeeRole);
    setVal('bjlGrade', state.employeeGrade);
    setVal('bjlRoster', state.rosterCode);
    setVal('bjlPattern', state.workPattern);
    setVal('bjlFirstOffRefDate', state.firstOffRefDate);
    setVal('bjlPohCity', state.pohCity);
    setVal('bjlJoinDate', state.joinDate);
    setVal('bjlStartDate', state.startDate);
    setVal('bjlCtBalance', state.annualLeaveBalance);
    setVal('bjlDefaultCP', state.defaultPeriodicDays);
    setVal('bjlCeRounding', state.extraLeaveRounding);
    setVal('bjlViewMode', state.viewMode);

    const autoChk = document.getElementById('bjlAutoCt');
    if (autoChk) autoChk.checked = !!state.autoCtFromBracket;
    const ctInp = document.getElementById('bjlCtBalance');
    if (ctInp) ctInp.disabled = !!state.autoCtFromBracket;

    const holChk = document.getElementById('bjlShowHolidays');
    if (holChk) holChk.checked = !!state.showHolidays;
  }

  function renderHintsAndPrintBar(sim) {
    // Tenure & CT bracket hint + POH change eligibility
    const hintEl = document.getElementById('bjlTenureHint');
    if (hintEl) {
      const b = sim.ctBracket;
      let pohChangeMsg = '';
      if (sim.joinDate) {
        const elig1 = new Date(sim.joinDate.getFullYear() + 2, sim.joinDate.getMonth(), sim.joinDate.getDate());
        const isElig = sim.startDate >= elig1;
        pohChangeMsg = isElig
          ? ` • Perubahan POH: <strong>Memenuhi syarat masa kerja ≥ 2 thn</strong> (per 2 thn, berlaku tgl 1 bln berikutnya).`
          : ` • Perubahan POH: <strong>Eligible mulai ${formatDateID(elig1, true)}</strong> (min. 2 thn masa kerja).`;
      }
      hintEl.innerHTML = `Masa kerja: <strong>${b.years} thn ${b.months} bln</strong> → Bracket CT: <strong>${b.days} hari</strong> (${escapeHtml(b.label)}).${pohChangeMsg}`;
    }

    // POH & Lumpsum preview hint
    const pohHint = document.getElementById('bjlPohHint');
    if (pohHint) {
      const lump = getLumpsumForGradeAndCity(state.employeeGrade, state.pohCity);
      const warn = checkPohSopWarning(state.employeeGrade, state.pohCity);
      const lumpText = lump.isConfigured
        ? `Grup Tarif: <strong>${escapeHtml(lump.groupLabel)}</strong> — <span class="badge-lump-go">Berangkat: ${formatRp(lump.depart.total)}</span> + <span class="badge-lump-back">Kembali: ${formatRp(lump.return.total)}</span> = <strong>${formatRp(lump.grandTotal)} / siklus</strong>`
        : `Grup Tarif: <strong>${escapeHtml(lump.groupLabel)}</strong> — <span style="color:#B45309;font-weight:700;">Tarif kosong (belum diisi). Klik "💰 Tarif Lumpsum" di atas untuk input manual.</span>`;
      pohHint.innerHTML = `
        <div><strong>${escapeHtml(sim.trvSpec.label)}</strong></div>
        <div style="margin-top:4px;">${lumpText}</div>
        ${warn ? `<div class="bjl-sop-warn">⚠️ ${escapeHtml(warn)}</div>` : ''}
      `;
    }

    // Print Emp Bar
    const printBar = document.getElementById('bjlPrintEmpBar');
    if (printBar) {
      printBar.innerHTML = `
        <div><strong>Nama:</strong> ${escapeHtml(state.employeeName)} (${escapeHtml(state.employeeNik)})</div>
        <div><strong>Dept / Jabatan:</strong> ${escapeHtml(state.employeeDepartment)} / ${escapeHtml(state.employeeRole)}</div>
        <div><strong>Grade / Roster:</strong> ${escapeHtml(state.employeeGrade)} / ${escapeHtml(state.rosterCode)} (Pola ${escapeHtml(state.workPattern)}${sim.firstOffRefDate ? ' • Acuan OFF: ' + formatDateID(sim.firstOffRefDate, true) : ''})</div>
        <div><strong>POH / Travel:</strong> ${escapeHtml(state.pohCity)} (${escapeHtml(sim.trvSpec.trvCode || 'TRV')} — ${sim.trvSpec.trvDays} hr PP${sim.trvSpec.hasFlightTicket ? ' + Pesawat' : ''})</div>
        <div><strong>Join Date / Masa Kerja:</strong> ${formatDateID(sim.joinDate, true)} (${sim.ctBracket.years}t ${sim.ctBracket.months}b)</div>
        <div><strong>Hak CT / Sisa:</strong> ${state.annualLeaveBalance} hr / ${sim.remainingCT} hr</div>
        <div><strong>Saldo CE (Ambil/Hak):</strong> ${sim.totalUsedCE} / ${sim.totalEarnedCE} hr (Sisa ${sim.remainingCE} hr • ÷${String(sim.rosterSpec.extraLeaveDivisor).replace('.', ',')})</div>
        <div><strong>Est. Lumpsum 12 Bln:</strong> ${sim.anyUnconfiguredLumpsum ? 'Tarif Grade Belum Diisi' : formatRp(sim.totalLumpsumAll)}</div>
      `;
    }
  }

  function renderKPIs(sim) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const setHtml = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };

    set('bjlKpiWorkVal', `${sim.totals.work} hr`);
    const sopAlertHtml = sim.overSopCyclesCount > 0
      ? ` <span class="bjl-sop-over-badge kpi-sop-alert">⚠️ SOP &gt;${MAX_EXTEND_SOP} hr (${sim.overSopCyclesCount} prd)</span>`
      : '';
    setHtml('bjlKpiWorkSub', `OFF site: ${sim.totals.offSite} hr • Extend: ${sim.totals.extendWork} hr${sopAlertHtml}`);

    set('bjlKpiCpVal', `${sim.totals.cp} hr`);
    set('bjlKpiCpSub', `${sim.visibleCycles.length} siklus cuti • ${sim.rosterSpec.code} (${sim.patternSpec.workDays}:${sim.patternSpec.offDays})`);

    set('bjlKpiTrvVal', `${sim.totals.trv} hr`);
    set('bjlKpiTrvSub', `${sim.trvSpec.trvCode || 'TRV'} (${sim.trvSpec.trvDays} hr PP)/siklus • ${sim.trvSpec.hasFlightTicket ? sim.flightCount + 'x Tiket Pesawat' : 'Non-Pesawat'}`);

    set('bjlKpiCeVal', `${sim.totalUsedCE} / ${sim.totalEarnedCE} hr`);
    setHtml('bjlKpiCeSub', `Sisa Saldo CE: <strong>${sim.remainingCE} hr</strong> • Pembagi ${sim.rosterSpec.code}: ${String(sim.rosterSpec.extraLeaveDivisor).replace('.', ',')}${sopAlertHtml}`);

    set('bjlKpiCtVal', `${sim.usedCT} / ${state.annualLeaveBalance} hr`);
    set('bjlKpiCtSub', `Sisa CT: ${sim.remainingCT} hr (Bracket ${sim.ctBracket.days} hr)`);

    set('bjlKpiLumpVal', sim.anyUnconfiguredLumpsum ? 'Belum Diisi' : formatRp(sim.totalLumpsumAll));
    set('bjlKpiLumpSub', sim.anyUnconfiguredLumpsum
      ? `Isi tarif grade ${state.employeeGrade} di menu Lumpsum`
      : `Berangkat ${formatRp(sim.totalLumpsumDepart)} • Kembali ${formatRp(sim.totalLumpsumReturn)}`);
  }

  function renderMatrix(sim) {
    const table = document.getElementById('bjlMatrixTable');
    if (!table) return;

    const meta = document.getElementById('bjlMatrixMeta');
    if (meta) {
      const offRefTxt = sim.firstOffRefDate ? ` • Acuan OFF: ${formatDateID(sim.firstOffRefDate, true)}` : '';
      meta.textContent = `Roster ${state.rosterCode} (Pola ${state.workPattern}${offRefTxt}) • POH ${state.pohCity} (${sim.trvSpec.trvCode || 'TRV'}: ${sim.trvSpec.trvDays} hr PP) • Tgl Merah Kerja: ${sim.totals.holidaysOnWork} hr • Klik tanggal untuk detail / override`;
    }

    const ovCount = Object.keys(state.manualOverrides || {}).length;
    const ovWrap = document.getElementById('bjlOverrideSummaryWrap');
    if (ovWrap) {
      ovWrap.style.display = ovCount > 0 ? 'flex' : 'none';
      const ovTxt = document.getElementById('bjlOverrideCountText');
      if (ovTxt) ovTxt.textContent = `${ovCount} Override`;
    }

    let html = '<thead><tr><th class="col-month">Bulan</th>';
    for (let d = 1; d <= 31; d++) html += `<th>${d}</th>`;
    html += '<th class="col-sum">X</th><th class="col-sum">CP</th><th class="col-sum">TRV</th><th class="col-sum">CE</th><th class="col-sum">CT</th></tr></thead><tbody>';

    sim.months.forEach(m => {
      html += `<tr><td class="col-month">${escapeHtml(m.label)}</td>`;
      m.cells.forEach(cell => {
        const colSpec = CFG.colors[cell.kind] || CFG.colors.work;
        const classes = ['day-cell', `kind-${cell.kind}`];
        if (cell.iso && cell.iso === state.selectedDateKey) classes.push('selected');
        if (cell.isOverride) classes.push('is-override');
        if (state.showHolidays && cell.holiday) {
          classes.push(cell.holiday.type === 'national' ? 'has-holiday-national' : 'has-holiday-joint');
        }
        const style = `background:${colSpec.bg};color:${colSpec.text};`;
        const title = cell.iso
          ? `${formatDateFullID(cell.date)} — ${cell.code || '-'} | ${cell.detail || ''}${cell.holiday ? ' | Libur: ' + cell.holiday.name : ''}`
          : '';
        html += `<td class="${classes.join(' ')}" style="${style}" ${cell.iso ? `data-iso="${cell.iso}"` : ''} title="${escapeHtml(title)}">${escapeHtml(cell.code || '')}</td>`;
      });
      html += `<td class="col-sum">${m.stats.work}</td><td class="col-sum">${m.stats.cp}</td><td class="col-sum">${m.stats.trv}</td><td class="col-sum">${m.stats.ce}</td><td class="col-sum">${m.stats.ct}</td></tr>`;
    });

    html += `<tr class="total-row"><td class="col-month">TOTAL</td><td colspan="31" style="text-align:right;padding-right:10px;font-weight:600;color:#475569;">12 Bulan • ${sim.visibleCycles.length} Periode Cuti • ${sim.totals.offSite} hr OFF Site • ${sim.totals.holidaysOnWork} Tgl Merah Kerja</td><td class="col-sum">${sim.totals.work}</td><td class="col-sum">${sim.totals.cp}</td><td class="col-sum">${sim.totals.trv}</td><td class="col-sum">${sim.totals.ce}</td><td class="col-sum">${sim.totals.ct}</td></tr>`;
    html += '</tbody>';
    table.innerHTML = html;

    table.querySelectorAll('td.day-cell[data-iso]').forEach(td => {
      td.addEventListener('click', () => {
        state.selectedDateKey = td.dataset.iso;
        renderMatrix(sim);
        renderInspector(sim);
      });
    });
  }

  function renderInspector(sim) {
    const bar = document.getElementById('bjlInspectorBar');
    if (!bar) return;

    const iso = state.selectedDateKey;
    if (!iso) {
      bar.innerHTML = `
        <div class="inspector-main">
          <strong>Inspektor Tanggal &amp; Override Manual BJL:</strong> Klik tanggal mana saja di matriks untuk melihat rincian jadwal (X, OFF, TRV, CP, CE, CT), cek Hari Libur Nasional, atau menerapkan override (S [X lanjut], IS [Reset X1], I, DL, A, OFF*).
        </div>
      `;
      return;
    }

    const dt = parseISODate(iso);
    const cell = sim.dayMap.get(iso) || { kind: 'preStart', code: '-', detail: 'Di luar rentang roster aktif', holiday: getHoliday(iso) };
    const colSpec = CFG.colors[cell.kind] || CFG.colors.work;
    const ov = state.manualOverrides[iso] || null;

    const chipsHtml = Object.entries(CFG.overrideTypes).map(([key, sp]) => `
      <button type="button" class="override-chip ${ov && ov.type === key ? 'active' : ''}" data-ov-type="${key}">
        ${escapeHtml(sp.code)} — ${escapeHtml(sp.label)}
      </button>
    `).join('');

    bar.innerHTML = `
      <div class="inspector-main">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="inspector-badge" style="background:${colSpec.bg};color:${colSpec.text};border:1px solid ${colSpec.border};">${escapeHtml(cell.code || '—')}</span>
          <strong>${escapeHtml(formatDateFullID(dt))}</strong>
          ${cell.cycle ? `<span class="badge-custom">Siklus ${cell.cycle}</span>` : ''}
        </div>
        <div style="margin-top:4px;color:#334155;">${escapeHtml(cell.detail || '-')}</div>
        ${cell.holiday ? `<div class="inspector-holiday-banner ${cell.holiday.type}">${cell.holiday.type === 'national' ? '🔴 Libur Nasional:' : '🟠 Cuti Bersama:'} ${escapeHtml(cell.holiday.name)}</div>` : ''}
      </div>
      <div class="inspector-override-panel">
        <div class="override-btn-group">
          <span style="font-size:11.5px;font-weight:700;color:#475569;">Override:</span>
          ${chipsHtml}
          ${ov ? `<button type="button" class="override-chip" data-ov-clear="1" style="color:#B91C1C;border-color:#FCA5A5;">✕ Hapus Override</button>` : ''}
        </div>
        <input type="text" class="override-note-input" id="bjlInspectorOvNote" placeholder="Catatan override (misal: SKD, SPPD...)" value="${escapeHtml(ov ? ov.note : '')}" />
      </div>
    `;

    bar.querySelectorAll('[data-ov-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.ovType;
        const noteEl = document.getElementById('bjlInspectorOvNote');
        state.manualOverrides[iso] = { type, note: noteEl ? noteEl.value.trim() : '' };
        saveAndRender();
      });
    });

    bar.querySelector('[data-ov-clear]')?.addEventListener('click', () => {
      delete state.manualOverrides[iso];
      saveAndRender();
    });

    document.getElementById('bjlInspectorOvNote')?.addEventListener('change', (e) => {
      if (state.manualOverrides[iso]) {
        state.manualOverrides[iso].note = e.target.value.trim();
        saveState();
      }
    });
  }

  function renderCyclesTable(sim) {
    const tbody = document.getElementById('bjlCyclesTbody');
    if (!tbody) return;

    if (!sim.visibleCycles.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#64748B;padding:18px;">Belum ada periode cuti yang berangkat pada rentang 12 bulan aktif.</td></tr>`;
      return;
    }

    tbody.innerHTML = sim.visibleCycles.map(cyc => {
      const l = cyc.lumpsum;
      const depDetail = l.isConfigured
        ? `<div class="lump-box lump-go"><strong>${formatRp(l.depart.total)}</strong><span>Site–Tte: ${formatRp(l.depart.leg1)} • Tte–POH: ${formatRp(l.depart.leg2)}</span></div>`
        : `<div class="lump-box lump-empty"><strong>Kosong (${escapeHtml(state.employeeGrade)})</strong><span>Input via menu Tarif Lumpsum</span></div>`;

      const retDetail = l.isConfigured
        ? `<div class="lump-box lump-back"><strong>${formatRp(l.return.total)}</strong><span>POH–Tte: ${formatRp(l.return.leg1)} • Tte–Site: ${formatRp(l.return.leg2)}</span></div>`
        : `<div class="lump-box lump-empty"><strong>Kosong (${escapeHtml(state.employeeGrade)})</strong><span>Input via menu Tarif Lumpsum</span></div>`;

      const holHtml = cyc.holidaysInLeave.length
        ? `<div class="badge-holiday-hit">🎉 ${cyc.holidaysInLeave.length} Tgl Merah: ${escapeHtml(cyc.holidaysInLeave.slice(0, 2).map(h => h.name).join(', '))}${cyc.holidaysInLeave.length > 2 ? '…' : ''}</div>`
        : '';

      const sopBadge = cyc.isExtendOverSop
        ? `<div class="bjl-sop-over-badge" title="Extend melebihi batas SOP ${MAX_EXTEND_SOP} hari (+${cyc.overSopExtendDays} hr ditandai merah di matriks)">⚠️ Melebihi SOP ${MAX_EXTEND_SOP} Hr (+${cyc.overSopExtendDays} hr)</div>`
        : '';

      const resetBadge = cyc.resetCount > 0
        ? `<div class="bjl-reset-badge">↻ ${cyc.resetCount}× Reset X1 (IS)</div>`
        : '';

      const ticketPill = cyc.trvZone.hasFlightTicket
        ? `<span class="pill pill-company">✈️ Tiket Pesawat PP</span>`
        : `<span class="pill pill-local">⛴️ Non-Pesawat</span>`;

      return `
        <tr class="${cyc.isLocked ? 'cycle-locked' : ''}${cyc.isExtendOverSop ? ' cycle-over-sop' : ''}">
          <td>
            <strong>Periode ${cyc.cycle}</strong>
            <div class="tc-flow-meta">${escapeHtml(cyc.rosterCode)} • Pola ${escapeHtml(cyc.workPattern)}</div>
            <button type="button" class="btn-lock ${cyc.isLocked ? 'locked' : ''}" data-bjl-lock="${cyc.cycle}">
              ${cyc.isLocked ? '🔒 Terkunci' : '🔓 Kunci'}
            </button>
          </td>
          <td>
            <div>${formatDateID(cyc.siteStart, true)} – ${formatDateID(cyc.siteEnd, true)}</div>
            <div class="tc-flow-meta">On-site: ${cyc.baseTarget}${cyc.extendDays > 0 ? ' + ' + cyc.extendDays + ' ext' : ''} hr (${cyc.physicalWorkDays} kerja, ${cyc.siteOffDays} OFF)</div>
            ${resetBadge}
          </td>
          <td>
            <strong>${CFG.labels.dayNamesShort[cyc.departDate.getDay()]}, ${formatDateID(cyc.departDate, true)}</strong>
            <div class="tc-flow-meta">Akhir: ${formatDateID(cyc.leaveEndDate, true)}</div>
            <div class="tc-flow-meta">Masuk Site: <strong>${formatDateID(cyc.returnSiteDate, true)}</strong></div>
            ${holHtml}
          </td>
          <td>
            <div class="ct-stepper">
              <button type="button" data-bjl-ext-dec="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>−</button>
              <input type="number" min="0" max="${MAX_EXTEND_INPUT}" value="${cyc.extendDays}" data-bjl-ext-in="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''} />
              <button type="button" data-bjl-ext-inc="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>+</button>
            </div>
            <div class="tc-flow-meta">Hak CE: <strong>+${cyc.earnedCE} hr</strong> (${cyc.extendDays}÷${String(cyc.rosterDivisor).replace('.', ',')}=${cyc.ceRaw.toFixed(2)})</div>
            ${sopBadge}
          </td>
          <td>
            <div class="ct-stepper">
              <button type="button" data-bjl-ce-dec="${cyc.cycle}" ${cyc.isLocked || cyc.ceDays <= 0 ? 'disabled' : ''}>−</button>
              <input type="number" min="0" max="${cyc.ceAvailable}" value="${cyc.ceDays}" data-bjl-ce-in="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''} />
              <button type="button" data-bjl-ce-inc="${cyc.cycle}" ${cyc.isLocked || cyc.ceDays >= cyc.ceAvailable ? 'disabled' : ''}>+</button>
            </div>
            <div class="tc-flow-meta">Saldo: <strong>${cyc.ceAvailable} hr</strong> • Sisa: <strong>${cyc.ceBalanceAfter} hr</strong></div>
          </td>
          <td>
            <div class="ct-stepper">
              <button type="button" data-bjl-cp-dec="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>−</button>
              <input type="number" min="1" max="30" value="${cyc.cpDays}" data-bjl-cp-in="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''} />
              <button type="button" data-bjl-cp-inc="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>+</button>
            </div>
            <div class="tc-flow-meta">${escapeHtml(cyc.trvZone.trvCode || 'TRV')}: <strong>${cyc.trvTotalDays} hr</strong> (${cyc.trvDepartDays} brgkt + ${cyc.trvReturnDays} plg)</div>
          </td>
          <td>
            <div class="ct-stepper">
              <button type="button" data-bjl-ct-dec="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>−</button>
              <input type="number" min="0" max="30" value="${cyc.ctDays}" data-bjl-ct-in="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''} />
              <button type="button" data-bjl-ct-inc="${cyc.cycle}" ${cyc.isLocked ? 'disabled' : ''}>+</button>
            </div>
            <div class="tc-flow-meta">Total di luar site: <strong>${cyc.totalAwayDays} hr</strong></div>
          </td>
          <td>
            ${ticketPill}
            <div class="poh-route-meta">${escapeHtml(cyc.pohCity)} (${escapeHtml(cyc.trvZone.shortLabel)})</div>
          </td>
          <td>${depDetail}</td>
          <td>
            ${retDetail}
            ${l.isConfigured ? `<div class="tc-flow-meta" style="text-align:right;font-weight:700;color:#0F172A;">PP: ${formatRp(l.grandTotal)}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Grand total row
    tbody.innerHTML += `
      <tr class="total-row">
        <td colspan="8" style="text-align:right;font-weight:700;">TOTAL ESTIMASI LUMPSUM (${sim.visibleCycles.length} SIKLUS CUTI • HAK CE: ${sim.totalEarnedCE} HR, TERPAKAI: ${sim.totalUsedCE} HR, SISA: ${sim.remainingCE} HR):</td>
        <td><strong style="color:#065F46;">${sim.anyUnconfiguredLumpsum ? 'Sebagian Kosong' : formatRp(sim.totalLumpsumDepart)}</strong></td>
        <td>
          <strong style="color:#9A3412;">${sim.anyUnconfiguredLumpsum ? 'Sebagian Kosong' : formatRp(sim.totalLumpsumReturn)}</strong>
          <div style="font-size:11px;font-weight:800;color:#0F172A;">Total PP: ${sim.anyUnconfiguredLumpsum ? 'Belum Lengkap' : formatRp(sim.totalLumpsumAll)}</div>
        </td>
      </tr>
    `;

    // Bind table buttons
    tbody.querySelectorAll('[data-bjl-lock]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = Number(btn.dataset.bjlLock);
        const cyc = sim.cycles.find(x => x.cycle === c);
        if (!cyc) return;
        if (state.lockedCycles[c]) {
          delete state.lockedCycles[c];
          showToast(`Kunci Periode ${c} dibuka.`);
        } else {
          state.lockedCycles[c] = {
            extendDays: cyc.extendDays,
            ceDays: cyc.ceDays,
            cpDays: cyc.cpDays,
            ctDays: cyc.ctDays,
            rosterCode: cyc.rosterCode,
            workPattern: cyc.workPattern,
            pohCity: cyc.pohCity
          };
          showToast(`Periode ${c} dikunci (History Lock aktif).`);
        }
        saveAndRender();
      });
    });

    const bindStepper = (prefix, mapObj, minV, maxVOrFn, fallbackFn) => {
      const getMax = (c) => typeof maxVOrFn === 'function' ? maxVOrFn(c) : maxVOrFn;
      tbody.querySelectorAll(`[data-bjl-${prefix}-dec]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const c = Number(btn.dataset[`bjl${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Dec`]);
          const cur = mapObj[c] ?? fallbackFn(c);
          mapObj[c] = Math.max(minV, cur - 1);
          saveAndRender();
        });
      });
      tbody.querySelectorAll(`[data-bjl-${prefix}-inc]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const c = Number(btn.dataset[`bjl${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Inc`]);
          const cur = mapObj[c] ?? fallbackFn(c);
          mapObj[c] = Math.min(getMax(c), cur + 1);
          saveAndRender();
        });
      });
      tbody.querySelectorAll(`[data-bjl-${prefix}-in]`).forEach(inp => {
        inp.addEventListener('change', () => {
          const c = Number(inp.dataset[`bjl${prefix.charAt(0).toUpperCase() + prefix.slice(1)}In`]);
          mapObj[c] = clampInt(inp.value, minV, getMax(c), fallbackFn(c));
          saveAndRender();
        });
      });
    };

    bindStepper('ext', state.cycleExtends, 0, MAX_EXTEND_INPUT, () => 0);
    bindStepper('ce', state.ceAllocations, 0, (c) => {
      const cyc = sim.cycles.find(x => x.cycle === c);
      return cyc ? cyc.ceAvailable : 0;
    }, () => 0);
    bindStepper('cp', state.cyclePeriodicDays, 1, 30, () => state.defaultPeriodicDays);
    bindStepper('ct', state.ctAllocations, 0, 30, () => 0);
  }

  // ---------- SCENARIO & SHARE LINK ----------
  function getSavedScenarios() {
    try { return JSON.parse(localStorage.getItem(SCENARIOS_KEY) || '[]'); } catch (_) { return []; }
  }
  function setSavedScenarios(list) {
    try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function applyImportedPayload(p) {
    if (!p || typeof p !== 'object') return false;
    const def = createDefaultState();
    Object.keys(def).forEach(k => {
      if (p[k] !== undefined) state[k] = p[k];
    });
    if (p.customLumpsum && typeof p.customLumpsum === 'object') {
      saveCustomLumpsumStore(p.customLumpsum);
    }
    return true;
  }

  function encodeShareHash() {
    const payload = { ...state, customLumpsum: getCustomLumpsumStore() };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return '#bjl=' + b64;
  }

  function loadFromHash() {
    try {
      const h = window.location.hash || '';
      if (!h.startsWith('#bjl=')) return false;
      const json = decodeURIComponent(escape(atob(h.slice(5))));
      return applyImportedPayload(JSON.parse(json));
    } catch (_) {
      return false;
    }
  }

  function copyShareLink() {
    const url = window.location.origin + window.location.pathname + encodeShareHash();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast('Link simulasi BJL disalin ke clipboard!'))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Link simulasi BJL disalin!'); } catch (_) {}
    ta.remove();
  }

  function renderScenarioModalList() {
    const listEl = document.getElementById('bjlScenarioList');
    if (!listEl) return;
    const list = getSavedScenarios();
    if (!list.length) {
      listEl.innerHTML = `<div style="font-size:12px;color:#64748B;padding:10px;text-align:center;">Belum ada skenario BJL tersimpan.</div>`;
      return;
    }
    listEl.innerHTML = list.map((item, idx) => `
      <div class="scenario-item">
        <div>
          <div class="scenario-item-title">${escapeHtml(item.name)}</div>
          <div class="scenario-item-meta">${escapeHtml(item.meta)}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-soft" data-bjl-load-sc="${idx}" style="padding:4px 9px;font-size:11.5px;">Muat</button>
          <button type="button" class="btn btn-ghost" data-bjl-del-sc="${idx}" style="padding:4px 8px;font-size:11.5px;color:#B91C1C;">Hapus</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-bjl-load-sc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.bjlLoadSc);
        if (list[idx] && applyImportedPayload(list[idx].data)) {
          saveAndRender();
          document.getElementById('bjlScenarioModal')?.classList.remove('open');
          showToast(`Skenario BJL "${list[idx].name}" dimuat.`);
        }
      });
    });

    listEl.querySelectorAll('[data-bjl-del-sc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.bjlDelSc);
        list.splice(idx, 1);
        setSavedScenarios(list);
        renderScenarioModalList();
      });
    });
  }

  function exportScenarioJson() {
    const payload = {
      company: 'BJL',
      version: CFG.app.version,
      exportedAt: new Date().toISOString(),
      state,
      customLumpsum: getCustomLumpsumStore()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const safeName = (state.employeeName || 'Karyawan').replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerDownload(blob, `BJL_Skenario_${safeName}_${toISODate(new Date())}.json`);
    showToast('File skenario JSON BJL berhasil diunduh.');
  }

  // ---------- EXCEL EXPORT (4 SHEETS VIA EXCELJS) ----------
  async function exportToExcel() {
    const sim = lastSim;
    if (!sim) return;
    if (!window.ExcelJS) {
      showToast('ExcelJS belum termuat (cek koneksi internet).');
      return;
    }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = CFG.app.title;
      const hexToArgb = (hex) => 'FF' + String(hex || '#FFFFFF').replace('#', '').toUpperCase();

      // SHEET 1: MATRIKS BJL
      const ws = wb.addWorksheet('Matriks Timesheet BJL', { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }] });
      ws.mergeCells('A1:AK1');
      ws.getCell('A1').value = `${CFG.app.companyName} — ${CFG.app.title} (v${CFG.app.version})`;
      ws.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:AK2');
      ws.getCell('A2').value = `Nama: ${state.employeeName} | NIK: ${state.employeeNik} | Dept/Jabatan: ${state.employeeDepartment} / ${state.employeeRole} | Grade: ${state.employeeGrade} | Roster: ${state.rosterCode} (Pola ${state.workPattern})`;
      ws.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
      ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      ws.getRow(2).height = 20;

      ws.mergeCells('A3:AK3');
      ws.getCell('A3').value = `POH: ${state.pohCity} (${sim.trvSpec.trvCode || 'TRV'} — ${sim.trvSpec.trvDays} hr PP, ${sim.trvSpec.hasFlightTicket ? 'Tiket Pesawat' : 'Non-Pesawat'}) | Acuan OFF: ${sim.firstOffRefDate ? formatDateID(sim.firstOffRefDate, true) : 'Default Hari 1'} | Masa Kerja: ${sim.ctBracket.years}t ${sim.ctBracket.months}b (CT ${state.annualLeaveBalance}/${sim.remainingCT} hr) | Saldo CE: ${sim.totalUsedCE}/${sim.totalEarnedCE} hr (Sisa ${sim.remainingCE} hr)`;
      ws.getCell('A3').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
      ws.getRow(3).height = 18;
      ws.getRow(4).height = 6;

      const hdr = ['Bulan', ...Array.from({ length: 31 }, (_, i) => i + 1), 'X', 'CP', 'TRV', 'CE', 'CT'];
      const hdrRow = ws.getRow(5);
      hdrRow.values = hdr;
      hdrRow.height = 22;
      hdrRow.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      sim.months.forEach((mRow, idx) => {
        const row = ws.getRow(6 + idx);
        row.height = 21;
        row.getCell(1).value = mRow.label;
        row.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        mRow.cells.forEach((cellData, dIdx) => {
          const ec = row.getCell(2 + dIdx);
          ec.value = cellData.code || '';
          const colSpec = CFG.colors[cellData.kind] || CFG.colors.work;
          ec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(colSpec.bg) } };
          ec.font = { name: 'Calibri', size: 9, bold: cellData.kind !== 'work', color: { argb: hexToArgb(colSpec.text) } };
          ec.alignment = { vertical: 'middle', horizontal: 'center' };
          const isNat = state.showHolidays && cellData.holiday && cellData.holiday.type === 'national';
          ec.border = {
            top: { style: isNat ? 'medium' : 'thin', color: { argb: isNat ? 'FFDC2626' : 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });

        [mRow.stats.work, mRow.stats.cp, mRow.stats.trv, mRow.stats.ce, mRow.stats.ct].forEach((val, sIdx) => {
          const sc = row.getCell(33 + sIdx);
          sc.value = val;
          sc.font = { name: 'Calibri', size: 10, bold: true };
          sc.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      const totIdx = 6 + sim.months.length;
      const totRow = ws.getRow(totIdx);
      totRow.height = 23;
      totRow.getCell(1).value = 'TOTAL';
      ws.mergeCells(totIdx, 2, totIdx, 32);
      totRow.getCell(2).value = `12 Bulan (${sim.visibleCycles.length} Periode • ${sim.totals.offSite} hr OFF Site • ${sim.totals.holidaysOnWork} Tgl Merah Kerja)`;
      totRow.getCell(33).value = { formula: `SUM(AG6:AG${totIdx - 1})`, result: sim.totals.work };
      totRow.getCell(34).value = { formula: `SUM(AH6:AH${totIdx - 1})`, result: sim.totals.cp };
      totRow.getCell(35).value = { formula: `SUM(AI6:AI${totIdx - 1})`, result: sim.totals.trv };
      totRow.getCell(36).value = { formula: `SUM(AJ6:AJ${totIdx - 1})`, result: sim.totals.ce };
      totRow.getCell(37).value = { formula: `SUM(AK6:AK${totIdx - 1})`, result: sim.totals.ct };
      for (let col = 1; col <= 37; col++) {
        const c = totRow.getCell(col);
        c.font = { name: 'Calibri', size: 10, bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        c.alignment = { vertical: 'middle', horizontal: col === 2 ? 'right' : 'center' };
      }

      ws.getColumn(1).width = 13;
      for (let col = 2; col <= 32; col++) ws.getColumn(col).width = 5.4;
      for (let col = 33; col <= 37; col++) ws.getColumn(col).width = 6.2;

      // SHEET 2: RINGKASAN PERIODE & LUMPSUM
      const ws2 = wb.addWorksheet('Ringkasan Periode & Lumpsum');
      ws2.columns = [
        { header: 'Periode', key: 'periode', width: 12 },
        { header: 'Status', key: 'status', width: 11 },
        { header: 'Roster / Pola', key: 'roster', width: 15 },
        { header: 'Kerja di Site', key: 'site', width: 25 },
        { header: 'Extend (Hr)', key: 'ext', width: 11 },
        { header: 'Status SOP Extend', key: 'sop', width: 19 },
        { header: 'Hak CE (+)', key: 'earnedCe', width: 11 },
        { header: 'Ambil CE', key: 'ce', width: 10 },
        { header: 'Sisa CE', key: 'remCe', width: 10 },
        { header: 'Berangkat', key: 'depart', width: 18 },
        { header: 'Kembali Site', key: 'ret', width: 16 },
        { header: 'TRV', key: 'trv', width: 7 },
        { header: 'CP', key: 'cp', width: 7 },
        { header: 'CT', key: 'ct', width: 7 },
        { header: 'Total Cuti+TRV', key: 'tot', width: 14 },
        { header: 'POH & Tiket', key: 'poh', width: 24 },
        { header: 'Berangkat (Site→POH)', key: 'lgo', width: 20 },
        { header: 'Kembali (POH→Site)', key: 'lback', width: 20 },
        { header: 'Total Lumpsum PP', key: 'lpp', width: 20 }
      ];
      ws2.getRow(1).eachCell((cell, colNum) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        let fg = 'FF1E3A5F';
        if (colNum === 17) fg = 'FF15803D'; // Green depart
        if (colNum === 18) fg = 'FFC2410C'; // Orange return
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fg } };
      });

      sim.visibleCycles.forEach(cyc => {
        const row = ws2.addRow({
          periode: `Periode ${cyc.cycle}`,
          status: cyc.isLocked ? 'Terkunci' : 'Proyeksi',
          roster: `${cyc.rosterCode} (${cyc.workPattern})`,
          site: `${formatDateID(cyc.siteStart, true)} – ${formatDateID(cyc.siteEnd, true)}`,
          ext: cyc.extendDays,
          sop: cyc.isExtendOverSop ? `Melebihi SOP (+${cyc.overSopExtendDays} hr)` : 'Sesuai SOP (≤42 hr)',
          earnedCe: cyc.earnedCE,
          ce: cyc.ceDays,
          remCe: cyc.ceBalanceAfter,
          depart: `${CFG.labels.dayNamesShort[cyc.departDate.getDay()]}, ${formatDateID(cyc.departDate, true)}`,
          ret: formatDateID(cyc.returnSiteDate, true),
          trv: cyc.trvTotalDays,
          cp: cyc.cpDays,
          ct: cyc.ctDays,
          tot: cyc.totalAwayDays,
          poh: `${cyc.pohCity} (${cyc.trvZone.hasFlightTicket ? 'Pesawat' : 'Non-Pesawat'})`,
          lgo: cyc.lumpsum.isConfigured ? cyc.lumpsum.depart.total : 0,
          lback: cyc.lumpsum.isConfigured ? cyc.lumpsum.return.total : 0,
          lpp: cyc.lumpsum.isConfigured ? cyc.lumpsum.grandTotal : 0
        });
        if (cyc.isExtendOverSop) {
          row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          row.getCell(6).font = { bold: true, color: { argb: 'FF991B1B' } };
        }
        row.getCell(17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        row.getCell(18).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
        [17, 18, 19].forEach(c => { row.getCell(c).numFmt = '#,##0'; });
      });

      if (sim.visibleCycles.length > 0) {
        const lastR = sim.visibleCycles.length + 1;
        const sumR = ws2.addRow({
          periode: 'TOTAL',
          earnedCe: { formula: `SUM(G2:G${lastR})`, result: sim.totalEarnedCE },
          ce: { formula: `SUM(H2:H${lastR})`, result: sim.totalUsedCE },
          remCe: sim.remainingCE,
          lgo: { formula: `SUM(Q2:Q${lastR})`, result: sim.totalLumpsumDepart },
          lback: { formula: `SUM(R2:R${lastR})`, result: sim.totalLumpsumReturn },
          lpp: { formula: `SUM(S2:S${lastR})`, result: sim.totalLumpsumAll }
        });
        sumR.eachCell(c => { c.font = { bold: true }; });
        [17, 18, 19].forEach(c => { sumR.getCell(c).numFmt = '#,##0'; });
      }

      // SHEET 3: MASTER TARIF LUMPSUM AKTIF
      const ws3 = wb.addWorksheet('Master Tarif Lumpsum');
      ws3.columns = [
        { header: 'Kota POH', key: 'city', width: 26 },
        { header: 'Wilayah', key: 'region', width: 22 },
        { header: 'Zona TRV', key: 'trv', width: 12 },
        { header: `Berangkat (${state.employeeGrade})`, key: 'go', width: 20 },
        { header: `Kembali (${state.employeeGrade})`, key: 'back', width: 20 },
        { header: 'Total PP', key: 'pp', width: 18 }
      ];
      ws3.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      });
      CFG.pohCities.forEach(c => {
        const l = getLumpsumForGradeAndCity(state.employeeGrade, c.name);
        const r = ws3.addRow({
          city: c.name,
          region: c.region,
          trv: `${CFG.trvZones[c.zone].trvCode || 'TRV'} (${CFG.trvZones[c.zone].trvDays} hr PP)`,
          go: l.isConfigured ? l.depart.total : 'Belum Diisi',
          back: l.isConfigured ? l.return.total : 'Belum Diisi',
          pp: l.isConfigured ? l.grandTotal : 'Belum Diisi'
        });
        if (l.isConfigured) {
          [4, 5, 6].forEach(col => { r.getCell(col).numFmt = '#,##0'; });
        }
      });
      ws3.addRow({});
      ws3.addRow({ city: 'Term & Condition Lumpsum:' }).getCell(1).font = { bold: true };
      CFG.lumpsumTerms.forEach(t => ws3.addRow({ city: t }));

      // SHEET 4: OVERRIDE & LIBUR NASIONAL
      const ws4 = wb.addWorksheet('Override & Libur Nasional');
      ws4.columns = [
        { header: 'Tanggal', key: 'tgl', width: 16 },
        { header: 'Kategori', key: 'kat', width: 20 },
        { header: 'Kode / Status', key: 'kode', width: 16 },
        { header: 'Keterangan', key: 'ket', width: 45 }
      ];
      ws4.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      Object.entries(state.manualOverrides || {}).sort().forEach(([iso, ov]) => {
        const sp = CFG.overrideTypes[ov.type];
        ws4.addRow({ tgl: iso, kat: 'Override Manual', kode: sp ? sp.code : ov.type, ket: `${sp ? sp.label : ''}${ov.note ? ' — ' + ov.note : ''}` });
      });
      sim.months.forEach(m => m.cells.forEach(cell => {
        if (cell.iso && cell.holiday) {
          ws4.addRow({ tgl: cell.iso, kat: cell.holiday.type === 'national' ? 'Libur Nasional' : 'Cuti Bersama', kode: cell.code || '-', ket: cell.holiday.name });
        }
      }));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeName = (state.employeeName || 'Karyawan').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const fileName = `BJL_Timesheet_Lumpsum_${safeName}_${sim.startDate.getFullYear()}.xlsx`;
      triggerDownload(blob, fileName);
      showToast(`File Excel "${fileName}" berhasil diunduh.`);
    } catch (err) {
      console.error('BJL Excel export error:', err);
      showToast('Gagal mengekspor Excel BJL.');
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showToast(msg) {
    if (window.APP_SHOW_TOAST) window.APP_SHOW_TOAST(msg);
  }

  // ---------- PERSISTENCE & RENDER LOOP ----------
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyImportedPayload(JSON.parse(raw));
    } catch (_) {}
  }

  function resetToDefaults() {
    Object.assign(state, createDefaultState());
    saveAndRender();
    showToast('Simulasi BJL dikembalikan ke pengaturan default.');
  }

  function renderAll() {
    lastSim = runSimulation();
    syncFormInputs();
    renderHintsAndPrintBar(lastSim);
    renderKPIs(lastSim);
    renderMatrix(lastSim);
    renderInspector(lastSim);
    renderCyclesTable(lastSim);
  }

  function saveAndRender() {
    saveState();
    renderAll();
  }

  // ---------- EVENT BINDINGS ----------
  function bindEvents() {
    const bind = (id, key, transform) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        state[key] = transform ? transform(el.value) : el.value;
        saveAndRender();
      });
    };

    bind('bjlName', 'employeeName');
    bind('bjlNik', 'employeeNik');
    bind('bjlDept', 'employeeDepartment');
    bind('bjlRole', 'employeeRole');
    bind('bjlGrade', 'employeeGrade');
    bind('bjlRoster', 'rosterCode');
    bind('bjlPattern', 'workPattern');
    bind('bjlFirstOffRefDate', 'firstOffRefDate');
    bind('bjlPohCity', 'pohCity');
    bind('bjlJoinDate', 'joinDate');
    bind('bjlStartDate', 'startDate');
    bind('bjlCeRounding', 'extraLeaveRounding');
    bind('bjlViewMode', 'viewMode');

    document.getElementById('bjlAutoCt')?.addEventListener('change', (e) => {
      state.autoCtFromBracket = e.target.checked;
      saveAndRender();
    });

    document.getElementById('bjlCtBalance')?.addEventListener('change', (e) => {
      state.annualLeaveBalance = clampInt(e.target.value, 0, 60, 12);
      saveAndRender();
    });

    document.getElementById('bjlDefaultCP')?.addEventListener('change', (e) => {
      state.defaultPeriodicDays = clampInt(e.target.value, 1, 30, 14);
      saveAndRender();
    });

    document.getElementById('bjlShowHolidays')?.addEventListener('change', (e) => {
      state.showHolidays = e.target.checked;
      saveAndRender();
    });

    document.getElementById('bjlBtnClearOverrides')?.addEventListener('click', () => {
      state.manualOverrides = {};
      saveAndRender();
      showToast('Semua override manual BJL telah dihapus.');
    });

    document.getElementById('bjlBtnUnlockAll')?.addEventListener('click', () => {
      state.lockedCycles = {};
      saveAndRender();
      showToast('Semua kunci periode BJL telah dibuka.');
    });

    document.getElementById('bjlBtnClearCycleCustom')?.addEventListener('click', () => {
      state.cycleExtends = {};
      state.ceAllocations = {};
      state.cyclePeriodicDays = {};
      saveAndRender();
      showToast('Extend, alokasi Ambil CE & durasi CP custom BJL di-reset.');
    });

    document.getElementById('bjlBtnClearCT')?.addEventListener('click', () => {
      state.ctAllocations = {};
      saveAndRender();
      showToast('Alokasi CT periode BJL di-reset ke 0.');
    });

    // BJL Scenario Modal
    const scModal = document.getElementById('bjlScenarioModal');
    document.getElementById('bjlBtnCloseScenario')?.addEventListener('click', () => scModal?.classList.remove('open'));
    scModal?.addEventListener('click', (e) => { if (e.target === scModal) scModal.classList.remove('open'); });

    document.getElementById('bjlBtnSaveScenario')?.addEventListener('click', () => {
      const inp = document.getElementById('bjlInputScenarioName');
      const name = (inp?.value || '').trim() || `BJL ${state.employeeName} (${state.rosterCode} - ${state.pohCity})`;
      const list = getSavedScenarios();
      list.unshift({
        name,
        savedAt: new Date().toISOString(),
        meta: `${state.rosterCode} (${state.workPattern}) • Grade ${state.employeeGrade} • POH ${state.pohCity} • Mulai ${state.startDate}`,
        data: JSON.parse(JSON.stringify({ ...state, customLumpsum: getCustomLumpsumStore() }))
      });
      setSavedScenarios(list.slice(0, 20));
      if (inp) inp.value = '';
      renderScenarioModalList();
      showToast(`Skenario BJL "${name}" tersimpan.`);
    });

    document.getElementById('bjlBtnExportJson')?.addEventListener('click', exportScenarioJson);
    document.getElementById('bjlBtnCopyShareFromModal')?.addEventListener('click', copyShareLink);

    const fileInput = document.getElementById('bjlImportJsonFile');
    document.getElementById('bjlBtnImportJson')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const target = parsed.state ? { ...parsed.state, customLumpsum: parsed.customLumpsum } : parsed;
          if (applyImportedPayload(target)) {
            saveAndRender();
            scModal?.classList.remove('open');
            showToast(`File skenario BJL "${file.name}" dimuat.`);
          } else {
            showToast('Format file JSON BJL tidak dikenali.');
          }
        } catch (_) {
          showToast('Gagal membaca file JSON.');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  window.BJL_APP = {
    reset: resetToDefaults,
    exportExcel: exportToExcel,
    shareLink: copyShareLink,
    openScenario: () => {
      renderScenarioModalList();
      document.getElementById('bjlScenarioModal')?.classList.add('open');
    },
    showConfig: () => {
      const pre = document.getElementById('configPreviewCode');
      if (pre) pre.textContent = JSON.stringify(CFG, null, 2);
      document.getElementById('configModal')?.classList.add('open');
    },
    refreshSignatures: renderSignatures,
    rerender: renderAll,
    getCustomLumpsumStore,
    saveCustomLumpsumStore,
    getLumpsumForGradeAndCity,
    formatRp
  };

  document.addEventListener('DOMContentLoaded', () => {
    const fromHash = loadFromHash();
    if (!fromHash) loadState();
    renderStaticControls();
    bindEvents();
    renderAll();
    if (fromHash) showToast('Simulasi BJL dimuat dari link yang dibagikan.');
  });
})();
