# carshareOrNot
Vergleiche die jährlichen Kosten eines eigenen Gebrauchtwagens mit denen von Carsharing-Tarifen – auf Basis deiner tatsächlichen Fahrgewohnheiten

## Teilen

Der Button „Teilen“ öffnet auf unterstützten Geräten das native Teilen-Menü. Andernfalls wird der Link in die Zwischenablage kopiert oder zum manuellen Kopieren angezeigt.

Der Link enthält den vollständigen Rechnerzustand, einschließlich der eingegebenen Adresse, Standortwerte und angepassten Tarife. Unveränderte Standardtarife werden dabei nicht mitgesendet; der Empfänger ergänzt sie aus der Anwendung. Die Daten stehen komprimiert im URL-Hash und werden deshalb beim Aufruf nicht als Teil der HTTP-Anfrage an den Webserver übertragen. Jeder Empfänger des Links kann die enthaltenen Einstellungen laden und lesen. Unterstützt wird nur das aktuelle Linkformat.

„Ergebnisgrafik“ erzeugt eine 1200 × 630 Pixel große PNG-Zusammenfassung. Auf Geräten mit Datei-Teilen wird sie über das native Teilen-Menü angeboten, andernfalls als Datei heruntergeladen.

## Lokal starten

Der lokale Webserver wird in PowerShell aus dem Projektverzeichnis gestartet:

```powershell
.\start-server.ps1
```

Die Anwendung ist anschließend unter `http://localhost:5001/` erreichbar. Mit `-Port 8080` kann bei Bedarf ein anderer Port gewählt werden; beendet wird der Server mit `Strg+C`.

## Standortsuche mit OpenStreetMap

Die Suche läuft nur nach Klick auf „Stationen suchen“ für stationsbasierte Anbieter. Sie verwendet zwei öffentliche OpenStreetMap-Dienste direkt aus dem Browser:

1. Nominatim erhält die eingegebene Adresse und liefert genau einen Treffer (`format=json`, `limit=1`):

   ```text
   GET https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<URL-codierte Adresse>
   ```

2. Overpass erhält nur die Koordinaten dieses Treffers. Die Anwendung fragt alle als Carsharing markierten Knoten im Radius von 1.500 Metern ab:

   ```text
   POST https://overpass-api.de/api/interpreter
   Content-Type: text/plain;charset=UTF-8

   data=%5Bout%3Ajson%5D%5Btimeout%3A15%5D%3Bnode%28around%3A1500%2C<LAT>%2C<LON>%29%5B%22amenity%22%3D%22car_sharing%22%5D%3Bout%20body%3B
   ```

   Dekodiert lautet die Overpass-Abfrage:

   ```overpass
   [out:json][timeout:15];
   node(around:1500,<LAT>,<LON>)["amenity"="car_sharing"];
   out body;
   ```

Die Anbieterkennung wird nicht an Overpass übermittelt. Die Anwendung vergleicht `operator`, `brand`, `network` und `name` erst lokal mit dem gewählten Anbieter. Für Free-Floating-Angebote findet keine OSM-Abfrage statt. Beide Netzwerkaufrufe werden nach 8 beziehungsweise 12 Sekunden abgebrochen; die Standortdaten bleiben bei Fehlern unverändert.

Für einen manuellen Test der Overpass-Abfrage am Reichenspergerplatz in Köln kann in PowerShell folgender Aufruf verwendet werden:

```powershell
curl.exe --get `
  --data-urlencode 'data=[out:json][timeout:15];node(around:1500,50.9542,6.9630)["amenity"="car_sharing"];out body;' `
  -H 'Referer: http://localhost:5001/' `
  -H 'Accept: application/json' `
  'https://overpass-api.de/api/interpreter'
```

`overpass-api.de` verlangt für Browser-Anfragen einen Referer. Die Anwendung erhält ihn automatisch, wenn sie über den lokalen Server läuft. Wird die GET-URL dagegen direkt in die Browser-Adresszeile eingefügt oder die Anwendung über `file://` geöffnet, kann der Dienst mit `406 Not Acceptable` antworten.

