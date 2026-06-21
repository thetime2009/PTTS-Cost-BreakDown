// ══════════════════════════════════════════════════════════════
// stock.js — MAT Stock Control  (tab-stock)
// ══════════════════════════════════════════════════════════════

let _stockRows      = [];   // [{ matCode, matName, unit, stockQty, minStock, orderQty, suppCode, lastUpdated }]
let _stockMovement  = [];   // [{ date, matCode, type, qty, stockAfter, ref, note, by }]
let _stockEditCode  = null; // matCode กำลัง edit อยู่ (null = new)
let _stockViewCode  = null; // matCode ที่กำลังดู movement

// ── utils ─────────────────────────────────────────────────────
function _stockUrl() { return typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : (localStorage.getItem('ptts_script_url') || ''); }

function _stockStatus(row) {
  // คืน 'critical' | 'low' | 'ok'
  if (!row.minStock || row.minStock <= 0) return 'ok';
  if (row.stockQty <= 0)                  return 'critical';
  if (row.stockQty < row.minStock)        return 'critical';
  if (row.stockQty < row.minStock * 1.5)  return 'low';
  return 'ok';
}

function _stockLeadDate(suppCode) {
  // หา leadTimeDays จาก _supplierCache (purchase.js) แล้วบวกกับวันนี้
  if (typeof _supplierCache === 'undefined') return '';
  var sup = _supplierCache.find(function(s){ return s.code === suppCode; });
  if (!sup || !sup.leadTimeDays) return '';
  var d = new Date();
  d.setDate(d.getDate() + Number(sup.leadTimeDays));
  return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
}

// ── Load ──────────────────────────────────────────────────────
// ── Background load (ไม่ render table — แค่อัป badge) ───────
async function _stockBgLoad() {
  var url = _stockUrl();
  if (!url) return;
  try {
    // โหลด supplier ก่อนถ้ายังว่าง (ต้องการชื่อร้านแสดงในตาราง)
    if (typeof _supplierCache !== 'undefined' && !_supplierCache.length && typeof fetchSuppliers === 'function') {
      await fetchSuppliers();
    }
    var res = await fetch(url + '?action=getMatStock', { mode:'cors' });
    var d   = await res.json();
    _stockRows = d.rows || [];
    _stockUpdateBadge();
  } catch(e) { console.warn('_stockBgLoad', e); }
}


async function stockLoad() {
  var url = _stockUrl();
  if (!url) { _stockRenderDash(); return; }
  try {
    // โหลด supplier ก่อนถ้ายังว่าง — ต้องใช้ชื่อร้านในตาราง
    if (typeof _supplierCache !== 'undefined' && !_supplierCache.length && typeof fetchSuppliers === 'function') {
      await fetchSuppliers();
    }
    var res = await fetch(url + '?action=getMatStock', { mode:'cors' });
    var d   = await res.json();
    _stockRows = d.rows || [];
  } catch(e) { console.error('stockLoad', e); }
  _stockRenderDash();
  _stockRenderTable();
  _stockRenderReorder();
}

// ── Dashboard ─────────────────────────────────────────────────
function _stockRenderDash() {
  var el = document.getElementById('_stockDash');
  if (!el) return;

  var critical = _stockRows.filter(function(r){ return _stockStatus(r) === 'critical'; });
  var low      = _stockRows.filter(function(r){ return _stockStatus(r) === 'low'; });
  var ok       = _stockRows.filter(function(r){ return _stockStatus(r) === 'ok'; });

  var urgentHtml = '';
  if (critical.length) {
    urgentHtml = '<div style="margin-top:12px"><div style="font-size:.72rem;font-weight:800;color:#f87171;letter-spacing:.06em;margin-bottom:6px">⚠ ต้องสั่งด่วน</div>' +
      critical.map(function(r){
        var lead = _stockLeadDate(r.suppCode);
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.22);border-radius:8px;margin-bottom:5px">' +
          '<span style="font-size:.85rem">🔴</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:.8rem;color:var(--t1)">' + r.matCode + (r.matName ? ' <span style="font-weight:400;color:var(--t2)">— ' + r.matName + '</span>' : '') + '</div>' +
            '<div style="font-size:.72rem;color:#f87171">คงเหลือ <strong>' + r.stockQty + '</strong> ' + r.unit + ' / ขั้นต่ำ ' + r.minStock + ' ' + r.unit + (lead ? ' · ต้องสั่งภายใน <strong>' + lead + '</strong>' : '') + '</div>' +
          '</div>' +
          '<button onclick="stockOpenForm(\'' + r.matCode + '\')" style="flex:none;font-size:.7rem;padding:3px 10px;border-radius:6px;border:1px solid rgba(220,38,38,.4);background:transparent;color:#f87171;cursor:pointer">แก้ไข</button>' +
        '</div>';
      }).join('') + '</div>';
  }

  var lowHtml = '';
  if (low.length) {
    lowHtml = '<div style="margin-top:10px"><div style="font-size:.72rem;font-weight:800;color:#fbbf24;letter-spacing:.06em;margin-bottom:6px">⚡ ใกล้จะหมด</div>' +
      low.map(function(r){
        var lead = _stockLeadDate(r.suppCode);
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.2);border-radius:8px;margin-bottom:5px">' +
          '<span style="font-size:.85rem">🟡</span>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:.8rem;color:var(--t1)">' + r.matCode + (r.matName ? ' <span style="font-weight:400;color:var(--t2)">— ' + r.matName + '</span>' : '') + '</div>' +
            '<div style="font-size:.72rem;color:#fbbf24">คงเหลือ <strong>' + r.stockQty + '</strong> ' + r.unit + ' / ขั้นต่ำ ' + r.minStock + ' ' + r.unit + (lead ? ' · ควรสั่งภายใน <strong>' + lead + '</strong>' : '') + '</div>' +
          '</div>' +

        '</div>';
      }).join('') + '</div>';
  }

  _stockUpdateBadge();
  el.innerHTML =
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">' +
      _stockStatChip('🔴', 'วิกฤต', critical.length, '#dc2626', 'rgba(220,38,38,.1)', 'rgba(220,38,38,.3)') +
      _stockStatChip('🟡', 'ใกล้หมด', low.length, '#d97706', 'rgba(251,191,36,.1)', 'rgba(251,191,36,.3)') +
      _stockStatChip('🟢', 'ปกติ', ok.length, '#16a34a', 'rgba(22,163,74,.08)', 'rgba(22,163,74,.25)') +
      _stockStatChip('📦', 'ทั้งหมด', _stockRows.length, 'var(--t2)', 'var(--c1-05)', 'var(--bc-div)') +
    '</div>' +
    urgentHtml + lowHtml +
    (!critical.length && !low.length && _stockRows.length
      ? '<div style="margin-top:10px;padding:10px 14px;background:rgba(22,163,74,.07);border:1px solid rgba(22,163,74,.2);border-radius:8px;font-size:.8rem;color:#16a34a">✅ วัสดุทุกรายการอยู่ในระดับปกติ</div>'
      : ''
    );
}

function _stockStatChip(icon, label, count, color, bg, border) {
  return '<div style="display:flex;align-items:center;gap:10px;padding:14px 22px;background:' + bg + ';border:2px solid ' + border + ';border-radius:14px;min-width:110px">' +
    '<span style="font-size:1.6rem;line-height:1">' + icon + '</span>' +
    '<div><div style="font-size:2rem;font-weight:900;color:' + color + ';line-height:1;letter-spacing:-.02em">' + count + '</div>' +
    '<div style="font-size:.75rem;font-weight:600;color:var(--t2);margin-top:3px;letter-spacing:.01em">' + label + '</div></div>' +
  '</div>';
}

// ── ตาราง Stock รายการ ────────────────────────────────────────
// ── Group detection ──────────────────────────────────────────
function _stockGetGroup(matCode) {
  var flapArr = (typeof _localMatFlap !== 'undefined') ? _localMatFlap : [];
  var meshArr = (typeof _localMatMesh !== 'undefined') ? _localMatMesh : [];
  if (flapArr.some(function(m){ return m.code === matCode; })) return 'ฝา';
  if (meshArr.some(function(m){ return m.code === matCode; })) return 'ตะแกรง';
  return 'อื่นๆ';
}

// ── Row order (localStorage) ──────────────────────────────────
var _stockDragSrc = null;

function _stockLoadOrder() {
  try { return JSON.parse(localStorage.getItem('ptts_stock_order') || '[]') || []; } catch(e) { return []; }
}
function _stockSaveOrder(codes) {
  localStorage.setItem('ptts_stock_order', JSON.stringify(codes));
}
function _stockGetSortedRows() {
  var order = _stockLoadOrder();
  var sorted = [];
  order.forEach(function(code) {
    var r = _stockRows.find(function(x){ return x.matCode === code; });
    if (r) sorted.push(r);
  });
  _stockRows.forEach(function(r) {
    if (!sorted.find(function(x){ return x.matCode === r.matCode; })) sorted.push(r);
  });
  return sorted;
}

