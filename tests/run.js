/*
 * Stockzoeker – tests van de zoeklogica.
 * Uitvoeren:   node tests/run.js
 * In de browser: tests/index.html laadt dit bestand en toont het resultaat.
 */
(function (root) {
  'use strict';
  var L = typeof require === 'function' ? require('../zoeklogic.js') : root.ZoekLogic;
  var results = [];
  function t(name, fn) {
    try { fn(); results.push({ name: name, ok: true }); }
    catch (e) { results.push({ name: name, ok: false, error: String(e && e.message || e) }); }
  }
  function eq(a, b, msg) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'verwacht ' + sb + ', kreeg ' + sa);
  }

  // Een kleine stocklijst zoals het Apps Script ze teruggeeft:
  // [klant, product, palnr, meters, stuks, datum, locatie]
  var RAW = [
    ['Zusto ', 'FO 150mm Gourmet INT', '906', '7.160 m', '47.733 ', '29-8-2026', 'C15'],
    ['Zusto ', 'Zusto UK', '482', '3.865 m', '25.765 ', '29-5-2026', 'Geen locatie'],
    ['Zusto ', 'Zusto USA', '482', '5.241 m', '34.937 ', '29-5-2026', 'Geen locatie'],
    ['Bio Minerals', 'FO Bio-Life 60mm', '585', '#N/A', '', '11-6-2026', 'A53'],
    ['Cofeo', 'DS BIO koffie 250g', '1155', '', '700 ', '2-10-2026', 'C40'],
    ['cofeo', 'DS Cofeo deca', '1180', '152 m', '2.529 ', '6-10-2026', 'B05'],
    ['?', 'delices malysse court bouillon ', '1155', '#N/A', '', '2-10-2026', 'C40'],
    ['Poco', 'KA-TESCO SPICES C', '0', '', '', '21-10-2026', ''],
    ['Nutri-Dynamics ', "FO 60mm g'woon energy gel citroen 40g", '', '1.760 m', '29.333 ', '21-10-2026', ''],
    ['Umami', 'Stickpack 2500 bio', '2500', '', '1.000 ', '1-10-2026', 'Uitgenomen'],
    ['', '', '', '', '', '', ''],
    ['Akina', 'Délices du jour', '12', '10 m', '', '3-10-2026', 'Gang 1']
  ];
  var ROWS = L.prepare(RAW);

  /* ---------- fold ---------- */
  t('fold: kleine letters en accenten weg', function () {
    eq(L.fold('  Délices  MALYSSE '), 'delices malysse');
  });
  t('fold: ´ en ’ worden een gewone apostrof', function () {
    eq(L.fold("let´s walk"), "let's walk");
    eq(L.fold("g’woon"), "g'woon");
  });

  /* ---------- palletnummer ---------- */
  t('palNumber: 585 en 0585 zijn dezelfde pallet', function () {
    eq(L.palNumber('585'), 585); eq(L.palNumber('0585'), 585); eq(L.palNumber(' 1155 '), 1155);
  });
  t('palNumber: 0, leeg of tekst is geen pallet', function () {
    eq(L.palNumber('0'), null); eq(L.palNumber(''), null); eq(L.palNumber('A03'), null); eq(L.palNumber(null), null);
  });
  t('padPal: vier cijfers', function () { eq(L.padPal(585), '0585'); eq(L.padPal(1155), '1155'); eq(L.padPal(null), ''); });

  /* ---------- classify ---------- */
  t('classify: leeg', function () { eq(L.classify('').kind, 'empty'); eq(L.classify('   ').kind, 'empty'); });
  t('classify: 1 tot 4 cijfers = palletnummer én tekst', function () {
    var q = L.classify('0585'); eq(q.kind, 'digits'); eq(q.pal, 585); eq(q.terms, ['0585']);
    q = L.classify('7'); eq(q.kind, 'digits'); eq(q.pal, 7);
  });
  t('classify: 5 cijfers is gewone tekst', function () { eq(L.classify('12345').kind, 'text'); });
  t('classify: SSCC van 18 cijfers geeft het palletnummer uit cijfers 14-17', function () {
    var q = L.classify('154199802502004042'); eq(q.kind, 'sscc'); eq(q.pal, 404); eq(q.sscc, '154199802502004042');
  });
  t('classify: SSCC met 00, (00) of ]C1 ervoor, of met spaties', function () {
    eq(L.classify('00154199802502012832').pal, 1283);
    eq(L.classify('(00)154199802502012832').pal, 1283);
    eq(L.classify(']C100154199802502012832').pal, 1283);
    eq(L.classify('1541 9980 2502 0128 32').pal, 1283);
  });
  t('classify: andere positie van de korte code', function () {
    eq(L.classify('154199802502004042', { shortCodeFrom: 1, shortCodeLen: 2 }).pal, 15);
  });
  t('classify: tekst wordt gesplitst in woorden, genormaliseerd', function () {
    eq(L.classify('  Zusto   UK ').terms, ['zusto', 'uk']);
    eq(L.classify('Délices').terms, ['delices']);
  });

  /* ---------- prepare ---------- */
  t('prepare: lege rijen vallen weg, klant leeg wordt ?, locatie leeg wordt Geen locatie', function () {
    eq(ROWS.length, 11);
    var poco = ROWS.filter(function (r) { return r.klant === 'Poco'; })[0];
    eq(poco.pal, null); eq(poco.locatie, 'Geen locatie');
  });
  t('prepare: #N/A en lege hoeveelheden worden leeg', function () {
    var bio = ROWS.filter(function (r) { return r.klant === 'Bio Minerals'; })[0];
    eq(bio.meters, ''); eq(bio.stuks, '');
  });
  t('prepare: spaties rond klant en product weg', function () {
    eq(ROWS[0].klant, 'Zusto'); eq(ROWS[0].stuks, '47.733');
  });

  /* ---------- search ---------- */
  t('search: tekst vindt klant én product, hoofdletterongevoelig', function () {
    var r = L.search(ROWS, 'bio');
    eq(r.pallet.length, 0);
    eq(r.text.map(function (x) { return x.product; }), ['FO Bio-Life 60mm', 'DS BIO koffie 250g', 'Stickpack 2500 bio']);
  });
  t('search: accenten tellen niet mee', function () {
    eq(L.search(ROWS, 'delices').text.length, 2);
    eq(L.search(ROWS, 'DÉLICES').text.length, 2);
  });
  t('search: meerdere woorden moeten allemaal voorkomen (klant of product)', function () {
    eq(L.search(ROWS, 'zusto uk').text.map(function (x) { return x.product; }), ['Zusto UK']);
    eq(L.search(ROWS, 'zusto gourmet').text.length, 1);
    eq(L.search(ROWS, 'zusto xyz').text.length, 0);
  });
  t('search: palletnummer geeft alle regels van die pallet', function () {
    var r = L.search(ROWS, '1155');
    eq(r.pallet.length, 2);
    eq(r.pallet.map(function (x) { return x.klant; }), ['?', 'Cofeo']);
  });
  t('search: 585 en 0585 vinden dezelfde pallet', function () {
    eq(L.search(ROWS, '585').pallet.length, 1); eq(L.search(ROWS, '0585').pallet.length, 1);
  });
  t('search: randgeval 2500 = pallet 2500 én de naam met 2500 erin', function () {
    var r = L.search(ROWS, '2500');
    eq(r.pallet.map(function (x) { return x.product; }), ['Stickpack 2500 bio']);
    eq(r.text.map(function (x) { return x.product; }), ['Stickpack 2500 bio']);
  });
  t('search: cijfers zonder pallet geven wel naamtreffers', function () {
    var r = L.search(ROWS, '250');
    eq(r.pallet.length, 0);
    eq(r.text.map(function (x) { return x.product; }), ['DS BIO koffie 250g', 'Stickpack 2500 bio']);
  });
  t('search: gescande SSCC geeft alleen de pallet, geen naamtreffers', function () {
    var r = L.search(ROWS, '154199802502011550');
    eq(r.q.kind, 'sscc'); eq(r.pallet.length, 2); eq(r.text.length, 0);
  });
  t('search: onbekende pallet geeft niets', function () { eq(L.search(ROWS, '9999').pallet.length, 0); });
  t('search: pallet 0 bestaat niet (externe stock zonder pallet)', function () { eq(L.search(ROWS, '0').pallet.length, 0); });

  /* ---------- sorteren en groeperen ---------- */
  t('sorteren: rekplaatsen eerst, dan vaste bestemmingen, dan Geen locatie', function () {
    var r = L.search(ROWS, 'o'); // bijna alles
    var ranks = r.text.map(function (x) { return L.locRank(x.locatie); });
    for (var i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) throw new Error('volgorde fout: ' + JSON.stringify(ranks));
    eq(L.locRank('A03'), 0); eq(L.locRank('Gang 1'), 1); eq(L.locRank('Uitgenomen'), 1); eq(L.locRank('Geen locatie'), 2); eq(L.locRank(''), 2);
  });
  t('groeperen: Cofeo en cofeo zijn één klant, ? achteraan', function () {
    var g = L.groupByKlant(L.search(ROWS, 'o').text);
    var names = g.map(function (x) { return x.klant; });
    eq(names.filter(function (n) { return L.fold(n) === 'cofeo'; }).length, 1);
    eq(names[names.length - 1], '?');
    var cofeo = g.filter(function (x) { return x.key === 'cofeo'; })[0];
    eq(cofeo.rows.length, 2);
  });

  /* ---------- hoeveelheid ---------- */
  t('qtyText: meters en stuks', function () {
    eq(L.qtyText(ROWS[0]), '7.160 m · 47.733 st');
    eq(L.qtyText(ROWS.filter(function (r) { return r.klant === 'Bio Minerals'; })[0]), '–');
    eq(L.qtyText(ROWS.filter(function (r) { return r.klant === 'Akina'; })[0]), '10 m');
  });

  /* ---------- versheid ---------- */
  t('isStale', function () {
    eq(L.isStale(0, 1000, 10), true);
    eq(L.isStale(1000, 1700, 600), true);
    eq(L.isStale(1000, 1500, 600), false);
  });

  var failed = results.filter(function (r) { return !r.ok; });
  if (typeof module === 'object' && module.exports) {
    results.forEach(function (r) { console.log((r.ok ? 'OK   ' : 'FOUT ') + r.name + (r.ok ? '' : '\n      ' + r.error)); });
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' tests geslaagd');
    process.exit(failed.length ? 1 : 0);
  } else {
    root.ZoekTests = results;
  }
})(typeof self !== 'undefined' ? self : this);
