# carshareOrNot
Vergleiche die jährlichen Kosten eines eigenen Gebrauchtwagens mit denen von Carsharing-Tarifen – auf Basis deiner tatsächlichen Fahrgewohnheiten

## Teilen

Der Button „Teilen“ öffnet auf unterstützten Geräten das native Teilen-Menü. Andernfalls wird der Link in die Zwischenablage kopiert oder zum manuellen Kopieren angezeigt.

Der Link enthält den vollständigen Rechnerzustand, einschließlich der eingegebenen Adresse, Standortwerte und angepassten Tarife. Die Daten stehen komprimiert im URL-Hash und werden deshalb beim Aufruf nicht als Teil der HTTP-Anfrage an den Webserver übertragen. Jeder Empfänger des Links kann die enthaltenen Einstellungen laden und lesen.

## Lokal starten

Der lokale Webserver wird in PowerShell aus dem Projektverzeichnis gestartet:

```powershell
.\start-server.ps1
```

Die Anwendung ist anschließend unter `http://localhost:5001/` erreichbar. Mit `-Port 8080` kann bei Bedarf ein anderer Port gewählt werden; beendet wird der Server mit `Strg+C`.

## Projektstruktur

- `index.html` enthält die semantische Seitenstruktur und wiederverwendbare Templates.
- `styles.css` enthält Layout, Komponentenstile und responsive Regeln.
- `providers.js` enthält Standardwerte, Tarifarten, Anbieter und Tarif-Migrationen.
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

## Rechenmodell und Daten

- Alltagsszenarien füllen ausschließlich die Nutzungsangaben mit plausiblen Startwerten. Neben Familien-, Pendel- und Pflegeprofilen stehen Vorlagen für Wochenendbeziehungen, urbane Paare, Ruhestand, Wenigfahrer sowie Freizeitfahrten bereit. Fahrzeugkosten, Anbieter, Standort und Tarifänderungen bleiben erhalten; die unmittelbar vorherigen Nutzungswerte lassen sich wiederherstellen.
- Die Anbieterauswahl bietet zwei automatische Modi. „Empfehlung – ein Anbieter“ vergleicht alle passenden Tarife und zeigt die drei günstigsten. „Empfehlung – Mobilitätsmix“ darf jeder Fahrtart einen anderen Tarif zuordnen und berechnet Grund- sowie anteilige Anmeldegebühren für jeden tatsächlich genutzten Tarif genau einmal.
- Anbieter mit bestätigten null Stationen werden aus Empfehlungen ausgeschlossen. Solange für vorgeschlagene Anbieter keine bestätigten Stations- und Gehzeitwerte vorliegen, kennzeichnet die Oberfläche das Ergebnis ausdrücklich als rein rechnerische Empfehlung.
- Stationsbasierte Anbieter verwenden Stationszahl und Gehzeit. Bei Free-Floating-Angeboten wie Miles und Free2move wird stattdessen erfasst, ob der Standort in einem Geschäftsgebiet liegt; verfügbare Fahrzeuge müssen direkt in der Anbieter-App geprüft werden. Bei der Rückgabe bleibt dort die Suche nach einem legalen öffentlichen Stellplatz Teil der Nutzung.
- Die Free-Floating-Praxistauglichkeit kann automatisch oder manuell bewertet werden. Automatisch gelten Kindersitz oder regelmäßige Bring-/Abholfahrten als deutlicher Nachteil. Für die Empfehlungsreihenfolge werden Free-Floating-Kosten bei „nur als Ergänzung“ mit dem Faktor 1,25 und bei „eher ungeeignet“ mit 1,75 gewichtet. Dieser Rangwert wird nicht als Preis ausgegeben und verändert keine berechneten Kosten.
- Standortwerte sind zunächst unbekannt. Eine Verfügbarkeitsbewertung erscheint erst nach manueller Eingabe oder erfolgreicher Anbietersuche.
- Regelmäßige Bring- und Abholfahrten werden aus Tagen, aktiven Wochen, Strecke, einzelnen Buchungen und Buchungsdauer berechnet. Ein Prozentwert berücksichtigt, welcher Anteil nicht bereits mit Arbeitsweg oder Einkäufen kombiniert ist. Ein benötigter Kindersitz erzeugt einen Praxishinweis, aber ohne anbieterspezifische Preisdaten keinen pauschalen Kostenaufschlag.
- Tagesausflüge, Wochenend-/Mehrtagesfahrten und Urlaubsfahrten werden mit eigener Anzahl, Dauer und Strecke berechnet. Tagesausflüge berücksichtigen Stunden- und Tagespreis, längere Fahrten zusätzlich Wochenpakete.
- Die detailliert angegebenen Strecken werden von der Jahresfahrleistung abgezogen. Die restlichen Kilometer werden gleichmäßig auf die Alltagsfahrten verteilt, damit Kilometerstaffeln pro Buchung greifen. Überschreiten die Detailstrecken die Jahresfahrleistung, werden sie proportional begrenzt.
- Tarife verwenden ausdrücklich eine der Abrechnungsarten „Zeit + Kilometer“, „Kilometer + Tagespakete“ oder „Zeit, Kilometer inklusive“.
- Der Betrachtungszeitraum bestimmt, über wie viele Jahre einmalige Anmeldegebühren verteilt werden.
- Jeder Tarif kann Region, Quellen-URL und Datum der letzten Prüfung enthalten. Die Standardtarife lassen sich im Tarifeditor wiederherstellen; eigene Tarifänderungen und Anbieter werden dabei nach Bestätigung entfernt.