// ── Render Table ──────────────────────────────────────────────
function _stockRenderTable() {
  var el = document.getElementById('_stockTable');
  if (!el) return;
  if (!_stockRows.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--t3);font-size:.85rem">ยังไม่มีข้อมูล — กด ➕ เพิ่มวัสดุ</div>';
    return;
  }

  var sorted = _stockGetSortedRows();
  var groupColors = { 'ฝา':'rgba(37,99,235,.06)', 'ตะแกรง':'rgba(124,58,237,.06)', 'อื่นๆ':'rgba(100,116,139,.05)' };
  var groupIcons  = { 'ฝา':'🔵', 'ตะแกรง':'🟣', 'อื่นๆ':'⚪' };

  var bodyHtml = '';
  var lastGroup = null;

  sorted.forEach(function(r) {
    var grp = _stockGetGroup(r.matCode);
    if (grp !== lastGroup) {
      lastGroup = grp;
      bodyHtml += '<tr class="stock-grp-hdr">' +
        '<td colspan="7" style="padding:5px 12px;font-size:.7rem;font-weight:800;letter-spacing:.06em;' +
          'background:' + groupColors[grp] + ';color:var(--t3);border-top:2px solid var(--bc-div);border-bottom:1px solid var(--bc-div)">' +
          groupIcons[grp] + ' MAT-' + grp + '</td></tr>';
    }

    var st  = _stockStatus(r);
    var dot = st === 'critical' ? '#dc2626' : st === 'low' ? '#f59e0b' : '#16a34a';
    var pct = r.minStock > 0 ? Math.min(100, Math.round(r.stockQty / r.minStock * 100)) : 100;
    var lead = _stockLeadDate(r.suppCode);
    var code = r.matCode;

    bodyHtml +=
      '<tr draggable="true" data-code="' + code + '" ' +
        'ondragstart="_stockDragStart(event,\'' + code + '\')" ' +
        'ondragover="_stockDragOver(event)" ' +
        'ondragleave="_stockDragLeave(event)" ' +
        'ondrop="_stockDrop(event,\'' + code + '\')" ' +
        'style="transition:background .1s">' +
        '<td style="padding:8px 6px;width:28px;cursor:grab;color:var(--t3);font-size:1.1rem;text-align:center;user-select:none" title="ลากเพื่อเรียง">⠿</td>' +
        '<td style="padding:8px 10px">' +
          '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dot + ';margin-right:6px;vertical-align:middle"></span>' +
          '<strong style="color:var(--c1);font-size:.82rem">' + code + '</strong>' +
          (r.matName ? '<div style="font-size:.72rem;color:var(--t3);margin-left:14px">' + r.matName + '</div>' : '') +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center">' +
          '<div style="font-size:1rem;font-weight:800;color:' + dot + '">' + r.stockQty + '</div>' +
          '<div style="font-size:.68rem;color:var(--t3)">' + r.unit + '</div>' +
          '<div style="margin-top:3px;background:var(--bc-div);border-radius:4px;height:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:' + dot + ';border-radius:4px"></div>' +
          '</div>' +
        '</td>' +
        '<td style="padding:8px 10px;text-align:center;font-size:.8rem;color:var(--t2)">' + r.minStock + '<div style="font-size:.67rem;color:var(--t3)">' + r.unit + '</div></td>' +
        '<td style="padding:8px 10px;text-align:center;font-size:.8rem;color:var(--t2)">' + r.orderQty + '</td>' +
        '<td style="padding:8px 10px;font-size:.75rem;color:var(--t3)">' + (function(){
            if (!r.suppCode) return '—';
            // หาชื่อร้านจาก _supplierCache
            var suppName = '';
            if (typeof _supplierCache !== 'undefined') {
              var sup = _supplierCache.find(function(s){ return s.code === r.suppCode; });
              if (sup) suppName = sup.name || '';
            }
            var txt = '<div style="font-weight:600;color:var(--t2)">' + r.suppCode + '</div>';
            if (suppName) txt += '<div style="font-size:.7rem;color:var(--t3)">' + suppName + '</div>';
            // แสดงกำหนดสั่งเฉพาะ critical/low เท่านั้น
            if (lead && st !== 'ok') txt += '<div style="color:#f59e0b;font-size:.7rem">ถึง ' + lead + '</div>';
            return txt;
          })() + '</td>' +
        '<td style="padding:8px 6px;white-space:nowrap;text-align:right">' +
          '<button onclick="stockAdjust(\'' + code + '\',\'IN\')" style="' + _stockBtnCss('#16a34a') + '">➕ รับเข้า</button> ' +
          '<button onclick="stockAdjust(\'' + code + '\',\'OUT\')" style="' + _stockBtnCss('#ea580c') + '">➖ จ่ายออก</button> ' +
          '<button onclick="stockAdjust(\'' + code + '\',\'ADJUST\')" style="' + _stockBtnCss('#7c3aed') + '">⚙ ปรับ</button> ' +
          '<button onclick="stockViewMovement(\'' + code + '\')" style="' + _stockBtnCss('#0369a1') + '">📋</button> ' +
          '<button onclick="stockOpenForm(\'' + code + '\')" style="' + _stockBtnCss('#6366f1') + '">✏️</button> ' +
          '<button onclick="stockDeleteRow(\'' + code + '\')" style="' + _stockBtnCss('#dc2626') + '">🗑</button>' +
        '</td>' +
      '</tr>';
  });

  el.innerHTML =
    '<table style="width:100%;border-collapse:collapse;font-size:.82rem">' +
      '<thead><tr style="background:linear-gradient(to right,rgba(37,99,235,.06),rgba(124,58,237,.03))">' +
        '<th style="' + _stockThCss() + 'width:28px" title="ลากเพื่อเรียง">⠿</th>' +
        '<th style="' + _stockThCss() + '">รหัส / ชื่อ</th>' +
        '<th style="' + _stockThCss() + 'text-align:center">คงเหลือ</th>' +
        '<th style="' + _stockThCss() + 'text-align:center">ขั้นต่ำ</th>' +
        '<th style="' + _stockThCss() + 'text-align:center">สั่งครั้งละ</th>' +
        '<th style="' + _stockThCss() + '">ซัพฯ / กำหนดสั่ง</th>' +
        '<th style="' + _stockThCss() + 'text-align:right">จัดการ</th>' +
      '</tr></thead>' +
      '<tbody id="_stockTbody">' + bodyHtml + '</tbody>' +
    '</table>';
}

// ── Drag handlers ─────────────────────────────────────────────
function _stockDragStart(e, code) {
  _stockDragSrc = code;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', code);
  e.currentTarget.style.opacity = '0.45';
}
function _stockDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var tr = e.currentTarget;
  if (tr && tr.dataset && tr.dataset.code && tr.dataset.code !== _stockDragSrc)
    tr.style.borderTop = '2.5px solid var(--c1)';
}
function _stockDragLeave(e) {
  if (e.currentTarget) e.currentTarget.style.borderTop = '';
}
function _stockDrop(e, targetCode) {
  e.preventDefault();
  if (e.currentTarget) e.currentTarget.style.borderTop = '';
  var src = _stockDragSrc;
  _stockDragSrc = null;
  if (!src || src === targetCode) { _stockRenderTable(); return; }
  var sorted = _stockGetSortedRows();
  var si = sorted.findIndex(function(r){ return r.matCode === src; });
  var ti = sorted.findIndex(function(r){ return r.matCode === targetCode; });
  if (si < 0 || ti < 0) { _stockRenderTable(); return; }
  var moved = sorted.splice(si, 1)[0];
  sorted.splice(ti, 0, moved);
  _stockSaveOrder(sorted.map(function(r){ return r.matCode; }));
  _stockRenderTable();
}

function _stockThCss() { return 'padding:8px 10px;font-size:.68rem;color:var(--t2);font-weight:800;text-align:left;border-bottom:2px solid var(--bc-div);letter-spacing:.04em;'; }
function _stockBtnCss(color) { return 'font-size:.7rem;padding:3px 8px;border-radius:6px;border:1px solid ' + color.replace('#','rgba(') + ',.35);background:transparent;color:' + color + ';cursor:pointer;font-weight:600'; }


