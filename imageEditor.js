// ══════════════════════════════════════════════════════════════
// imageEditor.js — Canvas Image Editor (PO redact / annotate)
// ══════════════════════════════════════════════════════════════

var _ieCanvas      = null;
var _ieCtx         = null;
var _ieHistory     = [];
var _ieTool        = 'redact';
var _ieDrawColor   = '#ff0000';   // สีสำหรับ draw/text
var _ieRedactColor = '#ffffff';   // สีสำหรับ redact (ขาว/ดำ)
var _ieLineW       = 6;
var _ieIsDown      = false;
var _ieStartX      = 0, _ieStartY = 0;
var _iePreSnap     = null;
var _ieSaveCb      = null;

// ── เปิด editor ───────────────────────────────────────────────
function _imgEditorOpen(imgSrc, onSave) {
  if (document.getElementById('_imgEditorOverlay')) return;
  _ieSaveCb      = onSave;
  _ieHistory     = [];
  _ieTool        = 'redact';
  _ieDrawColor   = '#ff0000';
  _ieRedactColor = '#ffffff';
  _ieLineW       = 6;
  _ieIsDown      = false;
  _iePreSnap     = null;

  var btnBase  = 'padding:7px 14px;border-radius:8px;font-family:Sarabun,sans-serif;font-size:.8rem;font-weight:700;cursor:pointer;transition:background .15s;';
  var btnGhost = btnBase + 'border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#f1f5f9;';

  var ov = document.createElement('div');
  ov.id = '_imgEditorOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,12,20,.96);display:flex;flex-direction:column;font-family:Sarabun,sans-serif';

  ov.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;' +
      'background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap">' +
      '<span style="font-size:.85rem;font-weight:700;color:#f1f5f9;margin-right:4px">✏️ แก้ไขรูป PO</span>' +
      '<button id="_ieTool_redact" onclick="_ieSetTool(\'redact\')" style="' + btnGhost + '">⬛ Redact</button>' +
      '<button id="_ieTool_draw"   onclick="_ieSetTool(\'draw\')"   style="' + btnGhost + '">✏️ วาด</button>' +
      '<button id="_ieTool_text"   onclick="_ieSetTool(\'text\')"   style="' + btnGhost + '">🔤 ข้อความ</button>' +
      // Redact color: ขาว/ดำ — แสดงเมื่อ tool=redact
      '<div id="_ieRedactColors" style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06)">' +
        '<span style="font-size:.7rem;color:rgba(255,255,255,.45)">สี</span>' +
        '<button id="_ieRed_black" onclick="_iePickRedact(\'#000000\')" title="ดำ"' +
          ' style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:#000;cursor:pointer"></button>' +
        '<button id="_ieRed_white" onclick="_iePickRedact(\'#ffffff\')" title="ขาว"' +
          ' style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:#fff;cursor:pointer;box-shadow:0 0 0 2px rgba(255,255,255,.6)"></button>' +
      '</div>' +
      // Draw/Text color picker — แสดงเมื่อ tool=draw/text
      '<div id="_ieDrawColors" style="display:none;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06)">' +
        '<span style="font-size:.7rem;color:rgba(255,255,255,.45)">สี</span>' +
        '<input type="color" value="#ff0000" oninput="_ieDrawColor=this.value"' +
          ' style="width:28px;height:22px;border:none;padding:0;cursor:pointer;background:none;border-radius:4px">' +
      '</div>' +
      '<select onchange="_ieLineW=parseInt(this.value)"' +
        ' style="padding:5px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#f1f5f9;font-family:Sarabun,sans-serif;font-size:.75rem">' +
        '<option value="3">เส้นบาง</option>' +
        '<option value="6" selected>เส้นกลาง</option>' +
        '<option value="14">เส้นหนา</option>' +
      '</select>' +
      '<button onclick="_ieUndo()" style="' + btnGhost + '">↩ Undo</button>' +
      '<div style="flex:1"></div>' +
      '<button onclick="_ieCancel()" style="' + btnGhost + 'border-color:rgba(239,68,68,.35);color:#fca5a5">✕ ยกเลิก</button>' +
      '<button onclick="_ieSaveAndClose()" style="padding:7px 20px;border-radius:8px;border:none;' +
        'background:#16a34a;color:#fff;font-family:Sarabun,sans-serif;font-size:.85rem;font-weight:700;cursor:pointer">' +
        '✅ บันทึก' +
      '</button>' +
    '</div>' +
    '<div style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:14px">' +
      '<canvas id="_ieCanvas" style="max-width:100%;max-height:calc(100vh - 100px);display:block;' +
        'box-shadow:0 0 0 1.5px rgba(255,255,255,.12);cursor:crosshair"></canvas>' +
    '</div>' +
    '<div style="padding:5px 14px;background:rgba(0,0,0,.3);font-size:.7rem;color:rgba(255,255,255,.3);text-align:center">' +
      'Redact: ลากคลุมพื้นที่ที่ต้องปิดบัง &nbsp;·&nbsp; วาด: เพิ่มหมายเหตุ/ลูกศร &nbsp;·&nbsp; ข้อความ: คลิกแล้วพิมพ์' +
    '</div>';

  document.body.appendChild(ov);

  _ieCanvas = document.getElementById('_ieCanvas');
  _ieCtx    = _ieCanvas.getContext('2d');

  var img = new Image();
  img.onload = function() {
    _ieCanvas.width  = img.naturalWidth  || img.width  || 800;
    _ieCanvas.height = img.naturalHeight || img.height || 600;
    _ieCtx.drawImage(img, 0, 0);
    _ieHistory = [_ieCtx.getImageData(0, 0, _ieCanvas.width, _ieCanvas.height)];
    _ieUpdateBtns();
  };
  img.onerror = function() {
    _ieCloseOverlay();
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon:'warning', title:'โหลดรูปไม่ได้',
        html:'ไม่สามารถแก้ไขรูปจาก Drive URL โดยตรงได้<br><small style="color:#94a3b8">เลือกไฟล์ใหม่ก่อน แล้วค่อยกด ✏️ แก้ไขรูป</small>',
        confirmButtonText:'ตกลง' });
    }
  };
  img.src = imgSrc;

  _ieCanvas.addEventListener('mousedown',  _ieDown);
  _ieCanvas.addEventListener('mousemove',  _ieMove);
  _ieCanvas.addEventListener('mouseup',    _ieUp);
  _ieCanvas.addEventListener('mouseleave', _ieUp);
  _ieCanvas.addEventListener('click',      _ieClick);
  _ieCanvas.addEventListener('touchstart', _ieTouchDown, {passive:false});
  _ieCanvas.addEventListener('touchmove',  _ieTouchMove,  {passive:false});
  _ieCanvas.addEventListener('touchend',   _ieTouchUp);
}

