# carshareOrNot
Vergleiche die jährlichen Kosten eines eigenen Gebrauchtwagens mit denen von Carsharing-Tarifen – auf Basis deiner tatsächlichen Fahrgewohnheiten

## Funktionen und Features

carshareOrNot hilft dir einzuschätzen, ob ein eigenes Auto, ein einzelner Carsharing-Anbieter oder ein Mobilitätsmix zu deinen Kosten und Fahrgewohnheiten passt. Der Vergleich berücksichtigt sowohl die jährlichen Ausgaben als auch praktische Fragen wie Planbarkeit, Kindersitze und Verfügbarkeit vor Ort.

- **Eigene Autokosten erfassen:** Kaufpreis, Haltedauer und Restwert bilden den Wertverlust ab. Hinzu kommen Wartung, Reparaturen und Reifen, Versicherung, Steuer und TÜV, Kraftstoff, Parkkosten sowie ein freier Posten für sonstige Kosten.
- **Den tatsächlichen Alltag abbilden:** Jahresfahrleistung, Alltagsfahrten, getrennte Hin- und Rückbuchungen, Bring- und Abholfahrten, Tagesausflüge, Wochenenden und Urlaubsfahrten lassen sich individuell angeben. Kindersitzbedarf und die Eignung von Free-Floating fließen in die Hinweise und Empfehlungen ein.
- **Mit Vorlagen beginnen:** Alltagsszenarien übernehmen passende Nutzungswerte, die anschließend bearbeitet oder rückgängig gemacht werden können. Sechs Autoprofile liefern Orientierungswerte für Wartung, Reparaturen und Reifen, Versicherung sowie Steuer inklusive HU/AU. Die Autodaten können separat zurückgesetzt werden.
- **Tarife und Mobilitätsformen vergleichen:** Wähle einen Anbieter selbst oder lasse dir passende Tarife empfehlen. Der Mobilitätsmix kann unterschiedliche Anbieter je Fahrtart sowie Rechenannahmen für Taxi/Ridehailing, Mietwagen und ÖPNV kombinieren. Diese ergänzenden Annahmen sind keine live abgefragten Angebote.
- **Verfügbarkeit berücksichtigen:** Für stationsbasierte Anbieter lassen sich nahe gelegene Stationen über OpenStreetMap suchen oder Stationszahl und Gehzeit manuell erfassen. Bei Free-Floating wird stattdessen die Verfügbarkeit im Geschäftsgebiet abgefragt. Fehlende Standortangaben bleiben als Unsicherheit erkennbar.
- **Ergebnisse nachvollziehen:** Jahreskosten, Ersparnis beziehungsweise Mehrkosten, Kosten je Kilometer sowie Aufteilungen nach Kostenart und Fahrtart werden als Tabellen und Grafiken dargestellt. Eine Kostenspanne, ein näherungsweiser Kostengleichstand nach Jahresfahrleistung und erklärende Hinweise unterstützen die Entscheidung.
- **Anbieter und Tarife selbst pflegen:** Im Tarifeditor kannst du Anbieter, Fahrzeugklassen und Tarife bearbeiten oder ergänzen. Quellen, Region, Prüfdatum und Kindersitz-Ausstattung lassen sich dokumentieren. Anbieter können einzeln als JSON importiert und exportiert werden.
- **Auf Handy und Desktop übersichtlich arbeiten:** Farblich getrennte Container gliedern Autokosten, Nutzung sowie Anbieter und Standort. Aufklappbare Untergruppen zeigen ihre wichtigsten aktuellen Werte bereits im geschlossenen Zustand.
- **Einstellungen behalten und Ergebnisse weitergeben:** Eingaben und Tarifänderungen werden im Browser gespeichert. Der Vergleich lässt sich mit seinen Einstellungen als Link oder als PNG-Ergebnisgrafik teilen.

## Teilen

Der Button „Teilen“ öffnet auf unterstützten Geräten das native Teilen-Menü. Andernfalls wird der Link in die Zwischenablage kopiert oder zum manuellen Kopieren angezeigt.

Der Link enthält den vollständigen Rechnerzustand, einschließlich der eingegebenen Adresse, Standortwerte und angepassten Tarife. Unveränderte Standardtarife werden dabei nicht mitgesendet; der Empfänger ergänzt sie aus der Anwendung. Die Daten stehen komprimiert im URL-Hash und werden deshalb beim Aufruf nicht als Teil der HTTP-Anfrage an den Webserver übertragen. Jeder Empfänger des Links kann die enthaltenen Einstellungen laden und lesen. Unterstützt wird nur das aktuelle Linkformat.

