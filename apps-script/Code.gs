/**
 * Google Apps Script — passive mirror for expense-tracker.
 *
 * SETUP
 *  1. Create/open a Google Sheet.
 *  2. Extensions -> Apps Script. Delete any boilerplate, paste this file.
 *  3. Project Settings (gear icon) -> Script Properties -> Add property:
 *       Name:  SHARED_SECRET
 *       Value: <the same strong secret you'll set as SHEETS_SHARED_SECRET in wrangler>
 *  4. Deploy -> New deployment -> type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Authorize when prompted. Copy the /exec URL and send it to Claude;
 *     it becomes the SHEETS_WEBHOOK_URL worker secret.
 *
 * SECURITY
 *  "Who has access: Anyone" exposes only this endpoint, NOT the spreadsheet
 *  (the Sheet's own sharing stays private). The SHARED_SECRET check below
 *  rejects any POST that doesn't carry the matching secret, so only our Worker
 *  can append rows. The script runs as you (Execute as: Me).
 *
 * The Worker POSTs JSON. We append a row, or update the existing row on UPDATE
 * (matched by the Mongo _id column) so the sheet stays in sync.
 */

var SHEET_NAME = 'Expenses';
var HEADERS = [
  'Timestamp', '_id', 'type', 'date', 'amount', 'category',
  'item', 'source', 'currency', 'totalBill', 'splitWith'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Shared-secret gate: reject anything that isn't from our Worker.
    var expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!expected || body.secret !== expected) {
      return out_({ ok: false, error: 'unauthorized' });
    }

    var sheet = getSheet_();

    var row = [
      new Date(),
      body._id || '',
      body.type || 'ADD',
      body.date || '',            // DD-MM-YYYY
      body.amount != null ? body.amount : '',
      body.category || '',
      body.item || body.note || '',
      body.source || '',
      body.currency || 'INR',
      body.totalBill != null ? body.totalBill : '',
      body.splitWith != null ? body.splitWith : ''
    ];

    // On UPDATE, try to overwrite the existing row for this _id.
    if (body.type === 'UPDATE' && body._id) {
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][1]) === String(body._id)) {
          row[0] = values[i][0]; // preserve original timestamp
          sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
          return out_({ ok: true, updated: true });
        }
      }
    }

    sheet.appendRow(row);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, service: 'expense-tracker sheets mirror' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
