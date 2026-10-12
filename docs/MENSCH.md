# Biotop – Der Mensch kommt auf die Insel

Stand: Plan zur gemeinsamen Ausarbeitung (Stufen 3 und 4 aus `KONZEPT.md`). Die Zahlen sind
Startwerte für die Abstimmung, keine kalibrierten Daten.

## 1. Die Idee

Die Insel läuft zunächst ohne Menschen im Gleichgewicht. Irgendwann sagt die Lehrkraft (oder
eine Gruppe von Lernenden): **Jetzt kommen Menschen.** Man klickt an die Küste, ein Schiff
erscheint, fährt dorthin, das erste Haus entsteht, Siedler laufen umher. Schon jetzt sieht man
die erste Veränderung: Die Tiere meiden die Gegend um das Dorf.

Danach wird mit **Karten** gespielt:

- **Aktive Karten** wählt man frei, wie Spielkarten, und zwar so oft man will. Jede weitere
  Karte derselben Sorte verstärkt den Eingriff (größeres Dorf, mehr Äcker, mehr Jäger).
- **Folgekarten** spielt niemand. Sie treten von selbst ein, mit einer Wahrscheinlichkeit, die
  aus dem Zustand der Simulation folgt (Schafe brechen aus, Hunde verwildern). Sie erscheinen
  in der Chronik und als Marke im Diagramm, damit man Ursache und Wirkung verbinden kann.

**Was man im Unterricht sieht:** Eingriff → Folge über Jahre. Und weil die Simulation
deterministisch ist: gleicher Seed, gleiche Karten zur gleichen Zeit = gleicher Verlauf. Zwei
Gruppen, die verschiedene Karten spielen, lassen sich direkt vergleichen.

## 2. Grundregeln im Modell

| Regel | Umsetzung |
|---|---|
| Karten sind Ereignisse | `sim.play(karte, ort)` zwischen zwei Ticks; alles wird in `sim.events` protokolliert (Chronik, Diagrammmarken, Wiederholung) |
| Karten sind Daten | `BT.CARDS` (Name, Text, aktiv/Folge, Voraussetzungen, Stärke je Stufe), kein Sonderfall im Code |
| Neue Tiere sind Arten | Schaf, Hund, Ratte, Katze werden Einträge in `BT.SPECIES` mit demselben Verhalten |
| Störung als Feld | Dorf, Äcker, Weiden erzeugen ein Störungsfeld (je Weidezelle, 0..1). Jede Art hat eine `scheu` (0..1) und meidet Störung entsprechend |
| Gelände in zwei Schichten | `world.biome` bleibt die Natur, `nutzung` (Dorf, Acker, Weide, gerodet) liegt darüber. Nahrung und Lebensraum werden aus beidem lokal neu berechnet |
| Inselzahmheit | Ein eingeschleppter Räuber hat `unknownTo: [...]`, die Arten, die ihn nicht kennen und nicht vor ihm fliehen |
| Neue Todesursachen | `jagd`, `mensch`, `krankheit`, `gelege` (Eier gefressen), dazu die neuen Räuber |

## 3. Die Karten

### Startkarte

| Karte | Was passiert | Folgen im Modell |
|---|---|---|
| **Landung** | Klick an die Küste: Ein Schiff fährt hin, das erste Haus entsteht, 5 Siedler | Störungsfeld um das Dorf; Hirsche und Wölfe meiden es, Laufvögel kaum (inselzahm). Das Gras ums Dorf erholt sich sichtbar, weil dort niemand mehr weidet |

### Aktive Karten

