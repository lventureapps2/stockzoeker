# Stockzoeker

Aparte opzoek-webapp voor het magazijn, naast Palletscan. De magazijnier typt een klant, een product of een palletcode (of scant een palletlabel) en ziet meteen welke pallets er zijn, wat erop ligt, hoeveel, en op welke plaats.

De app **leest alleen**. Ze schrijft nooit iets in een Sheet en deelt geen code, sleutel, adres of opslag met Palletscan. Beide apps staan los van elkaar op hetzelfde toestel.

## Hoe het werkt

1. De stock-Sheet (tabblad **Stock nazicht_Nieuw**, kolommen V tot AC) is de bron. Daarin staat per pallet en per product één regel: klant, product, palletnummer, meters, stuks, datum van opmeting en locatie. De locatie komt daar al uit de scans van Palletscan.
2. Een eigen Apps Script in die Sheet geeft die regels als één lijst terug aan de app, beveiligd met een eigen leessleutel.
3. De app haalt de hele lijst op en **bewaart ze op het toestel**. Zoeken gebeurt daarna lokaal, dus ook zonder wifi en zonder wachten.
4. De lijst wordt ververst bij het openen van de app, daarna elke 10 minuten (instelbaar), met **F1** of de knop **Ververs**, en vanzelf zodra er weer verbinding is als een poging mislukte.
5. Rechtsboven staat altijd het tijdstip van de gegevens: groen als ze jonger zijn dan een uur, oranje als ze ouder zijn, rood als er nog niets op het toestel staat.

## Zoeken

Eén zoekveld. Wat je typt bepaalt wat er gebeurt:

| Invoer | Wat de app doet |
|---|---|
| **1 tot 4 cijfers** (`585`, `0585`, `1155`) | Palletcode. Toont de pallet met haar plaats groot, en daaronder alles wat erop ligt. Voorloopnullen tellen niet: `585` en `0585` zijn dezelfde pallet. Daaronder, onder **Ook in namen**, de klanten en producten waar die cijfers in voorkomen (bv. `410` → pallet 0410 én "FO WIT 410"). |
| **Gescand palletlabel** (SSCC, 18 cijfers) | Haalt de palletcode uit de cijfers 14 tot 17, zoals Palletscan, en toont die pallet. Geen naamtreffers. |
| **Al de rest** (`bio`, `zusto uk`, `délices`) | Vrije tekst. Hoofdletters en accenten tellen niet mee. Elk woord moet ergens voorkomen in de klantnaam of de productnaam: `zusto uk` vindt "Zusto UK" maar niet "Zusto USA". De treffers staan per klant, gesorteerd op plaats; wat gevonden is, is geel gemarkeerd. Vanaf 2 tekens. |

De plaats staat links in een vakje: geel voor een rekplaats (`A03`), wit voor een vaste bestemming of magazijn (`Uitgenomen`, `TEE`, `Gang 1`), grijs voor **Geen locatie**. Een pallet met status Nieuw draagt het label **NIEUW**. Binnen een klant staan de rekplaatsen eerst, dan de vaste bestemmingen, dan de pallets zonder locatie.

Toetsen: **F1** = Ververs, **F8** = Wis het zoekveld. Druk geen Esc: op de Keyence sluit Esc de app. De knoppen onderaan doen hetzelfde als de toetsen.

## Bestanden

| Bestand | Waarvoor | Waar komt het |
|---|---|---|
| `index.html` | De app. Het configuratieblok staat bovenaan. | GitHub Pages, repository `stockzoeker` |
| `zoeklogic.js` | Zoeken, sorteren, groeperen. Staat apart zodat de tests exact deze code testen. | GitHub Pages, repository `stockzoeker` |
| `sw.js` | Bewaart de app op het toestel, zodat ze ook zonder wifi start. | GitHub Pages, repository `stockzoeker` |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | Nodig om de app op het startscherm te zetten. | GitHub Pages, repository `stockzoeker` |
| `apps-script/Code.gs` | Leest de stocklijst uit de Sheet. | In de **stock-Sheet** (Apps Script) |
| `tests/` | Geautomatiseerde tests. | Optioneel |

