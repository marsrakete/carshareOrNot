# Ablauf der gesamten Kalkulation

Stand: 21. Oktober 2026. Diese Dokumentation beschreibt den aktuellen Code, einschließlich seiner Vereinfachungen. Die Diagramme zeigen den Gesamtablauf und die verzweigten Teilberechnungen. Rauten sind Entscheidungen; ihre Kanten benennen Ja/Nein oder die jeweilige Auswahl.

## 1. Gesamtablauf

Die Unterprozesse A bis G werden anschließend genauer dargestellt. Standort und Alltagseignung steuern die Empfehlungen; die Kosten eines manuell ausgewählten Tarifs werden unabhängig davon berechnet.

```mermaid
flowchart TD
    S(["Start oder Eingabe geändert"]) --> I["A: Eingaben laden, prüfen und normalisieren"]
    I --> O["B: Jahreskosten des eigenen Autos berechnen"]
    O --> MODE{"Auswahl unter Anbieter?"}
    MODE -->|"Einzelner Anbieter"| MAN["Anbieter, Klasse und Tarif auflösen"]
    MAN --> T{"Tarif vorhanden?"}
    T -->|Ja| CALC["D und E: Fahrtmengen und Tarifkosten berechnen"]
    T -->|Nein| NONE["Nur Autokosten, kein Vergleich"]
    CALC --> COMP["Jahreskosten beider Optionen"]
    MODE -->|"Empfehlung: ein Anbieter"| FILTER["C: Kandidaten nach Klasse, Alltagseignung und Standort filtern"]
    MODE -->|"Empfehlung: Mobilitätsmix"| FILTER
    FILTER --> ANY{"Mindestens ein Carsharing-Kandidat übrig?"}
    ANY -->|Nein| NONE
    ANY -->|Ja| EACH["D und E für jeden Kandidaten berechnen"]
    EACH --> KIND{"Empfehlungsmodus?"}
    KIND -->|"Ein Anbieter"| SINGLE["Nach Rangwert sortieren; bei Gleichstand nach tatsächlichen Jahreskosten"]
    SINGLE --> BEST["Besten Tarif und bis zu drei Ranglistenplätze anzeigen"]
    BEST --> COMP
    KIND -->|Mobilitätsmix| MIX["F: Fahrtarten auf kompatible Tarife und ergänzende Verkehrsmittel verteilen"]
    MIX --> VALID{"Gültiger Mix vorhanden?"}
    VALID -->|Nein| NONE
    VALID -->|Ja| COMP
    COMP --> DETAILS["G: Kostendifferenz, Kosten je km, Spanne und Kipppunkt"]
    DETAILS --> OUT(["Ergebnis, Aufschlüsselung und Praxishinweise anzeigen"])
    NONE --> OUT
    OUT -.->|"Weitere Eingabe"| I
```

## 2. A – Eingaben und Vorlagen

```mermaid
flowchart TD
    A0["Standardwerte und Anbieter-JSON laden"] --> A1{"Lokaler Speicherstand vorhanden?"}
    A1 -->|Ja| A2["Gespeicherte Angaben laden und ältere Daten ergänzen"]
    A1 -->|Nein| A3["Standardwerte verwenden"]
    A2 --> A4{"Teilen-Link vorhanden?"}
    A3 --> A4
    A4 -->|Ja| A5{"Format, Größenlimits, Kennungen und Werte gültig?"}
    A5 -->|Ja| A6["Geteilten Zustand übernehmen"]
    A5 -->|Nein| A7["Link ablehnen; bisherigen Zustand behalten"]
    A4 -->|Nein| A8["Eingaben und Auswahl verwenden"]
    A6 --> A8
    A7 --> A8
    A8 --> A9{"Nutzungsvorlage gewählt?"}
    A9 -->|Ja| A10["Nutzungswerte ersetzen; Vergleichsjahre und Parkplatzwahl bewahren"]
    A9 -->|Nein| A11{"Autoprofil gewählt?"}
    A10 --> A11
    A11 -->|Ja| A12["Nur Werkstatt-Jahreswert inklusive Reifen übernehmen"]
    A11 -->|Nein| A13["Individuelle Werte verwenden"]
    A12 --> A14["Numerische Werte vor Berechnung begrenzen"]
    A13 --> A14
    A14 --> A15["Nichtnegative, endliche Werte; globale Obergrenze eine Milliarde"]
    A15 --> A16["Haltedauer und Vergleichsjahre mindestens ein Jahr"]
    A16 --> A17(["Weiter zur Kostenberechnung"])
```