| # | Karte | Was passiert | Gegenspieler und Folgen |
|---|---|---|---|
| 1 | **Dorf vergrößern** | Wald am Dorfrand wird gerodet, neue Häuser, mehr Siedler | Farnwald und Buschland werden Grasland bzw. Dorf: weniger Laub, Früchte, Deckung. Größeres Störungsfeld |
| 2 | **Acker anlegen** | Ein Feld am Dorf; jede weitere Karte vergrößert es oder legt ein neues an | Viel Nahrung im Sommer, kahl nach der Ernte, keine Deckung. **Hirsche fressen gern am Acker** (Ernteschaden; Folgekarte „Hirsche im Acker“) |
| 3 | **Schafweide** | Eingezäunte Weide mit einer Schafherde | Schafe fressen Gras sehr kurz (genügsam, große Herden). **Wölfe holen sich Schafe** (leichte Beute). Folgekarte: Schafe brechen aus |
| 4 | **Hütehunde** | Hunde im Dorf und an den Weiden | Wölfe und Hirsche halten Abstand (starkes Störungsfeld), weniger Schafe gerissen. Folgekarte: Hunde verwildern |
| 5 | **Wölfe jagen** | Jäger ziehen in die Wolfsreviere | Wölfe sterben (Ursache „Jagd“), selten auch ein Jäger. Folgen: Hirsche nehmen zu → Überweidung |
| 6 | **Wild jagen** | Jäger erlegen Hirsche und Laufvögel als Nahrung | Zusätzliche Sterblichkeit; Laufvögel fliehen nicht vor Menschen und sind leichte Beute |
| 7 | **Sammeln** | Siedler sammeln Früchte und Samen rund ums Dorf | Weniger Früchte für die Laufvögel, vor allem im Herbst |
| 8 | **Ratten mitbringen** (z. B. „Neues Schiff mit Vorräten“) | Ratten kommen an Land | Siehe unten: Ratten sind eine Plage, aber auch Nahrung für Wölfe und Adler |

### Folgekarten (treten von selbst ein)

| Karte | Auslöser | Was passiert |
|---|---|---|
| **Schafe brechen aus** | je Weide und Jahr eine Wahrscheinlichkeit, höher ohne Hütehunde | Eine kleine Herde wird frei: **verwilderte Schafe** als eigene Art. Sie fressen das Grasland kurz, und die Hirsche weichen in Busch und Wald aus |
| **Hunde verwildern** | je Jahr mit Hütehunden eine Wahrscheinlichkeit | Ein kleines Rudel wird frei: **verwilderte Hunde** wie Wölfe (Rudel, Revier), aber erfolgreicher auf der Jagd; Laufvögel kennen sie nicht. Sie tragen eine **Krankheit**, die Wölfe in ihrer Nähe schwächt und tötet |
| **Wolf greift Siedler an** | ein Siedler ist allein außerhalb des Dorfs, ein hungriges Rudel ist nah | Meist gewinnt der Mensch (der Wolf stirbt, Ursache „Mensch“), manchmal stirbt der Siedler |
| **Hirsche im Acker** | Hirsche fressen am Acker | Meldung in der Chronik; später vielleicht: Siedler jagen dann von selbst |
| **Rattenplage** | Ratten erreichen einen Schwellenwert | Meldung; Ratten breiten sich über die ganze Insel aus |

### Die Ratten genauer

- Fressen **Eier** (Laufvogelnester und Adlerhorste), **Küken** der Laufvögel, **Samen und
  Früchte**, **Insekten**.
- Vermehren sich sehr schnell, leben kurz (etwa 1 Jahr), breiten sich vom Dorf aus über die Insel aus.
- Sind selbst **Beute für Wölfe und Adler**. Das ist eine schöne Doppelrolle: Zuerst geht es
  den Räubern sogar besser, den Laufvögeln aber schlechter.
- Technisch: wahrscheinlich ein **Feld** (Rattendichte je Weidezelle) statt einzelner Tiere,
  sonst werden es Tausende. Auf der Karte als gestreute Ratten gezeichnet, dichter, wo viele sind.

## 4. Was noch fehlen könnte (Vorschläge)