## Installeren

### Stap 1: het Apps Script in de stock-Sheet

Dit is een **tweede** script, in de stock-Sheet (die met het tabblad Stock nazicht_Nieuw), niet in de Sheet van Palletscan. Laat `Code.gs` van Palletscan ongemoeid.

1. Open de stock-Sheet en kies **Extensies > Apps Script**.
2. Staat daar al code van iets anders, maak dan een nieuw bestand (**+ > Script**, noem het `Stockzoeker`) en plak daar de inhoud van `apps-script/Code.gs` in. Staat er alleen de lege voorbeeldcode, vervang die dan. Let op: een project kan maar één `doPost` hebben. Staat er al een `doPost` in deze Sheet, zeg het dan; dan moet het anders.
3. Vervang bovenaan `READ_KEY` door een eigen sleutel van minstens 16 tekens. Neem een **andere** sleutel dan die van Palletscan: wie deze sleutel heeft, kan de hele stocklijst lezen, maar niets schrijven. Wil je hem op de Keyence kunnen inscannen, druk hem dan af als barcode (Code 128).
4. Klik op **Opslaan**. Kies bovenaan de functie `eersteKeerInstellen` en klik op **Uitvoeren**. Google vraagt toestemming: kies je account, klik op **Geavanceerd** en ga verder. Het script vraagt alleen toegang tot deze ene Sheet.
5. Kijk onderaan in het logvenster: er moet staan **In orde: … regels gelezen**. Staat er **Kopje(s) niet gevonden**, dan heet een kolom in rij 1 anders dan in `HEADERS` in `Code.gs`; pas dat aan.
6. Klik op **Implementeren > Nieuwe implementatie**. Type **Web-app**, uitvoeren als **Ik**, toegang **Iedereen**. Klik op **Implementeren** en kopieer de **URL van de web-app** (eindigt op `/exec`).
7. Open die URL in een browser. Je moet zien: `Stockzoeker: het script is actief.` De stock zelf is via de browser niet te zien; daar is de sleutel voor nodig.

Pas je `Code.gs` later aan, kies dan **Implementeren > Implementaties beheren > potlood > Versie: Nieuwe versie > Implementeren**. Zo blijft de URL dezelfde.

### Stap 2: publiceren op GitHub Pages

Elke app krijgt een eigen repository onder hetzelfde account, zoals Palletscan en QC Rondgang (`lventureapps/qcrondgang`). Stockzoeker wordt `lventureapps/stockzoeker`, adres `https://lventureapps.github.io/stockzoeker/`.

1. Maak op github.com een nieuwe repository `stockzoeker`, zichtbaarheid **Public**.
2. Kies **uploading an existing file** en sleep de **inhoud** van de map `stockzoeker` erin: `index.html`, `zoeklogic.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, en desgewenst de map `tests`. De bestanden komen dus in de root van de repository, niet in een submap.
3. Klik op **Commit changes**.
4. Ga naar **Settings > Pages**. Bij Source **Deploy from a branch**, branch **main**, map **/ (root)**, **Save**.
5. Na ongeveer een minuut staat de app op `https://lventureapps.github.io/stockzoeker/`. Je moet het zwarte ZOEK-scherm zien.

Het kan ook als map `stockzoeker/` in de Palletscan-repository (adres `…/palletscan/stockzoeker/`); de app werkt op beide manieren. Zet de bestanden nooit los in de hoofdmap van een andere app: dan overschrijf je haar `index.html` en `sw.js`.

Alle repositories onder `lventureapps.github.io` delen op het toestel dezelfde browseropslag. Daarom gebruikt Stockzoeker eigen namen voor alles wat ze bewaart (`stockzoeker.settings`, `stockzoeker.data`, cache `stockzoeker-v1`) en ruimt haar service worker alleen caches op die met `stockzoeker-` beginnen. Een nieuwe app op hetzelfde adres moet dat ook doen.

Laat `READ_KEY` en `ENDPOINT_URL` in `index.html` leeg zolang de repository publiek is; vul ze per toestel in (stap 3). Zet `Code.gs` met je echte sleutel niet in de repository.