- Zahlenfelder sperren Minuszeichen und prüfen zusätzlich ihre Feldgrenzen. Die Berechnung begrenzt Zahlen erneut. Ungültige Import- oder Linkdaten werden abgewiesen.
- Die sechs Autoprofile setzen ausschließlich den Posten Wartung, Reparaturen und Reifen. Die Werte skalieren nicht automatisch mit der Fahrleistung.
- Reifen sind in diesem Werkstattposten enthalten. Ein eventuell früher im Feld Steuer/TÜV erfasster Reifenanteil muss manuell abgezogen werden.
- „Autodaten zurücksetzen“ stellt die Autokosten und die Parkplatzwahl auf Beispielvorgaben zurück. Es ersetzt nicht das Fahrprofil, den Standort oder die Tarife.
- Die Eingabepfade sind mögliche Aktionen, keine bei jeder Änderung erneut durchgeführte Speicher- oder Linkabfrage.

## 3. B – Eigenes Auto

```mermaid
flowchart TD
    B0["Autokosten und Jahreskilometer"] --> B1["Wertverlust pro Jahr = max. Kaufpreis minus Restwert oder null, geteilt durch Haltedauer"]
    B1 --> B2["Parkkosten = Stellplatzmiete pro Monat mal 12 plus Parkausweis pro Jahr"]
    B2 --> B5["Fixkosten = Wertverlust + Werkstatt inklusive Reifen + Versicherung + Steuer/TÜV + Sonstiges + Parkkosten"]
    B5 --> B6["Kraftstoffkosten = Jahreskilometer / 100 mal Verbrauch mal Kraftstoffpreis"]
    B6 --> B7["Autokosten pro Jahr = Fixkosten + Kraftstoffkosten"]
    B7 --> B8{"Jahreskilometer größer als null?"}
    B8 -->|Ja| B9["Kosten je km = Autokosten / Jahreskilometer"]
    B8 -->|Nein| B10["Kosten je km rechnerisch null"]
    B9 --> B11(["Autokosten bereit"])
    B10 --> B11
```

„Fixkosten“ ist die Gruppierung der Oberfläche: Auch der hier angesetzte Jahresbetrag für Wartung und Verschleiß steht in dieser Summe. Eine automatische kilometerabhängige Werkstattberechnung gibt es nicht. Der Schalter für einen garantierten Stellplatz beeinflusst nur die Hinweise zur Parkplatzsuche; beide eingegebenen Parkkosten zählen unabhängig davon.

## 4. C – Zulässige Anbieter und Gewichtung

Diese Filter gelten für automatische Empfehlungen. Die Standortauswahl verwendet dieselben Regeln für Fahrzeugklasse und Alltagseignung, lässt aber als nicht verfügbar markierte Anbieter zur Korrektur ihrer Angaben weiterhin auswählen.