// ── Form เพิ่ม/แก้ไข Stock row ───────────────────────────────
function stockOpenForm(matCode) {
  var row = matCode ? _stockRows.find(function(r){ return r.matCode === matCode; }) : null;
  _stockEditCode = matCode || null;

  // รวม MAT จาก flap + mesh (ลบซ้ำ)
  var allMat = [];
  var seenCodes = {};
  var flapArr = (typeof _localMatFlap !== 'undefined') ? _localMatFlap : [];
  var meshArr = (typeof _localMatMesh !== 'undefined') ? _localMatMesh : [];
  flapArr.concat(meshArr).forEach(function(m) {
    if (m.code && !seenCodes[m.code]) {
      seenCodes[m.code] = true;
      allMat.push({ code: m.code, name: m.name || '' });
    }
  });
  // เพิ่ม matCode ที่อยู่ใน _stockRows แล้วแต่ไม่มีใน MAT list
  _stockRows.forEach(function(r) {
    if (r.matCode && !seenCodes[r.matCode]) {
      seenCodes[r.matCode] = true;
      allMat.push({ code: r.matCode, name: r.matName || '' });
    }
  });

  // supplier list สำหรับ datalist
  var suppArr = (typeof _supplierCache !== 'undefined' && _supplierCache.length) ? _supplierCache : [];
  var suppDatalist = suppArr.map(function(s){
    return '<option value="' + s.code + '">' + s.name + (s.code ? ' (' + s.code + ')' : '') + '</option>';
  }).join('');

  var unitOpts = ['แผ่น','kg','ม้วน','เมตร','ชิ้น','กล่อง'].map(function(u){
    return '<option value="' + u + '"' + (row && row.unit === u ? ' selected' : '') + '>' + u + '</option>';
  }).join('');

  // ถ้าแก้ไข row เดิม → ล็อค code / ถ้าเพิ่มใหม่ → แสดง searchable list
  var codeField;
  if (row) {
    codeField = '<input id="sf_code" value="' + row.matCode + '" readonly style="' + _stockInputCss() + ';opacity:.65;cursor:not-allowed">';
  } else {
    var matListOpts = allMat.map(function(m){
      return '<option value="' + m.code + '">' + m.code + (m.name ? ' — ' + m.name : '') + '</option>';
    }).join('');
    codeField =
      '<input id="sf_code_search" list="sf_mat_list" placeholder="พิมพ์หรือเลือกจากรายการ..." ' +
        'oninput="_stockAutoFillName(this.value)" ' +
        'style="' + _stockInputCss() + '">' +
      '<datalist id="sf_mat_list">' + matListOpts + '</datalist>' +
      '<input type="hidden" id="sf_code">';
  }

  Swal.fire({
    title: row ? '✏️ แก้ไข: ' + matCode : '➕ เพิ่มวัสดุ',
    background: 'var(--bg-card)',
    color: 'var(--t1)',
    width: 440,
    html:
      '<div style="display:flex;flex-direction:column;gap:10px;text-align:left">' +
        _stockFld('รหัสวัสดุ *' + (row ? '' : ' <span style="font-size:.68rem;color:var(--t3)">(เลือกจาก MAT หรือพิมพ์ใหม่)</span>'), codeField) +
        _stockFld('ชื่อรายการ', '<input id="sf_name" value="' + (row ? row.matName : '') + '" placeholder="ชื่อเต็ม (ไม่บังคับ)" style="' + _stockInputCss() + '">') +
        '<div style="display:flex;gap:8px">' +
          _stockFld('หน่วย', '<select id="sf_unit" style="' + _stockInputCss() + '">' + unitOpts + '</select>', 'flex:1') +
          _stockFld('Stock ปัจจุบัน', '<input id="sf_qty" type="number" min="0" value="' + (row ? row.stockQty : 0) + '" style="' + _stockInputCss() + '">', 'flex:1') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          _stockFld('ขั้นต่ำ (Reorder Point)', '<input id="sf_min" type="number" min="0" value="' + (row ? row.minStock : 0) + '" style="' + _stockInputCss() + '">', 'flex:1') +
          _stockFld('สั่งครั้งละ', '<input id="sf_oqty" type="number" min="0" value="' + (row ? row.orderQty : 0) + '" style="' + _stockInputCss() + '">', 'flex:1') +
        '</div>' +
        _stockFld('ซัพพลายเออร์ <span style="font-size:.68rem;color:var(--t3)">(พิมพ์รหัสหรือชื่อ)</span>',
          '<input id="sf_supp" list="sf_supp_list" value="' + (row ? (row.suppCode || '') : '') + '" placeholder="เลือกหรือพิมพ์รหัส Supplier..." style="' + _stockInputCss() + '">' +
          '<datalist id="sf_supp_list">' + suppDatalist + '</datalist>') +
      '</div>',
    showCancelButton: true,
    confirmButtonText: '💾 บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#2563eb',
    didOpen: function() {
      window._stockMatLookup = seenCodes;
      window._stockAllMat    = allMat;
      // ถ้ายังไม่มี supplier → โหลดแล้ว rebuild datalist
      if (typeof _supplierCache !== 'undefined' && !_supplierCache.length && typeof fetchSuppliers === 'function') {
        fetchSuppliers().then(function() {
          var dl = document.getElementById('sf_supp_list');
          if (!dl) return;
          dl.innerHTML = (_supplierCache || []).map(function(s){
            return '<option value="' + s.code + '">' + s.name + (s.code ? ' (' + s.code + ')' : '') + '</option>';
          }).join('');
        });
      }
    },
    preConfirm: function() {
      // resolve code: ถ้ามี sf_code_search ให้ใช้ค่านั้น
      var searchEl = document.getElementById('sf_code_search');
      var code = searchEl ? searchEl.value.trim() : (document.getElementById('sf_code') ? document.getElementById('sf_code').value.trim() : '');
      // ถ้าพิมพ์แบบ "SS304 — ชื่อ..." ให้ตัดเอาเฉพาะรหัส
      code = code.split(' — ')[0].split(' —')[0].trim();
      if (!code) { Swal.showValidationMessage('กรุณาระบุหรือเลือกรหัสวัสดุ'); return false; }
      return {
        matCode:  code,
        matName:  document.getElementById('sf_name').value.trim(),
        unit:     document.getElementById('sf_unit').value,
        stockQty: parseFloat(document.getElementById('sf_qty').value) || 0,
        minStock: parseFloat(document.getElementById('sf_min').value) || 0,
        orderQty: parseFloat(document.getElementById('sf_oqty').value) || 0,
        suppCode: (document.getElementById('sf_supp').value || '').split(' (')[0].trim()
      };
    }
  }).then(function(res) {
    if (!res.isConfirmed) return;
    stockSaveRow(res.value);
  });
}

// auto-fill ชื่อเมื่อเลือก matCode จาก datalist
function _stockAutoFillName(val) {
  var code = (val || '').split(' — ')[0].trim();
  var mat = (window._stockAllMat || []).find(function(m){ return m.code === code; });
  var nameEl = document.getElementById('sf_name');
  if (mat && mat.name && nameEl && !nameEl.value) nameEl.value = mat.name;
  // auto-fill unit จาก _localMatFlap/_localMatMesh ถ้ามี
  var flapArr2 = (typeof _localMatFlap !== 'undefined') ? _localMatFlap : [];
  var meshArr2 = (typeof _localMatMesh !== 'undefined') ? _localMatMesh : [];
  var found = flapArr2.concat(meshArr2).find(function(m){ return m.code === code; });
  if (found) {
    var unitEl = document.getElementById('sf_unit');
    // ฝา = แผ่น, ตะแกรง = แผ่น เช่นกัน (default แผ่น)
    if (unitEl && unitEl.value === 'แผ่น') { /* ไม่ต้องเปลี่ยน */ }
  }
}

function _stockFld(label, input, wrapStyle) {
  return '<div style="' + (wrapStyle || '') + '">' +
    '<div style="font-size:.7rem;color:var(--t3);margin-bottom:3px">' + label + '</div>' +
    input + '</div>';
}
function _stockInputCss() { return 'width:100%;padding:7px 10px;border-radius:8px;border:1.5px solid var(--bc-input);background:var(--bg-input);color:var(--t1);font-family:Sarabun,sans-serif;font-size:.82rem;box-sizing:border-box'; }

