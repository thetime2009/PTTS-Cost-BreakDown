// dashboard.js — Sales Dashboard v9.66 (UI Premium)
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
    _dbInited = true;
  }
  await _dbLoad();
}

// ── HTML shell ───────────────────────────────────────────
function _dbShell() {
  return `
<div id="_dbWrap">
  <div class="db-topbar">
    <span class="db-title">📊 แดชบอร์ดยอดขาย</span>
    <div class="db-topbar-right">
      <div class="db-time-toggle">
        <button class="db-tbtn" id="_dbT3"  onclick="_dbSetMonths(3)">3M</button>
        <button class="db-tbtn active" id="_dbT6"  onclick="_dbSetMonths(6)">6M</button>
        <button class="db-tbtn" id="_dbT12" onclick="_dbSetMonths(12)">12M</button>
      </div>
      <button class="db-btn-outline" onclick="_dbExportCSV()">⬇ CSV</button>
      <button class="db-btn-primary" id="_dbRefBtn" onclick="_dbLoad()">🔄 โหลดใหม่</button>
    </div>
  </div>

  <div id="_dbStatus" class="db-status-msg" style="display:none"></div>

  <div id="_dbSkeleton">
    <div class="db-skel-kpi-row">
      <div class="db-skel-box db-pulse" style="height:96px"></div>
      <div class="db-skel-box db-pulse" style="height:96px"></div>
      <div class="db-skel-box db-pulse" style="height:96px"></div>
    </div>
    <div class="db-skel-chart-row">
      <div class="db-skel-box db-pulse" style="height:290px;flex:1.65"></div>
      <div class="db-skel-box db-pulse" style="height:290px;flex:1"></div>
    </div>
    <div class="db-skel-chart-row">
      <div class="db-skel-box db-pulse" style="height:200px;flex:1"></div>
      <div class="db-skel-box db-pulse" style="height:200px;flex:1"></div>
    </div>
  </div>

  <div id="_dbKpiRow" style="display:none"></div>

  <div id="_dbChartRow" style="display:none">
    <div class="db-card db-chart-card">
      <div class="db-card-header">
        <span class="db-sec">ยอดขายรายเดือน</span>
        <div id="_dbBarLegend" class="db-legend"></div>
      </div>
      <div class="db-chart-wrap" style="height:240px">
        <canvas id="_dbBarCanvas" role="img" aria-label="กราฟยอดขายรายเดือน">ข้อมูลยอดขายรายเดือน</canvas>
      </div>
    </div>
    <div class="db-card">
      <div class="db-card-header"><span class="db-sec">สัดส่วนสินค้า</span></div>
      <div id="_dbDonutLegend" class="db-legend" style="margin-bottom:8px"></div>
      <div class="db-chart-wrap" style="height:210px">
        <canvas id="_dbDonutCanvas" role="img" aria-label="กราฟสัดส่วนสินค้า">สัดส่วนสินค้าตามยอดขาย</canvas>
      </div>
    </div>
  </div>

  <div id="_dbTablesRow" style="display:none">
    <div class="db-card">
      <div class="db-card-header"><span class="db-sec">🏆 สินค้าขายดี Top 5</span></div>
      <table id="_dbProdTable" class="db-tbl">
        <thead><tr>
          <th style="width:28px">#</th><th>รายการ</th><th>สเปก</th>
          <th style="text-align:right">ยอด (฿)</th><th style="width:90px">สัดส่วน</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="db-card">
      <div class="db-card-header"><span class="db-sec">👥 ลูกค้าสูงสุด Top 5</span></div>
      <table id="_dbCustTable" class="db-tbl">
        <thead><tr>
          <th style="width:28px">#</th><th>ลูกค้า</th>
          <th style="text-align:right">ยอด (฿)</th><th style="width:90px">สัดส่วน</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <div id="_dbAiCard" style="display:none"></div>
</div>

<style>
#_dbWrap{padding:16px 20px 48px}
.db-topbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.db-topbar-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.db-title{font-size:1.05rem;font-weight:800;color:var(--c1);letter-spacing:-.3px}
.db-time-toggle{display:flex;background:var(--hover);border-radius:20px;padding:3px;gap:2px}
.db-tbtn{font-size:.75rem;font-weight:700;padding:4px 13px;border-radius:16px;border:none;background:transparent;color:var(--t3);cursor:pointer;transition:all .15s}
.db-tbtn.active{background:var(--c1);color:#fff}
.db-btn-primary{font-size:.8rem;padding:6px 14px;border-radius:20px;border:none;background:var(--c1);color:#fff;cursor:pointer;font-weight:700;transition:all .15s}
.db-btn-primary:hover{opacity:.85;transform:translateY(-1px)}
.db-btn-outline{font-size:.8rem;padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--t2);cursor:pointer;font-weight:600;transition:all .15s}
.db-btn-outline:hover{border-color:var(--c1);color:var(--c1);transform:translateY(-1px)}
.db-status-msg{text-align:center;padding:48px;font-size:.9rem;color:var(--t3)}
.db-skel-kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}
.db-skel-chart-row{display:flex;gap:12px;margin-bottom:12px}
.db-skel-box{background:var(--hover);border-radius:16px}
@keyframes dbPulse{0%,100%{opacity:.65}50%{opacity:.3}}
.db-pulse{animation:dbPulse 1.5s ease-in-out infinite}
.db-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,.05);transition:box-shadow .2s,transform .2s;margin-bottom:12px}
.db-card:hover{box-shadow:0 8px 28px rgba(0,0,0,.1);transform:translateY(-2px)}
.db-chart-card{margin-bottom:0}
.db-card-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.db-sec{font-size:.72rem;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.06em}
.db-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:.72rem;color:var(--t3)}
#_dbKpiRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:12px}
.db-kpi{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px;box-shadow:0 2px 10px rgba(0,0,0,.05);transition:box-shadow .2s,transform .2s;display:flex;align-items:center;gap:14px}
.db-kpi:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}
.db-kpi-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0}
.db-kpi-body{flex:1;min-width:0}
.db-kpi-lbl{font-size:.7rem;color:var(--t3);margin-bottom:1px;font-weight:600}
.db-kpi-val{font-size:1.85rem;font-weight:800;color:var(--t1);line-height:1.15;letter-spacing:-.5px}
.db-kpi-sub{font-size:.72rem;margin-top:3px;font-weight:600}
.db-kpi-up{color:#10b981}.db-kpi-dn{color:#f87171}
#_dbChartRow{display:grid;grid-template-columns:1.65fr 1fr;gap:12px;margin-bottom:12px}
.db-chart-wrap{position:relative;width:100%}
#_dbTablesRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.db-tbl{width:100%;font-size:.8rem;border-collapse:collapse}
.db-tbl th{font-size:.7rem;color:var(--t3);font-weight:700;text-align:left;padding:6px 8px;border-bottom:1.5px solid var(--border);white-space:nowrap}
.db-tbl td{padding:8px 8px;border-bottom:1px solid var(--border);color:var(--t1);vertical-align:middle}
.db-tbl tr:last-child td{border-bottom:none}
.db-tbl tbody tr{transition:background .12s;cursor:default}
.db-tbl tbody tr:hover td{background:var(--hover)}
.db-rank{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:.72rem;font-weight:800;background:var(--hover);color:var(--t3)}
.db-rank-1{background:linear-gradient(135deg,#fde68a,#f59e0b);color:#78350f}
.db-rank-2{background:linear-gradient(135deg,#e2e8f0,#cbd5e1);color:#475569}
.db-rank-3{background:linear-gradient(135deg,#fed7aa,#fb923c);color:#7c2d12}
.db-pbar-wrap{display:flex;align-items:center;gap:6px}
.db-pbar-bg{flex:1;height:7px;border-radius:4px;background:var(--hover);overflow:hidden}
.db-pbar-fill{height:100%;border-radius:4px;background:var(--c1);opacity:.8}
.db-ai-card{border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,rgba(99,102,241,.07),rgba(59,130,246,.04));border:1.5px solid rgba(99,102,241,.18);box-shadow:0 2px 14px rgba(99,102,241,.08)}
.db-ai-title{font-size:.88rem;font-weight:800;color:var(--c1);margin-bottom:14px;display:flex;align-items:center;gap:7px}
.db-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.db-ai-sec-title{font-size:.7rem;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.db-ai-body{font-size:.8rem;color:var(--t2);line-height:1.8}
.db-tag{display:inline-block;font-size:.7rem;padding:3px 10px;border-radius:20px;margin:2px;font-weight:700}
.db-tag-up{background:rgba(16,185,129,.15);color:#059669}
.db-tag-warn{background:rgba(245,158,11,.15);color:#d97706}
.db-tag-info{background:rgba(99,102,241,.15);color:var(--c1)}
@media(max-width:860px){
  #_dbChartRow,#_dbTablesRow,#_dbKpiRow,.db-ai-grid{grid-template-columns:1fr!important}
  .db-skel-chart-row{flex-direction:column}
}
@media(max-width:520px){
  .db-skel-kpi-row{grid-template-columns:1fr!important}
  .db-kpi-val{font-size:1.5rem}
}
</style>`;
}

