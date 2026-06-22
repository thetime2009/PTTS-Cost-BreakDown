// ══════════════════════════════════════════════════════════════
// hr.js v1.0  —  HR Module
// นำเข้าข้อมูลสแกนหน้า | สรุปเวลางาน | พนักงาน | ตั้งค่า | สลิปเงินเดือน
// ══════════════════════════════════════════════════════════════

/* global Swal, SCRIPT_URL */

// ── State ─────────────────────────────────────────────────────
let _hrS       = null;   // settings cache (from localStorage)
let _hrEmps    = [];     // [{empId,name,dept,position,type,salary,dailyRate,otRateWD,otRateSun}]
let _hrAtt     = [];     // attendance rows (loaded per month)
let _hrPreview = [];     // parsed import rows before confirm
let _hrSubCur  = '1';   // active sub-tab
let _hrSumMon  = '';    // 'YYYY-MM' viewing in summary

const HR_LS  = 'ptts_hr_settings';
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
  ['1', '2', '3', '4'].forEach(function(k) {
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

  if (_hrEmps.length) {
    _doFilter();
  } else {
    // โหลด employees ก่อน แล้วค่อยกรอง
    _hrGET('getHREmployees').then(function(res) {
      _hrEmps = res.data || [];
      _doFilter();
    }).catch(function() {
      // ถ้าโหลดไม่ได้ → นำเข้าทั้งหมดแบบไม่กรอง
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

        const calc = _hrCalcDay(clockIn, lastScan, dow, s);

        result.push(Object.assign({
          empId: empId, empName: empName, dept: dept, period: period,
          date: _hrDMY(date), dow: dow,
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

function _hrCalcDay(clockIn, lastScan, dow, s) {
  const isAbsent = !clockIn;

  // วันอาทิตย์ ไม่มี scan = หยุด
  if (isAbsent && dow === 0) return { status: 'off',    lateMin: 0, otHours: 0, otRate: s.sunRate || 2 };
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

          // แถวอาทิตย์ไฮไลต์เด่นชัด
          var rowBg = isSun
            ? 'background:rgba(248,113,113,.13);border-left:3px solid #f87171;'
            : (hasRowOT ? 'background:rgba(129,140,248,.06);' : '');

          return '<tr style="border-top:1px solid var(--bc-input);' + rowBg + '">' +
            '<td style="padding:3px 8px' + (isSun ? ';font-weight:700;color:#f87171' : '') + '">' + dLabel + '</td>' +
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
                  ? '<input type="text" id="' + noteId + '" placeholder="เช่น ซ่อมเครื่อง, ปิดงานด่วน..." style="width:100%;min-width:150px;padding:3px 7px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-family:Sarabun,sans-serif;font-size:.74rem">'
                  : '') + '</td>'
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

  var calc     = _hrCalcDay(clockIn, lastScan, dow, s);
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
    noteWrap.innerHTML = hasRowOT
      ? '<input type="text" id="otnote_' + safeId + '_' + dateKey + '" placeholder="เช่น ซ่อมเครื่อง, ปิดงานด่วน..." style="width:100%;min-width:150px;padding:3px 7px;border-radius:5px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;font-family:Sarabun,sans-serif;font-size:.74rem">'
      : '';
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
      '<button onclick="_hrLoadAndRender()" style="padding:6px 16px;border-radius:8px;background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.4);cursor:pointer;font-size:.82rem;font-family:\'Sarabun\',sans-serif">🔄 โหลดข้อมูล</button>' +
    '</div>' +
    '<div id="hrSumTable"><div style="color:var(--t3);font-size:.85rem">กด 🔄 โหลดข้อมูล</div></div>' +
    '</div>';
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

  Promise.all([
    _hrGET('getHRAttendance', { month: _hrSumMon }),
    _hrGET('getHREmployees')
  ]).then(function(results) {
    _hrAtt  = results[0].data || [];
    _hrEmps = results[1].data || [];
    const filtered = _hrAtt.filter(function(r) { return _hrMKey(r.date) === _hrSumMon; });
    tbl.innerHTML = _hrSumTableHtml(filtered);
  }).catch(function(e) {
    tbl.innerHTML = '<div style="color:#f87171;font-size:.85rem">❌ ' + e + '</div>';
  });
}

function _hrSumTableHtml(rows) {
  if (!rows.length) {
    return '<div style="color:var(--t3);font-size:.85rem">ไม่พบข้อมูลเดือน ' + _hrMLab(_hrSumMon) + ' — กรุณานำเข้าข้อมูลก่อน</div>';
  }

  const emp = {};
  rows.forEach(function(r) {
    if (!emp[r.empId]) emp[r.empId] = { name: r.empName || r.name, dept: r.dept, present: 0, absent: 0, off: 0, lateTimes: 0, lateMin: 0, otWD: 0, otSun: 0 };
    const e  = emp[r.empId];
    const st = r.status;
    if (st === 'present') e.present++;
    else if (st === 'absent') e.absent++;
    else e.off++;
    if ((parseInt(r.lateMin) || 0) > 0) { e.lateTimes++; e.lateMin += parseInt(r.lateMin) || 0; }
    const ot   = parseFloat(r.otHours) || 0;
    const rate = parseFloat(r.otRate) || 1;
    if (rate >= 2) e.otSun += ot; else e.otWD += ot;
  });

  let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
    '<thead><tr style="background:rgba(99,102,241,.12);font-weight:700">' +
      '<th style="padding:8px 10px;text-align:left">พนักงาน</th>' +
      '<th style="text-align:center">แผนก</th>' +
      '<th style="text-align:center">มา</th>' +
      '<th style="text-align:center">ขาด</th>' +
      '<th style="text-align:center">สาย</th>' +
      '<th style="text-align:center">OT ปกติ</th>' +
      '<th style="text-align:center">OT อาทิตย์</th>' +
      '<th style="text-align:center">สลิป</th>' +
    '</tr></thead><tbody>';

  Object.keys(emp).forEach(function(id) {
    const e = emp[id];
    html += '<tr style="border-top:1px solid var(--bc-input)">' +
      '<td style="padding:7px 10px;font-weight:600">' + e.name + '</td>' +
      '<td style="text-align:center;font-size:.76rem;color:var(--t3)">' + (e.dept || '') + '</td>' +
      '<td style="text-align:center;color:#34d399;font-weight:700">' + e.present + '</td>' +
      '<td style="text-align:center;color:' + (e.absent > 0 ? '#f87171' : 'var(--t3)') + '">' + e.absent + '</td>' +
      '<td style="text-align:center;color:' + (e.lateMin > 0 ? '#fbbf24' : 'var(--t3)') + ';font-size:.78rem">' + e.lateTimes + 'ครั้ง<br>' + e.lateMin + 'น.</td>' +
      '<td style="text-align:center;color:#818cf8">' + e.otWD.toFixed(1) + '</td>' +
      '<td style="text-align:center;color:#f59e0b">' + e.otSun.toFixed(1) + '</td>' +
      '<td style="text-align:center">' +
        '<button onclick="hrOpenPayslip(\'' + id + '\',\'' + _hrSumMon + '\')" ' +
          'style="padding:4px 12px;background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.4);border-radius:7px;cursor:pointer;font-family:\'Sarabun\',sans-serif;font-size:.78rem">' +
          '🧾 สลิป' +
        '</button>' +
      '</td>' +
    '</tr>';
  });

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
      '<div style="margin-bottom:10px"><label style="font-size:.76rem;color:var(--t3);display:block;margin-bottom:3px">ประเภท</label>' +
        '<select id="empFType" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--bc-input);background:var(--card);color:var(--t1);font-family:\'Sarabun\',sans-serif;box-sizing:border-box">' +
          '<option value="monthly"' + (emp && emp.type !== 'daily' ? ' selected' : '') + '>รายเดือน</option>' +
          '<option value="daily"' + (emp && emp.type === 'daily' ? ' selected' : '') + '>รายวัน</option>' +
        '</select></div>' +
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
    '</div>';
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
// PAYSLIP — สลิปเงินเดือน
// ══════════════════════════════════════════════════════════════
function hrOpenPayslip(empId, month) {
  const emp = _hrEmps.find(function(e) { return String(e.empId) === String(empId); });
  const att = _hrAtt.filter(function(r) { return String(r.empId) === String(empId) && _hrMKey(r.date) === month; });

  if (!att.length) {
    Swal.fire('⚠️', 'ไม่พบข้อมูลเวลางานของพนักงานนี้ — กรุณาโหลดข้อมูลก่อน', 'warning');
    return;
  }

  const payslip = _hrCalcPayslip(emp, att, month);
  const html    = _hrSlipHtml(payslip);

  const win = window.open('', '_blank');
  if (!win) { Swal.fire('❌', 'ไม่สามารถเปิดหน้าต่างได้ — กรุณาอนุญาต popup', 'error'); return; }
  win.document.write(html);
  win.document.close();
}

function _hrCalcPayslip(emp, att, month) {
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

  let basePay = 0, absentDeduct = 0;
  if (type === 'daily') {
    basePay = dailyRate * present;
  } else {
    basePay = salary;
    if (workDays > 0 && absent > 0) absentDeduct = (salary / workDays) * absent;
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
    month: month, monthLabel: _hrMLab(month),
    workDays: workDays, present: present, absent: absent,
    lateTimes: lateTimes, lateMins: lateMins,
    otWDH: otWDH, otSunH: otSunH,
    salary: salary, dailyRate: dailyRate, otRateWD: otRateWD, otRateSun: otRateSun,
    basePay: basePay, otPayWD: otPayWD, otPaySun: otPaySun,
    absentDeduct: absentDeduct, gross: gross, net: net,
  };
}

function _hrSlipHtml(p) {
  const company  = localStorage.getItem('ptts_company_name') || 'PTTS SMART FACTORY';
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
    '<div class="mo">ประจำเดือน ' + p.monthLabel + '</div>' +
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