async function stockSaveRow(d) {
  var url = _stockUrl();
  if (!url) { Swal.fire('ข้อผิดพลาด', 'ยังไม่ตั้งค่า Script URL', 'error'); return; }
  Swal.fire({ title:'กำลังบันทึก...', didOpen: function(){ Swal.showLoading(); }, allowOutsideClick:false });
  try {
    // GAS ไม่รองรับ CORS preflight → ใช้ no-cors (fire-and-forget)
    await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({ action:'saveMatStock' }, d)) });
    // optimistic update local state
    var idx = _stockRows.findIndex(function(r){ return r.matCode === d.matCode; });
    if (idx >= 0) Object.assign(_stockRows[idx], d, { lastUpdated: '' });
    else _stockRows.push(Object.assign({ lastUpdated:'' }, d));
    Swal.fire({ title:'บันทึกแล้ว ✓', icon:'success', timer:900, showConfirmButton:false, toast:true, position:'top-end' });
    _stockRenderDash();
    _stockRenderTable();
  } catch(e) {
    Swal.fire('บันทึกไม่ได้', e.message, 'error');
  }
}

async function stockDeleteRow(matCode) {
  var res = await Swal.fire({
    title: 'ลบ ' + matCode + '?',
    text: 'ประวัติ movement จะยังคงอยู่',
    icon: 'warning', showCancelButton:true,
    confirmButtonText:'ลบเลย', cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#dc2626',
    background:'var(--bg-card)', color:'var(--t1)'
  });
  if (!res.isConfirmed) return;
  var url = _stockUrl();
  Swal.fire({ title:'กำลังลบ...', didOpen:function(){ Swal.showLoading(); }, allowOutsideClick:false });
  try {
    await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'saveMatStock', matCode:matCode, delete:true }) });
    _stockRows = _stockRows.filter(function(x){ return x.matCode !== matCode; });
    Swal.fire({ title:'ลบแล้ว', icon:'success', timer:900, showConfirmButton:false, toast:true, position:'top-end' });
    _stockRenderDash();
    _stockRenderTable();
  } catch(e) {
    Swal.fire('ลบไม่ได้', e.message, 'error');
  }
}

// ── Adjust (IN / ADJUST) ──────────────────────────────────────
function stockAdjust(matCode, type) {
  var row = _stockRows.find(function(r){ return r.matCode === matCode; });
  var title = type === 'IN' ? '➕ รับวัสดุเข้า: ' + matCode : type === 'OUT' ? '➖ จ่ายออก: ' + matCode : '⚙ ปรับ Stock: ' + matCode;
  var label = type === 'IN' ? 'จำนวนที่รับเข้า (' + (row ? row.unit : '') + ')' : type === 'OUT' ? 'จำนวนที่จ่ายออก (' + (row ? row.unit : '') + ')' : 'Stock จริงที่นับได้ (' + (row ? row.unit : '') + ')';
  Swal.fire({
    title: title,
    background:'var(--bg-card)', color:'var(--t1)', width:360,
    html:
      '<div style="text-align:left;display:flex;flex-direction:column;gap:8px">' +
        (row ? '<div style="font-size:.78rem;color:var(--t3)">คงเหลือปัจจุบัน: <strong style="color:var(--t1)">' + row.stockQty + ' ' + row.unit + '</strong></div>' : '') +
        _stockFld(label, '<input id="sa_qty" type="number" min="0" step="0.5" value="0" style="' + _stockInputCss() + '">') +
        _stockFld('เลขอ้างอิง (PO/Order)', '<input id="sa_ref" placeholder="เช่น PO-2568-001" style="' + _stockInputCss() + '">') +
        _stockFld('หมายเหตุ', '<input id="sa_note" placeholder="(ไม่บังคับ)" style="' + _stockInputCss() + '">') +
      '</div>',
    showCancelButton:true,
    confirmButtonText: type === 'IN' ? '✅ ยืนยันรับเข้า' : type === 'OUT' ? '✅ ยืนยันจ่ายออก' : '✅ ยืนยันปรับ',
    cancelButtonText:'ยกเลิก',
    confirmButtonColor: type === 'IN' ? '#16a34a' : type === 'OUT' ? '#ea580c' : '#7c3aed',
    preConfirm: function() {
      var q = parseFloat(document.getElementById('sa_qty').value) || 0;
      if (q <= 0 && (type === 'IN' || type === 'OUT')) { Swal.showValidationMessage('กรุณาระบุจำนวน'); return false; }
      return { qty:q, ref:document.getElementById('sa_ref').value.trim(), note:document.getElementById('sa_note').value.trim() };
    }
  }).then(function(res) {
    if (!res.isConfirmed) return;
    _stockCommitMovements([{ matCode:matCode, qty:res.value.qty, type:type, ref:res.value.ref, note:res.value.note }]);
  });
}

// ── commit batch movement (shared by order.js / purchase.js / manual) ──
async function _stockCommitMovements(movements, by) {
  var url = _stockUrl();
  if (!url || !movements || !movements.length) return;
  Swal.fire({ title:'กำลังอัป Stock...', didOpen:function(){ Swal.showLoading(); }, allowOutsideClick:false });
  try {
    // GAS ไม่รองรับ CORS preflight → ใช้ no-cors (fire-and-forget)
    await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'updateMatStockBatch', movements:movements, by: by || 'user' }) });
    // optimistic update: คำนวณ stockAfter จาก movements เอง
    movements.forEach(function(m) {
      var row = _stockRows.find(function(x){ return x.matCode === m.matCode; });
      if (!row) return;
      if (m.type === 'IN')     row.stockQty = row.stockQty + m.qty;
      else if (m.type === 'OUT') row.stockQty = row.stockQty - m.qty;
      else row.stockQty = m.qty; // ADJUST
    });
    Swal.fire({ title:'อัป Stock แล้ว ✓', icon:'success', timer:1000, showConfirmButton:false, toast:true, position:'top-end' });
    _stockRenderDash();
    _stockRenderTable();
  } catch(e) {
    Swal.fire('อัป Stock ไม่ได้', e.message, 'error');
  }
}

// ── Movement log ──────────────────────────────────────────────
async function stockViewMovement(matCode) {
  _stockViewCode = matCode;
  var url = _stockUrl();
  Swal.fire({ title:'กำลังโหลดประวัติ...', didOpen:function(){ Swal.showLoading(); }, allowOutsideClick:false });
  try {
    var res = await fetch(url + '?action=getMatMovement&matCode=' + encodeURIComponent(matCode), { mode:'cors' });
    var d   = await res.json();
    _stockMovement = d.rows || [];
    Swal.close();
    _stockShowMovementSwal(matCode);
  } catch(e) {
    Swal.fire('โหลดไม่ได้', e.message, 'error');
  }
}

function _stockShowMovementSwal(matCode) {
  var rows = _stockMovement.slice(0, 50).map(function(r) {
    var typeColor = r.type === 'IN' ? '#16a34a' : r.type === 'OUT' ? '#dc2626' : '#7c3aed';
    var typeLabel = r.type === 'IN' ? '⬆ IN' : r.type === 'OUT' ? '⬇ OUT' : '⚙ ADJUST';
    var sign = r.type === 'IN' ? '+' : r.type === 'OUT' ? '−' : '=';
    return '<tr style="border-bottom:1px solid var(--bc-div)">' +
      '<td style="padding:5px 8px;font-size:.72rem;color:var(--t3)">' + r.date + '</td>' +
      '<td style="padding:5px 8px"><span style="font-size:.72rem;font-weight:700;color:' + typeColor + ';background:' + typeColor.replace('#','rgba(') + ',.1);padding:2px 7px;border-radius:5px">' + typeLabel + '</span></td>' +
      '<td style="padding:5px 8px;font-weight:700;font-size:.82rem;color:' + typeColor + '">' + sign + r.qty + '</td>' +
      '<td style="padding:5px 8px;font-size:.75rem;color:var(--t1)">' + r.stockAfter + '</td>' +
      '<td style="padding:5px 8px;font-size:.72rem;color:var(--t2)">' + (r.ref || '—') + '</td>' +
      '<td style="padding:5px 8px;font-size:.72rem;color:var(--t3)">' + (r.note || '') + '</td>' +
    '</tr>';
  }).join('');

  Swal.fire({
    title: '📋 ประวัติ: ' + matCode,
    background:'var(--bg-card)', color:'var(--t1)', width:660,
    html: _stockMovement.length
      ? '<div style="overflow-x:auto;max-height:360px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:.79rem">' +
          '<thead><tr style="background:rgba(37,99,235,.08)">' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">วันที่</th>' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">ประเภท</th>' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">จำนวน</th>' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">คงเหลือ</th>' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">อ้างอิง</th>' +
            '<th style="padding:6px 8px;text-align:left;font-size:.68rem;color:var(--t3);border-bottom:2px solid var(--bc-div)">หมายเหตุ</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div style="padding:32px;text-align:center;color:var(--t3)">ยังไม่มีประวัติการเคลื่อนไหว</div>',
    confirmButtonText:'ปิด',
    confirmButtonColor:'#2563eb'
  });
}