```mermaid
flowchart TD
    C0["Je Anbieter prüfen"] --> C1{"Gewählte Fahrzeugklasse vorhanden?"}
    C1 -->|Nein| CX["Anbieter aus Empfehlung ausschließen"]
    C1 -->|Ja| C2{"Free-Floating?"}
    C2 -->|Nein| C8{"Stationszahl bestätigt null?"}
    C2 -->|Ja| C3{"Alltagseignung automatisch bestimmen?"}
    C3 -->|Ja| C4{"Kindersitzbedarf oder eigenständige regelmäßige Bringfahrten?"}
    C4 -->|Ja| CX
    C4 -->|Nein| C7{"Geschäftsgebiet ausdrücklich nicht verfügbar?"}
    C3 -->|Nein| C5{"Gewählte Eignung?"}
    C5 -->|"Eher ungeeignet"| CX
    C5 -->|"Gut geeignet"| C7
    C5 -->|"Nur als Ergänzung"| C6{"Mobilitätsmix gewählt?"}
    C6 -->|Nein| CX
    C6 -->|Ja| C7
    C7 -->|Ja| CX
    C7 -->|Nein| C9["Alle Tarife der passenden Klasse berechnen"]
    C8 -->|Ja| CX
    C8 -->|Nein| C9
    C9 --> C10{"Free-Floating nur als Ergänzung?"}
    C10 -->|Ja| C11["Rangwert = Kosten mal 1,25"]
    C10 -->|Nein| C12{"Stationsbasiert und Alltagsmodell Einwegfahrt?"}
    C12 -->|Ja| C13["Rangwert = Kosten mal 1,5"]
    C12 -->|Nein| C14["Rangwert = Kosten"]
    C11 --> C15(["Kandidat mit Rangwert und echten Kosten"])
    C13 --> C15
    C14 --> C15
```

- Stationszahl null gilt als bestätigt, wenn sie aus manueller Eingabe oder Stationssuche stammt. Fehlende und ältere unbestätigte Standortwerte schließen einen Anbieter nicht automatisch aus.
- Bei Free-Floating erfolgt keine OSM-Stationssuche. Entscheidend sind Geschäftsgebiet und Fahrzeugverfügbarkeit in der Anbieter-App.
- Fehlende Standortbestätigung wird als Einschränkung der Empfehlung angezeigt. Gehzeit beeinflusst Praxishinweise, aber weder Tarifpreis noch Rangwert numerisch.
- Kindersitzbedarf bedeutet: mindestens ein benötigter Sitz oder ein noch zu prüfender älterer Kindersitz-Eintrag. Sitz-Ausstattung erzeugt Hinweise, keinen Kostenaufschlag.
- Rangfaktoren verändern nur die Reihenfolge, niemals die angezeigten Eurobeträge. Beim Einzelanbieter werden die gesamten Tarifkosten gewichtet; im Mix die variablen Kosten je Fahrtart. Mix-Grundgebühren bleiben ungewichtet.

## 5. D – Jahresfahrten und Kilometerverteilung

```mermaid
flowchart TD
    D0["Nutzungsprofil"] --> D1["Alltagsanlässe pro Jahr = monatliche Alltagsfahrten mal 12"]
    D1 --> D2{"Hin- und Rückfahrt getrennt buchen?"}
    D2 -->|Ja| D3["Buchungszahl verdoppeln; Dauer je Buchung halbieren"]
    D2 -->|Nein| D4["Eine Buchung je Anlass; gesamte eingegebene Dauer"]
    D3 --> D5["Bringfahrten berechnen"]
    D4 --> D5
    D5 --> D6["Aktive Tage = Tage pro Woche mal Wochen pro Jahr"]
    D6 --> D7["Buchungen = aktive Tage mal Buchungen pro Tag mal eigenständiger Anteil"]
    D7 --> D8["Bring-km = aktive Tage mal Tagesstrecke mal eigenständiger Anteil"]
    D8 --> D9["Tagesausflug-, Mehrtages- und Urlaubs-km = jeweilige Jahresanzahl mal Strecke"]
    D9 --> D10{"Summe dieser Detail-km größer als Jahreskilometer?"}
    D10 -->|Ja| D11["Alle Detail-km proportional auf Jahreskilometer begrenzen; Buchungszahl und Dauer bleiben gleich"]
    D10 -->|Nein| D12["Detail-km unverändert"]
    D11 --> D13["Alltags-km = max. Jahreskilometer minus Detail-km oder null"]
    D12 --> D13
    D13 --> D14{"Rest-km vorhanden, aber keine Alltagsbuchungen?"}
    D14 -->|Ja| D15["Für Kilometerabrechnung eine implizite Alltagsfahrt annehmen; Hinweis anzeigen"]
    D14 -->|Nein| D16["Vorhandene Alltagsbuchungszahl verwenden"]
    D15 --> D17["Je Fahrtart: Kilometer durch Buchungszahl teilen, sofern Buchungszahl positiv"]
    D16 --> D17
    D17 --> D18(["Fünf Fahrtarten bereit: Alltag, Bringen, Tagesausflug, Mehrtage, Urlaub"])
```

