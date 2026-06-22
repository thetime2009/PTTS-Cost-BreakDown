// ══════════════════════════════════════════════════════════════
// hr.js v1.0  —  HR Module
// นำเข้าข้อมูลสแกนหน้า | สรุปเวลางาน | พนักงาน | ตั้งค่า | สลิปเงินเดือน
// ══════════════════════════════════════════════════════════════

/* global Swal, SCRIPT_URL */

// ── State ─────────────────────────────────────────────────────
let _hrS        = null;  // settings cache (from localStorage)
let _hrEmps     = [];    // [{empId,name,dept,position,type,salary,dailyRate,otRateWD,otRateSun}]
let _hrAtt      = [];    // attendance rows (loaded per month)
let _hrPreview  = [];    // parsed import rows before confirm
let _hrHolidays = [];    // [{date:'dd/MM/yyyy', name:'...', type:'...'}]
let _hrSubCur   = '1';  // active sub-tab
let _hrSumMon   = '';   // 'YYYY-MM' viewing in summary
let _hrSumPeriod = 'all'; // 'all' | 'p1' | 'p2'

const HR_LS  = 'ptts_hr_settings';
const HR_PAY_LS = 'ptts_hr_pay_cfg';
const HR_PAY_DEF = {
  mode: 'semi',            // 'semi' | 'monthly'
  p1: { start: 11, end: 25, payday: 1 },   // จ่ายวันที่ 1 เดือนถัดไป
  p2: { start: 26, end: 10, payday: 16 },  // จ่ายวันที่ 16 เดือนนี้
};
function _hrPayCfg() {
  try {
    var raw = JSON.parse(localStorage.getItem(HR_PAY_LS) || '{}');
    return {
      mode: raw.mode || HR_PAY_DEF.mode,
      p1: Object.assign({}, HR_PAY_DEF.p1, raw.p1 || {}),
      p2: Object.assign({}, HR_PAY_DEF.p2, raw.p2 || {}),
    };
  } catch(e) { return HR_PAY_DEF; }
}
const HR_DEF = {
  startTime: '08:00',
  endTime:   '17:00',
  lateGrace: 5,          // grace นาที (สายหลัง startTime+5)
  otMinTime: '19:00',    // ออกหลังนี้ถึงนับ OT
  otEndTime: '20:00',    // เวลา OT สิ้นสุด
  otFullMin: 10,         // ออกก่อน otEndTime กี่นาที → ให้ OT เต็ม
  otMaxH:    3,
  sunRate:   2,          // วันอาทิตย์ = 2x
  satRate:   1,
};

// ── Pure helpers ──────────────────────────────────────────────
function _hrMin(t) {
  if (!t) return 0;
  const p = String(t).split(':');
  return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0);
}
function _hrHM(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function _hrFmt(n) {
  return Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function _hrDMY(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return d + '/' + m + '/' + date.getFullYear();
}
function _hrMKey(dmy) {
  if (!dmy) return '';
  const p = String(dmy).split('/');
  return p.length < 3 ? '' : p[2] + '-' + p[1].padStart(2, '0');
}
function _hrMLab(key) {
  if (!key) return '';
  const p = key.split('-');
  const MO = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return (MO[parseInt(p[1]) - 1] || p[1]) + ' ' + (parseInt(p[0]) + 543);
}
function _hrOTRoundTime(s) { return _hrHM(_hrMin(s.otEndTime) - (parseInt(s.otFullMin) || 10)); }

// ── Settings ──────────────────────────────────────────────────
function _hrCfg() {
  if (!_hrS) {
    try { _hrS = Object.assign({}, HR_DEF, JSON.parse(localStorage.getItem(HR_LS) || '{}')); }
    catch (e) { _hrS = Object.assign({}, HR_DEF); }
  }
  return _hrS;
}
function _hrSaveS() { localStorage.setItem(HR_LS, JSON.stringify(_hrS)); }

// ── API ───────────────────────────────────────────────────────
function _hrUrl() {
  return (typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : null)
      || localStorage.getItem('ptts_script_url') || '';
}
function _hrGET(action, params) {
  const url = _hrUrl();
  if (!url) return Promise.reject('ไม่พบ Script URL — กรุณาตั้งค่าใน ⚙️ ตั้งค่า');
  const p = Object.assign({ action }, params || {});
  return fetch(url + '?' + new URLSearchParams(p)).then(function(r) { return r.json(); });
}
function _hrPOST(action, body) {
  const url = _hrUrl();
  if (!url) return Promise.reject('ไม่พบ Script URL — กรุณาตั้งค่าใน ⚙️ ตั้งค่า');
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action }, body || {}))
  }).then(function(r) { return r.json(); });
}

// ── Sub-tab navigation ────────────────────────────────────────
function hrSubSwitch(n) {
  _hrSubCur = String(n);
  ['1', '2', '3', '4', '5'].forEach(function(k) {
    const btn = document.getElementById('hrBtn' + k);
    const pan = document.getElementById('hrPanel' + k);
    if (btn) {
      btn.style.background   = k === _hrSubCur ? 'var(--c1)' : 'transparent';
      btn.style.color        = k === _hrSubCur ? '#fff' : 'var(--t3)';
      btn.style.borderColor  = k === _hrSubCur ? 'var(--c1)' : 'var(--bc-input)';
    }
    if (pan) pan.style.display = k === _hrSubCur ? '' : 'none';
  });
  if (n === '2') _hrRenderSummary();
  if (n === '3') _hrRenderEmps();
  if (n === '4') _hrRenderSettings();
  if (n === '5') _hrRenderCal();
}

function hrInitTab() {
  _hrS = null; // reset cache → reload from LS
  _hrCfg();
  hrSubSwitch(_hrSubCur || '1');
  _hrRenderImport();
}

// ══════════════════════════════════════════════════════════════
// PANEL 1 — นำเข้าข้อมูล
// ══════════════════════════════════════════════════════════════
function _hrRenderImport() {
  const p = document.getElementById('hrPanel1');
  if (!p) return;
  p.innerHTML =
    '<div style="max-width:720px">' +
    '<div style="background:var(--card);border:1px solid var(--bc-input);border-radius:14px;padding:20px 22px;margin-bottom:16px">' +
      '<div style="font-weight:700;font-size:.95rem;color:var(--c1);margin-bottom:6px">📥 นำเข้าจากเครื่องสแกนหน้า ZKTeco</div>' +
      '<div style="font-size:.82rem;color:var(--t3);margin-bottom:14px">อัปโหลดไฟล์ Excel (.xls / .xlsx) ที่ Export จากเครื่องสแกน — ระบบจะคำนวณ OT และเวลาสาย โดยอัตโนมัติ</div>' +
      '<label style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;' +
        'background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.4);' +
        'border-radius:10px;cursor:pointer;font-size:.88rem;font-weight:700">' +
        '📂 เลือกไฟล์' +
        '<input type="file" accept=".xls,.xlsx" style="display:none" onchange="hrHandleFile(this)">' +
      '</label>' +
      '<span id="hrFileName" style="margin-left:10px;font-size:.82rem;color:var(--t3)"></span>' +
    '</div>' +
    '<div id="hrImportPreview" style="margin-bottom:12px"></div>' +
    '<div id="hrImportActions"></div>' +
    '</div>';
}

function hrHandleFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  document.getElementById('hrFileName').textContent = file.name;

  if (typeof XLSX === 'undefined') {
    Swal.fire('❌ ไม่พบ SheetJS', 'กรุณาโหลดหน้าใหม่', 'error');
    return;
  }

  Swal.fire({ title: '⏳ กำลังอ่านไฟล์...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb     = XLSX.read(e.target.result, { type: 'binary', cellDates: false });
      const parsed = _hrParseZKTeco(wb);
      // กรองเฉพาะพนักงานที่อยู่ในระบบ
      _hrFilterAndPreview(parsed);
    } catch (err) {
      Swal.hideLoading(); Swal.close();
      Swal.fire('❌ อ่านไฟล์ไม่ได้', err.message, 'error');
    }
  };
  reader.readAsBinaryString(file);
}

// ── กรองเฉพาะพนักงานที่อยู่ในระบบก่อน Preview ───────────────
function _hrFilterAndPreview(parsed) {
  function _doFilter() {
    var empIds   = _hrEmps.map(function(e) { return String(e.empId  || '').trim().toLowerCase(); });
    var empNames = _hrEmps.map(function(e) { return String(e.name   || '').trim(); });

    var skipped  = {};
    var filtered = parsed.filter(function(r) {
      var idMatch   = empIds.indexOf(String(r.empId   || '').trim().toLowerCase()) >= 0;
      var nameMatch = empNames.indexOf(String(r.empName || '').trim()) >= 0;
      if (!idMatch && !nameMatch) { skipped[r.empName || r.empId] = true; return false; }
      return true;
    });

    _hrPreview = filtered;
    Swal.hideLoading(); Swal.close();

    var skippedNames = Object.keys(skipped);
    if (skippedNames.length) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้ามพนักงาน ' + skippedNames.length + ' คน',
        html: 'ไม่พบในระบบ จึงไม่นำเข้า:<br><b style="color:#f87171">' + skippedNames.join(', ') + '</b><br>' +
          '<span style="font-size:.78rem;color:#94a3b8">กรุณาเพิ่มพนักงานในแท็บ พนักงาน ก่อน</span>',
        background: '#0d1b2a', color: '#cce4ff',
        confirmButtonColor: '#4f46e5', confirmButtonText: 'รับทราบ'
      }).then(function() { _hrShowPreview(_hrPreview); });
    } else {
      _hrShowPreview(_hrPreview);
    }
  }

  if (_hrEmps.length && _hrHolidays.length) {
    _doFilter();
  } else {
    // โหลด employees + holidays พร้อมกัน
    var calls = [];
    if (!_hrEmps.length)     calls.push(_hrGET('getHREmployees'));
    if (!_hrHolidays.length) calls.push(_hrGET('getHRHolidays'));

    Promise.all(calls).then(function(results) {
      var idx = 0;
      if (!_hrEmps.length)     { _hrEmps     = (results[idx++] || {}).data || []; }
      if (!_hrHolidays.length) { _hrHolidays = (results[idx++] || {}).data || []; }
      _doFilter();
    }).catch(function() {
      _hrPreview = parsed;
      Swal.hideLoading(); Swal.close();
      _hrShowPreview(_hrPreview);
    });
  }
}