### Stap 3: elk toestel instellen

1. Open het adres van de app in Chrome op het toestel.
2. Tik op het tandwiel (⚙) rechtsonder.
3. Vul de **leessleutel** uit stap 1 in, en het **adres** van het Stockzoeker-script (niet dat van Palletscan).
4. Tik op **Test verbinding**: "Verbinding in orde". Tik daarna op **Nu ophalen**: "… regels opgehaald".
5. Tik op **Sluiten**. Rechtsboven staat nu het tijdstip in het groen.

### Stap 4: op het startscherm zetten

Zoals bij Palletscan: open de app in Chrome met wifi, tik op **⋮ > Toevoegen aan startscherm** en bevestig. Start ze voortaan via het pictogram **Stockzoeker**. Controle: zet het toestel in vliegtuigmodus en start de app; ze moet openen en zoeken moet werken.

De app wordt pas bij het eerste bezoek op het toestel bewaard. Open ze dus minstens één keer met wifi, en haal één keer de gegevens op.

## Scannerinstellingen

Dezelfde als voor Palletscan (Transmission type = KeyEvent, Terminator = Enter). Er is niets extra nodig. Een gescand palletlabel komt binnen als 18 cijfers en Enter, en de app herkent dat vanzelf.

## De Sheet

Het script leest het tabblad **Stock nazicht_Nieuw**. In rij 1 zoekt het deze kopjes, **vanaf kolom V** tenzij anders vermeld:

| Kopje in de Sheet | In de app |
|---|---|
| `KLANT` | klant |
| `PRODUCT NAME` | product |
| `Pal NR` | palletcode (zonder voorloopnullen in de Sheet, met vier cijfers op het scherm) |
| `Meters op pallet` | aantal in meter |
| `Aantal stuks op pallet` | aantal in stuks |
| `Datum opmeting` | "opgemeten …" |
| `Locatie` | plaats |
| `Magazijn` | staat hier `TEE`, dan toont de app **TEE** als plaats in plaats van de rekplaats (instelbaar: `MAGAZIJN_AS_LOCATION` in `index.html`) |
| `Status` (kolom C, gezocht vanaf kolom A) | staat hier `Nieuw`, dan krijgt de regel het label **NIEUW**, en is de pallet vindbaar met het woord `nieuw` |

De kolommen worden op hun **kopje** gevonden, niet op hun letter. Een kolom tussenvoegen of verplaatsen breekt dus niets; een kopje hernoemen wel (pas dan `HEADERS` in `Code.gs` aan). `KLANT`, `PRODUCT NAME` en `Pal NR` staan ook in de kolommen A tot D; die worden overgeslagen omdat het zoeken pas vanaf kolom V begint (`FIRST_COL`). Alleen `Status` wordt vanaf kolom A gezocht, omdat dat kopje enkel in kolom C staat. Kolommen A–D en V–AC beschrijven op elke rij dezelfde pallet (nagekeken op de volledige lijst: klant en Pal NR zijn per rij gelijk), dus Status hoort bij de juiste pallet.

Het script stuurt de **weergavewaarden** door: wat jij in de Sheet ziet ("7.160 m", "29-8-2026"), niet de ruwe getallen. `#N/A` en lege cellen worden op het scherm "–". Een lege locatie wordt "Geen locatie". Regels waar klant, product en palletnummer alle drie leeg zijn, worden overgeslagen.

Een pallet verdwijnt uit de app zodra haar regels uit de Sheet verdwijnen. Zolang ze erin staat, wordt ze getoond, ook met locatie "Uitgenomen". Regels zonder palletnummer (bv. externe stock, Pal NR leeg of 0) zijn wel vindbaar op naam, maar niet op palletcode.

## Aannames