// ── helper สำหรับ order.js / purchase.js เรียก ──────────────
// คำนวณแผ่นที่ต้องใช้จาก Order แล้วแสดง popup confirm OUT
async function stockDeductFromOrder(noPO, matTop, matBot, meshOut, meshIn, od, id_, h, qty) {
  if (!od || !h || !qty) return; // ไม่มีข้อมูลเพียงพอ
  var matCodes = [matTop, meshOut, meshIn, matBot].filter(Boolean);
  if (!matCodes.length) return;

  // คำนวณผ่าน _computeCutParts (formcalc.js)
  var res;
  try {
    res = _computeCutParts(od, id_, h, qty, [matTop, matBot, meshOut, meshIn], 0, [false,false,false,false]);
  } catch(e) { console.warn('stockDeductFromOrder: computeCutParts failed', e); return; }
  if (!res) return;

  // รวม sheets ต่อ matCode
  var usageMap = {};
  res.forEach(function(r) {
    if (!r.matCode || r.matCode === 'ไม่มี' || r.pieces <= 0) return;
    var sheets = Math.ceil(qty / r.pieces);
    var row    = _stockRows.find(function(x){ return x.matCode === r.matCode; });
    var unit   = row ? row.unit : 'แผ่น';
    if (!usageMap[r.matCode]) usageMap[r.matCode] = { partNames:[], sheets:0, unit:unit };
    usageMap[r.matCode].partNames.push(r.partName);
    usageMap[r.matCode].sheets += sheets;
  });

  var codes = Object.keys(usageMap);
  if (!codes.length) return;

  var itemsHtml = codes.map(function(code) {
    var u = usageMap[code];
    var row = _stockRows.find(function(x){ return x.matCode === code; });
    var after = row ? row.stockQty - u.sheets : '?';
    var afterColor = (row && after < 0) ? '#dc2626' : (row && after < row.minStock ? '#f59e0b' : '#16a34a');
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--c1-05);border:1px solid var(--bc-div);border-radius:8px;margin-bottom:5px">' +
      '<div style="flex:1">' +
        '<strong style="font-size:.85rem;color:var(--c1)">' + code + '</strong>' +
        '<span style="font-size:.72rem;color:var(--t3);margin-left:6px">(' + u.partNames.join(', ') + ')</span>' +
        '<div style="font-size:.72rem;color:var(--t3)">คงเหลือปัจจุบัน: ' + (row ? row.stockQty : '?') + ' ' + u.unit + ' → หลังหัก: <strong style="color:' + afterColor + '">' + after + ' ' + u.unit + '</strong></div>' +
      '</div>' +
      '<div style="font-size:1rem;font-weight:800;color:#dc2626">−' + u.sheets + ' <span style="font-size:.72rem">' + u.unit + '</span></div>' +
    '</div>';
  }).join('');

  var confirm = await Swal.fire({
    title: '📦 หักวัสดุออก Stock?',
    html: '<div style="font-size:.78rem;color:var(--t3);margin-bottom:10px">Order: <strong>' + noPO + '</strong></div>' + itemsHtml,
    background:'var(--bg-card)', color:'var(--t1)', width:460,
    showCancelButton:true,
    confirmButtonText:'✅ ยืนยันหัก Stock',
    cancelButtonText:'ข้ามไป',
    confirmButtonColor:'#2563eb'
  });
  if (!confirm.isConfirmed) return;

  var movements = codes.map(function(code) {
    return { matCode:code, qty:usageMap[code].sheets, type:'OUT', ref:noPO, note:'ตัดจาก Order อัตโนมัติ' };
  });
  await _stockCommitMovements(movements, 'order');
}

// ── helper สำหรับ purchase.js — รับวัสดุเข้า stock จาก PO ──
async function stockReceiveFromPO(poNo, poItems) {
  // poItems = [{ matCode, name, qty, unit }]
  var items = (poItems || []).filter(function(it){ return it.matCode && it.qty > 0; });
  if (!items.length) {
    // fallback: ถามแบบ manual
    Swal.fire({ title:'ไม่พบรายการ MAT ใน PO', text:'กรุณาเพิ่ม stock ด้วย "รับเข้า" ในแท็บ Stock MAT', icon:'info',
      background:'var(--bg-card)', color:'var(--t1)' });
    return;
  }

  var itemsHtml = items.map(function(it) {
    var row = _stockRows.find(function(x){ return x.matCode === it.matCode; });
    var after = row ? row.stockQty + it.qty : it.qty;
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(22,163,74,.06);border:1px solid rgba(22,163,74,.2);border-radius:8px;margin-bottom:5px">' +
      '<div style="flex:1">' +
        '<strong style="font-size:.85rem;color:#16a34a">' + it.matCode + '</strong>' +
        (it.name ? '<span style="font-size:.72rem;color:var(--t3);margin-left:6px">' + it.name + '</span>' : '') +
        '<div style="font-size:.72rem;color:var(--t3)">คงเหลือปัจจุบัน: ' + (row ? row.stockQty : 0) + ' → หลังรับ: <strong style="color:#16a34a">' + after + '</strong></div>' +
      '</div>' +
      '<div style="font-size:1rem;font-weight:800;color:#16a34a">+' + it.qty + ' <span style="font-size:.72rem">' + (it.unit || 'แผ่น') + '</span></div>' +
    '</div>';
  }).join('');

  var confirm = await Swal.fire({
    title: '📦 รับวัสดุเข้า Stock?',
    html: '<div style="font-size:.78rem;color:var(--t3);margin-bottom:10px">PO: <strong>' + poNo + '</strong></div>' + itemsHtml,
    background:'var(--bg-card)', color:'var(--t1)', width:460,
    showCancelButton:true,
    confirmButtonText:'✅ ยืนยันรับเข้า Stock',
    cancelButtonText:'ข้ามไป',
    confirmButtonColor:'#16a34a'
  });
  if (!confirm.isConfirmed) return;

  var movements = items.map(function(it) {
    return { matCode:it.matCode, qty:it.qty, type:'IN', ref:poNo, note:'รับเข้าจาก PO' };
  });
  await _stockCommitMovements(movements, 'po');
}