| Idee | Warum |
|---|---|
| **Katzen gegen Ratten** (aktiv) | Klassisches Beispiel für eine Kaskade: Die Katzen sollen die Ratten bekämpfen, fressen aber lieber die Laufvögel, die sie nicht kennen |
| **Rattengift** (aktiv) | Weniger Ratten, aber Adler und Wölfe, die vergiftete Ratten fressen, sterben mit (Sekundärvergiftung) |
| **Schutzgebiet / Zaun** (aktiv) | Ein raubtierfreies Gebiet. So endet die Geschichte nicht nur mit Zerstörung (Neuseeland: „Predator Free 2050“) |
| **Brandrodung** (aktiv oder Folge von „Dorf vergrößern“) | Schnell viel Fläche, aber das Feuer kann außer Kontrolle geraten |
| **Erosion** (Folge) | Gerodete, überweidete Hänge tragen dauerhaft weniger |
| **Versorgung des Dorfs** | Braucht das Dorf Nahrung, um zu wachsen? Das gäbe einen Grund für Acker, Jagd und Schafe, macht es aber zum Wirtschaftsspiel. **Vorschlag: zunächst nicht**, die Lernenden sollen Folgen beobachten, nicht wirtschaften |

## 5. Grafiken (Sprites)

Sprites braucht es überall dort, wo man **einzelne Dinge** auf der Karte sieht. Flächen wie
Acker, Weide und gerodetes Land werden gezeichnet (Konturen und Texturen wie die Lebensräume).

| Bild | Haltungen / Varianten | Wofür |
|---|---|---|
| Schiff | 1 (mit Segel), Seitenansicht | Landung, weitere Schiffe |
| Haus | 2–3 Varianten (Hütte, Haus, Scheune) | Dorf |
| Siedler | gehend, stehend, arbeitend (hacken/sammeln) | Figuren im Dorf und auf dem Feld |
| Jäger | gehend, schießend (oder Speer) | Jagdkarten, Kampf mit Wölfen |
| Schaf | wie die Tiere: f/m/j × gehend, stehend, essend, liegend | Weide und verwilderte Schafe |
| Hund | wie der Wolf | Hütehunde und verwilderte Hunde |
| Ratte | gehend, essend | Rattenplage |
| Katze | gehend, stehend, essend | Katzenkarte |
| Zaun | Stück, kachelbar (oder gezeichnet) | Weiden, Schutzgebiet |
| Kartenbilder | je Karte ein Bild | Kartenleiste in der Oberfläche |

Dateinamen wie bei den Tieren: `assets/<name>_<f|m|j>_<haltung>.png`, für Dinge ohne
Geschlecht `assets/<name>_<haltung>.png` (z. B. `schiff_faehrt.png`, `haus_1.png`,
`siedler_gehend.png`). Bis die Bilder da sind, zeichnet das Programm einfache Platzhalter.

## 6. Plan, Schritt für Schritt

Jeder Schritt endet mit: `node tools/balance.js 8 30` (ohne Menschen unverändert), einem
Screenshot, dem Eintrag in `data/arten.md` bzw. hier und einem Commit.

| Schritt | Inhalt | Stand |
|---|---|---|
| **1** | **Grundgerüst und Landung:** Karten als Ereignisse (`sim.play`, Chronik), Störungsfeld, Art-Merkmal `scheu`, Kartenleiste, Karte „Landung“ mit Schiff, erstem Haus und Siedlern, Tiere meiden das Dorf, Platzhalter-Grafiken | erledigt |
| **2** | **Dorf vergrößern:** Schicht Nutzung (`js/eco/landuse.js`), Rodung zu Erde, nach Jahren Wiese, neue Häuser und Siedler, Pause zwischen den Karten | erledigt |
| **3** | **Acker:** Ackerflächen mit Saison und Ernte, Hirsche fressen dort, Bilanz in der Chronik | erledigt |
| 4 | **Schafe:** Weide mit Zaun, Schaf als Art, Folgekarte „Schafe brechen aus“ (vorgezogen) | erledigt, ohne Wölfe an der Weide |
| 5 | **Hunde:** Hütehunde (Störung), verwilderte Hunde als Art, Staupe bei Wölfen (vorgezogen) | erledigt |
| 6 | **Ratten:** Ratten als Feld, Gelegeraub, Ratten als Beute | |
| 7 | **Jagd:** Wölfe jagen, Wild jagen, Siedler gegen Wolf | |
| 8 | **Sammeln** | |
| 9 | **Gegenmaßnahmen:** Katzen, Gift, Schutzgebiet (nach Absprache) | |

