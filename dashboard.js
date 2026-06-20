// dashboard.js — Sales Dashboard v9.66
// ดึงข้อมูลจาก Code.gs action=getSalesDashboard และแสดงผลใน tab-dashboard

let _dbChartBar   = null;
let _dbChartDonut = null;
let _dbLastData   = null;
let _dbMonths     = 6;
let _dbInited     = false;

// ── เรียกเมื่อสลับมาแท็บ dashboard ──────────────────────
async function _dbInit() {
  const el = document.getElementById('tab-dashboard');
  if (!el) return;
  if (!_dbInited) {
    el.innerHTML = _dbShell();
    _dbBindFilters();
    _dbInited = true;
  }
  await _dbLoad();
}

// ── HTML shell ───────────────────────────────────────────
function _dbShell() {
  return `
<div id="_dbWrap" style="max-width:960px;margin:0 auto;padding:12px 8px 40px">
  <!-- topbar -->
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
    <div style="font-size:1rem;font-weight:700;color:var(--c1)">📊 แดชบอร์ดยอดขาย</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="_dbMonthSel" onchange="_dbOnMonthChange()" style="font-size:.8rem;padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--t1)">
        <option value="3">3 เดือนล่าสุด</option>
        <option value="6" selected>6 เดือนล่าสุด</option>
        <option value="12">12 เดือนล่าสุด</option>
      </select>
      <button onclick="_dbLoad()" style="font-size:.8rem;padding:5px 12px;border-radius:8px;border:1px solid var(--c1);background:transparent;color:var(--c1);cursor:pointer">🔄 โหลดใหม่</button>
    </div>
  </div>

  <!-- สถานะโหลด -->
  <div id="_dbStatus" style="text-align:center;padding:32px;color:var(--t3);font-size:.85rem">⏳ กำลังโหลดข้อมูล...</div>

  <!-- KPI cards -->
  <div id="_dbKpiRow" style="display:none;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px"></div>

  <!-- Charts row -->
  <div id="_dbChartRow" style="display:none;grid-template-columns:1.65fr 1fr;gap:12px;margin-bottom:16px">
    <div class="db-card">
      <div class="db-sec">ยอดขายรายเดือน</div>
      <div id="_dbBarLegend" style="display:flex;gap:12px;flex-wrap:wrap;font-size:.72rem;color:var(--t3);margin-bottom:8px"></div>
      <div style="position:relative;width:100%;height:220px">
        <canvas id="_dbBarCanvas" role="img" aria-label="กราฟยอดขายรายเดือน">ข้อมูลยอดขายรายเดือน</canvas>
      </div>
    </div>
    <div class="db-card">
      <div class="db-sec">สัดส่วนสินค้า</div>
      <div id="_dbDonutLegend" style="display:flex;gap:8px;flex-wrap:wrap;font-size:.72rem;color:var(--t3);margin-bottom:8px"></div>
      <div style="position:relative;width:100%;height:190px">
        <canvas id="_dbDonutCanvas" role="img" aria-label="กราฟสัดส่วนสินค้า">สัดส่วนสินค้าตามยอดขาย</canvas>
      </div>
    </div>
  </div>

  <!-- Tables row -->
  <div id="_dbTablesRow" style="display:none;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="db-card">
      <div class="db-sec">สินค้าขายดี Top 5</div>
      <table id="_dbProdTable" class="db-tbl">
        <thead><tr><th style="width:24px">#</th><th>รายการ</th><th style="text-align:right">ยอด (฿)</th><th style="text-align:right">Order</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="db-card">
      <div class="db-sec">ลูกค้าสูงสุด Top 5</div>
      <table id="_dbCustTable" class="db-tbl">
        <thead><tr><th style="width:24px">#</th><th>ลูกค้า</th><th style="text-align:right">ยอด (฿)</th><th style="text-align:right">Order</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <!-- AI Analysis -->
  <div id="_dbAiCard" style="display:none"></div>
</div>

<style>
.db-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.db-sec{font-size:.72rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.db-kpi{background:var(--hover);border-radius:10px;padding:12px 14px}
.db-kpi-lbl{font-size:.72rem;color:var(--t3);margin-bottom:4px}
.db-kpi-val{font-size:1.4rem;font-weight:700;color:var(--t1);line-height:1.2}
.db-kpi-sub{font-size:.72rem;margin-top:3px}
.db-kpi-up{color:#10b981}.db-kpi-dn{color:#f87171}
.db-tbl{width:100%;font-size:.78rem;border-collapse:collapse}
.db-tbl th{font-size:.7rem;color:var(--t3);font-weight:600;text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)}
.db-tbl td{padding:5px 6px;border-bottom:1px solid var(--border);color:var(--t1);vertical-align:middle}
.db-tbl tr:last-child td{border-bottom:none}
.db-rank{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;font-size:.7rem;font-weight:700;background:var(--hover);color:var(--t3)}
.db-rank-1{background:rgba(251,191,36,.2);color:#d97706}
.db-rank-2{background:rgba(156,163,175,.2);color:#6b7280}
.db-rank-3{background:rgba(251,146,60,.2);color:#ea580c}
.db-ai{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--c1);border-radius:14px;padding:14px 16px}
.db-ai-title{font-size:.85rem;font-weight:700;color:var(--c1);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.db-ai-body{font-size:.8rem;color:var(--t2);line-height:1.75}
.db-tag{display:inline-block;font-size:.7rem;padding:2px 8px;border-radius:20px;margin:2px}
.db-tag-up{background:rgba(16,185,129,.15);color:#059669}
.db-tag-warn{background:rgba(245,158,11,.15);color:#d97706}
.db-tag-info{background:rgba(99,102,241,.15);color:var(--c1)}
@media(max-width:680px){
  #_dbChartRow,#_dbTablesRow{grid-template-columns:1fr!important}
}
</style>`;
}

