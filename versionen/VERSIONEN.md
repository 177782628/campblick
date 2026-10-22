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

- Browser: **Nuviu** (App Store, kostenlos). Web Bluetooth funktioniert dort mit der Online-Adresse.
- Start ueber einen Kurzbefehl auf dem Homebildschirm, der https://177782628.github.io/campblick/ in Nuviu oeffnet.
- Browserleiste ausblenden: in Nuviu **mit zwei Fingern doppelt tippen**. Nuviu merkt sich das, auch nachdem die
  App komplett geschlossen wurde.
- Alternative: Bluefy mit Kurzbefehl `bluefy://open?url=https://177782628.github.io/campblick/` (Leiste bleibt sichtbar).
- Als Safari-Homebildschirm-App funktioniert die Anzeige, aber iOS erlaubt dort kein Bluetooth.

## In Arbeit (nach v1.0)

- Gasflasche: Fuellung mit abgerundeten Ecken, passt jetzt in die Flaschenkontur (Farbe gelb/rot unveraendert)
- Web-App: Manifest und App-Symbol (weisser Camper auf Gruen) im Ordner `web/`, werden mit der Online-Version
  veroeffentlicht
- Oberer Abstand: fester Zusatzabstand (59 px) fuer die Kameraaussparung entfernt; Bluefy und Safari melden
  die Aussparung selbst (`env(safe-area-inset-top)`).
- Bluetooth Browser: zieht die Seite nach dem Scrollen unter die Kameraaussparung, ohne sie zu melden. Das
  Dashboard erkennt das (Seite so hoch wie der Bildschirm, keine gemeldete Aussparung) und fuegt dann 59 px hinzu.
  Messwerte stehen unter „Bluetooth-Hinweise“ → „Abstand oben (Diagnose)“.
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
