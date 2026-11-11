/**
 * =======================================================================
 * GOOGLE APPS SCRIPT FOR FACEBOOK ADS & REVENUE MANAGEMENT WEB APP
 * =======================================================================
 * 
 * INSTRUCTIONS TO DEPLOY IN 30 SECONDS:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA/edit
 * 2. In the top menu, click Extensions > Apps Script
 * 3. Delete any default code inside Code.gs
 * 4. Paste this entire file content into Code.gs
 * 5. Click the "Save" icon (Ctrl + S)
 * 6. Click "Deploy" button (top right) > "New deployment"
 * 7. Click the gear icon next to "Select type" and choose "Web app"
 * 8. Set Description: "Facebook Ads App Backend"
 * 9. Set "Execute as": "Me"
 * 10. Set "Who has access": "Anyone" (VERY IMPORTANT: Allows your app to read/write without login)
 * 11. Click "Deploy" > "Authorize access" (Select your Google account > Advanced > Go to Untitled project > Allow)
 * 12. Copy the generated "Web app URL" (looks like: https://script.google.com/macros/s/.../exec)
 * 13. Open your App (http://localhost:3000/sheets) and paste that URL into "Google Apps Script Web App URL"!
 * =======================================================================
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'read_all';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'ping') {
    return createJsonResponse({ success: true, status: 'Connected to Google Sheet!', sheetName: ss.getName() });
  }
  
  if (action === 'read_all') {
    var data = {
      success: true,
      revenues: readSheetData(ss, 'Revenues'),
      facebookAds: readSheetData(ss, 'Facebook Ads'),
      otherExpenses: readSheetData(ss, 'Other Expenses'),
      products: readSheetData(ss, 'Products')
    };
    return createJsonResponse(data);
  }
  
  if (action === 'read') {
    var sheetName = e.parameter.sheet || 'Facebook Ads';
    return createJsonResponse({ success: true, data: readSheetData(ss, sheetName) });
  }
  
  return createJsonResponse({ success: false, error: 'Unknown GET action: ' + action });
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : '{}';
    var payload = JSON.parse(contents);
    var action = payload.action || 'create';
    var sheetName = payload.sheet || 'Facebook Ads';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, sheetName);
    
    // 1. CREATE (Insert new record)
    if (action === 'create') {
      var rowData = formatRowForSheet(sheetName, payload.data);
      sheet.appendRow(rowData);
      var lastRow = sheet.getLastRow();
      return createJsonResponse({
        success: true,
        action: 'create',
        sheet: sheetName,
        rowNumber: lastRow,
        data: payload.data
      });
    }
    
    // 2. UPDATE (Edit existing record by rowNumber or ID)
    if (action === 'update') {
      var rowNumber = payload.rowNumber;
      if (!rowNumber && payload.id) {
        rowNumber = findRowById(sheet, sheetName, payload.id);
      }
      
      if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
        return createJsonResponse({ success: false, error: 'Record not found for update' });
      }
      
      var updatedRow = formatRowForSheet(sheetName, payload.data);
      sheet.getRange(rowNumber, 1, 1, updatedRow.length).setValues([updatedRow]);
      return createJsonResponse({
        success: true,
        action: 'update',
        sheet: sheetName,
        rowNumber: rowNumber,
        data: payload.data
      });
    }
    
    // 3. DELETE (Delete record by rowNumber or ID)
    if (action === 'delete') {
      var rowNumber = payload.rowNumber;
      if (!rowNumber && payload.id) {
        rowNumber = findRowById(sheet, sheetName, payload.id);
      }
      
      if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
        return createJsonResponse({ success: false, error: 'Record not found for deletion' });
      }
      
      sheet.deleteRow(rowNumber);
      return createJsonResponse({
        success: true,
        action: 'delete',
        sheet: sheetName,
        deletedRow: rowNumber
      });
    }
    
    // 4. BULK INSERT (Batch import records)
    if (action === 'bulk_insert') {
      var rows = payload.rows || [];
      if (rows.length > 0) {
        var formattedRows = [];
        for (var i = 0; i < rows.length; i++) {
          formattedRows.push(formatRowForSheet(sheetName, rows[i]));
        }
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, formattedRows.length, formattedRows[0].length).setValues(formattedRows);
      }
      return createJsonResponse({
        success: true,
        action: 'bulk_insert',
        sheet: sheetName,
        insertedCount: rows.length
      });
    }
    
    return createJsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// Helpers
function getOrCreateSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    var headers = getDefaultHeaders(name);
    s.appendRow(headers);
  }
  return s;
}

function getDefaultHeaders(sheetName) {
  if (sheetName === 'Revenues') {
    return ['Date', 'Payment ID', 'Product Title', 'Paid By Customer', 'Earned Amount', 'Customer Email', 'Status'];
  }
  if (sheetName === 'Facebook Ads') {
    return ['Date', 'Campaign Name', 'Product', 'Amount Spent', 'Campaign Type', 'Notes'];
  }
  if (sheetName === 'Other Expenses') {
    return ['Date', 'Category', 'Description', 'Amount', 'Notes'];
  }
  if (sheetName === 'Products') {
    return ['Product Name', 'Category', 'Selling Price', 'Product Cost'];
  }
  return ['Col1', 'Col2', 'Col3', 'Col4', 'Col5'];
}

function formatRowForSheet(sheetName, data) {
  if (!data) data = {};
  if (sheetName === 'Revenues') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.payment_id || data.paymentId || ('MANUAL-' + Date.now()),
      data.product_name || data.product_title || data.productTitle || '',
      parseFloat(data.amount || data.paid_by_customer || data.paidByCustomer || 0) || 0,
      parseFloat(data.net_amount || data.earned_amount || data.earnedAmount || 0) || 0,
      data.customer_email || data.customerEmail || '',
      data.status || 'Received'
    ];
  }
  if (sheetName === 'Facebook Ads') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.campaign_name || data.campaignName || '',
      data.product_name || data.product || '',
      parseFloat(data.amount || data.amount_spent || data.amountSpent || 0) || 0,
      data.campaign_type || data.campaignType || 'Sales',
      data.notes || ''
    ];
  }
  if (sheetName === 'Other Expenses') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.category || 'Miscellaneous',
      data.description || '',
      parseFloat(data.amount || 0) || 0,
      data.notes || ''
    ];
  }
  if (sheetName === 'Products') {
    return [
      data.name || data.product_name || data.productName || '',
      data.category || 'Digital Notes',
      parseFloat(data.selling_price || data.price || 0) || 0,
      parseFloat(data.product_cost || data.cost || 0) || 0
    ];
  }
  return Object.values(data);
}

function readSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var rows = [];
  
  for (var i = 1; i < values.length; i++) {
    var rowObj = { _rowNumber: i + 1 };
    var hasContent = false;
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      var key = String(headers[j]).trim();
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      rowObj[key] = val;
      if (val !== '' && val !== null && val !== undefined) hasContent = true;
    }
    if (hasContent) {
      rows.push(rowObj);
    }
  }
  return rows;
}

function findRowById(sheet, sheetName, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  for (var i = 0; i < values.length; i++) {
    var rowNumber = i + 2;
    if (String(rowNumber) === String(id)) return rowNumber;
    if (sheetName === 'Revenues' && String(values[i][1]) === String(id)) return rowNumber;
    if (sheetName === 'Facebook Ads' && String(values[i][0] + '-' + values[i][1]) === String(id)) return rowNumber;
    if (sheetName === 'Products' && String(values[i][0]) === String(id)) return rowNumber;
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
