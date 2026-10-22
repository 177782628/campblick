# Versionen LS Dashboard (Campblick)

Jede Version liegt vollstaendig in `versionen/<Version>/`:

- `ls-dashboard-<Version>.html` – fertige Datei fuers iPhone (alles in einer Datei)
- `camper-dashboard.html` und `camper-bluetooth.js` – Quelldateien zum Weiterentwickeln

Zum Zuruecksetzen: Die beiden Quelldateien aus dem Versionsordner zurueck in den Projektordner kopieren
(oder die fertige HTML direkt aufs iPhone ziehen). Die Versionsdateien sind schreibgeschuetzt.

Bauen: `build.ps1` im Projektordner erzeugt `ls-dashboard-aktuell.html` (aktueller Arbeitsstand, auch im
Downloads-Ordner) und `docs/index.html` (Online-Version, https://177782628.github.io/campblick/).
`build.ps1 -Version v1.1` legt eine neue, schreibgeschuetzte Version an.

## In Arbeit (nach v1.0)

- Gasflasche: Fuellung mit abgerundeten Ecken, passt jetzt in die Flaschenkontur (Farbe gelb/rot unveraendert)

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
