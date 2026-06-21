// inspect.js — IPQC / OQC Inspection Module v9.68

/* ── State ─────────────────────────────────────────────── */
let _inspList    = [];
let _inspOrders  = [];
let _inspInited  = false;
let _inspFilter  = 'all';
let _inspPoints  = [];
let _inspEditId  = null;   // inspId ที่กำลังแก้ไข (null = สร้างใหม่)
let _inspViewRow = null;
let _inspDetailCache = null;  // cache ข้อมูลใน popup สำหรับพิมพ์โดยไม่ fetch ซ้ำ

/* ── Default check points per type ─────────────────────── */
const _INSP_DEF = {
  IPQC: [
    { cp:'OD',    smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'ID',    smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'H',     smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'ผิวงาน', smin:'', smax:'', unit:'', vis:true,  actual:'', a2:'', a3:'', a4:'', a5:'' },
  ],
  OQC: [
    { cp:'OD',   smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'ID',   smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'H',    smin:'', smax:'', unit:'mm',  vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'ผิวชุบ',                smin:'', smax:'', unit:'', vis:true,  actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'สีชุบ – ไม่มีคราบน้ำไหล', smin:'', smax:'', unit:'', vis:true,  actual:'', a2:'', a3:'', a4:'', a5:'' },
    { cp:'ความหนาชุบ',            smin:'10', smax:'30', unit:'μm', vis:false, actual:'', a2:'', a3:'', a4:'', a5:'' },
  ],
};

/* ── Helpers ────────────────────────────────────────────── */
function _inspUrl()  { return localStorage.getItem('ptts_script_url') || ''; }
function _inspToday(){ const d=new Date(); return d.toISOString().slice(0,10); }

function _inspInputToSheet(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return d+'/'+m+'/'+(parseInt(y)+543);
}
function _inspSheetToInput(s) {
  if (!s) return '';
  const p = s.split('/');
  if (p.length !== 3) return '';
  const yr = parseInt(p[2]);
  const ce = yr > 2400 ? yr-543 : yr;
  return String(ce).padStart(4,'0')+'-'+p[1]+'-'+p[0];
}

function _inspBadge(result) {
  const cls = {OK:'b-pass',Hold:'b-hold',NG:'b-fail'}[result]||'';
  return `<span class="isp-badge ${cls}">${result||'—'}</span>`;
}
function _inspTypeBadge(type) {
  return type==='IPQC'
    ? '<span class="isp-badge b-ipqc">IPQC</span>'
    : '<span class="isp-badge b-oqc">OQC</span>';
}

/* ── Entry point ────────────────────────────────────────── */
async function _inspInit() {
  const el = document.getElementById('tab-inspect');
  if (!el) return;
  if (!_inspInited) {
    el.innerHTML = _inspShell();
    _inspInited = true;
    await _inspOpenPanel();   // เปิดฟอร์มอัตโนมัติทันที
  }
  await _inspLoad();
}