// ── โหลดข้อมูลจาก backend ────────────────────────────────
async function _dbLoad() {
  const su = localStorage.getItem('ptts_script_url');
  if (!su) {
    _dbShowStatus('⚠️ ยังไม่ได้ตั้งค่า Script URL — ไปที่แท็บ ตั้งค่า');
    return;
  }
  _dbShowStatus('⏳ กำลังโหลดข้อมูล...');
  try {
    const url = su + '?action=getSalesDashboard&months=' + _dbMonths + '&t=' + Date.now();
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'error');
    _dbLastData = data;
    _dbHideStatus();
    _dbLoadChartJs(() => _dbRender(data));
  } catch(e) {
    _dbShowStatus('❌ โหลดข้อมูลไม่สำเร็จ: ' + e.message);
  }
}

function _dbShowStatus(msg) {
  const el = document.getElementById('_dbStatus');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  document.getElementById('_dbKpiRow')    && (document.getElementById('_dbKpiRow').style.display    = 'none');
  document.getElementById('_dbChartRow') && (document.getElementById('_dbChartRow').style.display  = 'none');
  document.getElementById('_dbTablesRow')&& (document.getElementById('_dbTablesRow').style.display = 'none');
  document.getElementById('_dbAiCard')   && (document.getElementById('_dbAiCard').style.display    = 'none');
}
function _dbHideStatus() {
  const el = document.getElementById('_dbStatus');
  if (el) el.style.display = 'none';
}

// ── Lazy-load Chart.js ───────────────────────────────────
function _dbLoadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  s.onload = cb;
  s.onerror = () => { _dbShowStatus('❌ โหลด Chart.js ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'); };
  document.head.appendChild(s);
}

// ── แสดงผลทั้งหมด ────────────────────────────────────────
function _dbRender(data) {
  _dbRenderKpi(data.kpi);
  _dbRenderBar(data.months);
  _dbRenderDonut(data.topProducts);
  _dbRenderTable('_dbProdTable', data.topProducts, 'workType');
  _dbRenderTable('_dbCustTable', data.topCustomers, 'customer');
  _dbRenderAi(data);
  // แสดงทุก section
  const show = (id, disp) => { const el = document.getElementById(id); if (el) el.style.display = disp; };
  show('_dbKpiRow',     'grid');
  show('_dbChartRow',   'grid');
  show('_dbTablesRow',  'grid');
  show('_dbAiCard',     'block');
}

// ── KPI cards ────────────────────────────────────────────
function _dbRenderKpi(kpi) {
  const wrap = document.getElementById('_dbKpiRow');
  if (!wrap) return;
  function pct(cur, prev) {
    if (!prev) return null;
    return Math.round((cur - prev) / prev * 100);
  }
  function pctBadge(p) {
    if (p === null) return '';
    const cls = p >= 0 ? 'db-kpi-up' : 'db-kpi-dn';
    const arrow = p >= 0 ? '▲' : '▼';
    return `<div class="db-kpi-sub ${cls}">${arrow} ${Math.abs(p)}% vs ช่วงก่อน</div>`;
  }
  const rev    = kpi.revenue || 0;
  const count  = kpi.count  || 0;
  const qty    = kpi.qty    || 0;
  const pRev   = pct(rev,   kpi.prevRevenue);
  const pCount = pct(count, kpi.prevCount);
  const pQty   = pct(qty,   kpi.prevQty);

  wrap.innerHTML = [
    { label:'ยอดขายรวม', val: _dbFmtBaht(rev),      sub: pctBadge(pRev),   icon:'💰' },
    { label:'จำนวน Order', val: count.toLocaleString(), sub: pctBadge(pCount), icon:'📦' },
    { label:'จำนวนชิ้น', val: qty.toLocaleString(),   sub: pctBadge(pQty),   icon:'🔩' },
  ].map(k => `
    <div class="db-kpi">
      <div class="db-kpi-lbl">${k.icon} ${k.label}</div>
      <div class="db-kpi-val">${k.val}</div>
      ${k.sub}
    </div>`).join('');
}