1. **Pal NR is de palletcode.** De waarde in de Sheet (585) is hetzelfde nummer als de vier cijfers op het palletlabel en in Palletscan (0585). Vergelijken gebeurt op het getal.
2. **Meerdere regels per pallet** zijn normaal (meerdere producten op één pallet). De pallet-weergave toont ze allemaal.
3. **Dezelfde klant met een andere schrijfwijze** ("Cofeo" en "cofeo") is één klant in de app; de eerste schrijfwijze wordt getoond.
4. **Klant "?"** wordt getoond als "klant onbekend" en staat achteraan.
5. **De gegevens op het toestel zijn een kopie.** Hoe oud die is, staat rechtsboven. Na een stocktelling of een scan is het scherm pas juist na een verversing (vanzelf, of met F1).
6. **Gegevens staan op elk toestel.** Elk toestel met de leessleutel heeft de volledige stocklijst (alle klanten) in zijn opslag. Daarom staan alleen de kolommen hierboven in de lijst, geen prijzen of andere gegevens uit de Sheet. Wil je dat ooit beperken, dan is `ORDER` in `Code.gs` de plek.
7. **Toegang**: de web-app staat op "Iedereen" en is beveiligd met de leessleutel. Wie de sleutel kent kan de stocklijst lezen, niets schrijven. Een geweigerde sleutel stopt het automatisch verversen tot de instellingen aangepast zijn.
8. **Geen 4G nodig.** De app zoekt lokaal; verbinding is alleen nodig om te verversen.
9. **Meer dan 300 treffers** worden afgekapt met de melding "Typ meer letters".
11. **Magazijn als plaats**: alleen `TEE` (instelbaar). Voor `SSCC Extern` en `V-Depot` blijft de kolom Locatie gelden, meestal "Geen locatie". Wil je die ook als plaats tonen, voeg ze toe aan `MAGAZIJN_AS_LOCATION`.
12. **Het woord `nieuw`** in een zoekopdracht vindt ook de pallets met status Nieuw, naast klanten of producten met "nieuw" in de naam.
10. **Opslag**: de lijst staat in de browseropslag van Chrome (localStorage). Browsegegevens wissen haalt ze weg; de app haalt ze bij de volgende verbinding gewoon opnieuw op. Er gaat niets verloren, want de app schrijft niets.

## De app aanpassen

1. Pas `index.html` aan en verhoog `APP_VERSION` in het configuratieblok.
2. Upload het bestand opnieuw naar de repository `stockzoeker`.
3. Op elk toestel: open de app met wifi, wacht tien seconden, sluit ze en open ze opnieuw. De nieuwe versie is actief vanaf de tweede start. Het versienummer staat linksonder.

## Tests

Met Node.js:

```
node tests/run.js              # zoeklogica (32 tests)
node tests/run-appsscript.js   # Code.gs tegen een nagebootste Sheet (16 tests)
```

Zonder Node.js: upload de map `tests` mee en open `https://lventureapps.github.io/stockzoeker/tests/`; die pagina draait de tests van `run.js` in de browser.

Daarnaast is de app getest in een geautomatiseerde browser (Chromium, 480 × 800 zoals de BT-A600) met de echte stocklijst van 823 regels: instellen, ophalen, zoeken op naam, meerdere woorden, palletcode met en zonder voorloopnul, een gescande SSCC, het randgeval met cijfers in een naam, offline herladen en zoeken, vanzelf verversen zodra de verbinding terug is, en een geweigerde sleutel. Niet getest, omdat het alleen ter plaatse kan: het echte Apps Script in de echte Sheet, en de Keyence zelf.

## Wijzigingen

### Versie 1.1.0

- Staat een pallet in magazijn **TEE** (kolom Magazijn), dan toont de app TEE als plaats in plaats van de rekplaats. Instelbaar met `MAGAZIJN_AS_LOCATION`.
- Pallets met **status Nieuw** (kolom C) krijgen het label NIEUW bij hun eigenschappen en zijn vindbaar met het woord `nieuw`.
- `Code.gs` stuurt nu ook de kolommen Magazijn en Status door. **Code.gs opnieuw implementeren** (Implementaties beheren > Nieuwe versie); een oude app met een nieuw script werkt, een nieuwe app met een oud script toont geen TEE en geen NIEUW.

### Versie 1.0.1

- De stand van de ⌨-knop (schermtoetsenbord aan of uit) wordt per toestel onthouden. Op een smartphone zet je hem één keer aan.

### Versie 1.0.0

Eerste versie.