Standortdaten werden nur für tatsächlich vorhandene Anbieter in neue Teilen-Links übernommen. Ergänzungen wie Deutschlandticket, Taxi und Mietwagen erzeugen keine eigenen Standortdatensätze. Bereits verwaiste Standortdaten werden beim Laden lokaler Speicherstände bereinigt; eigene Anbieter bleiben erhalten.

„Ergebnisgrafik“ erzeugt eine 1200 × 630 Pixel große PNG-Zusammenfassung. Auf Geräten mit Datei-Teilen wird sie über das native Teilen-Menü angeboten, andernfalls als Datei heruntergeladen.

## Standortsuche mit OpenStreetMap

Die Suche läuft nur nach Klick auf „Stationen suchen“ für stationsbasierte Anbieter. Sie verwendet zwei öffentliche OpenStreetMap-Dienste direkt aus dem Browser:

1. Nominatim erhält die eingegebene Adresse und liefert genau einen Treffer (`format=json`, `limit=1`):

   ```text
   GET https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<URL-codierte Adresse>
   ```

2. Overpass erhält nur die Koordinaten dieses Treffers. Die Anwendung fragt alle als Carsharing markierten Knoten im Radius von 1.500 Metern ab:

   ```text
   POST https://overpass-api.de/api/interpreter
   Content-Type: application/x-www-form-urlencoded;charset=UTF-8

   data=%5Bout%3Ajson%5D%5Btimeout%3A15%5D%3Bnode%28around%3A1500%2C<LAT>%2C<LON>%29%5B%22amenity%22%3D%22car_sharing%22%5D%3Bout%20body%3B
   ```

   Dekodiert lautet die Overpass-Abfrage:

   ```overpass
   [out:json][timeout:15];
   node(around:1500,<LAT>,<LON>)["amenity"="car_sharing"];
   out body;
   ```

Die Anbieterkennung wird nicht an Overpass übermittelt. Die Anwendung vergleicht `operator`, `brand`, `network` und `name` erst lokal mit dem gewählten Anbieter. Für Free-Floating-Angebote findet keine OSM-Abfrage statt. Die Adresssuche wird nach 8 Sekunden abgebrochen. Je Overpass-Versuch gilt ein Zeitlimit von 20 Sekunden einschließlich Antwortverarbeitung. Bei vorübergehenden HTTP-Fehlern (429 oder 5xx), Netzwerkfehlern, Zeitüberschreitungen oder unvollständigen Antworten wird nach einer Sekunde einmal beim Hauptdienst wiederholt und anschließend höchstens einmal der Ersatzdienst https://overpass.private.coffee/api/interpreter verwendet. Maximal drei Overpass-Aufrufe pro Suche; keine Wiederholung bei anderen HTTP-Fehlern. Der Ersatzdienst erhält dieselben Koordinaten und dieselbe Abfrage, nicht die Adresse oder Anbieterkennung. Eine Fehlermeldung beziehungsweise Overpass-Fehlerantwort gilt niemals als null Stationen. Die Standortwerte bleiben bei Fehlern unverändert. Veraltete Suchen schreiben nach einem Anbieterwechsel keine Daten oder Meldungen in den neuen Kontext.

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
- `calculator.js` enthält die zustandslose Kostenberechnung. Das Ergebnis enthält `own` für das eigene Auto und `alternative` für den gewählten Anbieter oder Mobilitätsmix; `providerName` benennt die Alternative. Ohne passenden Tarif ist `alternative` gleich `null`.
- `app.js` erstellt den gemeinsamen Zustand, verbindet die Controller und bindet die Rechnerformulare und Tabs.
- `input-groups-ui.js` gruppiert die bestehenden Eingaben über das `input-group-template` in aufklappbare Bereiche und aktualisiert deren Zusammenfassungen. Überschriften, Zusammenfassungsvorlagen und Farbgruppen stehen in `index.html`; die Darstellung liegt in `styles.css`.
- `state-validation.js` enthält gemeinsame Strukturprüfungen, Standard-Standorte und Migrationen für gespeicherte Werte.
- `state-storage.js` lädt und speichert den Zustand; der Speichertimer gehört zur jeweiligen Controller-Instanz.
- `sharing.js` erstellt und lädt Teilen-Links und erzeugt die Ergebnisgrafik.
- `usage-scenarios.js` enthält die Fahrprofile als separate Referenzdaten.
- `profiles-ui.js` übernimmt Auswahl, Rücknahme und Zurücksetzen von Fahr- und Autoprofilen.
- `location-ui.js` steuert Standortfelder, Anbieterwechsel und Stationssuche. `station-search.js` kapselt die Overpass-Anfragen mit Wiederholung und Ersatzdienst.
- `results-ui.js` rendert Kosten, Empfehlungen, Grafiken und Entscheidungshilfen.
- `tariff-editor.js` verwaltet Tarifvorlagen, Bearbeitung sowie JSON-Import und -Export.
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