/* ── Shell HTML + CSS ───────────────────────────────────── */
function _inspShell() {
  return `
<style>
/* ═══════════════════════════════════════════
   Inspect Tab — Redesigned
═══════════════════════════════════════════ */
#_ispWrap{padding:16px 20px 60px}
/* — TOPBAR — */
.isp-topbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.isp-topbar-icon{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--c1),#7c3aed);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;box-shadow:0 3px 10px rgba(37,99,235,.3)}
.isp-topbar-title{font-size:1rem;font-weight:800;color:var(--t1)}
.isp-toggle{display:flex;background:var(--hover);border-radius:20px;padding:3px;gap:2px}
.isp-tgl{font-size:.75rem;font-weight:700;padding:5px 16px;border-radius:16px;border:none;background:transparent;color:var(--t3);cursor:pointer;transition:all .15s}
.isp-tgl.act{background:var(--c1);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.35)}
.isp-tgl.act-oqc{background:#7c3aed;color:#fff;box-shadow:0 2px 8px rgba(124,58,237,.35)}
.isp-spacer{flex:1}
.isp-btn-pri{font-size:.82rem;padding:9px 20px;border-radius:20px;border:none;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;cursor:pointer;font-weight:700;transition:all .2s;box-shadow:0 3px 10px rgba(37,99,235,.35)}
.isp-btn-pri:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(37,99,235,.45)}
.isp-btn-pri:active{transform:translateY(0)}
.isp-btn-out{font-size:.8rem;padding:8px 16px;border-radius:20px;border:1.5px solid var(--bc-div);background:transparent;color:var(--t2);cursor:pointer;font-weight:600;transition:all .15s}
.isp-btn-out:hover{border-color:var(--c1);color:var(--c1);background:rgba(37,99,235,.05)}
/* — STATS — */
.isp-stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.isp-stat{background:var(--bg-card);border:1px solid var(--bc-card);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow);border-left:4px solid transparent;position:relative;overflow:hidden}
.isp-stat-icon{font-size:1.3rem;margin-bottom:5px;display:block}
.isp-stat-lbl{font-size:.69rem;color:var(--t3);font-weight:700;margin-bottom:3px;text-transform:uppercase;letter-spacing:.03em}
.isp-stat-val{font-size:2.1rem;font-weight:900;line-height:1;margin-bottom:3px}
.isp-stat-sub{font-size:.72rem;font-weight:700}
.isp-s-all{border-left-color:var(--c1)}.isp-s-all .isp-stat-val{color:var(--c1)}
.isp-s-pass{border-left-color:#16a34a}.isp-s-pass .isp-stat-val{color:#16a34a}
.isp-s-hold{border-left-color:#d97706}.isp-s-hold .isp-stat-val{color:#d97706}
.isp-s-fail{border-left-color:#dc2626}.isp-s-fail .isp-stat-val{color:#dc2626}
.isp-c-pass{color:#16a34a}.isp-c-fail{color:#dc2626}.isp-c-hold{color:#d97706}.isp-c-blue{color:var(--c1)}
/* — LIST CARD — */
.isp-card{background:var(--bg-card);border:1px solid var(--bc-card);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
.isp-card-hdr{padding:12px 18px;border-bottom:1.5px solid var(--bc-div);display:flex;align-items:center;gap:10px}
.isp-card-icon{width:32px;height:32px;border-radius:9px;background:rgba(37,99,235,.1);display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}
.isp-card-title{font-size:.9rem;font-weight:800;color:var(--t1)}
.isp-card-sub{font-size:.72rem;color:var(--t3);margin-left:auto;background:var(--hover);padding:2px 10px;border-radius:20px;font-weight:700}
/* — TABLE — */
table.isp-tbl{width:100%;border-collapse:collapse;font-size:.82rem}
table.isp-tbl thead tr{background:linear-gradient(to right,rgba(37,99,235,.06),rgba(124,58,237,.03))}
table.isp-tbl th{padding:10px 12px;font-size:.7rem;font-weight:800;color:var(--t2);text-align:left;border-bottom:2px solid var(--bc-div);white-space:nowrap;letter-spacing:.03em}
table.isp-tbl td{padding:10px 12px;border-bottom:1px solid var(--bc-div);color:var(--t1);vertical-align:middle}
table.isp-tbl tr:last-child td{border-bottom:none}
table.isp-tbl tbody tr:hover td{background:rgba(37,99,235,.04)}
.col-id{width:120px;font-weight:800;white-space:nowrap}.col-type{width:68px}.col-po{width:82px;white-space:nowrap}.col-spec{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.col-num{width:46px;text-align:center!important}.col-date{width:82px}.col-insp{width:75px}.col-result{width:60px}.col-act{width:120px;text-align:right!important}
/* — BADGES — */
.isp-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;white-space:nowrap}
.b-pass{background:#dcfce7;color:#15803d}.b-fail{background:#fee2e2;color:#dc2626}
.b-hold{background:#fef9c3;color:#b45309}.b-ipqc{background:#dbeafe;color:#1d4ed8}.b-oqc{background:#ede9fe;color:#7c3aed}
/* — ACTION BUTTONS — */
.isp-btn-sm{font-size:.7rem;padding:3px 9px;border-radius:7px;border:1px solid var(--bc-div);background:transparent;cursor:pointer;color:var(--t2);font-weight:600}
.isp-btn-view{font-size:.71rem;padding:5px 11px;border-radius:8px;border:none;background:#dbeafe;cursor:pointer;color:#1d4ed8;font-weight:700;white-space:nowrap;transition:all .15s}
.isp-btn-view:hover{background:#bfdbfe;transform:translateY(-1px)}
.isp-btn-edit{font-size:.71rem;padding:5px 11px;border-radius:8px;border:none;background:#fef3c7;cursor:pointer;color:#92400e;font-weight:700;white-space:nowrap;transition:all .15s}
.isp-btn-edit:hover{background:#fde68a;transform:translateY(-1px)}
.isp-btn-del{font-size:.71rem;padding:5px 11px;border-radius:8px;border:none;background:#fee2e2;cursor:pointer;color:#dc2626;font-weight:700;white-space:nowrap;transition:all .15s}
.isp-btn-del:hover{background:#fecaca;transform:translateY(-1px)}
.isp-empty{text-align:center;padding:52px;color:var(--t3);font-size:.9rem}
/* — FORM CARD — */
#_ispFormCard{display:flex;flex-direction:column;margin-bottom:18px;background:var(--bg-card)!important;border:1px solid var(--bc-card)!important;border-radius:14px!important;box-shadow:var(--shadow)!important}
.isp-panel-hdr{padding:14px 20px;border-bottom:1.5px solid var(--bc-div);display:flex;align-items:center;gap:10px;border-radius:14px 14px 0 0;background:linear-gradient(to right,rgba(37,99,235,.06),transparent)}
.isp-panel-title{font-size:.95rem;font-weight:800;color:var(--t1)}
.isp-panel-close{margin-left:auto;width:30px;height:30px;border-radius:8px;border:1.5px solid var(--bc-div);background:transparent;cursor:pointer;color:var(--t3);font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.isp-panel-close:hover{background:var(--hover);color:var(--t1)}
#_ispFormCard .isp-panel-body{padding:20px;flex:1}
#_ispFormCard .isp-panel-footer{position:static;border-top:1.5px solid var(--bc-div);padding:14px 20px;background:var(--hover);border-radius:0 0 14px 14px;display:flex;gap:8px}
#_ispFormCard .isp-panel-footer .isp-btn-pri{flex:1;padding:10px;font-size:.85rem;border-radius:10px}
#_ispFormCard .isp-btn-out{padding:10px 18px;border-radius:10px;font-size:.85rem}
/* — FORM FIELDS — */
.isp-sec{display:flex;align-items:center;gap:8px;margin:18px 0 12px;font-size:.72rem;font-weight:800;color:var(--t2);text-transform:uppercase;letter-spacing:.05em}
.isp-sec-dot{width:4px;height:16px;border-radius:2px;flex-shrink:0}
.isp-sec-line{flex:1;height:1px;background:var(--bc-div)}
.isp-sec:first-child{margin-top:0}
.isp-field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.isp-field{display:flex;flex-direction:column;gap:5px}
.isp-field.full{grid-column:1/-1}
.isp-field label{font-size:.72rem;font-weight:800;color:var(--t2);letter-spacing:.01em}
.isp-field input,.isp-field select,.isp-field textarea{font-family:inherit;font-size:.85rem;padding:10px 13px;border:2px solid var(--bc-div);border-radius:9px;color:var(--t1);background:var(--bg-deep,var(--hover));outline:none;width:100%;transition:border-color .15s,box-shadow .15s}
.isp-field input:focus,.isp-field select:focus,.isp-field textarea:focus{border-color:var(--c1);box-shadow:0 0 0 3px rgba(37,99,235,.12);background:var(--bg-card)}
/* — INFO BOX — */
.isp-info-box{background:rgba(37,99,235,.05);border:1.5px solid rgba(37,99,235,.22);border-radius:10px;padding:12px 14px;margin-bottom:14px}
.isp-info-box .isp-info-lbl{font-size:.67rem;font-weight:800;color:var(--c1);margin-bottom:7px;text-transform:uppercase;letter-spacing:.04em}
.isp-info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:.79rem}
.isp-info-grid .ik{color:var(--t3);font-size:.7rem}
/* — CP TABLE — */
.isp-sep{font-size:.68rem;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 8px;padding-bottom:6px;border-bottom:1.5px solid var(--bc-div)}
table.isp-cp{width:100%;border-collapse:collapse;font-size:.79rem;margin-bottom:8px}
table.isp-cp thead tr{background:linear-gradient(to right,rgba(37,99,235,.07),transparent)}
table.isp-cp th{font-size:.67rem;color:var(--t2);font-weight:800;padding:8px 8px;border-bottom:2px solid var(--bc-div);text-align:left;letter-spacing:.03em}
table.isp-cp td{padding:6px 8px;border-bottom:1px solid var(--bc-div);vertical-align:middle}
table.isp-cp tr:last-child td{border-bottom:none}
table.isp-cp input,table.isp-cp select{font-family:inherit;font-size:.79rem;padding:6px 8px;border:1.5px solid var(--bc-div);border-radius:7px;background:var(--bg-card);color:var(--t1);width:100%;transition:border-color .15s;outline:none}
table.isp-cp input:focus,table.isp-cp select:focus{border-color:var(--c1);box-shadow:0 0 0 2px rgba(37,99,235,.1)}
.isp-ok{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:800}
.isp-ok-y{background:#dcfce7;color:#15803d}.isp-ok-n{background:#fee2e2;color:#dc2626}.isp-ok-na{background:var(--hover);color:var(--t3)}
/* — RESULT SECTION — */
.isp-result-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
.isp-res-box{background:var(--bg-card);border:2px solid var(--bc-div);border-radius:12px;padding:12px 10px;text-align:center;transition:border-color .15s}
.isp-res-box:focus-within{border-color:var(--c1);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.isp-res-box label{font-size:.67rem;font-weight:800;color:var(--t3);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}
.isp-res-box input{text-align:center;font-weight:900;font-size:1.5rem;border:none;background:transparent;color:var(--t1);width:100%;font-family:inherit;outline:none}
.isp-result-label{font-size:.72rem;font-weight:800;color:var(--t2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em}
.isp-result-btns{display:flex;gap:10px;margin-bottom:14px}
.isp-rb{flex:1;padding:12px 8px;border-radius:10px;border:2px solid var(--bc-div);background:var(--hover);cursor:pointer;font-weight:800;font-size:.88rem;transition:all .15s;color:var(--t3)}
.isp-rb:hover{border-color:var(--t2);color:var(--t1);transform:translateY(-1px)}
.isp-rb.sel-ok{border-color:#16a34a;background:#dcfce7;color:#15803d;box-shadow:0 3px 10px rgba(22,163,74,.2)}
.isp-rb.sel-hold{border-color:#d97706;background:#fef9c3;color:#92400e;box-shadow:0 3px 10px rgba(217,119,6,.2)}
.isp-rb.sel-ng{border-color:#dc2626;background:#fee2e2;color:#dc2626;box-shadow:0 3px 10px rgba(220,38,38,.2)}
/* — SWAL DETAIL — */
.isp-swal-detail{text-align:left}
@media(max-width:640px){
  .isp-stat-row{grid-template-columns:1fr 1fr}
  .isp-stat-val{font-size:1.6rem}
  .isp-field-row{grid-template-columns:1fr}
  .col-spec{max-width:110px}
}
</style>
<div id="_ispWrap">
  <div class="isp-topbar">
    <div class="isp-topbar-icon">🔍</div>
    <span class="isp-topbar-title">ใบตรวจสอบคุณภาพ</span>
    <div class="isp-toggle">
      <button class="isp-tgl act" id="_ispTAll"  onclick="_inspSetFilter('all')">ทั้งหมด</button>
      <button class="isp-tgl"     id="_ispTI"    onclick="_inspSetFilter('IPQC')">IPQC</button>
      <button class="isp-tgl"     id="_ispTO"    onclick="_inspSetFilter('OQC')">OQC</button>
    </div>
  </div>
  <div class="isp-stat-row" id="_ispStats"></div>
  <div id="_ispFormCard" class="isp-card" style="display:flex;flex-direction:column">
    <div class="isp-panel-hdr">
      <span class="isp-panel-title" id="_ispPanelTitle">+ สร้างใบตรวจ</span>
      <button class="isp-panel-close" onclick="_inspClosePanel()">✕</button>
    </div>
    <div class="isp-panel-body" id="_ispPanelBody"></div>
    <div class="isp-panel-footer" id="_ispPanelFooter"></div>
  </div>
  <div class="isp-card">
    <div class="isp-card-hdr">
      <div class="isp-card-icon">📋</div>
      <span class="isp-card-title">รายการใบตรวจสอบ</span>
      <span class="isp-card-sub" id="_ispListCount"></span>
    </div>
    <div style="overflow-x:auto">
      <table class="isp-tbl">
        <thead><tr>
          <th class="col-id">เลขที่</th>
          <th class="col-type">ประเภท</th>
          <th class="col-po">No.PO</th>
          <th>สินค้า / Spec</th>
          <th class="col-num">ตรวจ</th>
          <th class="col-num">ผ่าน</th>
          <th class="col-date">วันที่</th>
          <th class="col-insp">ผู้ตรวจ</th>
          <th class="col-result">ผล</th>
          <th class="col-act"></th>
        </tr></thead>
        <tbody id="_ispTbody"><tr><td colspan="10" class="isp-empty">⏳ กำลังโหลด...</td></tr></tbody>
      </table>
    </div>
  </div>
</div>
`;
}

/* ── Load list ──────────────────────────────────────────── */
async function _inspLoad() {
  const url = _inspUrl();
  if (!url) { _inspRenderEmpty('กรุณาตั้งค่า Script URL ในแท็บ "ตั้งค่า" ก่อน'); return; }
  _inspRenderEmpty('⏳ กำลังโหลดรายการ...');
  try {
    const r = await fetch(url + '?action=getInspections');
    const d = await r.json();
    _inspList = d.rows || [];
    _inspRender();
  } catch(e) {
    _inspRenderEmpty('โหลดข้อมูลไม่ได้: ' + e.message);
  }
}

function _inspRenderEmpty(msg) {
  const tb = document.getElementById('_ispTbody');
  if (tb) tb.innerHTML = `<tr><td colspan="10" class="isp-empty">${msg}</td></tr>`;
  _inspRenderStats([]);
}

/* ── Render ─────────────────────────────────────────────── */
function _inspRender() {
  let rows = _inspList;
  if (_inspFilter !== 'all') rows = rows.filter(r => r.type === _inspFilter);
  _inspRenderStats(rows);
  _inspRenderTable(rows);
}

