# Ergänzende Kostenwerte für Autoprofile

Recherche vom 21.10.2026. Grundlage sind dieselben zwölf konkreten Modellvarianten, deren IDs bereits in own-car-profiles.js stehen. Die Direktseiten sind unabhängig von der Fahrzeugauswahl des Autokatalogs erreichbar. Die Zahlen wurden im Abschnitt „Laufende Kosten → Kosten Steuer und Versicherung“ gelesen. Das Abrufdatum ist kein zugesicherter Tarifstand.

Diese Datei dokumentiert die recherchierten und inzwischen in die Autoprofile übernommenen Vorgabewerte. Die bestehenden Werkstattkosten bleiben unverändert. Zwei Modelle je Profil bilden keinen repräsentativen Fahrzeugklassen- oder Versicherungs-Marktdurchschnitt.

## Ausgangsdaten mit direkten Quellen

Alle Beträge in Euro pro Jahr. HP = Haftpflichtbeitrag bei 100 Prozent, VK = Vollkaskobeitrag bei 100 Prozent und 500 € Selbstbeteiligung, TK = Teilkaskobeitrag bei 150 € Selbstbeteiligung. In der Modellüberschrift ist der Produktionszeitraum der konkreten Variante angegeben, nicht die Erstzulassung eines individuellen Fahrzeugs.

| Profil | Referenzmodell und Direktquelle | Kfz-Steuer | HP 100 % | VK 100 % | TK |
| --- | --- | ---: | ---: | ---: | ---: |
| Stadtwagen | [Toyota Aygo 1.0 x-style, 5-Türer (01/20–05/20)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/toyota/aygo/ab1-facelift/311520/) | 20 € | 1.404 € | 776 € | 292 € |
| Stadtwagen | [VW up! 1.0 ACTIVE, 5-Türer (01/21–11/22)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/up/1generation-facelift/318838/) | 66 € | 1.404 € | 776 € | 292 € |
| Kleinwagen | [VW Polo 1.0 MPI Comfortline (07/20–05/21)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/polo/vi/314121/) | 79 € | 1.074 € | 1.090 € | 424 € |
| Kleinwagen | [Opel Corsa 1.2 Edition (10/20–07/23)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/opel/corsa/f/316975/) | 70 € | 1.404 € | 1.472 € | 518 € |
| Kompaktwagen | [VW Golf 1.5 TSI ACT UNITED (07/20–11/20)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/golf/viii/313516/) | 90 € | 902 € | 1.320 € | 638 € |
| Kompaktwagen | [Opel Astra 1.2 DI Turbo „Opel 2020“ (12/19–08/20)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/opel/astra/k-facelift/309151/) | 72 € | 1.404 € | 1.472 € | 464 € |
| Familienkombi | [Skoda Octavia Combi 1.5 TSI ACT Style (04/20–12/20)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/skoda/octavia/4generation/310057/) | 100 € | 842 € | 1.320 € | 576 € |
| Familienkombi | [VW Passat Variant 1.5 TSI OPF Business DSG (09/20–11/23)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/passat/b8-facelift/315523/) | 139 € | 1.074 € | 1.472 € | 576 € |
| Kompakt-SUV | [VW Tiguan 1.5 TSI OPF UNITED DSG (09/20–12/20)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/tiguan/ii-facelift/314141/) | 154 € | 1.074 € | 1.320 € | 576 € |
| Kompakt-SUV | [Hyundai Tucson 1.6 T-GDI Select (12/20–05/24)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/hyundai/tucson/3generation/318463/) | 156 € | 1.480 € | 1.590 € | 810 € |
| Van | [VW Touran 1.5 TSI OPF ACT Highline DSG, 7-Gang (08/20–02/24)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/touran/ii/314766/) | 141 € | 1.074 € | 1.320 € | 518 € |
| Van | [Ford S-MAX 2.0 EcoBlue ST-Line Allrad Automatik (10/20–11/21)](https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/ford/s-max/ii-facelift/316515/) | 367 € | 1.480 € | 1.748 € | 702 € |

## Ableitung der Versicherungsannahmen