function _dbFmtBaht(n) {
  if (n >= 1000000) return '฿' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000)    return '฿' + (n / 1000).toFixed(1) + 'K';
  return '฿' + Math.round(n).toLocaleString();
}

// ── Bar chart (monthly) ──────────────────────────────────
const _DB_COLORS = ['#4f7cff','#34d399','#f59e0b','#f472b6','#a78bfa','#22d3ee'];
function _dbRenderBar(months) {
  const canvas = document.getElementById('_dbBarCanvas');
  if (!canvas) return;
  if (_dbChartBar) { _dbChartBar.destroy(); _dbChartBar = null; }

  // แปลง monthKey เป็น label ไทย
  const thLabels = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const labels  = months.map(m => { const p = m.monthKey.split('-'); return thLabels[parseInt(p[1])] || p[1]; });
  const revenue = months.map(m => Math.round(m.revenue || 0));
  const counts  = months.map(m => m.count || 0);

  const gridColor = _dbIsDark() ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const textColor = _dbIsDark() ? '#94a3b8' : '#64748b';

  _dbChartBar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'ยอดขาย (฿)', data: revenue, backgroundColor: '#4f7cff', borderRadius: 5, borderSkipped: false, yAxisID: 'y' },
        { label: 'จำนวน Order', data: counts,  backgroundColor: '#34d399', borderRadius: 5, borderSkipped: false, yAxisID: 'y2', type: 'line', tension: 0.3, pointRadius: 4, fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => ctx.dataset.label + ': ' + (ctx.dataset.yAxisID === 'y' ? '฿' + ctx.parsed.y.toLocaleString() : ctx.parsed.y + ' order')
        }}
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, autoSkip: false } },
        y: { position: 'left',  grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11 }, callback: v => _dbFmtBaht(v) }},
        y2:{ position: 'right', grid: { drawOnChartArea: false }, ticks: { color: textColor, font: { size: 10 }, callback: v => v + ' ord' }, beginAtZero: true }
      }
    }
  });

  // Legend
  const leg = document.getElementById('_dbBarLegend');
  if (leg) leg.innerHTML = [
    { color: '#4f7cff', label: 'ยอดขาย (฿)' },
    { color: '#34d399', label: 'จำนวน Order' }
  ].map(l => `<span style="display:flex;align-items:center;gap:4px">
    <span style="width:10px;height:10px;border-radius:2px;background:${l.color};display:inline-block"></span>${l.label}
  </span>`).join('');
}

// ── Donut chart (สัดส่วนสินค้า) ─────────────────────────
function _dbRenderDonut(topProducts) {
  const canvas = document.getElementById('_dbDonutCanvas');
  if (!canvas) return;
  if (_dbChartDonut) { _dbChartDonut.destroy(); _dbChartDonut = null; }
  if (!topProducts || !topProducts.length) return;

  const totalRev = topProducts.reduce((s, p) => s + p.revenue, 0);
  const labels   = topProducts.map(p => p.workType || '(ไม่ระบุ)');
  const dataVals = topProducts.map(p => Math.round(p.revenue));
  const colors   = _DB_COLORS.slice(0, topProducts.length);

  _dbChartDonut = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: dataVals, backgroundColor: colors, borderWidth: 1, borderColor: _dbIsDark() ? '#1e293b' : '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + (totalRev ? Math.round(ctx.parsed / totalRev * 100) : 0) + '%' }}
      }
    }
  });

  // Legend
  const leg = document.getElementById('_dbDonutLegend');
  if (leg) leg.innerHTML = topProducts.map((p, i) => {
    const pct = totalRev ? Math.round(p.revenue / totalRev * 100) : 0;
    return `<span style="display:flex;align-items:center;gap:3px">
      <span style="width:9px;height:9px;border-radius:2px;background:${colors[i]};display:inline-block"></span>
      ${(p.workType || '(ไม่ระบุ)').slice(0, 14)} ${pct}%
    </span>`;
  }).join('');
}