// ── โหลดข้อมูลจาก backend ────────────────────────────────
async function _dbLoad() {
  const su = localStorage.getItem('ptts_script_url');
  if (!su) { _dbShowErr('⚠️ ยังไม่ได้ตั้งค่า Script URL — ไปที่แท็บ ตั้งค่า'); return; }
  _dbShowSkeleton();
  const btn = document.getElementById('_dbRefBtn');
  if (btn) btn.textContent = '⏳ กำลังโหลด...';
  try {
    const url  = su + '?action=getSalesDashboard&months=' + _dbMonths + '&t=' + Date.now();
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'backend error');
    _dbLastData = data;
    _dbHideSkeleton();
    _dbLoadChartJs(() => _dbRender(data));
  } catch(e) {
    _dbShowErr('❌ โหลดข้อมูลไม่สำเร็จ: ' + e.message);
  } finally {
    if (btn) btn.textContent = '🔄 โหลดใหม่';
  }
}

function _dbShowSkeleton() {
  const sk = document.getElementById('_dbSkeleton');
  if (sk) sk.style.display = '';
  ['_dbKpiRow','_dbChartRow','_dbTablesRow','_dbAiCard','_dbStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function _dbHideSkeleton() {
  const sk = document.getElementById('_dbSkeleton');
  if (sk) sk.style.display = 'none';
}
function _dbShowErr(msg) {
  _dbHideSkeleton();
  const el = document.getElementById('_dbStatus');
  if (el) { el.innerHTML = msg; el.style.display = 'block'; }
}

// ── Lazy-load Chart.js ───────────────────────────────────
function _dbLoadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  s.onload = cb;
  s.onerror = () => _dbShowErr('❌ โหลด Chart.js ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
  document.head.appendChild(s);
}

// ── แสดงผลทั้งหมด ────────────────────────────────────────
function _dbRender(data) {
  _dbRenderKpi(data.kpi);
  _dbRenderBar(data.months);
  _dbRenderDonut(data.topProducts);
  _dbRenderProdTable(data.topProducts, data.kpi);
  _dbRenderCustTable(data.topCustomers, data.kpi);
  _dbRenderAi(data);
  const show = (id, d) => { const e = document.getElementById(id); if (e) e.style.display = d; };
  show('_dbKpiRow',    'grid');
  show('_dbChartRow',  'grid');
  show('_dbTablesRow', 'grid');
  show('_dbAiCard',    'block');
}

// ── KPI cards ────────────────────────────────────────────
const _DB_KPI_CFG = [
  { key:'revenue',  label:'ยอดขายรวม',   icon:'💰', iconBg:'rgba(79,124,255,.12)' },
  { key:'count',    label:'จำนวน Order',  icon:'📦', iconBg:'rgba(16,185,129,.12)' },
  { key:'qty',      label:'จำนวนชิ้น',   icon:'🔩', iconBg:'rgba(245,158,11,.12)' },
];
function _dbRenderKpi(kpi) {
  const wrap = document.getElementById('_dbKpiRow');
  if (!wrap || !kpi) return;
  const prevMap = { revenue: kpi.prevRevenue, count: kpi.prevCount, qty: kpi.prevQty };
  wrap.innerHTML = _DB_KPI_CFG.map(cfg => {
    const cur  = kpi[cfg.key] || 0;
    const prev = prevMap[cfg.key] || 0;
    const pct  = prev ? Math.round((cur - prev) / prev * 100) : null;
    const pctHtml = pct !== null
      ? `<div class="db-kpi-sub ${pct >= 0 ? 'db-kpi-up' : 'db-kpi-dn'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs ช่วงก่อน</div>`
      : '';
    const valFmt = cfg.key === 'revenue' ? _dbFmtBaht(cur)
                 : cfg.key === 'count'   ? cur.toLocaleString() + ' รายการ'
                 : cur.toLocaleString() + ' ชิ้น';
    return `<div class="db-kpi">
      <div class="db-kpi-icon" style="background:${cfg.iconBg}">${cfg.icon}</div>
      <div class="db-kpi-body">
        <div class="db-kpi-lbl">${cfg.label}</div>
        <div class="db-kpi-val">${valFmt}</div>
        ${pctHtml}
      </div>
    </div>`;
  }).join('');
}

function _dbFmtBaht(n) {
  if (n >= 1000000) return '฿' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000)    return '฿' + (n / 1000).toFixed(1) + 'K';
  return '฿' + Math.round(n).toLocaleString();
}

