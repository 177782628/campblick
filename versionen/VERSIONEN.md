# Versionen LS Dashboard (Campblick)

Jede Version liegt vollstaendig in `versionen/<Version>/`:

- `ls-dashboard-<Version>.html` – fertige Datei fuers iPhone (alles in einer Datei)
- `camper-dashboard.html` und `camper-bluetooth.js` – Quelldateien zum Weiterentwickeln

Zum Zuruecksetzen: Die beiden Quelldateien aus dem Versionsordner zurueck in den Projektordner kopieren
(oder die fertige HTML direkt aufs iPhone ziehen). Die Versionsdateien sind schreibgeschuetzt.

Bauen: `build.ps1` im Projektordner erzeugt `ls-dashboard-aktuell.html` (aktueller Arbeitsstand, auch im
Downloads-Ordner) und `docs/index.html` (Online-Version, https://177782628.github.io/campblick/).
`build.ps1 -Version v1.1` legt eine neue, schreibgeschuetzte Version an.

## Einrichtung auf dem iPhone

- Browser: **Bluetooth Browser** (Angelo Cammalleri) mit https://177782628.github.io/campblick/ – dort laufen alle
  Geraete am zuverlaessigsten und die Zuordnungen bleiben gespeichert.
- Getestete Alternativen:
  - Nuviu: ohne Browserleiste (mit zwei Fingern doppelt tippen, bleibt gespeichert), findet aber Snettbox und SC330
    nicht, weil sie nur ihren Namen aussenden.
  - Bluefy: findet alle Geraete, vergisst aber die Zuordnungen nach dem Neustart; Kurzbefehl
    `bluefy://open?url=https://177782628.github.io/campblick/`.
  - Safari mit Erweiterung beacio: funktioniert nur im Safari-Tab, nicht als Homebildschirm-App.
- Als Safari-Homebildschirm-App funktioniert die Anzeige, aber iOS erlaubt dort kein Bluetooth.

## Geplant

- Offline-Betrieb: Die App soll auch ohne Internet starten (lokale Datei oder Offline-Speicher der Online-Version).
  Wird eingebaut, sobald die App komplett laeuft.
- Solar (SC330): Datenformat per Mitschnitt der Buettner-App ermitteln (Mac mit PacketLogger).

## In Arbeit (nach v1.1, Fusszeile „v1.2-Entwurf“)

- Abstand oben im Bluetooth Browser: Nach dem ersten Scrollen laesst der Browser die Seite nicht mehr ganz nach
  oben (federt auf 62 px zurueck, gemessen auf dem iPhone mit iOS 18.7). Kommt das Hochscrollen kurz vor dem
  oberen Rand zum Stehen, springt das Dashboard einmal nach oben; verweigert der Browser das, wird genau dieser
  Versatz oben als Abstand eingefuegt. Die alte Erkennung ueber die Seitenhoehe (griff nicht) ist entfernt.
  Ein kurzes Veraendern der Seitenlaenge um 1 px brachte auf dem iPhone nichts und ist wieder entfernt.
- Knopf „↻“ rechts in der Zeile „Bluetooth-Hinweise“: klappt die Hinweise unsichtbar kurz auf und zu und springt
  nach oben. Das richtet die Ansicht im Bluetooth Browser neu aus (wie das Antippen der Hinweise); Messwerte und
  Verbindungen bleiben unberuehrt.
- „Bluetooth-Hinweise“ aufgeraeumt: kurze Statuszeile, eingeklappter Bereich „Entwicklerinfos“ (Abstand oben,
  Verbindung) und vier kurze Punkte (Camper, Geraete, Tipp, Aktualisierung); veraltete Texte entfernt.

## v1.1 – 23.10.2026

- Gasflasche: Fuellung mit abgerundeten Ecken, passt jetzt in die Flaschenkontur (Farbe gelb/rot unveraendert)
- Web-App: Manifest und App-Symbol (weisser Camper auf Gruen) im Ordner `web/`, werden mit der Online-Version
  veroeffentlicht
- Oberer Abstand: fester Zusatzabstand (59 px) fuer die Kameraaussparung entfernt; Bluefy und Safari melden
  die Aussparung selbst (`env(safe-area-inset-top)`).
- Bluetooth Browser: zieht die Seite nach dem Scrollen unter die Kameraaussparung, ohne sie zu melden. Das
  Dashboard soll das erkennen (Seite so hoch wie der Bildschirm, keine gemeldete Aussparung) und dann 59 px
  hinzufuegen; im Test auf dem iPhone noch ohne Wirkung. Messwerte ganz oben unter „Bluetooth-Hinweise“.
- Automatisches Neuverbinden, wenn der Browser wieder in den Vordergrund kommt (Bluefy-Ereignis
  `backgroundstatechanged` und Sichtbarkeit der Seite); nur fuer bereits bestaetigte, nicht von Hand getrennte Geraete
- „Geraet auswaehlen“ sucht gezielt nach dem Geraetenamen (Snettbox…, @UTS…/UTS Tank Sensor, SC330…), weil Nuviu
  Geraete, die nur ihren Namen aussenden, in der Liste „alle Geraete“ nicht zeigt; neuer Knopf „Alle Geraete anzeigen“

## v1.0 – 22.10.2026

- Gas (Gasolina „UTS Tank Sensor“): Fuellstand live, alle 20 s gelesen, mit der App abgeglichen (39 %)
- Batterie (Snettbox): Ladestand und Lade-/Entladeleistung live (negative Leistung = Laden)
- Temperatur: eigene Karte ohne eigenes Geraet, hoechster der drei 12-V-Sensoren der Snettbox (Tc/T12/T34),
  Einzelwerte darunter, Zeitangabe „Stand“
- Solar (Dometic SC330): Karte vorhanden, Datenformat noch offen (Mitschnitt der Buettner-App ausstehend)
- Grafiken: Gasflasche, Batterie, Thermometer, Solarpanel mit Sonne; Karte rot unter 20 % (Gas/Batterie)
- Camper als Verbinden-Knopf: grau = Bluetooth wird geprueft/aus/kein Geraet, schwarz = bereit,
  faehrt = verbindet, gruen = alles verbunden
- Verbinden: Erkennung gespeicherter Geraete per Kennung oder Name (getDevices); sonst gefilterte Auswahl
  (im Bluetooth Browser auf dem iPhone noetig, da getDevices nicht unterstuetzt wird)
- Gassensor mit 45 s Verbindungszeit; alle Geraete verbinden nach dem Bestaetigen gleichzeitig
- Anzeigen hinzufuegen/entfernen, Campername, Diagnosezeile unter „Bluetooth-Hinweise“