// ── coordinate helper ─────────────────────────────────────────
function _ieGetPos(e) {
  var rect = _ieCanvas.getBoundingClientRect();
  var sx   = _ieCanvas.width  / rect.width;
  var sy   = _ieCanvas.height / rect.height;
  var src  = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
}

// ── history ───────────────────────────────────────────────────
function _ieSaveSnap() {
  _ieHistory.push(_ieCtx.getImageData(0, 0, _ieCanvas.width, _ieCanvas.height));
  if (_ieHistory.length > 40) _ieHistory.shift();
}

function _ieUndo() {
  if (_ieHistory.length <= 1) return;
  _ieHistory.pop();
  _ieCtx.putImageData(_ieHistory[_ieHistory.length - 1], 0, 0);
}

// ── redact color (ขาว/ดำ) ────────────────────────────────────
function _iePickRedact(hex) {
  _ieRedactColor = hex;
  var bBtn = document.getElementById('_ieRed_black');
  var wBtn = document.getElementById('_ieRed_white');
  if (bBtn) bBtn.style.boxShadow = (hex === '#000000') ? '0 0 0 2px rgba(255,255,255,.6)' : 'none';
  if (wBtn) wBtn.style.boxShadow = (hex === '#ffffff') ? '0 0 0 2px rgba(255,255,255,.6)' : 'none';
}

// ── tool switching ────────────────────────────────────────────
function _ieSetTool(t) {
  _ieTool = t;
  _ieUpdateBtns();
  if (_ieCanvas) _ieCanvas.style.cursor = (t === 'text') ? 'text' : 'crosshair';
  var rc = document.getElementById('_ieRedactColors');
  var dc = document.getElementById('_ieDrawColors');
  if (rc) rc.style.display = (t === 'redact') ? 'flex' : 'none';
  if (dc) dc.style.display = (t !== 'redact') ? 'flex' : 'none';
}

function _ieUpdateBtns() {
  ['redact', 'draw', 'text'].forEach(function(t) {
    var btn = document.getElementById('_ieTool_' + t);
    if (!btn) return;
    var on = (_ieTool === t);
    btn.style.background  = on ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.08)';
    btn.style.borderColor = on ? '#fff' : 'rgba(255,255,255,.2)';
    btn.style.color       = '#f1f5f9';
  });
}

