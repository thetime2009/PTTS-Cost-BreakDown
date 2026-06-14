// ═══════════════════════════════════════════════════════════════
//  PTTS Cost Breakdown — Google Apps Script
//  วางใน Extensions → Apps Script ของ Google Sheet แล้ว Deploy
// ═══════════════════════════════════════════════════════════════

var SHEET_NAME = 'DATA';   // ← ชื่อ tab ที่ต้องการบันทึก

// ── doPost: รับข้อมูลจากเว็บฟอร์ม ────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss   = SpreadsheetApp.getActiveSpreadsheet();

    // ── deleteRow ────────────────────────────────────────────────
    if (data.action === 'deleteRow') return deleteRow(data.noQuo);

    // ── updateRow ────────────────────────────────────────────────
    if (data.action === 'updateRow') return updateRow(data.noQuo, data.row);

    // ── addMold ──────────────────────────────────────────────────
    if (data.action === 'addMold') {
      var shM = ss.getSheetByName('Modl');
      if (!shM) return jsonOut({ status:'error', message:'ไม่พบ sheet Modl' });
      var row = [data.od].concat(data.ids || []);
      shM.appendRow(row);
      return jsonOut({ status:'ok', message:'เพิ่ม OD ' + data.od + ' แล้ว' });
    }

    // ── updateMold ───────────────────────────────────────────────
    if (data.action === 'updateMold') {
      var shU = ss.getSheetByName('Modl');
      if (!shU) return jsonOut({ status:'error', message:'ไม่พบ sheet Modl' });
      var lastU = shU.getLastRow();
      for (var r = 2; r <= lastU; r++) {
        var odVal = parseFloat(shU.getRange(r, 1).getValue());
        if (Math.abs(odVal - parseFloat(data.od)) < 0.01) {
          shU.getRange(r, 1, 1, Math.max(shU.getLastColumn(), (data.ids||[]).length + 1)).clearContent();
          var newRow = [data.od].concat(data.ids || []);
          shU.getRange(r, 1, 1, newRow.length).setValues([newRow]);
          return jsonOut({ status:'ok', message:'อัปเดต OD ' + data.od + ' แล้ว' });
        }
      }
      return jsonOut({ status:'error', message:'ไม่พบ OD ' + data.od });
    }

    // ── deleteMold ───────────────────────────────────────────────
    if (data.action === 'deleteMold') {
      var shD = ss.getSheetByName('Modl');
      if (!shD) return jsonOut({ status:'error', message:'ไม่พบ sheet Modl' });
      var lastD = shD.getLastRow();
      for (var d = 2; d <= lastD; d++) {
        var odD = parseFloat(shD.getRange(d, 1).getValue());
        if (Math.abs(odD - parseFloat(data.od)) < 0.01) {
          shD.deleteRow(d);
          return jsonOut({ status:'ok', message:'ลบ OD ' + data.od + ' แล้ว' });
        }
      }
      return jsonOut({ status:'error', message:'ไม่พบ OD ' + data.od });
    }

    // ── saveLaborConfig: บันทึกอัตราค่าแรง + กระบวนการผลิต (sync ทุกเครื่อง) ──
    if (data.action === 'saveLaborConfig') return saveLaborConfig(data);

    // ── saveDrafts: บันทึกแบบร่างทั้งหมด (sync ทุกเครื่อง) ──
    if (data.action === 'saveDrafts') return saveDrafts(data);

    // ── savePlatingNoNeed: บันทึกรายการ "ไม่ต้องชุบ" (sync ทุกเครื่อง) ──
    if (data.action === 'savePlatingNoNeed') return savePlatingNoNeed(data);

    // ── savePlatingPriceMemory: บันทึกความจำราคาใบส่งชุบ (sync ทุกเครื่อง) ──
    if (data.action === 'savePlatingPriceMemory') return savePlatingPriceMemory(data);

    // ── updateMat: เพิ่ม/แก้ไขราคาวัตถุดิบใน sheet MAT-ฝา / MAT-ตะแกรง ──
    if (data.action === 'updateMat') return updateMat(data);

    // ── deleteMat: ลบรายการวัตถุดิบออกจาก sheet MAT-ฝา / MAT-ตะแกรง ──
    if (data.action === 'deleteMat') return deleteMat(data);

    // ── addOrder: สร้าง Order ใหม่ใน sheet "Order" (ใช้ร่วมกับ AppSheet) ──
    if (data.action === 'addOrder') return addOrder(data);

    // ── updateOrder: แก้ไข/อัปเดตสถานะ Order (ค้นหาด้วย No.PO) ──
    if (data.action === 'updateOrder') return updateOrder(data.noPO, data.row);

    // ── deleteOrder: ลบแถวใน sheet "Order" ตาม No.PO ──
    if (data.action === 'deleteOrder') return deleteOrder(data.noPO);

    // ── updateDataStatus: ตั้งคอลัมน์ "สถานะ" (A) ของ DATA ตาม No.Quo (B) เป็นค่าใหม่ ──
    if (data.action === 'updateDataStatus') return updateDataStatus(data.noQuo, data.status);

    // ── uploadOrderFile: อัปโหลดไฟล์แนบ PO ขึ้น Drive ─────────────
    if (data.action === 'uploadOrderFile') return uploadOrderFile(data);

    // ── savePurchaseOrder: สร้าง/แก้ไขใบสั่งซื้อ (header + items) ──
    if (data.action === 'savePurchaseOrder') return savePurchaseOrder(data);

    if (data.action === 'deletePOSupplierItem') return deletePOSupplierItem(data);

    // ── deletePurchaseOrder: ลบใบสั่งซื้อ (header + items) ──
    if (data.action === 'deletePurchaseOrder') return deletePurchaseOrder(data.poNo);

    // ── saveCompanyInfo: บันทึกข้อมูลบริษัท (sheet "Company") ──
    if (data.action === 'saveCompanyInfo') return saveCompanyInfo(data);

    // ── uploadLogo: อัปโหลดโลโก้บริษัทขึ้น Drive ─────────────────
    if (data.action === 'uploadLogo') return uploadLogo(data);
    if (data.action === 'uploadPOItemImage') return uploadPOItemImage(data);

    // ── saveCustomer: เพิ่ม/แก้ไขลูกค้า (sheet "Customers") ──────
    if (data.action === 'saveCustomer') return saveCustomer(data);

    // ── deleteCustomer: ลบลูกค้า (sheet "Customers") ─────────────
    if (data.action === 'deleteCustomer') return deleteCustomer(data.code);

    // ── saveSupplier: เพิ่ม/แก้ไข Supplier (sheet "Suppliers") ───
    if (data.action === 'saveSupplier') return saveSupplier(data);

    // ── deleteSupplier: ลบ Supplier (sheet "Suppliers") ──────────
    if (data.action === 'deleteSupplier') return deleteSupplier(data.code);

    // ── saveInvoiceRecord: ออกเลขที่ใบกำกับภาษี + บันทึก log ────
    if (data.action === 'saveInvoiceRecord') return saveInvoiceRecord(data);

    // ── updateInvoiceRecord: แก้ไขรายละเอียดใบกำกับที่ออกไปแล้ว ──
    if (data.action === 'updateInvoiceRecord') return updateInvoiceRecord(data);

    // ── deleteInvoiceRecord: ลบใบกำกับที่ออกไปแล้ว ──────────────
    if (data.action === 'deleteInvoiceRecord') return deleteInvoiceRecord(data.invoiceNo);

    if (data.action === 'saveBillingNote') return saveBillingNote(data);
    if (data.action === 'deleteBillingNote') return deleteBillingNote(data);

    // ── ใบส่งชุบ (PlatingNote) ──────────────────────────────────
    if (data.action === 'savePlatingNote') return savePlatingNote(data);
    if (data.action === 'deletePlatingNote') return deletePlatingNote(data);

    // ── saveItem / deleteItem: รายการสินค้า/บริการที่ใช้บ่อย (sheet "ItemMaster") ──
    if (data.action === 'saveItem') return saveItem(data);
    if (data.action === 'deleteItem') return deleteItem(data.code);

    // ── default: บันทึก Cost row ──────────────────────────────────
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return jsonOut({ status:'error', message:'ไม่พบ sheet ' + SHEET_NAME });
    sheet.appendRow(data.row);
    scheduleTelegram();   // ยิง Telegram แบบ async ไม่บล็อก response
    return jsonOut({ status:'ok', message:'บันทึกสำเร็จ' });

  } catch (err) {
    return jsonOut({ status:'error', message: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: Health check + data fetching ──────────────────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === 'getCosts') {
    var rawLim = e.parameter.limit;
    var lim = (rawLim !== undefined && rawLim !== '') ? (parseInt(rawLim) || 0) : 200;  // default 200, &limit=0 = ทั้งหมด
    return getCosts(lim);
  }

  if (action === 'getOrders') {
    var rawLimO = e.parameter.limit;
    var limO = (rawLimO !== undefined && rawLimO !== '') ? (parseInt(rawLimO) || 0) : 0; // default 0 = ทั้งหมด
    return getOrders(limO);
  }

  if (action === 'getPurchaseOrders') return getPurchaseOrders();

  if (action === 'getSuppliers') return getSuppliers();

  if (action === 'getPOSupplierItems') return getPOSupplierItems();

  if (action === 'getNextPONo') return getNextPONo();

  if (action === 'getNextNo') {
    try {
      var ss2     = SpreadsheetApp.getActiveSpreadsheet();
      var dataSheet = ss2.getSheetByName(SHEET_NAME);
      var lastRow2  = dataSheet ? dataSheet.getLastRow() : 1;
      var nextNo    = 1;
      if (lastRow2 > 1) {
        var lastVal = String(dataSheet.getRange(lastRow2, 2).getValue() || '');
        var parsed  = parseInt(lastVal.replace(/^Q-/i, ''), 10);
        nextNo = isNaN(parsed) ? (lastRow2 - 1 + 1) : (parsed + 1);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', nextNo: nextNo }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getMAT') {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      function readMatData(sheetName) {
        var sh = ss.getSheetByName(sheetName);
        if (!sh) return [];
        var last = sh.getLastRow();
        if (last < 3) return [];
        var vals = sh.getRange(3, 2, last - 2, 7).getValues(); // B..H
        return vals.map(function(r) {
          var code     = String(r[0]).trim();
          var name     = String(r[1]).trim();     // col C = รายการวัตถุดิบ
          var price    = parseFloat(r[3]) || 0;  // col E = ราคา+30%
          var priceBuy = parseFloat(r[4]) || 0;  // col F = ราคาซื้อจริง
          var w        = parseFloat(r[5]) || 0;  // col G = กว้าง (มิล)
          var l        = parseFloat(r[6]) || 0;  // col H = ยาว (มิล)
          return code ? { code: code, name: name, price: price, priceBuy: priceBuy, w: w, l: l } : null;
        }).filter(Boolean);
      }

      var matFlap = readMatData('MAT-ฝา');
      var matMesh = readMatData('MAT-ตะแกรง');

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', matFlap: matFlap, matMesh: matMesh }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getSpecMat') {
    try {
      var ss3 = SpreadsheetApp.getActiveSpreadsheet();
      var specSh = ss3.getSheetByName('Spec Mat');
      if (!specSh) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'error', message: 'ไม่พบ sheet ชื่อ Spec Mat' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var last3 = specSh.getLastRow();
      var specs = {};
      if (last3 >= 4) {
        var sv = specSh.getRange(4, 1, last3 - 3, 3).getValues();
        sv.forEach(function(r) {
          var name = String(r[0]).trim();
          var w = parseFloat(r[1]) || 0;
          var l = parseFloat(r[2]) || 0;
          if (name && w && l) specs[name] = { w: w, l: l };
        });
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', specs: specs }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getContacts') {
    try {
      var ssC = SpreadsheetApp.getActiveSpreadsheet();
      var shC = ssC.getSheetByName('ชื่อผู้ติดต่อ');
      if (!shC) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'error', message: 'ไม่พบ sheet ชื่อผู้ติดต่อ' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var lastC = shC.getLastRow();
      var contacts = [];
      if (lastC >= 2) {
        var valsC = shC.getRange(2, 1, lastC - 1, 2).getValues();
        contacts = valsC.map(function(r) {
          var name = String(r[0]).trim();
          var co   = String(r[1]).trim();
          return name ? { name: name, company: co } : null;
        }).filter(Boolean);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', contacts: contacts }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getWorkTypes') {
    try {
      var ssW  = SpreadsheetApp.getActiveSpreadsheet();
      var shW  = ssW.getSheetByName('แบบงาน');
      if (!shW) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'error', message: 'ไม่พบ sheet ชื่อ แบบงาน' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var lastW = shW.getLastRow();
      var types = [];
      if (lastW >= 2) {
        var valsW = shW.getRange(2, 2, lastW - 1, 1).getValues();
        types = valsW.map(function(r) { return String(r[0]).trim(); }).filter(Boolean);
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', types: types }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getModl') {
    try {
      var ssM = SpreadsheetApp.getActiveSpreadsheet();
      var shM = ssM.getSheetByName('Modl');
      if (!shM) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'error', message: 'ไม่พบ sheet ชื่อ Modl' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var lastM = shM.getLastRow();
      var lastCol = shM.getLastColumn();
      var molds = [];
      if (lastM >= 2 && lastCol >= 1) {
        var valsM = shM.getRange(2, 1, lastM - 1, lastCol).getValues();
        valsM.forEach(function(r) {
          var od = parseFloat(r[0]);
          if (isNaN(od)) return;
          var ids = [];
          for (var c = 1; c < r.length; c++) {
            var v = String(r[c]).trim();
            if (v && v !== '' && v !== '0') ids.push(v);
          }
          molds.push({ od: od, ids: ids });
        });
      }
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', molds: molds }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getDrafts') {
    try {
      var ssD = SpreadsheetApp.getActiveSpreadsheet();
      var shD2 = ssD.getSheetByName('Drafts');
      if (!shD2) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok', drafts: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var rawD = shD2.getRange('B1').getValue();
      var drafts = rawD ? JSON.parse(rawD) : [];
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', drafts: drafts }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'getPlatingNoNeed') return getPlatingNoNeed();

  if (action === 'getPlatingPriceMemory') return getPlatingPriceMemory();

  if (action === 'getCompanyInfo') return getCompanyInfo();

  if (action === 'getCustomers') return getCustomers();

  if (action === 'getItemMaster') return getItemMaster();

  if (action === 'getNextInvoiceNo') {
    var typ = e.parameter.type || 'full';
    return jsonOut({ status: 'ok', nextNo: _peekNextInvoiceNo(typ) });
  }

  if (action === 'getInvoices') return getInvoices();

  if (action === 'getNextBillNo') return jsonOut({ status: 'ok', billNo: _peekNextBillNo() });

  if (action === 'getBillingNotes') return getBillingNotes();

  if (action === 'getNextPlatingNo') return jsonOut({ status: 'ok', platingNo: _peekNextPlatingNo() });

  if (action === 'getPlatingNotes') return getPlatingNotes();

  if (action === 'getLaborConfig') {
    try {
      var ssL = SpreadsheetApp.getActiveSpreadsheet();
      var shL = ssL.getSheetByName('Config');
      if (!shL) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'empty' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var raw = shL.getRange('B1').getValue();
      if (!raw) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'empty' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var cfg = JSON.parse(raw);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', config: cfg }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'PTTS Cost Breakdown API พร้อมใช้งาน' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── getCosts: ดึงข้อมูลจาก sheet DATA (limit = rows ล่าสุด, 0 = ทั้งหมด)
function getCosts(limit) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sh    = ss.getSheetByName('DATA') || ss.getSheets()[0];
    var last  = sh.getLastRow();
    var total = Math.max(0, last - 1);
    if (total === 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: [], total: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var lim      = (limit && limit > 0 && limit < total) ? limit : total;
    var startRow = last - lim + 1;
    var values   = sh.getRange(startRow, 1, lim, sh.getLastColumn()).getValues();
    var rows = values.map(function(r) {
      return r.map(function(cell) {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        }
        return cell;
      });
    });
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', rows: rows, total: total, limited: lim < total }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── updateRow: อัปเดตแถวที่ตรงกับ No.Quo ─────────────────────
function updateRow(noQuo, row) {
  try {
    if (!noQuo) throw new Error('noQuo is required');
    if (!Array.isArray(row) || row.length === 0) throw new Error('row data is required');
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName('DATA') || ss.getSheets()[0];
    var last = sh.getLastRow();
    if (last < 2) {
      sh.appendRow(row);
      try { sendTelegramOnChangeManual(); } catch(tErr) { Logger.log('Telegram error: ' + tErr); }
      return jsonOut({ status: 'ok', updated: noQuo, note: 'appended' });
    }
    // อ่าน column B ทั้งหมดครั้งเดียว → ไม่ต้อง loop อ่านทีละ cell
    var colB = sh.getRange(2, 2, last - 1, 1).getValues(); // [[val],[val],...]
    var found = -1;
    for (var i = 0; i < colB.length; i++) {
      if (String(colB[i][0]) == String(noQuo)) { found = i + 2; break; }
    }
    if (found !== -1) {
      sh.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    scheduleTelegram();   // ยิง Telegram แบบ async ไม่บล็อก response
    return jsonOut({ status: 'ok', updated: noQuo, note: found !== -1 ? 'updated' : 'appended' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── updateDataStatus: อัปเดตคอลัมน์ "สถานะ" (A) ของ sheet DATA ──
// ค้นหาแถวที่ No.Quo (คอลัมน์ B) ตรงกับ noQuo เป๊ะๆ (รายการเดียว) แล้วตั้งค่าคอลัมน์ A = status
function updateDataStatus(noQuo, status) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!noQuo) throw new Error('noQuo is required');
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName('DATA') || ss.getSheets()[0];
    var last = sh.getLastRow();
    if (last < 2) throw new Error('ไม่พบ ' + noQuo);
    var colB  = sh.getRange(2, 2, last - 1, 1).getValues();
    var found = -1, count = 0;
    for (var i = 0; i < colB.length; i++) {
      if (String(colB[i][0]).trim() === String(noQuo).trim()) { found = i + 2; count++; }
    }
    if (count === 0) throw new Error('ไม่พบ ' + noQuo);
    if (count > 1) throw new Error('พบ No.Quo ซ้ำ ' + count + ' แถว — ยกเลิกเพื่อความปลอดภัย');
    sh.getRange(found, 1).setValue(status || 'ผ่าน');
    return jsonOut({ status: 'ok', updated: noQuo, row: found });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── saveLaborConfig: บันทึกอัตราค่าแรง + กระบวนการผลิต ลง sheet "Config" ──
// data: { ratePerMin, ratePerDay, hoursPerDay, processes: [...] }
// เก็บเป็น JSON string ไว้ที่ sheet "Config" เซลล์ B1 (A1 = label)
function saveLaborConfig(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Config');
    if (!sh) sh = ss.insertSheet('Config');
    var payload = {
      ratePerMin:  parseFloat(data.ratePerMin)  || 0,
      ratePerDay:  parseFloat(data.ratePerDay)  || 0,
      hoursPerDay: parseFloat(data.hoursPerDay) || 8,
      processes:   data.processes || []
    };
    sh.getRange('A1').setValue('LaborConfig');
    sh.getRange('B1').setValue(JSON.stringify(payload));
    return jsonOut({ status: 'ok', message: 'บันทึกค่าแรงแล้ว' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── saveDrafts: บันทึกแบบร่างทั้งหมด (array) ลง sheet "Drafts" ──
// data: { drafts: [...] } — เก็บเป็น JSON string ไว้ที่เซลล์ B1 (A1 = label)
// เครื่องไหนบันทึก/ลบแบบร่าง จะ push array ทั้งก้อนทับของเดิม (sync ทุกเครื่อง)
function saveDrafts(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Drafts');
    if (!sh) sh = ss.insertSheet('Drafts');
    sh.getRange('A1').setValue('Drafts');
    sh.getRange('B1').setValue(JSON.stringify(data.drafts || []));
    return jsonOut({ status: 'ok', message: 'บันทึกแบบร่างแล้ว', count: (data.drafts||[]).length });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getPlatingNoNeed: อ่านรายการ No.PO ที่มาร์ค "ไม่ต้องชุบ" จาก sheet "PlatingNoNeed" (B1 = JSON array) ──
function getPlatingNoNeed() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingNoNeed');
    var list = [];
    if (sh) {
      var raw = sh.getRange('B1').getValue();
      list = raw ? JSON.parse(raw) : [];
    }
    return jsonOut({ status: 'ok', list: list });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── savePlatingNoNeed: บันทึกรายการ No.PO ที่มาร์ค "ไม่ต้องชุบ" ทั้งก้อน (sync ทุกเครื่อง) ──
// data: { list: [...] } — เก็บเป็น JSON string ไว้ที่เซลล์ B1 (A1 = label)
function savePlatingNoNeed(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingNoNeed');
    if (!sh) sh = ss.insertSheet('PlatingNoNeed');
    sh.getRange('A1').setValue('PlatingNoNeed');
    sh.getRange('B1').setValue(JSON.stringify(data.list || []));
    return jsonOut({ status: 'ok', message: 'บันทึกรายการไม่ต้องชุบแล้ว', count: (data.list||[]).length });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getPlatingPriceMemory: อ่านความจำราคาใบส่งชุบ จาก sheet "PlatingPriceMemory" (B1 = JSON array) ──
// แต่ละรายการ: { key, description, top, bot, meshOut, meshIn, price }
function getPlatingPriceMemory() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingPriceMemory');
    var list = [];
    if (sh) {
      var raw = sh.getRange('B1').getValue();
      list = raw ? JSON.parse(raw) : [];
    }
    return jsonOut({ status: 'ok', list: list });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── savePlatingPriceMemory: บันทึกความจำราคาใบส่งชุบทั้งก้อน (sync ทุกเครื่อง) ──
// data: { list: [...] } — เก็บเป็น JSON string ไว้ที่เซลล์ B1 (A1 = label)
function savePlatingPriceMemory(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingPriceMemory');
    if (!sh) sh = ss.insertSheet('PlatingPriceMemory');
    sh.getRange('A1').setValue('PlatingPriceMemory');
    sh.getRange('B1').setValue(JSON.stringify(data.list || []));
    return jsonOut({ status: 'ok', message: 'บันทึกความจำราคาแล้ว', count: (data.list||[]).length });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── updateMat: เพิ่ม/แก้ไขราคาวัตถุดิบ (MAT-ฝา / MAT-ตะแกรง) ──
// data: { type: 'flap'|'mesh', code, name, price, priceBuy, w, l }
// คอลัมน์: B=code, C=name, D=(ไม่ใช้), E=ราคา+30%, F=ราคาซื้อจริง, G=กว้าง, H=ยาว (เริ่มแถว 3)
function updateMat(data) {
  try {
    var code = String(data.code || '').trim();
    if (!code) throw new Error('code is required');
    var sheetName = (data.type === 'mesh') ? 'MAT-ตะแกรง' : 'MAT-ฝา';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return jsonOut({ status: 'error', message: 'ไม่พบ sheet ' + sheetName });

    var name     = data.name || '';
    var price    = parseFloat(data.price) || 0;
    var priceBuy = parseFloat(data.priceBuy) || 0;
    var w        = parseFloat(data.w) || 0;
    var l        = parseFloat(data.l) || 0;

    var last = sh.getLastRow();
    var found = -1;
    if (last >= 3) {
      var codes = sh.getRange(3, 2, last - 2, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) { found = i + 3; break; }
      }
    }
    if (found !== -1) {
      sh.getRange(found, 3).setValue(name);   // C = ชื่อรายการ
      sh.getRange(found, 5).setValue(price);  // E = ราคา+30%
      sh.getRange(found, 6).setValue(priceBuy); // F = ราคาซื้อจริง
      if (w) sh.getRange(found, 7).setValue(w); // G = กว้าง
      if (l) sh.getRange(found, 8).setValue(l); // H = ยาว
      return jsonOut({ status: 'ok', updated: code });
    } else {
      var newRow = (last < 2) ? 3 : last + 1;
      sh.getRange(newRow, 2).setValue(code);
      sh.getRange(newRow, 3).setValue(name);
      sh.getRange(newRow, 5).setValue(price);
      sh.getRange(newRow, 6).setValue(priceBuy);
      if (w) sh.getRange(newRow, 7).setValue(w); // G = กว้าง
      if (l) sh.getRange(newRow, 8).setValue(l); // H = ยาว
      return jsonOut({ status: 'ok', added: code });
    }
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── deleteMat: ลบรายการวัตถุดิบ (MAT-ฝา / MAT-ตะแกรง) ──
// data: { type: 'flap'|'mesh', code }
function deleteMat(data) {
  try {
    var code = String(data.code || '').trim();
    if (!code) throw new Error('code is required');
    var sheetName = (data.type === 'mesh') ? 'MAT-ตะแกรง' : 'MAT-ฝา';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return jsonOut({ status: 'error', message: 'ไม่พบ sheet ' + sheetName });

    var last = sh.getLastRow();
    if (last >= 3) {
      var codes = sh.getRange(3, 2, last - 2, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) {
          sh.deleteRow(i + 3);
          return jsonOut({ status: 'ok', deleted: code });
        }
      }
    }
    return jsonOut({ status: 'error', message: 'ไม่พบ ' + code });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── getOrders: ดึงข้อมูลจาก sheet "Order" (ใช้ร่วมกับ AppSheet) ──
// คอลัมน์ A-AB (28 คอลัมน์) — A=No.Quo, B=No.PO, ... AB=ลูกค้า
function getOrders(limit) {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName('Order');
    if (!sh) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: [], total: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var lastRaw = sh.getLastRow();
    var last = 1;
    if (lastRaw >= 2) {
      var colB = sh.getRange(2, 2, lastRaw - 1, 1).getValues();
      for (var i = colB.length - 1; i >= 0; i--) {
        if (String(colB[i][0]).trim() !== '') { last = i + 2; break; }
      }
    }
    var total = Math.max(0, last - 1);
    if (total === 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', rows: [], total: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var lim      = (limit && limit > 0 && limit < total) ? limit : total;
    var startRow = last - lim + 1;
    var numCols  = Math.max(28, sh.getLastColumn());
    var values   = sh.getRange(startRow, 1, lim, numCols).getValues();
    var rows = values.map(function(r) {
      return r.map(function(cell) {
        if (cell instanceof Date) {
          return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        }
        return cell;
      });
    });
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', rows: rows, total: total, limited: lim < total }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── addOrder: เพิ่มแถวใหม่ใน sheet "Order" ───────────────────
// data.row = array ค่าตามลำดับคอลัมน์ A-AB (28 ค่า)
function addOrder(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!Array.isArray(data.row) || data.row.length === 0) throw new Error('row data is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Order');
    if (!sh) sh = ss.insertSheet('Order');
    // หาแถวสุดท้ายที่มีข้อมูลจริง (เช็คคอลัมน์ A No.Quo และ B No.PO)
    // เพราะ getLastRow()/appendRow() อาจนับรวมแถวที่มีแค่ format ว่างๆ ทำให้เพิ่มแถวห่างจากข้อมูลจริงมาก
    var maxRows = sh.getMaxRows();
    var lastDataRow = 1;
    if (maxRows > 1) {
      var ab = sh.getRange(2, 1, maxRows - 1, 2).getValues();
      for (var i = ab.length - 1; i >= 0; i--) {
        if (String(ab[i][0]).trim() !== '' || String(ab[i][1]).trim() !== '') { lastDataRow = i + 2; break; }
      }
    }
    var targetRow = lastDataRow > 1 ? lastDataRow + 1 : 2;
    sh.getRange(targetRow, 1, 1, data.row.length).setValues([data.row]);
    return jsonOut({ status: 'ok', message: 'สร้าง Order แล้ว' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── updateOrder: อัปเดตแถวที่ตรงกับ No.PO (คอลัมน์ B) ─────────
// ถ้าไม่พบ No.PO เดิม จะ append แถวใหม่แทน
function updateOrder(noPO, row) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!noPO) throw new Error('noPO is required');
    if (!Array.isArray(row) || row.length === 0) throw new Error('row data is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Order');
    if (!sh) sh = ss.insertSheet('Order');
    var last = sh.getLastRow();
    if (last < 2) {
      sh.appendRow(row);
      return jsonOut({ status: 'ok', updated: noPO, note: 'appended' });
    }
    var colB  = sh.getRange(2, 2, last - 1, 1).getValues();
    var found = -1;
    for (var i = 0; i < colB.length; i++) {
      if (String(colB[i][0]) == String(noPO)) { found = i + 2; break; }
    }
    if (found !== -1) {
      sh.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return jsonOut({ status: 'ok', updated: noPO, note: found !== -1 ? 'updated' : 'appended' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── หาหรือสร้างโฟลเดอร์ตาม path ซ้อนกัน เช่น ['appsheet','data','PTSytem-1001399782','ORDER_Images'] ──
function _getOrCreateFolderPath(pathParts) {
  var folder = DriveApp.getRootFolder();
  for (var i = 0; i < pathParts.length; i++) {
    var name = pathParts[i];
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  }
  return folder;
}

// ── uploadOrderFile: รับไฟล์ base64 → บันทึกลง Drive โฟลเดอร์ ORDER_Images ของ AppSheet ──
// data: { fileName, mimeType, base64, noPO }
function uploadOrderFile(data) {
  try {
    if (!data.base64) throw new Error('base64 is required');
    var folder = _getOrCreateFolderPath(['appsheet', 'data', 'PTSytem-1001399782', 'ORDER_Images']);

    // ตั้งชื่อไฟล์ตามรูปแบบของ AppSheet: {เลขที่PO}.รูปภาพPO..{HHmmss}.{ext}
    var origName = data.fileName || 'PO_file.jpg';
    var extMatch = origName.match(/\.([a-zA-Z0-9]+)$/);
    var ext = extMatch ? extMatch[1] : 'jpg';
    var noPO = String(data.noPO || '').trim() || 'PO';
    var hhmmss = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'HHmmss');
    var fileName = noPO + '.รูปภาพPO..' + hhmmss + '.' + ext;

    var bytes = Utilities.base64Decode(data.base64);
    var blob  = Utilities.newBlob(bytes, data.mimeType || 'application/octet-stream', fileName);
    var file  = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var relPath = 'ORDER_Images/' + fileName;
    var appUrl = 'https://www.appsheet.com/template/gettablefileurl?appName=PTSytem-1001399782&tablename=ORDER&filename='
      + encodeURIComponent(relPath);

    // url      → บันทึกลงคอลัมน์ V (ลิงก์เปิดดูรูปแบบ AppSheet)
    // path     → บันทึกลงคอลัมน์ M (path สัมพัทธ์ เช่น ORDER_Images/{เลขที่PO}.รูปภาพPO..{ชื่อไฟล์}.jpg)
    return jsonOut({ status: 'ok', url: appUrl, path: relPath, fileId: file.getId() });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── deleteOrder: ลบแถวที่ตรงกับ No.PO (คอลัมน์ B) ใน sheet "Order" ──
function deleteOrder(noPO) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!noPO) throw new Error('noPO is required');
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName('Order');
    if (!sh) throw new Error('ไม่พบ sheet Order');
    var last = sh.getLastRow();
    if (last >= 2) {
      // อ่านคอลัมน์ B (No.PO) ทั้งหมดในครั้งเดียว แทนการเรียก getRange ทีละแถว (ช้ามากถ้าชีตมีหลายพันแถว)
      var colB = sh.getRange(2, 2, last - 1, 1).getValues();
      for (var i = colB.length - 1; i >= 0; i--) {
        if (String(colB[i][0]) == String(noPO)) {
          sh.deleteRow(i + 2);
          return jsonOut({ status: 'ok', deleted: noPO });
        }
      }
    }
    throw new Error('ไม่พบ ' + noPO);
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getSuppliers: ดึงรายชื่อ supplier จาก sheet "Suppliers" (A-F) ──
// A=รหัส, B=ชื่อบริษัท, C=ที่อยู่, D=เลขผู้เสียภาษี, E=ผู้ติดต่อ/เบอร์, F=หมายเหตุ
function getSuppliers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Suppliers');
    if (!sh) return jsonOut({ status: 'ok', suppliers: [] });
    var last = sh.getLastRow();
    if (last < 2) return jsonOut({ status: 'ok', suppliers: [] });
    var vals = sh.getRange(2, 1, last - 1, 6).getValues();
    var suppliers = vals.map(function(r) {
      return {
        code:    String(r[0]||'').trim(),
        name:    String(r[1]||'').trim(),
        address: String(r[2]||'').trim(),
        taxId:   String(r[3]||'').trim(),
        contact: String(r[4]||'').trim(),
        note:    String(r[5]||'').trim()
      };
    }).filter(function(s){ return s.code; });
    return jsonOut({ status: 'ok', suppliers: suppliers });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── saveSupplier: เพิ่ม/แก้ไข Supplier (ค้นหาด้วย code; ถ้าไม่มี code = เพิ่มใหม่) ──
// data: { code, name, address, taxId, contact, note }
function saveSupplier(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Suppliers');
    if (!sh) sh = ss.insertSheet('Suppliers');

    var name = String(data.name || '').trim();
    if (!name) throw new Error('name is required');
    var code = String(data.code || '').trim();
    var last = sh.getLastRow();

    var found = -1;
    if (code && last >= 1) {
      var codes = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) { found = i + 1; break; }
      }
    }
    if (!code) code = 'S' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyMMddHHmmss');

    var row = [
      code, name,
      String(data.address || '').trim(),
      String(data.taxId   || '').trim(),
      String(data.contact || '').trim(),
      String(data.note    || '').trim()
    ];
    if (found !== -1) {
      sh.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return jsonOut({ status: 'ok', code: code, note: found !== -1 ? 'updated' : 'added' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deleteSupplier: ลบ Supplier ตามรหัส ───────────────────────
function deleteSupplier(code) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    code = String(code || '').trim();
    if (!code) throw new Error('code is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Suppliers');
    if (!sh) throw new Error('ไม่พบ sheet Suppliers');
    var last = sh.getLastRow();
    for (var i = last; i >= 1; i--) {
      if (String(sh.getRange(i, 1).getValue()).trim() === code) {
        sh.deleteRow(i);
        return jsonOut({ status: 'ok', deleted: code });
      }
    }
    throw new Error('ไม่พบ ' + code);
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getPurchaseOrders: ดึงข้อมูลใบสั่งซื้อ ──
// header จาก sheet "PurchaseOrders" (A-N, 14 คอลัมน์)
// items จาก sheet "PO_Items" (A-I, 9 คอลัมน์ — I = imageUrl) จัดกลุ่มตาม poNo (คอลัมน์ A)
function getPurchaseOrders() {
  try {
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var shH = ss.getSheetByName('PurchaseOrders');
    var shI = ss.getSheetByName('PO_Items');
    var fmt = function(r) {
      return r.map(function(cell) {
        if (cell instanceof Date) return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        return cell;
      });
    };
    var headers = [];
    if (shH) {
      var lastH = shH.getLastRow();
      if (lastH >= 2) {
        headers = shH.getRange(2, 1, lastH - 1, 14).getValues().map(fmt);
      }
    }
    var itemsByPO = {};
    if (shI) {
      var lastI = shI.getLastRow();
      if (lastI >= 2) {
        shI.getRange(2, 1, lastI - 1, 9).getValues().forEach(function(r) {
          var poNo = String(r[0]||'').trim();
          if (!poNo) return;
          if (!itemsByPO[poNo]) itemsByPO[poNo] = [];
          itemsByPO[poNo].push(fmt(r));
        });
      }
    }
    return jsonOut({ status: 'ok', headers: headers, items: itemsByPO });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── getPOSupplierItems: ดึงรายการสินค้าที่เคยสั่งซื้อ แยกตาม supplier จาก sheet "PO_SupplierItems" (A-G) ──
// A=supplierCode, B=name, C=spec, D=unit, E=unitPrice(ล่าสุด), F=imageUrl, G=updatedAt
function getPOSupplierItems() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PO_SupplierItems');
    if (!sh) return jsonOut({ status: 'ok', items: [] });
    var last = sh.getLastRow();
    if (last < 2) return jsonOut({ status: 'ok', items: [] });
    var vals = sh.getRange(2, 1, last - 1, 7).getValues();
    var items = vals.map(function(r) {
      return {
        supplierCode: String(r[0]||'').trim(),
        name:      String(r[1]||'').trim(),
        spec:      String(r[2]||'').trim(),
        unit:      String(r[3]||'').trim(),
        unitPrice: r[4],
        imageUrl:  String(r[5]||'').trim(),
        updatedAt: r[6]
      };
    }).filter(function(it){ return it.supplierCode && it.name; });
    return jsonOut({ status: 'ok', items: items });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── deletePOSupplierItem: ลบรายการออกจากคลังสินค้าของ supplier (sheet "PO_SupplierItems") ──
// data: { supplierCode, name }
function deletePOSupplierItem(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var supplierCode = String(data.supplierCode || '').trim();
    var name = String(data.name || '').trim();
    if (!supplierCode || !name) throw new Error('supplierCode and name are required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PO_SupplierItems');
    if (!sh) return jsonOut({ status: 'ok', deleted: false });
    var last = sh.getLastRow();
    if (last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, 2).getValues();
      for (var i = vals.length; i >= 1; i--) {
        if (String(vals[i-1][0]).trim().toLowerCase() === supplierCode.toLowerCase() &&
            String(vals[i-1][1]).trim().toLowerCase() === name.toLowerCase()) {
          sh.deleteRow(i + 1);
        }
      }
    }
    return jsonOut({ status: 'ok', deleted: true });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getNextPONo: สร้างเลขที่ใบสั่งซื้อใหม่ รูปแบบ PUR-YYMM-XX ──
function getNextPONo() {
  try {
    var ss  = SpreadsheetApp.getActiveSpreadsheet();
    var sh  = ss.getSheetByName('PurchaseOrders');
    var now = new Date();
    var prefix = 'PUR-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyMM');
    var maxSeq = 0;
    if (sh) {
      var last = sh.getLastRow();
      if (last >= 2) {
        sh.getRange(2, 1, last - 1, 1).getValues().forEach(function(r) {
          var v = String(r[0]||'').trim();
          if (v.indexOf(prefix + '-') === 0) {
            var seq = parseInt(v.substring(prefix.length + 1), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        });
      }
    }
    var nextPO = prefix + '-' + ('0' + (maxSeq + 1)).slice(-2);
    return jsonOut({ status: 'ok', nextPO: nextPO });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── savePurchaseOrder: สร้าง/แก้ไขใบสั่งซื้อ (header + items) ──
// data: { poNo, header: [A..N ตามลำดับคอลัมน์ PurchaseOrders],
//         items: [[A..H ตามลำดับคอลัมน์ PO_Items], ...] }
// ถ้าพบ poNo เดิมในคอลัมน์ A ของ PurchaseOrders → อัปเดตแถวนั้น (และลบ/เขียน items ใหม่ทั้งหมด)
// ถ้าไม่พบ → สร้างแถวใหม่
// ── _upsertPOSupplierItems: อัปเดต/เพิ่มรายการสินค้าในคลังของ supplier (sheet "PO_SupplierItems") ──
// item array: [poNo, seq, name, spec, qty, unit, unitPrice, lineTotal, imageUrl]
// match ด้วย supplierCode + name (case-insensitive, trim) — ถ้าพบ อัปเดต spec/unit/unitPrice(ล่าสุด)/imageUrl/updatedAt, ถ้าไม่พบ เพิ่มแถวใหม่
function _upsertPOSupplierItems(ss, supplierCode, items) {
  var sh = ss.getSheetByName('PO_SupplierItems');
  if (!sh) {
    sh = ss.insertSheet('PO_SupplierItems');
    sh.appendRow(['supplierCode', 'name', 'spec', 'unit', 'unitPrice', 'imageUrl', 'updatedAt']);
  }
  var last = sh.getLastRow();
  var existing = last >= 2 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  var now = new Date();
  items.forEach(function(item) {
    var name = String(item[2] || '').trim();
    if (!name) return;
    var spec = item[3] || '';
    var unit = item[5] || '';
    var unitPrice = item[6] || 0;
    var imageUrl = item[8] || '';
    var foundRow = -1;
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).trim().toLowerCase() === supplierCode.toLowerCase() &&
          String(existing[i][1]).trim().toLowerCase() === name.toLowerCase()) {
        foundRow = i + 2;
        break;
      }
    }
    if (foundRow !== -1) {
      var rowVals = sh.getRange(foundRow, 1, 1, 7).getValues()[0];
      sh.getRange(foundRow, 1, 1, 7).setValues([[
        supplierCode, name, spec || rowVals[2], unit || rowVals[3], unitPrice, imageUrl || rowVals[5], now
      ]]);
    } else {
      sh.appendRow([supplierCode, name, spec, unit, unitPrice, imageUrl, now]);
      existing.push([supplierCode, name]);
    }
  });
}

function savePurchaseOrder(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var poNo = String(data.poNo || '').trim();
    if (!poNo) throw new Error('poNo is required');
    if (!Array.isArray(data.header) || data.header.length === 0) throw new Error('header is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── header: PurchaseOrders ──
    var shH = ss.getSheetByName('PurchaseOrders');
    if (!shH) shH = ss.insertSheet('PurchaseOrders');
    var lastH  = shH.getLastRow();
    var foundH = -1;
    if (lastH >= 2) {
      var poNos = shH.getRange(2, 1, lastH - 1, 1).getValues();
      for (var i = 0; i < poNos.length; i++) {
        if (String(poNos[i][0]).trim() === poNo) { foundH = i + 2; break; }
      }
    }
    if (foundH !== -1) {
      shH.getRange(foundH, 1, 1, data.header.length).setValues([data.header]);
    } else {
      shH.appendRow(data.header);
    }

    // ── items: PO_Items (ลบของเดิมทั้งหมดของ poNo นี้ แล้วเขียนใหม่) ──
    var shI = ss.getSheetByName('PO_Items');
    if (!shI) shI = ss.insertSheet('PO_Items');
    var lastI = shI.getLastRow();
    if (lastI >= 2) {
      var colA = shI.getRange(2, 1, lastI - 1, 1).getValues();
      for (var j = colA.length; j >= 1; j--) {
        if (String(colA[j-1][0]).trim() === poNo) shI.deleteRow(j + 1);
      }
    }
    if (Array.isArray(data.items)) {
      data.items.forEach(function(item) { shI.appendRow(item); });
    }

    // ── อัปเดตคลังรายการสินค้าต่อ supplier: PO_SupplierItems (upsert ตาม supplierCode+name) ──
    var supplierCode = String(data.header[3] || '').trim();
    if (supplierCode && Array.isArray(data.items) && data.items.length) {
      _upsertPOSupplierItems(ss, supplierCode, data.items);
    }

    return jsonOut({ status: 'ok', saved: poNo, note: foundH !== -1 ? 'updated' : 'created' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deletePurchaseOrder: ลบใบสั่งซื้อ (header ใน PurchaseOrders + รายการใน PO_Items) ──
function deletePurchaseOrder(poNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    poNo = String(poNo || '').trim();
    if (!poNo) throw new Error('poNo is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var shH = ss.getSheetByName('PurchaseOrders');
    var deletedHeader = false;
    if (shH) {
      var lastH = shH.getLastRow();
      for (var i = lastH; i >= 2; i--) {
        if (String(shH.getRange(i, 1).getValue()).trim() === poNo) {
          shH.deleteRow(i);
          deletedHeader = true;
          break;
        }
      }
    }

    var shI = ss.getSheetByName('PO_Items');
    if (shI) {
      var lastI = shI.getLastRow();
      for (var j = lastI; j >= 2; j--) {
        if (String(shI.getRange(j, 1).getValue()).trim() === poNo) shI.deleteRow(j);
      }
    }

    if (!deletedHeader) throw new Error('ไม่พบ ' + poNo);
    return jsonOut({ status: 'ok', deleted: poNo });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deleteRow: ลบแถวที่ตรงกับ No.Quo ─────────────────────────
function deleteRow(noQuo) {
  try {
    if (!noQuo) throw new Error('noQuo is required');
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var sh   = ss.getSheetByName('DATA') || ss.getSheets()[0];
    var last = sh.getLastRow();
    for (var i = last; i >= 2; i--) {
      if (sh.getRange(i, 2).getValue() == noQuo) {
        sh.deleteRow(i);
        return jsonOut({ status: 'ok', deleted: noQuo });
      }
    }
    throw new Error('ไม่พบ ' + noQuo);
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ══════════════════════════════════════════════════════════════
//  ใบกำกับภาษี: Company / Customers / Invoices
// ══════════════════════════════════════════════════════════════

// ── getCompanyInfo: อ่านชีต "Company" (A=key, B=value) ───────
function getCompanyInfo() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Company');
    var info = {
      name: '', nameEn: '', address: '', phone: '', email: '', taxId: '', logoUrl: ''
    };
    if (!sh) return jsonOut({ status: 'ok', info: info });
    var last = sh.getLastRow();
    if (last < 1) return jsonOut({ status: 'ok', info: info });
    var vals = sh.getRange(1, 1, last, 2).getValues();
    var map = {
      company_name: 'name', company_name_en: 'nameEn', company_address: 'address',
      company_phone: 'phone', company_email: 'email', company_taxid: 'taxId',
      company_logo_url: 'logoUrl'
    };
    vals.forEach(function(r) {
      var key = String(r[0] || '').trim();
      var val = String(r[1] || '').trim();
      if (map[key]) info[map[key]] = val;
    });
    return jsonOut({ status: 'ok', info: info });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── saveCompanyInfo: เขียนค่าลงชีต "Company" (สร้างแถวถ้ายังไม่มี) ──
// data: { name, nameEn, address, phone, email, taxId, logoUrl }
function saveCompanyInfo(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Company');
    if (!sh) sh = ss.insertSheet('Company');

    var fields = {
      company_name:     data.name    || '',
      company_name_en:  data.nameEn  || '',
      company_address:  data.address || '',
      company_phone:    data.phone   || '',
      company_email:    data.email   || '',
      company_taxid:    data.taxId   || '',
      company_logo_url: data.logoUrl || ''
    };

    var last = sh.getLastRow();
    var keyRows = {};
    if (last >= 1) {
      var keys = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        var k = String(keys[i][0] || '').trim();
        if (k) keyRows[k] = i + 1;
      }
    }
    Object.keys(fields).forEach(function(key) {
      // logoUrl: อัปเดตเฉพาะเมื่อส่งค่ามา หรือสั่งลบ (clearLogo) — ไม่ลบของเดิมถ้าไม่ได้เปลี่ยนโลโก้
      if (key === 'company_logo_url' && !data.logoUrl && !data.clearLogo && keyRows[key]) return;
      if (keyRows[key]) {
        sh.getRange(keyRows[key], 2).setValue(fields[key]);
      } else {
        sh.appendRow([key, fields[key]]);
      }
    });
    return jsonOut({ status: 'ok', message: 'บันทึกข้อมูลบริษัทแล้ว' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── uploadLogo: รับไฟล์ base64 → บันทึกลง Drive คืน URL ───────
// data: { fileName, mimeType, base64 }
function uploadLogo(data) {
  try {
    if (!data.base64) throw new Error('base64 is required');
    var folder = _getOrCreateFolderPath(['appsheet', 'data', 'PTSytem-1001399782', 'Company']);

    var origName = data.fileName || 'logo.png';
    var extMatch = origName.match(/\.([a-zA-Z0-9]+)$/);
    var ext = extMatch ? extMatch[1] : 'png';
    var fileName = 'logo.' + ext;

    var bytes = Utilities.base64Decode(data.base64);
    var blob  = Utilities.newBlob(bytes, data.mimeType || 'image/png', fileName);
    var file  = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ใช้ URL รูปแบบ lh3.googleusercontent.com — แสดงผลใน <img> ได้แน่นอนกว่า drive.google.com/uc
    // (ตัวหลังมักเจอหน้า "ยืนยันการสแกนไวรัส" ทำให้รูปไม่ขึ้น)
    var url = 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w400';
    return jsonOut({ status: 'ok', url: url, fileId: file.getId() });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── uploadPOItemImage: รับไฟล์ base64 → บันทึกลง Drive คืน URL (รูปรายการในใบสั่งซื้อ) ──
// data: { fileName, mimeType, base64 }
function uploadPOItemImage(data) {
  try {
    if (!data.base64) throw new Error('base64 is required');
    var folder = _getOrCreateFolderPath(['appsheet', 'data', 'PTSytem-1001399782', 'PO_Items']);

    var origName = data.fileName || 'item.png';
    var extMatch = origName.match(/\.([a-zA-Z0-9]+)$/);
    var ext = extMatch ? extMatch[1] : 'png';
    var fileName = 'item_' + new Date().getTime() + '.' + ext;

    var bytes = Utilities.base64Decode(data.base64);
    var blob  = Utilities.newBlob(bytes, data.mimeType || 'image/png', fileName);
    var file  = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var url = 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w400';
    return jsonOut({ status: 'ok', url: url, fileId: file.getId() });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── getCustomers: ดึงรายชื่อลูกค้าจากชีต "Customers" (A-G) ────
// A=รหัสลูกค้า, B=ชื่อ/บริษัท, C=สาขา, D=เลขผู้เสียภาษี, E=ที่อยู่, F=เบอร์โทร, G=ผู้ติดต่อ
function getCustomers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Customers');
    if (!sh) return jsonOut({ status: 'ok', customers: [] });
    var last = sh.getLastRow();
    if (last < 2) return jsonOut({ status: 'ok', customers: [] }); // แถว 1 = หัวตาราง
    var vals = sh.getRange(2, 1, last - 1, 7).getValues();
    var customers = vals.map(function(r) {
      return {
        code:    String(r[0] || '').trim(),
        name:    String(r[1] || '').trim(),
        branch:  String(r[2] || '').trim(),
        taxId:   String(r[3] || '').trim(),
        address: String(r[4] || '').trim(),
        phone:   String(r[5] || '').trim(),
        contact: String(r[6] || '').trim()
      };
    }).filter(function(c) { return c.name; });
    return jsonOut({ status: 'ok', customers: customers });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── saveCustomer: เพิ่ม/แก้ไขลูกค้า (ค้นหาด้วย code; ถ้าไม่มี code = เพิ่มใหม่) ──
// data: { code, name, branch, taxId, address, phone, contact }
function saveCustomer(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Customers');
    if (!sh) sh = ss.insertSheet('Customers');

    var name = String(data.name || '').trim();
    if (!name) throw new Error('name is required');
    var code = String(data.code || '').trim();
    var last = sh.getLastRow();

    var found = -1;
    if (code && last >= 1) {
      var codes = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) { found = i + 1; break; }
      }
    }
    if (!code) code = 'C' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyMMddHHmmss');

    var row = [
      code, name,
      String(data.branch  || '').trim(),
      String(data.taxId   || '').trim(),
      String(data.address || '').trim(),
      String(data.phone   || '').trim(),
      String(data.contact || '').trim()
    ];
    if (found !== -1) {
      sh.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return jsonOut({ status: 'ok', code: code, note: found !== -1 ? 'updated' : 'added' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deleteCustomer: ลบลูกค้าตามรหัส ───────────────────────────
function deleteCustomer(code) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    code = String(code || '').trim();
    if (!code) throw new Error('code is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Customers');
    if (!sh) throw new Error('ไม่พบ sheet Customers');
    var last = sh.getLastRow();
    for (var i = last; i >= 1; i--) {
      if (String(sh.getRange(i, 1).getValue()).trim() === code) {
        sh.deleteRow(i);
        return jsonOut({ status: 'ok', deleted: code });
      }
    }
    throw new Error('ไม่พบ ' + code);
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getItemMaster: ดึงรายการสินค้า/บริการที่ใช้บ่อยจากชีต "ItemMaster" (A-D) ──
// A=รหัส, B=ชื่อรายการ, C=หน่วย, D=ราคา/หน่วย
function getItemMaster() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('ItemMaster');
    if (!sh) return jsonOut({ status: 'ok', items: [] });
    var last = sh.getLastRow();
    if (last < 2) return jsonOut({ status: 'ok', items: [] }); // แถว 1 = หัวตาราง
    var vals = sh.getRange(2, 1, last - 1, 4).getValues();
    var items = vals.map(function(r) {
      return {
        code:  String(r[0] || '').trim(),
        name:  String(r[1] || '').trim(),
        unit:  String(r[2] || '').trim(),
        price: Number(r[3] || 0)
      };
    }).filter(function(it) { return it.name; });
    return jsonOut({ status: 'ok', items: items });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── saveItem: เพิ่ม/แก้ไขรายการสินค้า/บริการ (ค้นหาด้วย code; ถ้าไม่มี code = เพิ่มใหม่) ──
// data: { code, name, unit, price }
function saveItem(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('ItemMaster');
    if (!sh) {
      sh = ss.insertSheet('ItemMaster');
      sh.appendRow(['code','name','unit','price']);
    }

    var name = String(data.name || '').trim();
    if (!name) throw new Error('name is required');
    var code = String(data.code || '').trim();
    var last = sh.getLastRow();

    var found = -1;
    if (code && last >= 1) {
      var codes = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim() === code) { found = i + 1; break; }
      }
    }
    if (!code) code = 'I' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyMMddHHmmss');

    var row = [
      code, name,
      String(data.unit  || 'ชิ้น').trim(),
      Number(data.price || 0)
    ];
    if (found !== -1) {
      sh.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return jsonOut({ status: 'ok', code: code, note: found !== -1 ? 'updated' : 'added' });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deleteItem: ลบรายการสินค้า/บริการตามรหัส ─────────────────
function deleteItem(code) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    code = String(code || '').trim();
    if (!code) throw new Error('code is required');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('ItemMaster');
    if (!sh) throw new Error('ไม่พบ sheet ItemMaster');
    var last = sh.getLastRow();
    for (var i = last; i >= 1; i--) {
      if (String(sh.getRange(i, 1).getValue()).trim() === code) {
        sh.deleteRow(i);
        return jsonOut({ status: 'ok', deleted: code });
      }
    }
    throw new Error('ไม่พบ ' + code);
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getInvoices: ดึงรายการใบกำกับภาษีทั้งหมดจากชีต "Invoices" ──
// คอลัมน์: A=เลขที่ใบกำกับ B=วันที่ออก C=ประเภท D=รหัสลูกค้า
//          E=รายการPO(comma) F=ยอดก่อนVAT G=VAT H=ยอดรวม I=สถานะ J=ผู้ออก K=รายการสินค้า(JSON)
function getInvoices() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Invoices');
    if (!sh) return jsonOut({ status: 'ok', invoices: [] });
    var last = sh.getLastRow();
    if (last < 1) return jsonOut({ status: 'ok', invoices: [] });
    var vals = sh.getRange(1, 1, last, 12).getValues();
    var invoices = vals.map(function(r) {
      var dateVal = r[1];
      var dateStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy')
        : String(dateVal || '').trim();
      var items = [];
      try { items = r[10] ? JSON.parse(r[10]) : []; } catch (e2) { items = []; }
      return {
        invoiceNo:   String(r[0] || '').trim(),
        date:        dateStr,
        type:        String(r[2] || '').trim(),
        customerCode:String(r[3] || '').trim(),
        poList:      String(r[4] || '').trim(),
        subtotal:    parseFloat(r[5]) || 0,
        vat:         parseFloat(r[6]) || 0,
        total:       parseFloat(r[7]) || 0,
        status:      String(r[8] || '').trim(),
        issuedBy:    String(r[9] || '').trim(),
        items:       items,
        billNo:      String(r[11] || '').trim()
      };
    }).filter(function(x) { return x.invoiceNo; });
    return jsonOut({ status: 'ok', invoices: invoices });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── ใบกำกับภาษี: เลขที่เอกสาร รูปแบบ {YY}{MM}{SSS} ────────────
// YY = ปี ค.ศ. 2 หลักท้าย, MM = เดือน 2 หลัก, SSS = เลขลำดับ 3 หลัก
// ใช้เลขลำดับร่วมกันทั้งแบบเต็มรูปและอย่างย่อในเดือนเดียวกัน
function _invoicePrefix(type) {
  return (type === 'short') ? 'ABB' : 'INV';
}
function _peekNextInvoiceNo(type) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Invoices');
  var prefix = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyMM');
  var maxSeq = 0;
  if (sh) {
    var last = sh.getLastRow();
    if (last >= 1) {
      sh.getRange(1, 1, last, 1).getValues().forEach(function(r) {
        var v = String(r[0] || '').trim();
        if (v.indexOf(prefix) === 0 && v.length === prefix.length + 3) {
          var seq = parseInt(v.substring(prefix.length), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
    }
  }
  return prefix + ('00' + (maxSeq + 1)).slice(-3);
}

// ── saveInvoiceRecord: ออกเลขที่ใบกำกับใหม่ + log + mark PO ที่เกี่ยวข้อง ──
// data: { type:'full'|'short', customerCode, poList:[noPO,...],
//         subtotal, vat, total, issuedBy }
// คอลัมน์ Invoices: A=เลขที่ใบกำกับ B=วันที่ออก C=ประเภท D=รหัสลูกค้า
//                   E=รายการPO(comma) F=ยอดก่อนVAT G=VAT H=ยอดรวม I=สถานะ J=ผู้ออก
// คอลัมน์ Order: AC(29)=เลขที่ใบกำกับ AD(30)=วันที่ออกใบกำกับ
function saveInvoiceRecord(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Invoices');
    if (!sh) sh = ss.insertSheet('Invoices');

    var type = (data.type === 'short') ? 'short' : 'full';
    var invoiceNo = _peekNextInvoiceNo(type);
    var now = new Date();
    var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
    var poList = Array.isArray(data.poList) ? data.poList : [];

    var items = Array.isArray(data.items) ? data.items : [];

    sh.appendRow([
      invoiceNo, dateStr, (type === 'short' ? 'อย่างย่อ' : 'เต็มรูป'),
      String(data.customerCode || ''), poList.join(', '),
      parseFloat(data.subtotal) || 0, parseFloat(data.vat) || 0, parseFloat(data.total) || 0,
      'ออกแล้ว', String(data.issuedBy || ''), JSON.stringify(items)
    ]);

    // ── mark Order rows ที่เกี่ยวข้อง ──
    var shO = ss.getSheetByName('Order');
    if (shO && poList.length) {
      var lastO = shO.getLastRow();
      if (lastO >= 2) {
        var colB = shO.getRange(2, 2, lastO - 1, 1).getValues();
        for (var i = 0; i < colB.length; i++) {
          var noPO = String(colB[i][0]).trim();
          if (poList.indexOf(noPO) !== -1) {
            shO.getRange(i + 2, 29).setValue(invoiceNo); // AC
            shO.getRange(i + 2, 30).setValue(dateStr);   // AD
          }
        }
      }
    }

    return jsonOut({ status: 'ok', invoiceNo: invoiceNo, date: dateStr });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── updateInvoiceRecord: แก้ไขรายละเอียดใบกำกับเดิม (ไม่เปลี่ยนเลขที่) ──
// data: { invoiceNo, date(dd/MM/yyyy), type, customerCode, poList:[noPO,...],
//         subtotal, vat, total, status }
function updateInvoiceRecord(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Invoices');
    if (!sh) throw new Error('ไม่พบ sheet Invoices');

    var invoiceNo = String(data.invoiceNo || '').trim();
    if (!invoiceNo) throw new Error('ไม่พบเลขที่ใบกำกับ');

    var last = sh.getLastRow();
    var found = -1;
    if (last >= 1) {
      var col = sh.getRange(1, 1, last, 1).getValues();
      for (var i = 0; i < col.length; i++) {
        if (String(col[i][0]).trim() === invoiceNo) { found = i + 1; break; }
      }
    }
    if (found === -1) throw new Error('ไม่พบใบกำกับ ' + invoiceNo);

    var type = (data.type === 'short') ? 'short' : 'full';
    var poList = Array.isArray(data.poList) ? data.poList : [];
    var dateStr = String(data.date || '').trim();
    var items = Array.isArray(data.items) ? data.items : [];

    sh.getRange(found, 2, 1, 10).setValues([[
      dateStr, (type === 'short' ? 'อย่างย่อ' : 'เต็มรูป'),
      String(data.customerCode || ''), poList.join(', '),
      parseFloat(data.subtotal) || 0, parseFloat(data.vat) || 0, parseFloat(data.total) || 0,
      String(data.status || 'ออกแล้ว'), String(data.issuedBy || ''), JSON.stringify(items)
    ]]);

    return jsonOut({ status: 'ok', invoiceNo: invoiceNo });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── deleteInvoiceRecord: ลบใบกำกับออกจากชีต Invoices + เคลียร์ AC/AD ใน Order ──
function deleteInvoiceRecord(invoiceNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    invoiceNo = String(invoiceNo || '').trim();
    if (!invoiceNo) throw new Error('ไม่พบเลขที่ใบกำกับ');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Invoices');
    if (!sh) throw new Error('ไม่พบ sheet Invoices');
    var last = sh.getLastRow();
    var found = -1;
    for (var i = last; i >= 1; i--) {
      if (String(sh.getRange(i, 1).getValue()).trim() === invoiceNo) { found = i; break; }
    }
    if (found === -1) throw new Error('ไม่พบใบกำกับ ' + invoiceNo);
    sh.deleteRow(found);

    // ── เคลียร์ AC (เลขที่ใบกำกับ) / AD (วันที่ออกใบกำกับ) ใน Order ที่ตรงกับเลขนี้ ──
    var shO = ss.getSheetByName('Order');
    if (shO) {
      var lastO = shO.getLastRow();
      if (lastO >= 2) {
        var colAC = shO.getRange(2, 29, lastO - 1, 1).getValues(); // AC = 29
        for (var j = 0; j < colAC.length; j++) {
          if (String(colAC[j][0]).trim() === invoiceNo) {
            shO.getRange(j + 2, 29, 1, 2).clearContent(); // AC, AD
          }
        }
      }
    }

    return jsonOut({ status: 'ok', deleted: invoiceNo });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════
// ══ ใบวางบิล (BillingNote) ═══════════════════════════════
// ══════════════════════════════════════════════════════
// คอลัมน์ BillingNote: A=เลขที่ใบวางบิล B=วันที่ออก C=รหัสลูกค้า
//   D=รายการเลขที่ใบกำกับ(comma) E=ยอดรวม F=หัก ณ ที่จ่าย 3% G=ยอดรับสุทธิ
//   H=เงื่อนไขชำระเงิน I=ผู้ออก

// ── เสนอเลขที่ใบวางบิลถัดไป รูปแบบ BI{ปี พ.ศ. 2 หลัก}/{เลขลำดับ 2 หลัก} ──
// อิงจากปี พ.ศ. ปัจจุบัน แยกรันแต่ละปี (ผู้ใช้แก้ไข/ตั้งใหม่เองได้เสมอ)
function _peekNextBillNo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('BillingNote');
  var now = new Date();
  var yy  = String((now.getFullYear() + 543) % 100);
  if (yy.length < 2) yy = '0' + yy;
  var prefix = 'BI' + yy + '/';
  var maxSeq = 0;
  if (sh) {
    var last = sh.getLastRow();
    if (last >= 1) {
      sh.getRange(1, 1, last, 1).getValues().forEach(function(r) {
        var v = String(r[0] || '').trim();
        if (v.indexOf(prefix) === 0) {
          var seq = parseInt(v.substring(prefix.length), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
    }
  }
  return prefix + ('0' + (maxSeq + 1)).slice(-2);
}

// ── saveBillingNote: บันทึกใบวางบิลใหม่ + มาร์คใบกำกับที่เลือกว่าวางบิลแล้ว ──
// data: { billNo, billDate(dd/MM/yyyy), customerCode, invoiceNos:[...],
//         sumTotal, whtAmount, netAmount, payTerm, issuedBy }
function saveBillingNote(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('BillingNote');
    if (!sh) sh = ss.insertSheet('BillingNote');

    var billNo = String(data.billNo || '').trim();
    if (!billNo) throw new Error('กรุณากรอกเลขที่ใบวางบิล');

    var invoiceNos = Array.isArray(data.invoiceNos) ? data.invoiceNos.map(function(x){ return String(x).trim(); }).filter(Boolean) : [];
    if (!invoiceNos.length) throw new Error('ไม่พบรายการใบกำกับที่เลือก');

    var dateStr = String(data.billDate || '').trim() ||
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');

    sh.appendRow([
      billNo, dateStr, String(data.customerCode || ''), invoiceNos.join(', '),
      parseFloat(data.sumTotal) || 0, parseFloat(data.whtAmount) || 0, parseFloat(data.netAmount) || 0,
      String(data.payTerm || ''), String(data.issuedBy || '')
    ]);

    // ── มาร์คใบกำกับที่เลือกว่า "วางบิลแล้ว" (คอลัมน์ L=12 ของ Invoices) ──
    var shI = ss.getSheetByName('Invoices');
    if (shI) {
      var lastI = shI.getLastRow();
      if (lastI >= 1) {
        var colA = shI.getRange(1, 1, lastI, 1).getValues();
        for (var i = 0; i < colA.length; i++) {
          var invNo = String(colA[i][0]).trim();
          if (invoiceNos.indexOf(invNo) !== -1) {
            shI.getRange(i + 1, 12).setValue(billNo); // L = billNo
          }
        }
      }
    }

    return jsonOut({ status: 'ok', billNo: billNo, date: dateStr });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getBillingNotes: ดึงประวัติใบวางบิลทั้งหมด (สำหรับดู/พิมพ์ซ้ำในอนาคต) ──
function getBillingNotes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('BillingNote');
    if (!sh) return jsonOut({ status: 'ok', bills: [] });
    var last = sh.getLastRow();
    if (last < 1) return jsonOut({ status: 'ok', bills: [] });
    var vals = sh.getRange(1, 1, last, 9).getValues();
    var bills = vals.map(function(r) {
      var dateVal = r[1];
      var dateStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy')
        : String(dateVal || '').trim();
      return {
        billNo:      String(r[0] || '').trim(),
        date:        dateStr,
        customerCode:String(r[2] || '').trim(),
        invoiceNos:  String(r[3] || '').trim(),
        sumTotal:    parseFloat(r[4]) || 0,
        whtAmount:   parseFloat(r[5]) || 0,
        netAmount:   parseFloat(r[6]) || 0,
        payTerm:     String(r[7] || '').trim(),
        issuedBy:    String(r[8] || '').trim()
      };
    }).filter(function(x) { return x.billNo; });
    return jsonOut({ status: 'ok', bills: bills });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── deleteBillingNote: ยกเลิกใบวางบิล — ลบแถวใน BillingNote + เคลียร์ billNo ในใบกำกับที่เกี่ยวข้อง ──
// data: { billNo }
function deleteBillingNote(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var billNo = String(data.billNo || '').trim();
    if (!billNo) throw new Error('ไม่พบเลขที่ใบวางบิล');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('BillingNote');
    var found = false;
    if (sh) {
      var last = sh.getLastRow();
      if (last >= 1) {
        var colA = sh.getRange(1, 1, last, 1).getValues();
        for (var i = colA.length - 1; i >= 0; i--) {
          if (String(colA[i][0]).trim() === billNo) {
            sh.deleteRow(i + 1);
            found = true;
            break;
          }
        }
      }
    }
    if (!found) throw new Error('ไม่พบใบวางบิลเลขที่ ' + billNo);

    // ── เคลียร์ billNo ในใบกำกับที่ถูกมาร์คไว้ (คอลัมน์ L=12 ของ Invoices) ──
    var shI = ss.getSheetByName('Invoices');
    if (shI) {
      var lastI = shI.getLastRow();
      if (lastI >= 1) {
        var colL = shI.getRange(1, 12, lastI, 1).getValues();
        for (var j = 0; j < colL.length; j++) {
          if (String(colL[j][0]).trim() === billNo) {
            shI.getRange(j + 1, 12).setValue('');
          }
        }
      }
    }

    return jsonOut({ status: 'ok', billNo: billNo });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── Async Telegram via one-time trigger ──────────────────────
function scheduleTelegram() {
  try {
    // ลบ trigger เก่าที่ค้างอยู่ก่อน (ป้องกัน accumulate)
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === 'sendTelegramOnChangeManual') {
        ScriptApp.deleteTrigger(t);
      }
    });
    // สร้าง trigger ใหม่ ยิงหลัง 5 วินาที
    ScriptApp.newTrigger('sendTelegramOnChangeManual')
      .timeBased()
      .after(5000)
      .create();
  } catch(e) {
    Logger.log('scheduleTelegram error: ' + e);
  }
}

// ══════════════════════════════════════════════════════
// ══ ใบส่งชุบ (PlatingNote) ═══════════════════════════════
// ══════════════════════════════════════════════════════
// คอลัมน์ PlatingNote: A=เลขที่ใบส่งชุบ B=วันที่ออก C=รหัสร้านชุบ
//   D=รายการ(JSON) E=ผู้ออก F=รายการเลขที่ Order(comma)

// ── เสนอเลขที่ใบส่งชุบถัดไป รูปแบบ ZP{ปี พ.ศ. 2 หลัก}/{เลขลำดับ 2 หลัก} ──
// อิงจากปี พ.ศ. ปัจจุบัน แยกรันแต่ละปี (ผู้ใช้แก้ไข/ตั้งใหม่เองได้เสมอ)
function _peekNextPlatingNo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PlatingNote');
  var now = new Date();
  var yy  = String((now.getFullYear() + 543) % 100);
  if (yy.length < 2) yy = '0' + yy;
  var prefix = 'ZP' + yy + '/';
  var maxSeq = 0;
  if (sh) {
    var last = sh.getLastRow();
    if (last >= 1) {
      sh.getRange(1, 1, last, 1).getValues().forEach(function(r) {
        var v = String(r[0] || '').trim();
        if (v.indexOf(prefix) === 0) {
          var seq = parseInt(v.substring(prefix.length), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
    }
  }
  return prefix + ('0' + (maxSeq + 1)).slice(-2);
}

// ── savePlatingNote: บันทึกใบส่งชุบใหม่ + เปลี่ยนสถานะ Process ของ Order ที่เลือกเป็น "อยู่ระหว่างชุบ" ──
// data: { platingNo, platingDate(dd/MM/yyyy), supplierCode, items:[...], orderNos:[...], issuedBy }
function savePlatingNote(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingNote');
    if (!sh) sh = ss.insertSheet('PlatingNote');

    var platingNo = String(data.platingNo || '').trim();
    if (!platingNo) throw new Error('กรุณากรอกเลขที่ใบส่งชุบ');

    var items = Array.isArray(data.items) ? data.items : [];
    var orderNos = Array.isArray(data.orderNos) ? data.orderNos.map(function(x){ return String(x).trim(); }).filter(Boolean) : [];

    var dateStr = String(data.platingDate || '').trim() ||
      Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');

    sh.appendRow([
      platingNo, dateStr, String(data.supplierCode || ''),
      JSON.stringify(items), String(data.issuedBy || ''), orderNos.join(', ')
    ]);

    return jsonOut({ status: 'ok', platingNo: platingNo, date: dateStr });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── getPlatingNotes: ดึงประวัติใบส่งชุบทั้งหมด (สำหรับดู/พิมพ์ซ้ำ) ──
function getPlatingNotes() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingNote');
    if (!sh) return jsonOut({ status: 'ok', plates: [] });
    var last = sh.getLastRow();
    if (last < 1) return jsonOut({ status: 'ok', plates: [] });
    var vals = sh.getRange(1, 1, last, 6).getValues();
    var plates = vals.map(function(r) {
      var dateVal = r[1];
      var dateStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy')
        : String(dateVal || '').trim();
      var items = [];
      try { items = r[3] ? JSON.parse(r[3]) : []; } catch (e2) { items = []; }
      return {
        platingNo:   String(r[0] || '').trim(),
        date:        dateStr,
        supplierCode:String(r[2] || '').trim(),
        items:       items,
        issuedBy:    String(r[4] || '').trim(),
        orderNos:    String(r[5] || '').trim()
      };
    }).filter(function(x) { return x.platingNo; });
    return jsonOut({ status: 'ok', plates: plates });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  }
}

// ── deletePlatingNote: ยกเลิกใบส่งชุบ — ลบแถวใน PlatingNote (ไม่ revert สถานะ Order) ──
// data: { platingNo }
function deletePlatingNote(data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var platingNo = String(data.platingNo || '').trim();
    if (!platingNo) throw new Error('ไม่พบเลขที่ใบส่งชุบ');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('PlatingNote');
    var found = false;
    if (sh) {
      var last = sh.getLastRow();
      if (last >= 1) {
        var colA = sh.getRange(1, 1, last, 1).getValues();
        for (var i = colA.length - 1; i >= 0; i--) {
          if (String(colA[i][0]).trim() === platingNo) {
            sh.deleteRow(i + 1);
            found = true;
            break;
          }
        }
      }
    }
    if (!found) throw new Error('ไม่พบใบส่งชุบเลขที่ ' + platingNo);

    return jsonOut({ status: 'ok', platingNo: platingNo });
  } catch (e) {
    return jsonOut({ status: 'error', message: e.message });
  } finally {
    lock.releaseLock();
  }
}
