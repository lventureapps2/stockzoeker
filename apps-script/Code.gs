/**
 * Stockzoeker – Google Apps Script
 * Geeft de stocklijst (klant, product, palletnummer, hoeveelheid, locatie)
 * uit het tabblad "Stock nazicht_Nieuw" terug aan de Stockzoeker-app.
 *
 * Dit script LEEST alleen. Het schrijft, wijzigt of verwijdert nooit iets in
 * de Sheet. Het is een apart script met een eigen sleutel, los van Palletscan.
 *
 * @OnlyCurrentDoc
 */

/* ======================= CONFIGURATIE ======================= */
var READ_KEY   = 'VERVANG-DIT-DOOR-EEN-EIGEN-LEESSLEUTEL'; // dezelfde sleutel als in de app (⚙). Niet de sleutel van Palletscan.
var SHEET_NAME = 'Stock nazicht_Nieuw';
var FIRST_COL  = 22;   // kolom V: vanaf hier worden de meeste kopjes gezocht (KLANT, PRODUCT NAME en Pal NR staan ook in A-D, die mogen niet meetellen)
var HEADER_ROW = 1;
// De kolommen worden op hun kopje gevonden, niet op hun letter. Een kolom
// tussenvoegen in de Sheet breekt dus niets, een kopje hernoemen wel: pas het
// dan ook hier aan. Vergelijking is hoofdletterongevoelig, spaties tellen niet.
// "from" = vanaf welke kolom het kopje gezocht wordt (standaard FIRST_COL).
// Status staat in kolom C, op dezelfde rij als de pallet in V-AC.
var HEADERS = {
  klant:    { text: 'KLANT' },
  product:  { text: 'PRODUCT NAME' },
  pal:      { text: 'Pal NR' },
  meters:   { text: 'Meters op pallet' },
  stuks:    { text: 'Aantal stuks op pallet' },
  datum:    { text: 'Datum opmeting' },
  locatie:  { text: 'Locatie' },
  magazijn: { text: 'Magazijn' },
  status:   { text: 'Status', from: 1 }
};
var ORDER = ['klant', 'product', 'pal', 'meters', 'stuks', 'datum', 'locatie', 'magazijn', 'status']; // volgorde in elke rij van het antwoord; de app rekent hierop
/* ============================================================ */

/** De app stuurt hierheen: { key, action: "stock" } of { key, ping: true } */
function doPost(e) {
  var out;
  try {
    out = handle_(JSON.parse(e.postData.contents));
  } catch (err) {
    out = { ok: false, error: 'server', detail: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Het adres openen in een browser toont alleen dat het script draait. Zonder sleutel komt er geen stock. */
function doGet() {
  return ContentService.createTextOutput('Stockzoeker: het script is actief.').setMimeType(ContentService.MimeType.TEXT);
}

function handle_(req) {
  if (!req || typeof req.key !== 'string' || req.key !== READ_KEY || READ_KEY.indexOf('VERVANG') === 0) {
    return { ok: false, error: 'unauthorized' };
  }
  if (req.ping) return { ok: true, pong: true };
  if (req.action !== 'stock') return { ok: false, error: 'badaction' };
  return readStock_();
}

/** Leest de stocklijst en geeft ze terug als rijen van zeven tekstwaarden. */
function readStock_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { ok: false, error: 'badsheet', detail: 'Tabblad "' + SHEET_NAME + '" niet gevonden' };

  var lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  if (lastCol < FIRST_COL || lastRow < HEADER_ROW) return { ok: false, error: 'badheader', detail: 'Tabblad is leeg' };

  // Kopjes zoeken: elk vanaf zijn eigen startkolom (meestal V).
  var heads = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getDisplayValues()[0];
  var col = {}, missing = [];
  ORDER.forEach(function (k) {
    var h = HEADERS[k], from = h.from || FIRST_COL, want = norm_(h.text), found = -1;
    for (var i = from - 1; i < heads.length && found < 0; i++) if (norm_(heads[i]) === want) found = i + 1;
    if (found < 0) missing.push(h.text + ' (vanaf kolom ' + colLetter_(from) + ')'); else col[k] = found;
  });
  if (missing.length) return { ok: false, error: 'badheader', detail: 'Kopje(s) niet gevonden: ' + missing.join(', ') };

  var rows = [];
  if (lastRow > HEADER_ROW) {
    var minCol = Math.min.apply(null, ORDER.map(function (k) { return col[k]; }));
    var maxCol = Math.max.apply(null, ORDER.map(function (k) { return col[k]; }));
    // Weergavewaarden: wat de gebruiker in de Sheet ziet ("7.160 m", "29-8-2026"),
    // niet de ruwe getallen. #N/A komt ook zo door; de app toont dat als "–".
    var block = sheet.getRange(HEADER_ROW + 1, minCol, lastRow - HEADER_ROW, maxCol - minCol + 1).getDisplayValues();
    for (var r = 0; r < block.length; r++) {
      var line = ORDER.map(function (k) { return String(block[r][col[k] - minCol] || '').trim(); });
      if (line[0] === '' && line[1] === '' && line[2] === '') continue; // lege regel in de lijst
      rows.push(line);
    }
  }
  return { ok: true, at: Date.now(), sheet: SHEET_NAME, columns: ORDER, rows: rows };
}

/** Kopjes vergelijkbaar maken: kleine letters, alle witruimte (ook regeleinden) weg. */
function norm_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Eén keer uitvoeren vanuit de editor (knop "Uitvoeren") om toegang te geven
 * en te controleren dat de kopjes gevonden worden. Het resultaat staat in het
 * logvenster onderaan.
 */
function eersteKeerInstellen() {
  var out = readStock_();
  if (!out.ok) { Logger.log('FOUT: ' + out.error + ' – ' + (out.detail || '')); return; }
  Logger.log('In orde: ' + out.rows.length + ' regels gelezen uit "' + out.sheet + '".');
  if (out.rows.length) Logger.log('Eerste regel: ' + JSON.stringify(out.rows[0]));
}