// ── Bar chart ────────────────────────────────────────────
const _DB_COLORS = ['#4f7cff','#34d399','#f59e0b','#f472b6','#a78bfa','#22d3ee'];
function _dbRenderBar(months) {
  const canvas = document.getElementById('_dbBarCanvas');
  if (!canvas) return;
  if (_dbChartBar) { _dbChartBar.destroy(); _dbChartBar = null; }
  const thLbl = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const labels  = months.map(m => thLbl[parseInt(m.monthKey.split('-')[1])] || m.monthKey.split('-')[1]);
  const revenue = months.map(m => Math.round(m.revenue || 0));
  const counts  = months.map(m => m.count || 0);
  const avgRev  = revenue.length ? Math.round(revenue.reduce((a, b) => a + b, 0) / revenue.length) : 0;
  const avgLine = revenue.map(() => avgRev);
  const gridC   = _dbIsDark() ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const textC   = _dbIsDark() ? '#94a3b8' : '#64748b';
  _dbChartBar = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        { type:'bar',  label:'ยอดขาย (฿)', data:revenue, backgroundColor:'#4f7cff', borderRadius:6, borderSkipped:false, yAxisID:'y' },
        { type:'line', label:'จำนวน Order', data:counts,  borderColor:'#34d399', backgroundColor:'rgba(52,211,153,.15)', tension:.4, pointRadius:4, pointBackgroundColor:'#34d399', fill:true, yAxisID:'y2' },
        { type:'line', label:'ค่าเฉลี่ย', data:avgLine, borderColor:'rgba(245,158,11,.7)', borderDash:[6,4], tension:0, pointRadius:0, yAxisID:'y' }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label: ctx => {
          if (ctx.dataset.yAxisID === 'y') return ctx.dataset.label + ': ฿' + ctx.parsed.y.toLocaleString();
          return ctx.dataset.label + ': ' + ctx.parsed.y;
        }}}
      },
      scales:{
        x:{ grid:{ color:gridC }, ticks:{ color:textC, font:{ size:11 }, autoSkip:false }},
        y:{ position:'left',  grid:{ color:gridC }, ticks:{ color:textC, font:{ size:11 }, callback: v => _dbFmtBaht(v) }},
        y2:{ position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:textC, font:{ size:10 }, callback: v => v + ' ord' }, beginAtZero:true }
      }
    }
  });
  const leg = document.getElementById('_dbBarLegend');
  if (leg) leg.innerHTML = [
    { c:'#4f7cff', l:'ยอดขาย (฿)' },
    { c:'#34d399', l:'จำนวน Order' },
    { c:'rgba(245,158,11,.8)', l:'ค่าเฉลี่ย', dash:true }
  ].map(x => `<span style="display:flex;align-items:center;gap:4px">
    <span style="width:${x.dash?'18px':'10px'};height:${x.dash?'2px':'10px'};border-radius:2px;background:${x.c};display:inline-block;${x.dash?'border-top:2px dashed '+x.c+';background:transparent':''}"></span>${x.l}
  </span>`).join('');
}