// ── ZKTeco Excel Parser ──────────────────────────────────────
function _hrParseZKTeco(wb) {
  const s = _hrCfg();
  const result = [];

  wb.SheetNames.forEach(function(sName) {
    const ws   = wb.Sheets[sName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (!rows.length) return;

    // ตรวจว่าชีตนี้คือบัตรตอก
    const a1 = String(rows[0] && rows[0][0] || '').trim();
    if (a1 !== 'รายงานบัตรตอก') return;

    const BLOCK = 15;
    let maxBlocks = 1;
    while ((rows[2] || [])[maxBlocks * BLOCK] != null) maxBlocks++;
    maxBlocks = Math.min(maxBlocks, 6);

    for (let b = 0; b < maxBlocks; b++) {
      const off = b * BLOCK;
      const r2  = rows[2] || [];
      const r3  = rows[3] || [];

      // ชื่อ empId อยู่ที่ offset+9 ใน row2 (ชื่อ) และ row3 (รหัส)
      const empName = String(r2[off + 9] || r2[off + 8] || '').trim();
      const dept    = String(r2[off + 1] || '').trim();
      const empId   = String(r3[off + 9] || r3[off + 1] || (b + 1)).trim();
      const period  = String(r3[off + 1] || (rows[1] && rows[1][1]) || '').trim();

      if (!empName) continue;

      // period: '2026-06-01 ~ 2026-06-15'
      let startYear = new Date().getFullYear();
      let startMonth = new Date().getMonth() + 1;
      const pm = period.match(/(\d{4})-(\d{2})/);
      if (pm) { startYear = parseInt(pm[1]); startMonth = parseInt(pm[2]); }

      for (let r = 10; r < rows.length; r++) {
        const row = rows[r] || [];
        const dayLabel = String(row[off] || '').trim();
        if (!dayLabel.match(/^\d{1,2}[\s ]/)) continue;

        const dayNum = parseInt(dayLabel);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

        const date = new Date(startYear, startMonth - 1, dayNum);
        if (date.getMonth() !== startMonth - 1) continue;

        const dow = date.getDay(); // 0=อาทิตย์
        const clockIn = _hrCleanTime(row[off + 1]);

        // last scan = ค่าสุดท้ายที่มีใน col 3,5,7,10,12 ของ block
        const scanCols = [off + 3, off + 5, off + 7, off + 10, off + 12];
        const scans = scanCols.map(function(i) { return _hrCleanTime(row[i]); }).filter(Boolean);
        const lastScan = scans[scans.length - 1] || '';

        const dateStr = _hrDMY(date);
        const calc = _hrCalcDay(clockIn, lastScan, dow, s, dateStr);

        result.push(Object.assign({
          empId: empId, empName: empName, dept: dept, period: period,
          date: dateStr, dow: dow,
          clockIn: clockIn, lastScan: lastScan
        }, calc));
      }
    }
  });

  return result;
}

function _hrCleanTime(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s.match(/^\d{1,2}:\d{2}/) ? s.substring(0, 5) : '';
}

function _hrCalcDay(clockIn, lastScan, dow, s, dateStr) {
  const isAbsent  = !clockIn;
  const isHoliday = dateStr ? _hrHolidays.some(function(h) { return h.date === dateStr; }) : false;

  // วันอาทิตย์ ไม่มี scan = หยุด
  if (isAbsent && dow === 0) return { status: 'off', lateMin: 0, otHours: 0, otRate: s.sunRate || 2 };
  // วันหยุดนักขัตฤกษ์ ไม่มี scan = หยุด (ไม่ใช่ขาด)
  if (isAbsent && isHoliday) return { status: 'off', lateMin: 0, otHours: 0, otRate: 1 };
  // วันทำงาน ไม่มี clock-in = ขาด
  if (isAbsent)              return { status: 'absent', lateMin: 0, otHours: 0, otRate: 1 };

  const ciMins    = _hrMin(clockIn);
  const startMins = _hrMin(s.startTime);
  const graceMins = startMins + (parseInt(s.lateGrace) || 5);
  const lateMin   = ciMins > graceMins ? ciMins - startMins : 0;

  let otHours = 0;
  let otRate  = 1;

  if (dow === 0) {
    // วันอาทิตย์: ทุกชม. = OT 2x
    if (lastScan) {
      const mins = _hrMin(lastScan) - ciMins;
      otHours = Math.round(Math.max(0, mins) / 60 * 10) / 10;
    }
    otRate = parseFloat(s.sunRate) || 2;
  } else {
    otRate = dow === 6 ? (parseFloat(s.satRate) || 1) : 1;
    if (lastScan) {
      const lastMins  = _hrMin(lastScan);
      const otMinMins = _hrMin(s.otMinTime); // 19:00
      const otEndMins = _hrMin(s.otEndTime); // 20:00
      const endMins   = _hrMin(s.endTime);   // 17:00
      const roundBuf  = parseInt(s.otFullMin) || 10;

      if (lastMins >= otMinMins) {
        if (lastMins >= otEndMins - roundBuf) {
          otHours = parseFloat(s.otMaxH) || 3; // round-up เต็ม
        } else {
          otHours = Math.min(
            Math.round((lastMins - endMins) / 60 * 10) / 10,
            parseFloat(s.otMaxH) || 3
          );
        }
      }
    }
  }

  return { status: 'present', lateMin: lateMin, otHours: otHours, otRate: otRate };
}

function _hrShowPreview(rows) {
  const p   = document.getElementById('hrImportPreview');
  const act = document.getElementById('hrImportActions');
  if (!p) return;

  if (!rows.length) {
    p.innerHTML = '<div style="color:var(--t3);font-size:.85rem;padding:12px">❌ ไม่พบข้อมูลบัตรตอก (หน้าแรกต้องชื่อ "รายงานบัตรตอก")</div>';
    if (act) act.innerHTML = '';
    return;
  }

  // group by emp
  const stats = {};
  rows.forEach(function(r) {
    if (!stats[r.empId]) stats[r.empId] = { name: r.empName, dept: r.dept, present: 0, absent: 0, off: 0, lateMin: 0, otH: 0, rows: [] };
    const st = stats[r.empId];
    if (r.status === 'present') st.present++;
    else if (r.status === 'absent') st.absent++;
    else st.off++;
    st.lateMin += parseInt(r.lateMin) || 0;
    st.otH += parseFloat(r.otHours) || 0;
    st.rows.push(r);
  });

  const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  let html = '<div style="font-size:.8rem;color:var(--t3);margin-bottom:10px">พบข้อมูล ' + rows.length + ' วัน (' + Object.keys(stats).length + ' คน) — ตรวจสอบและเช็ค ✅ อนุมัติ OT ก่อนบันทึก</div>';

  Object.keys(stats).forEach(function(empId) {
    const st     = stats[empId];
    const hasOT  = st.otH > 0;
    const safeId = empId.replace(/[^a-zA-Z0-9]/g, '_');

    html += '<div style="background:var(--card);border:1px solid var(--bc-input);border-radius:12px;padding:14px 16px;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
        '<div style="font-weight:700;color:var(--c1)">' + st.name + ' <span style="font-size:.78rem;color:var(--t3)">' + st.dept + '</span></div>' +
        '<div style="font-size:.78rem;color:var(--t3)">มา <b style="color:#34d399">' + st.present + '</b> | ขาด <b style="color:#f87171">' + st.absent + '</b> | หยุด ' + st.off + ' | สาย ' + st.lateMin + ' น. | OT <span id="otSumChip_' + safeId + '">0.0</span> ชม.</div>' +
      '</div>' +
      '<div style="overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:.76rem">' +
        '<tr style="background:rgba(99,102,241,.1)">' +
          '<th style="padding:4px 8px;text-align:left">วันที่</th>' +
          '<th style="text-align:center">วัน</th>' +
          '<th style="text-align:center">เข้างาน</th>' +
          '<th style="text-align:center">ออก/OT</th>' +
          '<th style="text-align:center">สาย(น.)</th>' +
          '<th style="text-align:center">OT(ชม.)</th>' +
          '<th style="text-align:center">สถานะ</th>' +
          (hasOT ? '<th style="text-align:center;color:#818cf8;white-space:nowrap">✅ อนุมัติ OT</th><th style="text-align:left;color:var(--t3);white-space:nowrap;min-width:160px">หมายเหตุ OT</th>' : '') +
        '</tr>' +
        st.rows.map(function(r) {
          const dParts     = String(r.date || '').split('/');
          const dLabel     = dParts[0] + '/' + (dParts[1] || '');
          const sDow       = DAYS_TH[r.dow] || '';
          const isSun      = r.dow === 0;
          const isSat      = r.dow === 6;
          const holidayObj = _hrHolidays.find(function(h) { return h.date === r.date; });
          const isHoliday  = !!holidayObj;
          const dowColor   = isSun ? 'color:#f87171' : isSat ? 'color:#fbbf24' : '';
          const sColor     = r.status === 'absent' ? '#f87171' : r.status === 'off' ? 'var(--t3)' : '#34d399';
          const sTx        = r.status === 'absent' ? 'ขาด' : r.status === 'off' ? 'หยุด' : 'มา';
          const hasRowOT   = (parseFloat(r.otHours) || 0) > 0;
          const dateKey    = String(r.date).replace(/\//g, '-');
          const ckId       = 'otck_' + safeId + '_' + dateKey;
          const noteId     = 'otnote_' + safeId + '_' + dateKey;
          const ciId       = 'ci_' + safeId + '_' + dateKey;
          const lsId       = 'ls_' + safeId + '_' + dateKey;
          const otDispId   = 'otdisp_' + safeId + '_' + dateKey;
          const ckWrapId   = 'otckwrap_' + safeId + '_' + dateKey;
          const noteWrapId = 'notewrap_' + safeId + '_' + dateKey;
          const recalc     = '_hrRecalcRow(\'' + safeId + '\',\'' + dateKey + '\',' + r.dow + ')';
          const tStyle     = 'padding:3px 6px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-family:Sarabun,sans-serif;font-size:.8rem;width:88px';

          // ไฮไลต์: วันหยุดราชการ (เหลือง) > วันอาทิตย์ (แดง) > มี OT (ม่วงจาง)
          var rowBg = isHoliday
            ? 'background:rgba(251,191,36,.13);border-left:3px solid #f59e0b;'
            : isSun
              ? 'background:rgba(248,113,113,.13);border-left:3px solid #f87171;'
              : (hasRowOT ? 'background:rgba(129,140,248,.06);' : '');
          var dateColor = isHoliday ? ';color:#92400e;font-weight:700' : isSun ? ';font-weight:700;color:#f87171' : '';
          var dateTxt   = dLabel + (isHoliday ? ' 🎉' : '');

          return '<tr style="border-top:1px solid var(--bc-input);' + rowBg + '">' +
            '<td style="padding:3px 8px' + dateColor + '">' + dateTxt + '</td>' +
            '<td style="text-align:center;' + dowColor + (isSun ? ';font-weight:700' : '') + '">' + sDow + '</td>' +
            '<td style="text-align:center;padding:2px 4px">' +
              '<input type="time" id="' + ciId + '" value="' + (r.clockIn || '') + '" oninput="' + recalc + '" style="' + tStyle + '">' +
            '</td>' +
            '<td style="text-align:center;padding:2px 4px">' +
              '<input type="time" id="' + lsId + '" value="' + (r.lastScan || '') + '" oninput="' + recalc + '" style="' + tStyle + '">' +
            '</td>' +
            '<td style="text-align:center' + (r.lateMin > 0 ? ';color:#f87171' : '') + '">' + (r.lateMin || 0) + '</td>' +
            '<td style="text-align:center" id="' + otDispId + '"><span style="' + (hasRowOT ? 'color:#818cf8;font-weight:700' : '') + '">' + (hasRowOT ? Number(r.otHours).toFixed(1) : '—') + '</span></td>' +
            '<td style="text-align:center;color:' + sColor + '">' + sTx + '</td>' +
            (hasOT
              ? '<td style="text-align:center;padding:2px 6px" id="' + ckWrapId + '">' + (hasRowOT
                  ? '<input type="checkbox" id="' + ckId + '" onchange="_hrUpdateOTSum(\'' + safeId + '\')" style="width:16px;height:16px;accent-color:#818cf8;cursor:pointer" title="เช็ค = อนุมัติ OT วันนี้">'
                  : '') + '</td>' +
                '<td style="padding:2px 6px" id="' + noteWrapId + '">' + (hasRowOT
                  ? '<input type="text" id="' + noteId + '" value="' + (isHoliday ? (holidayObj.name || '') : '') + '" placeholder="เช่น ซ่อมเครื่อง, ปิดงานด่วน..." style="width:100%;min-width:150px;padding:3px 7px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-family:Sarabun,sans-serif;font-size:.74rem">'
                  : (isHoliday ? '<span style="font-size:.72rem;color:#92400e">' + (holidayObj.name || '') + '</span>' : '')) + '</td>'
              : '') +
            '</tr>';
        }).join('') +
      '</table></div>';

    if (hasOT) {
      html += '<div style="margin-top:6px;font-size:.72rem;color:var(--t3)">⚠️ วันที่ไม่ได้เช็ค ✅ จะถูกตัด OT ออกอัตโนมัติ</div>';
    }

    html += '</div>';
  });

  p.innerHTML = html;

  if (act) act.innerHTML =
    '<button onclick="hrConfirmImport()" style="padding:10px 24px;background:var(--c1);color:#fff;border:none;border-radius:10px;font-family:\'Sarabun\',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer">✅ บันทึก ' + rows.length + ' รายการ</button>' +
    '<button onclick="_hrPreview=[];document.getElementById(\'hrImportPreview\').innerHTML=\'\';document.getElementById(\'hrImportActions\').innerHTML=\'\';" style="margin-left:10px;padding:10px 18px;background:transparent;color:var(--t3);border:1px solid var(--bc-input);border-radius:10px;font-family:\'Sarabun\',sans-serif;font-size:.85rem;cursor:pointer">❌ ล้าง</button>';
}

function hrConfirmImport() {
  if (!_hrPreview.length) return;

  // อ่าน checkbox + เลขใบจาก DOM แล้วสร้าง rows สำหรับบันทึก
  var cutCount = 0;
  var rows = _hrPreview.map(function(r) {
    var copy    = Object.assign({}, r);
    var safeId  = String(r.empId).replace(/[^a-zA-Z0-9]/g, '_');
    var hasRowOT = (parseFloat(r.otHours) || 0) > 0;

    if (hasRowOT) {
      var ckId     = 'otck_' + safeId + '_' + String(r.date).replace(/\//g, '-');
      var noteId   = 'otnote_' + safeId + '_' + String(r.date).replace(/\//g, '-');
      var ck       = document.getElementById(ckId);
      var approved = ck ? ck.checked : false;
      var noteEl   = document.getElementById(noteId);
      copy.otNote  = (approved && noteEl) ? noteEl.value.trim() : '';
      if (!approved) { copy.otHours = 0; cutCount++; }
    } else {
      copy.otNote = '';
    }
    return copy;
  });

  var msg = 'จะบันทึก ' + rows.length + ' รายการ';
  if (cutCount > 0) msg += '\n(ตัด OT ออก ' + cutCount + ' วัน — ไม่ได้เช็คอนุมัติ)';

  Swal.fire({
    title: 'บันทึกข้อมูล?',
    text: msg,
    icon: 'question', showCancelButton: true,
    confirmButtonText: '✅ บันทึก', cancelButtonText: 'ยกเลิก'
  }).then(function(res) {
    if (!res.isConfirmed) return;
    _hrDoSave(rows);
  });
}

// ── บันทึกจริง ────────────────────────────────────────────────
function _hrDoSave(rows) {
  Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
  _hrPOST('saveHRAttendance', { rows: rows }).then(function(r) {
    Swal.hideLoading(); Swal.close();
    if (r.status === 'ok') {
      Swal.fire({ icon: 'success', title: '✅ บันทึกสำเร็จ', text: 'บันทึก ' + (r.saved || rows.length) + ' รายการ', timer: 1800, showConfirmButton: false });
      _hrPreview = [];
      _hrAtt = [];
      document.getElementById('hrImportPreview').innerHTML = '';
      document.getElementById('hrImportActions').innerHTML = '';
      setTimeout(function() { hrSubSwitch('2'); }, 1900);
    } else {
      Swal.fire('❌ ผิดพลาด', r.message || 'ไม่ทราบสาเหตุ', 'error');
    }
  }).catch(function(e) { Swal.hideLoading(); Swal.close(); Swal.fire('❌ Error', String(e), 'error'); });
}

// ── คำนวณ OT ใหม่เมื่อแก้เวลาใน Preview ────────────────────────
function _hrRecalcRow(safeId, dateKey, dow) {
  var s        = _hrCfg();
  var ciEl     = document.getElementById('ci_' + safeId + '_' + dateKey);
  var lsEl     = document.getElementById('ls_' + safeId + '_' + dateKey);
  var clockIn  = ciEl  ? ciEl.value  : '';
  var lastScan = lsEl  ? lsEl.value  : '';

  var originalDate = dateKey.replace(/-/g, '/');
  var calc     = _hrCalcDay(clockIn, lastScan, dow, s, originalDate);
  var hasRowOT = calc.otHours > 0;

  // อัปเดต OT display
  var otDisp = document.getElementById('otdisp_' + safeId + '_' + dateKey);
  if (otDisp) {
    otDisp.innerHTML = '<span style="' + (hasRowOT ? 'color:#818cf8;font-weight:700' : '') + '">' +
      (hasRowOT ? Number(calc.otHours).toFixed(1) : '—') + '</span>';
  }

  // อัปเดต checkbox
  var ckWrap = document.getElementById('otckwrap_' + safeId + '_' + dateKey);
  if (ckWrap) {
    ckWrap.innerHTML = hasRowOT
      ? '<input type="checkbox" id="otck_' + safeId + '_' + dateKey + '" onchange="_hrUpdateOTSum(\'' + safeId + '\')" style="width:16px;height:16px;accent-color:#818cf8;cursor:pointer" title="เช็ค = อนุมัติ OT วันนี้">'
      : '';
  }

  // อัปเดต note
  var noteWrap = document.getElementById('notewrap_' + safeId + '_' + dateKey);
  if (noteWrap) {
    var hObj = _hrHolidays.find(function(h) { return h.date === originalDate; });
    noteWrap.innerHTML = hasRowOT
      ? '<input type="text" id="otnote_' + safeId + '_' + dateKey + '" value="' + (hObj ? hObj.name : '') + '" placeholder="เช่น ซ่อมเครื่อง, ปิดงานด่วน..." style="width:100%;min-width:150px;padding:3px 7px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-family:Sarabun,sans-serif;font-size:.74rem">'
      : (hObj ? '<span style="font-size:.72rem;color:#92400e">' + hObj.name + '</span>' : '');
  }

  // อัปเดต _hrPreview
  var originalDate = dateKey.replace(/-/g, '/');
  _hrPreview.forEach(function(r) {
    if (String(r.empId).replace(/[^a-zA-Z0-9]/g, '_') === safeId && r.date === originalDate) {
      r.clockIn  = clockIn;
      r.lastScan = lastScan;
      r.otHours  = calc.otHours;
      r.otRate   = calc.otRate;
      r.lateMin  = calc.lateMin;
      r.status   = calc.status;
    }
  });

  // อัปเดต OT chip บนหัวพนักงาน
  _hrUpdateOTSum(safeId);
}

// ── รวม OT เฉพาะวันที่เช็ค ✅ แล้วอัปเดต chip หัวพนักงาน ──────
function _hrUpdateOTSum(safeId) {
  var total = 0;
  _hrPreview.forEach(function(r) {
    if (String(r.empId).replace(/[^a-zA-Z0-9]/g, '_') !== safeId) return;
    var ot = parseFloat(r.otHours) || 0;
    if (ot <= 0) return;
    var dk = String(r.date).replace(/\//g, '-');
    var ck = document.getElementById('otck_' + safeId + '_' + dk);
    if (ck && ck.checked) total += ot;
  });
  var chip = document.getElementById('otSumChip_' + safeId);
  if (chip) chip.textContent = total.toFixed(1);
}

// ══════════════════════════════════════════════════════════════
// PANEL 2 — สรุปเวลางาน
// ══════════════════════════════════════════════════════════════
function _hrRenderSummary() {
  const p = document.getElementById('hrPanel2');
  if (!p) return;

  const now = new Date();
  if (!_hrSumMon) _hrSumMon = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  p.innerHTML =
    '<div style="max-width:900px">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
      '<button onclick="_hrSumPrev()" style="padding:6px 14px;border-radius:8px;border:1px solid var(--bc-input);background:transparent;color:var(--t2);cursor:pointer;font-size:1rem">◀</button>' +
      '<div style="font-weight:700;font-size:.95rem;color:var(--c1);min-width:110px;text-align:center" id="hrSumMonLabel">' + _hrMLab(_hrSumMon) + '</div>' +
      '<button onclick="_hrSumNext()" style="padding:6px 14px;border-radius:8px;border:1px solid var(--bc-input);background:transparent;color:var(--t2);cursor:pointer;font-size:1rem">▶</button>' +
      _hrPeriodSelect() +
      '<button onclick="_hrLoadAndRender()" style="padding:6px 16px;border-radius:8px;background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.4);cursor:pointer;font-size:.82rem;font-family:\'Sarabun\',sans-serif">🔄 โหลดข้อมูล</button>' +
    '</div>' +
    '<div id="hrSumTable"><div style="color:var(--t3);font-size:.85rem">⏳ กำลังโหลด...</div></div>' +
    '</div>';
  _hrLoadAndRender();
}

function _hrPeriodSelect() {
  var pc = _hrPayCfg();
  if (pc.mode !== 'semi') return '';
  var opts = [
    ['all',  'ทั้งเดือน'],
    ['p1',   'งวด 1 ('+pc.p1.start+'-'+pc.p1.end+')'],
    ['p2',   'งวด 2 ('+pc.p2.start+' เดือนก่อน – '+pc.p2.end+' เดือนนี้)'],
  ];
  return '<select id="hrSumPeriodSel" onchange="_hrSumPeriod=this.value;_hrApplyFilter()" ' +
    'style="padding:6px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--bg);color:var(--t1);font-family:\'Sarabun\',sans-serif;font-size:.82rem">' +
    opts.map(function(o){ return '<option value="'+o[0]+'"'+(_hrSumPeriod===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('') +
  '</select>';
}

function _hrFilterByPeriod(rows, period, mon) {
  var pc = _hrPayCfg();
  if (period === 'all' || pc.mode !== 'semi') return rows;
  var mp = mon.split('-').map(Number); // [ceYear, ceMonth]
  var ceY = mp[0], ceM = mp[1];
  return rows.filter(function(r) {
    var dp = String(r.date||'').split('/');
    if (dp.length < 3) return false;
    var d = parseInt(dp[0]), m = parseInt(dp[1]), yr = parseInt(dp[2]);
    // normalize: yr >= 2500 = BE → ลบ 543, น้อยกว่า = CE อยู่แล้ว
    var rY = yr >= 2500 ? yr - 543 : yr;
    var rM = m;
    if (period === 'p1') {
      return rY === ceY && rM === ceM && d >= pc.p1.start && d <= pc.p1.end;
    }
    if (period === 'p2') {
      // prev month part: day >= p2.start
      var pM = ceM === 1 ? 12 : ceM - 1;
      var pY = ceM === 1 ? ceY - 1 : ceY;
      if (rY === pY && rM === pM && d >= pc.p2.start) return true;
      // current month part: day <= p2.end
      if (rY === ceY && rM === ceM && d <= pc.p2.end) return true;
    }
    return false;
  });
}

function _hrApplyFilter() {
  var tbl = document.getElementById('hrSumTable');
  if (!tbl || !_hrAtt.length) return;
  var base = _hrAtt.filter(function(r) { return _hrMKey(r.date) === _hrSumMon; });
  // for p2, also include prev month records
  if (_hrSumPeriod === 'p2') {
    var mp = _hrSumMon.split('-').map(Number);
    var pM = mp[1] === 1 ? 12 : mp[1] - 1;
    var pY = mp[1] === 1 ? mp[0]-1 : mp[0];
    var prevMon = pY + '-' + String(pM).padStart(2,'0');
    var prevRecs = _hrAtt.filter(function(r) { return _hrMKey(r.date) === prevMon; });
    base = base.concat(prevRecs);
  }
  tbl.innerHTML = _hrSumTableHtml(_hrFilterByPeriod(base, _hrSumPeriod, _hrSumMon));
}

function _hrSumPrev() {
  const p = _hrSumMon.split('-').map(Number);
  const d = new Date(p[0], p[1] - 2, 1);
  _hrSumMon = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const lbl = document.getElementById('hrSumMonLabel');
  if (lbl) lbl.textContent = _hrMLab(_hrSumMon);
}
function _hrSumNext() {
  const p = _hrSumMon.split('-').map(Number);
  const d = new Date(p[0], p[1], 1);
  _hrSumMon = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const lbl = document.getElementById('hrSumMonLabel');
  if (lbl) lbl.textContent = _hrMLab(_hrSumMon);
}

function _hrLoadAndRender() {
  const tbl = document.getElementById('hrSumTable');
  if (!tbl) return;
  tbl.innerHTML = '<div style="color:var(--t3);font-size:.85rem">⏳ กำลังโหลด...</div>';

  // ถ้า p2 ต้องโหลดเดือนก่อนด้วย
  var months = [_hrSumMon];
  if (_hrSumPeriod === 'p2') {
    var mp2 = _hrSumMon.split('-').map(Number);
    var pM2 = mp2[1] === 1 ? 12 : mp2[1]-1;
    var pY2 = mp2[1] === 1 ? mp2[0]-1 : mp2[0];
    months.push(pY2+'-'+String(pM2).padStart(2,'0'));
  }
  Promise.all([
    Promise.all(months.map(function(m){ return _hrGET('getHRAttendance', { month: m }); })),
    _hrGET('getHREmployees')
  ]).then(function(results) {
    _hrAtt  = results[0].reduce(function(a,r){ return a.concat(r.data||[]); }, []);
    _hrEmps = results[1].data || [];
    var base = _hrAtt.filter(function(r) { return _hrMKey(r.date) === _hrSumMon; });
    if (_hrSumPeriod === 'p2') {
      var mp = _hrSumMon.split('-').map(Number);
      var pM = mp[1]===1?12:mp[1]-1, pY = mp[1]===1?mp[0]-1:mp[0];
      var prev = pY+'-'+String(pM).padStart(2,'0');
      base = base.concat(_hrAtt.filter(function(r){ return _hrMKey(r.date)===prev; }));
    }
    tbl.innerHTML = _hrSumTableHtml(_hrFilterByPeriod(base, _hrSumPeriod, _hrSumMon));
  }).catch(function(e) {
    tbl.innerHTML = '<div style="color:#f87171;font-size:.85rem">❌ ' + e + '</div>';
  });
}

function _hrSumTableHtml(rows) {
  if (!rows.length) {
    return '<div style="color:var(--t3);font-size:.85rem">ไม่พบข้อมูลเดือน ' + _hrMLab(_hrSumMon) + ' — กรุณานำเข้าข้อมูลก่อน</div>';
  }

  // สร้าง map empId → type จาก _hrEmps
  const empTypeMap = {};
  _hrEmps.forEach(function(e) { empTypeMap[String(e.empId)] = e.type || 'monthly'; });

  const emp = {};
  rows.forEach(function(r) {
    const id = String(r.empId);
    if (!emp[id]) emp[id] = {
      name: r.empName || r.name, dept: r.dept,
      type: empTypeMap[id] || 'monthly',
      present: 0, absent: 0, off: 0, lateTimes: 0, lateMin: 0, otWD: 0, otSun: 0,
    };
    const e  = emp[id];
    const st = r.status;
    if (st === 'present') e.present++;
    else if (st === 'absent') e.absent++;
    else e.off++;
    if ((parseInt(r.lateMin) || 0) > 0) { e.lateTimes++; e.lateMin += parseInt(r.lateMin) || 0; }
    const ot   = parseFloat(r.otHours) || 0;
    const rate = parseFloat(r.otRate) || 1;
    if (rate >= 2) e.otSun += ot; else e.otWD += ot;
  });

  // แยกกลุ่ม: รายเดือน ก่อน, รายวัน หลัง
  const monthly = Object.keys(emp).filter(function(id) { return emp[id].type !== 'daily'; });
  const daily   = Object.keys(emp).filter(function(id) { return emp[id].type === 'daily'; });

  const THEAD =
    '<thead><tr style="background:rgba(99,102,241,.12);font-weight:700">' +
      '<th style="padding:8px 10px;text-align:left">พนักงาน</th>' +
      '<th style="text-align:center">แผนก</th>' +
      '<th style="text-align:center">มา</th>' +
      '<th style="text-align:center">ขาด</th>' +
      '<th style="text-align:center">สาย</th>' +
      '<th style="text-align:center">OT ปกติ</th>' +
      '<th style="text-align:center">OT อาทิตย์</th>' +
      '<th style="text-align:center">สลิป</th>' +
    '</tr></thead>';

  function sectionHeader(label, count, color) {
    return '<tr><td colspan="8" style="padding:6px 10px;background:'+color+';font-size:.74rem;font-weight:700;color:#fff;letter-spacing:.5px">' +
      label + ' &nbsp;<span style="font-weight:400;opacity:.85">('+count+' คน)</span></td></tr>';
  }

  function empRow(id) {
    const e = emp[id];
    return '<tr style="border-top:1px solid var(--bc-input)">' +
      '<td style="padding:7px 10px;font-weight:600">' + e.name + '</td>' +
      '<td style="text-align:center;font-size:.76rem;color:var(--t3)">' + (e.dept || '') + '</td>' +
      '<td style="text-align:center;color:#059669;font-weight:700">' + e.present + '</td>' +
      '<td style="text-align:center;color:' + (e.absent > 0 ? '#dc2626' : '#9ca3af') + ';font-weight:' + (e.absent > 0 ? '700' : '400') + '">' + e.absent + '</td>' +
      '<td style="text-align:center;color:' + (e.lateMin > 0 ? '#b45309' : '#9ca3af') + ';font-size:.78rem;font-weight:' + (e.lateMin > 0 ? '700' : '400') + '">' + e.lateTimes + 'ครั้ง<br>' + e.lateMin + 'น.</td>' +
      '<td style="text-align:center;color:#4338ca;font-weight:700">' + e.otWD.toFixed(1) + '</td>' +
      '<td style="text-align:center;color:#b45309;font-weight:700">' + e.otSun.toFixed(1) + '</td>' +
      '<td style="text-align:center">' +
        '<div style="display:flex;gap:5px;justify-content:center;flex-wrap:wrap">' +
          '<button onclick="hrOpenPayslip(\'' + id + '\',\'' + _hrSumMon + '\',\''+_hrSumPeriod+'\')" ' +
            'style="padding:4px 10px;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;border-radius:7px;cursor:pointer;font-family:\'Sarabun\',sans-serif;font-size:.78rem;font-weight:600">' +
            '🧾 สลิป' +
          '</button>' +
          '<button onclick="hrPrintAttReport(\'' + id + '\',\'' + _hrSumMon + '\',\''+_hrSumPeriod+'\')" ' +
            'style="padding:4px 10px;background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc;border-radius:7px;cursor:pointer;font-family:\'Sarabun\',sans-serif;font-size:.78rem;font-weight:600">' +
            '🖨️ รายงาน' +
          '</button>' +
          '<button onclick="hrEditAtt(\'' + id + '\',\'' + _hrSumMon + '\',\''+_hrSumPeriod+'\')" ' +
            'style="padding:4px 10px;background:#ffedd5;color:#9a3412;border:1px solid #fdba74;border-radius:7px;cursor:pointer;font-family:\'Sarabun\',sans-serif;font-size:.78rem;font-weight:600">' +
            '✏️ แก้ไข' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">' + THEAD + '<tbody>';

  if (monthly.length) {
    html += sectionHeader('💼 รายเดือน', monthly.length, '#4f46e5');
    monthly.forEach(function(id) { html += empRow(id); });
  }
  if (daily.length) {
    html += sectionHeader('🔧 รายวัน', daily.length, '#0891b2');
    daily.forEach(function(id) { html += empRow(id); });
  }

  html += '</tbody></table></div>';
  return html;
}

// ══════════════════════════════════════════════════════════════
// PANEL 3 — พนักงาน
// ══════════════════════════════════════════════════════════════
function _hrRenderEmps() {
  const p = document.getElementById('hrPanel3');
  if (!p) return;
  p.innerHTML = '<div style="color:var(--t3);font-size:.85rem">⏳ กำลังโหลด...</div>';

  _hrGET('getHREmployees').then(function(res) {
    _hrEmps = res.data || [];
    p.innerHTML = _hrEmpsHtml();
  }).catch(function(e) {
    p.innerHTML = '<div style="color:#f87171">❌ ' + e + '</div>';
  });
}

function _hrEmpsHtml() {
  const addBtn = '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
    '<button onclick="hrAddEmp()" style="padding:8px 20px;background:var(--c1);color:#fff;border:none;border-radius:10px;font-family:\'Sarabun\',sans-serif;font-size:.86rem;font-weight:700;cursor:pointer">➕ เพิ่มพนักงาน</button>' +
    '</div>';

  if (!_hrEmps.length) return '<div style="max-width:700px">' + addBtn + '<div style="color:var(--t3);font-size:.85rem;text-align:center;padding:24px">ยังไม่มีข้อมูลพนักงาน — กด ➕ เพิ่มพนักงาน</div></div>';

  let rows = _hrEmps.map(function(e, i) {
    return '<tr style="border-top:1px solid var(--bc-input)">' +
      '<td style="padding:7px 10px;color:var(--t3);font-size:.78rem">' + e.empId + '</td>' +
      '<td style="font-weight:600">' + e.name + '</td>' +
      '<td style="text-align:center;font-size:.78rem">' + (e.dept || '') + '</td>' +
      '<td style="text-align:center;font-size:.78rem">' + (e.type === 'daily' ? 'รายวัน' : 'รายเดือน') + '</td>' +
      '<td style="text-align:right">' + _hrFmt(e.type === 'daily' ? e.dailyRate : e.salary) + '</td>' +
      '<td style="text-align:center;font-size:.76rem">' + (e.otRateWD || 100) + '/' + (e.otRateSun || 200) + '</td>' +
      '<td style="text-align:center;white-space:nowrap">' +
        '<button onclick="hrEditEmp(' + i + ')" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(99,102,241,.4);background:rgba(99,102,241,.1);color:#818cf8;cursor:pointer;font-size:.75rem">✏️</button> ' +
        '<button onclick="hrDelEmp(' + i + ')" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(248,113,113,.3);background:rgba(248,113,113,.08);color:#f87171;cursor:pointer;font-size:.75rem">🗑</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  return '<div style="max-width:820px">' + addBtn +
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
      '<thead><tr style="background:rgba(99,102,241,.1);font-weight:700">' +
        '<th style="padding:8px 10px;text-align:left">รหัส</th>' +
        '<th style="text-align:left">ชื่อ</th>' +
        '<th style="text-align:center">แผนก</th>' +
        '<th style="text-align:center">ประเภท</th>' +
        '<th style="text-align:right">เงินเดือน/วัน</th>' +
        '<th style="text-align:center">OT ปกติ/อาทิตย์</th>' +
        '<th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
    '</table></div></div>';
}

function hrAddEmp()   { _hrEmpModal(null, -1); }
function hrEditEmp(i) { _hrEmpModal(_hrEmps[i], i); }

function _hrEmpModal(emp, idx) {
  const isNew = idx < 0;
  const v = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };

  Swal.fire({
    title: isNew ? '➕ เพิ่มพนักงาน' : '✏️ แก้ไขพนักงาน',
    width: '520px',
    html:
      '<div style="text-align:left;font-size:.86rem">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
        _hrField('empFId',   'รหัสพนักงาน',  emp && emp.empId    || '', 'text', '001') +
        _hrField('empFName', 'ชื่อ-สกุล',    emp && emp.name     || '', 'text', 'ชื่อ') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
        _hrField('empFDept', 'แผนก',         emp && emp.dept     || '', 'text', 'ฝ่ายผลิต') +
        _hrField('empFPos',  'ตำแหน่ง',      emp && emp.position || '', 'text', 'พนักงาน') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
        '<div><label style="font-size:.76rem;color:var(--t3);display:block;margin-bottom:3px">ประเภทค่าจ้าง</label>' +
          '<select id="empFType" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--card);color:var(--t1);font-family:\'Sarabun\',sans-serif;box-sizing:border-box">' +
            '<option value="monthly"' + (emp && emp.type !== 'daily' ? ' selected' : '') + '>รายเดือน</option>' +
            '<option value="daily"' + (emp && emp.type === 'daily' ? ' selected' : '') + '>รายวัน</option>' +
          '</select></div>' +
        '<div><label style="font-size:.76rem;color:var(--t3);display:block;margin-bottom:3px">รอบการจ่าย</label>' +
          '<select id="empFPayCycle" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--card);color:var(--t1);font-family:\'Sarabun\',sans-serif;box-sizing:border-box">' +
            '<option value="default"' + (!emp || emp.payCycle === 'default' || !emp.payCycle ? ' selected' : '') + '>ตามค่าตั้งระบบ</option>' +
            '<option value="semi"' + (emp && emp.payCycle === 'semi' ? ' selected' : '') + '>ครึ่งเดือน (2 งวด)</option>' +
            '<option value="monthly"' + (emp && emp.payCycle === 'monthly' ? ' selected' : '') + '>รายเดือน (1 งวด)</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
        _hrField('empFSal',  'เงินเดือน (บาท/เดือน)', emp && emp.salary    || 0, 'number') +
        _hrField('empFDay',  'ค่าแรง (บาท/วัน)',       emp && emp.dailyRate || 0, 'number') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        _hrField('empFOTWD',  'OT ปกติ (฿/ชม.)',      emp && emp.otRateWD  || 100, 'number') +
        _hrField('empFOTSun', 'OT อาทิตย์ (฿/ชม.)',   emp && emp.otRateSun || 200, 'number') +
      '</div></div>',
    showCancelButton: true,
    confirmButtonText: isNew ? '➕ เพิ่ม' : '💾 บันทึก',
    cancelButtonText: 'ยกเลิก',
    preConfirm: function() {
      const data = {
        empId:     v('empFId').trim(), name: v('empFName').trim(),
        dept:      v('empFDept').trim(), position: v('empFPos').trim(),
        type:      v('empFType'),
        payCycle:  v('empFPayCycle') || 'default',
        salary:    parseFloat(v('empFSal')) || 0, dailyRate: parseFloat(v('empFDay')) || 0,
        otRateWD:  parseFloat(v('empFOTWD')) || 100, otRateSun: parseFloat(v('empFOTSun')) || 200,
        active: true, _idx: idx,
      };
      if (!data.empId || !data.name) { Swal.showValidationMessage('กรุณาใส่รหัสและชื่อ'); return false; }
      return data;
    }
  }).then(function(res) {
    if (!res.isConfirmed) return;
    Swal.fire({ title: '⏳', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
    _hrPOST('saveHREmployee', res.value).then(function(r) {
      Swal.hideLoading(); Swal.close();
      if (r.status === 'ok') _hrRenderEmps();
      else Swal.fire('❌', r.message || 'ผิดพลาด', 'error');
    }).catch(function(e) { Swal.hideLoading(); Swal.close(); Swal.fire('❌', String(e), 'error'); });
  });
}

function _hrField(id, label, value, type, placeholder) {
  return '<div><label style="font-size:.76rem;color:var(--t3);display:block;margin-bottom:3px">' + label + '</label>' +
    '<input id="' + id + '" type="' + (type || 'text') + '" value="' + value + '"' +
    (placeholder ? ' placeholder="' + placeholder + '"' : '') +
    ' style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--card);color:var(--t1);font-family:\'Sarabun\',sans-serif;box-sizing:border-box"></div>';
}

function hrDelEmp(i) {
  const emp = _hrEmps[i];
  if (!emp) return;
  Swal.fire({
    title: 'ลบ ' + emp.name + '?', text: 'ข้อมูลเวลางานยังคงอยู่',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: '🗑 ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#f87171'
  }).then(function(res) {
    if (!res.isConfirmed) return;
    Swal.fire({ title: '⏳', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
    _hrPOST('deleteHREmployee', { empId: emp.empId }).then(function(r) {
      Swal.hideLoading(); Swal.close();
      if (r.status === 'ok') _hrRenderEmps();
      else Swal.fire('❌', r.message || 'ผิดพลาด', 'error');
    }).catch(function(e) { Swal.hideLoading(); Swal.close(); Swal.fire('❌', String(e), 'error'); });
  });
}

// ══════════════════════════════════════════════════════════════
// PANEL 5 — ปฏิทินวันหยุด (Interactive + Print)
// ══════════════════════════════════════════════════════════════

const _CAL_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const _CAL_DAYS   = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function _hrRenderCal() {
  const p = document.getElementById('hrPanel5');
  if (!p) return;
  const now = new Date();
  const curBE = now.getFullYear() + 543;
  const years = [2569,2570,2571,2572,2573,2574,2575];
  const defY  = years.indexOf(curBE) >= 0 ? curBE : 2569;

  p.innerHTML =
    '<div style="max-width:980px">' +
    // ── controls ──
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
      '<select id="hrCalYear" onchange="_hrCalDraw()" style="padding:8px 14px;border-radius:9px;border:1px solid var(--bc-input);background:var(--bg);color:var(--t1);font-family:\'Sarabun\',sans-serif;font-size:.9rem;font-weight:700">' +
        years.map(function(y){ return '<option value="'+y+'"'+(y===defY?' selected':'')+'>'+y+' ('+(y-543)+')</option>'; }).join('') +
      '</select>' +
      '<button onclick="_hrCalLoad()" style="padding:8px 16px;border-radius:9px;background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.3);font-family:\'Sarabun\',sans-serif;font-size:.84rem;cursor:pointer">🔄 โหลดวันหยุด</button>' +
      '<button onclick="_hrCalPrint()" style="padding:8px 20px;border-radius:9px;background:var(--c1);color:#fff;border:none;font-family:\'Sarabun\',sans-serif;font-size:.84rem;font-weight:700;cursor:pointer">🖨️ พิมพ์ปฏิทิน</button>' +
      '<span style="font-size:.74rem;color:var(--t3)">💡 คลิกวันที่เพื่อเพิ่ม / แก้ไข / ลบวันหยุด</span>' +
    '</div>' +
    // ── calendar grid ──
    '<div id="hrCalGrid"></div>' +
    // ── legend ──
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:.74rem;color:var(--t3)">' +
      '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(248,113,113,.4);border-radius:3px;vertical-align:middle;margin-right:4px"></span>นักขัตฤกษ์</span>' +
      '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(251,191,36,.4);border-radius:3px;vertical-align:middle;margin-right:4px"></span>ชดเชย</span>' +
      '<span><span style="display:inline-block;width:12px;height:12px;background:rgba(52,211,153,.4);border-radius:3px;vertical-align:middle;margin-right:4px"></span>บริษัท</span>' +
    '</div>' +
    '</div>';

  _hrCalLoad();
}

function _hrNormDate(val) {
  // Normalize any date format → "dd/MM/yyyy" BE
  var s = String(val || '');
  if (!s) return '';

  // Format 1: dd/MM/yyyy (ถูกอยู่แล้ว หรือ CE ที่ต้อง +543)
  var slashP = s.split('/');
  if (slashP.length === 3) {
    var yr = parseInt(slashP[2]);
    if (yr < 2500) yr += 543;
    return ('0'+slashP[0]).slice(-2) + '/' + ('0'+slashP[1]).slice(-2) + '/' + yr;
  }

  // Format 2: Apps Script Date string "Thu Jan 01 2026 00:00:00 GMT+..."
  var _MON = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  var m2 = s.match(/[A-Z][a-z]{2}\s+(\d{1,2})\s+(\d{4})/);
  var mName = s.match(/([A-Z][a-z]{2})\s+\d{1,2}\s+\d{4}/);
  if (m2 && mName && _MON[mName[1]]) {
    var yr2 = parseInt(m2[2]);
    if (yr2 < 2500) yr2 += 543;
    return ('0'+m2[1]).slice(-2) + '/' + ('0'+_MON[mName[1]]).slice(-2) + '/' + yr2;
  }

  // Format 3: ISO yyyy-MM-dd
  var isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) {
    var yr3 = parseInt(isoM[1]);
    if (yr3 < 2500) yr3 += 543;
    return isoM[3] + '/' + isoM[2] + '/' + yr3;
  }

  return s;
}

function _hrCalLoad() {
  const grid = document.getElementById('hrCalGrid');
  if (grid) grid.innerHTML = '<div style="color:var(--t3);font-size:.85rem;padding:12px">⏳ กำลังโหลดวันหยุด...</div>';
  _hrGET('getHRHolidays').then(function(res) {
    _hrHolidays = (res.data || []).map(function(h) {
      return Object.assign({}, h, { date: _hrNormDate(h.date) });
    });
    if (!_hrHolidays.length) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบวันหยุด',
        html: 'Sheet HR_Holidays ว่างเปล่า<br><span style="font-size:.85rem;color:#94a3b8">ไปที่ <b>ตั้งค่า HR</b> แล้วกด <b>สร้างวันหยุด</b> ก่อน<br>หรือตรวจสอบว่า <b>Redeploy Code.gs</b> แล้ว</span>',
        confirmButtonColor: '#4f46e5',
      });
    }
    _hrCalDraw();
  }).catch(function(e) {
    if (grid) grid.innerHTML = '<div style="color:#f87171;font-size:.85rem;padding:12px">❌ โหลดวันหยุดไม่ได้ — ตรวจสอบ Script URL และ Redeploy Code.gs<br><small style="color:#94a3b8">' + String(e) + '</small></div>';
  });
}

function _hrCalDraw() {
  const grid = document.getElementById('hrCalGrid');
  const sel  = document.getElementById('hrCalYear');
  if (!grid || !sel) return;
  const beYear = parseInt(sel.value);
  const ceYear = beYear - 543;

  // map วันหยุดของปีนี้ → key = 'dd/mm'
  const hMap = {};
  _hrHolidays.forEach(function(h) {
    const p = String(h.date||'').split('/');
    if (p.length === 3 && parseInt(p[2]) === beYear) hMap[p[0]+'/'+p[1]] = h;
  });

  function _holBg(type) {
    return type==='บริษัท' ? 'rgba(52,211,153,.2)' : type==='ชดเชย' ? 'rgba(251,191,36,.2)' : 'rgba(248,113,113,.2)';
  }
  function _holFc(type) {
    return type==='บริษัท' ? '#059669' : type==='ชดเชย' ? '#92400e' : '#dc2626';
  }

  let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';

  for (let m = 1; m <= 12; m++) {
    const firstDow   = new Date(ceYear, m-1, 1).getDay();
    const daysInMon  = new Date(ceYear, m, 0).getDate();
    const mm         = String(m).padStart(2,'0');

    html += '<div style="background:var(--card);border:1px solid var(--bc-input);border-radius:10px;overflow:hidden">';
    // เดือน header
    html += '<div style="background:var(--c1);color:#fff;text-align:center;padding:7px 4px;font-weight:700;font-size:.82rem">'+_CAL_MONTHS[m-1]+' '+beYear+'</div>';
    // วันในสัปดาห์ header
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr)">';
    _CAL_DAYS.forEach(function(d,i){
      var c = i===0?'#f87171':i===6?'#fbbf24':'var(--t3)';
      html += '<div style="text-align:center;padding:3px 1px;font-size:.6rem;font-weight:700;color:'+c+';border-bottom:1px solid var(--bc-input)">'+d+'</div>';
    });
    html += '</div>';
    // วันที่
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr)">';
    for (let i=0; i<firstDow; i++) html += '<div style="min-height:36px;border-right:1px solid var(--bc-input);border-bottom:1px solid var(--bc-input)"></div>';
    for (let d=1; d<=daysInMon; d++) {
      const dow  = new Date(ceYear,m-1,d).getDay();
      const dd   = String(d).padStart(2,'0');
      const key  = dd+'/'+mm;
      const dStr = dd+'/'+mm+'/'+beYear;
      const hol  = hMap[key];
      const esc  = dStr.replace(/'/g,"\\'");
      const nEsc = hol ? hol.name.replace(/'/g,"\\'") : '';

      var bg = hol ? _holBg(hol.type) : (dow===0?'rgba(248,113,113,.05)':dow===6?'rgba(251,191,36,.04)':'var(--card)');
      var fc = hol ? _holFc(hol.type) : (dow===0?'#f87171':dow===6?'#fbbf24':'var(--t1)');

      html += '<div onclick="_hrCalClick(\''+esc+'\',\''+nEsc+'\')" ' +
        'style="min-height:36px;border-right:1px solid var(--bc-input);border-bottom:1px solid var(--bc-input);background:'+bg+';cursor:pointer;padding:2px 3px;position:relative" ' +
        'onmouseover="this.style.filter=\'brightness(.93)\'" onmouseout="this.style.filter=\'\'">' +
        '<div style="font-size:.72rem;font-weight:'+(hol?'700':'400')+';color:'+fc+'">'+d+'</div>' +
        (hol ? '<div style="font-size:.52rem;color:'+fc+';line-height:1.2;overflow:hidden;max-height:18px;word-break:break-all">'+hol.name+'</div>' : '') +
      '</div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  grid.innerHTML = html;
}

function _hrCalClick(dateStr, existingName) {
  if (existingName) {
    Swal.fire({
      title: '📅 ' + dateStr.substring(0,5),
      html: '<div style="font-size:.9rem;margin-bottom:4px"><b>' + existingName + '</b></div>',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '✏️ แก้ชื่อ',
      denyButtonText: '🗑 ลบ',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#4f46e5',
      denyButtonColor: '#ef4444',
    }).then(function(result) {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'แก้ชื่อวันหยุด',
          input: 'text', inputValue: existingName,
          showCancelButton: true,
          confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#4f46e5',
        }).then(function(r2) {
          if (!r2.isConfirmed || !r2.value.trim()) return;
          var hol  = _hrHolidays.find(function(h){ return h.date === dateStr; });
          var type = hol ? hol.type : 'นักขัตฤกษ์';
          _hrPOST('deleteHRHoliday', { date: dateStr }).then(function() {
            return _hrPOST('seedHRHolidays', { holidays: [{ date: dateStr, name: r2.value.trim(), type: type }] });
          }).then(function() { _hrCalLoad(); });
        });
      } else if (result.isDenied) {
        Swal.fire({
          icon: 'warning', title: 'ลบวันหยุด?',
          text: dateStr.substring(0,5) + ' — ' + existingName,
          showCancelButton: true,
          confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#ef4444',
        }).then(function(r3) {
          if (r3.isConfirmed) _hrPOST('deleteHRHoliday', { date: dateStr }).then(function() { _hrCalLoad(); });
        });
      }
    });
  } else {
    Swal.fire({
      title: '➕ เพิ่มวันหยุด ' + dateStr.substring(0,5),
      html:
        '<input id="swal-hn" class="swal2-input" placeholder="ชื่อวันหยุด" style="margin:6px auto">' +
        '<select id="swal-ht" class="swal2-select" style="margin:6px auto;width:80%;padding:8px;border-radius:8px;border:1px solid #d1d5db">' +
          '<option value="บริษัท">บริษัท</option>' +
          '<option value="นักขัตฤกษ์">นักขัตฤกษ์</option>' +
          '<option value="ชดเชย">ชดเชย</option>' +
        '</select>',
      showCancelButton: true,
      confirmButtonText: '➕ เพิ่ม', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#4f46e5',
      focusConfirm: false,
      preConfirm: function() {
        var n = document.getElementById('swal-hn').value.trim();
        var t = document.getElementById('swal-ht').value;
        if (!n) { Swal.showValidationMessage('กรุณาใส่ชื่อวันหยุด'); return false; }
        return { name: n, type: t };
      }
    }).then(function(result) {
      if (!result.isConfirmed) return;
      _hrPOST('seedHRHolidays', { holidays: [{ date: dateStr, name: result.value.name, type: result.value.type }] })
        .then(function() { _hrCalLoad(); });
    });
  }
}

// ── พิมพ์ปฏิทิน A4 พร้อมช่องลงนาม ──────────────────────────
function _hrCalPrint() {
  const sel = document.getElementById('hrCalYear');
  if (!sel) return;
  const beYear = parseInt(sel.value);
  const ceYear = beYear - 543;

  const yearHols = _hrHolidays.filter(function(h) {
    return String(h.date||'').endsWith('/'+beYear);
  }).sort(function(a,b) {
    var pa=a.date.split('/'), pb=b.date.split('/');
    return new Date(parseInt(pa[2])-543,parseInt(pa[1])-1,parseInt(pa[0])) -
           new Date(parseInt(pb[2])-543,parseInt(pb[1])-1,parseInt(pb[0]));
  });

  const hMap = {};
  yearHols.forEach(function(h) {
    var p = h.date.split('/');
    hMap[p[0]+'/'+p[1]] = h;
  });

  var _coCfg = {}; try { _coCfg = JSON.parse(localStorage.getItem('ptts_company_cfg') || '{}'); } catch(e){}
  var compName = _coCfg.name || localStorage.getItem('ptts_company_name') || '';

  function holBg(type) { return type==='บริษัท'?'#d1fae5':type==='ชดเชย'?'#fef3c7':'#fee2e2'; }
  function holFc(type) { return type==='บริษัท'?'#065f46':type==='ชดเชย'?'#78350f':'#991b1b'; }

  // สร้าง HTML 12 เดือน
  var monthsHtml = '';
  for (var m=1; m<=12; m++) {
    var firstDow  = new Date(ceYear,m-1,1).getDay();
    var daysInMon = new Date(ceYear,m,0).getDate();
    var mm = String(m).padStart(2,'0');

    monthsHtml += '<div class="month-box"><div class="month-hdr">'+_CAL_MONTHS[m-1]+'</div>';
    monthsHtml += '<div class="day-row">';
    _CAL_DAYS.forEach(function(d,i){
      monthsHtml += '<div class="dh" style="color:'+(i===0?'#dc2626':i===6?'#d97706':'#6b7280')+'">'+d+'</div>';
    });
    monthsHtml += '</div><div class="dates-grid">';
    for (var i=0;i<firstDow;i++) monthsHtml+='<div class="dc empty"></div>';
    for (var d=1;d<=daysInMon;d++) {
      var dow = new Date(ceYear,m-1,d).getDay();
      var dd2 = String(d).padStart(2,'0');
      var hol = hMap[dd2+'/'+mm];
      var bg  = hol ? holBg(hol.type) : (dow===0?'#fff5f5':dow===6?'#fffbeb':'#fff');
      var fc  = hol ? holFc(hol.type) : (dow===0?'#dc2626':dow===6?'#d97706':'#374151');
      monthsHtml += '<div class="dc" style="background:'+bg+';color:'+fc+';font-weight:'+(hol?'700':'400')+'">' +
        '<span>'+d+'</span>' + (hol?'<small>'+hol.name+'</small>':'') + '</div>';
    }
    monthsHtml += '</div></div>';
  }

  // รายการวันหยุดแยกประเภท
  var listHtml = '';
  var grouped = {};
  yearHols.forEach(function(h){
    if (!grouped[h.type]) grouped[h.type]=[];
    grouped[h.type].push(h);
  });
  Object.keys(grouped).forEach(function(type) {
    listHtml += '<div style="margin-bottom:6px"><b style="color:'+(type==='บริษัท'?'#065f46':type==='ชดเชย'?'#78350f':'#991b1b')+';font-size:11pt">■ '+type+'</b>';
    grouped[type].forEach(function(h) {
      listHtml += '<div style="display:flex;gap:12px;font-size:10pt;margin-left:14px;line-height:1.6">' +
        '<span style="min-width:70px">'+h.date.substring(0,5)+'</span><span>'+h.name+'</span></div>';
    });
    listHtml += '</div>';
  });

  var win = window.open('','_blank');
  if (!win) { Swal.fire('⚠️','กรุณาอนุญาต Pop-up','warning'); return; }

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>ปฏิทินวันหยุด ${beYear}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sarabun',sans-serif;font-size:10pt;color:#1f2937;background:#fff;padding:14mm 12mm}
h1{font-size:18pt;font-weight:800;text-align:center;color:#1e3a8a;margin-bottom:2px}
.sub{text-align:center;font-size:11pt;color:#6b7280;margin-bottom:12px}
.cal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.month-box{border:1px solid #d1d5db;border-radius:6px;overflow:hidden}
.month-hdr{background:#1e3a8a;color:#fff;text-align:center;padding:4px;font-weight:700;font-size:10pt}
.day-row,.dates-grid{display:grid;grid-template-columns:repeat(7,1fr)}
.dh{text-align:center;font-size:7.5pt;font-weight:700;padding:2px 0;background:#f3f4f6}
.dc{text-align:center;font-size:8pt;padding:2px 1px;min-height:28px;border:0.5px solid #f3f4f6;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;line-height:1.2}
.dc.empty{background:#f9fafb}
.dc small{font-size:6pt;line-height:1.1;display:block;overflow:hidden;max-height:14px;word-break:break-all}
.list-section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px}
.sign-row{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:10px;border-top:1px solid #d1d5db;padding-top:10px}
.sign-box{text-align:center}
.sign-line{border-bottom:1px solid #374151;margin:28px 8px 4px;height:1px}
.sign-label{font-size:9pt;color:#6b7280}
@media print{body{padding:8mm 10mm}@page{size:A4;margin:0}}
</style></head><body>
<h1>ปฏิทินวันหยุดประจำปี ${beYear}</h1>
<div class="sub">${compName}${compName?' — ':''}รวม ${yearHols.length} วันหยุด</div>
<div class="cal-grid">${monthsHtml}</div>
<div class="list-section">${listHtml}</div>
<div class="sign-row">
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">ผู้จัดทำ / ฝ่าย HR</div></div>
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">ผู้ตรวจสอบ</div></div>
  <div class="sign-box"><div class="sign-line"></div><div class="sign-label">ผู้อนุมัติ / ผู้บริหาร</div></div>
</div>
<script>(function(){if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){window.focus();window.print();});}else{setTimeout(function(){window.print();},800);}})();<\/script>
</body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════
// HOLIDAY SEED — ข้อมูลวันหยุดพุทธและฟังก์ชันสร้างรายการ
// ══════════════════════════════════════════════════════════════

// วันหยุดทางพุทธศาสนา (ขึ้นอยู่กับปฏิทินจันทรคติ)
// * = ประมาณการ ควรตรวจสอบก่อนใช้งานจริง
const HR_HOLIDAY_BUDDHIST = {
  2569: [
    { m: 2, d: 20, name: 'วันมาฆบูชา' },
    { m: 5, d: 31, name: 'วันวิสาขบูชา' },
    { m: 7, d: 29, name: 'วันอาสาฬหบูชา' },
  ],
  2570: [ // 2027 CE
    { m: 3, d: 12, name: 'วันมาฆบูชา' },
    { m: 5, d: 20, name: 'วันวิสาขบูชา' },
    { m: 7, d: 18, name: 'วันอาสาฬหบูชา' },
  ],
  2571: [ // 2028 CE
    { m: 3, d:  1, name: 'วันมาฆบูชา' },
    { m: 6, d:  8, name: 'วันวิสาขบูชา' },
    { m: 8, d:  6, name: 'วันอาสาฬหบูชา' },
  ],
  2572: [ // 2029 CE
    { m: 2, d: 18, name: 'วันมาฆบูชา' },
    { m: 5, d: 28, name: 'วันวิสาขบูชา' },
    { m: 7, d: 26, name: 'วันอาสาฬหบูชา' },
  ],
  2573: [ // 2030 CE
    { m: 2, d:  7, name: 'วันมาฆบูชา' },
    { m: 5, d: 17, name: 'วันวิสาขบูชา' },
    { m: 7, d: 15, name: 'วันอาสาฬหบูชา' },
  ],
  2574: [ // 2031 CE
    { m: 2, d: 27, name: 'วันมาฆบูชา' },
    { m: 6, d:  7, name: 'วันวิสาขบูชา' },
    { m: 8, d:  4, name: 'วันอาสาฬหบูชา' },
  ],
};

// วันหยุดราชการคงที่ (วัน/เดือนเดิมทุกปี)
const HR_HOLIDAY_FIXED = [
  { m: 1,  d: 1,  name: 'วันขึ้นปีใหม่' },
  { m: 4,  d: 6,  name: 'วันจักรี' },
  { m: 4,  d: 13, name: 'วันสงกรานต์' },
  { m: 4,  d: 14, name: 'วันสงกรานต์' },
  { m: 4,  d: 15, name: 'วันสงกรานต์' },
  { m: 5,  d: 1,  name: 'วันแรงงานแห่งชาติ' },
  { m: 6,  d: 3,  name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี' },
  { m: 7,  d: 28, name: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { m: 8,  d: 12, name: 'วันแม่แห่งชาติ' },
  { m: 10, d: 13, name: 'วันคล้ายวันสวรรคต ร.9' },
  { m: 10, d: 23, name: 'วันปิยมหาราช' },
  { m: 12, d: 5,  name: 'วันคล้ายวันพระบรมราชสมภพ ร.9 (วันพ่อ)' },
  { m: 12, d: 10, name: 'วันรัฐธรรมนูญ' },
  { m: 12, d: 31, name: 'วันสิ้นปี' },
];

// สร้างรายการวันหยุดของปี BE ที่ต้องการ พร้อมคำนวณวันชดเชยอัตโนมัติ
function _hrBuildHolidays(beYear) {
  var ceYear   = beYear - 543;
  var buddhist = (HR_HOLIDAY_BUDDHIST[beYear] || []).map(function(h) {
    return { m: h.m, d: h.d, name: h.name, type: 'นักขัตฤกษ์' };
  });
  var all = HR_HOLIDAY_FIXED.map(function(h) {
    return { m: h.m, d: h.d, name: h.name, type: 'นักขัตฤกษ์' };
  }).concat(buddhist);

  var used   = {};
  var result = [];

  function _push(dateObj, name, type) {
    var dd  = String(dateObj.getDate()).padStart(2, '0');
    var mm  = String(dateObj.getMonth() + 1).padStart(2, '0');
    var key = dd + '/' + mm + '/' + beYear;
    if (used[key]) return;
    used[key] = true;
    result.push({ date: key, name: name, type: type });
  }

  all.forEach(function(h) {
    var base = new Date(ceYear, h.m - 1, h.d);
    _push(base, h.name, h.type);
    var dow = base.getDay(); // 0=อาทิตย์, 6=เสาร์
    if (dow === 0) {
      // ตรงอาทิตย์ → ชดเชยจันทร์
      _push(new Date(ceYear, h.m - 1, h.d + 1), 'ชดเชย' + h.name, 'ชดเชย');
    } else if (dow === 6) {
      // ตรงเสาร์ → ชดเชยจันทร์ (+2)
      _push(new Date(ceYear, h.m - 1, h.d + 2), 'ชดเชย' + h.name, 'ชดเชย');
    }
  });

  // sort ตามวันที่
  result.sort(function(a, b) {
    var pa = a.date.split('/'), pb = b.date.split('/');
    return new Date(parseInt(pa[2]) - 543, parseInt(pa[1]) - 1, parseInt(pa[0])) -
           new Date(parseInt(pb[2]) - 543, parseInt(pb[1]) - 1, parseInt(pb[0]));
  });
  return result;
}

// ══════════════════════════════════════════════════════════════
// PANEL 4 — ตั้งค่า HR
// ══════════════════════════════════════════════════════════════
function _hrRenderSettings() {
  const p = document.getElementById('hrPanel4');
  if (!p) return;
  const s = _hrCfg();
  const roundTime = _hrOTRoundTime(s);

  p.innerHTML =
    '<div style="max-width:560px;background:var(--card);border:1px solid var(--bc-input);border-radius:14px;padding:22px 24px">' +
    '<div style="font-weight:700;font-size:.95rem;color:var(--c1);margin-bottom:16px">⚙️ กฎการคำนวณ HR</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      _hrCfgField('hrCfgStart', '⏰ เวลาเข้างาน', s.startTime, 'time') +
      _hrCfgField('hrCfgEnd',   '⏰ เวลาเลิกงาน', s.endTime,   'time') +
    '</div>' +
    '<div style="margin-bottom:12px">' +
      _hrCfgField('hrCfgGrace', '🕐 Grace สาย (นาที) — สายหลัง ' + s.startTime + '+' + s.lateGrace + ' น.', s.lateGrace, 'number') +
    '</div>' +
    '<div style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.2);border-radius:10px;padding:14px;margin-bottom:12px">' +
      '<div style="font-size:.82rem;font-weight:700;color:#818cf8;margin-bottom:8px">⚡ กฎ OT</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">' +
        _hrCfgField('hrCfgOTMin', 'ออกหลัง (เริ่มนับ OT)', s.otMinTime, 'time') +
        _hrCfgField('hrCfgOTEnd', 'เวลา OT สิ้นสุด',        s.otEndTime, 'time') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        _hrCfgField('hrCfgOTMax',   'OT สูงสุด (ชม./วัน)',           s.otMaxH,   'number') +
        _hrCfgField('hrCfgOTRound', 'Round-up ก่อน OTEnd (นาที)',    s.otFullMin,'number') +
      '</div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
      _hrCfgField('hrCfgSun', '☀️ อัตราวันอาทิตย์ (×)', s.sunRate, 'number') +
      _hrCfgField('hrCfgSat', '📅 อัตราวันเสาร์ (×)',    s.satRate, 'number') +
    '</div>' +
    '<button onclick="hrSaveSettings()" style="width:100%;padding:11px;background:var(--c1);color:#fff;border:none;border-radius:10px;font-family:\'Sarabun\',sans-serif;font-size:.9rem;font-weight:700;cursor:pointer">💾 บันทึกการตั้งค่า</button>' +
    '<div style="margin-top:12px;padding:10px 12px;background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.15);border-radius:8px;font-size:.76rem;color:var(--t3);line-height:1.7">' +
      '<b style="color:#34d399">ตัวอย่างกฎ OT ปัจจุบัน:</b><br>' +
      '• ออกก่อน ' + s.otMinTime + ' → ไม่มี OT<br>' +
      '• ' + s.otMinTime + ' – ' + roundTime + ' → OT = เวลาออก − ' + s.endTime + '<br>' +
      '• ออก ≥ ' + roundTime + ' → OT เต็ม ' + s.otMaxH + ' ชม.<br>' +
      '• วันอาทิตย์ → ทุกชม.ที่ทำงาน × ' + s.sunRate +
    '</div>' +
    '</div>' +

    // ── การ์ดจัดการวันหยุด ─────────────────────────────────────────
    '<div style="max-width:560px;margin-top:16px;background:var(--card);border:1px solid var(--bc-input);border-radius:14px;padding:22px 24px">' +
      '<div style="font-weight:700;font-size:.95rem;color:var(--c1);margin-bottom:4px">📅 วันหยุดราชการ</div>' +
      '<div style="font-size:.76rem;color:var(--t3);margin-bottom:14px">สร้างรายการวันหยุดประจำปีลงใน Sheet HR_Holidays — ข้ามวันที่ซ้ำอัตโนมัติ</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
        '<label style="font-size:.82rem;color:var(--t2)">เลือกปี:</label>' +
        '<select id="hrHolYear" onchange="_hrHolPreview()" style="padding:7px 12px;border-radius:8px;border:1px solid var(--bc-input);background:var(--bg);color:var(--t1);font-family:\'Sarabun\',sans-serif;font-size:.85rem">' +
          [2569,2570,2571,2572,2573,2574].map(function(y) {
            return '<option value="' + y + '">' + y + ' (' + (y-543) + ')</option>';
          }).join('') +
        '</select>' +
        '<button onclick="hrSeedHolidays()" style="padding:8px 18px;background:var(--c1);color:#fff;border:none;border-radius:8px;font-family:\'Sarabun\',sans-serif;font-size:.85rem;font-weight:700;cursor:pointer">✅ สร้างวันหยุด</button>' +
      '</div>' +
      '<div id="hrHolPreviewBox" style="max-height:260px;overflow-y:auto;border:1px solid var(--bc-input);border-radius:8px;padding:8px 4px">' +
        _hrHolPreviewHtml(2569) +
      '</div>' +
      '<div style="margin-top:8px;font-size:.7rem;color:var(--t3)">⚠️ วันหยุดพุทธ (มาฆบูชา/วิสาขบูชา/อาสาฬหบูชา) เป็นข้อมูลประมาณการ ควรตรวจสอบกับปฏิทินราชการก่อนใช้จริง</div>' +
    '</div>' +

    // ── การ์ดรอบการจ่ายเงินเดือน ─────────────────────────────────
    _hrPayCycleCard() +

    '</div>';
}

// ── สร้าง HTML preview รายการวันหยุด ─────────────────────────
function _hrHolPreviewHtml(beYear) {
  var list = _hrBuildHolidays(beYear);
  if (!list.length) return '<div style="padding:8px 12px;font-size:.8rem;color:var(--t3)">ไม่มีข้อมูล</div>';
  var TYPE_COLOR = { 'นักขัตฤกษ์': '#818cf8', 'ชดเชย': '#f59e0b' };
  return list.map(function(h) {
    var c = TYPE_COLOR[h.type] || 'var(--t3)';
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid var(--bc-input)">' +
      '<span style="font-size:.78rem;color:var(--t3);min-width:68px">' + h.date.substring(0, 5) + '</span>' +
      '<span style="font-size:.8rem;color:var(--t1);flex:1">' + h.name + '</span>' +
      '<span style="font-size:.7rem;color:' + c + ';font-weight:600">' + h.type + '</span>' +
    '</div>';
  }).join('');
}

// เรียกเมื่อเปลี่ยน dropdown ปี
function _hrHolPreview() {
  var sel = document.getElementById('hrHolYear');
  var box = document.getElementById('hrHolPreviewBox');
  if (!sel || !box) return;
  box.innerHTML = _hrHolPreviewHtml(parseInt(sel.value));
}

// ── UI การ์ดรอบการจ่ายเงินเดือน ────────────────────────────────
function _hrPayCycleCard() {
  var pc = _hrPayCfg();
  var isSemi = pc.mode === 'semi';
  function dayInput(id, val) {
    return '<input id="'+id+'" type="number" min="1" max="31" value="'+val+'" style="width:56px;padding:6px 8px;border-radius:7px;border:1px solid var(--bc-input);background:var(--bg);color:var(--t1);font-family:\'Sarabun\',sans-serif;text-align:center">';
  }
  return '<div style="max-width:560px;margin-top:16px;background:var(--card);border:1px solid var(--bc-input);border-radius:14px;padding:22px 24px">' +
    '<div style="font-weight:700;font-size:.95rem;color:var(--c1);margin-bottom:4px">💰 รอบการจ่ายเงินเดือน</div>' +
    '<div style="font-size:.76rem;color:var(--t3);margin-bottom:14px">กำหนดช่วงวันทำงานและวันจ่ายแต่ละงวด — ใช้สำหรับกรองข้อมูลสรุปและสลิปเงินเดือน</div>' +
    // mode selector
    '<div style="display:flex;gap:10px;margin-bottom:16px">' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border-radius:9px;border:2px solid '+(isSemi?'var(--c1)':'var(--bc-input)')+';background:'+(isSemi?'rgba(99,102,241,.1)':'transparent')+'">' +
        '<input type="radio" name="hrPayMode" value="semi" '+(isSemi?'checked':'')+' onchange="hrPayModeChange(this)" style="accent-color:var(--c1)">' +
        '<span style="font-size:.85rem;font-weight:700;color:var(--t1)">ครึ่งเดือน (2 งวด)</span>' +
      '</label>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 16px;border-radius:9px;border:2px solid '+(!isSemi?'var(--c1)':'var(--bc-input)')+';background:'+(!isSemi?'rgba(99,102,241,.1)':'transparent')+'">' +
        '<input type="radio" name="hrPayMode" value="monthly" '+(!isSemi?'checked':'')+' onchange="hrPayModeChange(this)" style="accent-color:var(--c1)">' +
        '<span style="font-size:.85rem;font-weight:700;color:var(--t1)">รายเดือน (1 งวด)</span>' +
      '</label>' +
    '</div>' +
    // period detail (show only if semi)
    '<div id="hrPaySemiDetail" style="display:'+(isSemi?'block':'none')+'">' +
      // งวด 1
      '<div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);border-radius:10px;padding:14px;margin-bottom:10px">' +
        '<div style="font-size:.8rem;font-weight:700;color:#818cf8;margin-bottom:10px">📌 งวดที่ 1 — จ่ายวันที่ 1 (เดือนถัดไป)</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.83rem;color:var(--t2)">' +
          'ช่วงทำงาน: วันที่ ' + dayInput('hrPayP1Start', pc.p1.start) +
          ' <span>ถึง</span> วันที่ ' + dayInput('hrPayP1End', pc.p1.end) +
          ' &nbsp;|&nbsp; จ่ายวันที่ ' + dayInput('hrPayP1Day', pc.p1.payday) + ' (เดือนถัดไป)' +
        '</div>' +
      '</div>' +
      // งวด 2
      '<div style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.18);border-radius:10px;padding:14px;margin-bottom:10px">' +
        '<div style="font-size:.8rem;font-weight:700;color:#34d399;margin-bottom:10px">📌 งวดที่ 2 — จ่ายวันที่ 16 (เดือนนี้)</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.83rem;color:var(--t2)">' +
          'ช่วงทำงาน: วันที่ ' + dayInput('hrPayP2Start', pc.p2.start) + ' (เดือนก่อน)' +
          ' <span>ถึง</span> วันที่ ' + dayInput('hrPayP2End', pc.p2.end) + ' (เดือนนี้)' +
          ' &nbsp;|&nbsp; จ่ายวันที่ ' + dayInput('hrPayP2Day', pc.p2.payday) +
        '</div>' +
      '</div>' +
      '<div style="font-size:.72rem;color:var(--t3);margin-bottom:10px">💡 ตัวอย่าง: วันที่ 1 ม.ค. = จ่ายเงินสำหรับ 11-25 ธ.ค. | วันที่ 16 ม.ค. = จ่ายเงินสำหรับ 26 ธ.ค. – 10 ม.ค.</div>' +
    '</div>' +
    '<button onclick="hrSavePayCfg()" style="width:100%;padding:10px;background:var(--c1);color:#fff;border:none;border-radius:9px;font-family:\'Sarabun\',sans-serif;font-size:.88rem;font-weight:700;cursor:pointer">💾 บันทึกรอบการจ่าย</button>' +
  '</div>';
}

function hrPayModeChange(el) {
  var d = document.getElementById('hrPaySemiDetail');
  if (d) d.style.display = el.value === 'semi' ? 'block' : 'none';
  // อัปเดต border ของ label
  var labels = document.querySelectorAll('label[style*="hrPayMode"]');
  document.querySelectorAll('input[name="hrPayMode"]').forEach(function(r) {
    var lbl = r.parentElement;
    if (r.checked) {
      lbl.style.border = '2px solid var(--c1)';
      lbl.style.background = 'rgba(99,102,241,.1)';
    } else {
      lbl.style.border = '2px solid var(--bc-input)';
      lbl.style.background = 'transparent';
    }
  });
}

function hrSavePayCfg() {
  var modeEl = document.querySelector('input[name="hrPayMode"]:checked');
  var g = function(id) { var el = document.getElementById(id); return el ? parseInt(el.value) || 0 : 0; };
  var cfg = {
    mode: modeEl ? modeEl.value : 'semi',
    p1: { start: g('hrPayP1Start') || 11, end: g('hrPayP1End') || 25, payday: g('hrPayP1Day') || 1 },
    p2: { start: g('hrPayP2Start') || 26, end: g('hrPayP2End') || 10, payday: g('hrPayP2Day') || 16 },
  };
  localStorage.setItem(HR_PAY_LS, JSON.stringify(cfg));
  Swal.fire({ icon: 'success', title: '💾 บันทึกรอบการจ่ายแล้ว', timer: 1200, showConfirmButton: false });
}

// กดปุ่ม "สร้างวันหยุด" → POST ไปบันทึก
function hrSeedHolidays() {
  var sel = document.getElementById('hrHolYear');
  if (!sel) return;
  var beYear   = parseInt(sel.value);
  var holidays = _hrBuildHolidays(beYear);
  if (!holidays.length) return;

  Swal.fire({ title: '⏳ กำลังสร้างวันหยุดปี ' + beYear + '...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });

  _hrPOST('seedHRHolidays', { holidays: holidays })
    .then(function(r) {
      Swal.fire({
        icon: 'success',
        title: '✅ สร้างวันหยุดปี ' + beYear + ' แล้ว',
        html: 'เพิ่ม <b style="color:#34d399">' + (r.added || 0) + ' วัน</b>' +
              (r.skipped ? ' | ข้าม <b style="color:#94a3b8">' + r.skipped + ' วัน</b> (มีอยู่แล้ว)' : ''),
        confirmButtonColor: '#4f46e5',
      });
      // อัปเดต _hrHolidays cache
      _hrGET('getHRHolidays').then(function(res) { _hrHolidays = res.data || []; });
    })
    .catch(function(e) { Swal.fire('❌ ผิดพลาด', String(e), 'error'); });
}


function _hrCfgField(id, label, value, type) {
  return '<div><label style="font-size:.76rem;color:var(--t3);display:block;margin-bottom:4px">' + label + '</label>' +
    '<input id="' + id + '" type="' + type + '" value="' + value + '" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--bg);color:var(--t1);font-family:\'Sarabun\',sans-serif;box-sizing:border-box"></div>';
}

function hrSaveSettings() {
  const g = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };
  _hrS = {
    startTime: g('hrCfgStart') || HR_DEF.startTime,
    endTime:   g('hrCfgEnd')   || HR_DEF.endTime,
    lateGrace: parseInt(g('hrCfgGrace'))   || HR_DEF.lateGrace,
    otMinTime: g('hrCfgOTMin') || HR_DEF.otMinTime,
    otEndTime: g('hrCfgOTEnd') || HR_DEF.otEndTime,
    otMaxH:    parseFloat(g('hrCfgOTMax'))   || HR_DEF.otMaxH,
    otFullMin: parseInt(g('hrCfgOTRound'))   || HR_DEF.otFullMin,
    sunRate:   parseFloat(g('hrCfgSun'))    || HR_DEF.sunRate,
    satRate:   parseFloat(g('hrCfgSat'))    || HR_DEF.satRate,
  };
  _hrSaveS();
  Swal.fire({ icon: 'success', title: '💾 บันทึกแล้ว', timer: 1200, showConfirmButton: false });
  setTimeout(_hrRenderSettings, 1300); // re-render ตัวอย่าง
}

// ══════════════════════════════════════════════════════════════
// ATT REPORT — รายงานการเข้างานรายบุคคล
// ══════════════════════════════════════════════════════════════
function hrPrintAttReport(empId, month, period) {
  var emp  = (_hrEmps || []).find(function(e) { return String(e.empId) === String(empId); }) || {};
  var name = emp.name || empId;
  var dept = emp.dept || '';

  // ดึง attendance ของ employee นี้ในช่วงที่เลือก
  var allRecs = (_hrAtt || []).filter(function(r) { return String(r.empId) === String(empId); });
  var recs    = _hrFilterByPeriod(allRecs, period || 'all', month);

  // เรียงตามวันที่
  recs = recs.slice().sort(function(a, b) {
    var pa = String(a.date).split('/'), pb = String(b.date).split('/');
    var da = new Date(parseInt(pa[2]) < 2500 ? parseInt(pa[2]) : parseInt(pa[2])-543, parseInt(pa[1])-1, parseInt(pa[0]));
    var db = new Date(parseInt(pb[2]) < 2500 ? parseInt(pb[2]) : parseInt(pb[2])-543, parseInt(pb[1])-1, parseInt(pb[0]));
    return da - db;
  });

  // ป้ายสถานะ
  var ST_LABEL = { present: 'มา', absent: 'ขาด', off: 'หยุด/ลา', holiday: 'วันหยุด' };
  var ST_COLOR = { present: '#16a34a', absent: '#dc2626', off: '#9333ea', holiday: '#0891b2' };
  var DOW_TH   = ['อา','จ','อ','พ','พฤ','ศ','ส'];

  // คำนวณ summary
  var totPresent = 0, totAbsent = 0, totOff = 0, totLate = 0, totLateMin = 0;
  var totOtWD = 0, totOtSun = 0;
  recs.forEach(function(r) {
    var st = r.status || 'present';
    if (st === 'present') totPresent++;
    else if (st === 'absent') totAbsent++;
    else totOff++;
    if ((parseFloat(r.lateMin) || 0) > 0) { totLate++; totLateMin += parseFloat(r.lateMin)||0; }
    var ot = parseFloat(r.otHours) || 0;
    if (ot > 0) { if ((parseFloat(r.otRate)||1) >= 2) totOtSun += ot; else totOtWD += ot; }
  });

  // ชื่อบริษัท
  var coName = '';
  try { coName = (JSON.parse(localStorage.getItem('ptts_company_cfg') || '{}')).name || ''; } catch(e) {}

  // ป้ายงวด
  var pc = _hrPayCfg();
  var periodLabel = '';
  if (period === 'p1') periodLabel = 'งวด 1 ('+pc.p1.start+'–'+pc.p1.end+' '+_hrMLab(month)+')';
  else if (period === 'p2') periodLabel = 'งวด 2 ('+pc.p2.start+' '+(function(){var mp=month.split('-').map(Number);var pM=mp[1]===1?12:mp[1]-1,pY=mp[1]===1?mp[0]-1:mp[0];return _hrMLab(pY+'-'+String(pM).padStart(2,'0'));})()+'–'+pc.p2.end+' '+_hrMLab(month)+')';
  else periodLabel = 'ทั้งเดือน '+_hrMLab(month);

  // สร้าง HTML ตาราง
  var rows = '';
  recs.forEach(function(r) {
    var st    = r.status || 'present';
    var stLbl = ST_LABEL[st] || st;
    var stCol = ST_COLOR[st] || '#333';
    var dow   = DOW_TH[parseInt(r.dow) || 0] || '';
    var lm    = parseFloat(r.lateMin) || 0;
    var ot    = parseFloat(r.otHours) || 0;
    var otRate= parseFloat(r.otRate)  || 1;
    var lateCell  = lm > 0 ? '<span style="color:#b45309;font-weight:700">'+lm+' นาที</span>' : '<span style="color:#aaa">—</span>';
    var otCell    = ot > 0
      ? '<span style="color:'+(otRate>=2?'#d97706':'#6366f1')+';font-weight:700">'+ot.toFixed(1)+'h'+(otRate>=2?' (×2)':'')+' </span>'
      : '<span style="color:#aaa">—</span>';
    var noteCell  = r.otNote ? '<div style="font-size:.72rem;color:#888;margin-top:2px">'+r.otNote+'</div>' : '';
    rows += '<tr>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">'+r.date+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:'+(dow==='อา'||dow==='ส'?'#9333ea':'#374151')+'">'+dow+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:'+stCol+';font-weight:700">'+stLbl+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:.82rem">'+(r.clockIn||'—')+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:.82rem">'+(r.lastScan||'—')+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center">'+lateCell+'</td>' +
      '<td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center">'+otCell+noteCell+'</td>' +
    '</tr>';
  });

  var printDate = (function() {
    var now = new Date();
    return ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+(now.getFullYear()+543);
  })();

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>รายงานการเข้างาน — '+name+'</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' +
      'body{font-family:\'Sarabun\',sans-serif;margin:0;padding:20mm 15mm;font-size:13pt;color:#111}' +
      'h1{font-size:16pt;margin:0 0 2px;color:#1e3a5f}' +
      'h2{font-size:13pt;margin:0 0 12px;color:#374151;font-weight:600}' +
      '.co{font-size:11pt;color:#555;margin-bottom:14px}' +
      '.info-row{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;background:#f9fafb}' +
      '.info-item{display:flex;flex-direction:column;gap:2px}' +
      '.info-label{font-size:.72rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px}' +
      '.info-val{font-size:1rem;font-weight:700;color:#111}' +
      'table{width:100%;border-collapse:collapse}' +
      'thead tr{background:#1e3a5f;color:#fff}' +
      'th{padding:7px 8px;text-align:center;font-size:.78rem;font-weight:700;letter-spacing:.3px}' +
      'th:first-child{text-align:left}' +
      'tbody tr:nth-child(even){background:#f8fafc}' +
      '.summary{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;border-top:2px solid #1e3a5f;padding-top:14px}' +
      '.sum-box{flex:1;min-width:90px;text-align:center;background:#f0f4ff;border-radius:8px;padding:8px 10px}' +
      '.sum-num{font-size:1.4rem;font-weight:700}' +
      '.sum-lbl{font-size:.72rem;color:#555;margin-top:2px}' +
      '.foot{margin-top:20px;text-align:right;font-size:.75rem;color:#aaa}' +
      '@media print{body{padding:10mm 10mm}@page{size:A4;margin:10mm}}' +
    '</style></head><body>' +
    (coName ? '<div class="co">'+coName+'</div>' : '') +
    '<h1>รายงานการเข้างาน</h1>' +
    '<h2>'+periodLabel+'</h2>' +
    '<div class="info-row">' +
      '<div class="info-item"><span class="info-label">พนักงาน</span><span class="info-val">'+name+'</span></div>' +
      '<div class="info-item"><span class="info-label">รหัส</span><span class="info-val">'+empId+'</span></div>' +
      (dept ? '<div class="info-item"><span class="info-label">แผนก</span><span class="info-val">'+dept+'</span></div>' : '') +
    '</div>' +
    '<table><thead><tr>' +
      '<th style="text-align:left">วันที่</th>' +
      '<th>วัน</th>' +
      '<th>สถานะ</th>' +
      '<th>เวลาเข้า</th>' +
      '<th>เวลาออก</th>' +
      '<th>สาย</th>' +
      '<th>OT</th>' +
    '</tr></thead><tbody>' +
    (rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">ไม่พบข้อมูล</td></tr>') +
    '</tbody></table>' +
    '<div class="summary">' +
      '<div class="sum-box"><div class="sum-num" style="color:#16a34a">'+totPresent+'</div><div class="sum-lbl">วันที่มา</div></div>' +
      '<div class="sum-box"><div class="sum-num" style="color:#dc2626">'+totAbsent+'</div><div class="sum-lbl">ขาด</div></div>' +
      '<div class="sum-box"><div class="sum-num" style="color:#9333ea">'+totOff+'</div><div class="sum-lbl">หยุด/ลา</div></div>' +
      '<div class="sum-box"><div class="sum-num" style="color:#b45309">'+totLate+'</div><div class="sum-lbl">มาสาย ('+totLateMin+' นาที)</div></div>' +
      '<div class="sum-box"><div class="sum-num" style="color:#6366f1">'+totOtWD.toFixed(1)+'</div><div class="sum-lbl">OT ปกติ (ชม.)</div></div>' +
      '<div class="sum-box"><div class="sum-num" style="color:#d97706">'+totOtSun.toFixed(1)+'</div><div class="sum-lbl">OT อาทิตย์ (ชม.)</div></div>' +
    '</div>' +
    '<div class="foot">พิมพ์: '+printDate+'</div>' +
    '<script>(function(){' +
      'function go(){try{window.focus();window.print();}catch(e){}}' +
      'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go).catch(function(){setTimeout(go,700);});}else{setTimeout(go,700);}' +
    '})();<\/script></body></html>';

  var win = window.open('', '_blank');
  if (!win) { Swal.fire('⚠️', 'กรุณาอนุญาต Popup แล้วลองใหม่', 'warning'); return; }
  win.document.write(html);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════
// EDIT ATT — แก้ไขเวลาทำงานหลัง save
// ══════════════════════════════════════════════════════════════
function hrEditAtt(empId, month, period) {
  var emp  = (_hrEmps || []).find(function(e) { return String(e.empId) === String(empId); }) || {};
  var name = emp.name || empId;

  // ดึงและเรียงข้อมูลของ employee นี้ในงวดที่เลือก
  var allRecs = (_hrAtt || []).filter(function(r) { return String(r.empId) === String(empId); });
  var recs    = _hrFilterByPeriod(allRecs, period || 'all', month).slice().sort(function(a, b) {
    var pa = String(a.date).split('/'), pb = String(b.date).split('/');
    var toTs = function(p) { return new Date(parseInt(p[2])<2500?parseInt(p[2]):parseInt(p[2])-543, parseInt(p[1])-1, parseInt(p[0])).getTime(); };
    return toTs(pa) - toTs(pb);
  });

  if (!recs.length) { Swal.fire('ℹ️', 'ไม่พบข้อมูลในงวดนี้', 'info'); return; }

  var DOW_TH = ['อา','จ','อ','พ','พฤ','ศ','ส'];

  // สร้างแถวใน popup
  var tableRows = recs.map(function(r, i) {
    var dowIdx = parseInt(r.dow) || 0;
    var dow    = DOW_TH[dowIdx] || '';
    var isSun  = dowIdx === 0;  // อาทิตย์
    var isSat  = dowIdx === 6;  // เสาร์
    // วันอาทิตย์ → บังคับ วันหยุด
    var effStatus = isSun ? 'holiday' : (r.status || 'present');

    // สีพื้นแถว + เส้นซ้าย (เข้มขึ้น มองเห็นชัด)
    var rowStyle = 'border-top:1px solid #e5e7eb;';
    if (isSun) {
      rowStyle = 'border-top:1px solid #c4b5fd;background:#ede9fe;border-left:4px solid #7c3aed;';
    } else if (isSat) {
      rowStyle = 'border-top:1px solid #c7d2fe;background:#e0e7ff;border-left:4px solid #6366f1;';
    } else if (effStatus === 'absent') {
      rowStyle = 'border-top:1px solid #fca5a5;background:#fee2e2;border-left:4px solid #dc2626;';
    } else if (effStatus === 'off') {
      rowStyle = 'border-top:1px solid #d8b4fe;background:#f3e8ff;border-left:4px solid #9333ea;';
    } else if ((parseFloat(r.lateMin)||0) > 0) {
      rowStyle = 'border-top:1px solid #fcd34d;background:#fef9c3;border-left:4px solid #d97706;';
    }

    // สีตัวอักษรวันที่
    var dateTxtCol = (isSun||isSat) ? '#4338ca' : '#374151';

    // input disabled สำหรับวันอาทิตย์
    var disabledAttr = isSun
      ? ' disabled style="width:90px;padding:3px 4px;border:1px solid #c4b5fd;border-radius:5px;background:#ede9fe;font-family:\'Sarabun\',sans-serif;font-size:.8rem;color:#9ca3af"'
      : ' style="width:90px;padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-family:\'Sarabun\',sans-serif;font-size:.8rem"';

    // สี select สถานะ
    var selStyle = 'width:100px;padding:3px 4px;border-radius:5px;font-family:\'Sarabun\',sans-serif;font-size:.8rem;font-weight:700;';
    if (isSun)                   selStyle += 'border:1px solid #c4b5fd;background:#ddd6fe;color:#5b21b6;';
    else if (effStatus==='absent') selStyle += 'border:1px solid #f87171;background:#fee2e2;color:#b91c1c;';
    else if (effStatus==='off')    selStyle += 'border:1px solid #c084fc;background:#f3e8ff;color:#7e22ce;';
    else                           selStyle += 'border:1px solid #d1d5db;background:#fff;color:#111827;font-weight:400;';

    return '<tr style="' + rowStyle + '">' +
      '<td style="padding:5px 6px;white-space:nowrap;font-size:.82rem;color:' + dateTxtCol + ';font-weight:700">' +
        r.date + ' <span style="font-size:.76rem;font-weight:700;color:' + ((isSun||isSat)?'#4338ca':'#6b7280') + '">' + dow + '</span>' +
        (isSun ? ' <span style="font-size:.68rem;background:#7c3aed;color:#fff;padding:1px 6px;border-radius:4px;margin-left:4px">วันหยุด</span>' : '') +
      '</td>' +
      '<td style="padding:4px 4px">' +
        '<select id="eat_st_'+i+'" ' + (isSun?'disabled ':'') + 'style="'+selStyle+'">' +
          '<option value="present"'+(effStatus==='present'?' selected':'')+'>มา</option>' +
          '<option value="absent"'+(effStatus==='absent'?' selected':'')+'>ขาด</option>' +
          '<option value="off"'+(effStatus==='off'?' selected':'')+'>หยุด/ลา</option>' +
          '<option value="holiday"'+(effStatus==='holiday'?' selected':'')+'>วันหยุด</option>' +
        '</select>' +
      '</td>' +
      '<td style="padding:4px 4px"><input id="eat_ci_'+i+'" type="time" value="'+(r.clockIn||'')+'"' + disabledAttr + '></td>' +
      '<td style="padding:4px 4px"><input id="eat_ls_'+i+'" type="time" value="'+(r.lastScan||'')+'"' + disabledAttr + '></td>' +
      '<td style="padding:4px 4px"><input id="eat_lm_'+i+'" type="number" min="0" value="'+(r.lateMin||0)+'" ' + (isSun?'disabled ':'') + 'style="width:60px;padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-family:\'Sarabun\',sans-serif;font-size:.8rem;text-align:center"></td>' +
      '<td style="padding:4px 4px"><input id="eat_ot_'+i+'" type="number" min="0" step="0.5" value="'+(r.otHours||0)+'" style="width:60px;padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-family:\'Sarabun\',sans-serif;font-size:.8rem;text-align:center"></td>' +
      '<td style="padding:4px 4px"><input id="eat_on_'+i+'" type="text" value="'+(r.otNote||'')+'" placeholder="หมายเหตุ OT" style="width:100px;padding:3px 4px;border:1px solid #d1d5db;border-radius:5px;font-family:\'Sarabun\',sans-serif;font-size:.78rem"></td>' +
    '</tr>';
  }).join('');

  var popHtml =
    '<div style="font-family:\'Sarabun\',sans-serif;font-size:.85rem">' +
    '<div style="font-weight:700;font-size:1rem;color:#1e3a5f;margin-bottom:10px">✏️ แก้ไขเวลางาน — ' + name + '</div>' +
    '<div style="overflow-x:auto;max-height:65vh;overflow-y:auto">' +
    '<table style="width:100%;border-collapse:collapse;min-width:580px">' +
    '<thead><tr style="background:#1e3a5f;color:#fff;position:sticky;top:0;z-index:1">' +
      '<th style="padding:6px 6px;text-align:left;font-size:.76rem">วันที่</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">สถานะ</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">เข้า</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">ออก</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">สาย(น.)</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">OT(ชม.)</th>' +
      '<th style="padding:6px 4px;font-size:.76rem">หมายเหตุ OT</th>' +
    '</tr></thead>' +
    '<tbody>' + tableRows + '</tbody>' +
    '</table></div></div>';

  Swal.fire({
    title: '',
    html: popHtml,
    width: '780px',
    showCancelButton: true,
    confirmButtonText: '💾 บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#4f46e5',
    focusConfirm: false,
    preConfirm: function() {
      // รวบ rows ที่แก้แล้ว
      var updated = recs.map(function(r, i) {
        var dowIdx = parseInt(r.dow) || 0;
        var isSun  = dowIdx === 0;
        var stEl   = document.getElementById('eat_st_'+i);
        var ciEl   = document.getElementById('eat_ci_'+i);
        var lsEl   = document.getElementById('eat_ls_'+i);
        var lmEl   = document.getElementById('eat_lm_'+i);
        return Object.assign({}, r, {
          status:   isSun ? 'holiday' : (stEl ? stEl.value : r.status),
          clockIn:  isSun ? '' : (ciEl ? ciEl.value : r.clockIn),
          lastScan: isSun ? '' : (lsEl ? lsEl.value : r.lastScan),
          lateMin:  isSun ? 0  : (parseFloat(lmEl ? lmEl.value : 0) || 0),
          otHours:  parseFloat(document.getElementById('eat_ot_'+i).value) || 0,
          otNote:   document.getElementById('eat_on_'+i).value.trim(),
        });
      });
      return updated;
    }
  }).then(function(result) {
    if (!result.isConfirmed) return;
    var updatedRows = result.value;
    Swal.fire({ title: '⏳ กำลังบันทึก...', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });
    _hrPOST('saveHRAttendance', { rows: updatedRows }).then(function(r) {
      Swal.close();
      if (r.status === 'ok') {
        // อัปเดต _hrAtt ใน memory ด้วย
        updatedRows.forEach(function(ur) {
          var idx = _hrAtt.findIndex(function(a) { return String(a.empId)===String(ur.empId) && a.date===ur.date; });
          if (idx >= 0) _hrAtt[idx] = ur; else _hrAtt.push(ur);
        });
        Swal.fire({ icon:'success', title:'✅ บันทึกสำเร็จ', text:'อัปเดต '+updatedRows.length+' รายการ', timer:1600, showConfirmButton:false })
          .then(function() { _hrLoadAndRender(); });
      } else {
        Swal.fire('❌ ผิดพลาด', r.message || 'ไม่ทราบสาเหตุ', 'error');
      }
    }).catch(function(e) { Swal.close(); Swal.fire('❌ Error', String(e), 'error'); });
  });
}

// ══════════════════════════════════════════════════════════════
// PAYSLIP — สลิปเงินเดือน
// ══════════════════════════════════════════════════════════════
function hrOpenPayslip(empId, month, period) {
  period = period || 'all';
  const emp     = _hrEmps.find(function(e) { return String(e.empId) === String(empId); });
  // รวบรวม att ทั้งหมดของพนักงานที่โหลดไว้ (อาจมีหลายเดือนถ้า p2)
  const allAtt  = _hrAtt.filter(function(r) { return String(r.empId) === String(empId); });
  const att     = _hrFilterByPeriod(allAtt, period, month);

  if (!att.length) {
    Swal.fire('⚠️', 'ไม่พบข้อมูลเวลางานของพนักงานนี้ในงวดที่เลือก — กรุณาโหลดข้อมูลก่อน', 'warning');
    return;
  }

  const payslip = _hrCalcPayslip(emp, att, month, period);
  const html    = _hrSlipHtml(payslip);

  const win = window.open('', '_blank');
  if (!win) { Swal.fire('❌', 'ไม่สามารถเปิดหน้าต่างได้ — กรุณาอนุญาต popup', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

function _hrCalcPayslip(emp, att, month, period) {
  period = period || 'all';
  const pc        = _hrPayCfg();
  const empCycle  = (emp && emp.payCycle) || 'default';
  const isSemi    = empCycle === 'semi' || (empCycle === 'default' && pc.mode === 'semi');
  const isPeriod  = isSemi && (period === 'p1' || period === 'p2');

  const workDays  = att.filter(function(r) { return r.status !== 'off'; }).length;
  const present   = att.filter(function(r) { return r.status === 'present'; }).length;
  const absent    = att.filter(function(r) { return r.status === 'absent'; }).length;
  const lateRows  = att.filter(function(r) { return (parseInt(r.lateMin) || 0) > 0; });
  const lateTimes = lateRows.length;
  const lateMins  = lateRows.reduce(function(a, r) { return a + (parseInt(r.lateMin) || 0); }, 0);

  let otWDH = 0, otSunH = 0;
  att.forEach(function(r) {
    const ot   = parseFloat(r.otHours) || 0;
    const rate = parseFloat(r.otRate)  || 1;
    if (rate >= 2) otSunH += ot; else otWDH += ot;
  });
  otWDH  = Math.round(otWDH  * 10) / 10;
  otSunH = Math.round(otSunH * 10) / 10;

  const salary    = parseFloat((emp && emp.salary)    || 0);
  const dailyRate = parseFloat((emp && emp.dailyRate) || 0);
  const otRateWD  = parseFloat((emp && emp.otRateWD)  || 100);
  const otRateSun = parseFloat((emp && emp.otRateSun) || 200);
  const type      = (emp && emp.type) || 'monthly';

  // label งวด
  var periodLabel = '';
  if (isPeriod) {
    var pDef = period === 'p1' ? pc.p1 : pc.p2;
    var mp = month.split('-').map(Number); // [ceYear, ceMonth]
    if (period === 'p1') {
      var beM = mp[1] + 543 - 543; // ใช้ ceMonth
      periodLabel = 'งวด 1 วันที่ '+pDef.start+'-'+pDef.end+' '+_CAL_MONTHS[mp[1]-1]+' '+(mp[0]+543);
    } else {
      var pM2 = mp[1]===1?12:mp[1]-1;
      periodLabel = 'งวด 2 วันที่ '+pDef.start+' '+_CAL_MONTHS[pM2-1]+' – '+pDef.end+' '+_CAL_MONTHS[mp[1]-1]+' '+(mp[0]+543);
    }
  }

  let basePay = 0, absentDeduct = 0;
  if (type === 'daily') {
    basePay = dailyRate * present;
  } else {
    basePay = isPeriod ? salary / 2 : salary;
    if (workDays > 0 && absent > 0) absentDeduct = (basePay / (workDays + absent)) * absent;
  }

  const otPayWD  = otWDH  * otRateWD;
  const otPaySun = otSunH * otRateSun;
  const gross    = basePay + otPayWD + otPaySun;
  const net      = gross - absentDeduct;

  return {
    empId: (emp && emp.empId) || '',
    name:  (emp && emp.name)  || (att[0] && (att[0].empName || att[0].name)) || '',
    dept:  (emp && emp.dept)  || (att[0] && att[0].dept) || '',
    position: (emp && emp.position) || '',
    type:  type,
    month: month, monthLabel: _hrMLab(month), periodLabel: periodLabel,
    workDays: workDays, present: present, absent: absent,
    lateTimes: lateTimes, lateMins: lateMins,
    otWDH: otWDH, otSunH: otSunH,
    salary: salary, dailyRate: dailyRate, otRateWD: otRateWD, otRateSun: otRateSun,
    basePay: basePay, otPayWD: otPayWD, otPaySun: otPaySun,
    absentDeduct: absentDeduct, gross: gross, net: net,
  };
}

function _hrSlipHtml(p) {
  var _slipCo = {}; try { _slipCo = JSON.parse(localStorage.getItem('ptts_company_cfg')||'{}'); } catch(e){}
  const company  = _slipCo.name || localStorage.getItem('ptts_company_name') || 'PTTS SMART FACTORY';
  const now      = new Date();
  const printDt  = _hrDMY(now);
  const safeId   = String(p.empId || '').replace(/[^a-zA-Z0-9]/g, '');
  const safeMon  = String(p.month || '').replace(/[^0-9-]/g, '');

  const earningsRows = [
    [p.type === 'daily'
      ? 'ค่าแรงรายวัน (' + p.present + ' วัน × ฿' + _hrFmt(p.dailyRate) + ')'
      : 'เงินเดือน', p.basePay],
    p.otWDH  > 0 ? ['OT ปกติ (' + p.otWDH  + ' ชม. × ฿' + _hrFmt(p.otRateWD)  + ')', p.otPayWD]  : null,
    p.otSunH > 0 ? ['OT อาทิตย์ (' + p.otSunH + ' ชม. × ฿' + _hrFmt(p.otRateSun) + ')', p.otPaySun] : null,
  ].filter(Boolean);

  const deductRows = p.absentDeduct > 0
    ? [['ขาดงาน ' + p.absent + ' วัน', -p.absentDeduct]]
    : [];

  function row(label, val, bold) {
    return '<tr><td style="padding:7px 16px;' + (bold ? 'font-weight:700;color:#1e293b' : 'color:#374151') + '">' + label + '</td>' +
      '<td style="padding:7px 16px;text-align:right;' + (val < 0 ? 'color:#dc2626' : bold ? 'color:#1e293b' : 'color:#374151') + ';' + (bold ? 'font-weight:700' : '') + '">' +
      (val < 0 ? '−' : '') + ' ฿' + _hrFmt(Math.abs(val)) + '</td></tr>';
  }

  return '<!DOCTYPE html><html lang="th"><head>\n' +
'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'<title>สลิปเงินเดือน — ' + p.name + '</title>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">\n' +
'<style>\n' +
'* { margin:0; padding:0; box-sizing:border-box; }\n' +
'body { font-family:\'Sarabun\',sans-serif; background:#f1f5f9; display:flex; flex-direction:column; align-items:center; padding:16px 12px 40px; min-height:100vh; }\n' +
'.slip { background:#fff; border-radius:16px; width:100%; max-width:460px; box-shadow:0 4px 24px rgba(0,0,0,.12); overflow:hidden; margin-top:10px; }\n' +
'.top { background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%); padding:22px 20px 18px; color:#fff; text-align:center; }\n' +
'.top .co { font-size:.72rem; opacity:.8; letter-spacing:1px; text-transform:uppercase; }\n' +
'.top h1 { font-size:1.3rem; font-weight:800; margin:4px 0 2px; }\n' +
'.top .mo { font-size:.86rem; opacity:.9; }\n' +
'.emp-grid { display:grid; grid-template-columns:1fr 1fr; padding:12px 16px; background:#f8fafc; border-bottom:1px solid #e2e8f0; gap:8px; }\n' +
'.emp-cell label { font-size:.68rem; color:#94a3b8; display:block; margin-bottom:1px; }\n' +
'.emp-cell span { font-size:.86rem; font-weight:600; color:#1e293b; }\n' +
'.sec-head { padding:7px 16px; background:#f1f5f9; font-size:.68rem; font-weight:700; color:#64748b; letter-spacing:.8px; text-transform:uppercase; border-top:1px solid #e2e8f0; }\n' +
'table { width:100%; border-collapse:collapse; }\n' +
'table td { border-bottom:1px solid #f1f5f9; }\n' +
'.tot-row td { background:#f8fafc; border-bottom:2px solid #e2e8f0 !important; }\n' +
'.net-row td { background:linear-gradient(135deg,#059669,#10b981); color:#fff !important; font-weight:800 !important; font-size:1.05rem; padding:14px 16px !important; border:none !important; }\n' +
'.att-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:12px 16px; }\n' +
'.ac { text-align:center; padding:6px 4px; background:#f8fafc; border-radius:8px; }\n' +
'.ac .v { font-size:1.1rem; font-weight:800; }\n' +
'.ac .l { font-size:.65rem; color:#94a3b8; margin-top:1px; }\n' +
'.sig-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:14px 16px 8px; }\n' +
'.sig .line { border-bottom:1px solid #cbd5e1; height:28px; }\n' +
'.sig .lbl { font-size:.7rem; color:#94a3b8; text-align:center; margin-top:4px; }\n' +
'.footer { padding:10px 16px; font-size:.68rem; color:#94a3b8; border-top:1px solid #f1f5f9; text-align:center; }\n' +
'.action-bar { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; max-width:460px; width:100%; }\n' +
'.btn { padding:10px 20px; border-radius:10px; font-family:\'Sarabun\',sans-serif; font-size:.88rem; font-weight:700; cursor:pointer; border:none; }\n' +
'.bp { background:#3b82f6; color:#fff; }\n' +
'.bs { background:#059669; color:#fff; }\n' +
'.bl { background:#00c300; color:#fff; }\n' +
'@media print { body { background:#fff; padding:0; } .slip { box-shadow:none; border-radius:0; max-width:100%; margin:0; } .action-bar { display:none; } }\n' +
'</style></head><body>\n' +
'<div class="action-bar">' +
  '<button class="btn bp" onclick="window.print()">🖨 พิมพ์</button>' +
  '<button class="btn bs" onclick="hrSaveImg()">💾 บันทึกภาพ</button>' +
  '<button class="btn bl" onclick="hrShareLINE()">💚 แชร์ LINE</button>' +
'</div>\n' +
'<div class="slip" id="slipCard">\n' +
  '<div class="top">' +
    '<div class="co">' + company + '</div>' +
    '<h1>สลิปเงินเดือน</h1>' +
    '<div class="mo">' + (p.periodLabel ? p.periodLabel : 'ประจำเดือน ' + p.monthLabel) + '</div>' +
  '</div>\n' +
  '<div class="emp-grid">' +
    '<div class="emp-cell"><label>ชื่อ-สกุล</label><span>' + p.name + '</span></div>' +
    '<div class="emp-cell"><label>รหัสพนักงาน</label><span>' + (p.empId || '—') + '</span></div>' +
    '<div class="emp-cell"><label>แผนก</label><span>' + (p.dept || '—') + '</span></div>' +
    '<div class="emp-cell"><label>ตำแหน่ง</label><span>' + (p.position || '—') + '</span></div>' +
  '</div>\n' +
  '<div class="sec-head">สรุปการเข้างาน</div>' +
  '<div class="att-grid">' +
    '<div class="ac"><div class="v" style="color:#059669">' + p.present + '</div><div class="l">วันมา</div></div>' +
    '<div class="ac"><div class="v" style="color:#dc2626">' + p.absent + '</div><div class="l">วันขาด</div></div>' +
    '<div class="ac"><div class="v" style="color:#d97706">' + p.lateTimes + '</div><div class="l">ครั้งสาย<br>' + p.lateMins + ' น.</div></div>' +
    '<div class="ac"><div class="v" style="color:#7c3aed">' + p.otWDH + '</div><div class="l">OT ปกติ<br>ชม.</div></div>' +
    '<div class="ac"><div class="v" style="color:#d97706">' + p.otSunH + '</div><div class="l">OT อาทิตย์<br>ชม.</div></div>' +
    '<div class="ac"><div class="v" style="color:#1e293b">' + p.workDays + '</div><div class="l">วันทำงาน</div></div>' +
  '</div>\n' +
  '<div class="sec-head">รายได้</div>' +
  '<table>' + earningsRows.map(function(r) { return row(r[0], r[1], false); }).join('') +
    '<tr class="tot-row">' + row('รวมรายได้', p.gross, true).slice(4, -5) + '</tr>' +
  '</table>\n' +
  (deductRows.length
    ? '<div class="sec-head">รายการหัก</div><table>' +
      deductRows.map(function(r) { return row(r[0], r[1], false); }).join('') +
      '<tr class="tot-row">' + row('รวมหัก', -p.absentDeduct, true).slice(4, -5) + '</tr>' +
      '</table>\n'
    : '') +
  '<table><tr class="net-row"><td>💰 รับสุทธิ</td><td style="text-align:right">฿' + _hrFmt(p.net) + '</td></tr></table>\n' +
  '<div class="sig-row"><div class="sig"><div class="line"></div><div class="lbl">ลายเซ็นผู้รับเงิน</div></div>' +
    '<div class="sig"><div class="line"></div><div class="lbl">วันที่รับเงิน</div></div></div>\n' +
  '<div class="footer">พิมพ์เมื่อ ' + printDt + ' | ขอสงวนสิทธิ์ตรวจสอบย้อนหลัง</div>' +
'</div>\n' +
'<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>\n' +
'<script>\n' +
'async function hrSaveImg() {\n' +
'  try {\n' +
'    const canvas = await html2canvas(document.getElementById("slipCard"),{scale:2,useCORS:true,backgroundColor:"#fff"});\n' +
'    const blob = await new Promise(function(r){canvas.toBlob(r,"image/png");});\n' +
'    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);\n' +
'    a.download="payslip_' + safeId + '_' + safeMon + '.png"; a.click();\n' +
'  } catch(e) { alert("ไม่สามารถบันทึกภาพได้: "+e.message); }\n' +
'}\n' +
'async function hrShareLINE() {\n' +
'  try {\n' +
'    const canvas = await html2canvas(document.getElementById("slipCard"),{scale:2,useCORS:true,backgroundColor:"#fff"});\n' +
'    const blob = await new Promise(function(r){canvas.toBlob(r,"image/png");});\n' +
'    const file = new File([blob],"payslip_' + (p.name || 'emp') + '.png",{type:"image/png"});\n' +
'    if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {\n' +
'      await navigator.share({files:[file],title:"สลิปเงินเดือน ' + (p.name || '') + ' ' + (p.monthLabel || '') + '"});\n' +
'    } else {\n' +
'      const a = document.createElement("a"); a.href=URL.createObjectURL(blob);\n' +
'      a.download="payslip.png"; a.click();\n' +
'      setTimeout(function(){alert("บันทึกภาพแล้ว — เปิด LINE แล้วส่งรูปให้พนักงาน");},600);\n' +
'    }\n' +
'  } catch(e) { alert("ไม่สามารถแชร์ได้: "+e.message); }\n' +
'}\n' +
'(function(){\n' +
'  function go(){try{window.focus();}catch(e){}}\n' +
'  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go);}else{setTimeout(go,700);}\n' +
'})();\n' +
'<\/script>\n' +
'</body></html>';
}