## 7. Entschieden

1. **Wer spielt:** Wer am Gerät sitzt. Jede Person oder Gruppe hat ihre eigene Insel, niemand
   spielt gegeneinander.
2. **Begrenzung:** Nach jeder Karte gibt es eine Pause, bis die nächste aktive Karte gespielt
   werden darf. Der Standard ist 2 Jahre. Weil wir den richtigen Wert noch ausprobieren, lässt
   sich die Pause in der Kartenleiste einstellen (keine, 1, 2 oder 3 Jahre).
3. **Versorgung des Dorfs:** Nein. Die Siedler ernähren sich vom Fischfang (so lässt es sich im
   Unterricht erklären). Das Dorf wächst nur durch die Karte „Dorf vergrößern“.
4. **Rodung:** Gerodeter Wald wird zu nackter Erde. Erst nach einigen Jahren wächst dort wieder
   etwas, und zwar Wiese, kein Wald.

## 7a. Noch offen

- Darf eine Art endgültig aussterben, oder gibt es immer einen Weg zur Rettung (Schritt 9)?

## 8. Umgesetzt

### Schritt 1: Landung

- `js/eco/cards.js`: Kartentabelle `BT.CARDS`. Bisher ist nur „Landung“ spielbar, die übrigen
  Karten stehen blass als „kommt bald“ in der Leiste.
- `js/eco/humans.js`: Schiffe, Häuser, Siedler, Störungsfeld (`BT.HUMANS` mit allen
  Stellschrauben). Die Menschen haben einen eigenen Zufallsgenerator (`fork('menschen')`).
  **Ohne Landung läuft die Simulation exakt wie vorher** (`balance.js` liefert dieselben Zahlen).
- `sim.play(karte, ort)` prüft die Karte und führt sie beim nächsten Tick aus. Festgehalten
  wird sie in `sim.events` (Tag, Karte, Ort). Daraus entstehen die Chronik unter der Kartenleiste
  und die gestrichelten Marken mit Symbol in allen Diagrammen.
- **Landung:** Karte antippen, dann an die Küste klicken. Der Klick wird zum nächsten
  Landpunkt direkt an der Küste verschoben (höchstens 150 Einheiten entfernt). Das Schiff
  kommt von der offenen See, fährt 4 Tage und liegt dann 3 Tage vor Anker. Solange es fährt,
  läuft die Zeit in Zeitlupe (höchstens 8 Ticks pro Sekunde, das Ergebnis bleibt gleich). Das
  erste Haus steht 4 Rasterzellen hinter der Küste. 5 Siedler gehen an Land und laufen tagsüber
  rund ums Haus (bis 110 Einheiten weit). Nachts sind sie im Haus.
- **Störung:** Um jedes Haus fällt sie von 1 (am Haus) auf 0 (im Abstand 260) ab. Wie stark eine
  Art sie meidet, steht in `scheu`: Zwerghirsch 1, Inselwolf 0,9, Inseladler 0,5, Laufvogel 0,2
  (inselzahm). Gemieden wird, wo `Störung · scheu ≥ 0,3` ist: Pflanzenfresser ziehen dort weg
  (Zustand „meidet die Menschen“) und wählen dort keine Weideplätze, Räuber streifen und jagen
  dort nicht. Durst geht vor, denn das Wasser kann im Dorf liegen. Für den Hirsch heißt das:
  im Umkreis von etwa 180 um das Haus. Der Laufvogel meidet das Dorf nie.
- Platzhalter-Grafiken in `js/render/humanRenderer.js`. Sobald Bilder da sind, werden sie dort
  in `FILES` eingetragen.
- `tools/shot.js … --landung=fx,fy` landet vor dem Simulieren an dieser Stelle (Anteil der Welt).

### Schritt 2: Dorf vergrößern

- **Nutzung als eigene Schicht** (`js/eco/landuse.js`): `world.biome` bleibt die Natur, wie sie
  generiert wurde. Die Simulation rechnet mit `sim.landuse.ground`, einer Kopie, in der es drei
  neue Lebensräume gibt: **Erde** (gerodet), **Dorf** (bebaut) und **Wiese** (auf gerodetem
  Land nachgewachsen). Lebensraum, Deckung und Nahrung kommen daraus (`sim.biomeAt`,
  `Fields.ground`). Ein Neustart beginnt wieder mit unberührter Natur.