Bei der impliziten Alltagsfahrt wird kein zusätzlicher Zeitpreis erzeugt. Die angegebenen Bring-km sind die gesamte Tagesstrecke, nicht die Strecke jeder einzelnen Buchung.

## 6. E – Tarifberechnung pro Kandidat

```mermaid
flowchart TD
    E0["Tarifpreise und Fahrtmengen"] --> E1["Jahresfixkosten = Monatsgrundgebühr mal 12 + Anmeldung / Vergleichsjahre"]
    E1 --> E2["Je Fahrtart Zeitkosten berechnen"]
    E2 --> E3{"Mehrtagesfahrt oder Urlaub?"}
    E3 -->|Ja| E4{"Positiver Wochenpreis vorhanden?"}
    E4 -->|Ja| E5["Volle Wochen mal Wochenpreis + Resttage mal Tagespreis; je Buchung"]
    E4 -->|Nein| E6["Tage mal Tagespreis; je Buchung"]
    E3 -->|Nein| E7{"Kilometertarif mit Tagespaketen?"}
    E7 -->|Ja| E8["Kein Stundenpreis für Alltag, Bringen oder Tagesausflug"]
    E7 -->|Nein| E9["Dauer mal Stundenpreis"]
    E9 --> E10{"Positiver Tagespreis vorhanden?"}
    E10 -->|Ja| E11["Minimum aus Stundenkosten und einem Tagespreis"]
    E10 -->|Nein| E12["Stundenkosten unverändert"]
    E5 --> E13["Zeitkosten je Buchung mal Buchungszahl"]
    E6 --> E13
    E8 --> E13
    E11 --> E13
    E12 --> E13
    E13 --> E14{"Zeitabrechnung mit enthaltenen Kilometern?"}
    E14 -->|Ja| E15["Keine zusätzlichen Kilometerkosten"]
    E14 -->|Nein| E16{"Buchungszahl größer als null?"}
    E16 -->|Nein| E15
    E16 -->|Ja| E17{"Kilometer je Buchung höchstens 100?"}
    E17 -->|Ja| E18["Kilometer mal Preis bis 100 km"]
    E17 -->|Nein| E19["100 mal ersten km-Preis + restliche Kilometer mal Preis ab 101 km"]
    E18 --> E20["Kilometerkosten je Buchung mal Buchungszahl"]
    E19 --> E20
    E20 --> E21["Variable Kosten aller Fahrtarten aufsummieren"]
    E15 --> E21
    E21 --> E22["Tarifkosten pro Jahr = Jahresfixkosten + Zeitkosten + Kilometerkosten"]
    E22 --> E23(["Kandidat berechnet"])
```

Die Paketlogik bildet den aktuellen Code ab: volle Wochen plus Resttage. Sie sucht nicht sämtliche günstigsten Kombinationen aus Stunden-, Tages- und Wochenpaketen. Beim Tarifmodell „Zeit, Kilometer inklusive“ wird derzeit kein begrenztes Freikilometerkontingent modelliert.

## 7. F – Mobilitätsmix