// ── Donut chart ──────────────────────────────────────────
function _dbRenderDonut(topProducts) {
  const canvas = document.getElementById('_dbDonutCanvas');
  if (!canvas || !topProducts || !topProducts.length) return;
  if (_dbChartDonut) { _dbChartDonut.destroy(); _dbChartDonut = null; }
  const totalRev = topProducts.reduce((s, p) => s + p.revenue, 0);
  const labels   = topProducts.map(p => p.workType || '(ไม่ระบุ)');
  const vals     = topProducts.map(p => Math.round(p.revenue));
  const colors   = _DB_COLORS.slice(0, topProducts.length);
  const isDark   = _dbIsDark();

  const centerPlugin = {
    id: '_dbDonutCenter',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top  + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(_dbFmtBaht(totalRev), cx, cy - 8);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.fillText('ยอดรวม', cx, cy + 10);
      ctx.restore();
    }
  };

  _dbChartDonut = new Chart(canvas, {
    type: 'doughnut',
    plugins: [centerPlugin],
    data: { labels, datasets: [{ data:vals, backgroundColor:colors, borderWidth:1.5, borderColor: isDark ? '#1e293b':'#fff', hoverBorderWidth:0, hoverOffset:8 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => ctx.label + ': ' + (totalRev ? Math.round(ctx.parsed/totalRev*100) : 0) + '%' }}}
    }
  });
  const leg = document.getElementById('_dbDonutLegend');
  if (leg) leg.innerHTML = topProducts.map((p, i) => {
    const pct = totalRev ? Math.round(p.revenue / totalRev * 100) : 0;
    return `<span style="display:flex;align-items:center;gap:3px">
      <span style="width:9px;height:9px;border-radius:2px;background:${colors[i]};display:inline-block;flex-shrink:0"></span>
      ${(p.workType||'?').slice(0,12)} ${pct}%
    </span>`;
  }).join('');
}