## Projektstruktur

- `index.html` enthält die semantische Seitenstruktur und wiederverwendbare Templates.
- `styles.css` enthält Layout, Komponentenstile und responsive Regeln.
- `data/providers/*.json` enthält je Anbieter eine pflegbare Tarifdatei im Exportformat der Anwendung.
- `provider-data.generated.js` wird mit `npm run build:providers` aus diesen JSON-Dateien erzeugt und vom Browser geladen.
- `providers.js` enthält Standardwerte, Tarifarten sowie die Konvertierung und Migration der Anbieterdaten.
- `calculator.js` enthält die zustandslose Kostenberechnung.
- `app.js` enthält Zustand, Speicherung, Stationssuche und Rendering.
- `start-server.ps1` stellt die Webdateien ausschließlich auf der lokalen Loopback-Adresse bereit.
- `icons/icon.svg` und `icons/maskable-icon.svg` enthalten die normalen und maskierbaren App-Icons.
- `icons/carshare-or-not-og.svg` ist die bearbeitbare Quelle für das Open-Graph-Bild.
- `scripts/build-og-images.js` erzeugt aus dem OG-SVG die veröffentlichbaren PNG- und JPEG-Dateien.
- `tests/calculation.test.js` prüft Rechenmodelle, Grenzfälle und geteilte Zustände.

Mit `npm run check` werden die automatisierten Prüfungen ausgeführt.

Nach einer Änderung am OG-SVG werden die Bilddateien reproduzierbar neu erzeugt:

```powershell
npm run build:og-image
```

## Anbieter und Tarife pflegen

Kennungen verwenden 1–64 Zeichen, beginnen mit einem Kleinbuchstaben und enthalten nur Kleinbuchstaben, Ziffern, Bindestriche oder Unterstriche. Anbieterkennungen sind global eindeutig, Klassenkennungen je Anbieter und Tarifkennungen je Klasse. JavaScript-Prototypnamen sowie interne Anbieterkennungen (`manual`, `recommend-single`, `recommend-mix` und das Präfix `supplement-`) sind reserviert. Build, JSON-Import und Teilen-Links prüfen diese Regeln gemeinsam in `identifier-validation.js`. Ein Import mit bereits vorhandener Anbieterkennung aktualisiert diesen Anbieter nach ausdrücklichem Hinweis in der Importbestätigung.

Jeder mitgelieferte Anbieter besitzt eine eigene Quelldatei unter `data/providers`. Um einen neuen Anbieter aufzunehmen:

1. Eine vorhandene JSON-Datei kopieren und passend benennen, zum Beispiel `book-n-drive.json`.
2. Eine eindeutige `id`, den sichtbaren `name`, die Betriebsart und die Quellenangaben eintragen.
3. Unter `classes` die angebotenen Fahrzeugklassen und deren Tarife pflegen.
4. `npm run build:providers` ausführen, damit `provider-data.generated.js` neu erzeugt wird.
5. `npm run check` ausführen. Die Prüfung schlägt auch fehl, wenn die erzeugte Browserdatei nicht zu den JSON-Quellen passt.

Als `operationMode` sind `station-based` für stationsgebundene Angebote und `free-floating` für Free-Floating-Angebote zulässig. Neue JSON-Dateien werden beim Build automatisch erkannt und hinter den bekannten Anbietern einsortiert. Sie erscheinen anschließend in der Auswahl, im Tarifeditor und in den Empfehlungen. Bei Nutzern mit einem älteren lokalen Speicherstand ergänzt die Anwendung den neuen Standardanbieter beim nächsten Laden automatisch.

