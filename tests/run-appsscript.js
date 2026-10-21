/*
 * Stockzoeker – Code.gs testen tegen een nagebootste Sheet.
 * Uitvoeren:  node tests/run-appsscript.js
 */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

/* ---------- nagebootste Google-omgeving ---------- */
function makeSheet(name, grid) {
  var lastCol = grid.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  return {
    getName: function () { return name; },
    getLastRow: function () { return grid.length; },
    getLastColumn: function () { return lastCol; },
    getRange: function (row, col, nRows, nCols) {
      return {
        getDisplayValues: function () {
          var out = [];
          for (var r = 0; r < nRows; r++) {
            var line = [];
            for (var c = 0; c < nCols; c++) {
              var g = grid[row - 1 + r] || [];
              line.push(g[col - 1 + c] == null ? '' : String(g[col - 1 + c]));
            }
            out.push(line);
          }
          return out;
        }
      };
    }
  };
}
function makeEnv(sheets) {
  var logs = [];
  return {
    logs: logs,
    SpreadsheetApp: { getActiveSpreadsheet: function () { return { getSheetByName: function (n) { return sheets[n] || null; } }; } },
    ContentService: {
      MimeType: { JSON: 'json', TEXT: 'text' },
      createTextOutput: function (s) { var o = { text: s, mime: null }; o.setMimeType = function (m) { o.mime = m; return o; }; return o; }
    },
    Logger: { log: function (s) { logs.push(String(s)); } },
    Date: Date, JSON: JSON, Math: Math, String: String, Number: Number, Array: Array, Object: Object
  };
}
function load(env, key) {
  var src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  if (key) src = src.replace(/var READ_KEY\s*=\s*'[^']*'/, "var READ_KEY = '" + key + "'");
  vm.createContext(env);
  vm.runInContext(src, env);
  return env;
}
function post(env, body) {
  var out = env.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(out.text);
}

/* ---------- de Sheet zoals ze er echt uitziet ---------- */
// Kopregel van "Stock nazicht_Nieuw": KLANT, PRODUCT NAME en Pal NR staan in A-D én in V-X.
var HEAD = ['KLANT', 'PRODUCT NAME', 'Status', 'Pal NR', 'TOTALE PRINTMETERS\n(in meters)', 'HOEVEELHEID ZAKJES/DISPLAYS RESTEREND', 'Datum herschreven', 'Printmeters \n (in meters)',
  'Diameter rol 1', 'Diameter rol 2', 'Diameter rol 3', 'Diameter rol 4', 'Diameter rol 5', 'Diameter rol 6', 'Diameter rol 7', 'Diameter rol 8', 'Diameter rol 9', 'Diameter rol 10', '', 'labeltekst', '',
  'KLANT', 'PRODUCT NAME', 'Pal NR', 'Meters op pallet', 'Aantal stuks op pallet', 'Datum opmeting', 'Magazijn', 'Locatie', 'Totale printmeters', 'Totaal aantal stuks', 'Palletnummer', 'Soorten op pallet', 'SSCC'];
function row(a, b, c, d, v, w, x, y, z, aa, ab, ac) {
  var r = [a, b, c, d]; while (r.length < 21) r.push('');
  return r.concat([v, w, x, y, z, aa, ab, ac, '', '', '', '', '']);
}
var GRID = [HEAD,
  row('Zusto', 'Zusto UK', 'Gemeten', '482', 'Zusto ', 'FO 150mm Gourmet INT', '906', '7.160 m', '47.733 ', '29-8-2026', 'DEVE', 'C15'),
  row('?', 'x', '', '1', '?', ' fo 12pet blauw 410', '1134', '#N/A', '', '1-10-2026', 'DEVE', 'C46'),
  row('', '', '', '', '', '', '', '', '', '', '', ''),                                             // lege regel
  row('Poco', 'y', '', '2', 'Poco', 'KA-TESCO SPICES C', '0', '', '', '21-10-2026', 'SSCC Extern', ''),
  row('', '', '', '', 'Zusto ', 'Zusto USA', '482', '5.241 m', '34.937 ', '29-5-2026', 'TEE', 'Geen locatie')
];