// ── Table: สินค้า ────────────────────────────────────────
function _dbRenderProdTable(rows, kpi) {
  const tbody = document.querySelector('#_dbProdTable tbody');
  if (!tbody) return;
  if (!rows || !rows.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:16px">ไม่มีข้อมูล</td></tr>'; return; }
  const totalRev = (kpi && kpi.revenue) ? kpi.revenue : (rows.reduce((s, r) => s + r.revenue, 0) || 1);
  tbody.innerHTML = rows.map((r, i) => {
    const pct     = Math.round(r.revenue / totalRev * 100);
    const rankCls = i === 0 ? 'db-rank-1' : i === 1 ? 'db-rank-2' : i === 2 ? 'db-rank-3' : '';
    return `<tr>
      <td><span class="db-rank ${rankCls}">${i+1}</span></td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.workType || '(ไม่ระบุ)'}</td>
      <td style="font-size:.7rem;color:var(--t3);white-space:nowrap">${r.specText || '—'}</td>
      <td style="text-align:right;font-weight:700">${_dbFmtBaht(r.revenue)}</td>
      <td>
        <div class="db-pbar-wrap">
          <div class="db-pbar-bg"><div class="db-pbar-fill" style="width:${pct}%"></div></div>
          <span style="font-size:.7rem;color:var(--t3);min-width:28px;text-align:right">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Table: ลูกค้า ────────────────────────────────────────
function _dbRenderCustTable(rows, kpi) {
  const tbody = document.querySelector('#_dbCustTable tbody');
  if (!tbody) return;
  if (!rows || !rows.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--t3);padding:16px">ไม่มีข้อมูล</td></tr>'; return; }
  const totalRev = (kpi && kpi.revenue) ? kpi.revenue : (rows.reduce((s, r) => s + r.revenue, 0) || 1);
  tbody.innerHTML = rows.map((r, i) => {
    const pct     = Math.round(r.revenue / totalRev * 100);
    const rankCls = i === 0 ? 'db-rank-1' : i === 1 ? 'db-rank-2' : i === 2 ? 'db-rank-3' : '';
    return `<tr>
      <td><span class="db-rank ${rankCls}">${i+1}</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.customer || '(ไม่ระบุ)'}</td>
      <td style="text-align:right;font-weight:700">${_dbFmtBaht(r.revenue)}</td>
      <td>
        <div class="db-pbar-wrap">
          <div class="db-pbar-bg"><div class="db-pbar-fill" style="width:${pct}%;background:#34d399"></div></div>
          <span style="font-size:.7rem;color:var(--t3);min-width:28px;text-align:right">${r.count}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── AI Analysis card ─────────────────────────────────────
function _dbRenderAi(data) {
  const el = document.getElementById('_dbAiCard');
  if (!el) return;
  const { kpi, topProducts, topCustomers } = data;
  if (!kpi) { el.innerHTML = ''; return; }
  const rev     = kpi.revenue || 0;
  const prevRev = kpi.prevRevenue || 0;
  const revPct  = prevRev ? Math.round((rev - prevRev) / prevRev * 100) : null;

  // Insight
  let insight = '';
  if (revPct !== null) {
    insight += revPct >= 0
      ? `ยอดขาย ${_dbMonths} เดือนล่าสุดเติบโต <strong>+${revPct}%</strong> เทียบกับช่วงก่อนหน้า`
      : `ยอดขาย ${_dbMonths} เดือนล่าสุดลดลง <strong>${revPct}%</strong> เทียบกับช่วงก่อนหน้า`;
  } else {
    insight += `ยอดขายรวม <strong>${_dbFmtBaht(rev)}</strong> ใน ${_dbMonths} เดือนล่าสุด`;
  }
  if (topProducts && topProducts.length) {
    const tp  = topProducts[0];
    const pct = rev ? Math.round(tp.revenue / rev * 100) : 0;
    insight += ` ขับเคลื่อนหลักโดย <strong>${tp.workType || '?'}</strong> คิดเป็น ${pct}% ของยอดรวม`;
  }
  if (topCustomers && topCustomers.length) {
    insight += `<br>ลูกค้าหลักคือ <strong>${topCustomers[0].customer || '?'}</strong> (${topCustomers[0].count} order, คิดเป็น ${rev ? Math.round(topCustomers[0].revenue/rev*100) : 0}% ของยอดรวม)`;
  }

  // Recommendation
  let rec = '';
  if (revPct !== null && revPct < -10) {
    rec = '⚠️ ยอดขายลดลงมากกว่า 10% — ควรตรวจสอบสาเหตุและติดต่อลูกค้ารายหลักเพื่อกระตุ้นยอด';
  } else if (revPct !== null && revPct > 20) {
    rec = '🎯 ยอดขายเติบโตดี — ควรวางแผนกำลังการผลิตให้พร้อมรองรับ Order ที่อาจเพิ่มขึ้น';
  } else {
    rec = '📌 รักษายอดขายด้วยการติดตาม Order ที่ค้างอยู่ และเสนอราคาลูกค้าเก่าให้ครบทุกราย';
  }
  if (topCustomers && topCustomers.length >= 2 && topCustomers[0].revenue > rev * 0.5) {
    rec += '<br>💡 ลูกค้ารายเดียวมียอดเกิน 50% — ควรกระจายฐานลูกค้าเพื่อลดความเสี่ยง';
  }

  // Tags
  const tags = [];
  if (revPct !== null) tags.push(revPct >= 0 ? `<span class="db-tag db-tag-up">▲ ยอดขาย +${revPct}%</span>` : `<span class="db-tag db-tag-warn">▼ ยอดขาย ${revPct}%</span>`);
  if (topProducts && topProducts.length) tags.push(`<span class="db-tag db-tag-info">⭐ ${(topProducts[0].workType||'?').slice(0,14)} ขายดีสุด</span>`);
  if (topCustomers && topCustomers.length) tags.push(`<span class="db-tag db-tag-info">👑 ${(topCustomers[0].customer||'?').slice(0,14)} ลูกค้าอันดับ 1</span>`);

  el.innerHTML = `
    <div class="db-ai-card">
      <div class="db-ai-title">✨ บทวิเคราะห์ AI</div>
      <div class="db-ai-grid">
        <div>
          <div class="db-ai-sec-title">📊 วิเคราะห์</div>
          <div class="db-ai-body">${insight}</div>
        </div>
        <div>
          <div class="db-ai-sec-title">💡 คำแนะนำ</div>
          <div class="db-ai-body">${rec}</div>
        </div>
      </div>
      <div style="margin-top:12px">${tags.join('')}</div>
    </div>`;
}

// ── Export CSV ───────────────────────────────────────────
function _dbExportCSV() {
  if (!_dbLastData) { alert('ยังไม่มีข้อมูล กด โหลดใหม่ ก่อน'); return; }
  const { months, topProducts, topCustomers } = _dbLastData;
  const thLbl = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  let csv = '﻿'; // BOM for Thai
  csv += 'ยอดขายรายเดือน\n';
  csv += 'เดือน,ยอดขาย (฿),จำนวน Order,จำนวนชิ้น\n';
  months.forEach(m => {
    const lbl = thLbl[parseInt(m.monthKey.split('-')[1])] || m.monthKey;
    csv += `${lbl},${Math.round(m.revenue)},${m.count},${Math.round(m.qty)}\n`;
  });
  csv += '\nสินค้าขายดี Top 5\n';
  csv += 'อันดับ,รายการ,สเปก,ยอดขาย (฿),Order\n';
  topProducts.forEach((p, i) => { csv += `${i+1},"${p.workType||''}","${p.specText||''}",${Math.round(p.revenue)},${p.count}\n`; });
  csv += '\nลูกค้าสูงสุด Top 5\n';
  csv += 'อันดับ,ลูกค้า,ยอดขาย (฿),Order\n';
  topCustomers.forEach((c, i) => { csv += `${i+1},"${c.customer||''}",${Math.round(c.revenue)},${c.count}\n`; });
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'sales_dashboard.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Helpers ──────────────────────────────────────────────
function _dbIsDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ||
         document.body.classList.contains('dark') ||
         window.matchMedia('(prefers-color-scheme:dark)').matches;
}
function _dbSetMonths(n) {
  _dbMonths = n;
  ['3','6','12'].forEach(v => {
    const b = document.getElementById('_dbT' + v);
    if (b) b.classList.toggle('active', String(n) === v);
  });
  _dbLoad();
}