Ein neuer Anbieter kann alternativ im Tarifeditor über „Weiteren Anbieter hinzufügen“ angelegt werden. Dort lassen sich Betriebsart, Fahrzeugklassen und Tarife hinzufügen, umbenennen und entfernen. „JSON exportieren“ speichert einen Anbieter im selben versionierten Format wie die Dateien unter `data/providers`. „Anbieter-JSON importieren“ zeigt vor dem Einlesen eine Zusammenfassung und ersetzt nach Bestätigung einen vorhandenen Anbieter mit derselben Kennung oder fügt einen neuen hinzu. Importdateien dürfen höchstens 128 KB enthalten. Insgesamt sind höchstens 20 Anbieter und pro Anbieter 20 Fahrzeugklassen mit je 20 Tarifen zulässig; Namen und Quellenangaben haben feste Textgrenzen.

Teilen-Links dürfen maximal 16.384 Zeichen und 12 KB codierte Daten enthalten. Beim Entpacken werden höchstens 96 KB verarbeitet. Damit bleiben Links in gängigen Browsern handhabbar und komprimierte Daten mit unverhältnismäßig großem Inhalt werden abgewiesen. Nur das aktuelle Linkformat wird unterstützt.

`provider-data.generated.js` ist eine erzeugte Datei und wird nicht von Hand bearbeitet.

## Rechenmodell und Daten