function _inspRenderStats(rows) {
  const el = document.getElementById('_ispStats');
  if (!el) return;
  const total = rows.length;
  const pass  = rows.filter(r => r.result === 'OK').length;
  const hold  = rows.filter(r => r.result === 'Hold').length;
  const fail  = rows.filter(r => r.result === 'NG').length;
  const pct   = n => total ? Math.round(n/total*100) : 0;
  el.innerHTML = `
    <div class="isp-stat isp-s-all">
      <span class="isp-stat-icon">📊</span>
      <div class="isp-stat-lbl">ทั้งหมด</div>
      <div class="isp-stat-val">${total}</div>
      <div class="isp-stat-sub isp-c-blue">รายการ</div>
    </div>
    <div class="isp-stat isp-s-pass">
      <span class="isp-stat-icon">✅</span>
      <div class="isp-stat-lbl">ผ่าน OK</div>
      <div class="isp-stat-val">${pass}</div>
      <div class="isp-stat-sub isp-c-pass">${pct(pass)}%</div>
    </div>
    <div class="isp-stat isp-s-hold">
      <span class="isp-stat-icon">⚠️</span>
      <div class="isp-stat-lbl">Hold / Rework</div>
      <div class="isp-stat-val">${hold}</div>
      <div class="isp-stat-sub isp-c-hold">${pct(hold)}%</div>
    </div>
    <div class="isp-stat isp-s-fail">
      <span class="isp-stat-icon">❌</span>
      <div class="isp-stat-lbl">NG ไม่ผ่าน</div>
      <div class="isp-stat-val">${fail}</div>
      <div class="isp-stat-sub isp-c-fail">${pct(fail)}%</div>
    </div>
  `;
}