- **Karte „Dorf vergrößern“:** Von 24 zufälligen Punkten 70 bis 300 Einheiten vom Dorf entfernt
  gewinnt der mit dem meisten Wald (Farnwald, Moosnebelwald, Buschland) in der Nähe. Dort wird
  eine unregelmäßige Fläche mit etwa 75 Einheiten Radius gerodet, rund 450 Zellen und je nach
  Insel 2 % des Waldes. Zwischen Dorf und Rodung entstehen 2 Häuser mit je 2 Siedlern. Um jedes
  Haus wird das Land im Umkreis von 24 Einheiten zu Dorf.
- **Erde:** Dort wächst nichts, und es gibt keine Deckung. Nach 3 bis 5 Jahren (je Zelle
  verschieden, deshalb wird es fleckig grün) wird die Erde zur **Wiese**. Die Wiese trägt viel
  Gras (8,8, fast wie Tussock), aber kaum Laub und Früchte. Wald kommt nicht zurück.
- **Pause:** `BT.CARD_RULES.pauseYears` (Standard 2), einstellbar in der Kartenleiste. Die Leiste
  zeigt, ab wann die nächste Karte geht. Karten, die eine Landung brauchen, gehen erst, wenn das
  Schiff angekommen ist.
- **Anzeige:** gerodete Erde braun mit Baumstümpfen, Dorfplatz sandfarben, Wiese hellgrün
  (`js/render/landuseRenderer.js`). In der Kopfzeile der Kartenleiste steht, wie viel Prozent
  des Waldes gerodet sind, in der Chronik, wie viele Häuser und Zellen eine Karte gebracht hat.
- **Härtetest:** 8 Inseln, Landung, dann 28 Jahre lang alle 2 Jahre „Dorf vergrößern“ (14
  Karten, 27 Häuser, 13 bis 22 % des Waldes gerodet). Auf 7 von 8 Inseln überleben alle Arten,
  auf einer stirbt der Inseladler aus.

### Schritt 3: Acker

- **Karte „Acker anlegen“:** Von 30 Orten 150 bis 270 Einheiten vom Dorf gewinnt der mit dem
  meisten offenen Land. Wald zählt halb, weil er erst gerodet werden muss. Neben einem
  bestehenden Acker liegt man gut, deshalb wird ein Acker mit der nächsten Karte meist größer.
  Ein Acker hat etwa 55 Einheiten Radius (rund 230 Zellen). Nie Acker werden Wasser, Fels,
  Gipfel, Strand, Thermalfeld, Sumpf und Dorf.
- **Getreide** ist eine eigene Nahrungsschicht (`BT.FOOD.korn`, Kapazität 14 je Weidezelle,
  nur auf dem Acker). Es wächst im Frühling und Sommer aus der Saat. Am ersten Herbsttag wird
  geerntet, dann stehen Stoppeln bis zum nächsten Frühling.
- **Hirsche lieben Getreide** (Energie 0,14 je Einheit, Gras 0,11). Wer Getreide frisst, kennt die
  Äcker und prüft sie bei der Futtersuche immer mit.
- **Nachtruhe:** Nachts (2 von 6 Ticks) sind die Siedler im Haus, die Störung sinkt auf 40 %.
  Tagsüber halten Hirsche etwa 180 Einheiten Abstand zu den Häusern, nachts nur noch etwa 70.
  So kommen sie nachts an die Äcker.
- **Ernte-Bilanz:** Bei jeder Ernte steht in der Chronik, wie viel eingebracht wurde und wie viel
  Tiere seit der letzten Ernte gefressen haben (🧺 Ernte). Ab einem Viertel ist es die Folgekarte
  **🦌 Hirsche im Acker**, mit Marke im Diagramm.