var results = [];
function t(name, fn) { try { fn(); results.push({ name: name, ok: true }); } catch (e) { results.push({ name: name, ok: false, error: String(e && e.message || e) }); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'verwacht ' + sb + ', kreeg ' + sa); }

t('zonder sleutel: unauthorized', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'geheim-1234567890');
  eq(post(env, { action: 'stock' }).error, 'unauthorized');
  eq(post(env, { key: 'fout', action: 'stock' }).error, 'unauthorized');
});
t('standaardsleutel (VERVANG…) wordt altijd geweigerd', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }));
  eq(post(env, { key: 'VERVANG-DIT-DOOR-EEN-EIGEN-LEESSLEUTEL', action: 'stock' }).error, 'unauthorized');
});
t('ping', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  eq(post(env, { key: 'k', ping: true }), { ok: true, pong: true });
});
t('onbekende actie', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  eq(post(env, { key: 'k', action: 'schrijf' }).error, 'badaction');
});
t('stock: kolommen V-AC op kopje gevonden, niet die van A-D', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  eq(out.ok, true);
  eq(out.columns, ['klant', 'product', 'pal', 'meters', 'stuks', 'datum', 'locatie']);
  eq(out.rows[0], ['Zusto', 'FO 150mm Gourmet INT', '906', '7.160 m', '47.733', '29-8-2026', 'C15']);
});
t('stock: lege regel valt weg, regel zonder kolom A-D blijft', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  eq(out.rows.length, 4);
  eq(out.rows[3], ['Zusto', 'Zusto USA', '482', '5.241 m', '34.937', '29-5-2026', 'Geen locatie']);
});
t('stock: #N/A en lege locatie komen ongewijzigd door (de app zet ze om)', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  eq(out.rows[1][3], '#N/A'); eq(out.rows[2][6], '');
});
t('stock: antwoord heeft een tijdstip', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  if (typeof out.at !== 'number' || Math.abs(Date.now() - out.at) > 5000) throw new Error('at ontbreekt of fout: ' + out.at);
});
t('tabblad ontbreekt', function () {
  var env = load(makeEnv({}), 'k');
  eq(post(env, { key: 'k', action: 'stock' }).error, 'badsheet');
});
t('kopje hernoemd: badheader met de naam erbij', function () {
  var grid = GRID.map(function (r) { return r.slice(); });
  grid[0][28] = 'Plaats';
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', grid) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  eq(out.error, 'badheader');
  if (out.detail.indexOf('Locatie') < 0) throw new Error(out.detail);
});
t('kolom tussengevoegd: nog altijd juist', function () {
  var grid = GRID.map(function (r) { var c = r.slice(); c.splice(24, 0, c[24] === 'Meters op pallet' ? 'Extra' : 'x'); return c; });
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', grid) }), 'k');
  var out = post(env, { key: 'k', action: 'stock' });
  eq(out.ok, true);
  eq(out.rows[0], ['Zusto', 'FO 150mm Gourmet INT', '906', '7.160 m', '47.733', '29-8-2026', 'C15']);
});
t('doGet toont alleen een tekst, geen stock', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = env.doGet();
  if (out.text.indexOf('actief') < 0 || out.text.indexOf('Zusto') >= 0) throw new Error(out.text);
});
t('eersteKeerInstellen logt het aantal regels', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  env.eersteKeerInstellen();
  if (env.logs.join('\n').indexOf('4 regels') < 0) throw new Error(env.logs.join(' | '));
});
t('fout in de aanvraag geeft nette fout', function () {
  var env = load(makeEnv({ 'Stock nazicht_Nieuw': makeSheet('Stock nazicht_Nieuw', GRID) }), 'k');
  var out = JSON.parse(env.doPost({ postData: { contents: 'geen json' } }).text);
  eq(out.ok, false); eq(out.error, 'server');
});

var failed = results.filter(function (r) { return !r.ok; });
results.forEach(function (r) { console.log((r.ok ? 'OK   ' : 'FOUT ') + r.name + (r.ok ? '' : '\n      ' + r.error)); });
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' tests geslaagd');
process.exit(failed.length ? 1 : 0);