Die [ADAC-Berechnungsgrundlagen](https://assets.adac.de/Autodatenbank/Autokosten/autokostenuebersicht.pdf) verwenden Haftpflicht und Vollkasko jeweils mit 50 Prozent Beitragssatz, Vollkasko mit 500 € und eingeschlossene Teilkasko mit 150 € Selbstbeteiligung. Genannt werden durchschnittliche Regionalklassen und keine individuellen Zusatzrabatte. Für die folgende eigene überschlägige Ableitung verwenden wir:

- Haftpflicht allein: 0,5 × HP-Referenzbeitrag.
- Haftpflicht plus Teilkasko: 0,5 × HP-Referenzbeitrag + TK-Referenzbeitrag.
- Haftpflicht plus Vollkasko: 0,5 × HP-Referenzbeitrag + 0,5 × VK-Referenzbeitrag.

Anschließend wird der ungewichtete Mittelwert der beiden Referenzmodelle gebildet. Das sind Rechenannahmen, keine individuell angebotenen Versicherungsprämien. Der Beitragssatz 50 Prozent ist keine Schadenfreiheitsklasse „SF 50“. Persönliche SF-Klassen, Wohnort, Fahrerkreis, Alter, Fahrleistung, Tarif, Zahlungsweise und Selbstbeteiligung können zu deutlich anderen Beiträgen führen. Eine Teilkaskoprämie wird nicht zusätzlich zur Vollkasko addiert; [Vollkasko enthält die Teilkaskoleistungen](https://www.adac.de/produkte/versicherungen/autoversicherung/tarife-und-leistungen/).

| Profil | Nur HP, 50 % | HP 50 % + TK | HP 50 % + VK 50 % | Kfz-Steuer, Mittelwert |
| --- | ---: | ---: | ---: | ---: |
| Stadtwagen | 702 € | 994 € | 1.090 € | 43 € |
| Kleinwagen | 619,5 € | 1.090,5 € | 1.260 € | 74,5 € |
| Kompaktwagen | 576,5 € | 1.127,5 € | 1.274,5 € | 81 € |
| Familienkombi | 479 € | 1.055 € | 1.177 € | 119,5 € |
| Kompakt-SUV | 638,5 € | 1.331,5 € | 1.366 € | 155 € |
| Van | 638,5 € | 1.248,5 € | 1.405,5 € | 254 € |

## HU und AU separat berücksichtigen

Ein konkreter regionaler Preisanker ist die [TÜV-Hessen-Entgeltliste NRW, gültig ab 01.01.2026](https://www.tuvsud.com/de-de/-/media/de/auto-service/pdf/entgelttabellen/hessen/2026/tuv-hessen-nrw-januar-2026.pdf): Auf Seite 1 stehen für Pkw bis 3,5 Tonnen 164 € einschließlich AU mit Endrohrmessung, brutto. Seite 2 enthält Nettobeträge und darf damit nicht verwechselt werden. Für die gebrauchten Pkw der Referenzprofile ergibt die Verteilung auf zwei Jahre 82 €/Jahr. Es handelt sich um die Prüfgebühr, nicht um Reparatur- oder Nachprüfkosten und nicht um einen bundesweit einheitlichen Preis.

[HU-Fristen laut TÜV SÜD](https://www.tuvsud.com/de-de/branchen/mobilitaet-und-automotive/hauptuntersuchung/hauptuntersuchung-auto-fristen): Ein gewöhnlicher privat genutzter Pkw wird erstmals nach drei Jahren und anschließend im Zweijahresrhythmus geprüft. Die hier verwendeten 82 €/Jahr sind auf den regulären Zweijahresrhythmus ausgelegt.

Die ADAC-Fixkosten enthalten ihrerseits eine allgemeine Pauschale von 200 €/Jahr unter anderem für Parkgebühren, HU/AU und Kleinzubehör. Diese komplette Fixkostensumme wird hier bewusst nicht übernommen. Versicherung, Steuer und die explizite HU/AU-Annahme werden einzeln zusammengesetzt, damit Parkkosten und andere App-Eingaben nicht doppelt zählen.

## Übernommene ergänzende Profilvorgaben

Eigene Ableitung, auf ganze Euro gerundet. Der Versicherungswert verwendet hier als einheitliches Beispiel Haftpflicht plus Vollkasko bei jeweils 50 Prozent. Falls später eine Auswahl des Deckungsumfangs angeboten wird, stehen die anderen Varianten in der Tabelle oben bereit.

| Profil | Versicherung/Jahr | Steuer/Jahr | HU/AU/Jahr | Steuer + HU/AU/Jahr |
| --- | ---: | ---: | ---: | ---: |
| Stadtwagen | 1.090 € | 43 € | 82 € | 125 € |
| Kleinwagen | 1.260 € | 75 € | 82 € | 157 € |
| Kompaktwagen | 1.275 € | 81 € | 82 € | 163 € |
| Familienkombi | 1.177 € | 120 € | 82 € | 202 € |
| Kompakt-SUV | 1.366 € | 155 € | 82 € | 237 € |
| Van | 1.406 € | 254 € | 82 € | 336 € |

Das App-Feld „Steuer, TÜV u. Ä. (ohne Reifen)“ übernimmt bei der Profilwahl den Betrag aus der letzten Spalte. Verständlicher wären langfristig getrennte Felder für Kfz-Steuer und HU/AU, damit Nutzende beide Werte anhand ihrer Unterlagen ersetzen können. Die anderen Autokosten sind darin nicht enthalten.

## Grenzen und weitere Eingaben

- Steuer: Die Werte gelten für die genannten Modellvarianten. Für das eigene Fahrzeug zählt der tatsächliche Steuerbescheid; Erstzulassung, Motor und CO₂-Wert können einen anderen Betrag ergeben. [Zoll: Übersicht zur Kraftfahrzeugsteuer](https://www.zoll.de/SharedDocs/Downloads/DE/Links-fuer-Inhaltseiten/Fachthemen/Verkehrsteuern/uebersicht_co2_besteuerung.pdf?__blob=publicationFile&v=3).
- Van-Profil: Die Referenz verbindet einen Benziner mit einem Diesel-Allradfahrzeug. Besonders dessen Steuer hebt den Mittelwert an. Daraus darf kein allgemeiner Van-Steuersatz oder ein gemeinsamer Kraftstoffpreis abgeleitet werden.
- Versicherung: Die Beträge sind Referenzrechnungen. Der individuelle Jahresbeitrag aus einem Angebot oder der Beitragsrechnung hat Vorrang. Die Größe eines Autos allein bestimmt den Beitrag nicht.
- Kaufpreis, erwarteter Restwert und Haltedauer: aus dem konkreten Gebrauchtwagenkauf und der geplanten Nutzung übernehmen. Die historischen Neuwagen-Grundpreise der Quellen sind keine geeigneten Gebrauchtwagen-Vorgaben.
- Verbrauch und Kraftstoffpreis: zum konkreten Fahrzeug und Kraftstoff passend erfassen; die unterschiedlichen Motoren der Profile nicht ohne zusätzliche Annahmen mitteln.
- Parkplatz, Parkausweis und freie sonstige Kosten: lokale beziehungsweise persönliche Werte verwenden.