### Modul-Schnittstellen und Initialisierung

Die Browsermodule registrieren ihre öffentlichen APIs unter eigenen Carshare-Namen. Controller werden über `create(...)` erstellt; benötigter Zustand und Funktionen werden als benannte Abhängigkeiten übergeben. Interne Hilfsfunktionen bleiben im jeweiligen Modul. Die Fabriken verändern beim Erstellen keine Oberfläche und starten keine Netzwerkanfragen.

`app.js` erstellt die Controller in der Reihenfolge Formulargruppen, Speicherung, Teilen, Profile, Standort, Ergebnisse und Tarifeditor. Erst danach startet `init()`: Formulargruppen einrichten, Validierung binden, lokalen Zustand und gegebenenfalls geteilte Einstellungen laden, Felder befüllen, Ereignisse binden und Ergebnisse darstellen. Übergebene Funktionen dürfen erst nach vollständiger Verbindung der Controller auf andere Controller zugreifen. Weiterleitungsfunktionen für Rendering und Ergebnisbegründung verbinden Ergebnisansicht und Teilen.

Der gemeinsame `state`-Container bleibt bestehen, seine Teilobjekte wie `state.usage`, `state.providers` und `state.location` können ersetzt werden. Controller lesen diese deshalb bei jedem Aufruf neu, statt veraltende Referenzen festzuhalten. Temporäre Zustände wie Speichertimer, Suchgenerationen und Szenario-Rücknahme gehören zum zuständigen Controller. Gemeinsame Strukturprüfungen und Normalisierungen liegen in `state-validation.js`.

`input-groups-ui.js` verschiebt vorhandene Felder beim Aufruf von `mount()` in wiederverwendbare Templates; Kennungen, Werte und Listener bleiben erhalten. Die Zusammenfassungen lesen die aktuellen Felder und werden bei Eingaben und beim zentralen Rendering aktualisiert. `revealField()` öffnet übergeordnete Abschnitte vor dem programmatischen Fokus, etwa bei „Werte ansehen“. Dieses Modul speichert und berechnet keine Kosten.

## Anbieter und Tarife pflegen

Kennungen verwenden 1–64 Zeichen, beginnen mit einem Kleinbuchstaben und enthalten nur Kleinbuchstaben, Ziffern, Bindestriche oder Unterstriche. Anbieterkennungen sind global eindeutig, Klassenkennungen je Anbieter und Tarifkennungen je Klasse. JavaScript-Prototypnamen sowie interne Anbieterkennungen (`manual`, `recommend-single`, `recommend-mix` und das Präfix `supplement-`) sind reserviert. Build, JSON-Import und Teilen-Links prüfen diese Regeln gemeinsam in `identifier-validation.js`. Ein Import mit bereits vorhandener Anbieterkennung aktualisiert diesen Anbieter nach ausdrücklichem Hinweis in der Importbestätigung.

Jeder mitgelieferte Anbieter besitzt eine eigene Quelldatei unter `data/providers`. Um einen neuen Anbieter aufzunehmen:

