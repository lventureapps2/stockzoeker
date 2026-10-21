/*
 * Stockzoeker – zoeklogica.
 * Alleen zuivere functies, zonder scherm of netwerk, zodat de tests exact de
 * code testen die op het toestel draait. Werkt in de browser (window.ZoekLogic)
 * en in Node.js (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ZoekLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------
     Tekst vergelijkbaar maken: kleine letters, accenten weg ("Délices" =
     "delices"), dubbele spaties weg.
     ------------------------------------------------------------------ */
  function fold(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.toLowerCase().replace(/[´`’]/g, "'").replace(/\s+/g, ' ').trim();
  }

  /* ------------------------------------------------------------------
     Palletnummer. In de Sheet staat het zonder voorloopnullen (585), op het
     palletlabel en in Palletscan met vier cijfers (0585). Vergelijken gebeurt
     daarom op het getal.
     ------------------------------------------------------------------ */
  function palNumber(v) {
    var s = String(v == null ? '' : v).trim();
    if (!/^[0-9]{1,6}$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n > 0 ? n : null;        // 0 of leeg = geen pallet (bv. externe stock)
  }
  function padPal(n) {
    if (n == null) return '';
    var s = String(n);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  /* ------------------------------------------------------------------
     Wat heeft de gebruiker getypt of gescand?
       empty  : niets
       sscc   : een SSCC van 18 cijfers (gescand palletlabel) -> palletnummer
                uit de cijfers 14 tot 17, zoals in Palletscan
       digits : 1 tot 4 cijfers -> palletnummer, én als tekst zoeken
       text   : vrije tekst -> elk woord moet voorkomen in klant of product
     ------------------------------------------------------------------ */
  function classify(raw, opts) {
    opts = opts || {};
    var from = Math.max(1, opts.shortCodeFrom | 0 || 14), len = Math.max(1, opts.shortCodeLen | 0 || 4);
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!s) return { kind: 'empty', terms: [] };

    var code = s.replace(/^\]C1/i, '').replace(/^\(00\)/, '').replace(/\s/g, '');
    if (/^(00)?[0-9]{18}$/.test(code)) {
      var sscc = code.slice(-18);
      return { kind: 'sscc', sscc: sscc, pal: parseInt(sscc.slice(from - 1, from - 1 + len), 10), terms: [] };
    }
    if (/^[0-9]{1,4}$/.test(s)) return { kind: 'digits', pal: parseInt(s, 10), terms: [s] };
    return { kind: 'text', terms: fold(s).split(' ').filter(Boolean) };
  }

  /* ------------------------------------------------------------------
     Rijen uit de Sheet klaarmaken voor het zoeken.
     Invoer: [klant, product, palnr, meters, stuks, datum, locatie] per rij.
     ------------------------------------------------------------------ */
  function prepare(rows) {
    var out = [];
    (rows || []).forEach(function (r, i) {
      if (!Array.isArray(r)) return;
      var klant = clean(r[0]), product = clean(r[1]);
      if (!klant && !product && !clean(r[2])) return;
      out.push({
        i: i,
        klant: klant || '?',
        product: product,
        pal: palNumber(r[2]),
        meters: cleanQty(r[3]),
        stuks: cleanQty(r[4]),
        datum: clean(r[5]),
        locatie: cleanLoc(r[6]),
        _s: fold(klant + ' ' + product)
      });
    });
    return out;
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function cleanQty(v) {
    var s = clean(v);
    if (!s || /^#/.test(s) || s === '-' || s === '0') return '';   // #N/A, #REF!, leeg
    return s;
  }
  function cleanLoc(v) {
    var s = clean(v);
    return s ? s : 'Geen locatie';
  }

  function matchText(row, terms) {
    for (var i = 0; i < terms.length; i++) if (row._s.indexOf(terms[i]) < 0) return false;
    return true;
  }

  /* ------------------------------------------------------------------
     Zoeken. Geeft terug:
       { q, pallet: [rijen van die pallet], text: [rijen op naam] }
     Bij cijfers komen beide: eerst de pallet, daaronder de naamtreffers.
     ------------------------------------------------------------------ */
  function search(rows, raw, opts) {
    var q = classify(raw, opts);
    var res = { q: q, pallet: [], text: [] };
    if (q.kind === 'empty') return res;
    if (q.kind === 'sscc' || q.kind === 'digits') {
      res.pallet = rows.filter(function (r) { return r.pal === q.pal; }).sort(compareRows);
    }
    if (q.kind === 'text' || q.kind === 'digits') {
      res.text = rows.filter(function (r) { return matchText(r, q.terms); }).sort(compareRows);
    }
    return res;
  }

  /* ------------------------------------------------------------------
     Sorteren: eerst de rekplaatsen (A03 … D94) alfabetisch, dan de vaste
     bestemmingen (Gang 1, TEE, Uitgenomen …), dan "Geen locatie". Binnen
     dezelfde plaats op klant en product.
     ------------------------------------------------------------------ */
  function locRank(loc) {
    var l = fold(loc);
    if (!l || l === 'geen locatie') return 2;
    if (/^[a-z][0-9]{2}$/.test(l)) return 0;
    return 1;
  }
  function compareRows(a, b) {
    var ra = locRank(a.locatie), rb = locRank(b.locatie);
    if (ra !== rb) return ra - rb;
    var la = fold(a.locatie), lb = fold(b.locatie);
    if (la !== lb) return la < lb ? -1 : 1;
    var ka = fold(a.klant), kb = fold(b.klant);
    if (ka !== kb) return ka < kb ? -1 : 1;
    var pa = fold(a.product), pb = fold(b.product);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.i - b.i;
  }

  /* ------------------------------------------------------------------
     Groeperen per klant. "Cofeo" en "cofeo" zijn dezelfde klant; de eerste
     schrijfwijze wordt getoond. "?" (klant onbekend) komt achteraan.
     ------------------------------------------------------------------ */
  function groupByKlant(rows) {
    var map = Object.create(null), groups = [];
    rows.forEach(function (r) {
      var k = fold(r.klant);
      if (!map[k]) { map[k] = { key: k, klant: r.klant, rows: [] }; groups.push(map[k]); }
      map[k].rows.push(r);
    });
    groups.sort(function (a, b) {
      if ((a.key === '?') !== (b.key === '?')) return a.key === '?' ? 1 : -1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
    groups.forEach(function (g) { g.rows.sort(compareRows); });
    return groups;
  }

  /* Hoeveelheid als één tekst: "7.160 m · 47.733 st", of "–" als niets gekend is. */
  function qtyText(row) {
    var parts = [];
    if (row.meters) parts.push(/m$/i.test(row.meters) ? row.meters : row.meters + ' m');
    if (row.stuks) parts.push(row.stuks + ' st');
    return parts.length ? parts.join(' · ') : '–';
  }

  /* Zijn de gegevens oud? */
  function isStale(fetchedAt, now, staleMs) {
    if (!fetchedAt) return true;
    return (now - fetchedAt) > staleMs;
  }

  return {
    fold: fold, palNumber: palNumber, padPal: padPal, classify: classify,
    prepare: prepare, search: search, compareRows: compareRows, locRank: locRank,
    groupByKlant: groupByKlant, qtyText: qtyText, isStale: isStale
  };
});