- Tagsüber arbeitet die Hälfte der Siedler auf den Äckern (Frühling und Sommer).
- **Anzeige:** Acker mit Furchen. Im Frühling grün, je weiter das Getreide steht, desto
  kräftiger; im Sommer golden, abgefressene Stellen braun; nach der Ernte Stoppeln, im Winter
  Brache.
- **Härtetest:** 8 Inseln, Landung, dann 28 Jahre lang im Wechsel Acker und Dorf (7 Äcker,
  13 Häuser, 10 bis 15 % des Waldes gerodet). Der Wildschaden hängt stark vom Ort ab: Liegt der
  Acker am Grasland, fressen die Hirsche anfangs bis 45 %, liegt er im Wald, fast nichts. Mit dem
  Dorf wächst die Störung, dann bleiben die Hirsche meist weg. Auf 7 von 8 Inseln überleben alle
  Arten. Auf Insel 8919 sterben die Wölfe aus, das passiert dort auch ohne Menschen in 2 von 8 Läufen.

### Schritt 4 und 5: Schafe und Hunde

Vorgezogen vor die Ratten. Beide kommen **zuerst als Haustiere** und **brechen etwa 4 Jahre später
zum ersten Mal aus, danach immer wieder**; sie leben dann als eingeschleppte Arten (`BT.SPECIES.schaf`, `.hund`,
`introduced: true`, Startbestand 0) mit demselben Verhalten wie alle Arten. Werte und Begründung:
`data/arten.md`.

- **Karte „Schafweide“:** Von 30 Orten 130 bis 280 vom Dorf gewinnt der mit dem meisten Grasland
  (Tussock, Wiese). Die Weide (Radius etwa 60, unregelmäßig) wird eingezäunt, das Land bleibt,
  wie es ist. 12 Schafe ziehen darin umher und fressen tagsüber das Gras. Jede weitere Karte legt
  eine neue Weide an.
- **Karte „Hütehunde“:** 3 Hunde laufen zwischen Dorf und Weiden. Störung: ums Dorf 20 % weiter,
  dazu um jede Weide (Umkreis 200).
- **Folgekarten** (eco/humans.js `checkEscape`):
  🐑 **Schafe brechen aus:** an jeder Weide zum ersten Mal 3,7 bis 4,3 Jahre nach ihrer Karte, danach
  alle 2 bis 5 Jahre wieder, jedes Mal 2 bis 6 Schafe (über den Zaun auf der dem Dorf abgewandten
  Seite). 🐕 **Hunde verwildern:** 4 Jahre nach den ersten Hütehunden 2 bis 3 Hunde, danach alle 3 bis
  5 Jahre wieder 1 bis 3. Im nächsten Frühjahr füllen die Siedler Weide und Hunde wieder auf.
- **Weglaufen:** Die Ausreißer sind satt und ohne Durst (Energie 1) und laufen erst weit weg
  (Zustand „ist ausgebüchst“, `g.runaway`): Schafe 350 bis 600 vom Dorf zu einem Ort mit gutem
  Gras nah am Wasser, Hunde 400 bis 700 vom Dorf. Erst dort suchen sie Weide bzw. Revier. Lebt ein
  wildes Hunderudel mit Platz höchstens 700 vom Dorf, laufen die Hunde zu ihm und schließen sich an.
- **Zaun:** Die Weiden sind eingezäunt (`humans.fence`, je Rasterzelle). Hinein kommen nur die
  Hütehunde, fliegende Tiere (Adler) und Räuber, die gerade jagen. Wer beim Bau der Weide drinnen
  stand, darf hinaus.
- **Die vier heimischen Arten bleiben unverändert.** Die Beziehungen bringen die neuen Arten mit:
  `preyOf` beim Schaf (Wolf und Adler fressen Schafe), `unknownTo` beim Hund (der Laufvogel kennt
  ihn nicht und flieht nicht).
- **Schafe** bilden Herden bis 100 mit Abstand zwischen den Tieren (der Radius der Herde wächst
  mit der Zahl). Ist eine große Herde hungrig, zieht die Hälfte weit weg zu einer neuen Weide. Sie
  sind früher erwachsen und haben mehr Lämmer als der Hirsch.