- Zahlenfelder sperren Minuszeichen beim Tippen, Einfügen und Ablegen von Text. Vor Berechnung und Speicherung werden die Werte zusätzlich gegen die Feldgrenzen geprüft. Anbieter-JSON mit negativen Preisen oder Gebühren wird vollständig abgewiesen; auch Teilen-Links mit negativen Zahlen werden nicht übernommen. Freitextfelder dürfen weiterhin Bindestriche enthalten.
- Alltagsszenarien füllen ausschließlich die Nutzungsangaben mit plausiblen Startwerten. Neben Familien-, Pendel- und Pflegeprofilen stehen Vorlagen für Wochenendbeziehungen, urbane Paare, Ruhestand, Wenigfahrer sowie Freizeitfahrten bereit. Fahrzeugkosten, Anbieter, Standort und Tarifänderungen bleiben erhalten; die unmittelbar vorherigen Nutzungswerte lassen sich wiederherstellen.
- Für Alltagswege lässt sich unterscheiden, ob ein Fahrzeug während Hin- und Rückweg gebucht bleibt, für die Rückfahrt neu gebucht wird oder eine Einwegfahrt möglich ist. Getrennte Rückfahrten verdoppeln die Zahl der Buchungen, ohne die gesamte Nutzungszeit zu verdoppeln.
- Die Anbieterauswahl bietet zwei automatische Modi. „Empfehlung – ein Anbieter“ vergleicht alle passenden Tarife und zeigt die drei günstigsten. „Empfehlung – Mobilitätsmix“ darf jeder Fahrtart einen anderen Tarif zuordnen und berechnet Grund- sowie anteilige Anmeldegebühren für jeden tatsächlich genutzten Tarif genau einmal.
- Der Mobilitätsmix bezieht außerdem transparente Rechenannahmen für Taxi/Ridehailing, Mietwagen und ÖPNV ein. Verwendet werden 4 € je Taxibuchung plus 2,20 €/km, 55 € je Mietwagentag plus 0,18 €/km und 58 € je Monat für ÖPNV. Das sind keine live abgefragten Angebote; regionale Preise und die praktische Verfügbarkeit müssen separat geprüft werden.
- Unter dem Ergebnis erscheinen eine Kostenspanne, eine näherungsweise Break-even-Jahresfahrleistung und eine Erklärung der Empfehlung. Die Spanne variiert bei den Autokosten Wartung um 25 Prozent und Kraftstoff um 10 Prozent sowie bei der Alternative die Gesamtkosten um 10 Prozent. Der Break-even wird im Bereich von 0 bis 50.000 km gesucht.
- Anbieter mit bestätigten null Stationen werden aus Empfehlungen ausgeschlossen. Solange für vorgeschlagene Anbieter keine bestätigten Stations- und Gehzeitwerte vorliegen, kennzeichnet die Oberfläche das Ergebnis ausdrücklich als rein rechnerische Empfehlung.
- Stationsbasierte Anbieter verwenden Stationszahl und Gehzeit. Bei Free-Floating-Angeboten wie Miles und Free2move wird stattdessen erfasst, ob der Standort in einem Geschäftsgebiet liegt; verfügbare Fahrzeuge müssen direkt in der Anbieter-App geprüft werden. Bei der Rückgabe bleibt dort die Suche nach einem legalen öffentlichen Stellplatz Teil der Nutzung.
- Die Free-Floating-Praxistauglichkeit kann automatisch oder manuell bewertet werden. Automatisch gelten Kindersitz oder regelmäßige Bring-/Abholfahrten als deutlicher Nachteil. Für die Empfehlungsreihenfolge werden Free-Floating-Kosten bei „nur als Ergänzung“ mit dem Faktor 1,25 und bei „eher ungeeignet“ mit 1,75 gewichtet. Dieser Rangwert wird nicht als Preis ausgegeben und verändert keine berechneten Kosten.
- Standortwerte sind zunächst unbekannt. Eine Verfügbarkeitsbewertung erscheint erst nach manueller Eingabe oder erfolgreicher Anbietersuche.
- Regelmäßige Bring- und Abholfahrten werden aus Tagen, aktiven Wochen, Strecke, einzelnen Buchungen und Buchungsdauer berechnet. Ein Prozentwert berücksichtigt, welcher Anteil nicht bereits mit Arbeitsweg oder Einkäufen kombiniert ist. Ein benötigter Kindersitz erzeugt einen Praxishinweis, aber ohne anbieterspezifische Preisdaten keinen pauschalen Kostenaufschlag.
- Tagesausflüge, Wochenend-/Mehrtagesfahrten und Urlaubsfahrten werden mit eigener Anzahl, Dauer und Strecke berechnet. Tagesausflüge berücksichtigen Stunden- und Tagespreis, längere Fahrten zusätzlich Wochenpakete.
- Die detailliert angegebenen Strecken werden von der Jahresfahrleistung abgezogen. Die restlichen Kilometer werden gleichmäßig auf die Alltagsfahrten verteilt, damit Kilometerstaffeln pro Buchung greifen. Überschreiten die Detailstrecken die Jahresfahrleistung, werden sie proportional begrenzt.
- Tarife verwenden ausdrücklich eine der Abrechnungsarten „Zeit + Kilometer“, „Kilometer + Tagespakete“ oder „Zeit, Kilometer inklusive“.
- Der Betrachtungszeitraum bestimmt, über wie viele Jahre einmalige Anmeldegebühren verteilt werden.
- Beim eigenen Auto gibt es neben Wartung sowie Steuer/TÜV/Reifen ein zusätzliches freies Feld „Sonstiges“ (0 € Vorgabe). Alle Autokosten sind nichtnegativ; Erstattungen wie Kilometergeld gehören in ein eigenes Einnahmenmodell und werden derzeit nicht verrechnet.
- Jeder Tarif kann Region, Quellen-URL und Datum der letzten Prüfung enthalten. Empfehlungen zeigen den dokumentierten Tarifstand oder weisen auf ein fehlendes beziehungsweise mehr als sechs Monate altes Prüfdatum hin. Die Standardtarife lassen sich im Tarifeditor wiederherstellen; eigene Tarifänderungen und Anbieter werden dabei nach Bestätigung entfernt.
- Im Tarifeditor lässt sich jeder Anbieter einzeln als versionierte JSON-Datei exportieren. Der Export enthält weder Nutzungs- und Standortangaben noch Angaben zum eigenen Auto aus dem Rechner.

Nach einer Änderung unter `data/providers` muss `npm run build:providers` ausgeführt werden. `npm run check` erkennt, wenn die erzeugte Browserdatei nicht mehr zu den JSON-Quellen passt.