```mermaid
flowchart TD
    F0["Berechnete, zulässige Carsharing-Kandidaten"] --> F1{"Mindestens ein Carsharing-Kandidat?"}
    F1 -->|Nein| FN["Kein Mix; Ergänzungen werden nicht allein berechnet"]
    F1 -->|Ja| F2["Fahrtmengen des ersten Kandidaten als gemeinsame Grundlage"]
    F2 --> F3["Taxi, Mietwagen und ÖPNV als Rechenannahmen ergänzen"]
    F3 --> F4["Aktive Fahrtarten bestimmen: Buchungen, Kilometer oder Kosten größer als null"]
    F4 --> F5["Mit leerem Portfolio starten"]
    F5 --> F6{"Weitere aktive Fahrtart?"}
    F6 -->|Ja| F7["Alle bisherigen Portfolios mit allen Kandidaten kombinieren"]
    F7 --> F8{"Kandidat für diese Fahrtart zulässig?"}
    F8 -->|Nein| FS["Kombination verwerfen"]
    F8 -->|Ja| F9{"Derselbe Anbieter bereits mit anderem Tarif im Portfolio?"}
    F9 -->|Ja| FS
    F9 -->|Nein| F10{"Anbieter bereits mit diesem Tarif berücksichtigt?"}
    F10 -->|Nein| F11["Jahresgrundgebühr und anteilige Anmeldung einmal hinzufügen"]
    F10 -->|Ja| F12["Keine erneuten Fixkosten"]
    F11 --> F13["Echte variable Fahrtartkosten und gewichteten Rangwert hinzufügen"]
    F12 --> F13
    F13 --> F14["Je gleicher Anbieter-Tarif-Kombination nur Portfolio mit kleinstem Fixkosten-plus-Rangwert behalten"]
    FS --> F15["Nächsten Kandidaten beziehungsweise nächstes Portfolio prüfen"]
    F14 --> F15
    F15 --> F6
    F6 -->|Nein| F16{"Mindestens ein Portfolio vorhanden?"}
    F16 -->|Nein| FN
    F16 -->|Ja| F17["Portfolio mit kleinstem Fixkosten-plus-Rangwert wählen"]
    F17 --> F18["Echte Fixkosten + echte variable Kosten als Mixergebnis anzeigen"]
    F18 --> F19(["Aufteilung nach Fahrtart und Verkehrsmittel"])
```

Der Kandidaten-/Portfolio-Schritt wird für jede Fahrtart vollständig durchlaufen, bevor die nächste Fahrtart beginnt.

| Ergänzung | Zulässige Fahrtarten | Rechenannahme |
|---|---|---|
| Taxi / Ridehailing | Alltag, Bringfahrten | 4 € je Buchung + 2,20 €/km |
| Mietwagen | Tagesausflug, Mehrtage, Urlaub | 55 €/Tag + 0,18 €/km; Dauer bei Mehrtagen/Urlaub mindestens ein Tag |
| ÖPNV / Deutschlandticket | Alltag, Bringfahrten | 63 €/Monat, also 756 €/Jahr, einmal im Portfolio |

Diese Ergänzungen sind keine Live-Angebote. Ihre lokale Verfügbarkeit wird nicht automatisch geprüft. Ein Mix darf nur einen Tarif pro Anbieter verwenden; er ist nicht auf zwei Anbieter begrenzt.

## 8. G – Vergleich, Spanne und rechnerischer Kipppunkt

