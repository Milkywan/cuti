// KAN MODULE (v3.0 — Dipertahankan 100% utuh dari v2.0 dengan integrasi Multi-Company)
/**
 * ============================================================================
 * KAN TIMESHEET & LEAVE SIMULATOR — CORE ENGINE & UI CONTROLLER (app.js v2.0)
 * ============================================================================
 * Fase 1 Lengkap:
 * - Profil P.O.H (Ring 1/2/3 + Kota/Bandara) & Kategori Jabatan terhubung ke SOP
 * - Kunci Periode (Lock History): periode terkunci kebal dari perubahan skema global
 * - Durasi Fleksibel per Periode & Carry-Over TC (Saldo Awal + Simpan TC)
 * - Kalender Hari Libur Nasional Indonesia (2025–2027)
 * - Custom Override Sel Manual (S, I, DL, A, OFF*) + Catatan
 * - Shareable Link (#s=...) & Scenario Manager (LocalStorage + Export/Import JSON)
 * - Export Excel (.xlsx) & Print PDF A4 Landscape (4+ Tanda Tangan Sejajar 1 Baris)
 * ============================================================================
 */

(function () {
  'use strict';

  const CFG = window.KAN_CONFIG;
  if (!CFG) {
    alert('Gagal memuat config.js! Pastikan file config.js berada di folder yang sama dengan index.html.');
    return;
  }

  const STORAGE_KEY = 'kan_timesheet_state_v2';
  const SCENARIOS_KEY = 'kan_timesheet_scenarios_v2';

  // ---------- APPLICATION STATE ----------
  function createDefaultState() {
    return {
      employeeName: CFG.defaults.employeeName,
      employeeNik: CFG.defaults.employeeNik,
      employeeRole: CFG.defaults.employeeRole,
      employeeGrade: CFG.defaults.employeeGrade || (CFG.employeeGrades && CFG.employeeGrades[1]) || 'Staff',
      pohCategory: CFG.defaults.pohCategory || 'ring3',
      pohCity: CFG.defaults.pohCity || '',
      joinDate: CFG.defaults.joinDate,
      startDate: CFG.defaults.startDate,
      targetHomeDays: Math.max(CFG.rules.minHomeLeaveDays, CFG.rules.defaultHomeLeaveDays),
      offDay: CFG.rules.defaultOffDay,
      departureMode: CFG.rules.defaultDepartureMode,
      workCounterMode: CFG.rules.defaultWorkCounterMode,
      grayBoxMode: CFG.rules.defaultGrayBoxMode,
      viewMode: CFG.rules.defaultViewMode,
      showHolidays: CFG.rules.defaultShowHolidays !== false,
      annualLeaveBalance: CFG.defaults.annualLeaveBalance,
      initialTcBalance: CFG.defaults.initialTcBalance || 0,
      ctAllocations: {},   // { [cycle]: days }
      cycleHomeDays: {},   // { [cycle]: targetHomeDaysOverride }
      cycleSaveTc: {},     // { [cycle]: extraTcToCarryOver }
      lockedCycles: {},    // { [cycle]: { targetHomeDays, saveTc, ctDays, departureMode, grayBoxMode, lockedAt } }
      manualOverrides: {}, // { [isoDate]: { type: 'sick'|'permit'|'duty'|'alpha'|'customOff', note: '' } }
      selectedDateKey: null
    };
  }

  const state = createDefaultState();
  let lastSimulation = null;

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

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function clampInt(val, min, max, fallback) {
    const n = Math.floor(Number(val));
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
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

  function getAnnualLeaveEligibleDate(joinDateObj) {
    if (!joinDateObj) return null;
    const months = Number(CFG.rules.annualLeaveMinServiceMonths) || 12;
    const targetMonthIndex = joinDateObj.getMonth() + months;
    const y = joinDateObj.getFullYear() + Math.floor(targetMonthIndex / 12);
    const m = targetMonthIndex % 12;
    return new Date(y, m, Math.min(joinDateObj.getDate(), daysInMonth(y, m)));
  }

  function getHoliday(iso) {
    return (CFG.holidays && CFG.holidays[iso]) ? CFG.holidays[iso] : null;
  }

  function getPohSpec() {
    const rules = CFG.pohRules || {};
    return rules[state.pohCategory] || rules.ring3 || {
      label: 'Ring 3 — Non-Lokal (Pesawat)',
      shortLabel: 'Ring 3',
      ticketQuotaPerYear: CFG.rules.companyTicketQuotaPerYear || 3,
      ticketLabel: CFG.labels.ticketCompany,
      selfTicketLabel: CFG.labels.ticketSelf,
      defaultCity: ''
    };
  }

  function formatTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{${k}}`
    );
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectConfigTheme() {
    const root = document.documentElement;
    Object.entries(CFG.colors).forEach(([key, val]) => {
      if (!val) return;
      if (val.bg) root.style.setProperty(`--c-${key}-bg`, val.bg);
      if (val.text) root.style.setProperty(`--c-${key}-text`, val.text);
      if (val.border) root.style.setProperty(`--c-${key}-border`, val.border);
    });
  }

  // ---------- CORE SIMULATION ENGINE (v2.0) ----------
  function runSimulation() {
    const startDate = parseISODate(state.startDate) || parseISODate(CFG.defaults.startDate) || new Date();
    const joinDate = parseISODate(state.joinDate);
    const ctEligibleDate = getAnnualLeaveEligibleDate(joinDate);
    const pohSpec = getPohSpec();

    // 12-month window
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

    const minWorkPerWeek = Math.max(1, Number(CFG.rules.workDaysPerWeek) || 5);
    const minHomeDays = Math.max(2, Number(CFG.rules.minHomeLeaveDays) || 9);
    const maxHomeDays = Math.max(minHomeDays, Number(CFG.rules.maxHomeLeaveDays) || 30);
    const globalTargetHome = clampInt(state.targetHomeDays, minHomeDays, maxHomeDays, minHomeDays);
    const ticketQuota = Math.max(0, Number(pohSpec.ticketQuotaPerYear ?? CFG.rules.companyTicketQuotaPerYear));

    let remainingCTBalance = clampInt(state.annualLeaveBalance, 0, 60, 0);
    let tcBank = clampInt(state.initialTcBalance, 0, 30, 0);

    // Per-cycle parameters: locked snapshot takes priority over global settings
    function getCycleTargets(cycleNum, carryIn) {
      const lockSnap = (state.lockedCycles && state.lockedCycles[cycleNum]) ? state.lockedCycles[cycleNum] : null;
      const isLocked = Boolean(lockSnap);
      const depMode = isLocked ? (lockSnap.departureMode || state.departureMode) : state.departureMode;
      const grayMode = isLocked ? (lockSnap.grayBoxMode || state.grayBoxMode) : state.grayBoxMode;

      const hasCustomDays = isLocked
        ? Number(lockSnap.targetHomeDays) !== globalTargetHome
        : (state.cycleHomeDays[cycleNum] !== undefined);

      const rawTarget = isLocked
        ? lockSnap.targetHomeDays
        : (state.cycleHomeDays[cycleNum] !== undefined ? state.cycleHomeDays[cycleNum] : globalTargetHome);

      const targetHome = clampInt(rawTarget, minHomeDays, maxHomeDays, globalTargetHome);
      const saveTcReq = clampInt(isLocked ? (lockSnap.saveTc || 0) : (state.cycleSaveTc[cycleNum] || 0), 0, 20, 0);
      const requestedCT = clampInt(isLocked ? (lockSnap.ctDays || 0) : (state.ctAllocations[cycleNum] || 0), 0, 60, 0);

      if (depMode === 'leave_after_day5') {
        const cNeeded = Math.max(1, targetHome - 2);
        const tcGoalBeforeDepart = Math.max(0, cNeeded + saveTcReq - carryIn);
        return {
          isLocked, depMode, grayMode, targetHome, hasCustomDays,
          saveTcReq, requestedCT, cNeeded, tcGoalBeforeDepart, tcGoalWork6: tcGoalBeforeDepart + 1
        };
      } else {
        const cNeeded = Math.max(1, targetHome - 1);
        const tcGoalWork6 = Math.max(1, cNeeded + saveTcReq - carryIn);
        return {
          isLocked, depMode, grayMode, targetHome, hasCustomDays,
          saveTcReq, requestedCT, cNeeded, tcGoalBeforeDepart: tcGoalWork6 - 1, tcGoalWork6
        };
      }
    }

    // State machine variables
    let phase = 'SITE';
    let cycle = 1;
    let siteDayCounter = 0;
    let workDayCounter = 0;
    let tcEarned = 0;
    let weekWorkDays = 0;
    let autoWeekDay = 0;
    let leaveQueue = [];
    let currentSiteStart = null;
    let currentCycleObj = null;
    let activeCycleGrayMode = state.grayBoxMode;

    const cellMap = new Map();
    const cycles = [];
    const ticketCountByYear = {};

    function registerCycleLeave(departDate, earnedTcCount, departedAfterDay5) {
      const cfgTgt = getCycleTargets(cycle, tcBank);
      activeCycleGrayMode = cfgTgt.grayMode;

      const tcCarryIn = tcBank;
      const totalTcAvailable = tcCarryIn + earnedTcCount;
      const cUsed = Math.min(totalTcAvailable, cfgTgt.cNeeded);
      const tcCarryOut = Math.max(0, totalTcAvailable - cUsed);
      tcBank = tcCarryOut;

      const leaveYear = departDate.getFullYear();
      const quotaBucket = CFG.rules.ticketQuotaResetMode === 'simulation_window' ? 'ALL' : String(leaveYear);
      ticketCountByYear[quotaBucket] = (ticketCountByYear[quotaBucket] || 0) + 1;
      const ticketSeq = ticketCountByYear[quotaBucket];

      let ticketType = 'self'; // 'company' | 'self' | 'local'
      let ticketLabel = '';
      if (ticketQuota === 0) {
        ticketType = 'local';
        ticketLabel = pohSpec.ticketLabel || 'Non-Tiket (Lokal Site)';
      } else if (ticketSeq <= ticketQuota) {
        ticketType = 'company';
        ticketLabel = `${pohSpec.ticketLabel || CFG.labels.ticketCompany} (${ticketSeq}/${ticketQuota})`;
      } else {
        ticketType = 'self';
        ticketLabel = `${pohSpec.selfTicketLabel || CFG.labels.ticketSelf} (ke-${ticketSeq})`;
      }

      const isCtEligible = Boolean(ctEligibleDate && departDate >= ctEligibleDate);
      const grantedCT = isCtEligible ? Math.min(cfgTgt.requestedCT, remainingCTBalance) : 0;
      remainingCTBalance -= grantedCT;

      const queue = [];
      queue.push({ kind: 'offLeave', code: CFG.codes.off, cycle });
      for (let i = 1; i <= cUsed; i++) {
        queue.push({ kind: 'leave', code: `${CFG.codes.leave}${i}`, cycle, leaveIndex: i });
      }
      for (let i = 1; i <= grantedCT; i++) {
        queue.push({ kind: 'annualLeave', code: `${CFG.codes.annualLeave}${i}`, cycle, ctIndex: i });
      }

      const offDaysCount = departedAfterDay5 ? 2 : 1;
      const totalHomeDays = offDaysCount + cUsed + grantedCT;
      const leaveEndDate = addDays(departDate, totalHomeDays - 1);
      const returnSiteDate = addDays(leaveEndDate, cfgTgt.grayMode === 'trv' ? 2 : 1);

      const holidaysInLeave = [];
      for (let i = 0; i < totalHomeDays; i++) {
        const d = addDays(departDate, i);
        const h = getHoliday(toISODate(d));
        if (h) holidaysInLeave.push({ iso: toISODate(d), date: d, name: h.name, type: h.type });
      }

      const cycleRecord = {
        cycle,
        isLocked: cfgTgt.isLocked,
        departureMode: cfgTgt.depMode,
        grayBoxMode: cfgTgt.grayMode,
        siteStart: currentSiteStart || startDate,
        siteEnd: addDays(departDate, -1),
        departDate,
        leaveEndDate,
        returnSiteDate,
        offDaysCount,
        cDaysCount: cUsed,
        ctDaysCount: grantedCT,
        baseHomeDays: offDaysCount + cUsed,
        totalHomeDays,
        targetHomeDays: cfgTgt.targetHome,
        hasCustomDays: cfgTgt.hasCustomDays,
        saveTcRequested: cfgTgt.saveTcReq,
        tcCarryIn,
        tcEarnedThisCycle: earnedTcCount,
        tcCarryOut,
        departedAfterDay5,
        isCtEligible,
        ctEligibleDate,
        holidaysInLeave,
        ticketSeq,
        ticketQuota,
        ticketYear: leaveYear,
        ticketType,
        isCompanyTicket: ticketType === 'company',
        ticketLabel
      };
      cycles.push(cycleRecord);
      currentCycleObj = cycleRecord;
      return queue;
    }

    function resetForNextCycle() {
      phase = 'SITE';
      cycle += 1;
      siteDayCounter = 0;
      workDayCounter = 0;
      tcEarned = 0;
      weekWorkDays = 0;
      autoWeekDay = 0;
      currentSiteStart = null;
      currentCycleObj = null;
    }

    function getOverride(iso) {
      const ov = state.manualOverrides && state.manualOverrides[iso];
      if (!ov || !CFG.overrideTypes[ov.type]) return null;
      return { type: ov.type, note: ov.note || '', spec: CFG.overrideTypes[ov.type] };
    }

    let cur = startDate < windowStart ? new Date(startDate) : new Date(windowStart);

    while (cur < startDate && cur <= windowEnd) {
      const iso = toISODate(cur);
      cellMap.set(iso, {
        date: new Date(cur), iso, kind: 'preStart', code: CFG.codes.preStart,
        cycle: null, weekWork: 0, holiday: getHoliday(iso), tcBankSnap: tcBank
      });
      cur = addDays(cur, 1);
    }

    while (cur <= windowEnd) {
      const iso = toISODate(cur);
      const dow = cur.getDay();
      const holiday = getHoliday(iso);
      const ov = getOverride(iso);

      if (phase === 'LEAVE') {
        const item = leaveQueue.shift();
        cellMap.set(iso, {
          date: new Date(cur), iso,
          kind: ov ? ov.type : item.kind,
          code: ov ? ov.spec.code : item.code,
          isOverride: Boolean(ov),
          overrideNote: ov ? ov.note : '',
          originalCode: ov ? item.code : null,
          cycle: item.cycle,
          cycleInfo: currentCycleObj,
          weekWork: 0,
          holiday,
          tcBankSnap: tcBank
        });
        if (leaveQueue.length === 0) {
          if (activeCycleGrayMode === 'trv') phase = 'POST_LEAVE';
          else resetForNextCycle();
        }
        cur = addDays(cur, 1);
        continue;
      }

      if (phase === 'POST_LEAVE') {
        cellMap.set(iso, {
          date: new Date(cur), iso,
          kind: ov ? ov.type : 'postLeaveGap',
          code: ov ? ov.spec.code : CFG.codes.postLeaveGap,
          isOverride: Boolean(ov),
          overrideNote: ov ? ov.note : '',
          cycle,
          cycleInfo: currentCycleObj,
          weekWork: 0,
          holiday,
          tcBankSnap: tcBank
        });
        resetForNextCycle();
        cur = addDays(cur, 1);
        continue;
      }

      // PHASE === 'SITE'
      const tgt = getCycleTargets(cycle, tcBank);

      function handleTcCandidateDay() {
        if (ov && !ov.spec.countsAsWork) {
          siteDayCounter += 1;
          cellMap.set(iso, {
            date: new Date(cur), iso, kind: ov.type, code: ov.spec.code,
            isOverride: true, overrideNote: ov.note, cycle, weekWork: weekWorkDays,
            holiday, tcBankSnap: tcBank + tcEarned
          });
          return;
        }

        if (weekWorkDays >= minWorkPerWeek) {
          const isFinalForAfter5 = tcEarned === tgt.tcGoalBeforeDepart;
          if (!ov && isFinalForAfter5 && tgt.depMode === 'leave_after_day5') {
            leaveQueue = registerCycleLeave(new Date(cur), tcEarned, true);
            cellMap.set(iso, {
              date: new Date(cur), iso, kind: 'offDepart', code: CFG.codes.off,
              cycle, cycleInfo: currentCycleObj, weekWork: weekWorkDays,
              holiday, tcBankSnap: tcBank
            });
            phase = 'LEAVE';
          } else {
            siteDayCounter += 1;
            tcEarned += 1;
            const isLastTc = (tgt.depMode === 'work_day6' && tcEarned >= tgt.tcGoalWork6)
              || (ov && tgt.depMode === 'leave_after_day5' && tcEarned >= tgt.tcGoalWork6);
            if (isLastTc) {
              leaveQueue = registerCycleLeave(addDays(cur, 1), tcEarned, false);
              phase = 'LEAVE';
            }
            cellMap.set(iso, {
              date: new Date(cur), iso,
              kind: ov ? ov.type : (isLastTc ? 'tcLast' : 'tc'),
              code: ov ? ov.spec.code : `${CFG.codes.tc}${tcEarned}`,
              isOverride: Boolean(ov),
              overrideNote: ov ? ov.note : '',
              earnedTcFromOverride: Boolean(ov),
              cycle,
              cycleInfo: isLastTc ? currentCycleObj : null,
              weekWork: weekWorkDays,
              holiday,
              tcBankSnap: isLastTc ? tcBank : (tcBank + tcEarned)
            });
          }
        } else {
          if (!currentSiteStart) currentSiteStart = new Date(cur);
          const prevW = weekWorkDays;
          siteDayCounter += 1;
          if (!ov || ov.spec.countsAsWork) {
            workDayCounter += 1;
            weekWorkDays += 1;
          }
          const num = state.workCounterMode === 'site_day' ? siteDayCounter : workDayCounter;
          cellMap.set(iso, {
            date: new Date(cur), iso,
            kind: ov ? ov.type : 'workPartial',
            code: ov ? ov.spec.code : `${CFG.codes.work}${num}`,
            isOverride: Boolean(ov),
            overrideNote: ov ? ov.note : '',
            cycle, weekWork: prevW, holiday, tcBankSnap: tcBank + tcEarned
          });
        }
      }

      function handleRegularWorkDay() {
        if (!currentSiteStart) currentSiteStart = new Date(cur);
        siteDayCounter += 1;
        if (ov) {
          if (ov.spec.countsAsWork) {
            workDayCounter += 1;
            weekWorkDays += 1;
          }
          cellMap.set(iso, {
            date: new Date(cur), iso, kind: ov.type, code: ov.spec.code,
            isOverride: true, overrideNote: ov.note, cycle, weekWork: weekWorkDays,
            holiday, tcBankSnap: tcBank + tcEarned
          });
        } else {
          workDayCounter += 1;
          weekWorkDays += 1;
          const num = state.workCounterMode === 'site_day' ? siteDayCounter : workDayCounter;
          cellMap.set(iso, {
            date: new Date(cur), iso, kind: 'work', code: `${CFG.codes.work}${num}`,
            cycle, weekWork: weekWorkDays, holiday, tcBankSnap: tcBank + tcEarned
          });
        }
      }

      if (state.offDay === 'auto') {
        autoWeekDay += 1;
        if (autoWeekDay <= minWorkPerWeek) {
          handleRegularWorkDay();
        } else if (autoWeekDay === minWorkPerWeek + 1) {
          handleTcCandidateDay();
        } else {
          siteDayCounter += 1;
          cellMap.set(iso, {
            date: new Date(cur), iso,
            kind: ov ? ov.type : 'offSite',
            code: ov ? ov.spec.code : CFG.codes.off,
            isOverride: Boolean(ov),
            overrideNote: ov ? ov.note : '',
            cycle, weekWork: weekWorkDays, holiday, tcBankSnap: tcBank + tcEarned
          });
          autoWeekDay = 0;
          weekWorkDays = 0;
        }
      } else {
        const fixedOffDow = Number(state.offDay);
        const tcCandidateDow = (fixedOffDow + 6) % 7;
        if (dow === fixedOffDow) {
          if (siteDayCounter > 0) siteDayCounter += 1;
          cellMap.set(iso, {
            date: new Date(cur), iso,
            kind: ov ? ov.type : 'offSite',
            code: ov ? ov.spec.code : CFG.codes.off,
            isOverride: Boolean(ov),
            overrideNote: ov ? ov.note : '',
            cycle, weekWork: weekWorkDays, holiday, tcBankSnap: tcBank + tcEarned
          });
          weekWorkDays = 0;
        } else if (dow === tcCandidateDow) {
          handleTcCandidateDay();
        } else {
          handleRegularWorkDay();
        }
      }

      cur = addDays(cur, 1);
    }

    const totals = {
      work: 0, tc: 0, off: 0, leave: 0, annualLeave: 0, postLeaveGap: 0,
      overrides: 0, holidaysOnWork: 0
    };

    const monthRows = months.map(({ year, month }) => {
      const dim = daysInMonth(year, month);
      const rowStats = { work: 0, tc: 0, leave: 0, annualLeave: 0 };
      const cells = [];

      for (let d = 1; d <= 31; d++) {
        if (d > dim) {
          cells.push({ kind: 'nonDate', code: CFG.codes.nonDate, iso: null });
          continue;
        }
        const dt = new Date(year, month, d);
        const iso = toISODate(dt);
        const cell = cellMap.get(iso) || {
          date: dt, iso, kind: 'preStart', code: CFG.codes.preStart, holiday: getHoliday(iso)
        };
        cells.push(cell);

        if (cell.isOverride) totals.overrides++;
        if (cell.kind === 'work' || cell.kind === 'workPartial' || cell.kind === 'duty') {
          rowStats.work++; totals.work++;
        } else if (cell.kind === 'tc' || cell.kind === 'tcLast') {
          rowStats.tc++; totals.tc++;
        } else if (cell.kind === 'leave') {
          rowStats.leave++; totals.leave++;
        } else if (cell.kind === 'annualLeave') {
          rowStats.annualLeave++; totals.annualLeave++;
        } else if (cell.kind === 'offSite' || cell.kind === 'offDepart' || cell.kind === 'offLeave' || cell.kind === 'customOff') {
          totals.off++;
        } else if (cell.kind === 'postLeaveGap') {
          totals.postLeaveGap++;
        }

        if (cell.holiday && cell.holiday.type === 'national' &&
          ['work', 'workPartial', 'tc', 'tcLast', 'duty'].includes(cell.kind)) {
          totals.holidaysOnWork++;
        }
      }

      return { year, month, label: `${CFG.labels.monthNamesShort[month]} ${year}`, cells, stats: rowStats };
    });

    const totalCTUsed = cycles.reduce((sum, c) => sum + c.ctDaysCount, 0);
    const companyTicketsUsed = cycles.filter(c => c.ticketType === 'company').length;
    const selfTicketsUsed = cycles.filter(c => c.ticketType === 'self').length;
    const endingTcBank = phase === 'SITE' ? (tcBank + tcEarned) : tcBank;

    return {
      months: monthRows,
      cellMap,
      cycles,
      totals,
      startDate,
      joinDate,
      ctEligibleDate,
      pohSpec,
      ticketQuota,
      totalCTUsed,
      remainingCTBalance,
      initialTcBalance: clampInt(state.initialTcBalance, 0, 30, 0),
      endingTcBank,
      companyTicketsUsed,
      selfTicketsUsed,
      targetHomeDays: globalTargetHome
    };
  }

  // ---------- RENDERING ----------
  function renderKanSignatures() {
    const sigGrid = document.getElementById('printSignatures');
    if (!sigGrid) return;
    let sigs = CFG.signatures;
    try {
      const saved = localStorage.getItem('ts_sim_signatures_KAN_v3');
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

  function renderStaticBrand() {
    setText('printCompanyTitle', `${CFG.app.companyName} — Jadwal Simulasi Roster & Cuti`);
    setText('printSubtitle', CFG.app.subtitle);

    // Populate Grade dropdown
    const gradeSelect = document.getElementById('inputGrade');
    if (gradeSelect) {
      gradeSelect.innerHTML = '';
      (CFG.employeeGrades || ['Non-Staff', 'Staff', 'SPV / Manager']).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        gradeSelect.appendChild(opt);
      });
    }

    // Populate POH Category dropdown
    const pohSelect = document.getElementById('inputPohCategory');
    if (pohSelect && CFG.pohRules) {
      pohSelect.innerHTML = '';
      Object.entries(CFG.pohRules).forEach(([k, spec]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = spec.label;
        pohSelect.appendChild(opt);
      });
    }

    const offSelect = document.getElementById('inputOffDay');
    if (offSelect) {
      offSelect.innerHTML = `<option value="auto">Otomatis (Ikut Siklus 5:2 dari ${escapeHtml(CFG.codes.work)}1)</option>`;
      CFG.labels.dayNamesFull.forEach((name, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = `Tetap Hari ${name} (Wajib ${CFG.rules.workDaysPerWeek} hari ${CFG.codes.work} dulu)`;
        offSelect.appendChild(opt);
      });
    }

    const fillSelect = (id, entries, transform) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      entries.forEach(([k, label]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = transform ? transform(label) : label;
        el.appendChild(opt);
      });
    };

    fillSelect('inputCounterMode', Object.entries(CFG.labels.workCounterModes),
      l => l.replace(/X/g, CFG.codes.work).replace(/TC/g, CFG.codes.tc).replace(/OFF/g, CFG.codes.off));
    fillSelect('inputGrayMode', Object.entries(CFG.labels.grayBoxModes),
      l => l.replace(/TRV\?/g, CFG.codes.postLeaveGap || 'TRV?').replace(/X1/g, `${CFG.codes.work}1`));
    fillSelect('inputViewMode', Object.entries(CFG.labels.viewModes),
      l => l.replace(/X1/g, `${CFG.codes.work}1`));

    setText('labelDepartWork6', CFG.labels.departureModes.work_day6.replace(/TC/g, CFG.codes.tc).replace(/\bC\b/g, CFG.codes.leave));
    setText('labelDepartAfter5', CFG.labels.departureModes.leave_after_day5.replace(/OFF/g, CFG.codes.off).replace(/\bC\b/g, CFG.codes.leave));
    setText('labelStartX1', `Mulai Kerja (${CFG.codes.work}1) di Site`);
    setText('labelMinDaysHint', `Kunci minimal SOP: ${CFG.rules.minHomeLeaveDays} hari. Periode yg dikunci 🔒 tidak berubah saat default diganti.`);

    const presetContainer = document.getElementById('presetRow');
    if (presetContainer) {
      presetContainer.innerHTML = '';
      CFG.rules.homeLeavePresets.filter(n => n >= CFG.rules.minHomeLeaveDays).forEach(days => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-btn';
        btn.dataset.days = String(days);
        btn.textContent = `${days} Hari`;
        btn.addEventListener('click', () => {
          state.targetHomeDays = days;
          saveAndRender();
        });
        presetContainer.appendChild(btn);
      });
    }

    renderKanSignatures();
  }

  function renderLegend() {
    const container = document.getElementById('legendBar');
    if (!container) return;
    const c = CFG.codes;
    const items = [
      { key: 'work', sample: `${c.work}1` },
      { key: 'workPartial', sample: `${c.work}*` },
      { key: 'tc', sample: `${c.tc}1` },
      { key: 'tcLast', sample: `${c.tc}n` },
      { key: 'offSite', sample: c.off },
      { key: 'offLeave', sample: c.off },
      { key: 'leave', sample: `${c.leave}1` },
      { key: 'annualLeave', sample: `${c.annualLeave}1` },
      { key: 'postLeaveGap', sample: c.postLeaveGap || 'GAP' },
      { key: 'sick', sample: 'S' },
      { key: 'permit', sample: 'I' },
      { key: 'duty', sample: 'DL' }
    ];

    let html = `<span class="legend-title">Legenda:</span>`;
    items.forEach(it => {
      const col = CFG.colors[it.key];
      if (!col) return;
      html += `<span class="legend-item"><span class="legend-swatch" style="background:${col.bg};color:${col.text};border-color:${col.border};">${escapeHtml(it.sample)}</span><span>${escapeHtml(col.label)}</span></span>`;
    });
    html += `<span class="legend-item"><span class="legend-swatch" style="background:#FEF2F2;color:#DC2626;border-color:#FECACA;">◥</span><span>Libur Nasional</span></span>`;
    html += `<span class="legend-item"><span class="legend-swatch" style="background:#FFFBEB;color:#D97706;border-color:#FDE68A;">◥</span><span>Cuti Bersama</span></span>`;
    container.innerHTML = html;
  }

  function syncFormInputs() {
    setVal('inputName', state.employeeName);
    setVal('inputNik', state.employeeNik);
    setVal('inputGrade', state.employeeGrade);
    setVal('inputRole', state.employeeRole);
    setVal('inputPohCategory', state.pohCategory);
    setVal('inputPohCity', state.pohCity);
    setVal('inputJoinDate', state.joinDate);
    setVal('inputStartDate', state.startDate);
    setVal('inputHomeDays', state.targetHomeDays);
    setVal('inputOffDay', String(state.offDay));
    setVal('inputCounterMode', state.workCounterMode);
    setVal('inputGrayMode', state.grayBoxMode);
    setVal('inputViewMode', state.viewMode);
    setVal('inputCtBalance', state.annualLeaveBalance);
    setVal('inputInitialTc', state.initialTcBalance);

    const holCb = document.getElementById('inputShowHolidays');
    if (holCb) holCb.checked = Boolean(state.showHolidays);

    document.querySelectorAll('input[name="departureMode"]').forEach(r => {
      r.checked = r.value === state.departureMode;
      const card = r.closest('.radio-card');
      if (card) card.classList.toggle('selected', r.checked);
    });
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.days) === Number(state.targetHomeDays));
    });
  }

  function renderKPIs(sim) {
    const c = CFG.codes;
    setText('kpiWorkLabel', `Hari Kerja (${c.work})`);
    setText('kpiWorkVal', `${sim.totals.work} hr`);
    setText('kpiWorkSub', `${sim.totals.off} hr ${c.off} • ${sim.totals.holidaysOnWork} tgl merah kerja`);

    setText('kpiTcLabel', `Tabungan (${c.tc})`);
    setText('kpiTcVal', `${sim.totals.tc} hr`);
    setText('kpiTcSub', `Awal: ${sim.initialTcBalance} • Sisa akhir: ${sim.endingTcBank} ${c.tc}`);

    setText('kpiLeaveLabel', `Cuti ${c.leave} Diambil`);
    setText('kpiLeaveVal', `${sim.totals.leave} hr`);
    setText('kpiLeaveSub', `${sim.cycles.length} periode cuti`);

    setText('kpiCtLabel', `Cuti Tahunan (${c.annualLeave})`);
    setText('kpiCtVal', `${sim.totalCTUsed} hr`);
    setText('kpiCtSub', `Sisa saldo: ${sim.remainingCTBalance} hr`);

    setText('kpiTicketLabel', `Hak Tiket (${sim.pohSpec.shortLabel || 'P.O.H'})`);
    if (sim.ticketQuota === 0) {
      setText('kpiTicketVal', 'Non-Tiket');
      setText('kpiTicketSub', `${sim.pohSpec.shortLabel} • ${state.pohCity || 'Lokal'}`);
    } else {
      setText('kpiTicketVal', `${sim.companyTicketsUsed} / ${sim.ticketQuota}`);
      setText('kpiTicketSub', sim.selfTicketsUsed > 0
        ? `+ ${sim.selfTicketsUsed} ${sim.pohSpec.selfTicketLabel || CFG.labels.ticketSelf}`
        : `POH: ${state.pohCity || sim.pohSpec.shortLabel}`);
    }

    setText('kpiServiceLabel', 'Status Hak CT');
    if (!sim.joinDate) {
      setText('kpiServiceVal', 'Belum Diisi');
      setText('kpiServiceSub', 'Isi Join Date');
    } else {
      const startEligible = sim.startDate >= sim.ctEligibleDate;
      setText('kpiServiceVal', startEligible ? 'Aktif' : 'Menunggu 1 Thn');
      setText('kpiServiceSub', `Aktif: ${formatDateID(sim.ctEligibleDate, true)}`);
    }

    const joinHint = document.getElementById('joinDateHint');
    if (joinHint) {
      if (!sim.joinDate) {
        joinHint.className = 'field-hint warn';
        joinHint.textContent = 'Isi Tanggal Masuk untuk mengaktifkan validasi hak Cuti Tahunan (CT).';
      } else {
        const eligibleNow = sim.startDate >= sim.ctEligibleDate;
        joinHint.className = eligibleNow ? 'field-hint ok' : 'field-hint warn';
        joinHint.textContent = eligibleNow
          ? `Masa kerja ≥ 1 tahun sejak ${formatDateID(sim.ctEligibleDate, true)} — hak ${c.annualLeave} aktif.`
          : `Hak ${c.annualLeave} baru aktif pada periode cuti mulai ${formatDateID(sim.ctEligibleDate, true)}.`;
      }
    }

    const pohHint = document.getElementById('pohRuleHint');
    if (pohHint) {
      pohHint.className = sim.ticketQuota === 0 ? 'field-hint' : 'field-hint ok';
      pohHint.textContent = sim.ticketQuota === 0
        ? `Aturan P.O.H Aktif: ${sim.pohSpec.label} — tidak memakai kuota tiket perusahaan.`
        : `Aturan P.O.H Aktif: ${sim.pohSpec.label} (${state.pohCity || '-'}) — kuota ${sim.ticketQuota}×/tahun.`;
    }

    const printBar = document.getElementById('printEmpBar');
    if (printBar) {
      const offLabel = state.offDay === 'auto' ? 'Otomatis 5:2' : `Tetap ${CFG.labels.dayNamesFull[Number(state.offDay)]}`;
      const depLabel = state.departureMode === 'work_day6' ? 'Kerja Hari ke-6' : 'Pulang stlh Hari ke-5';
      const lockedCount = Object.keys(state.lockedCycles || {}).length;
      printBar.innerHTML = `
        <div><strong>Nama:</strong> ${escapeHtml(state.employeeName || '-')}</div>
        <div><strong>NIK / Level:</strong> ${escapeHtml(state.employeeNik || '-')} (${escapeHtml(state.employeeGrade || '-')})</div>
        <div><strong>Jabatan:</strong> ${escapeHtml(state.employeeRole || '-')}</div>
        <div><strong>P.O.H:</strong> ${escapeHtml(sim.pohSpec.shortLabel || '-')} — ${escapeHtml(state.pohCity || '-')}</div>
        <div><strong>Join Date:</strong> ${formatDateID(sim.joinDate, true)}</div>
        <div><strong>Mulai ${escapeHtml(c.work)}1:</strong> ${formatDateID(sim.startDate, true)}</div>
        <div><strong>Saldo TC:</strong> Awal ${sim.initialTcBalance} / Akhir ${sim.endingTcBank} hr</div>
        <div><strong>${escapeHtml(c.off)} / Pulang:</strong> ${escapeHtml(offLabel)} / ${escapeHtml(depLabel)}${lockedCount ? ` (${lockedCount} dikunci)` : ''}</div>
      `;
    }
  }

  function renderMatrix(sim) {
    const table = document.getElementById('matrixTable');
    if (!table) return;
    const c = CFG.codes;
    setText('matrixMeta', `Menampilkan ${sim.months[0].label} s/d ${sim.months[sim.months.length - 1].label} • Klik tanggal mana saja untuk detail, info hari libur, atau override manual (S/I/DL/A)`);

    const ovCount = Object.keys(state.manualOverrides || {}).length;
    const ovWrap = document.getElementById('overrideSummaryWrap');
    if (ovWrap) {
      ovWrap.style.display = ovCount > 0 ? 'flex' : 'none';
      setText('overrideCountText', `${ovCount} Override Aktif`);
    }

    let thead = '<thead><tr><th class="col-month">Bulan</th>';
    for (let d = 1; d <= 31; d++) thead += `<th>${d}</th>`;
    thead += `<th class="col-sum col-sum-first">${escapeHtml(c.work)}</th><th class="col-sum">${escapeHtml(c.tc)}</th><th class="col-sum">${escapeHtml(c.leave)}</th><th class="col-sum">${escapeHtml(c.annualLeave)}</th></tr></thead>`;

    let tbody = '<tbody>';
    sim.months.forEach(row => {
      tbody += `<tr><td class="col-month">${escapeHtml(row.label)}</td>`;
      row.cells.forEach(cell => {
        const isSelected = cell.iso && cell.iso === state.selectedDateKey;
        const clickable = cell.iso && cell.kind !== 'preStart' && cell.kind !== 'nonDate';
        const holCls = (state.showHolidays && cell.holiday)
          ? (cell.holiday.type === 'national' ? ' has-holiday-national' : ' has-holiday-joint')
          : '';
        const ovCls = cell.isOverride ? ' is-override' : '';
        const cls = `day-cell kind-${cell.kind}${holCls}${ovCls}${isSelected ? ' active-cell' : ''}`;
        const dataAttr = clickable ? ` data-iso="${cell.iso}"` : '';
        const holTip = cell.holiday ? ` • [${cell.holiday.type === 'national' ? 'LIBUR NASIONAL' : 'Cuti Bersama'}: ${cell.holiday.name}]` : '';
        const noteTip = cell.overrideNote ? ` • Catatan: ${cell.overrideNote}` : '';
        const titleAttr = clickable ? ` title="${escapeHtml(formatDateFullID(cell.date))} — ${escapeHtml(cell.code)}${escapeHtml(holTip)}${escapeHtml(noteTip)}"` : '';
        tbody += `<td class="${cls}"${dataAttr}${titleAttr}>${escapeHtml(cell.code)}</td>`;
      });
      tbody += `<td class="col-sum col-sum-first">${row.stats.work}</td><td class="col-sum">${row.stats.tc}</td><td class="col-sum">${row.stats.leave}</td><td class="col-sum">${row.stats.annualLeave}</td></tr>`;
    });
    tbody += '</tbody>';

    const tfoot = `
      <tfoot><tr>
        <td class="col-month">TOTAL</td>
        <td colspan="31" style="text-align:right;padding-right:10px;color:#475569;font-weight:600;">
          12 Bulan: ${sim.cycles.length} Periode • ${sim.totals.off} hr ${escapeHtml(c.off)} • ${sim.totals.holidaysOnWork} Tgl Merah Kerja${sim.totals.overrides ? ` • ${sim.totals.overrides} Override` : ''}
        </td>
        <td class="col-sum col-sum-first">${sim.totals.work}</td>
        <td class="col-sum">${sim.totals.tc}</td>
        <td class="col-sum">${sim.totals.leave}</td>
        <td class="col-sum">${sim.totals.annualLeave}</td>
      </tr></tfoot>
    `;

    table.innerHTML = thead + tbody + tfoot;
    table.querySelectorAll('td[data-iso]').forEach(td => {
      td.addEventListener('click', () => {
        state.selectedDateKey = td.dataset.iso;
        table.querySelectorAll('.active-cell').forEach(el => el.classList.remove('active-cell'));
        td.classList.add('active-cell');
        renderInspector(sim);
      });
    });
  }

  function renderInspector(sim) {
    const bar = document.getElementById('inspectorBar');
    if (!bar) return;

    let cell = state.selectedDateKey ? sim.cellMap.get(state.selectedDateKey) : null;
    if (!cell || cell.kind === 'preStart') {
      for (const item of sim.cellMap.values()) {
        if (item.kind === 'tcLast' || item.kind === 'offDepart') { cell = item; break; }
      }
      if (!cell) cell = sim.cellMap.get(toISODate(sim.startDate));
    }

    if (!cell) {
      bar.innerHTML = `<div class="inspector-desc">Klik salah satu tanggal pada matriks untuk melihat detail, status hari libur, dan kontrol override manual.</div>`;
      return;
    }

    const msgTpl = CFG.messages[cell.kind] || CFG.messages.work;
    const color = CFG.colors[cell.kind] || CFG.colors.work;
    const vars = {
      code: cell.code, workCode: CFG.codes.work, tcCode: CFG.codes.tc,
      offCode: CFG.codes.off, cCode: CFG.codes.leave, ctCode: CFG.codes.annualLeave,
      cycle: cell.cycle || 1, weekWork: cell.weekWork ?? 0, minWork: CFG.rules.workDaysPerWeek
    };

    const title = formatTemplate(msgTpl.title, vars);
    let desc = formatTemplate(msgTpl.desc, vars);
    let advice = formatTemplate(msgTpl.advice, vars);

    if (cell.earnedTcFromOverride) {
      desc += ` (Karena syarat ${CFG.rules.workDaysPerWeek} hari kerja terpenuhi dan Dinas Luar dihitung kerja, hak ${CFG.codes.tc} minggu ini tetap terbit.)`;
    }
    if (cell.holiday && ['work', 'workPartial', 'tc', 'tcLast', 'duty'].includes(cell.kind)) {
      advice += ` Hari ini jatuh pada ${cell.holiday.type === 'national' ? 'Hari Libur Nasional' : 'Cuti Bersama'} (${cell.holiday.name}) — cek perhitungan lembur/insentif hari besar sesuai SOP.`;
    }

    let extraMeta = cell.cycle ? `Siklus ke-${cell.cycle}` : 'Pra-Mulai';
    extraMeta += ` • Bank ${CFG.codes.tc}: ${cell.tcBankSnap ?? 0} hr`;
    if (cell.cycleInfo) extraMeta += ` • ${cell.cycleInfo.ticketLabel}`;

    const holHtml = cell.holiday
      ? `<div class="inspector-holiday-banner ${cell.holiday.type}">${cell.holiday.type === 'national' ? '🎉 Libur Nasional' : '📅 Cuti Bersama'}: ${escapeHtml(cell.holiday.name)}</div>`
      : '';

    const curOv = state.manualOverrides[cell.iso] || null;
    const ovButtons = [
      { key: '', label: 'Auto (Normal)' },
      ...Object.entries(CFG.overrideTypes).map(([k, v]) => ({ key: k, label: `${v.code} (${v.label.split(' ')[0]})` }))
    ].map(b => `<button type="button" class="override-chip${(curOv ? curOv.type : '') === b.key ? ' active' : ''}" data-ov-type="${b.key}">${escapeHtml(b.label)}</button>`).join('');

    bar.innerHTML = `
      <div class="inspector-left">
        <div class="inspector-badge" style="background:${color.bg};color:${color.text};border-color:${color.border};">${escapeHtml(cell.code || '-')}</div>
        <div>
          <h4 class="inspector-title">${escapeHtml(title)}</h4>
          <div class="inspector-date">${escapeHtml(formatDateFullID(cell.date))} &bull; ${escapeHtml(extraMeta)}</div>
          ${holHtml}
          <p class="inspector-desc">${escapeHtml(desc)}</p>
        </div>
      </div>
      <div class="inspector-advice">
        <strong>Catatan &amp; Saran HR</strong>
        ${escapeHtml(advice)}
      </div>
      <div class="inspector-override-panel">
        <div class="override-btn-group">
          <span style="font-size:11.5px;font-weight:700;color:#334155;margin-right:4px;">Override Tanggal Ini:</span>
          ${ovButtons}
        </div>
        <input type="text" class="override-note-input" id="inspectorOvNote"
          placeholder="Catatan opsional (misal: SKD Demam / SPPD)..."
          value="${escapeHtml(curOv ? curOv.note : '')}"
          ${curOv ? '' : 'disabled'} />
      </div>
    `;

    bar.querySelectorAll('[data-ov-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.ovType;
        if (!t) {
          delete state.manualOverrides[cell.iso];
          showToast(`Tanggal ${formatDateID(cell.date, true)} dikembalikan ke mode Auto.`);
        } else {
          const existingNote = state.manualOverrides[cell.iso]?.note || '';
          state.manualOverrides[cell.iso] = { type: t, note: existingNote };
          showToast(`Override ${CFG.overrideTypes[t].code} diterapkan pada ${formatDateID(cell.date, true)}.`);
        }
        state.selectedDateKey = cell.iso;
        saveAndRender();
      });
    });

    const noteEl = document.getElementById('inspectorOvNote');
    if (noteEl && curOv) {
      noteEl.addEventListener('change', () => {
        if (state.manualOverrides[cell.iso]) {
          state.manualOverrides[cell.iso].note = noteEl.value.trim();
          saveState();
          renderMatrix(lastSimulation);
          showToast('Catatan override tersimpan.');
        }
      });
    }
  }

  function renderCyclesTable(sim) {
    const tbody = document.getElementById('cyclesTbody');
    if (!tbody) return;
    const c = CFG.codes;

    if (!sim.cycles.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748B;padding:18px;">Belum ada periode cuti dalam rentang 12 bulan ini.</td></tr>`;
      return;
    }

    tbody.innerHTML = sim.cycles.map(cyc => {
      const pillClass = cyc.ticketType === 'local'
        ? 'pill-local'
        : (cyc.ticketType === 'company' ? 'pill-company' : 'pill-self');
      const ticketHtml = `
        <span class="pill ${pillClass}">${escapeHtml(cyc.ticketLabel)}</span>
        <div class="poh-route-meta">POH: ${escapeHtml(state.pohCity || sim.pohSpec.shortLabel || '-')}</div>
      `;

      const disAttr = cyc.isLocked ? 'disabled' : '';
      let ctControlHtml = '';
      if (!sim.joinDate) ctControlHtml = `<span class="pill pill-locked">Isi Join Date</span>`;
      else if (!cyc.isCtEligible) ctControlHtml = `<span class="pill pill-locked" title="Aktif mulai ${escapeHtml(formatDateID(cyc.ctEligibleDate, true))}">Terkunci (&lt; 1 thn)</span>`;
      else {
        const maxForThis = cyc.ctDaysCount + sim.remainingCTBalance;
        ctControlHtml = `
          <div class="ct-stepper">
            <button type="button" data-ct-dec="${cyc.cycle}" ${cyc.isLocked || cyc.ctDaysCount <= 0 ? 'disabled' : ''}>−</button>
            <input type="number" min="0" max="${maxForThis}" value="${cyc.ctDaysCount}" data-ct-input="${cyc.cycle}" ${disAttr} />
            <button type="button" data-ct-inc="${cyc.cycle}" ${cyc.isLocked || sim.remainingCTBalance <= 0 ? 'disabled' : ''}>+</button>
          </div>`;
      }

      const natHols = cyc.holidaysInLeave.filter(h => h.type === 'national');
      const holBadge = natHols.length
        ? `<div class="badge-holiday-hit" title="${escapeHtml(natHols.map(h => h.name).join(', '))}">🎉 ${escapeHtml(natHols[0].name)}${natHols.length > 1 ? ` (+${natHols.length - 1})` : ''}</div>`
        : '';

      const breakdown = `${cyc.offDaysCount} ${c.off} + ${cyc.cDaysCount} ${c.leave}${cyc.ctDaysCount > 0 ? ` + ${cyc.ctDaysCount} ${c.annualLeave}` : ''}`;

      return `
        <tr class="${cyc.isLocked ? 'cycle-locked' : ''}">
          <td>
            <div>
              <strong>Periode ${cyc.cycle}</strong>
              ${cyc.hasCustomDays ? '<span class="badge-custom">Custom</span>' : ''}
              ${cyc.isLocked ? '<span class="badge-locked-print">Terkunci</span>' : ''}
            </div>
            <button type="button" class="btn-lock${cyc.isLocked ? ' locked' : ''}" data-lock-toggle="${cyc.cycle}"
              title="${cyc.isLocked ? 'Klik untuk membuka kunci periode ini agar bisa diedit kembali' : 'Kunci periode ini sebagai realisasi/history agar tidak berubah saat skema global diubah'}">
              ${cyc.isLocked ? '🔒 Terkunci' : '🔓 Kunci Periode'}
            </button>
            ${holBadge}
          </td>
          <td>${escapeHtml(formatDateID(cyc.siteStart, true))} – ${escapeHtml(formatDateID(cyc.siteEnd, true))}</td>
          <td><strong>${escapeHtml(formatDateID(cyc.departDate, true))}</strong><br><span style="font-size:11px;color:#64748B;">${escapeHtml(CFG.labels.dayNamesFull[cyc.departDate.getDay()])}</span></td>
          <td>${escapeHtml(formatDateID(cyc.leaveEndDate, true))}<br><span style="font-size:11px;color:#64748B;">Kembali ${escapeHtml(c.work)}1: ${escapeHtml(formatDateID(cyc.returnSiteDate, true))}</span></td>
          <td>
            <div class="ct-stepper">
              <button type="button" data-dur-dec="${cyc.cycle}" ${cyc.isLocked || cyc.targetHomeDays <= CFG.rules.minHomeLeaveDays ? 'disabled' : ''}>−</button>
              <input type="number" min="${CFG.rules.minHomeLeaveDays}" max="${CFG.rules.maxHomeLeaveDays}" value="${cyc.targetHomeDays}" data-dur-input="${cyc.cycle}" ${disAttr} />
              <button type="button" data-dur-inc="${cyc.cycle}" ${cyc.isLocked || cyc.targetHomeDays >= CFG.rules.maxHomeLeaveDays ? 'disabled' : ''}>+</button>
            </div>
            <div class="tc-flow-meta"><strong>Total: ${cyc.totalHomeDays} hr</strong> (${escapeHtml(breakdown)})</div>
          </td>
          <td>
            <div class="ct-stepper" title="Jumlah TC yang sengaja ditabung / dibawa ke periode berikutnya">
              <button type="button" data-save-dec="${cyc.cycle}" ${cyc.isLocked || cyc.saveTcRequested <= 0 ? 'disabled' : ''}>−</button>
              <input type="number" min="0" max="20" value="${cyc.saveTcRequested}" data-save-input="${cyc.cycle}" ${disAttr} />
              <button type="button" data-save-inc="${cyc.cycle}" ${disAttr}>+</button>
            </div>
            <div class="tc-flow-meta">Awal: ${cyc.tcCarryIn} • +${cyc.tcEarnedThisCycle} • Pakai: ${cyc.cDaysCount} • <strong>Sisa: ${cyc.tcCarryOut}</strong></div>
          </td>
          <td>${ctControlHtml}</td>
          <td>${ticketHtml}</td>
        </tr>
      `;
    }).join('');

    // Bind Lock/Unlock buttons
    tbody.querySelectorAll('[data-lock-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cycNum = Number(btn.dataset.lockToggle);
        if (state.lockedCycles[cycNum]) {
          delete state.lockedCycles[cycNum];
          showToast(`Periode ${cycNum} dibuka kembali (dapat diubah).`);
        } else {
          const rec = sim.cycles.find(x => x.cycle === cycNum);
          if (rec) {
            state.lockedCycles[cycNum] = {
              targetHomeDays: rec.targetHomeDays,
              saveTc: rec.saveTcRequested,
              ctDays: rec.ctDaysCount,
              departureMode: rec.departureMode,
              grayBoxMode: rec.grayBoxMode,
              lockedAt: new Date().toISOString()
            };
            showToast(`Periode ${cycNum} dikunci (${rec.targetHomeDays} hari). Perubahan skema global tidak akan mengubah periode ini.`);
          }
        }
        saveAndRender();
      });
    });

    // Bind Flexible Duration steppers
    const setCycleDur = (cyc, val) => {
      if (state.lockedCycles[cyc]) return;
      const clamped = clampInt(val, CFG.rules.minHomeLeaveDays, CFG.rules.maxHomeLeaveDays, state.targetHomeDays);
      if (clamped === state.targetHomeDays) delete state.cycleHomeDays[cyc];
      else state.cycleHomeDays[cyc] = clamped;
      saveAndRender();
    };
    tbody.querySelectorAll('[data-dur-dec]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.durDec);
      const cur = state.cycleHomeDays[cyc] ?? state.targetHomeDays;
      setCycleDur(cyc, cur - 1);
    }));
    tbody.querySelectorAll('[data-dur-inc]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.durInc);
      const cur = state.cycleHomeDays[cyc] ?? state.targetHomeDays;
      setCycleDur(cyc, cur + 1);
    }));
    tbody.querySelectorAll('[data-dur-input]').forEach(inp => inp.addEventListener('change', () => {
      setCycleDur(Number(inp.dataset.durInput), inp.value);
    }));

    // Bind Save/Carry-Over TC steppers
    const setCycleSave = (cyc, val) => {
      if (state.lockedCycles[cyc]) return;
      const clamped = clampInt(val, 0, 20, 0);
      if (clamped === 0) delete state.cycleSaveTc[cyc];
      else state.cycleSaveTc[cyc] = clamped;
      saveAndRender();
    };
    tbody.querySelectorAll('[data-save-dec]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.saveDec);
      setCycleSave(cyc, (state.cycleSaveTc[cyc] || 0) - 1);
    }));
    tbody.querySelectorAll('[data-save-inc]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.saveInc);
      setCycleSave(cyc, (state.cycleSaveTc[cyc] || 0) + 1);
    }));
    tbody.querySelectorAll('[data-save-input]').forEach(inp => inp.addEventListener('change', () => {
      setCycleSave(Number(inp.dataset.saveInput), inp.value);
    }));

    // Bind CT steppers
    tbody.querySelectorAll('[data-ct-dec]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.ctDec);
      if (state.lockedCycles[cyc]) return;
      state.ctAllocations[cyc] = Math.max(0, (Number(state.ctAllocations[cyc]) || 0) - 1);
      saveAndRender();
    }));
    tbody.querySelectorAll('[data-ct-inc]').forEach(b => b.addEventListener('click', () => {
      const cyc = Number(b.dataset.ctInc);
      if (state.lockedCycles[cyc]) return;
      state.ctAllocations[cyc] = (Number(state.ctAllocations[cyc]) || 0) + 1;
      saveAndRender();
    }));
    tbody.querySelectorAll('[data-ct-input]').forEach(inp => inp.addEventListener('change', () => {
      const cyc = Number(inp.dataset.ctInput);
      if (state.lockedCycles[cyc]) return;
      state.ctAllocations[cyc] = Math.max(0, Math.floor(Number(inp.value) || 0));
      saveAndRender();
    }));
  }

  // ---------- SHAREABLE URL & SCENARIO MANAGER ----------
  function encodeStateToHash() {
    const payload = {
      v: 2,
      n: state.employeeName, k: state.employeeNik, r: state.employeeRole,
      gr: state.employeeGrade, pc: state.pohCategory, pct: state.pohCity,
      j: state.joinDate, s: state.startDate, h: state.targetHomeDays,
      o: state.offDay, d: state.departureMode, w: state.workCounterMode,
      g: state.grayBoxMode, vm: state.viewMode, sh: state.showHolidays ? 1 : 0,
      cb: state.annualLeaveBalance, tb: state.initialTcBalance,
      ct: state.ctAllocations, ch: state.cycleHomeDays,
      cs: state.cycleSaveTc, lk: state.lockedCycles, ov: state.manualOverrides
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `#s=${b64}`;
  }

  function applyImportedPayload(p) {
    if (!p || typeof p !== 'object') return false;
    const def = createDefaultState();
    Object.assign(state, def);
    if (p.v === 2) {
      if (p.n !== undefined) state.employeeName = String(p.n);
      if (p.k !== undefined) state.employeeNik = String(p.k);
      if (p.r !== undefined) state.employeeRole = String(p.r);
      if (p.gr !== undefined) state.employeeGrade = String(p.gr);
      if (p.pc !== undefined) state.pohCategory = String(p.pc);
      if (p.pct !== undefined) state.pohCity = String(p.pct);
      if (p.j !== undefined) state.joinDate = String(p.j);
      if (p.s !== undefined) state.startDate = String(p.s);
      if (p.h !== undefined) state.targetHomeDays = clampInt(p.h, CFG.rules.minHomeLeaveDays, CFG.rules.maxHomeLeaveDays, def.targetHomeDays);
      if (p.o !== undefined) state.offDay = String(p.o);
      if (p.d !== undefined) state.departureMode = String(p.d);
      if (p.w !== undefined) state.workCounterMode = String(p.w);
      if (p.g !== undefined) state.grayBoxMode = String(p.g);
      if (p.vm !== undefined) state.viewMode = String(p.vm);
      if (p.sh !== undefined) state.showHolidays = Boolean(p.sh);
      if (p.cb !== undefined) state.annualLeaveBalance = clampInt(p.cb, 0, 60, def.annualLeaveBalance);
      if (p.tb !== undefined) state.initialTcBalance = clampInt(p.tb, 0, 30, 0);
      if (p.ct && typeof p.ct === 'object') state.ctAllocations = { ...p.ct };
      if (p.ch && typeof p.ch === 'object') state.cycleHomeDays = { ...p.ch };
      if (p.cs && typeof p.cs === 'object') state.cycleSaveTc = { ...p.cs };
      if (p.lk && typeof p.lk === 'object') state.lockedCycles = { ...p.lk };
      if (p.ov && typeof p.ov === 'object') state.manualOverrides = { ...p.ov };
    } else {
      Object.assign(state, p);
      state.targetHomeDays = clampInt(state.targetHomeDays, CFG.rules.minHomeLeaveDays, CFG.rules.maxHomeLeaveDays, def.targetHomeDays);
      state.initialTcBalance = clampInt(state.initialTcBalance, 0, 30, 0);
      state.ctAllocations = state.ctAllocations || {};
      state.cycleHomeDays = state.cycleHomeDays || {};
      state.cycleSaveTc = state.cycleSaveTc || {};
      state.lockedCycles = state.lockedCycles || {};
      state.manualOverrides = state.manualOverrides || {};
    }
    return true;
  }

  function loadStateFromHash() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#s=')) return false;
    try {
      let b64 = hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const json = decodeURIComponent(escape(atob(b64)));
      return applyImportedPayload(JSON.parse(json));
    } catch (_) {
      return false;
    }
  }

  function copyShareLink() {
    const hash = encodeStateToHash();
    try { history.replaceState(null, '', hash); } catch (_) {}
    const fullUrl = window.location.href.split('#')[0] + hash;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Link simulasi berhasil disalin! Siap ditempel ke WhatsApp / HR.');
      }).catch(() => fallbackCopy(fullUrl));
    } else {
      fallbackCopy(fullUrl);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Link simulasi berhasil disalin ke clipboard.');
    } catch (_) {
      prompt('Salin link simulasi di bawah ini:', text);
    }
    ta.remove();
  }

  function getSavedScenarios() {
    try {
      const raw = localStorage.getItem(SCENARIOS_KEY);
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  function setSavedScenarios(list) {
    try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function renderScenarioList() {
    const box = document.getElementById('scenarioList');
    if (!box) return;
    const list = getSavedScenarios();
    if (!list.length) {
      box.innerHTML = `<div style="font-size:12px;color:#64748B;padding:10px;text-align:center;background:#F8FAFC;border-radius:8px;">Belum ada skenario tersimpan di browser ini.</div>`;
      return;
    }
    box.innerHTML = list.map((sc, idx) => `
      <div class="scenario-item">
        <div>
          <div class="scenario-item-title">${escapeHtml(sc.name)}</div>
          <div class="scenario-item-meta">${escapeHtml(sc.meta || '')}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn btn-soft" style="padding:4px 8px;font-size:11.5px;" data-sc-load="${idx}">Muat</button>
          <button type="button" class="btn btn-ghost" style="padding:4px 8px;font-size:11.5px;color:#9F1239;" data-sc-del="${idx}">Hapus</button>
        </div>
      </div>
    `).join('');

    box.querySelectorAll('[data-sc-load]').forEach(btn => btn.addEventListener('click', () => {
      const sc = list[Number(btn.dataset.scLoad)];
      if (sc && applyImportedPayload(sc.data)) {
        saveAndRender();
        document.getElementById('scenarioModal')?.classList.remove('open');
        showToast(`Skenario "${sc.name}" berhasil dimuat.`);
      }
    }));

    box.querySelectorAll('[data-sc-del]').forEach(btn => btn.addEventListener('click', () => {
      const next = list.filter((_, i) => i !== Number(btn.dataset.scDel));
      setSavedScenarios(next);
      renderScenarioList();
      showToast('Skenario dihapus.');
    }));
  }

  function exportScenarioJson() {
    const data = { app: CFG.app.title, version: CFG.app.version, exportedAt: new Date().toISOString(), state: { ...state } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const safeName = (state.employeeName || 'Karyawan').replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerDownload(blob, `KAN_Skenario_${safeName}_${toISODate(new Date())}.json`);
    showToast('File skenario JSON berhasil diunduh.');
  }

  // ---------- EXCEL EXPORT (v2.0) ----------
  async function exportToExcel() {
    const sim = lastSimulation;
    if (!sim) return;
    if (!window.ExcelJS) { exportToCSVFallback(sim); return; }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = CFG.app.title;
      const c = CFG.codes;
      const hexToArgb = (hex) => 'FF' + String(hex || '#FFFFFF').replace('#', '').toUpperCase();

      // SHEET 1: MATRIKS
      const ws = wb.addWorksheet('Matriks Timesheet', { views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }] });
      ws.mergeCells('A1:AJ1');
      ws.getCell('A1').value = `${CFG.app.companyName} — ${CFG.app.title} (v${CFG.app.version})`;
      ws.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:AJ2');
      const offLabel = state.offDay === 'auto' ? 'Otomatis 5:2' : `Tetap ${CFG.labels.dayNamesFull[Number(state.offDay)]}`;
      ws.getCell('A2').value = `Nama: ${state.employeeName} | NIK: ${state.employeeNik} (${state.employeeGrade}) | Jabatan: ${state.employeeRole} | P.O.H: ${sim.pohSpec.shortLabel} (${state.pohCity || '-'}) | Mulai ${c.work}1: ${formatDateID(sim.startDate, true)}`;
      ws.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
      ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      ws.getRow(2).height = 20;

      ws.mergeCells('A3:AJ3');
      ws.getCell('A3').value = `Hari ${c.off}: ${offLabel} | Saldo Awal ${c.tc}: ${sim.initialTcBalance} (Akhir: ${sim.endingTcBank}) | Sisa ${c.annualLeave}: ${sim.remainingCTBalance} hr | Tgl Merah Kerja: ${sim.totals.holidaysOnWork} hr | Override: ${sim.totals.overrides} hr`;
      ws.getCell('A3').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
      ws.getRow(3).height = 18;
      ws.getRow(4).height = 6;

      const headers = ['Bulan'];
      for (let d = 1; d <= 31; d++) headers.push(d);
      headers.push(c.work, c.tc, c.leave, c.annualLeave);
      const hdrRow = ws.getRow(5);
      hdrRow.values = headers;
      hdrRow.height = 22;
      hdrRow.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      sim.months.forEach((mRow, idx) => {
        const row = ws.getRow(6 + idx);
        row.height = 21;
        const mCell = row.getCell(1);
        mCell.value = mRow.label;
        mCell.font = { name: 'Calibri', size: 10, bold: true };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        mRow.cells.forEach((cellData, dIdx) => {
          const ec = row.getCell(2 + dIdx);
          ec.value = cellData.code || '';
          const colSpec = CFG.colors[cellData.kind] || CFG.colors.work;
          ec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(colSpec.bg) } };
          ec.font = {
            name: 'Calibri', size: 9,
            bold: cellData.kind !== 'work' && cellData.kind !== 'workPartial',
            color: { argb: hexToArgb(colSpec.text) }
          };
          ec.alignment = { vertical: 'middle', horizontal: 'center' };
          const isNatHol = state.showHolidays && cellData.holiday && cellData.holiday.type === 'national';
          ec.border = {
            top: { style: isNatHol ? 'medium' : 'thin', color: { argb: isNatHol ? 'FFDC2626' : 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });

        [mRow.stats.work, mRow.stats.tc, mRow.stats.leave, mRow.stats.annualLeave].forEach((val, sIdx) => {
          const sc = row.getCell(33 + sIdx);
          sc.value = val;
          sc.font = { name: 'Calibri', size: 10, bold: true };
          sc.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });

      const totRowIdx = 6 + sim.months.length;
      const totRow = ws.getRow(totRowIdx);
      totRow.height = 23;
      totRow.getCell(1).value = 'TOTAL';
      ws.mergeCells(totRowIdx, 2, totRowIdx, 32);
      totRow.getCell(2).value = `12 Bulan (${sim.cycles.length} Periode • ${sim.totals.off} hr ${c.off} • ${sim.totals.holidaysOnWork} Tgl Merah Kerja)`;
      totRow.getCell(33).value = { formula: `SUM(AG6:AG${totRowIdx - 1})`, result: sim.totals.work };
      totRow.getCell(34).value = { formula: `SUM(AH6:AH${totRowIdx - 1})`, result: sim.totals.tc };
      totRow.getCell(35).value = { formula: `SUM(AI6:AI${totRowIdx - 1})`, result: sim.totals.leave };
      totRow.getCell(36).value = { formula: `SUM(AJ6:AJ${totRowIdx - 1})`, result: sim.totals.annualLeave };
      for (let col = 1; col <= 36; col++) {
        const cell = totRow.getCell(col);
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'right' : 'center' };
      }

      ws.getColumn(1).width = 13;
      for (let col = 2; col <= 32; col++) ws.getColumn(col).width = 5.5;
      for (let col = 33; col <= 36; col++) ws.getColumn(col).width = 6.2;

      // SHEET 2: RINGKASAN PERIODE CUTI + LOCK + CARRY-OVER + POH
      const ws2 = wb.addWorksheet('Ringkasan Periode Cuti');
      ws2.columns = [
        { header: 'Periode', key: 'periode', width: 13 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Kerja di Site', key: 'site', width: 25 },
        { header: 'Berangkat', key: 'depart', width: 20 },
        { header: 'Akhir Cuti', key: 'end', width: 16 },
        { header: `Kembali (${c.work}1)`, key: 'ret', width: 16 },
        { header: 'TC Awal', key: 'tcIn', width: 10 },
        { header: 'TC Didapat', key: 'tcEarn', width: 11 },
        { header: `Pakai ${c.leave}`, key: 'c', width: 10 },
        { header: 'TC Sisa', key: 'tcOut', width: 10 },
        { header: `Hari ${c.annualLeave}`, key: 'ct', width: 10 },
        { header: 'Total Rumah', key: 'total', width: 13 },
        { header: 'Irisan Libur Nasional', key: 'hol', width: 26 },
        { header: 'P.O.H & Status Tiket', key: 'ticket', width: 32 }
      ];
      ws2.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      });
      sim.cycles.forEach(cyc => {
        ws2.addRow({
          periode: `Periode ${cyc.cycle}`,
          status: cyc.isLocked ? 'Terkunci' : 'Proyeksi',
          site: `${formatDateID(cyc.siteStart, true)} – ${formatDateID(cyc.siteEnd, true)}`,
          depart: `${CFG.labels.dayNamesShort[cyc.departDate.getDay()]}, ${formatDateID(cyc.departDate, true)}`,
          end: formatDateID(cyc.leaveEndDate, true),
          ret: formatDateID(cyc.returnSiteDate, true),
          tcIn: cyc.tcCarryIn, tcEarn: cyc.tcEarnedThisCycle, c: cyc.cDaysCount,
          tcOut: cyc.tcCarryOut, ct: cyc.ctDaysCount, total: cyc.totalHomeDays,
          hol: cyc.holidaysInLeave.map(h => h.name).join('; ') || '-',
          ticket: `${cyc.ticketLabel} [${state.pohCity || sim.pohSpec.shortLabel}]`
        });
      });

      // SHEET 3: OVERRIDE & HARI LIBUR
      const ws3 = wb.addWorksheet('Override & Libur Nasional');
      ws3.columns = [
        { header: 'Tanggal', key: 'tgl', width: 16 },
        { header: 'Kategori', key: 'kat', width: 20 },
        { header: 'Kode / Status', key: 'kode', width: 16 },
        { header: 'Keterangan / Catatan', key: 'ket', width: 45 }
      ];
      ws3.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      Object.entries(state.manualOverrides || {}).sort().forEach(([iso, ov]) => {
        const sp = CFG.overrideTypes[ov.type];
        ws3.addRow({ tgl: iso, kat: 'Override Manual', kode: sp ? sp.code : ov.type, ket: `${sp ? sp.label : ''}${ov.note ? ' — ' + ov.note : ''}` });
      });
      sim.months.forEach(m => m.cells.forEach(cell => {
        if (cell.iso && cell.holiday) {
          ws3.addRow({
            tgl: cell.iso,
            kat: cell.holiday.type === 'national' ? 'Libur Nasional' : 'Cuti Bersama',
            kode: cell.code || '-',
            ket: cell.holiday.name
          });
        }
      }));

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeName = (state.employeeName || 'Karyawan').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const fileName = `KAN_Timesheet_v2_${safeName}_${sim.startDate.getFullYear()}.xlsx`;
      triggerDownload(blob, fileName);
      showToast(`File Excel "${fileName}" berhasil diunduh.`);
    } catch (err) {
      console.error('Excel export error:', err);
      exportToCSVFallback(sim);
    }
  }

  function exportToCSVFallback(sim) {
    const c = CFG.codes;
    const rows = [['Bulan', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), c.work, c.tc, c.leave, c.annualLeave].join(',')];
    sim.months.forEach(m => {
      rows.push([`"${m.label}"`, ...m.cells.map(cl => `"${cl.code || ''}"`), m.stats.work, m.stats.tc, m.stats.leave, m.stats.annualLeave].join(','));
    });
    triggerDownload(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }), `KAN_Timesheet_${sim.startDate.getFullYear()}.csv`);
    showToast('Mode offline: diekspor ke format CSV.');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- PERSISTENCE ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('kan_timesheet_state_v1');
      if (raw) applyImportedPayload(JSON.parse(raw));
    } catch (_) {}
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    Object.assign(state, createDefaultState());
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}
    syncFormInputs();
    renderAll();
    showToast('Semua pengaturan, kunci periode, override, dan durasi custom di-reset ke default config.js.');
  }

  function renderAll() {
    lastSimulation = runSimulation();
    renderKPIs(lastSimulation);
    renderMatrix(lastSimulation);
    renderInspector(lastSimulation);
    renderCyclesTable(lastSimulation);
  }

  function saveAndRender() {
    saveState();
    syncFormInputs();
    renderAll();
  }

  // ---------- EVENT BINDINGS ----------
  function bindEvents() {
    const bindInput = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
      el.addEventListener(evt, () => { state[key] = el.value; saveAndRender(); });
    };

    bindInput('inputName', 'employeeName');
    bindInput('inputNik', 'employeeNik');
    bindInput('inputGrade', 'employeeGrade');
    bindInput('inputRole', 'employeeRole');
    bindInput('inputPohCity', 'pohCity');
    bindInput('inputJoinDate', 'joinDate');
    bindInput('inputStartDate', 'startDate');
    bindInput('inputOffDay', 'offDay');
    bindInput('inputCounterMode', 'workCounterMode');
    bindInput('inputGrayMode', 'grayBoxMode');
    bindInput('inputViewMode', 'viewMode');

    // POH Category auto-suggests default city if city is blank or matches another default
    document.getElementById('inputPohCategory')?.addEventListener('change', (e) => {
      const prevSpec = getPohSpec();
      state.pohCategory = e.target.value;
      const nextSpec = getPohSpec();
      if (!state.pohCity || state.pohCity === prevSpec.defaultCity) {
        state.pohCity = nextSpec.defaultCity || '';
      }
      saveAndRender();
    });

    document.getElementById('inputHomeDays')?.addEventListener('change', (e) => {
      const minD = CFG.rules.minHomeLeaveDays, maxD = CFG.rules.maxHomeLeaveDays;
      let val = clampInt(e.target.value, minD, maxD, minD);
      if (Number(e.target.value) < minD) showToast(`Minimal pengajuan cuti di rumah adalah ${minD} hari sesuai SOP.`);
      state.targetHomeDays = val;
      saveAndRender();
    });

    document.getElementById('inputCtBalance')?.addEventListener('change', (e) => {
      state.annualLeaveBalance = clampInt(e.target.value, 0, 60, 0);
      saveAndRender();
    });

    document.getElementById('inputInitialTc')?.addEventListener('change', (e) => {
      state.initialTcBalance = clampInt(e.target.value, 0, 30, 0);
      saveAndRender();
    });

    document.getElementById('inputShowHolidays')?.addEventListener('change', (e) => {
      state.showHolidays = e.target.checked;
      saveAndRender();
    });

    document.querySelectorAll('input[name="departureMode"]').forEach(r => {
      r.addEventListener('change', () => { if (r.checked) { state.departureMode = r.value; saveAndRender(); } });
    });

    // Topbar actions delegated via window.KAN_APP from app.js

    // Clear buttons (respect locked cycles!)
    document.getElementById('btnClearOverrides')?.addEventListener('click', () => {
      state.manualOverrides = {};
      saveAndRender();
      showToast('Semua override manual telah dihapus.');
    });

    document.getElementById('btnUnlockAll')?.addEventListener('click', () => {
      state.lockedCycles = {};
      saveAndRender();
      showToast('Semua kunci periode telah dibuka.');
    });

    document.getElementById('btnClearCycleCustom')?.addEventListener('click', () => {
      state.cycleHomeDays = {};
      state.cycleSaveTc = {};
      saveAndRender();
      showToast('Durasi custom & simpan TC pada periode yang tidak dikunci dikembalikan ke default.');
    });

    document.getElementById('btnClearCT')?.addEventListener('click', () => {
      state.ctAllocations = {};
      saveAndRender();
      showToast(`Alokasi ${CFG.codes.annualLeave} pada periode yang tidak dikunci di-reset ke 0.`);
    });

    // Config Modal
    const cfgModal = document.getElementById('configModal');
    document.getElementById('btnCloseConfig')?.addEventListener('click', () => cfgModal?.classList.remove('open'));
    cfgModal?.addEventListener('click', (e) => { if (e.target === cfgModal) cfgModal.classList.remove('open'); });

    // Scenario Modal
    const scModal = document.getElementById('scenarioModal');
    document.getElementById('btnCloseScenario')?.addEventListener('click', () => scModal?.classList.remove('open'));
    scModal?.addEventListener('click', (e) => { if (e.target === scModal) scModal.classList.remove('open'); });

    document.getElementById('btnSaveScenario')?.addEventListener('click', () => {
      const inp = document.getElementById('inputScenarioName');
      const name = (inp?.value || '').trim() || `Skenario ${state.employeeName} (${toISODate(new Date())})`;
      const list = getSavedScenarios();
      const ovCount = Object.keys(state.manualOverrides || {}).length;
      const lkCount = Object.keys(state.lockedCycles || {}).length;
      const pohShort = getPohSpec().shortLabel || state.pohCategory;
      list.unshift({
        name,
        savedAt: new Date().toISOString(),
        meta: `${pohShort} • Mulai ${state.startDate} • Default ${state.targetHomeDays} hr • ${lkCount} dikunci • ${ovCount} override`,
        data: JSON.parse(JSON.stringify(state))
      });
      setSavedScenarios(list.slice(0, 20));
      if (inp) inp.value = '';
      renderScenarioList();
      showToast(`Skenario "${name}" tersimpan.`);
    });

    document.getElementById('btnExportJson')?.addEventListener('click', exportScenarioJson);
    document.getElementById('btnCopyShareFromModal')?.addEventListener('click', copyShareLink);

    const fileInput = document.getElementById('inputImportJsonFile');
    document.getElementById('btnImportJson')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const target = parsed.state ? parsed.state : parsed;
          if (applyImportedPayload(target)) {
            saveAndRender();
            scModal?.classList.remove('open');
            showToast(`File "${file.name}" berhasil dimuat.`);
          } else {
            showToast('Format file JSON tidak dikenali.');
          }
        } catch (_) {
          showToast('Gagal membaca file JSON.');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && el.value !== String(val ?? '')) el.value = String(val ?? '');
  }

  let toastTimer = null;
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }

  window.KAN_APP = {
    reset: resetToDefaults,
    exportExcel: exportToExcel,
    shareLink: copyShareLink,
    openScenario: () => {
      renderScenarioList();
      document.getElementById('scenarioModal')?.classList.add('open');
    },
    showConfig: () => {
      const pre = document.getElementById('configPreviewCode');
      if (pre) pre.textContent = JSON.stringify(CFG, null, 2);
      document.getElementById('configModal')?.classList.add('open');
    },
    refreshSignatures: renderKanSignatures,
    rerender: () => { injectConfigTheme(); renderAll(); }
  };

  // ---------- INIT ----------
  document.addEventListener('DOMContentLoaded', () => {
    injectConfigTheme();
    const fromHash = loadStateFromHash();
    if (!fromHash) loadState();
    renderStaticBrand();
    renderLegend();
    syncFormInputs();
    bindEvents();
    renderAll();
    if (fromHash) showToast('Simulasi KAN dimuat dari link yang dibagikan.');
  });
})();