// ── สั่งซื้อทันที → เปิดแท็บ PO พร้อม pre-fill ─────────────
async function stockOrderNow(matCode) {
  var row = _stockRows.find(function(r){ return r.matCode === matCode; });
  if (!row) return;
  var shortage   = Math.max(row.minStock - row.stockQty, 0);
  var qtyToOrder = Math.max(shortage, parseFloat(row.orderQty) || 0) || row.minStock;

  // ── หา Supplier ที่รองรับ MAT นี้ (จาก matCodes field) ─────
  var suppList = (typeof _supplierCache !== 'undefined' ? _supplierCache : [])
    .filter(function(s) {
      if (!s.matCodes) return false;
      return s.matCodes.split(',').map(function(c){ return c.trim(); }).indexOf(matCode) >= 0;
    });
  // fallback: ถ้าไม่มีใครระบุ matCodes ไว้ ให้ใช้ preferred supplier ของ MAT
  if (!suppList.length && row.suppCode) {
    var pref = (typeof _supplierCache !== 'undefined' ? _supplierCache : [])
      .find(function(s){ return s.code === row.suppCode; });
    if (pref) suppList = [pref];
  }

  // ── เลือก Supplier ────────────────────────────────────────
  var chosenCode = row.suppCode || '';
  if (suppList.length > 1) {
    // มีหลายร้าน → แสดง popup ให้เลือก
    var suppHtml = suppList.map(function(s, idx) {
      var isPref = s.code === row.suppCode;
      return '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;' +
        'border:1px solid rgba(99,102,241,.2);margin-bottom:6px;cursor:pointer;background:rgba(99,102,241,.05)">' +
        '<input type="radio" name="suppPick" value="' + s.code + '"' + (idx===0?' checked':'') +
        ' style="accent-color:#6366f1;width:15px;height:15px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:.82rem;color:var(--t1)">' + (s.name||s.code) +
            (isPref ? ' <span style="font-size:.65rem;color:#818cf8;font-weight:400">(ร้านหลัก)</span>' : '') + '</div>' +
          (s.leadTimeDays ? '<div style="font-size:.7rem;color:var(--t3)">Lead Time: ' + s.leadTimeDays + ' วัน</div>' : '') +
        '</div></label>';
    }).join('');

    var pick = await Swal.fire({
      title: '🏪 เลือกร้านค้า: ' + matCode,
      html: '<div style="font-size:.78rem;color:var(--t3);margin-bottom:10px">พบ ' + suppList.length + ' ร้านที่จัดหา MAT นี้ได้</div>' + suppHtml,
      background:'var(--bg-card)', color:'var(--t1)', width:420,
      showCancelButton:true,
      confirmButtonText:'✅ เลือกร้านนี้',
      cancelButtonText:'ยกเลิก',
      confirmButtonColor:'#6366f1',
      preConfirm: function() {
        var sel = document.querySelector('input[name="suppPick"]:checked');
        return sel ? sel.value : suppList[0].code;
      }
    });
    if (!pick.isConfirmed) return;
    chosenCode = pick.value;
  } else if (suppList.length === 1) {
    chosenCode = suppList[0].code;
  }

  // ── Confirm สั่งซื้อ ──────────────────────────────────────
  var suppName = (function(){
    var s = (typeof _supplierCache !== 'undefined' ? _supplierCache : [])
      .find(function(x){ return x.code === chosenCode; });
    return s ? s.name : (chosenCode || '— ไม่ระบุ');
  })();
  var confirmed = await Swal.fire({
    title: '🛒 สั่งซื้อ: ' + matCode,
    html:
      '<div style="text-align:left;font-size:.82rem;display:flex;flex-direction:column;gap:6px">' +
        (row.matName ? '<div style="color:var(--t2);font-size:.78rem">' + row.matName + '</div>' : '') +
        '<div>คงเหลือ: <strong style="color:#f87171">' + row.stockQty + ' ' + row.unit + '</strong>  /  ขั้นต่ำ: ' + row.minStock + ' ' + row.unit + '</div>' +
        '<div>ร้านค้า: <strong style="color:#818cf8">' + suppName + '</strong></div>' +
        '<div style="margin-top:8px;padding:10px 14px;background:rgba(234,88,12,.09);border:1px solid rgba(234,88,12,.25);border-radius:9px;font-weight:700;font-size:.84rem">' +
          '📦 สร้าง PO: <strong>' + matCode + '</strong> จำนวน <strong style="color:#ea580c">' + qtyToOrder + ' ' + row.unit + '</strong>' +
        '</div>' +
      '</div>',
    background:'var(--bg-card)', color:'var(--t1)', width:400,
    showCancelButton:true,
    confirmButtonText:'🧾 สร้าง PO ทันที',
    cancelButtonText:'ยกเลิก',
    confirmButtonColor:'#ea580c',
  });
  if (!confirmed.isConfirmed) return;

  // ── เปิดแท็บ PO + pre-fill ───────────────────────────────
  if (typeof switchTab === 'function') switchTab('po');
  await new Promise(function(r){ setTimeout(r, 180); });
  if (typeof _poNewForm === 'function') await _poNewForm();
  await new Promise(function(r){ setTimeout(r, 220); });

  if (chosenCode) {
    var suppEl = document.getElementById('po_supplier');
    if (suppEl) suppEl.value = chosenCode;
    if (typeof _poRenderSupplierItemChips === 'function') _poRenderSupplierItemChips();
  }
  if (typeof _poItems !== 'undefined' && typeof _poRenderItemsEditor === 'function') {
    if (_poItems.length === 1 && !_poItems[0].name && !_poItems[0].qty) {
      _poItems[0] = { name: matCode, spec: row.matName || '', qty: String(qtyToOrder), unit: row.unit || 'แผ่น', unitPrice: '', imageUrl: '' };
    } else {
      _poItems.push({ name: matCode, spec: row.matName || '', qty: String(qtyToOrder), unit: row.unit || 'แผ่น', unitPrice: '', imageUrl: '' });
    }
    _poRenderItemsEditor();
    if (typeof _poRecalcTotals === 'function') _poRecalcTotals();
  }
}


// ── Badge แดงบน sidebar ──────────────────────────────────────
function _stockUpdateBadge() {
  var n = _stockRows.filter(function(r){ return _stockStatus(r) === 'critical'; }).length;

  // helper: ใส่/ลบ badge จากปุ่ม
  function _applyBadge(btn, show) {
    var old = btn.querySelector('.stock-crit-badge');
    if (old) old.remove();
    if (show && n > 0) {
      var b = document.createElement('span');
      b.className = 'stock-crit-badge';
      b.textContent = n;
      // แทรกก่อน .sb-caret ถ้ามี (สำหรับ group header)
      var caret = btn.querySelector('.sb-caret');
      if (caret) btn.insertBefore(b, caret); else btn.appendChild(b);
    }
  }

  // 1) ปุ่ม Stock MAT โดยตรง (desktop tbtn-stock + mobile data-tab=stock)
  document.querySelectorAll('#tbtn-stock, [data-tab="stock"]').forEach(function(btn) {
    _applyBadge(btn, true);
  });

  // 2) group header ฝ่ายจัดซื้อ (หรือกลุ่มใดก็ตามที่มี tbtn-stock อยู่ข้างใน)
  //    แสดงเฉพาะตอน group ยังปิดอยู่ — พอ open แล้วให้ badge อยู่แค่ที่ปุ่ม Stock MAT เท่านั้น
  var stockBtn = document.querySelector('#tbtn-stock');
  if (stockBtn) {
    var groupEl = stockBtn.closest('.sb-group');
    if (groupEl) {
      var hdr = groupEl.querySelector('.sb-group-header');
      if (hdr) {
        var isOpen = groupEl.classList.contains('open');
        _applyBadge(hdr, !isOpen); // แสดงบน header เฉพาะตอนกลุ่มปิด
      }
    }
  }
}

// ── ตรวจ Stock ก่อน save Order (เรียกจาก order.js) ───────────
// คืน true = ผ่าน / false = ผู้ใช้กดยกเลิก
async function stockCheckBeforeOrder(matCodes) {
  if (!_stockRows || !_stockRows.length) return true; // ยังไม่มีข้อมูล → ผ่านไปก่อน

  var codes = (matCodes || []).filter(function(c){ return !!c; });
  if (!codes.length) return true;

  // MAT ที่อยู่ในระบบ stock และถึง reorder point แล้ว (stockQty <= minStock)
  var warn = codes.reduce(function(acc, code) {
    var row = _stockRows.find(function(r){ return r.matCode === code; });
    if (!row) return acc;
    if (row.minStock > 0 && row.stockQty <= row.minStock) {
      var status = _stockStatus(row);
      acc.push({ code:code, name:row.matName||'', qty:row.stockQty, min:row.minStock, unit:row.unit, status:status });
    }
    return acc;
  }, []);

  if (!warn.length) return true;

  var listHtml = warn.map(function(w) {
    var color = w.status === 'critical' ? '#f87171' : '#fbbf24';
    var icon  = w.status === 'critical' ? '🔴' : '🟡';
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;' +
      'background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.2);border-radius:8px;margin-bottom:6px">' +
      '<span>' + icon + '</span>' +
      '<div style="flex:1;text-align:left">' +
        '<div style="font-weight:700;font-size:.82rem;color:' + color + '">' + w.code + (w.name ? ' — ' + w.name : '') + '</div>' +
        '<div style="font-size:.73rem;color:var(--t3)">คงเหลือ <strong style="color:' + color + '">' + w.qty + '</strong> ' + w.unit + ' (ขั้นต่ำ ' + w.min + ' ' + w.unit + ')</div>' +
      '</div></div>';
  }).join('');

  var result = await Swal.fire({
    title: '⚠️ MAT ถึง Reorder Point แล้ว!',
    html: '<div style="font-size:.8rem;color:var(--t3);margin-bottom:10px">' +
        'วัสดุต่อไปนี้มีของน้อยกว่าขั้นต่ำ — ควรสั่งซื้อก่อนผลิต' +
      '</div>' + listHtml,
    background:'var(--bg-card)', color:'var(--t1)', width:420,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '✅ ยืนยัน บันทึก Order ต่อ',
    cancelButtonText: '↩ กลับไปแก้ไข',
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#6366f1',
  });
  return result.isConfirmed;
}


