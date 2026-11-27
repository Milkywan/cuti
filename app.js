/**
 * ============================================================================
 * KAN TIMESHEET & LEAVE SIMULATOR — CORE ENGINE & UI CONTROLLER (app.js)
 * ============================================================================
 * Seluruh kode matriks, aturan SOP, warna, label, dan pesan dibaca dari
 * window.KAN_CONFIG (file config.js).
 * ============================================================================
 */

(function () {
  'use strict';

  const CFG = window.KAN_CONFIG;
  if (!CFG) {
    alert('Gagal memuat config.js! Pastikan file config.js berada di folder yang sama dengan index.html.');
    return;
  }

  const STORAGE_KEY = 'kan_timesheet_state_v1';

  // ---------- APPLICATION STATE ----------
  const state = {
    employeeName: CFG.defaults.employeeName,
    employeeNik: CFG.defaults.employeeNik,
    employeeRole: CFG.defaults.employeeRole,
    joinDate: CFG.defaults.joinDate,
    startDate: CFG.defaults.startDate,
    targetHomeDays: Math.max(CFG.rules.minHomeLeaveDays, CFG.rules.defaultHomeLeaveDays),
    offDay: CFG.rules.defaultOffDay,
    departureMode: CFG.rules.defaultDepartureMode,
    workCounterMode: CFG.rules.defaultWorkCounterMode,
    grayBoxMode: CFG.rules.defaultGrayBoxMode,
    viewMode: CFG.rules.defaultViewMode,
    annualLeaveBalance: CFG.defaults.annualLeaveBalance,
    ctAllocations: {}, // { [cycleNumber]: days }
    selectedDateKey: null
  };

  let lastSimulation = null;

  // ---------- DATE UTILITIES (LOCAL TIMEZONE SAFE) ----------
  function parseISODate(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2]) {
      return null;
    }
    return d;
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function formatDateID(d, shortMonth) {
    if (!d) return '-';
    const months = shortMonth ? CFG.labels.monthNamesShort : CFG.labels.monthNamesFull;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateFullID(d) {
    if (!d) return '-';
    const dayName = CFG.labels.dayNamesFull[d.getDay()];
    return `${dayName}, ${formatDateID(d, false)}`;
  }

  function getAnnualLeaveEligibleDate(joinDateObj) {
    if (!joinDateObj) return null;
    const months = Number(CFG.rules.annualLeaveMinServiceMonths) || 12;
    const targetMonthIndex = joinDateObj.getMonth() + months;
    const y = joinDateObj.getFullYear() + Math.floor(targetMonthIndex / 12);
    const m = targetMonthIndex % 12;
    const maxD = daysInMonth(y, m);
    return new Date(y, m, Math.min(joinDateObj.getDate(), maxD));
  }

  function formatTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : `{${k}}`
    );
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- SYNC COLORS FROM CONFIG.JS TO CSS VARIABLES ----------
  function injectConfigTheme() {
    const root = document.documentElement;
    Object.entries(CFG.colors).forEach(([key, val]) => {
      if (!val) return;
      if (val.bg) root.style.setProperty(`--c-${key}-bg`, val.bg);
      if (val.text) root.style.setProperty(`--c-${key}-text`, val.text);
      if (val.border) root.style.setProperty(`--c-${key}-border`, val.border);
    });
  }

  // ---------- CORE SIMULATION ENGINE ----------
  function runSimulation() {
    const startDate = parseISODate(state.startDate) || parseISODate(CFG.defaults.startDate) || new Date();
    const joinDate = parseISODate(state.joinDate);
    const ctEligibleDate = getAnnualLeaveEligibleDate(joinDate);

    // Determine 12-month window
    const months = [];
    if (state.viewMode === 'rolling_12') {
      const startY = startDate.getFullYear();
      const startM = startDate.getMonth();
      for (let i = 0; i < 12; i++) {
        const d = new Date(startY, startM + i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else {
      const y = startDate.getFullYear();
      for (let m = 0; m < 12; m++) {
        months.push({ year: y, month: m });
      }
    }

    const windowStart = new Date(months[0].year, months[0].month, 1);
    const lastM = months[months.length - 1];
    const windowEnd = new Date(lastM.year, lastM.month, daysInMonth(lastM.year, lastM.month));

    // Rules from config
    const minWorkPerWeek = Math.max(1, Number(CFG.rules.workDaysPerWeek) || 5);
    const minHomeDays = Math.max(2, Number(CFG.rules.minHomeLeaveDays) || 9);
    const targetHomeDays = Math.max(minHomeDays, Number(state.targetHomeDays) || minHomeDays);
    const weeksTarget = targetHomeDays - 1; // e.g. 9 days = 1 OFF + 8 TC -> 8 weeks
    const ticketQuota = Math.max(1, Number(CFG.rules.companyTicketQuotaPerYear) || 3);

    // Track remaining CT balance across cycles
    let remainingCTBalance = Math.max(0, Math.floor(Number(state.annualLeaveBalance) || 0));

    // Simulation state machine
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

    const cellMap = new Map(); // isoDate -> cell object
    const cycles = [];
    const ticketCountByYear = {};

    function registerCycleLeave(departDate, firstOffDate, earnedTcCount, departedAfterDay5) {
      const leaveYear = departDate.getFullYear();
      const quotaBucket = CFG.rules.ticketQuotaResetMode === 'simulation_window' ? 'ALL' : String(leaveYear);
      ticketCountByYear[quotaBucket] = (ticketCountByYear[quotaBucket] || 0) + 1;
      const ticketSeq = ticketCountByYear[quotaBucket];
      const isCompanyTicket = ticketSeq <= ticketQuota;

      // Check CT eligibility at leave start
      const isCtEligible = Boolean(ctEligibleDate && departDate >= ctEligibleDate);
      const requestedCT = Math.max(0, Math.floor(Number(state.ctAllocations[cycle]) || 0));
      const grantedCT = isCtEligible ? Math.min(requestedCT, remainingCTBalance) : 0;
      remainingCTBalance -= grantedCT;

      const queue = [];
      // Note: If departedAfterDay5, departDate itself is already pushed as offDepart,
      // and queue begins on firstOffDate (which is Day 7 OFF).
      queue.push({ kind: 'offLeave', code: CFG.codes.off, cycle });
      for (let i = 1; i <= earnedTcCount; i++) {
        queue.push({ kind: 'leave', code: `${CFG.codes.leave}${i}`, cycle, leaveIndex: i });
      }
      for (let i = 1; i <= grantedCT; i++) {
        queue.push({ kind: 'annualLeave', code: `${CFG.codes.annualLeave}${i}`, cycle, ctIndex: i });
      }

      const offDaysCount = departedAfterDay5 ? 2 : 1;
      const totalHomeDays = offDaysCount + earnedTcCount + grantedCT;
      const leaveEndDate = addDays(departDate, totalHomeDays - 1);
      const returnSiteDate = addDays(leaveEndDate, state.grayBoxMode === 'trv' ? 2 : 1);

      const cycleRecord = {
        cycle,
        siteStart: currentSiteStart || startDate,
        siteEnd: addDays(departDate, -1),
        departDate,
        leaveEndDate,
        returnSiteDate,
        offDaysCount,
        cDaysCount: earnedTcCount,
        ctDaysCount: grantedCT,
        totalHomeDays,
        departedAfterDay5,
        isCtEligible,
        ctEligibleDate,
        ticketSeq,
        ticketQuota,
        ticketYear: leaveYear,
        isCompanyTicket,
        ticketLabel: isCompanyTicket
          ? `${CFG.labels.ticketCompany} (${ticketSeq}/${ticketQuota})`
          : `${CFG.labels.ticketSelf} (ke-${ticketSeq})`
      };
      cycles.push(cycleRecord);
      currentCycleObj = cycleRecord;
      return queue;
    }

    // Iterate day by day from min(windowStart, startDate) up to windowEnd
    let cur = startDate < windowStart ? new Date(startDate) : new Date(windowStart);

    // Pre-start fill if windowStart < startDate
    while (cur < startDate && cur <= windowEnd) {
      const iso = toISODate(cur);
      cellMap.set(iso, {
        date: new Date(cur),
        iso,
        kind: 'preStart',
        code: CFG.codes.preStart,
        cycle: null,
        weekWork: 0
      });
      cur = addDays(cur, 1);
    }

    // Main simulation loop from startDate through windowEnd
    while (cur <= windowEnd) {
      const iso = toISODate(cur);
      const dow = cur.getDay(); // 0=Sun..6=Sat

      if (phase === 'LEAVE') {
        const item = leaveQueue.shift();
        cellMap.set(iso, {
          date: new Date(cur),
          iso,
          kind: item.kind,
          code: item.code,
          cycle: item.cycle,
          cycleInfo: currentCycleObj,
          weekWork: 0
        });
        if (leaveQueue.length === 0) {
          if (state.grayBoxMode === 'trv') {
            phase = 'POST_LEAVE';
          } else {
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
        }
        cur = addDays(cur, 1);
        continue;
      }

      if (phase === 'POST_LEAVE') {
        cellMap.set(iso, {
          date: new Date(cur),
          iso,
          kind: 'postLeaveGap',
          code: CFG.codes.postLeaveGap,
          cycle,
          cycleInfo: currentCycleObj,
          weekWork: 0
        });
        phase = 'SITE';
        cycle += 1;
        siteDayCounter = 0;
        workDayCounter = 0;
        tcEarned = 0;
        weekWorkDays = 0;
        autoWeekDay = 0;
        currentSiteStart = null;
        currentCycleObj = null;
        cur = addDays(cur, 1);
        continue;
      }

      // PHASE === 'SITE'
      if (state.offDay === 'auto') {
        autoWeekDay += 1;
        if (autoWeekDay <= minWorkPerWeek) {
          if (!currentSiteStart) currentSiteStart = new Date(cur);
          siteDayCounter += 1;
          workDayCounter += 1;
          weekWorkDays += 1;
          const num = state.workCounterMode === 'site_day' ? siteDayCounter : workDayCounter;
          cellMap.set(iso, {
            date: new Date(cur),
            iso,
            kind: 'work',
            code: `${CFG.codes.work}${num}`,
            cycle,
            weekWork: weekWorkDays
          });
        } else if (autoWeekDay === minWorkPerWeek + 1) {
          const isFinalWeek = tcEarned === weeksTarget - 1;
          if (isFinalWeek && state.departureMode === 'leave_after_day5') {
            leaveQueue = registerCycleLeave(new Date(cur), addDays(cur, 1), tcEarned, true);
            cellMap.set(iso, {
              date: new Date(cur),
              iso,
              kind: 'offDepart',
              code: CFG.codes.off,
              cycle,
              cycleInfo: currentCycleObj,
              weekWork: weekWorkDays
            });
            phase = 'LEAVE';
          } else {
            siteDayCounter += 1;
            tcEarned += 1;
            const isLastTc = tcEarned === weeksTarget;
            if (isLastTc) {
              leaveQueue = registerCycleLeave(addDays(cur, 1), addDays(cur, 1), tcEarned, false);
              phase = 'LEAVE';
            }
            cellMap.set(iso, {
              date: new Date(cur),
              iso,
              kind: isLastTc ? 'tcLast' : 'tc',
              code: `${CFG.codes.tc}${tcEarned}`,
              cycle,
              cycleInfo: isLastTc ? currentCycleObj : null,
              weekWork: weekWorkDays
            });
          }
        } else {
          // Day 7 (weekly OFF at site)
          siteDayCounter += 1;
          cellMap.set(iso, {
            date: new Date(cur),
            iso,
            kind: 'offSite',
            code: CFG.codes.off,
            cycle,
            weekWork: weekWorkDays
          });
          autoWeekDay = 0;
          weekWorkDays = 0;
        }
      } else {
        // FIXED OFF DAY MODE (0..6) with SOP: Must reach minWorkPerWeek (5) work days before TC!
        const fixedOffDow = Number(state.offDay);
        const tcCandidateDow = (fixedOffDow + 6) % 7;

        if (dow === fixedOffDow) {
          if (siteDayCounter > 0) siteDayCounter += 1;
          cellMap.set(iso, {
            date: new Date(cur),
            iso,
            kind: 'offSite',
            code: CFG.codes.off,
            cycle,
            weekWork: weekWorkDays
          });
          weekWorkDays = 0;
        } else if (dow === tcCandidateDow) {
          if (weekWorkDays >= minWorkPerWeek) {
            const isFinalWeek = tcEarned === weeksTarget - 1;
            if (isFinalWeek && state.departureMode === 'leave_after_day5') {
              leaveQueue = registerCycleLeave(new Date(cur), addDays(cur, 1), tcEarned, true);
              cellMap.set(iso, {
                date: new Date(cur),
                iso,
                kind: 'offDepart',
                code: CFG.codes.off,
                cycle,
                cycleInfo: currentCycleObj,
                weekWork: weekWorkDays
              });
              phase = 'LEAVE';
            } else {
              siteDayCounter += 1;
              tcEarned += 1;
              const isLastTc = tcEarned === weeksTarget;
              if (isLastTc) {
                leaveQueue = registerCycleLeave(addDays(cur, 1), addDays(cur, 1), tcEarned, false);
                phase = 'LEAVE';
              }
              cellMap.set(iso, {
                date: new Date(cur),
                iso,
                kind: isLastTc ? 'tcLast' : 'tc',
                code: `${CFG.codes.tc}${tcEarned}`,
                cycle,
                cycleInfo: isLastTc ? currentCycleObj : null,
                weekWork: weekWorkDays
              });
            }
          } else {
            // Partial week (< 5 work days) -> regular work day, NOT TC
            if (!currentSiteStart) currentSiteStart = new Date(cur);
            const prevWeekWork = weekWorkDays;
            siteDayCounter += 1;
            workDayCounter += 1;
            weekWorkDays += 1;
            const num = state.workCounterMode === 'site_day' ? siteDayCounter : workDayCounter;
            cellMap.set(iso, {
              date: new Date(cur),
              iso,
              kind: 'workPartial',
              code: `${CFG.codes.work}${num}`,
              cycle,
              weekWork: prevWeekWork
            });
          }
        } else {
          if (!currentSiteStart) currentSiteStart = new Date(cur);
          siteDayCounter += 1;
          workDayCounter += 1;
          weekWorkDays += 1;
          const num = state.workCounterMode === 'site_day' ? siteDayCounter : workDayCounter;
          cellMap.set(iso, {
            date: new Date(cur),
            iso,
            kind: 'work',
            code: `${CFG.codes.work}${num}`,
            cycle,
            weekWork: weekWorkDays
          });
        }
      }

      cur = addDays(cur, 1);
    }

    // Aggregate totals within visible 12-month window
    const totals = {
      work: 0,
      tc: 0,
      off: 0,
      leave: 0,
      annualLeave: 0,
      postLeaveGap: 0
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
        const cell = cellMap.get(iso) || { date: dt, iso, kind: 'preStart', code: CFG.codes.preStart };
        cells.push(cell);

        if (cell.kind === 'work' || cell.kind === 'workPartial') {
          rowStats.work++; totals.work++;
        } else if (cell.kind === 'tc' || cell.kind === 'tcLast') {
          rowStats.tc++; totals.tc++;
        } else if (cell.kind === 'leave') {
          rowStats.leave++; totals.leave++;
        } else if (cell.kind === 'annualLeave') {
          rowStats.annualLeave++; totals.annualLeave++;
        } else if (cell.kind === 'offSite' || cell.kind === 'offDepart' || cell.kind === 'offLeave') {
          totals.off++;
        } else if (cell.kind === 'postLeaveGap') {
          totals.postLeaveGap++;
        }
      }

      return {
        year,
        month,
        label: `${CFG.labels.monthNamesShort[month]} ${year}`,
        cells,
        stats: rowStats
      };
    });

    const totalCTUsed = cycles.reduce((sum, c) => sum + c.ctDaysCount, 0);
    const companyTicketsUsed = cycles.filter(c => c.isCompanyTicket).length;
    const selfTicketsUsed = cycles.filter(c => !c.isCompanyTicket).length;

    return {
      months: monthRows,
      cellMap,
      cycles,
      totals,
      startDate,
      joinDate,
      ctEligibleDate,
      totalCTUsed,
      remainingCTBalance,
      companyTicketsUsed,
      selfTicketsUsed,
      targetHomeDays,
      weeksTarget
    };
  }

  // ---------- RENDER FUNCTIONS ----------
  function renderStaticBrand() {
    document.title = CFG.app.title;
    const elTitle = document.getElementById('appTitle');
    if (elTitle) {
      elTitle.innerHTML = `${escapeHtml(CFG.app.title)} <span class="version-pill">v${escapeHtml(CFG.app.version)}</span>`;
    }
    setText('appSubtitle', `${CFG.app.companyName} — ${CFG.app.subtitle}`);
    setText('printCompanyTitle', `${CFG.app.companyName} — Jadwal Simulasi Roster & Cuti`);
    setText('printSubtitle', CFG.app.subtitle);

    // Populate off-day dropdown dynamically
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

    // Populate counter mode select
    const counterSelect = document.getElementById('inputCounterMode');
    if (counterSelect) {
      counterSelect.innerHTML = '';
      Object.entries(CFG.labels.workCounterModes).forEach(([k, label]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = label.replace(/X/g, CFG.codes.work).replace(/TC/g, CFG.codes.tc).replace(/OFF/g, CFG.codes.off);
        counterSelect.appendChild(opt);
      });
    }

    // Populate gray box select
    const graySelect = document.getElementById('inputGrayMode');
    if (graySelect) {
      graySelect.innerHTML = '';
      Object.entries(CFG.labels.grayBoxModes).forEach(([k, label]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = label
          .replace(/TRV\?/g, CFG.codes.postLeaveGap || 'TRV?')
          .replace(/X1/g, `${CFG.codes.work}1`);
        graySelect.appendChild(opt);
      });
    }

    // Populate view mode select
    const viewSelect = document.getElementById('inputViewMode');
    if (viewSelect) {
      viewSelect.innerHTML = '';
      Object.entries(CFG.labels.viewModes).forEach(([k, label]) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = label.replace(/X1/g, `${CFG.codes.work}1`);
        viewSelect.appendChild(opt);
      });
    }

    // Populate departure radio labels
    setText('labelDepartWork6', CFG.labels.departureModes.work_day6
      .replace(/TC/g, CFG.codes.tc).replace(/\bC\b/g, CFG.codes.leave));
    setText('labelDepartAfter5', CFG.labels.departureModes.leave_after_day5
      .replace(/OFF/g, CFG.codes.off).replace(/\bC\b/g, CFG.codes.leave));

    // Dynamic labels referencing codes
    setText('labelStartX1', `Mulai Kerja (${CFG.codes.work}1) di Site`);
    setText('labelMinDaysHint', `Kunci minimal SOP: ${CFG.rules.minHomeLeaveDays} hari (1 ${CFG.codes.off} + ${CFG.rules.minHomeLeaveDays - 1} ${CFG.codes.leave}).`);

    // Render preset buttons from config
    const presetContainer = document.getElementById('presetRow');
    if (presetContainer) {
      presetContainer.innerHTML = '';
      CFG.rules.homeLeavePresets
        .filter(n => n >= CFG.rules.minHomeLeaveDays)
        .forEach(days => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'preset-btn';
          btn.dataset.days = String(days);
          btn.textContent = `${days} Hari`;
          btn.addEventListener('click', () => {
            state.targetHomeDays = days;
            document.getElementById('inputHomeDays').value = String(days);
            saveAndRender();
          });
          presetContainer.appendChild(btn);
        });
    }

    // Render print signatures from config
    const sigGrid = document.getElementById('printSignatures');
    if (sigGrid) {
      sigGrid.innerHTML = CFG.signatures.map(s => `
        <div class="sig-box">
          <div>${escapeHtml(s.title)}</div>
          <div class="sig-space"></div>
          <div><strong>${escapeHtml(s.role)}</strong></div>
        </div>
      `).join('');
    }
  }

  function renderLegend() {
    const container = document.getElementById('legendBar');
    if (!container) return;

    const items = [
      { key: 'work', sample: `${CFG.codes.work}1` },
      { key: 'workPartial', sample: `${CFG.codes.work}*` },
      { key: 'tc', sample: `${CFG.codes.tc}1` },
      { key: 'tcLast', sample: `${CFG.codes.tc}n` },
      { key: 'offSite', sample: CFG.codes.off },
      { key: 'offDepart', sample: CFG.codes.off },
      { key: 'offLeave', sample: CFG.codes.off },
      { key: 'leave', sample: `${CFG.codes.leave}1` },
      { key: 'annualLeave', sample: `${CFG.codes.annualLeave}1` },
      { key: 'postLeaveGap', sample: CFG.codes.postLeaveGap || 'GAP' }
    ];

    let html = `<span class="legend-title">Legenda:</span>`;
    items.forEach(it => {
      const c = CFG.colors[it.key];
      if (!c) return;
      html += `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${c.bg};color:${c.text};border-color:${c.border};">${escapeHtml(it.sample)}</span>
          <span>${escapeHtml(c.label)}</span>
        </span>
      `;
    });
    container.innerHTML = html;
  }

  function syncFormInputs() {
    setVal('inputName', state.employeeName);
    setVal('inputNik', state.employeeNik);
    setVal('inputRole', state.employeeRole);
    setVal('inputJoinDate', state.joinDate);
    setVal('inputStartDate', state.startDate);
    setVal('inputHomeDays', state.targetHomeDays);
    const homeInput = document.getElementById('inputHomeDays');
    if (homeInput) {
      homeInput.min = String(CFG.rules.minHomeLeaveDays);
      homeInput.max = String(CFG.rules.maxHomeLeaveDays);
    }
    setVal('inputOffDay', String(state.offDay));
    setVal('inputCounterMode', state.workCounterMode);
    setVal('inputGrayMode', state.grayBoxMode);
    setVal('inputViewMode', state.viewMode);
    setVal('inputCtBalance', state.annualLeaveBalance);

    // Sync radio buttons
    document.querySelectorAll('input[name="departureMode"]').forEach(r => {
      r.checked = r.value === state.departureMode;
      const card = r.closest('.radio-card');
      if (card) card.classList.toggle('selected', r.checked);
    });

    // Sync preset active state
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.days) === Number(state.targetHomeDays));
    });
  }

  function renderKPIs(sim) {
    const c = CFG.codes;
    setText('kpiWorkLabel', `Hari Kerja (${c.work})`);
    setText('kpiWorkVal', `${sim.totals.work} hr`);
    setText('kpiWorkSub', `${sim.totals.off} hr ${c.off} tercatat`);

    setText('kpiTcLabel', `Tabungan (${c.tc})`);
    setText('kpiTcVal', `${sim.totals.tc} hr`);
    setText('kpiTcSub', `Target ${sim.weeksTarget} ${c.tc}/siklus`);

    setText('kpiLeaveLabel', `Cuti ${c.leave} Diambil`);
    setText('kpiLeaveVal', `${sim.totals.leave} hr`);
    setText('kpiLeaveSub', `${sim.cycles.length} periode cuti`);

    setText('kpiCtLabel', `Cuti Tahunan (${c.annualLeave})`);
    setText('kpiCtVal', `${sim.totalCTUsed} hr`);
    setText('kpiCtSub', `Sisa saldo: ${sim.remainingCTBalance} hr`);

    setText('kpiTicketLabel', 'Kuota Tiket');
    setText('kpiTicketVal', `${sim.companyTicketsUsed} / ${CFG.rules.companyTicketQuotaPerYear}`);
    setText('kpiTicketSub', sim.selfTicketsUsed > 0
      ? `+ ${sim.selfTicketsUsed} ${CFG.labels.ticketSelf}`
      : `Semua ${CFG.labels.ticketCompany}`);

    setText('kpiServiceLabel', 'Status Hak CT');
    if (!sim.joinDate) {
      setText('kpiServiceVal', 'Belum Diisi');
      setText('kpiServiceSub', 'Isi Join Date');
    } else {
      const startEligible = sim.startDate >= sim.ctEligibleDate;
      setText('kpiServiceVal', startEligible ? 'Aktif' : 'Menunggu 1 Thn');
      setText('kpiServiceSub', `Aktif: ${formatDateID(sim.ctEligibleDate, true)}`);
    }

    // Update join-date hint under input
    const joinHint = document.getElementById('joinDateHint');
    if (joinHint) {
      if (!sim.joinDate) {
        joinHint.className = 'field-hint warn';
        joinHint.textContent = 'Isi Tanggal Masuk untuk mengaktifkan validasi hak Cuti Tahunan (CT).';
      } else {
        const eligibleNow = sim.startDate >= sim.ctEligibleDate;
        joinHint.className = eligibleNow ? 'field-hint ok' : 'field-hint warn';
        joinHint.textContent = eligibleNow
          ? `Masa kerja ≥ 1 tahun sejak ${formatDateID(sim.ctEligibleDate, true)} — hak ${CFG.codes.annualLeave} aktif.`
          : `Hak ${CFG.codes.annualLeave} baru aktif pada periode cuti mulai ${formatDateID(sim.ctEligibleDate, true)}.`;
      }
    }

    // Print Employee Summary Bar
    const printBar = document.getElementById('printEmpBar');
    if (printBar) {
      const offLabel = state.offDay === 'auto'
        ? 'Otomatis 5:2'
        : `Tetap ${CFG.labels.dayNamesFull[Number(state.offDay)]}`;
      const depLabel = state.departureMode === 'work_day6' ? 'Kerja Hari ke-6 (TC utuh)' : 'Pulang stlh Hari ke-5 (C -1)';
      printBar.innerHTML = `
        <div><strong>Nama:</strong> ${escapeHtml(state.employeeName || '-')}</div>
        <div><strong>NIK:</strong> ${escapeHtml(state.employeeNik || '-')}</div>
        <div><strong>Jabatan:</strong> ${escapeHtml(state.employeeRole || '-')}</div>
        <div><strong>Join Date:</strong> ${formatDateID(sim.joinDate, true)}</div>
        <div><strong>Mulai ${escapeHtml(c.work)}1:</strong> ${formatDateID(sim.startDate, true)}</div>
        <div><strong>Target Cuti:</strong> ${sim.targetHomeDays} Hari</div>
        <div><strong>Hari ${escapeHtml(c.off)}:</strong> ${escapeHtml(offLabel)}</div>
        <div><strong>Opsi Pulang:</strong> ${escapeHtml(depLabel)}</div>
      `;
    }
  }

  function renderMatrix(sim) {
    const table = document.getElementById('matrixTable');
    if (!table) return;

    const c = CFG.codes;
    setText('matrixMeta', `Menampilkan ${sim.months[0].label} s/d ${sim.months[sim.months.length - 1].label} • Klik sel mana pun untuk melihat detail & saran HR`);

    // Build header
    let thead = '<thead><tr><th class="col-month">Bulan</th>';
    for (let d = 1; d <= 31; d++) {
      thead += `<th>${d}</th>`;
    }
    thead += `<th class="col-sum col-sum-first">${escapeHtml(c.work)}</th>`;
    thead += `<th class="col-sum">${escapeHtml(c.tc)}</th>`;
    thead += `<th class="col-sum">${escapeHtml(c.leave)}</th>`;
    thead += `<th class="col-sum">${escapeHtml(c.annualLeave)}</th>`;
    thead += '</tr></thead>';

    // Build body
    let tbody = '<tbody>';
    sim.months.forEach(row => {
      tbody += `<tr><td class="col-month">${escapeHtml(row.label)}</td>`;
      row.cells.forEach(cell => {
        const isSelected = cell.iso && cell.iso === state.selectedDateKey;
        const clickable = cell.iso && cell.kind !== 'preStart' && cell.kind !== 'nonDate';
        const cls = `day-cell kind-${cell.kind}${isSelected ? ' active-cell' : ''}`;
        const dataAttr = clickable ? ` data-iso="${cell.iso}"` : '';
        const titleAttr = clickable ? ` title="${escapeHtml(formatDateFullID(cell.date))} — ${escapeHtml(cell.code)}"` : '';
        tbody += `<td class="${cls}"${dataAttr}${titleAttr}>${escapeHtml(cell.code)}</td>`;
      });
      tbody += `<td class="col-sum col-sum-first">${row.stats.work}</td>`;
      tbody += `<td class="col-sum">${row.stats.tc}</td>`;
      tbody += `<td class="col-sum">${row.stats.leave}</td>`;
      tbody += `<td class="col-sum">${row.stats.annualLeave}</td>`;
      tbody += '</tr>';
    });
    tbody += '</tbody>';

    // Build footer total
    const tfoot = `
      <tfoot>
        <tr>
          <td class="col-month">TOTAL</td>
          <td colspan="31" style="text-align:right;padding-right:10px;color:#475569;font-weight:600;">
            Ringkasan 12 Bulan (${sim.cycles.length} Periode Cuti • ${sim.totals.off} hr ${escapeHtml(c.off)})
          </td>
          <td class="col-sum col-sum-first">${sim.totals.work}</td>
          <td class="col-sum">${sim.totals.tc}</td>
          <td class="col-sum">${sim.totals.leave}</td>
          <td class="col-sum">${sim.totals.annualLeave}</td>
        </tr>
      </tfoot>
    `;

    table.innerHTML = thead + tbody + tfoot;

    // Bind cell click events
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

    // Pick selected cell, or default to first tcLast / offDepart / startDate
    let cell = state.selectedDateKey ? sim.cellMap.get(state.selectedDateKey) : null;
    if (!cell || cell.kind === 'preStart') {
      // Auto-focus first interesting cell (tcLast or offDepart or startDate)
      for (const item of sim.cellMap.values()) {
        if (item.kind === 'tcLast' || item.kind === 'offDepart') {
          cell = item;
          break;
        }
      }
      if (!cell) cell = sim.cellMap.get(toISODate(sim.startDate));
    }

    if (!cell) {
      bar.innerHTML = `<div class="inspector-desc">Klik salah satu tanggal pada matriks untuk melihat penjelasan aturan & saran HR.</div>`;
      return;
    }

    const msgTpl = CFG.messages[cell.kind] || CFG.messages.work;
    const color = CFG.colors[cell.kind] || CFG.colors.work;
    const vars = {
      code: cell.code,
      workCode: CFG.codes.work,
      tcCode: CFG.codes.tc,
      offCode: CFG.codes.off,
      cCode: CFG.codes.leave,
      ctCode: CFG.codes.annualLeave,
      cycle: cell.cycle || 1,
      weekWork: cell.weekWork ?? 0,
      minWork: CFG.rules.workDaysPerWeek
    };

    const title = formatTemplate(msgTpl.title, vars);
    const desc = formatTemplate(msgTpl.desc, vars);
    const advice = formatTemplate(msgTpl.advice, vars);

    let extraMeta = cell.cycle ? `Siklus ke-${cell.cycle}` : 'Pra-Mulai';
    if (cell.cycleInfo) {
      extraMeta += ` • ${cell.cycleInfo.ticketLabel} • Total di Rumah: ${cell.cycleInfo.totalHomeDays} hari`;
    }

    bar.innerHTML = `
      <div class="inspector-left">
        <div class="inspector-badge" style="background:${color.bg};color:${color.text};border-color:${color.border};">
          ${escapeHtml(cell.code || '-')}
        </div>
        <div>
          <h4 class="inspector-title">${escapeHtml(title)}</h4>
          <div class="inspector-date">${escapeHtml(formatDateFullID(cell.date))} &bull; ${escapeHtml(extraMeta)}</div>
          <p class="inspector-desc">${escapeHtml(desc)}</p>
        </div>
      </div>
      <div class="inspector-advice">
        <strong>Catatan &amp; Saran HR</strong>
        ${escapeHtml(advice)}
      </div>
    `;
  }

  function renderCyclesTable(sim) {
    const tbody = document.getElementById('cyclesTbody');
    if (!tbody) return;

    const c = CFG.codes;
    if (!sim.cycles.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#64748B;padding:18px;">
            Belum ada periode cuti yang jatuh dalam rentang 12 bulan ini. Coba percepat tanggal mulai ${escapeHtml(c.work)}1 atau ubah durasi target cuti.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = sim.cycles.map(cyc => {
      const ticketHtml = cyc.isCompanyTicket
        ? `<span class="pill pill-company">${escapeHtml(cyc.ticketLabel)}</span>`
        : `<span class="pill pill-self">${escapeHtml(cyc.ticketLabel)}</span>`;

      let ctControlHtml = '';
      if (!sim.joinDate) {
        ctControlHtml = `<span class="pill pill-locked">Isi Join Date</span>`;
      } else if (!cyc.isCtEligible) {
        ctControlHtml = `<span class="pill pill-locked" title="Hak CT aktif mulai ${escapeHtml(formatDateID(cyc.ctEligibleDate, true))}">Terkunci (&lt; 1 thn)</span>`;
      } else {
        const maxForThis = cyc.ctDaysCount + sim.remainingCTBalance;
        ctControlHtml = `
          <div class="ct-stepper">
            <button type="button" data-ct-dec="${cyc.cycle}" ${cyc.ctDaysCount <= 0 ? 'disabled' : ''}>−</button>
            <input type="number" min="0" max="${maxForThis}" value="${cyc.ctDaysCount}" data-ct-input="${cyc.cycle}" aria-label="Alokasi ${escapeHtml(c.annualLeave)} Periode ${cyc.cycle}" />
            <button type="button" data-ct-inc="${cyc.cycle}" ${sim.remainingCTBalance <= 0 ? 'disabled' : ''}>+</button>
          </div>
        `;
      }

      const breakdown = `${cyc.offDaysCount} ${c.off} + ${cyc.cDaysCount} ${c.leave}${cyc.ctDaysCount > 0 ? ` + ${cyc.ctDaysCount} ${c.annualLeave}` : ''}`;

      return `
        <tr>
          <td><strong>Periode ${cyc.cycle}</strong></td>
          <td>${escapeHtml(formatDateID(cyc.siteStart, true))} – ${escapeHtml(formatDateID(cyc.siteEnd, true))}</td>
          <td><strong>${escapeHtml(formatDateID(cyc.departDate, true))}</strong><br><span style="font-size:11px;color:#64748B;">${escapeHtml(CFG.labels.dayNamesFull[cyc.departDate.getDay()])}</span></td>
          <td>${escapeHtml(formatDateID(cyc.leaveEndDate, true))}<br><span style="font-size:11px;color:#64748B;">Kembali ${escapeHtml(c.work)}1: ${escapeHtml(formatDateID(cyc.returnSiteDate, true))}</span></td>
          <td>
            <strong>${cyc.totalHomeDays} Hari</strong>
            <div style="font-size:11px;color:#64748B;">${escapeHtml(breakdown)}</div>
          </td>
          <td>${ctControlHtml}</td>
          <td>${ticketHtml}</td>
        </tr>
      `;
    }).join('');

    // Bind CT stepper events
    tbody.querySelectorAll('[data-ct-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cyc = Number(btn.dataset.ctDec);
        const cur = Number(state.ctAllocations[cyc]) || 0;
        state.ctAllocations[cyc] = Math.max(0, cur - 1);
        saveAndRender();
      });
    });

    tbody.querySelectorAll('[data-ct-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cyc = Number(btn.dataset.ctInc);
        const cur = Number(state.ctAllocations[cyc]) || 0;
        state.ctAllocations[cyc] = cur + 1;
        saveAndRender();
      });
    });

    tbody.querySelectorAll('[data-ct-input]').forEach(inp => {
      inp.addEventListener('change', () => {
        const cyc = Number(inp.dataset.ctInput);
        const val = Math.max(0, Math.floor(Number(inp.value) || 0));
        state.ctAllocations[cyc] = val;
        saveAndRender();
      });
    });
  }

  // ---------- EXCEL EXPORT (ExcelJS with full colors from config.js) ----------
  async function exportToExcel() {
    const sim = lastSimulation;
    if (!sim) return;

    if (!window.ExcelJS) {
      // Fallback to CSV if offline / CDN blocked
      exportToCSVFallback(sim);
      return;
    }

    try {
      const wb = new window.ExcelJS.Workbook();
      wb.creator = CFG.app.title;
      wb.created = new Date();

      const c = CFG.codes;
      const hexToArgb = (hex) => 'FF' + String(hex || '#FFFFFF').replace('#', '').toUpperCase();

      // ===== SHEET 1: MATRIKS TIMESHEET =====
      const ws = wb.addWorksheet('Matriks Timesheet', {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }]
      });

      ws.mergeCells('A1:AJ1');
      ws.getCell('A1').value = `${CFG.app.companyName} — ${CFG.app.title}`;
      ws.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:AJ2');
      const offLabel = state.offDay === 'auto' ? 'Otomatis 5:2' : `Tetap ${CFG.labels.dayNamesFull[Number(state.offDay)]}`;
      ws.getCell('A2').value =
        `Nama: ${state.employeeName || '-'} | NIK: ${state.employeeNik || '-'} | Jabatan: ${state.employeeRole || '-'} | ` +
        `Join Date: ${formatDateID(sim.joinDate, true)} | Mulai ${c.work}1: ${formatDateID(sim.startDate, true)} | ` +
        `Target Cuti: ${sim.targetHomeDays} Hari | Hari ${c.off}: ${offLabel}`;
      ws.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF334155' } };
      ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      ws.getRow(2).height = 20;

      ws.mergeCells('A3:AJ3');
      ws.getCell('A3').value =
        `Opsi Pulang: ${CFG.labels.departureModes[state.departureMode]} | Sisa Saldo ${c.annualLeave}: ${sim.remainingCTBalance} hari (Terpakai: ${sim.totalCTUsed} hari)`;
      ws.getCell('A3').font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
      ws.getRow(3).height = 18;

      // Blank spacer row 4
      ws.getRow(4).height = 6;

      // Header Row 5
      const headers = ['Bulan'];
      for (let d = 1; d <= 31; d++) headers.push(d);
      headers.push(c.work, c.tc, c.leave, c.annualLeave);
      const hdrRow = ws.getRow(5);
      hdrRow.values = headers;
      hdrRow.height = 22;
      hdrRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF64748B' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Data Rows (Months)
      sim.months.forEach((mRow, idx) => {
        const rNum = 6 + idx;
        const row = ws.getRow(rNum);
        row.height = 21;

        const mCell = row.getCell(1);
        mCell.value = mRow.label;
        mCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        mCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        mCell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'medium', color: { argb: 'FF94A3B8' } }
        };

        mRow.cells.forEach((cellData, dIdx) => {
          const excelCell = row.getCell(2 + dIdx);
          excelCell.value = cellData.code || '';
          const colSpec = CFG.colors[cellData.kind] || CFG.colors.work;
          excelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(colSpec.bg) } };
          excelCell.font = {
            name: 'Calibri',
            size: 9,
            bold: cellData.kind !== 'work' && cellData.kind !== 'workPartial',
            color: { argb: hexToArgb(colSpec.text) }
          };
          excelCell.alignment = { vertical: 'middle', horizontal: 'center' };
          excelCell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });

        // Summary columns (X, TC, C, CT)
        const sumVals = [mRow.stats.work, mRow.stats.tc, mRow.stats.leave, mRow.stats.annualLeave];
        sumVals.forEach((val, sIdx) => {
          const sc = row.getCell(33 + sIdx);
          sc.value = val;
          sc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          sc.alignment = { vertical: 'middle', horizontal: 'center' };
          sc.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: sIdx === 0 ? 'medium' : 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });
      });

      // Totals row
      const totRowIdx = 6 + sim.months.length;
      const totRow = ws.getRow(totRowIdx);
      totRow.height = 23;
      totRow.getCell(1).value = 'TOTAL';
      ws.mergeCells(totRowIdx, 2, totRowIdx, 32);
      totRow.getCell(2).value = `Total 12 Bulan (${sim.cycles.length} Periode Cuti • ${sim.totals.off} hr ${c.off})`;
      totRow.getCell(33).value = { formula: `SUM(AG6:AG${totRowIdx - 1})`, result: sim.totals.work };
      totRow.getCell(34).value = { formula: `SUM(AH6:AH${totRowIdx - 1})`, result: sim.totals.tc };
      totRow.getCell(35).value = { formula: `SUM(AI6:AI${totRowIdx - 1})`, result: sim.totals.leave };
      totRow.getCell(36).value = { formula: `SUM(AJ6:AJ${totRowIdx - 1})`, result: sim.totals.annualLeave };

      for (let col = 1; col <= 36; col++) {
        const cell = totRow.getCell(col);
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'right' : 'center' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF64748B' } },
          bottom: { style: 'medium', color: { argb: 'FF64748B' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      }

      // Column widths
      ws.getColumn(1).width = 13;
      for (let col = 2; col <= 32; col++) ws.getColumn(col).width = 5.4;
      for (let col = 33; col <= 36; col++) ws.getColumn(col).width = 6.2;

      // ===== SHEET 2: RINGKASAN PERIODE CUTI =====
      const ws2 = wb.addWorksheet('Ringkasan Periode Cuti');
      ws2.columns = [
        { header: 'Periode', key: 'periode', width: 12 },
        { header: 'Kerja di Site', key: 'site', width: 26 },
        { header: 'Tanggal Berangkat', key: 'depart', width: 22 },
        { header: 'Akhir Cuti', key: 'end', width: 18 },
        { header: `Kembali (${c.work}1)`, key: 'ret', width: 18 },
        { header: `Hari ${c.off}`, key: 'off', width: 10 },
        { header: `Hari ${c.leave}`, key: 'c', width: 10 },
        { header: `Hari ${c.annualLeave}`, key: 'ct', width: 10 },
        { header: 'Total di Rumah', key: 'total', width: 15 },
        { header: 'Status Tiket', key: 'ticket', width: 24 }
      ];

      const h2 = ws2.getRow(1);
      h2.height = 24;
      h2.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      sim.cycles.forEach(cyc => {
        const r = ws2.addRow({
          periode: `Periode ${cyc.cycle}`,
          site: `${formatDateID(cyc.siteStart, true)} – ${formatDateID(cyc.siteEnd, true)}`,
          depart: `${CFG.labels.dayNamesShort[cyc.departDate.getDay()]}, ${formatDateID(cyc.departDate, true)}`,
          end: formatDateID(cyc.leaveEndDate, true),
          ret: formatDateID(cyc.returnSiteDate, true),
          off: cyc.offDaysCount,
          c: cyc.cDaysCount,
          ct: cyc.ctDaysCount,
          total: cyc.totalHomeDays,
          ticket: cyc.ticketLabel
        });
        r.height = 20;
        const tkCell = r.getCell(10);
        tkCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cyc.isCompanyTicket ? 'FFDCFCE7' : 'FFFEF3C7' }
        };
        tkCell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: cyc.isCompanyTicket ? 'FF166534' : 'FF92400E' }
        };
      });

      // ===== SHEET 3: LEGENDA & KONFIGURASI AKTIF =====
      const ws3 = wb.addWorksheet('Legenda & Aturan');
      ws3.columns = [
        { header: 'Kode', key: 'code', width: 14 },
        { header: 'Keterangan', key: 'desc', width: 42 },
        { header: 'Warna Hex', key: 'hex', width: 14 }
      ];
      ws3.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      });
      Object.entries(CFG.colors).forEach(([k, v]) => {
        const r = ws3.addRow({ code: k, desc: v.label, hex: v.bg });
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(v.bg) } };
        r.getCell(1).font = { bold: true, color: { argb: hexToArgb(v.text) } };
      });

      // Download file
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const safeName = (state.employeeName || 'Karyawan').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const fileName = `KAN_Timesheet_${safeName}_${sim.startDate.getFullYear()}.xlsx`;
      triggerDownload(blob, fileName);
      showToast(`File Excel "${fileName}" berhasil diunduh.`);
    } catch (err) {
      console.error('Excel export error:', err);
      exportToCSVFallback(sim);
    }
  }

  function exportToCSVFallback(sim) {
    const c = CFG.codes;
    const rows = [];
    const header = ['Bulan'];
    for (let d = 1; d <= 31; d++) header.push(String(d));
    header.push(c.work, c.tc, c.leave, c.annualLeave);
    rows.push(header.join(','));

    sim.months.forEach(m => {
      const cols = [`"${m.label}"`];
      m.cells.forEach(cell => cols.push(`"${cell.code || ''}"`));
      cols.push(m.stats.work, m.stats.tc, m.stats.leave, m.stats.annualLeave);
      rows.push(cols.join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `KAN_Timesheet_${sim.startDate.getFullYear()}.csv`);
    showToast('Mode offline terdeteksi: diekspor ke format CSV.');
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- PERSISTENCE (localStorage) ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        Object.assign(state, saved);
        // Always enforce current config.js minimum home leave rule
        state.targetHomeDays = Math.max(
          CFG.rules.minHomeLeaveDays,
          Math.min(CFG.rules.maxHomeLeaveDays, Number(state.targetHomeDays) || CFG.rules.defaultHomeLeaveDays)
        );
      }
    } catch (_) {
      // Ignore corrupted localStorage
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // Ignore quota/private mode errors
    }
  }

  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    state.employeeName = CFG.defaults.employeeName;
    state.employeeNik = CFG.defaults.employeeNik;
    state.employeeRole = CFG.defaults.employeeRole;
    state.joinDate = CFG.defaults.joinDate;
    state.startDate = CFG.defaults.startDate;
    state.targetHomeDays = Math.max(CFG.rules.minHomeLeaveDays, CFG.rules.defaultHomeLeaveDays);
    state.offDay = CFG.rules.defaultOffDay;
    state.departureMode = CFG.rules.defaultDepartureMode;
    state.workCounterMode = CFG.rules.defaultWorkCounterMode;
    state.grayBoxMode = CFG.rules.defaultGrayBoxMode;
    state.viewMode = CFG.rules.defaultViewMode;
    state.annualLeaveBalance = CFG.defaults.annualLeaveBalance;
    state.ctAllocations = {};
    state.selectedDateKey = null;
    syncFormInputs();
    renderAll();
    showToast('Pengaturan dikembalikan ke nilai default config.js.');
  }

  // ---------- MAIN RENDER ORCHESTRATOR ----------
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
    const bindInput = (id, key, transform) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        state[key] = transform ? transform(el.value) : el.value;
        saveAndRender();
      });
    };

    bindInput('inputName', 'employeeName');
    bindInput('inputNik', 'employeeNik');
    bindInput('inputRole', 'employeeRole');
    bindInput('inputJoinDate', 'joinDate');
    bindInput('inputStartDate', 'startDate');
    bindInput('inputOffDay', 'offDay');
    bindInput('inputCounterMode', 'workCounterMode');
    bindInput('inputGrayMode', 'grayBoxMode');
    bindInput('inputViewMode', 'viewMode');

    const homeInput = document.getElementById('inputHomeDays');
    if (homeInput) {
      homeInput.addEventListener('change', () => {
        const minD = CFG.rules.minHomeLeaveDays;
        const maxD = CFG.rules.maxHomeLeaveDays;
        let val = Math.floor(Number(homeInput.value) || minD);
        if (val < minD) {
          val = minD;
          showToast(`Minimal pengajuan cuti di rumah adalah ${minD} hari sesuai SOP.`);
        }
        if (val > maxD) val = maxD;
        state.targetHomeDays = val;
        saveAndRender();
      });
    }

    const ctBalInput = document.getElementById('inputCtBalance');
    if (ctBalInput) {
      ctBalInput.addEventListener('change', () => {
        state.annualLeaveBalance = Math.max(0, Math.min(60, Math.floor(Number(ctBalInput.value) || 0)));
        saveAndRender();
      });
    }

    document.querySelectorAll('input[name="departureMode"]').forEach(r => {
      r.addEventListener('change', () => {
        if (r.checked) {
          state.departureMode = r.value;
          saveAndRender();
        }
      });
    });

    // Header Actions
    const btnReset = document.getElementById('btnReset');
    if (btnReset) btnReset.addEventListener('click', resetToDefaults);

    const btnExcel = document.getElementById('btnExportExcel');
    if (btnExcel) btnExcel.addEventListener('click', exportToExcel);

    const btnPrint = document.getElementById('btnPrintPdf');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    // Config Modal
    const modal = document.getElementById('configModal');
    const btnShowCfg = document.getElementById('btnShowConfig');
    const btnCloseCfg = document.getElementById('btnCloseConfig');
    if (btnShowCfg && modal) {
      btnShowCfg.addEventListener('click', () => {
        const pre = document.getElementById('configPreviewCode');
        if (pre) pre.textContent = JSON.stringify(CFG, null, 2);
        modal.classList.add('open');
      });
    }
    if (btnCloseCfg && modal) {
      btnCloseCfg.addEventListener('click', () => modal.classList.remove('open'));
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }

    // Clear CT Allocations button
    const btnClearCT = document.getElementById('btnClearCT');
    if (btnClearCT) {
      btnClearCT.addEventListener('click', () => {
        state.ctAllocations = {};
        saveAndRender();
        showToast(`Alokasi ${CFG.codes.annualLeave} pada semua periode di-reset ke 0.`);
      });
    }
  }

  // ---------- SMALL DOM HELPERS ----------
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
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---------- INIT ----------
  document.addEventListener('DOMContentLoaded', () => {
    injectConfigTheme();
    loadState();
    renderStaticBrand();
    renderLegend();
    syncFormInputs();
    bindEvents();
    renderAll();
  });
})();