function _inspRenderTable(rows) {
  const tb  = document.getElementById('_ispTbody');
  const cnt = document.getElementById('_ispListCount');
  if (!tb) return;
  if (cnt) cnt.textContent = rows.length + ' รายการ';
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="10" class="isp-empty">ไม่พบข้อมูล</td></tr>`; return; }
  tb.innerHTML = rows.map(r => `
    <tr>
      <td class="col-id"><strong style="color:var(--c1)">${r.inspId||'—'}</strong></td>
      <td class="col-type">${_inspTypeBadge(r.type)}</td>
      <td class="col-po" style="font-weight:700">${r.orderId||'—'}</td>
      <td class="col-spec" title="${r.orderRef||r.workType||''}">${r.orderRef||r.workType||'—'}</td>
      <td class="col-num"><strong>${r.qtyCheck != null ? r.qtyCheck : '—'}</strong></td>
      <td class="col-num" style="color:#16a34a;font-weight:700">${r.qtyPass != null ? r.qtyPass : '—'}</td>
      <td class="col-date" style="color:var(--t2)">${r.date||'—'}</td>
      <td class="col-insp">${r.inspector||'—'}</td>
      <td class="col-result">${_inspBadge(r.result)}</td>
      <td class="col-act">
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="isp-btn-view" onclick="_inspViewDetail('${r.inspId}')">🔍 ดู</button>
          <button class="isp-btn-edit" onclick="_inspEditLoad('${r.inspId}')">✏️ แก้ไข</button>
          <button class="isp-btn-del"  onclick="_inspDelete('${r.inspId}')">🗑 ลบ</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── Filter toggle ──────────────────────────────────────── */
function _inspSetFilter(f) {
  _inspFilter = f;
  [['_ispTAll','all'],['_ispTI','IPQC'],['_ispTO','OQC']].forEach(([id,val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('act','act-oqc');
    if (val === f) el.classList.add(f === 'OQC' ? 'act-oqc' : 'act');
  });
  _inspRender();
}

/* ── Load orders for dropdown ───────────────────────────── */
async function _inspLoadOrders() {
  if (_inspOrders.length) return;
  const url = _inspUrl();
  if (!url) return;
  try {
    const r = await fetch(url + '?action=getOrders');
    const d = await r.json();
    _inspOrders = (d.rows || d || []).filter(row => Array.isArray(row) && row[1] && String(row[16]||'').trim() !== 'เรียบร้อย');
  } catch(e) { _inspOrders = []; }
}

/* ── Open create panel ──────────────────────────────────── */
async function _inspOpenPanel() {
  // ไม่ reset _inspEditId ที่นี่ — ให้ caller กำหนดก่อนเรียก
  const isEdit = !!_inspEditId;
  await _inspLoadOrders();
  document.getElementById('_ispPanelTitle').textContent = isEdit ? '✏️ แก้ไขใบตรวจ ' + _inspEditId : '+ สร้างใบตรวจ';
  document.getElementById('_ispPanelBody').innerHTML = _inspCreateFormHtml();
  document.getElementById('_ispPanelFooter').innerHTML = isEdit
    ? `<button class="isp-btn-out" onclick="_inspClosePanel()" style="flex:none;padding:10px 20px">✕ ปิด</button>
       <button class="isp-btn-pri" style="background:#7c3aed;flex:none;padding:10px 20px" onclick="_inspPreview()">👁 พรีวิว</button>
       <button class="isp-btn-pri" style="flex:none;padding:10px 28px" onclick="_inspSave()">💾 SAVE</button>`
    : `<button class="isp-btn-out" onclick="_inspClearForm()" style="flex:none;padding:10px 20px">🗑 เคลียร์</button>
       <button class="isp-btn-pri" style="background:#7c3aed;flex:none;padding:10px 20px" onclick="_inspPreview()">👁 พรีวิว</button>
       <button class="isp-btn-pri" style="flex:none;padding:10px 28px" onclick="_inspSave()">💾 SAVE</button>`;
  document.getElementById('_ispFormCard').style.display = 'flex';
  document.getElementById('_ispFormCard').style.flexDirection = 'column';
  if (!isEdit) {
    // สร้างใหม่: set default type + check points
    _inspSetDefaultPoints('OQC');
    _inspRenderCpTable();
  }
  // edit mode: caller จะ prefill fields และ set _inspPoints เอง
}

function _inspClosePanel() {
  // ปิดโหมดแก้ไข → กลับไปโหมดสร้างใหม่ (ฟอร์มยังแสดงอยู่)
  _inspEditId = null;
  _inspOpenPanel();
}

/* เคลียร์ฟอร์ม (ไม่ปิด) — พร้อมกรอกใบตรวจถัดไป */
function _inspClearForm() {
  _inspEditId = null;
  // clear Order + search
  const fOrderSearch = document.getElementById('_ispFOrderSearch');
  if (fOrderSearch) fOrderSearch.value = '';
  const fOrder = document.getElementById('_ispFOrder');
  if (fOrder) { fOrder.value = ''; _inspFilterOrders(); }
  // clear auto-info
  ['_ispFWt','_ispFOd','_ispFId','_ispFH','_ispFSpec'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  // clear qty + note
  ['_ispFQtyC','_ispFQtyP','_ispFQtyF'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const fNote = document.getElementById('_ispFNote');
  if (fNote) fNote.value = '';
  // reset result
  _inspSelectResult('OK');
  // reset check points ตาม type ปัจจุบัน
  const type = document.getElementById('_ispFType')?.value || 'OQC';
  _inspSetDefaultPoints(type);
  _inspRenderCpTable();
  // อัปเดต title
  document.getElementById('_ispPanelTitle').textContent = '+ สร้างใบตรวจ';
}

/* ── Create form HTML ───────────────────────────────────── */
function _inspCreateFormHtml() {
  const orderOpts = _inspOrders.map(o => {
    const noPO = String(o[1]||'');
    const wt   = String(o[4]||'');
    const od   = String(o[34]||'');
    const id_  = String(o[35]||'');
    const h    = String(o[36]||'');
    const spec = od ? ('OD'+od+(id_?'xID'+id_:'')+(h?'xH'+h:'')+'mm') : '';
    const poImg = String(o[12]||'');
    const qty   = String(o[6] ||'');
    const lbl   = noPO + (spec?' · '+spec : wt?' · '+wt:'');
    return `<option value="${noPO}" data-wt="${wt}" data-od="${od}" data-id="${id_}" data-h="${h}" data-poimg="${poImg}" data-qty="${qty}">${lbl}</option>`;
  }).join('');
  return `
<div class="isp-sec"><span class="isp-sec-dot" style="background:var(--c1)"></span>ข้อมูลหลัก<span class="isp-sec-line"></span></div>
<div class="isp-field-row">
  <div class="isp-field">
    <label>ประเภทการตรวจ</label>
    <select id="_ispFType" onchange="_inspOnTypeChange()">
      <option value="OQC">OQC — ก่อนส่งมอบ</option>
      <option value="IPQC">IPQC — ระหว่างผลิต</option>
    </select>
  </div>
  <div class="isp-field">
    <label>Order (No.PO)</label>
    <input type="text" id="_ispFOrderSearch" placeholder="🔍 พิมพ์ค้นหา No.PO / สินค้า..."
      oninput="_inspFilterOrders()" autocomplete="off"
      style="margin-bottom:5px">
    <select id="_ispFOrder" onchange="_inspOnOrderChange()">
      <option value="">— เลือก Order —</option>
      ${orderOpts}
    </select>
  </div>
</div>
<div class="isp-info-box" style="padding:10px 14px">
  <div class="isp-info-lbl">📦 ข้อมูลจาก Order (อัตโนมัติ)</div>
  <div style="font-size:.78rem;margin-bottom:7px">
    <span class="ik">ประเภทงาน: </span><strong id="_ispFWt">—</strong>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
    <div style="display:flex;flex-direction:column;align-items:center;border:1.5px solid var(--bc-card);border-radius:6px;padding:3px 12px;background:var(--bg);min-width:60px">
      <span style="font-size:.56rem;font-weight:800;color:var(--t3);text-transform:uppercase">OD</span>
      <span style="font-size:.9rem;font-weight:800;color:var(--t1)" id="_ispFOd">—</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;border:1.5px solid var(--bc-card);border-radius:6px;padding:3px 12px;background:var(--bg);min-width:60px">
      <span style="font-size:.56rem;font-weight:800;color:var(--t3);text-transform:uppercase">ID</span>
      <span style="font-size:.9rem;font-weight:800;color:var(--t1)" id="_ispFId">—</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;border:1.5px solid var(--bc-card);border-radius:6px;padding:3px 12px;background:var(--bg);min-width:60px">
      <span style="font-size:.56rem;font-weight:800;color:var(--t3);text-transform:uppercase">H</span>
      <span style="font-size:.9rem;font-weight:800;color:var(--t1)" id="_ispFH">—</span>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;border:1.5px solid var(--bc-card);border-radius:6px;padding:3px 12px;background:var(--bg);min-width:60px">
      <span style="font-size:.56rem;font-weight:800;color:var(--t3);text-transform:uppercase">จำนวน</span>
      <span style="font-size:.9rem;font-weight:800;color:var(--t1)" id="_ispFQty">—</span>
    </div>
    <div style="flex:1;font-size:.75rem">
      <span class="ik">Spec: </span><strong id="_ispFSpec">—</strong>
    </div>
  </div>
</div>
<div class="isp-field-row">
  <div class="isp-field">
    <label>📅 วันที่ตรวจ</label>
    <input type="date" id="_ispFDate" value="${_inspToday()}">
  </div>
  <div class="isp-field">
    <label>👤 ผู้ตรวจ</label>
    <input type="text" id="_ispFInspector" placeholder="ชื่อผู้ตรวจ" value="PTS">
  </div>
</div>
<div class="isp-sec"><span class="isp-sec-dot" style="background:#7c3aed"></span>จุดตรวจ Check Points<span class="isp-sec-line"></span></div>
<div id="_ispCpWrap"></div>
<button class="isp-btn-out" style="width:100%;margin-bottom:14px;font-size:.78rem;padding:9px;border-radius:9px" onclick="_inspAddPoint()">＋ เพิ่มจุดตรวจ</button>
<div class="isp-sec"><span class="isp-sec-dot" style="background:#16a34a"></span>สรุปผลการตรวจ<span class="isp-sec-line"></span></div>
<div class="isp-result-grid">
  <div class="isp-res-box"><label>จำนวนตรวจ</label><input id="_ispFQtyC" type="number" min="0" placeholder="0"></div>
  <div class="isp-res-box"><label style="color:#15803d">✅ ผ่าน</label><input id="_ispFQtyP" type="number" min="0" placeholder="0" style="color:#15803d"></div>
  <div class="isp-res-box"><label style="color:#dc2626">❌ ไม่ผ่าน</label><input id="_ispFQtyF" type="number" min="0" placeholder="0" style="color:#dc2626"></div>
</div>
<div class="isp-result-label">ผลการตรวจโดยรวม</div>
<div class="isp-result-btns">
  <button class="isp-rb sel-ok" id="_ispROK"   onclick="_inspSelectResult('OK')">✓ OK</button>
  <button class="isp-rb"        id="_ispRHold"  onclick="_inspSelectResult('Hold')">⚠ Hold</button>
  <button class="isp-rb"        id="_ispRNG"    onclick="_inspSelectResult('NG')">✗ NG</button>
</div>
<div class="isp-field full" style="margin-bottom:0">
  <label>📝 หมายเหตุ / Action ที่ต้องทำ</label>
  <textarea id="_ispFNote" rows="2" placeholder="ระบุถ้ามี..."></textarea>
</div>
`;
}

/* ── Form event handlers ────────────────────────────────── */
function _inspOnTypeChange() {
  const type = document.getElementById('_ispFType')?.value || 'OQC';
  _inspSetDefaultPoints(type);
  _inspRenderCpTable();
}

function _inspOnOrderChange() {
  const sel = document.getElementById('_ispFOrder');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  const wt  = opt.dataset.wt  || '';
  const od  = opt.dataset.od  || '';
  const id_ = opt.dataset.id  || '';
  const h   = opt.dataset.h   || '';
  const qty = opt.dataset.qty || '';
  const spec = od ? ('OD'+od+(id_?'xID'+id_:'')+(h?'xH'+h:'')+'mm') : '';
  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
  s('_ispFWt', wt); s('_ispFOd', od?od+' mm':''); s('_ispFId', id_?id_+' mm':''); s('_ispFH', h?h+' mm':'');
  s('_ispFSpec', spec||wt||'');
  s('_ispFQty', qty);
  // Auto-fill tolerances into OD/ID/H check points
  _inspPoints.forEach(p => {
    if (p.cp==='OD' && od)  { const n=parseFloat(od);  if(!isNaN(n)){p.smin=(n-0.2).toFixed(1); p.smax=(n+0.2).toFixed(1);} }
    if (p.cp==='ID' && id_) { const n=parseFloat(id_); if(!isNaN(n)){p.smin=(n-0.2).toFixed(1); p.smax=(n+0.2).toFixed(1);} }
    if (p.cp==='H'  && h)   { const n=parseFloat(h);   if(!isNaN(n)){p.smin=(n-0.5).toFixed(1); p.smax=(n+0.5).toFixed(1);} }
  });
  _inspRenderCpTable();
}

function _inspFilterOrders() {
  const q   = (document.getElementById('_ispFOrderSearch')?.value || '').toLowerCase().trim();
  const sel = document.getElementById('_ispFOrder');
  if (!sel) return;
  const prev = sel.value;
  const filtered = !q ? _inspOrders : _inspOrders.filter(o => {
    return String(o[1]||'').toLowerCase().includes(q) ||
           String(o[4]||'').toLowerCase().includes(q);
  });
  sel.innerHTML = '<option value="">— เลือก Order —</option>' +
    filtered.map(o => {
      const noPO = String(o[1]||'');
      const wt   = String(o[4]||'');
      const od   = String(o[34]||'');
      const id_  = String(o[35]||'');
      const h    = String(o[36]||'');
      const spec = od ? ('OD'+od+(id_?'xID'+id_:'')+(h?'xH'+h:'')+'mm') : '';
      const poImg = String(o[12]||'');
      const qty   = String(o[6] ||'');
      const lbl   = noPO + (spec?' · '+spec : wt?' · '+wt:'');
      return `<option value="${noPO}" data-wt="${wt}" data-od="${od}" data-id="${id_}" data-h="${h}" data-poimg="${poImg}" data-qty="${qty}">${lbl}</option>`;
    }).join('');
  if (prev) sel.value = prev;   // คงค่าที่เลือกไว้ (ถ้ายังอยู่ใน filter)
}

function _inspSetDefaultPoints(type) {
  _inspPoints = (_INSP_DEF[type] || _INSP_DEF.OQC).map(p => ({ ...p }));
}

function _inspSelectResult(v) {
  ['OK','Hold','NG'].forEach(r => {
    const btn = document.getElementById('_ispR'+r);
    if (btn) btn.className = 'isp-rb' + (r===v?' sel-'+r.toLowerCase():'');
  });
}

function _inspGetResult() {
  for (const v of ['OK','Hold','NG']) {
    const btn = document.getElementById('_ispR'+v);
    if (btn && btn.className.includes('sel-')) return v;
  }
  return 'OK';
}

/* ── Check-point table ──────────────────────────────────── */
function _inspRenderCpTable() {
  const wrap = document.getElementById('_ispCpWrap');
  if (!wrap) return;
  wrap.innerHTML = `
<table class="isp-cp">
  <thead><tr>
    <th style="width:26px">#</th><th style="min-width:120px">Check Point</th>
    <th style="width:84px">Min</th><th style="width:84px">Max</th>
    <th style="width:88px">ค่าจริง 1</th>
    <th style="width:84px">ค่าจริง 2</th>
    <th style="width:84px">ค่าจริง 3</th>
    <th style="width:84px">ค่าจริง 4</th>
    <th style="width:84px">ค่าจริง 5</th>
    <th style="width:55px">หน่วย</th>
    <th style="width:45px">ผล</th><th style="width:28px"></th>
  </tr></thead>
  <tbody>${_inspPoints.map((p,i) => _inspCpRowHtml(i,p)).join('')}</tbody>
</table>`;
}

function _inspCpRowHtml(i, p) {
  if (p.vis) {
    // toggle 3 states: '' → OK → NG → ''
    // แสดง: ''=— | OK=✓เขียว | NG=✗แดง
    const _vc = (val, field, extra) => {
      const display = val==='OK'
        ? `<span style="color:#16a34a;font-size:1.15rem;font-weight:900;line-height:1">✓</span>`
        : val==='NG'
        ? `<span style="color:#dc2626;font-size:1.15rem;font-weight:900;line-height:1">✗</span>`
        : `<span style="color:#cbd5e1;font-size:.9rem">—</span>`;
      const next = val===''?'OK':val==='OK'?'NG':'';
      const border = val==='OK'?'#16a34a':val==='NG'?'#dc2626':'#e2e8f0';
      const bg = val==='OK'?'rgba(22,163,74,.08)':val==='NG'?'rgba(220,38,38,.08)':'transparent';
      return `<td style="text-align:center">
        <button onclick="_inspPoints[${i}].${field}='${next}';${extra?extra+';':''}_inspRenderCpTable()"
          style="width:30px;height:30px;border:2px solid ${border};border-radius:6px;background:${bg};
            cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0">
          ${display}
        </button>
      </td>`;
    };
    return `<tr>
      <td style="color:var(--t3);font-size:.7rem">${i+1}</td>
      <td><input value="${p.cp}" oninput="_inspPoints[${i}].cp=this.value" style="min-width:110px"></td>
      <td colspan="2" style="color:var(--t3);font-size:.68rem;padding-left:6px;text-align:center">Visual</td>
      ${_vc(p.actual,'actual',`_inspRefreshOk(${i})`)}
      ${_vc(p.a2,'a2','')}
      ${_vc(p.a3,'a3','')}
      ${_vc(p.a4,'a4','')}
      ${_vc(p.a5,'a5','')}
      <td></td>
      <td id="_ispOk${i}">${_inspOkDot(p)}</td>
      <td><button class="isp-btn-sm" style="padding:1px 5px;font-size:.62rem" onclick="_inspRemovePoint(${i})">✕</button></td>
    </tr>`;
  }
  return `<tr>
    <td style="color:var(--t3);font-size:.7rem">${i+1}</td>
    <td><input value="${p.cp}" oninput="_inspPoints[${i}].cp=this.value"></td>
    <td><input type="number" value="${p.smin}" step="0.1" oninput="_inspPoints[${i}].smin=this.value;_inspRefreshOk(${i})"></td>
    <td><input type="number" value="${p.smax}" step="0.1" oninput="_inspPoints[${i}].smax=this.value;_inspRefreshOk(${i})"></td>
    <td><input type="number" value="${p.actual||''}" step="0.01" oninput="_inspPoints[${i}].actual=this.value;_inspRefreshOk(${i})"></td>
    <td><input type="number" value="${p.a2||''}" step="0.01" oninput="_inspPoints[${i}].a2=this.value"></td>
    <td><input type="number" value="${p.a3||''}" step="0.01" oninput="_inspPoints[${i}].a3=this.value"></td>
    <td><input type="number" value="${p.a4||''}" step="0.01" oninput="_inspPoints[${i}].a4=this.value"></td>
    <td><input type="number" value="${p.a5||''}" step="0.01" oninput="_inspPoints[${i}].a5=this.value"></td>
    <td><input value="${p.unit}" oninput="_inspPoints[${i}].unit=this.value" style="width:38px"></td>
    <td id="_ispOk${i}">${_inspOkDot(p)}</td>
    <td><button class="isp-btn-sm" style="padding:1px 5px;font-size:.62rem" onclick="_inspRemovePoint(${i})">✕</button></td>
  </tr>`;
}

function _inspOkDot(p) {
  if (!p.actual && p.actual !== 0) return '<span class="isp-ok isp-ok-na">—</span>';
  let ok;
  if (p.vis) {
    ok = (p.actual === 'OK');
  } else {
    const v  = parseFloat(p.actual);
    const mn = p.smin !== '' ? parseFloat(p.smin) : null;
    const mx = p.smax !== '' ? parseFloat(p.smax) : null;
    ok = (mn===null||v>=mn) && (mx===null||v<=mx);
  }
  return ok ? '<span class="isp-ok isp-ok-y">✓</span>' : '<span class="isp-ok isp-ok-n">✗</span>';
}

function _inspRefreshOk(i) {
  const cell = document.getElementById('_ispOk'+i);
  if (cell) cell.innerHTML = _inspOkDot(_inspPoints[i]);
}

function _inspAddPoint() {
  _inspPoints.push({ cp:'', smin:'', smax:'', actual:'', a2:'', a3:'', a4:'', a5:'', unit:'', vis:false });
  _inspRenderCpTable();
}

function _inspRemovePoint(i) {
  _inspPoints.splice(i, 1);
  _inspRenderCpTable();
}

/* ── Preview (พิมพ์โดยไม่บันทึก) ────────────────────────── */
async function _inspPreview() {
  const type      = document.getElementById('_ispFType')?.value        || 'OQC';
  const sel       = document.getElementById('_ispFOrder');
  const orderId   = sel?.value || '';
  // ค้นหา order จาก _inspOrders array โดยตรง (แม่นกว่า dataset)
  const _oRow     = _inspOrders.find(o => String(o[1]||'').trim() === orderId);
  const poImgPath = _oRow ? String(_oRow[12]||'') : (sel?.selectedOptions?.[0]?.dataset?.poimg || '');
  // qty: ลอง _oRow[6] ก่อน ถ้า 0 หรือว่างค่อย fallback server
  let orderQty    = _oRow && (_oRow[6] || _oRow[6]===0) ? String(_oRow[6]) : (sel?.selectedOptions?.[0]?.dataset?.qty || '');
  const dateInput = document.getElementById('_ispFDate')?.value        || '';
  const inspector = (document.getElementById('_ispFInspector')?.value  || '').trim();
  const qtyCheck  = parseInt(document.getElementById('_ispFQtyC')?.value)  || 0;
  const qtyPass   = parseInt(document.getElementById('_ispFQtyP')?.value)  || 0;
  const qtyFail   = parseInt(document.getElementById('_ispFQtyF')?.value)  || 0;
  const result    = _inspGetResult();
  const note      = (document.getElementById('_ispFNote')?.value       || '').trim();
  const wt        = (document.getElementById('_ispFWt')?.textContent   || '').replace('—','').trim();
  const spec      = (document.getElementById('_ispFSpec')?.textContent || '').replace('—','').trim();
  if (!orderId) { alert('กรุณาเลือก Order ก่อน'); return; }
  const items = _inspPoints.map((p,i) => {
    let ok = '';
    if (p.actual !== '' && p.actual !== undefined) {
      if (p.vis) { ok = p.actual==='OK' ? 'Y' : 'N'; }
      else {
        const v  = parseFloat(p.actual);
        const mn = p.smin!=='' ? parseFloat(p.smin) : null;
        const mx = p.smax!=='' ? parseFloat(p.smax) : null;
        ok = ((mn===null||v>=mn)&&(mx===null||v<=mx)) ? 'Y' : 'N';
      }
    }
    return { seq:i+1, checkPoint:p.cp, specMin:p.smin, specMax:p.smax,
             actual:p.actual, a2:p.a2||'', a3:p.a3||'', a4:p.a4||'', a5:p.a5||'',
             unit:p.unit, ok, defectType:'' };
  });
  let dateDisplay = '';
  if (dateInput) {
    const [y,m,d] = dateInput.split('-');
    dateDisplay = `${d}/${m}/${parseInt(y)+543}`;
  }
  const h = {
    inspId:   _inspEditId || '(ร่าง)',
    type, orderId, orderRef: spec||wt,
    date:     dateDisplay, inspector,
    orderQty,
    qtyCheck, qtyPass, qtyFail, result, note,
    workType: wt, spec,
  };
  const scriptUrl = _inspUrl();

  // แสดง loading ขณะ fetch
  Swal.fire({ title:'กำลังโหลดข้อมูล...', didOpen:()=>Swal.showLoading(), allowOutsideClick:false });

  // fetch ข้อมูลทั้งหมดก่อน — แล้วค่อยเปิด window ครั้งเดียว
  let imgSrc = '', imgErr = '', qtyErr = '';

  // ── รูป PO ──────────────────────────────────────────────
  try {
    const imgQuery = poImgPath
      ? '?action=getOrderPoImage&path=' + encodeURIComponent(poImgPath)
      : '?action=getOrderPoImage&noPO='  + encodeURIComponent(orderId);
    const ri = await fetch(scriptUrl + imgQuery);
    const di = await ri.json();
    if (di.status === 'ok') imgSrc = di.src;
    else imgErr = di.message || 'ไม่พบรูป';
  } catch(e) { imgErr = e.message; }

  // ── จำนวน ────────────────────────────────────────────────
  if (!orderQty && orderId) {
    try {
      const rq = await fetch(scriptUrl + '?action=getOrderQty&noPO=' + encodeURIComponent(orderId));
      const dq = await rq.json();
      if (dq.status === 'ok' && dq.qty) h.orderQty = String(dq.qty);
      else qtyErr = dq.message || 'qty ว่างใน sheet';
    } catch(e) { qtyErr = e.message; }
  }

  // ── เปิด window ครั้งเดียว (หลัง fetch เสร็จ) ────────────
  Swal.close();
  const win = window.open('', '_blank');
  if (!win) { alert('Browser บล็อก popup กรุณาอนุญาตก่อน'); return; }

  // ถ้าขาดทั้งรูปและ qty — แสดง debug
  if (!imgSrc && !h.orderQty) {
    const dbgRow = _oRow ? _oRow.slice(0,15).map((v,i)=>`[${i}]=${v}`).join(', ') : 'ไม่พบ _oRow';
    const dbgHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;font-size:12px">
      <h3 style="color:#dc2626">⚠️ ไม่พบข้อมูล — Debug</h3>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">orderId</td><td>${orderId}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">o[6] qty</td>
            <td style="color:${orderQty?'green':'red'}">${orderQty||'ว่าง'} ${qtyErr?'| err: '+qtyErr:''}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">o[12] poFilePath</td>
            <td style="color:${poImgPath?'green':'red'}">${poImgPath||'ว่าง'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">imgErr</td>
            <td style="color:red">${imgErr||'-'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:700">scriptUrl</td>
            <td style="color:${scriptUrl?'green':'red'}">${scriptUrl?'มี ('+scriptUrl.slice(0,40)+'...)':'❌ ว่าง!'}</td></tr>
        <tr><td colspan="2" style="padding-top:8px;font-size:10px;color:#666">${dbgRow}</td></tr>
      </table>
      <button onclick="window.close()" style="margin-top:12px">ปิด</button>
    </body></html>`;
    win.document.open(); win.document.write(dbgHtml); win.document.close();
    return;
  }

  _inspPrintRow(h, items, win, imgSrc);
}

/* ── Save ───────────────────────────────────────────────── */
async function _inspSave() {
  const url = _inspUrl();
  if (!url) { alert('กรุณาตั้งค่า Script URL ก่อน'); return; }

  const type      = document.getElementById('_ispFType')?.value      || 'OQC';
  const orderId   = document.getElementById('_ispFOrder')?.value     || '';
  const dateInput = document.getElementById('_ispFDate')?.value      || '';
  const inspector = (document.getElementById('_ispFInspector')?.value||'').trim();
  const qtyCheck  = parseInt(document.getElementById('_ispFQtyC')?.value)||0;
  const qtyPass   = parseInt(document.getElementById('_ispFQtyP')?.value)||0;
  const qtyFail   = parseInt(document.getElementById('_ispFQtyF')?.value)||0;
  const result    = _inspGetResult();
  const note      = (document.getElementById('_ispFNote')?.value||'').trim();
  const wt        = (document.getElementById('_ispFWt')?.textContent||'').replace('—','').trim();
  const spec      = (document.getElementById('_ispFSpec')?.textContent||'').replace('—','').trim();
  if (!orderId)   { alert('กรุณาเลือก Order'); return; }
  if (!inspector) { alert('กรุณาระบุชื่อผู้ตรวจ'); return; }
  const items = _inspPoints.map((p,i) => {
    let ok = '';
    if (p.actual !== '' && p.actual !== undefined) {
      if (p.vis) { ok = p.actual==='OK' ? 'Y' : 'N'; }
      else {
        const v  = parseFloat(p.actual);
        const mn = p.smin!=='' ? parseFloat(p.smin) : null;
        const mx = p.smax!=='' ? parseFloat(p.smax) : null;
        ok = ((mn===null||v>=mn)&&(mx===null||v<=mx)) ? 'Y' : 'N';
      }
    }
    return { seq:i+1, checkPoint:p.cp, specMin:p.smin, specMax:p.smax,
             actual:p.actual, a2:p.a2||'', a3:p.a3||'', a4:p.a4||'', a5:p.a5||'',
             unit:p.unit, ok, defectType:'' };
  });
  const wasEdit = !!_inspEditId;
  const payload = wasEdit ? {
    action:'updateInspection', inspId:_inspEditId, type, orderId,
    orderRef: spec||wt,
    date: _inspInputToSheet(dateInput),
    inspector, workType:wt, spec,
    qtyCheck, qtyPass, qtyFail, result, note, items,
  } : {
    action:'saveInspection', type, orderId,
    orderRef: spec||wt,
    date: _inspInputToSheet(dateInput),
    inspector, workType:wt, spec,
    qtyCheck, qtyPass, qtyFail, result, note, items,
  };
  Swal.fire({ title: wasEdit ? 'กำลังอัปเดต...' : 'กำลังบันทึก...', didOpen:()=>Swal.showLoading(), allowOutsideClick:false });
  try {
    const res = await fetch(url, { method:'POST', mode:'cors', body:JSON.stringify(payload) });
    const d   = await res.json();
    if (d.status !== 'ok') throw new Error(d.message||'error');
    if (wasEdit) {
      _inspClosePanel();
      Swal.fire({ title:'อัปเดตแล้ว ✓', icon:'success', timer:1000, showConfirmButton:false, toast:true, position:'top-end' });
    } else {
      _inspClearForm();
      Swal.fire({ title:'บันทึกแล้ว ✓', icon:'success', timer:1000, showConfirmButton:false, toast:true, position:'top-end' });
    }
    await _inspLoad();
  } catch(e) {
    Swal.fire('บันทึกไม่ได้', e.message, 'error');
  }
}

/* ── View detail (Swal popup) ─────────────────────────────── */
function _inspBuildDetailHtml(h, items, qty, imgSrc) {
  qty    = qty    || '';
  imgSrc = imgSrc || '';

  // lookup qty จาก _inspOrders ถ้ายังไม่มี
  if (!qty && h.orderId) {
    const oRow = _inspOrders.find(o => String(o[1]||'').trim() === String(h.orderId).trim());
    if (oRow && (oRow[6] || oRow[6]===0)) qty = String(oRow[6]);
  }

  const poImgHtml = imgSrc
    ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;display:block;border-radius:6px">`
    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--t3);font-size:.75rem;gap:4px">
         <span style="font-size:1.6rem">🖼</span><span>รูป PO</span>
       </div>`;

  const itemsSection = items === null
    ? `<div class="isp-sep">จุดตรวจ</div>
       <div style="text-align:center;padding:20px;color:var(--t3)">⏳ กำลังโหลดจุดตรวจ...</div>`
    : `<div class="isp-sep">จุดตรวจ</div>
<table class="isp-cp">
  <thead><tr><th>#</th><th>Check Point</th><th>Min</th><th>Max</th><th>ค่าจริง 1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>หน่วย</th><th>ผล</th></tr></thead>
  <tbody>${items.map((it,i)=>{
    const isVis = !it.specMin && !it.specMax &&
      (it.actual==='OK'||it.actual==='NG'||it.actual==='');
    const vv = v => {
      if (!v||v==='') return '<span style="color:#bbb">—</span>';
      if (v==='OK') return '<span style="color:#16a34a;font-weight:900">✓</span>';
      if (v==='NG') return '<span style="color:#dc2626;font-weight:900">✗</span>';
      return v;
    };
    return `<tr>
    <td style="color:var(--t3)">${i+1}</td>
    <td>${it.checkPoint||'—'}</td>
    <td style="text-align:center;${isVis?'color:#94a3b8;font-size:.65rem':''}">${isVis?'Visual':it.specMin||'—'}</td>
    <td style="text-align:center">${isVis?'':it.specMax||'—'}</td>
    <td style="text-align:center"><strong>${isVis?vv(it.actual):it.actual||'—'}</strong></td>
    <td style="text-align:center">${isVis?vv(it.a2):it.a2||'—'}</td>
    <td style="text-align:center">${isVis?vv(it.a3):it.a3||'—'}</td>
    <td style="text-align:center">${isVis?vv(it.a4):it.a4||'—'}</td>
    <td style="text-align:center">${isVis?vv(it.a5):it.a5||'—'}</td>
    <td>${it.unit||''}</td>
    <td>${it.ok==='Y'?'<span class="isp-ok isp-ok-y">✓</span>':it.ok==='N'?'<span class="isp-ok isp-ok-n">✗</span>':'<span class="isp-ok isp-ok-na">—</span>'}</td>
  </tr>`;}).join('')}</tbody>
</table>
${h.note?`<div style="font-size:.8rem;color:var(--t2);margin-top:6px"><strong>หมายเหตุ:</strong> ${h.note}</div>`:''}
<div style="margin-top:12px;display:flex;justify-content:flex-end">
  <button class="isp-btn-pri" onclick="_inspPrintFromDetail()">🖨 พิมพ์</button>
</div>`;

  // cache ข้อมูลปัจจุบันสำหรับปุ่มพิมพ์
  if (items !== null) {
    _inspDetailCache = { h, items, qty, imgSrc };
  }

  return `
<div style="display:flex;gap:10px;margin-top:4px;align-items:flex-start">
  <!-- ซ้าย: info + badge -->
  <div style="flex:1;min-width:0">
    <div class="isp-info-box">
      <div class="isp-info-grid" style="grid-template-columns:1fr 1fr">
        <span><span class="ik">ประเภท: </span>${_inspTypeBadge(h.type)}</span>
        <span><span class="ik">No.PO: </span><strong>${h.orderId||'—'}</strong></span>
        <span><span class="ik">วันที่ตรวจ: </span>${h.date||'—'}</span>
        <span><span class="ik">ผู้ตรวจ: </span><strong>${h.inspector||'—'}</strong></span>
        <span><span class="ik">จำนวน: </span><strong>${qty||'—'} ชิ้น</strong></span>
        <span>${_inspBadge(h.result)}</span>
        <span style="grid-column:1/-1"><span class="ik">สินค้า / Spec: </span>${h.orderRef||h.workType||'—'}</span>
      </div>
    </div>
  </div>
  <!-- ขวา: รูป PO -->
  <div id="isp-po-thumb" style="width:160px;min-width:160px;height:130px;border:1.5px solid var(--bc-card);
    border-radius:8px;background:var(--bg-card);overflow:hidden;flex-shrink:0">
    ${poImgHtml}
  </div>
</div>
${itemsSection}`;
}

async function _inspViewDetail(inspId) {
  const hCached = _inspList.find(x => x.inspId === inspId);
  if (!hCached) return;
  await Swal.fire({
    title: `<span style="font-size:1rem;font-weight:800">${hCached.inspId}</span>`,
    html: _inspBuildDetailHtml(hCached, null),
    width: Math.min(720, window.innerWidth - 32),
    showConfirmButton: false,
    showCloseButton: true,
    padding: '12px 16px',
    customClass: { popup: 'isp-swal-detail' },
    didOpen: async () => {
      const url = _inspUrl();
      if (!url) return;
      try {
        // ── fetch detail ──
        const r  = await fetch(url + '?action=getInspectionDetail&inspId=' + encodeURIComponent(inspId));
        const d  = await r.json();
        if (d.status !== 'ok' || !d.header) return;
        const hdr = d.header;

        // ── lookup qty จาก _inspOrders ──
        const oRow = _inspOrders.find(o => String(o[1]||'').trim() === String(hdr.orderId||'').trim());
        let qty = (oRow && (oRow[6]||oRow[6]===0)) ? String(oRow[6]) : '';
        const poPath = oRow ? String(oRow[12]||'') : '';

        // ── fetch รูป PO ──
        let imgSrc = '';
        try {
          const imgQ = poPath
            ? '?action=getOrderPoImage&path=' + encodeURIComponent(poPath)
            : '?action=getOrderPoImage&noPO='  + encodeURIComponent(hdr.orderId||'');
          const ri = await fetch(url + imgQ);
          const di = await ri.json();
          if (di.status === 'ok') imgSrc = di.src;
        } catch(e) {}

        // ── fetch qty server fallback ──
        if (!qty && hdr.orderId) {
          try {
            const rq = await fetch(url + '?action=getOrderQty&noPO=' + encodeURIComponent(hdr.orderId));
            const dq = await rq.json();
            if (dq.status === 'ok' && dq.qty) qty = String(dq.qty);
          } catch(e) {}
        }

        const box = Swal.getHtmlContainer();
        if (box && Swal.isVisible())
          box.innerHTML = _inspBuildDetailHtml(hdr, d.items || [], qty, imgSrc);
      } catch(e) {}
    }
  });
}

/* ── Print by ID ────────────────────────────────────────── */
async function _inspPrintById(inspId) {
  const url = _inspUrl();
  if (!url) return;
  // เปิด window ก่อน fetch
  const win = window.open('', '_blank');
  if (!win) { alert('Browser บล็อก popup กรุณาอนุญาตก่อน'); return; }
  try {
    const r = await fetch(url + '?action=getInspectionDetail&inspId=' + encodeURIComponent(inspId));
    const d = await r.json();
    if (d.status !== 'ok' || !d.header) { win.close(); alert('ไม่พบข้อมูล'); return; }
    const h = Object.assign({}, d.header, { orderQty: '' });
    _inspPrintRow(h, d.items || [], win, '');
  } catch(e) { win.close(); alert('พิมพ์ไม่ได้: ' + e.message); }
}

/* ── พิมพ์จาก popup (ใช้ข้อมูลที่โหลดแล้ว ไม่ fetch ใหม่) ──────────────── */
function _inspPrintFromDetail() {
  if (!_inspDetailCache) { alert('ไม่พบข้อมูล กรุณารอให้โหลดเสร็จก่อน'); return; }
  const { h, items, qty, imgSrc } = _inspDetailCache;
  const hForPrint = Object.assign({}, h, { orderQty: qty || '' });
  const win = window.open('', '_blank');
  if (!win) { alert('Browser บล็อก popup กรุณาอนุญาตก่อน'); return; }
  _inspPrintRow(hForPrint, items || [], win, imgSrc || '');
}

/* ── Print document ─────────────────────────────────────── */
function _inspPrintRow(h, items, win, imgSrc) {
  const co = (() => {
    try { return JSON.parse(localStorage.getItem('ptts_company_cfg') || localStorage.getItem('ptts_company') || '{}'); }
    catch(e) { return {}; }
  })();
  const coName = co.name    || localStorage.getItem('ptts_company_name') || 'บริษัท PTTS';
  const coAddr = co.address || co.addr || '';
  const coTax  = co.taxId   || co.tax  || '';

  const isIPQC    = h.type === 'IPQC';
  const typeLabel = isIPQC ? 'IPQC — ใบตรวจสอบระหว่างผลิต' : 'OQC — ใบตรวจสอบก่อนส่งมอบ';
  const rc     = h.result==='OK' ? '#16a34a' : h.result==='NG' ? '#dc2626' : '#d97706';
  const rcIcon = h.result==='OK' ? '✓' : h.result==='NG' ? '✗' : '!';

  const spec   = h.orderRef || h.workType || '';
  const dm     = spec.match(/OD([\d.]+)(?:x?ID([\d.]+))?(?:x?H([\d.]+))?/i);
  const od = dm?.[1]||''; const id_=dm?.[2]||''; const ht=dm?.[3]||'';

  // คำนวณ qtyCheck/Pass/Fail จาก items จริง (อาจ override ค่าจาก h ที่เป็น 0)
  const _passCount  = (items||[]).filter(it => it.ok === 'Y').length;
  const _failCount  = (items||[]).filter(it => it.ok === 'N').length;
  const _checkCount = _passCount + _failCount;
  const qtyCheck = (h.qtyCheck > 0) ? h.qtyCheck : _checkCount;
  const qtyPass  = (h.qtyPass  > 0) ? h.qtyPass  : _passCount;
  const qtyFail  = (h.qtyFail  > 0) ? h.qtyFail  : _failCount;

  // ตาราง check points — 5 คอลัมน์ค่าจริง
  const cpRows = (items||[]).map((it,i)=>{
    const isVis = !it.specMin && !it.specMax &&
      (it.actual==='OK'||it.actual==='NG'||it.actual==='');
    const okHtml = it.ok==='Y'
      ? `<span style="color:#16a34a;font-weight:800">✓ OK</span>`
      : it.ok==='N'
      ? `<span style="color:#dc2626;font-weight:800">✗ NG</span>`
      : '<span style="color:#bbb">—</span>';
    // แสดงค่า: visual → ✓/✗, numeric → ตัวเลข
    const vv = v => {
      if (!v || v==='') return '<span style="color:#bbb">—</span>';
      if (v==='OK') return '<span style="color:#16a34a;font-size:1rem;font-weight:900">✓</span>';
      if (v==='NG') return '<span style="color:#dc2626;font-size:1rem;font-weight:900">✗</span>';
      return `<strong>${v}</strong>`;
    };
    return `<tr>
      <td class="tc">${i+1}</td>
      <td class="tl">${it.checkPoint||''}</td>
      <td class="tc" style="${isVis?'color:#94a3b8;font-size:.65rem':''}">${isVis?'Visual':it.specMin||'—'}</td>
      <td class="tc">${isVis?'':it.specMax||'—'}</td>
      <td class="tc">${isVis?vv(it.actual):`<strong>${it.actual||'—'}</strong>`}</td>
      <td class="tc">${isVis?vv(it.a2):it.a2||'—'}</td>
      <td class="tc">${isVis?vv(it.a3):it.a3||'—'}</td>
      <td class="tc">${isVis?vv(it.a4):it.a4||'—'}</td>
      <td class="tc">${isVis?vv(it.a5):it.a5||'—'}</td>
      <td class="tc">${it.unit||'—'}</td>
      <td class="tc">${okHtml}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8">
<title>${h.inspId||'ใบตรวจ'}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Sarabun',sans-serif;font-size:11.5px;color:#1e293b;background:#fff;padding:12px 16px}

/* HEADER */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;
  padding-bottom:8px;border-bottom:3px solid #1e293b;margin-bottom:10px}
.co-name{font-size:1rem;font-weight:900}
.co-sub{font-size:.62rem;color:#555;margin-top:2px;line-height:1.5}
.doc-right{text-align:right}
.doc-type{font-size:.6rem;font-weight:800;color:#555;letter-spacing:.04em}
.doc-id{font-size:1.25rem;font-weight:900;letter-spacing:.01em}
.doc-date{font-size:.65rem;color:#666;margin-top:1px}

/* TOP ROW — order info ซ้าย, result badge ขวา */
.top-row{display:flex;gap:10px;margin-bottom:8px;align-items:flex-start}

/* ORDER BLOCK */
.order-block{flex:1;border:1.5px solid #cbd5e1;border-radius:8px;padding:10px 12px}
.ob-label{font-size:.58rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.ob-no{font-size:1.9rem;font-weight:900;line-height:1.05;margin:1px 0 3px}
.ob-spec{font-size:.78rem;color:#334155;font-weight:600;margin-bottom:7px;
  border-bottom:1px solid #e2e8f0;padding-bottom:6px}
.dims-row{display:flex;gap:7px;margin-bottom:6px}
.dim-box{border:1.5px solid #e2e8f0;border-radius:6px;padding:3px 10px;
  display:flex;flex-direction:column;align-items:center;background:#f8fafc;min-width:52px}
.dim-lbl{font-size:.55rem;font-weight:800;color:#94a3b8;text-transform:uppercase}
.dim-val{font-size:.95rem;font-weight:800;color:#0f172a}
.dim-box.wide{flex:1}
.ob-insp{font-size:.72rem;color:#555;margin-top:4px}

/* RESULT BADGE */
.result-badge{width:120px;flex-shrink:0;border:3px solid ${rc};border-radius:8px;
  padding:10px 6px;text-align:center;background:#fff}
.rb-lbl{font-size:.6rem;font-weight:800;color:${rc};text-transform:uppercase;letter-spacing:.04em}
.rb-icon{font-size:2.8rem;font-weight:900;color:${rc};line-height:1;display:block;margin:4px 0}
.rb-val{font-size:1.3rem;font-weight:900;color:${rc};letter-spacing:.08em}
.rb-sub{font-size:.6rem;color:${rc};margin-top:6px;opacity:.8;line-height:1.5}

/* PO IMAGE — เต็มความกว้าง ใหญ่ */
.po-img-box{border:2.5px solid #1e293b;border-radius:4px;width:100%;height:280px;
  display:flex;align-items:center;justify-content:center;
  margin-bottom:8px;background:#fafafa;overflow:hidden}
.po-img-box img{width:100%;height:100%;object-fit:contain;display:block}
.po-img-placeholder{display:flex;flex-direction:column;align-items:center;
  gap:8px;color:#94a3b8;font-size:1.1rem;font-weight:800;letter-spacing:.05em}
.po-img-placeholder span{font-size:2.5rem}

/* CHECK POINTS TABLE */
table.cp{width:100%;border-collapse:collapse;font-size:.75rem;margin-bottom:8px}
table.cp thead tr{background:#1e293b}
table.cp th{color:#fff;padding:5px 4px;font-size:.6rem;font-weight:700;white-space:nowrap}
table.cp th.tl{text-align:left;padding-left:7px}
table.cp th.tc{text-align:center}
table.cp td{padding:5px 4px;border-bottom:1px solid #e2e8f0;vertical-align:middle}
table.cp td.tl{text-align:left;padding-left:7px}
table.cp td.tc{text-align:center}
table.cp td.hi{font-weight:800}
table.cp tbody tr:nth-child(even) td{background:#f8fafc}

/* NOTE */
.note{border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;
  font-size:.72rem;margin-bottom:8px;color:#374151}

/* SIGNATURES */
.sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:16px}
.sign-box{text-align:center;font-size:.68rem;color:#64748b}
.sign-name{font-size:.7rem;color:#1e293b;font-weight:700;margin-top:3px}
.sign-line{border-top:1px solid #94a3b8;padding-top:5px;margin-top:26px}

@media print{
  body{padding:6px 10px}
  @page{size:A4 portrait;margin:7mm}
}
</style></head><body>

<!-- HEADER -->
<div class="hdr">
  <div>
    <div class="co-name">${coName}</div>
    <div class="co-sub">${[coAddr, coTax?'TAX ID: '+coTax:''].filter(Boolean).join(' | ')}</div>
  </div>
  <div class="doc-right">
    <div class="doc-type">${typeLabel}</div>
    <div class="doc-id">${h.inspId||'—'}</div>
    <div class="doc-date">${h.date||''}</div>
  </div>
</div>

<!-- ORDER + RESULT BADGE -->
<div class="top-row">
  <div class="order-block">
    <div class="ob-label">NO.PO / ORDER</div>
    <div class="ob-no">${h.orderId||'—'}</div>
    <div class="ob-spec">${spec||'(ไม่ระบุ Spec)'}</div>
    <div class="dims-row">
      ${od  ? `<div class="dim-box"><span class="dim-lbl">OD</span><span class="dim-val">${od}</span></div>`  : ''}
      ${id_ ? `<div class="dim-box"><span class="dim-lbl">ID</span><span class="dim-val">${id_}</span></div>` : ''}
      ${ht  ? `<div class="dim-box"><span class="dim-lbl">H</span><span class="dim-val">${ht}</span></div>`   : ''}
      <div class="dim-box">
        <span class="dim-lbl">จำนวน (ชิ้น)</span>
        <span class="dim-val">${h.orderQty||'—'}</span>
      </div>
    </div>
    <div class="ob-insp">👤 ผู้ตรวจ: <strong>${h.inspector||'—'}</strong></div>
  </div>
  <div class="result-badge">
    <div class="rb-lbl">ผลการตรวจ</div>
    <span class="rb-icon">${rcIcon}</span>
    <div class="rb-val">${h.result||'—'}</div>
    <div class="rb-sub">ตรวจ ${qtyCheck} ชิ้น<br>ผ่าน ${qtyPass} / NG ${qtyFail}</div>
  </div>
</div>

<!-- รูป PO เต็มกว้าง -->
<div class="po-img-box">
  ${imgSrc
    ? `<img src="${imgSrc}">`
    : `<div class="po-img-placeholder"><span>🖼</span>รูป PO</div>`
  }
</div>

<!-- CHECK POINTS TABLE -->
<table class="cp">
  <thead><tr>
    <th class="tc" style="width:22px">#</th>
    <th class="tl">Check Point</th>
    <th class="tc" style="width:52px">Min</th>
    <th class="tc" style="width:52px">Max</th>
    <th class="tc" style="width:58px">ค่าจริง 1</th>
    <th class="tc" style="width:50px">ค่าจริง 2</th>
    <th class="tc" style="width:50px">ค่าจริง 3</th>
    <th class="tc" style="width:50px">ค่าจริง 4</th>
    <th class="tc" style="width:50px">ค่าจริง 5</th>
    <th class="tc" style="width:42px">หน่วย</th>
    <th class="tc" style="width:54px">ผล</th>
  </tr></thead>
  <tbody>${cpRows}</tbody>
</table>

${h.note ? `<div class="note">📝 <strong>หมายเหตุ:</strong> ${h.note}</div>` : ''}

<!-- SIGNATURES -->
<div class="sign-row">
  <div class="sign-box"><div class="sign-line">ผู้ตรวจ<div class="sign-name">${h.inspector||''}</div></div></div>
  <div class="sign-box"><div class="sign-line">หัวหน้าฝ่ายผลิต<div class="sign-name"></div></div></div>
  <div class="sign-box"><div class="sign-line">QC / QA อนุมัติ<div class="sign-name"></div></div></div>
</div>

<script>(function(){
  function go(){ try{ window.focus(); window.print(); }catch(e){} }
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(go).catch(function(){ setTimeout(go,700); }); }
  else { setTimeout(go,700); }
})();<\/script>
</body></html>`;

  if (!win) {
    win = window.open('','_blank');
    if (!win) { alert('Browser บล็อก popup กรุณาอนุญาตก่อน'); return; }
  }
  imgSrc = imgSrc || '';
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* ── Delete inspection ──────────────────────────────────── */
async function _inspDelete(inspId) {
  const confirmed = await Swal.fire({
    title: 'ลบใบตรวจ?',
    html: `<div style="font-size:.9rem">เลขที่ <strong>${inspId}</strong><br><span style="color:#dc2626">ไม่สามารถกู้คืนได้</span></div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก',
  });
  if (!confirmed.isConfirmed) return;
  const url = _inspUrl();
  if (!url) return;
  Swal.fire({ title:'กำลังลบ...', didOpen:()=>Swal.showLoading(), allowOutsideClick:false });
  try {
    const r = await fetch(url, {
      method:'POST', mode:'cors',
      body: JSON.stringify({ action:'deleteInspection', inspId })
    });
    const d = await r.json();
    if (d.status !== 'ok') { Swal.fire('ผิดพลาด','ลบไม่สำเร็จ: ' + (d.message||''),'error'); return; }
    Swal.fire({ title:'ลบแล้ว', icon:'success', timer:1200, showConfirmButton:false });
    _inspList = _inspList.filter(x => x.inspId !== inspId);
    _inspRender();
  } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

/* ── Edit inspection: load data into form ───────────────── */
async function _inspEditLoad(inspId) {
  // ดึง header จาก cache ก่อน
  const hc = _inspList.find(x => x.inspId === inspId);
  // โหลด detail (ต้องการ items)
  const url = _inspUrl();
  if (!url) return;
  Swal.fire({ title:'กำลังโหลด...', didOpen:()=>Swal.showLoading(), allowOutsideClick:false });
  try {
    const r = await fetch(url + '?action=getInspectionDetail&inspId=' + encodeURIComponent(inspId));
    const d = await r.json();
    Swal.close();
    if (d.status !== 'ok' || !d.header) { Swal.fire('ผิดพลาด','ไม่พบข้อมูล','error'); return; }
    const h = d.header; const items = d.items || [];

    // เปิด panel ในโหมดแก้ไข แล้วค่อย prefill (ต้อง await เพื่อรอ DOM พร้อม)
    _inspEditId = inspId;
    await _inspOpenPanel();

    // prefill fields — ใช้ ID ที่ถูกต้องจาก form HTML
    const fType = document.getElementById('_ispFType');
    if (fType) fType.value = h.type || 'OQC';

    // orderId → select _ispFOrder (เลือก order ที่ตรงกับ noPO)
    const fOrder = document.getElementById('_ispFOrder');
    if (fOrder && h.orderId) {
      fOrder.value = h.orderId;
      _inspOnOrderChange(); // sync ชื่อสินค้า/spec
    }

    // วันที่ dd/MM/yyyy (BE) → yyyy-MM-dd (CE) สำหรับ input[date]
    const fDate = document.getElementById('_ispFDate');
    if (fDate) {
      const p = (h.date||'').split('/');
      if (p.length === 3) {
        const yr = parseInt(p[2]) > 2400 ? parseInt(p[2])-543 : parseInt(p[2]);
        fDate.value = `${yr}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      }
    }

    const fIns = document.getElementById('_ispFInspector');
    if (fIns) fIns.value = h.inspector || '';

    const fQC = document.getElementById('_ispFQtyC'); if (fQC) fQC.value = h.qtyCheck || '';
    const fQP = document.getElementById('_ispFQtyP'); if (fQP) fQP.value = h.qtyPass  || '';
    const fQF = document.getElementById('_ispFQtyF'); if (fQF) fQF.value = h.qtyFail  || '';

    // ผล: ใช้ button toggle
    _inspSelectResult(h.result || 'OK');

    const fNote = document.getElementById('_ispFNote');
    if (fNote) fNote.value = h.note || '';

    // load check points จากข้อมูลเดิม — ใช้ key ตาม _inspPoints schema (cp/smin/smax)
    _inspPoints = items.map(it => ({
      cp:     it.checkPoint || '',
      smin:   it.specMin    || '',
      smax:   it.specMax    || '',
      actual: it.actual     || '',
      a2:     it.a2         || '',
      a3:     it.a3         || '',
      a4:     it.a4         || '',
      a5:     it.a5         || '',
      unit:   it.unit       || '',
      ok:     it.ok         || '',
      vis:    it.specMin === '' && it.specMax === '' && (it.actual === 'OK' || it.actual === 'NG' || it.actual === ''),
    }));
    _inspRenderCpTable();
  } catch(e) { Swal.close(); Swal.fire('Error', e.message, 'error'); }
}