// ── Reorder Report ────────────────────────────────────────────
function _stockRenderReorder() {
  var el = document.getElementById('_stockReorder');
  if (!el) return;

  var today = new Date();
  today.setHours(0,0,0,0);

  // MAT ที่ต้อง reorder: stockQty < minStock หรือ (stockQty - minStock) / avg_daily_use < leadDays
  // ใช้เกณฑ์ง่าย: stockQty <= minStock * 1.2 (buffer 20%) → ควรสั่ง
  var needOrder = _stockRows.filter(function(r) {
    return r.minStock > 0 && r.stockQty <= r.minStock * 1.2;
  }).map(function(r) {
    var lead = _stockLeadDate(r.suppCode); // วันที่ถึงกำหนด (string) หรือ null
    var status = _stockStatus(r);
    return { r:r, lead:lead, status:status };
  }).sort(function(a,b) {
    var s = { critical:0, low:1, ok:2 };
    return (s[a.status]||9) - (s[b.status]||9);
  });

  if (!needOrder.length) {
    el.innerHTML = '<div style="padding:14px 18px;font-size:.8rem;color:#4ade80;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.18);border-radius:10px">✅ ไม่มี MAT ที่ต้องสั่งในขณะนี้</div>';
    return;
  }

  var rows = needOrder.map(function(item) {
    var r = item.r;
    var statusColor = item.status === 'critical' ? '#f87171' : '#fbbf24';
    var statusIcon  = item.status === 'critical' ? '🔴' : '🟡';
    var shortage = r.minStock - r.stockQty;
    var qtyToOrder = Math.max(shortage, r.orderQty || 0);
    var suppName = '';
    if (typeof _supplierCache !== 'undefined') {
      var sup = _supplierCache.find(function(s){ return s.code === r.suppCode; });
      if (sup) suppName = sup.name || '';
    }
    var suppCell = (r.suppCode || '—') + (suppName ? '<div style="font-size:.68rem;color:var(--t3);margin-top:1px">' + suppName + '</div>' : '');
    return '<tr>' +
      '<td style="padding:7px 10px;font-size:.78rem;font-weight:700;color:' + statusColor + '">' + statusIcon + ' ' + r.matCode + '</td>' +
      '<td style="padding:7px 10px;font-size:.75rem;color:var(--t2)">' + (r.matName || '—') + '</td>' +
      '<td style="padding:7px 10px;font-size:.78rem;color:var(--t1);text-align:center">' + r.stockQty + ' ' + r.unit + '</td>' +
      '<td style="padding:7px 10px;font-size:.78rem;color:var(--t3);text-align:center">' + r.minStock + '</td>' +
      '<td style="padding:7px 10px;font-size:.78rem;font-weight:700;color:#f59e0b;text-align:center">' + qtyToOrder + ' ' + r.unit + '</td>' +
      '<td style="padding:7px 10px;font-size:.75rem;color:var(--t2);font-weight:600">' + suppCell + '</td>' +
      '<td style="padding:7px 10px;font-size:.75rem;color:#f59e0b;font-weight:600">' + (item.lead || '—') + '</td>' +
      '<td style="padding:6px 8px;text-align:center">' +
        '<button onclick="stockOrderNow(\'' + r.matCode + '\')" style="font-size:.73rem;padding:5px 14px;border-radius:8px;border:none;background:#ea580c;color:#fff;cursor:pointer;font-weight:700;font-family:Sarabun,sans-serif;white-space:nowrap">🧾 สั่งเลย</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  el.innerHTML =
    '<div style="font-size:.72rem;font-weight:800;color:var(--t3);letter-spacing:.08em;margin-bottom:8px">📋 รายการที่ต้องสั่งซื้อ (' + needOrder.length + ' รายการ)</div>' +
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-family:Sarabun,sans-serif">' +
      '<thead><tr style="background:rgba(255,255,255,.04);font-size:.7rem;color:var(--t3)">' +
        '<th style="padding:6px 10px;text-align:left">MAT Code</th>' +
        '<th style="padding:6px 10px;text-align:left">ชื่อ</th>' +
        '<th style="padding:6px 10px;text-align:center">คงเหลือ</th>' +
        '<th style="padding:6px 10px;text-align:center">ขั้นต่ำ</th>' +
        '<th style="padding:6px 10px;text-align:center">ควรสั่ง</th>' +
        '<th style="padding:6px 10px;text-align:left">ซัพพลายเออร์</th>' +
        '<th style="padding:6px 10px;text-align:left">ต้องสั่งภายใน</th>' +
        '<th style="padding:6px 10px;text-align:center"></th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>';
}


// ══════════════════════════════════════════════════════════════
// ── ใบตรวจนับวัตถุดิบ ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// พิมพ์ใบตรวจนับ A4 (มีช่องว่างกรอกยอดจริง)
function stockPrintCountSheet() {
  if (!_stockRows.length) {
    Swal.fire({ icon:'warning', title:'ยังไม่มีข้อมูล', text:'กรุณาโหลด Stock ก่อนพิมพ์ใบตรวจนับ', confirmButtonText:'ตกลง' });
    return;
  }

  var today = new Date();
  var dd = String(today.getDate()).padStart(2,'0');
  var mm = String(today.getMonth()+1).padStart(2,'0');
  var yyyy = today.getFullYear() + 543;
  var dateStr = dd + '/' + mm + '/' + yyyy;

  // จัดกลุ่มตาม group (MAT-ฝา / MAT-ตะแกรง / อื่นๆ)
  var groups = {};
  _stockRows.forEach(function(r) {
    var g = r.matCode && r.matCode.indexOf('MESH') >= 0 ? 'MAT-ตะแกรง' :
            r.matCode && r.matCode.indexOf('SPCC') >= 0 ? 'MAT-ฝา' : 'อื่นๆ';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  });

  var rowsHtml = '';
  var seq = 0;
  Object.keys(groups).forEach(function(g) {
    rowsHtml += '<tr><td colspan="7" style="background:#f1f5f9;font-weight:700;font-size:.75rem;padding:5px 8px;color:#334155">' + g + '</td></tr>';
    groups[g].forEach(function(r) {
      seq++;
      var statusColor = r.stockQty <= r.minStock ? '#dc2626' : r.stockQty <= r.minStock * 1.2 ? '#d97706' : '#16a34a';
      rowsHtml +=
        '<tr>' +
        '<td style="padding:6px 8px;text-align:center;color:#64748b;font-size:.72rem">' + seq + '</td>' +
        '<td style="padding:6px 8px;font-weight:700;font-size:.75rem">' + r.matCode + '</td>' +
        '<td style="padding:6px 8px;font-size:.73rem;color:#475569">' + (r.matName || '') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-size:.73rem">' + r.unit + '</td>' +
        '<td style="padding:6px 8px;text-align:center;font-weight:700;font-size:.78rem;color:' + statusColor + '">' + r.stockQty + '</td>' +
        '<td style="padding:6px 8px;border:1.5px solid #94a3b8;min-width:70px">&nbsp;</td>' +
        '<td style="padding:6px 8px;border:1.5px solid #e2e8f0;min-width:90px">&nbsp;</td>' +
        '</tr>';
    });
  });

  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<style>' +
    'body{font-family:Sarabun,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:0}' +
    '@page{size:A4 portrait;margin:15mm 12mm}' +
    'table{width:100%;border-collapse:collapse}' +
    'th{background:#1e3a5f;color:#fff;padding:7px 8px;font-size:.75rem;font-weight:700;text-align:center}' +
    'tr:nth-child(even){background:#f8fafc}' +
    'td{border-bottom:1px solid #e2e8f0}' +
    '.header-box{border:2px solid #1e3a5f;border-radius:6px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}' +
    '.title{font-size:1.1rem;font-weight:900;color:#1e3a5f}' +
    '.sub{font-size:.75rem;color:#64748b;margin-top:3px}' +
    '.sign-row{display:flex;gap:40px;margin-top:18px;font-size:.8rem}' +
    '.sign-box{flex:1;border-top:1.5px solid #334155;padding-top:6px;text-align:center;color:#475569}' +
    '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
    '</style></head><body>' +
    '<div class="header-box">' +
      '<div>' +
        '<div class="title">📋 ใบตรวจนับวัตถุดิบ</div>' +
        '<div class="sub">PTTS Cost Breakdown — Stock MAT Control</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:.8rem">' +
        '<div style="font-weight:700">วันที่ตรวจนับ</div>' +
        '<div style="font-size:1rem;font-weight:900;color:#1e3a5f">' + dateStr + '</div>' +
      '</div>' +
    '</div>' +
    '<table>' +
      '<thead><tr>' +
        '<th style="width:32px">#</th>' +
        '<th style="text-align:left;width:100px">รหัส MAT</th>' +
        '<th style="text-align:left">ชื่อวัตถุดิบ</th>' +
        '<th style="width:50px">หน่วย</th>' +
        '<th style="width:70px">ยอดระบบ</th>' +
        '<th style="width:80px">ยอดจริง ✏️</th>' +
        '<th style="width:100px">หมายเหตุ</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
    '</table>' +
    '<div class="sign-row" style="margin-top:30px">' +
      '<div class="sign-box">ผู้ตรวจนับ<br><br><br></div>' +
      '<div class="sign-box">ผู้ควบคุมคลัง<br><br><br></div>' +
      '<div class="sign-box">ผู้อนุมัติ<br><br><br></div>' +
    '</div>' +
    '<script>(function(){' +
      'function go(){try{window.focus();window.print();}catch(e){}}' +
      'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go).catch(function(){setTimeout(go,700);});}' +
      'else{setTimeout(go,700);}' +
    '})();<\/script>' +
    '</body></html>';

  var win = window.open('','_blank');
  if (!win) { Swal.fire({icon:'warning',title:'Popup ถูกบล็อก',text:'กรุณาอนุญาต popup แล้วลองใหม่',confirmButtonText:'ตกลง'}); return; }
  win.document.write(html);
  win.document.close();
}

// ── modal กรอกผลตรวจนับ ────────────────────────────────────────
function stockOpenCountForm() {
  if (!_stockRows.length) {
    Swal.fire({ icon:'warning', title:'ยังไม่มีข้อมูล', text:'กรุณาโหลด Stock ก่อน', confirmButtonText:'ตกลง' });
    return;
  }

  var today = new Date();
  var dd = String(today.getDate()).padStart(2,'0');
  var mm = String(today.getMonth()+1).padStart(2,'0');
  var yyyy = today.getFullYear() + 543;
  var dateStr = dd + '/' + mm + '/' + yyyy;

  var rowsHtml = _stockRows.map(function(r, i) {
    var statusColor = r.stockQty <= r.minStock ? '#f87171' : r.stockQty <= r.minStock * 1.2 ? '#fbbf24' : '#4ade80';
    return '<tr id="_cnt_row_' + i + '">' +
      '<td style="padding:7px 10px;font-weight:700;font-size:.78rem;color:var(--t1)">' + r.matCode + '</td>' +
      '<td style="padding:7px 10px;font-size:.73rem;color:var(--t2)">' + (r.matName || '') + '</td>' +
      '<td style="padding:7px 10px;text-align:center;font-size:.78rem;font-weight:700;color:' + statusColor + '">' + r.stockQty + ' ' + r.unit + '</td>' +
      '<td style="padding:5px 8px;text-align:center">' +
        '<input type="number" id="_cnt_qty_' + i + '" min="0" step="1" placeholder="—"' +
        ' oninput="_stockCountCalcDiff(' + i + ',' + r.stockQty + ')"' +
        ' style="width:80px;padding:5px 8px;border-radius:7px;border:1.5px solid var(--bc-div);background:var(--bg-card);color:var(--t1);font-family:Sarabun,sans-serif;font-size:.82rem;text-align:center">' +
      '</td>' +
      '<td id="_cnt_diff_' + i + '" style="padding:7px 10px;text-align:center;font-size:.78rem;font-weight:700;color:var(--t3)">—</td>' +
      '<td style="padding:5px 8px">' +
        '<input type="text" id="_cnt_note_' + i + '" placeholder="หมายเหตุ"' +
        ' style="width:100%;padding:4px 8px;border-radius:6px;border:1px solid var(--bc-div);background:var(--bg-card);color:var(--t1);font-family:Sarabun,sans-serif;font-size:.75rem">' +
      '</td>' +
    '</tr>';
  }).join('');

  var html =
    '<div style="font-family:Sarabun,sans-serif;text-align:left">' +
    '<div style="font-size:.75rem;color:var(--t3);margin-bottom:10px">วันที่ตรวจนับ: <strong style="color:var(--t1)">' + dateStr + '</strong>' +
    ' &nbsp;|&nbsp; กรอกเฉพาะรายการที่ตรวจนับ (ช่องว่าง = ไม่แก้ไข)</div>' +
    '<div style="overflow-x:auto;max-height:55vh;overflow-y:auto;border:1px solid var(--bc-div);border-radius:10px">' +
    '<table style="width:100%;border-collapse:collapse;font-family:Sarabun,sans-serif">' +
      '<thead style="position:sticky;top:0;z-index:2"><tr style="background:var(--bg-tab);font-size:.72rem;color:var(--t3)">' +
        '<th style="padding:8px 10px;text-align:left">รหัส MAT</th>' +
        '<th style="padding:8px 10px;text-align:left">ชื่อ</th>' +
        '<th style="padding:8px 10px;text-align:center">ยอดระบบ</th>' +
        '<th style="padding:8px 10px;text-align:center">ยอดจริง ✏️</th>' +
        '<th style="padding:8px 10px;text-align:center">ส่วนต่าง</th>' +
        '<th style="padding:8px 10px;text-align:left">หมายเหตุ</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
    '</table></div>' +
    '<div style="margin-top:10px;font-size:.72rem;color:var(--t3)">💡 ส่วนต่างบวก = ของจริงมากกว่าระบบ | ส่วนต่างลบ = ของจริงน้อยกว่าระบบ</div>' +
    '</div>';

  Swal.fire({
    title: '📋 กรอกผลตรวจนับวัตถุดิบ',
    html: html,
    width: '860px',
    showCancelButton: true,
    confirmButtonText: '✅ บันทึกปรับ Stock',
    cancelButtonText: '↩ ยกเลิก',
    confirmButtonColor: '#16a34a',
    focusConfirm: false,
    preConfirm: function() { return stockSubmitCount(); }
  });
}

// คำนวณส่วนต่างแบบ live
function _stockCountCalcDiff(i, sysQty) {
  var inp = document.getElementById('_cnt_qty_' + i);
  var diffEl = document.getElementById('_cnt_diff_' + i);
  if (!inp || !diffEl) return;
  var v = inp.value.trim();
  if (v === '' || isNaN(Number(v))) { diffEl.textContent = '—'; diffEl.style.color = 'var(--t3)'; return; }
  var diff = Number(v) - sysQty;
  diffEl.textContent = (diff > 0 ? '+' : '') + diff;
  diffEl.style.color = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#94a3b8';
}

// ส่งผลตรวจนับ → POST adjustMatStockBatch
async function stockSubmitCount() {
  var url = _stockUrl();
  if (!url) { Swal.showValidationMessage('ยังไม่ได้ตั้งค่า Script URL'); return false; }

  var items = [];
  _stockRows.forEach(function(r, i) {
    var inp = document.getElementById('_cnt_qty_' + i);
    if (!inp) return;
    var v = inp.value.trim();
    if (v === '' || isNaN(Number(v))) return; // ข้ามช่องที่ไม่ได้กรอก
    var noteEl = document.getElementById('_cnt_note_' + i);
    items.push({
      matCode: r.matCode,
      newQty:  Number(v),
      note:    noteEl ? noteEl.value.trim() : ''
    });
  });

  if (!items.length) {
    Swal.showValidationMessage('ยังไม่ได้กรอกยอดจริงรายการใดเลย');
    return false;
  }

  // แสดงรายการที่จะปรับก่อนยืนยัน
  var changed = items.filter(function(item) {
    var r = _stockRows.find(function(x){ return x.matCode === item.matCode; });
    return r && item.newQty !== r.stockQty;
  });

  var listHtml = changed.map(function(item) {
    var r = _stockRows.find(function(x){ return x.matCode === item.matCode; });
    var diff = item.newQty - r.stockQty;
    var color = diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#94a3b8';
    return '<div style="padding:4px 0;font-size:.8rem">' +
      '<strong>' + item.matCode + '</strong> ' + r.matName +
      ': <span style="color:var(--t3)">' + r.stockQty + '</span> → ' +
      '<strong>' + item.newQty + '</strong> ' + r.unit +
      ' <span style="color:' + color + ';font-weight:700">(' + (diff>0?'+':'') + diff + ')</span>' +
    '</div>';
  }).join('');

  if (changed.length === 0 && items.length > 0) {
    Swal.showValidationMessage('ยอดที่กรอกเท่ากับยอดในระบบทั้งหมด ไม่มีอะไรต้องปรับ');
    return false;
  }

  var confirm2 = await Swal.fire({
    title: 'ยืนยันปรับ Stock ' + changed.length + ' รายการ?',
    html: '<div style="text-align:left;max-height:200px;overflow-y:auto;font-family:Sarabun,sans-serif">' + listHtml + '</div>',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '✅ ยืนยัน',
    cancelButtonText: '↩ กลับแก้ไข',
    confirmButtonColor: '#16a34a'
  });
  if (!confirm2.isConfirmed) return false;

  try {
    var today = new Date();
    var ref = 'COUNT-' + today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjustMatStockBatch', items: items, by: 'stock', ref: ref })
    });
    // Optimistic update
    items.forEach(function(item) {
      var r = _stockRows.find(function(x){ return x.matCode === item.matCode; });
      if (r) r.stockQty = item.newQty;
    });
    _stockUpdateBadge();
    await Swal.fire({ icon:'success', title:'บันทึกสำเร็จ', text:'ปรับ Stock ' + changed.length + ' รายการแล้ว', timer:2000, showConfirmButton:false });
    stockLoad();
    return true;
  } catch(e) {
    Swal.showValidationMessage('เกิดข้อผิดพลาด: ' + e.message);
    return false;
  }
}