- **Hunde** sind wie Wölfe (gleiche Werte), etwas stärker, und tragen **Staupe**: Wölfe in ihrer
  Nähe erkranken mit der Zeit, werden schwach und sterben oft daran (Folgekarte 🦠 „Wölfe
  erkranken“, Todesursache „Krankheit“, kranke Tiere mit grünem Punkt).
- **Platzhalter-Bilder:** Schafe sind eingefärbte Hirsche (pink-lila), Hunde eingefärbte Wölfe
  (orange). Auch die Haustiere auf der Weide und im Dorf werden so gezeichnet.
- **Oberfläche:** Kacheln für Schafe und Hunde erscheinen, sobald die Art auf der Insel ist; in
  den Diagrammen stehen sie bei Pflanzenfressern bzw. Räubern. Keine Startregler für sie. Im
  Reiter Menschen: Schafe auf den Weiden, Hütehunde.
- `tools/balance.js … --karten=schafe@1,hunde@1` landet an der Westküste und spielt Karten zu
  Jahresbeginn; `tools/shot.js … --landung=… --karten=schafe,hunde`.
- **Fassen sie Fuß?** (`node tools/invasion.js 8 30 --karten=…`, Vergleich: dieselbe Insel nur
  mit Landung; Mittel der letzten 10 Jahre, Median über 8 Inseln)

  | Karten | Schafe etabliert (≥ 20 am Ende) | Hunde etabliert (Rudel mit Revier) | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|---|
  | nur Schafe | 8 von 8 (23–98, Spitzen bis 375) | – | 97 % | 95 % | 93 % | stark schwankend |
  | nur Hunde | – | 8 von 8 (3–11 Rudel) | mehr | 100 % | **Wölfe sterben auf 7 von 8 Inseln aus** | 62 % |
  | Schafe und Hunde | 6 von 8 | 8 von 8 | 75 % | 71 % | **0 %** (alle 8 Inseln) | 45 % |

  Die Hunde verdrängen die Wölfe immer (Staupe und Konkurrenz, nach 12 bis 30 Jahren). Die Schafe
  halten sich, verdrängen die Hirsche aber nicht: Sie vermehren sich stark, fressen das Grasland
  kahl und brechen ein (viele verhungern; gehetzt von Hunden und Wölfen kommen viele nicht zum
  Trinken). Die Hirsche weichen in Busch und Wald aus. Probeläufe nur mit Schafen: genügsamere
  Schafe (`costPerDay` 0,035, `winterCost` 0,008) → Hirsch 73 %; mehr Laub und Busch (Laub 0,08,
  Busch 0,9, Farnwald 0,5, Moos 0,4) → 79 %; beides zusammen → 95 % (Rauschen: 8 Inseln reichen
  für kleine Unterschiede nicht).
- **Noch nicht:** Wölfe reißen Schafe auf der Weide.
- **Mit Schafen und Hunden darf das Ökosystem kippen.** Die Werte sind noch nicht abgestimmt
  (das Testen übernimmt die Projektleitung). **Ohne Karte läuft alles exakt wie vorher.**

### Oberfläche: Reiter und Marken

- Unter der Zeitsteuerung gibt es zwei Reiter: **🦌 Tierbestand** (Startbestand, Bestand,
  Diagramme, Todesursachen, CSV) und **🏠 Menschen** (Übersicht: Siedler, Häuser, Äcker, gerodeter
  Wald, Fraß an der letzten Ernte; Karten, Pause, Chronik). Darf wieder eine Karte gespielt
  werden, steht am Reiter „Menschen“ das Schild **Karte bereit**.
- **Marken in den Diagrammen:** gespielte Karte = durchgezogene orange Linie mit Symbol;
  Folgekarte, die von selbst eintritt (z. B. 🦌 Hirsche im Acker) = gestrichelte rote Linie.
  Meldungen wie die jährliche Ernte stehen nur in der Chronik. Die gelblichen Bänder sind
  **Mastjahre** (Wetter, viele Früchte), die bläulichen harte Winter. Beides hat nichts mit den
  Menschen zu tun. Die Legende unter den Diagrammen erklärt alle vier.