// ── mouse handlers ────────────────────────────────────────────
function _ieDown(e) {
  if (_ieTool === 'text') return;
  e.preventDefault();
  _ieIsDown = true;
  var p = _ieGetPos(e);
  _ieStartX = p.x; _ieStartY = p.y;
  _iePreSnap = _ieCtx.getImageData(0, 0, _ieCanvas.width, _ieCanvas.height);
  if (_ieTool === 'draw') {
    _ieSaveSnap();
    _ieCtx.beginPath();
    _ieCtx.moveTo(p.x, p.y);
  }
}

function _ieMove(e) {
  if (!_ieIsDown) return;
  e.preventDefault();
  var p = _ieGetPos(e);
  if (_ieTool === 'redact') {
    _ieCtx.putImageData(_iePreSnap, 0, 0);
    var previewAlpha = (_ieRedactColor === '#ffffff') ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.65)';
    _ieCtx.fillStyle = previewAlpha;
    _ieCtx.fillRect(_ieStartX, _ieStartY, p.x - _ieStartX, p.y - _ieStartY);
  } else if (_ieTool === 'draw') {
    _ieCtx.strokeStyle = _ieDrawColor;
    _ieCtx.lineWidth   = _ieLineW;
    _ieCtx.lineCap     = 'round';
    _ieCtx.lineJoin    = 'round';
    _ieCtx.lineTo(p.x, p.y);
    _ieCtx.stroke();
  }
}

function _ieUp(e) {
  if (!_ieIsDown) return;
  _ieIsDown = false;
  if (_ieTool === 'redact' && _iePreSnap) {
    var p;
    if (e && e.changedTouches && e.changedTouches.length) {
      var rect = _ieCanvas.getBoundingClientRect();
      var sx = _ieCanvas.width / rect.width, sy = _ieCanvas.height / rect.height;
      p = { x: (e.changedTouches[0].clientX - rect.left)*sx, y: (e.changedTouches[0].clientY - rect.top)*sy };
    } else if (e && e.clientX !== undefined) {
      p = _ieGetPos(e);
    } else {
      p = { x: _ieStartX, y: _ieStartY };
    }
    _ieCtx.putImageData(_iePreSnap, 0, 0);
    _ieSaveSnap();
    _ieCtx.fillStyle = _ieRedactColor;
    _ieCtx.fillRect(_ieStartX, _ieStartY, p.x - _ieStartX, p.y - _ieStartY);
  } else if (_ieTool === 'draw') {
    _ieCtx.closePath();
  }
  _iePreSnap = null;
}

function _ieClick(e) {
  if (_ieTool !== 'text') return;
  var p = _ieGetPos(e);
  var txt = prompt('พิมพ์ข้อความที่จะใส่ในรูป:');
  if (!txt) return;
  _ieSaveSnap();
  var fs = Math.max(16, Math.floor(_ieCanvas.height / 22));
  _ieCtx.font        = 'bold ' + fs + 'px Sarabun, sans-serif';
  _ieCtx.fillStyle   = _ieDrawColor;
  _ieCtx.strokeStyle = (_ieDrawColor === '#ffffff' || _ieDrawColor === '#ffff00') ? '#000000' : '#ffffff';
  _ieCtx.lineWidth   = Math.max(2, Math.floor(fs / 9));
  _ieCtx.strokeText(txt, p.x, p.y);
  _ieCtx.fillText(txt, p.x, p.y);
}

// ── touch wrappers ────────────────────────────────────────────
function _ieTouchDown(e) { e.preventDefault(); _ieDown(e); }
function _ieTouchMove(e) { e.preventDefault(); _ieMove(e); }
function _ieTouchUp(e)   { _ieUp(e); }

// ── save / cancel ─────────────────────────────────────────────
function _ieSaveAndClose() {
  if (!_ieCanvas) return;
  _ieCanvas.toBlob(function(blob) {
    if (!blob) { _ieCloseOverlay(); return; }
    var file = new File([blob], 'po_edited.jpg', { type: 'image/jpeg' });
    var url  = URL.createObjectURL(blob);
    _ieCloseOverlay();
    if (_ieSaveCb) _ieSaveCb(file, url);
  }, 'image/jpeg', 0.93);
}

function _ieCancel() { _ieCloseOverlay(); }

function _ieCloseOverlay() {
  var ov = document.getElementById('_imgEditorOverlay');
  if (ov) ov.remove();
  _ieCanvas = null; _ieCtx = null;
  _ieHistory = []; _ieIsDown = false; _iePreSnap = null;
}