// ── Tables ───────────────────────────────────────────────
function _dbRenderTable(tableId, rows, nameKey) {
  const tbody = document.querySelector('#' + tableId + ' tbody');
  if (!tbody) return;
  if (!rows || !rows.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--t3);padding:12px">ไม่มีข้อมูล</td></tr>'; return; }
  const maxRev = rows[0].revenue || 1;
  tbody.innerHTML = rows.map((r, i) => {
    const rankCls = i === 0 ? 'db-rank-1' : i === 1 ? 'db-rank-2' : i === 2 ? 'db-rank-3' : '';
    const barW    = Math.round(r.revenue / maxRev * 36);
    return `<tr>
      <td><span class="db-rank ${rankCls}">${i+1}</span></td>
      <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[nameKey] || '(ไม่ระบุ)'}</td>
      <td style="text-align:right">${_dbFmtBaht(r.revenue)}</td>
      <td style="text-align:right">
        <span style="display:inline-block;width:${barW}px;height:5px;border-radius:3px;background:var(--c1);opacity:.7;vertical-align:middle;margin-right:4px"></span>
        ${r.count}
      </td>
    </tr>`;
  }).join('');
}

// ── AI Analysis (rule-based) ─────────────────────────────
function _dbRenderAi(data) {
  const el = document.getElementById('_dbAiCard');
  if (!el) return;
  const { kpi, topProducts, topCustomers, months } = data;
  if (!kpi) { el.innerHTML = ''; return; }

  const rev     = kpi.revenue || 0;
  const prevRev = kpi.prevRevenue || 0;
  const revPct  = prevRev ? Math.round((rev - prevRev) / prevRev * 100) : null;

  const tags = [];
  if (revPct !== null) {
    tags.push(revPct >= 0
      ? `<span class="db-tag db-tag-up">▲ ยอดขาย ${revPct >= 0 ? '+' : ''}${revPct}%</span>`
      : `<span class="db-tag db-tag-warn">▼ ยอดขาย ${revPct}%</span>`);
  }
  if (topProducts.length) {
    tags.push(`<span class="db-tag db-tag-info">⭐ ${(topProducts[0].workType||'?').slice(0,16)} ขายดีสุด</span>`);
  }
  if (topCustomers.length) {
    tags.push(`<span class="db-tag db-tag-info">👑 ${(topCustomers[0].customer||'?').slice(0,16)} ลูกค้าอันดับ 1</span>`);
  }

  // สร้างประโยควิเคราะห์
  let body = '';
  if (revPct !== null) {
    body += revPct >= 0
      ? `ยอดขาย ${_dbMonths} เดือนล่าสุดเติบโต <strong>+${revPct}%</strong> เทียบกับช่วงก่อนหน้า`
      : `ยอดขาย ${_dbMonths} เดือนล่าสุดลดลง <strong>${revPct}%</strong> เทียบกับช่วงก่อนหน้า`;
  } else {
    body += `ยอดขายรวม <strong>${_dbFmtBaht(rev)}</strong> ใน ${_dbMonths} เดือนล่าสุด`;
  }
  if (topProducts.length) {
    const top = topProducts[0];
    const pct = rev ? Math.round(top.revenue / rev * 100) : 0;
    body += ` — ขับเคลื่อนหลักโดย <strong>${top.workType || '?'}</strong> คิดเป็น ${pct}% ของยอดรวม`;
  }
  body += '.';
  if (topCustomers.length) {
    body += `<br>ลูกค้ารายใหญ่สุดคือ <strong>${topCustomers[0].customer || '?'}</strong> (${topCustomers[0].count} order)`;
    if (topCustomers.length > 1) body += ` ตามด้วย ${topCustomers[1].customer || '?'}`;
    body += '.';
  }
  if (revPct !== null && revPct < -10) {
    body += '<br>⚠️ ยอดขายลดลงมากกว่า 10% — ควรตรวจสอบสาเหตุและติดตามการสั่งซื้อของลูกค้ารายหลัก';
  }

  el.innerHTML = `
    <div class="db-ai">
      <div class="db-ai-title">✨ บทวิเคราะห์ AI</div>
      <div class="db-ai-body">${body}</div>
      <div style="margin-top:10px">${tags.join('')}</div>
    </div>`;
}

// ── Helpers ──────────────────────────────────────────────
function _dbIsDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ||
         document.body.classList.contains('dark') ||
         window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function _dbOnMonthChange() {
  const sel = document.getElementById('_dbMonthSel');
  if (sel) _dbMonths = parseInt(sel.value) || 6;
  _dbLoad();
}
function _dbBindFilters() {
  // filter ผูกผ่าน onchange inline
}