1. Eine vorhandene JSON-Datei kopieren und passend benennen, zum Beispiel `book-n-drive.json`.
2. Eine eindeutige `id`, den sichtbaren `name`, die Betriebsart und die Quellenangaben eintragen.
3. Unter `classes` die angebotenen Fahrzeugklassen, deren Tarife und die Kindersitz-Ausstattung pflegen. `childSeats.infant` und `childSeats.booster` erlauben `bring-own`, `check` oder `included`; `boosterCount` wird nur bei `included` gesetzt.
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
- Der Mobilitätsmix bezieht außerdem transparente Rechenannahmen für Taxi/Ridehailing, Mietwagen und ÖPNV ein. Verwendet werden 4 € je Taxibuchung plus 2,20 €/km, 55 € je Mietwagentag plus 0,18 €/km und 63 € je Monat für ÖPNV (Deutschlandticket seit 01.01.2026; [Quelle: Deutsche Bahn](https://www.bahn.de/angebot/regio/deutschland-ticket/)). Das sind keine live abgefragten Angebote; regionale Preise und die praktische Verfügbarkeit müssen separat geprüft werden.
- Unter dem Ergebnis erscheinen eine Kostenspanne, eine näherungsweise Break-even-Jahresfahrleistung und eine Erklärung der Empfehlung. Die Spanne variiert bei den Autokosten Wartung um 25 Prozent und Kraftstoff um 10 Prozent sowie bei der Alternative die Gesamtkosten um 10 Prozent. Der Kostengleichstand wird bis 50.000 km Jahresfahrleistung gesucht.
- Anbieter mit bestätigten null Stationen werden aus Empfehlungen ausgeschlossen. Solange für vorgeschlagene Anbieter keine bestätigten Stations- und Gehzeitwerte vorliegen, kennzeichnet die Oberfläche das Ergebnis ausdrücklich als rein rechnerische Empfehlung.
- Stationsbasierte Anbieter verwenden Stationszahl und Gehzeit. Bei Free-Floating-Angeboten wie Miles und Free2move wird stattdessen erfasst, ob der Standort in einem Geschäftsgebiet liegt; verfügbare Fahrzeuge müssen direkt in der Anbieter-App geprüft werden. Bei der Rückgabe bleibt dort die Suche nach einem legalen öffentlichen Stellplatz Teil der Nutzung.
- Die Free-Floating-Praxistauglichkeit kann automatisch oder manuell bewertet werden. Ein benötigter Kindersitz oder regelmäßige Bring-/Abholfahrten gelten automatisch als deutlicher Nachteil. „Eher ungeeignet“ schließt Free-Floating aus beiden automatischen Empfehlungsmodi aus; dies gilt auch bei einer entsprechenden automatischen Einstufung. „Nur als Ergänzung“ erlaubt Free-Floating ausschließlich im Mobilitätsmix, dort weiterhin mit dem Rangfaktor 1,25. „Gut geeignet“ berücksichtigt Free-Floating normal. Die manuelle Anbieterwahl bleibt in jeder Stufe möglich. Die tatsächlichen Tarifkosten werden durch die Einstufung nicht verändert.
- Standortwerte sind zunächst unbekannt. Eine Verfügbarkeitsbewertung erscheint erst nach manueller Eingabe oder erfolgreicher Anbietersuche.
- Regelmäßige Bring- und Abholfahrten werden aus Tagen, aktiven Wochen, Strecke, einzelnen Buchungen und Buchungsdauer berechnet. Ein Prozentwert berücksichtigt, welcher Anteil nicht bereits mit Arbeitsweg oder Einkäufen kombiniert ist. Kindersitze werden getrennt als „bis 15 kg“ und „15 bis 36 kg“ erfasst. Die Eignungshinweise je Fahrzeugklasse berücksichtigen, ob der Sitz mitgebracht werden muss, im Fahrzeug geprüft werden muss oder vorhanden ist; sie verändern keine berechneten Kosten.
- Die mitgelieferte Ausstattung folgt den veröffentlichten Anbieterhinweisen: [Cambio](https://www.hvv-switch.de/de/faq/koennt-ihr-fuer-sixt-share-autos-einen-kindersitz-mitbuchen/) nennt für Fünftürer außer XS und Transportern eine Sitzerhöhung für 15–36 kg; [Flinkster](https://www.flinkster.de/de/sicherheit-service) und [SIXT share](https://www.sixt.de/share/tipps/kindersitze/) verlangen die Prüfung des konkreten Fahrzeugs; [MILES](https://support.miles-mobility.com/hc/de/articles/4467625028242-Gibt-es-in-allen-MILES-Fahrzeugen-einen-Kindersitz) nennt keine mitgeführten Kindersitze. Free2move wird in der aktuellen [hvv-switch-Übersicht](https://www.hvv-switch.de/de/faq/koennt-ihr-fuer-sixt-share-autos-einen-kindersitz-mitbuchen/) ohne Kindersitze und Sitzerhöhungen geführt. Die Angaben sind kein Buchungsversprechen und müssen bei der einzelnen Fahrt geprüft werden.
- Stand 9. September 2026: Cambio führt in passenden Fünftürern eine Sitzerhöhung für 15–36 kg. Bei Flinkster und SIXT share kann eine Sitzerhöhung in einzelnen Fahrzeugen vorhanden sein, sie muss vor der Buchung in der App geprüft werden. MILES und Free2move führen laut ihren veröffentlichten Hinweisen keine Kindersitze oder Sitzerhöhungen; eigene Sitze sind erforderlich. Bei stadtmobil hängt die Ausstattung von Region und Fahrzeug ab. Für alle Anbieter gilt: Sitze bis 15 kg bitte selbst mitbringen.
- Tagesausflüge, Wochenend-/Mehrtagesfahrten und Urlaubsfahrten werden mit eigener Anzahl, Dauer und Strecke berechnet. Tagesausflüge berücksichtigen Stunden- und Tagespreis, längere Fahrten zusätzlich Wochenpakete.
- Die detailliert angegebenen Strecken werden von der Jahresfahrleistung abgezogen. Die restlichen Kilometer werden gleichmäßig auf die Alltagsfahrten verteilt, damit Kilometerstaffeln pro Buchung greifen. Überschreiten die Detailstrecken die Jahresfahrleistung, werden sie proportional begrenzt.
- Tarife verwenden ausdrücklich eine der Abrechnungsarten „Zeit + Kilometer“, „Kilometer + Tagespakete“ oder „Zeit, Kilometer inklusive“.
- Der Betrachtungszeitraum bestimmt, über wie viele Jahre einmalige Anmeldegebühren verteilt werden.
- Stellplatzmiete und Anwohnerparkausweis sind jederzeit bearbeitbar und werden unabhängig vom Schalter addiert: monatliche Miete mal zwölf plus jährlicher Parkausweis. Nicht anfallende Kosten werden mit 0 eingetragen. Der Schalter gibt ausschließlich an, ob ein garantierter Stellplatz vorhanden ist, und steuert die Hinweise zur Parkplatzsuche. Umschalten verändert keine Kosten oder eingegebenen Beträge.
- Beim eigenen Auto gibt es neben Wartung sowie Steuer/TÜV/Reifen ein zusätzliches freies Feld „Sonstiges“ (0 € Vorgabe). Alle Autokosten sind nichtnegativ; Erstattungen wie Kilometergeld gehören in ein eigenes Einnahmenmodell und werden derzeit nicht verrechnet.
- Jeder Tarif kann Region, Quellen-URL und Datum der letzten Prüfung enthalten. Empfehlungen zeigen den dokumentierten Tarifstand oder weisen auf ein fehlendes beziehungsweise mehr als sechs Monate altes Prüfdatum hin. Die Standardtarife lassen sich im Tarifeditor wiederherstellen; eigene Tarifänderungen und Anbieter werden dabei nach Bestätigung entfernt.
- Grüne Flotte Bonn ist mit dem kostenfreien Tarif „Grün“ aufgenommen. Die Anwendung verwendet dessen Zeitpreise von 7 bis 24 Uhr und den am 21. Oktober 2026 veröffentlichten Kraftstoffzuschlag von 0,05 € je Kilometer. Die Nachtpreise von 0 bis 7 Uhr sowie Gold- und Schwarz-Tarife mit monatlichem Fahrtguthaben werden nicht abgebildet. Die Klassen XS/S, M/L und XL/XXL sind den Vergleichsgruppen Kleinwagen, Mittelklasse und Transporter zugeordnet, damit sie in Empfehlungen vergleichbar bleiben. Die Grüne Flotte bietet in Bonn auch „flott“ als Free-Floating-Angebot an; dessen konkrete Verfügbarkeit wird in dieser stationsbasierten Tarifabbildung nicht bewertet.
- Im Tarifeditor lässt sich jeder Anbieter einzeln als versionierte JSON-Datei exportieren. Der Export enthält weder Nutzungs- und Standortangaben noch Angaben zum eigenen Auto aus dem Rechner.

Nach einer Änderung unter `data/providers` muss `npm run build:providers` ausgeführt werden. `npm run check` erkennt, wenn die erzeugte Browserdatei nicht mehr zu den JSON-Quellen passt.


## Autoprofile und eigene Fahrzeugkosten

Unter „Das eigene Auto → Laufende Kosten“ stehen sechs Referenzprofile bereit. Die Auswahl ersetzt drei jährliche Kostenfelder: Wartung/Reparaturen/Reifen, Versicherung sowie Steuer inklusive HU/AU. Kaufpreis, Haltedauer, Restwert, Verbrauch, Kraftstoffpreis, Parkkosten und das freie Feld „Sonstiges“ bleiben erhalten. Es werden beim Laden keine vorhandenen Kosten automatisch durch Profilwerte ersetzt.

| Profil | Wartung/Reparaturen/Reifen | Versicherung | Steuer inklusive HU/AU |
| --- | ---: | ---: | ---: |
| Kleiner Stadtwagen | 1.038 € | 1.090 € | 125 € |
| Kleinwagen | 1.242 € | 1.260 € | 157 € |
| Kompaktwagen | 1.422 € | 1.275 € | 163 € |
| Familienkombi | 1.518 € | 1.177 € | 202 € |
| Kompakt-SUV | 1.488 € | 1.366 € | 237 € |
| Van / großer Familienwagen | 1.650 € | 1.406 € | 336 € |

Alle Beträge gelten pro Jahr. Die Werte sind ungewichtete Mittelwerte aus jeweils zwei konkreten ADAC-Modellvarianten um 2020/2021, abgelesen am 21.10.2026. Die Werkstattwerte beruhen auf 15.000 km/Jahr und fünf Jahren Haltedauer und enthalten Reifenersatz bereits. Versicherung ist eine eigene Beispielrechnung für Haftpflicht plus Vollkasko mit jeweils 50 Prozent Beitragssatz, 500 € Selbstbeteiligung in der Vollkasko und 150 € in der enthaltenen Teilkasko. 50 Prozent Beitragssatz bedeutet nicht „SF 50“. Die individuelle Versicherungsprämie kann deutlich abweichen. Zum Steuer-Mittelwert kommen 82 €/Jahr für HU/AU hinzu: ein regionaler Preisanker von 164 € alle zwei Jahre, keine bundesweit einheitliche Prüfgebühr.

Die Profile sind keine repräsentativen Klassendurchschnitte und passen sich nicht automatisch an die Jahresfahrleistung an. Das Van-Profil kombiniert einen Benziner und einen Diesel-Allradwagen. Ausgangswerte, Modell-Direktlinks, Annahmen und Rechenschritte stehen in [AUTOPROFIL-KOSTENRECHERCHE.md](AUTOPROFIL-KOSTENRECHERCHE.md); die übernommenen Vorgaben und monatlichen Werkstatt-Referenzen liegen in `own-car-profiles.js`. Eine gesonderte Nutzungserlaubnis für die abgeleiteten ADAC-Werte wurde bislang nicht eingeholt.

Bei der Profilwahl wird auch das bisherige Feld „Steuer, TÜV u. Ä. (ohne Reifen)“ ersetzt. Zusätzliche Kosten können im freien Feld „Sonstiges“ bleiben. Die aufklappbare Anleitung erläutert, wie die Vorlagen durch tatsächliche Kosten aus eigenen Unterlagen ersetzt werden können.

„Autodaten zurücksetzen“ stellt alle Kosten des eigenen Autos und dessen Parkplatzwahl auf die Beispielvorgaben zurück. Nutzung, Standort und Anbietertarife bleiben erhalten. Die übernommenen Kosten werden wie andere Eingaben lokal gespeichert und in Teilen-Links aufgenommen.

In Empfehlungsmodi gibt es unter „Standort & Verfügbarkeit“ eine eigene Anbieterauswahl für die Standortprüfung. Sie zeigt nur Anbieter der gewählten Fahrzeugklasse, die zur Alltagseignung und zum Empfehlungsmodus passen. Auch als nicht verfügbar markierte Anbieter bleiben dort prüfbar, damit ihre Werte korrigiert werden können. Der Mobilitätsmix verwendet nicht mehr die letzte manuelle Anbieterwahl als Standortkontext. Ohne geeigneten Anbieter werden die Eingabefelder ausgeblendet.

Der vollständige Rechenablauf mit Ja/Nein-Entscheidungen ist in [KALKULATION.md](KALKULATION.md) als Mermaid-Diagramme dokumentiert.

## Lokal starten

Der lokale Webserver wird in PowerShell aus dem Projektverzeichnis gestartet:

```powershell
.\start-server.ps1
```

Die Anwendung ist anschließend unter `http://localhost:5001/` erreichbar. Mit `-Port 8080` kann bei Bedarf ein anderer Port gewählt werden; beendet wird der Server mit `Strg+C`.
