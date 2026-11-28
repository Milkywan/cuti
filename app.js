/**
 * ============================================================================
 * MULTI-COMPANY TIMESHEET & LEAVE SIMULATOR — SHELL CONTROLLER (app.js v3.0)
 * ============================================================================
 * Mengelola:
 * - Autentikasi & Hak Akses Per Entitas (PT KAN / PT BJL / Super Admin)
 * - Company Switcher & Auto-deteksi Share Hash (#bjl=... vs #s=...)
 * - Delegasi Aksi Topbar ke window.KAN_APP & window.BJL_APP
 * - Editor Master & Input Mandiri Tarif Lumpsum BJL (P6, M8, Y, Z & Override)
 * - Editor Susunan Blok Tanda Tangan Cetak PDF (KAN & BJL)
 * - Notifikasi Toast Global (window.APP_SHOW_TOAST)
 * ============================================================================
 */

(function () {
  'use strict';

  const APP_CFG = window.APP_CONFIG;
  if (!APP_CFG) {
    alert('Gagal memuat APP_CONFIG dari config.js!');
    return;
  }

  let currentUser = null;
  let activeCompany = 'BJL';
  let toastTimer = null;

  // ---------- GLOBAL TOAST ----------
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }
  window.APP_SHOW_TOAST = showToast;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- SESSION & AUTH ----------
  function getStoredSession() {
    try {
      const raw = localStorage.getItem(APP_CFG.auth.sessionKey);
      if (!raw) return null;
      const sess = JSON.parse(raw);
      const user = (APP_CFG.auth.users || []).find(u => u.username === sess.username);
      return user || null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(user) {
    try {
      localStorage.setItem(APP_CFG.auth.sessionKey, JSON.stringify({
        username: user.username,
        loggedInAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(APP_CFG.auth.sessionKey);
    } catch (_) {}
  }

  function renderQuickLoginPills() {
    const wrap = document.getElementById('loginQuickUsers');
    if (!wrap) return;
    wrap.innerHTML = (APP_CFG.auth.users || []).map(u => `
      <button type="button" class="quick-user-pill" data-quick-user="${escapeHtml(u.username)}">
        ${escapeHtml(u.username)} • ${escapeHtml(u.role)}
      </button>
    `).join('');

    wrap.querySelectorAll('[data-quick-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = (APP_CFG.auth.users || []).find(x => x.username === btn.dataset.quickUser);
        if (!u) return;
        const uInp = document.getElementById('loginUsername');
        const pInp = document.getElementById('loginPassword');
        if (uInp) uInp.value = u.username;
        if (pInp) pInp.value = u.password;
        document.getElementById('loginError')?.classList.remove('show');
      });
    });
  }

  function showLoginScreen() {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('appShell')?.classList.add('hidden');
    document.getElementById('loginUsername')?.focus();
  }

  function enterApp(user) {
    currentUser = user;
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');

    const nameEl = document.getElementById('userDisplayName');
    const roleEl = document.getElementById('userRoleTag');
    if (nameEl) nameEl.textContent = user.displayName || user.username;
    if (roleEl) roleEl.textContent = user.role || 'User';

    // Configure company switcher based on permitted companies
    const allowed = Array.isArray(user.companies) && user.companies.length ? user.companies : ['BJL'];
    const switcher = document.getElementById('companySwitcher');
    if (switcher) {
      switcher.style.display = allowed.length > 1 ? 'inline-flex' : 'none';
      switcher.querySelectorAll('.company-tab').forEach(btn => {
        const c = btn.dataset.company;
        btn.style.display = allowed.includes(c) ? 'inline-block' : 'none';
      });
    }

    // Decide initial company (respect share hash if permitted)
    let target = user.defaultCompany && allowed.includes(user.defaultCompany) ? user.defaultCompany : allowed[0];
    const h = window.location.hash || '';
    if (h.startsWith('#bjl=') && allowed.includes('BJL')) target = 'BJL';
    else if (h.startsWith('#s=') && allowed.includes('KAN')) target = 'KAN';
    else {
      try {
        const lastCo = localStorage.getItem('ts_sim_last_company_v3');
        if (lastCo && allowed.includes(lastCo)) target = lastCo;
      } catch (_) {}
    }

    switchCompany(target, false);
  }

  function switchCompany(companyCode, notify) {
    if (!currentUser) return;
    const allowed = currentUser.companies || ['BJL'];
    if (!allowed.includes(companyCode)) {
      showToast(`Akun Anda tidak memiliki akses ke modul PT ${companyCode}.`);
      return;
    }

    activeCompany = companyCode;
    document.body.setAttribute('data-company', companyCode);
    try { localStorage.setItem('ts_sim_last_company_v3', companyCode); } catch (_) {}

    // Toggle workspaces
    document.getElementById('workspaceBJL')?.classList.toggle('active', companyCode === 'BJL');
    document.getElementById('workspaceKAN')?.classList.toggle('active', companyCode === 'KAN');

    // Toggle switcher active tab
    document.querySelectorAll('#companySwitcher .company-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.company === companyCode);
    });

    // Toggle BJL-only Lumpsum button
    const btnLump = document.getElementById('btnOpenLumpsum');
    if (btnLump) btnLump.style.display = companyCode === 'BJL' ? 'inline-flex' : 'none';

    // Update topbar brand text
    const markEl = document.getElementById('brandMark');
    const titleEl = document.getElementById('appTitle');
    const subEl = document.getElementById('appSubtitle');
    if (companyCode === 'BJL' && window.BJL_CONFIG) {
      if (markEl) markEl.textContent = 'BJL';
      if (titleEl) titleEl.innerHTML = `${escapeHtml(window.BJL_CONFIG.app.title)} <span class="version-pill">v${escapeHtml(APP_CFG.version)}</span>`;
      if (subEl) subEl.textContent = `${window.BJL_CONFIG.app.companyName} — ${window.BJL_CONFIG.app.subtitle}`;
      document.title = `${window.BJL_CONFIG.app.title} v${APP_CFG.version}`;
      window.BJL_APP?.rerender?.();
    } else if (companyCode === 'KAN' && window.KAN_CONFIG) {
      if (markEl) markEl.textContent = 'KAN';
      if (titleEl) titleEl.innerHTML = `${escapeHtml(window.KAN_CONFIG.app.title)} <span class="version-pill">v${escapeHtml(APP_CFG.version)}</span>`;
      if (subEl) subEl.textContent = `${window.KAN_CONFIG.app.companyName} — ${window.KAN_CONFIG.app.subtitle}`;
      document.title = `${window.KAN_CONFIG.app.title} v${APP_CFG.version}`;
      window.KAN_APP?.rerender?.();
    }

    if (notify) {
      const coMeta = APP_CFG.companies?.[companyCode];
      showToast(`Beralih ke modul ${coMeta ? coMeta.fullName : companyCode}.`);
    }
  }

  function getActiveModule() {
    return activeCompany === 'BJL' ? window.BJL_APP : window.KAN_APP;
  }

  // ---------- BJL LUMPSUM EDITOR MODAL ----------
  let lumpDraftMap = {}; // { [cityName]: { departLeg1, departLeg2, returnLeg1, returnLeg2 } }

  function openLumpsumModal() {
    if (!window.BJL_CONFIG || !window.BJL_APP) return;
    const sel = document.getElementById('lumpsumGroupSelect');
    if (sel) {
      const currentGrade = document.getElementById('bjlGrade')?.value || window.BJL_CONFIG.defaults.employeeGrade;
      const currentGroup = window.BJL_CONFIG.gradeToLumpsumGroup[currentGrade] || 'G4';
      sel.innerHTML = Object.entries(window.BJL_CONFIG.lumpsumGroups).map(([k, g]) =>
        `<option value="${escapeHtml(k)}">${escapeHtml(k)} — ${escapeHtml(g.label)}</option>`
      ).join('');
      sel.value = currentGroup;
    }
    const searchEl = document.getElementById('lumpsumCitySearch');
    if (searchEl) searchEl.value = '';
    loadLumpsumGroupIntoDraft();
    renderLumpsumTable();
    document.getElementById('lumpsumModal')?.classList.add('open');
  }

  function loadLumpsumGroupIntoDraft() {
    const CFG = window.BJL_CONFIG;
    const groupKey = document.getElementById('lumpsumGroupSelect')?.value || 'G4';
    const gMeta = CFG.lumpsumGroups[groupKey] || { label: groupKey, isCustom: false };
    const customStore = window.BJL_APP.getCustomLumpsumStore() || {};
    const customGroup = customStore[groupKey] || {};

    lumpDraftMap = {};
    CFG.pohCities.forEach(c => {
      if (customGroup[c.name]) {
        lumpDraftMap[c.name] = {
          departLeg1: Number(customGroup[c.name].departLeg1) || 0,
          departLeg2: Number(customGroup[c.name].departLeg2) || 0,
          returnLeg1: Number(customGroup[c.name].returnLeg1) || 0,
          returnLeg2: Number(customGroup[c.name].returnLeg2) || 0,
          hasCustom: true
        };
      } else if (gMeta.isCustom) {
        lumpDraftMap[c.name] = {
          departLeg1: '',
          departLeg2: '',
          returnLeg1: '',
          returnLeg2: '',
          hasCustom: false
        };
      } else {
        const dep = c.depart?.[groupKey] || { leg1: 0, leg2: 0 };
        const ret = c.return?.[groupKey] || { leg1: 0, leg2: 0 };
        lumpDraftMap[c.name] = {
          departLeg1: Number(dep.leg1) || 0,
          departLeg2: Number(dep.leg2) || 0,
          returnLeg1: Number(ret.leg1) || 0,
          returnLeg2: Number(ret.leg2) || 0,
          hasCustom: false
        };
      }
    });

    const noteEl = document.getElementById('lumpsumEditorNote');
    if (noteEl) {
      noteEl.innerHTML = gMeta.isCustom
        ? `<strong>${escapeHtml(gMeta.label)}</strong>: Grup ini belum memiliki tarif bawaan di Excel master. Anda dapat mengisi nominal per kota di bawah ini atau menyalin referensi dari grup G1–G4 lalu menyesuaikannya.`
        : `<strong>${escapeHtml(groupKey)} (${escapeHtml(gMeta.label)})</strong>: Menampilkan tarif standar dari Excel master. Perubahan yang disimpan akan menimpa tarif bawaan di browser ini.`;
    }
  }

  function renderLumpsumTable() {
    const CFG = window.BJL_CONFIG;
    const tbody = document.getElementById('lumpsumEditorTbody');
    if (!tbody) return;
    const q = (document.getElementById('lumpsumCitySearch')?.value || '').trim().toLowerCase();
    const fmt = window.BJL_APP.formatRp;

    const cities = CFG.pohCities.filter(c => !q || c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q));
    if (!cities.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748B;padding:16px;">Kota POH tidak ditemukan.</td></tr>`;
      return;
    }

    tbody.innerHTML = cities.map(c => {
      const row = lumpDraftMap[c.name] || { departLeg1: '', departLeg2: '', returnLeg1: '', returnLeg2: '' };
      const z = CFG.trvZones[c.zone];
      const hasVal = row.departLeg1 !== '' || row.departLeg2 !== '' || row.returnLeg1 !== '' || row.returnLeg2 !== '';
      const dTot = (Number(row.departLeg1) || 0) + (Number(row.departLeg2) || 0);
      const rTot = (Number(row.returnLeg1) || 0) + (Number(row.returnLeg2) || 0);

      return `
        <tr data-city="${escapeHtml(c.name)}">
          <td><strong>${escapeHtml(c.name)}</strong><div style="font-size:10.5px;color:#64748B;">${escapeHtml(c.region)}</div></td>
          <td style="white-space:nowrap;">TRV ${z ? z.trvDays : 0}</td>
          <td><input type="number" min="0" step="5000" data-field="departLeg1" value="${row.departLeg1}" placeholder="0" /></td>
          <td><input type="number" min="0" step="5000" data-field="departLeg2" value="${row.departLeg2}" placeholder="0" /></td>
          <td class="lumpsum-total-cell go" data-tot="go">${hasVal ? fmt(dTot) : '—'}</td>
          <td><input type="number" min="0" step="5000" data-field="returnLeg1" value="${row.returnLeg1}" placeholder="0" /></td>
          <td><input type="number" min="0" step="5000" data-field="returnLeg2" value="${row.returnLeg2}" placeholder="0" /></td>
          <td class="lumpsum-total-cell back" data-tot="back">${hasVal ? fmt(rTot) : '—'}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-city] input[type="number"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const tr = inp.closest('tr');
        const city = tr?.dataset.city;
        const field = inp.dataset.field;
        if (!city || !field || !lumpDraftMap[city]) return;
        lumpDraftMap[city][field] = inp.value === '' ? '' : Math.max(0, Number(inp.value) || 0);
        const r = lumpDraftMap[city];
        const hasVal = r.departLeg1 !== '' || r.departLeg2 !== '' || r.returnLeg1 !== '' || r.returnLeg2 !== '';
        const dTot = (Number(r.departLeg1) || 0) + (Number(r.departLeg2) || 0);
        const rTot = (Number(r.returnLeg1) || 0) + (Number(r.returnLeg2) || 0);
        const goCell = tr.querySelector('[data-tot="go"]');
        const bkCell = tr.querySelector('[data-tot="back"]');
        if (goCell) goCell.textContent = hasVal ? fmt(dTot) : '—';
        if (bkCell) bkCell.textContent = hasVal ? fmt(rTot) : '—';
      });
    });
  }

  function saveLumpsumDraft() {
    const CFG = window.BJL_CONFIG;
    const groupKey = document.getElementById('lumpsumGroupSelect')?.value || 'G4';
    const gMeta = CFG.lumpsumGroups[groupKey] || { isCustom: false };
    const store = window.BJL_APP.getCustomLumpsumStore() || {};
    const groupObj = {};

    CFG.pohCities.forEach(c => {
      const r = lumpDraftMap[c.name];
      if (!r) return;
      const anyFilled = r.departLeg1 !== '' || r.departLeg2 !== '' || r.returnLeg1 !== '' || r.returnLeg2 !== '';
      if (!anyFilled) return;

      const d1 = Number(r.departLeg1) || 0;
      const d2 = Number(r.departLeg2) || 0;
      const r1 = Number(r.returnLeg1) || 0;
      const r2 = Number(r.returnLeg2) || 0;

      if (gMeta.isCustom) {
        groupObj[c.name] = { departLeg1: d1, departLeg2: d2, returnLeg1: r1, returnLeg2: r2 };
      } else {
        const defD = c.depart?.[groupKey] || { leg1: 0, leg2: 0 };
        const defR = c.return?.[groupKey] || { leg1: 0, leg2: 0 };
        if (d1 !== (defD.leg1 || 0) || d2 !== (defD.leg2 || 0) || r1 !== (defR.leg1 || 0) || r2 !== (defR.leg2 || 0)) {
          groupObj[c.name] = { departLeg1: d1, departLeg2: d2, returnLeg1: r1, returnLeg2: r2 };
        }
      }
    });

    if (Object.keys(groupObj).length) store[groupKey] = groupObj;
    else delete store[groupKey];

    window.BJL_APP.saveCustomLumpsumStore(store);
    window.BJL_APP.rerender();
    document.getElementById('lumpsumModal')?.classList.remove('open');
    showToast(`Tarif Lumpsum grup ${groupKey} berhasil disimpan.`);
  }

  // ---------- PDF SIGNATURE EDITOR MODAL (KAN & BJL) ----------
  let sigDraft = [];

  function getSigStorageKey() {
    return activeCompany === 'BJL' ? 'ts_sim_signatures_BJL_v3' : 'ts_sim_signatures_KAN_v3';
  }

  function getDefaultSignatures() {
    if (activeCompany === 'BJL' && window.BJL_CONFIG?.signatures) {
      return window.BJL_CONFIG.signatures.map(s => ({ title: s.title || '', role: s.role || '', name: s.name || '' }));
    }
    if (window.KAN_CONFIG?.signatures) {
      return window.KAN_CONFIG.signatures.map(s => ({ title: s.title || '', role: s.role || '', name: s.name || '' }));
    }
    return [];
  }

  function openSignatureModal() {
    let list = getDefaultSignatures();
    try {
      const saved = localStorage.getItem(getSigStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) list = parsed;
      }
    } catch (_) {}

    sigDraft = list.map(s => ({ title: s.title || '', role: s.role || '', name: s.name || '' }));
    const titleEl = document.getElementById('signatureModalTitle');
    if (titleEl) titleEl.textContent = `✍️ Atur Blok Tanda Tangan PDF — PT ${activeCompany}`;
    renderSigEditorRows();
    document.getElementById('signatureModal')?.classList.add('open');
  }

  function renderSigEditorRows() {
    const container = document.getElementById('sigEditorList');
    if (!container) return;

    if (!sigDraft.length) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:#64748B;font-size:12.5px;">Belum ada kolom tanda tangan. Klik tombol tambah di bawah.</div>`;
      return;
    }

    container.innerHTML = sigDraft.map((s, idx) => `
      <div class="sig-editor-row" data-sig-idx="${idx}">
        <span class="sig-row-num">${idx + 1}</span>
        <input type="text" data-sig-field="title" value="${escapeHtml(s.title)}" placeholder="Label (misal: Disetujui Oleh,)" />
        <input type="text" data-sig-field="role" value="${escapeHtml(s.role)}" placeholder="Jabatan (misal: Head of HR & GA)" />
        <input type="text" data-sig-field="name" value="${escapeHtml(s.name)}" placeholder="Nama (opsional)" />
        <div class="sig-row-actions">
          <button type="button" data-sig-up="${idx}" ${idx === 0 ? 'disabled' : ''} title="Geser naik">↑</button>
          <button type="button" data-sig-down="${idx}" ${idx === sigDraft.length - 1 ? 'disabled' : ''} title="Geser turun">↓</button>
          <button type="button" data-sig-del="${idx}" style="color:#B91C1C;" title="Hapus kolom">✕</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.sig-editor-row input').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.closest('.sig-editor-row')?.dataset.sigIdx);
        const field = inp.dataset.sigField;
        if (!isNaN(idx) && sigDraft[idx] && field) sigDraft[idx][field] = inp.value;
      });
    });

    container.querySelectorAll('[data-sig-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.sigUp);
        if (i > 0) {
          [sigDraft[i - 1], sigDraft[i]] = [sigDraft[i], sigDraft[i - 1]];
          renderSigEditorRows();
        }
      });
    });

    container.querySelectorAll('[data-sig-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.sigDown);
        if (i < sigDraft.length - 1) {
          [sigDraft[i + 1], sigDraft[i]] = [sigDraft[i], sigDraft[i + 1]];
          renderSigEditorRows();
        }
      });
    });

    container.querySelectorAll('[data-sig-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.sigDel);
        sigDraft.splice(i, 1);
        renderSigEditorRows();
      });
    });
  }

  // ---------- EVENT BINDINGS ----------
  function bindShellEvents() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const uname = (document.getElementById('loginUsername')?.value || '').trim();
      const pwd = document.getElementById('loginPassword')?.value || '';
      const matched = (APP_CFG.auth.users || []).find(u => u.username === uname && u.password === pwd);
      const errEl = document.getElementById('loginError');
      if (!matched) {
        errEl?.classList.add('show');
        return;
      }
      errEl?.classList.remove('show');
      saveSession(matched);
      enterApp(matched);
      showToast(`Selamat datang, ${matched.displayName || matched.username}!`);
    });

    document.getElementById('btnTogglePassword')?.addEventListener('click', () => {
      const inp = document.getElementById('loginPassword');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Logout
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      clearSession();
      currentUser = null;
      const pInp = document.getElementById('loginPassword');
      if (pInp) pInp.value = '';
      showLoginScreen();
      showToast('Anda telah keluar dari sesi.');
    });

    // Company Switcher
    document.querySelectorAll('#companySwitcher .company-tab').forEach(btn => {
      btn.addEventListener('click', () => switchCompany(btn.dataset.company, true));
    });

    // Delegated Topbar Actions
    document.getElementById('btnOpenScenario')?.addEventListener('click', () => getActiveModule()?.openScenario?.());
    document.getElementById('btnShareLink')?.addEventListener('click', () => getActiveModule()?.shareLink?.());
    document.getElementById('btnShowConfig')?.addEventListener('click', () => getActiveModule()?.showConfig?.());
    document.getElementById('btnReset')?.addEventListener('click', () => getActiveModule()?.reset?.());
    document.getElementById('btnExportExcel')?.addEventListener('click', () => getActiveModule()?.exportExcel?.());
    document.getElementById('btnPrintPdf')?.addEventListener('click', () => window.print());

    // Lumpsum Modal
    const lumpModal = document.getElementById('lumpsumModal');
    document.getElementById('btnOpenLumpsum')?.addEventListener('click', openLumpsumModal);
    document.getElementById('btnCloseLumpsum')?.addEventListener('click', () => lumpModal?.classList.remove('open'));
    document.getElementById('btnCancelLumpsum')?.addEventListener('click', () => lumpModal?.classList.remove('open'));
    lumpModal?.addEventListener('click', (e) => { if (e.target === lumpModal) lumpModal.classList.remove('open'); });

    document.getElementById('lumpsumGroupSelect')?.addEventListener('change', () => {
      loadLumpsumGroupIntoDraft();
      renderLumpsumTable();
    });
    document.getElementById('lumpsumCitySearch')?.addEventListener('input', renderLumpsumTable);

    document.getElementById('btnLumpsumCopyApply')?.addEventListener('click', () => {
      const src = document.getElementById('lumpsumCopyFrom')?.value;
      if (!src || !window.BJL_CONFIG) return;
      window.BJL_CONFIG.pohCities.forEach(c => {
        const dep = c.depart?.[src] || { leg1: 0, leg2: 0 };
        const ret = c.return?.[src] || { leg1: 0, leg2: 0 };
        lumpDraftMap[c.name] = {
          departLeg1: Number(dep.leg1) || 0,
          departLeg2: Number(dep.leg2) || 0,
          returnLeg1: Number(ret.leg1) || 0,
          returnLeg2: Number(ret.leg2) || 0,
          hasCustom: true
        };
      });
      renderLumpsumTable();
      showToast(`Tarif referensi dari grup ${src} disalin ke editor. Klik Simpan untuk menerapkan.`);
    });

    document.getElementById('btnSaveLumpsum')?.addEventListener('click', saveLumpsumDraft);

    document.getElementById('btnLumpsumResetGroup')?.addEventListener('click', () => {
      const groupKey = document.getElementById('lumpsumGroupSelect')?.value;
      if (!groupKey || !window.BJL_APP) return;
      const store = window.BJL_APP.getCustomLumpsumStore() || {};
      delete store[groupKey];
      window.BJL_APP.saveCustomLumpsumStore(store);
      loadLumpsumGroupIntoDraft();
      renderLumpsumTable();
      window.BJL_APP.rerender();
      showToast(`Tarif grup ${groupKey} dikembalikan ke default.`);
    });

    document.getElementById('btnLumpsumResetAll')?.addEventListener('click', () => {
      if (!window.BJL_APP) return;
      window.BJL_APP.saveCustomLumpsumStore({});
      loadLumpsumGroupIntoDraft();
      renderLumpsumTable();
      window.BJL_APP.rerender();
      showToast('Semua override tarif Lumpsum telah di-reset ke default.');
    });

    // Signature Editor Modal
    const sigModal = document.getElementById('signatureModal');
    document.getElementById('btnOpenSignatures')?.addEventListener('click', openSignatureModal);
    document.getElementById('btnCloseSignatures')?.addEventListener('click', () => sigModal?.classList.remove('open'));
    document.getElementById('btnCancelSignatures')?.addEventListener('click', () => sigModal?.classList.remove('open'));
    sigModal?.addEventListener('click', (e) => { if (e.target === sigModal) sigModal.classList.remove('open'); });

    document.getElementById('btnAddSignatureRow')?.addEventListener('click', () => {
      sigDraft.push({ title: 'Disetujui Oleh,', role: 'Jabatan / Divisi', name: '' });
      renderSigEditorRows();
    });

    document.getElementById('btnSaveSignatures')?.addEventListener('click', () => {
      const cleaned = sigDraft
        .map(s => ({ title: (s.title || '').trim(), role: (s.role || '').trim(), name: (s.name || '').trim() }))
        .filter(s => s.title || s.role);
      if (!cleaned.length) {
        showToast('Minimal harus ada 1 kolom tanda tangan.');
        return;
      }
      try { localStorage.setItem(getSigStorageKey(), JSON.stringify(cleaned)); } catch (_) {}
      getActiveModule()?.refreshSignatures?.();
      sigModal?.classList.remove('open');
      showToast(`Susunan tanda tangan PDF PT ${activeCompany} disimpan.`);
    });

    document.getElementById('btnResetSignatures')?.addEventListener('click', () => {
      try { localStorage.removeItem(getSigStorageKey()); } catch (_) {}
      sigDraft = getDefaultSignatures();
      renderSigEditorRows();
      getActiveModule()?.refreshSignatures?.();
      showToast(`Tanda tangan PDF PT ${activeCompany} dikembalikan ke default SOP.`);
    });
  }

  // ---------- INIT ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderQuickLoginPills();
    bindShellEvents();

    if (!APP_CFG.auth || !APP_CFG.auth.enabled) {
      enterApp((APP_CFG.auth?.users && APP_CFG.auth.users[0]) || {
        username: 'admin',
        displayName: 'Admin',
        role: 'Super Admin',
        companies: ['BJL', 'KAN'],
        defaultCompany: 'BJL'
      });
      return;
    }

    const existing = getStoredSession();
    if (existing) {
      enterApp(existing);
    } else {
      showLoginScreen();
    }
  });
})();