```mermaid
flowchart TD
    G0["Berechnetes Auto und Alternative"] --> G1{"Vergleich vorhanden?"}
    G1 -->|Nein| GN["Nur Autokosten; kein Kostenvorteil und kein Kipppunkt"]
    G1 -->|Ja| G2["Differenz = Autokosten minus Alternative"]
    G2 --> G3{"Differenz mindestens null?"}
    G3 -->|Ja| G4["Alternative spart die Differenz; bei null Gleichstand"]
    G3 -->|Nein| G5["Eigenes Auto günstiger um den absoluten Differenzbetrag"]
    G4 --> G6["Je-km-Kosten: bei positiven Jahreskilometern Jahreskosten / Kilometer, sonst null"]
    G5 --> G6
    G6 --> G7["Autospanne: Jahreskosten plus/minus 25 Prozent Werkstatt und 10 Prozent Kraftstoff"]
    G7 --> G8["Alternativspanne: Jahreskosten plus/minus 10 Prozent; Untergrenzen mindestens null"]
    G8 --> G9["Mit unverändertem Fahrprofil Vergleich bei 0 und 50.000 Jahreskilometern neu berechnen"]
    G9 --> G10{"An beiden Grenzen Alternative berechenbar?"}
    G10 -->|Nein| GX["Kein Kipppunkt ermittelt"]
    G10 -->|Ja| G11{"Kostendifferenz bei 0 km genau null?"}
    G11 -->|Ja| GZ["Kipppunkt 0 km/Jahr"]
    G11 -->|Nein| G12{"Differenzen an beiden Grenzen mit gleichem Vorzeichen?"}
    G12 -->|Ja| GX
    G12 -->|Nein| G13["18 Halbierungsschritte: gesamten Vergleich am Intervallmittelpunkt neu berechnen"]
    G13 --> G14{"Vorzeichenwechsel zwischen unterer Grenze und Mittelpunkt?"}
    G14 -->|Ja| G15["Obere Grenze auf Mittelpunkt setzen"]
    G14 -->|Nein| G16["Untere Grenze und deren Differenz auf Mittelpunkt setzen"]
    G15 --> G17{"18 Schritte abgeschlossen?"}
    G16 --> G17
    G17 -->|Nein| G13
    G17 -->|Ja| G18["Intervallmittel auf 100 km runden"]
    G18 --> GO(["Ergebnis und Erläuterung anzeigen"])
    GZ --> GO
    GX --> GO
    GN --> GO
```

- Die Spannen sind feste Modellannahmen, keine statistischen Konfidenzintervalle.
- Beim Kipppunkt werden in Empfehlungsmodi auch Anbieterwahl und Mobilitätsmix erneut berechnet. Die übrigen Fahrtenzahlen und Dauern bleiben unverändert; die Kilometerverteilung wird erneut begrenzt.
- Die Halbierung prüft einen Vorzeichenwechsel an den Grenzen. Sie findet nicht zuverlässig mehrere mögliche Schnittpunkte bei nicht monotonen Kostenverläufen.
- Wenn kein Kipppunkt ermittelt wird, zeigt die Oberfläche bei vorhandenem Vergleich „Bis 50.000 km/Jahr kein Kostengleichstand“. Das bedeutet technisch, dass diese Suchmethode keinen Wert liefert.
- Praxishinweise zu Kindersitzen, Parkplatzsuche, Standort, Tarifstand und Buchbarkeit werden ergänzend dargestellt; sie erzeugen keine zusätzlichen Kosten außerhalb der dokumentierten Rangfaktoren.

## Zugehöriger Code

| Datei | Verantwortlichkeit |
|---|---|
| [calculator.js](calculator.js) | Normalisierung, eigenes Auto, Fahrtmengen, Kilometerstaffeln, Zeit- und Paketkosten |
| [recommendations.js](recommendations.js) | Eignungsfilter, Standortausschluss, Rangwerte, Einzelanbieter und Mobilitätsmix |
| [app.js](app.js) | Zustandsübernahme, Vorlagen, Standortkontext, Ergebnisdarstellung, Spannen und Kipppunkt |
| [providers.js](providers.js) | Standardwerte und Normalisierung von Autokosten und Tarifen |
| [own-car-profiles.js](own-car-profiles.js) | Jahresmittelwerte der sechs Autoprofile |
| [data-limits.js](data-limits.js) und [identifier-validation.js](identifier-validation.js) | Zahlen-, Größen- und Kennungsgrenzen |
| [data/providers](data/providers) | Gepflegte Anbieter- und Tarifquellen |

Ändert sich eine der Berechnungsregeln, sollten der zugehörige Entscheidungszweig und die Erläuterung in dieser Datei gemeinsam aktualisiert werden.
