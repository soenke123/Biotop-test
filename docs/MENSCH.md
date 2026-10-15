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
| **Landung** | Klick an die Küste: Ein Schiff fährt hin, das erste Haus entsteht, 5 Siedler. Jede weitere Landung gründet ein neues Dorf | Störungsfeld um das Dorf; Hirsche und Wölfe meiden es, Laufvögel kaum (inselzahm). Das Gras ums Dorf erholt sich sichtbar, weil dort niemand mehr weidet |

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
| **Wölfe töten einen Jäger** (umgesetzt mit Schritt 7) | ein Jäger ist draußen auf der Jagd, ein hungriges Rudel ist nah | Wolfsjäger gewinnen fast immer (der Wolf stirbt, Ursache „Jagd“), Wildjäger sterben öfter selbst. Siedler im Dorf werden nicht angegriffen |
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

**Stand:** Schiff, zwei Häuser, Siedler, Jäger, Wolfsjäger, Sammler, Schaf, Hund und Ratten sind
da (siehe „Bilder der Menschen“ in Abschnitt 8). Es fehlen noch Katze und Zaun (der Zaun ist gezeichnet).

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
| 7 | **Jagd:** Wölfe jagen, Wild jagen, Wölfe gegen Jäger (vorgezogen vor die Ratten) | erledigt |
| 8 | **Sammeln** (nach dem Prinzip der Jagd) | erledigt |
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
5. **Mehrere Dörfer und Zurücknehmen:** Die Landung lässt sich mehrfach spielen (je ein Dorf).
   Jede Karte hat + und −; mit − wird sie zurückgenommen, die Folgen bleiben (siehe 8.).

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
- Grafiken in `js/render/humanRenderer.js` (`FILES`, siehe „Bilder der Menschen“).
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
  **🦌 Hirsche im Acker** (nur Chronik, keine Marke im Diagramm).
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
einmal aus** (je Weide bzw. je Karte „Hütehunde“); sie leben dann als eingeschleppte Arten (`BT.SPECIES.schaf`, `.hund`,
`introduced: true`, Startbestand 0) mit demselben Verhalten wie alle Arten. Werte und Begründung:
`data/arten.md`.

- **Karte „Schafweide“:** Von 30 Orten 130 bis 280 vom Dorf gewinnt der mit dem meisten Grasland
  (Tussock, Wiese). Die Weide (Radius etwa 60, unregelmäßig) wird eingezäunt, das Land bleibt,
  wie es ist. 12 Schafe ziehen darin umher und fressen tagsüber das Gras. Jede weitere Karte legt
  eine neue Weide an.
- **Karte „Hütehunde“:** 3 Hunde laufen zwischen Dorf und Weiden. Störung: ums Dorf 20 % weiter,
  dazu um jede Weide (Umkreis 200).
- **Folgekarten** (eco/humans.js `checkEscape`):
  🐑 **Schafe brechen aus:** an jeder Weide einmal, 3,7 bis 4,3 Jahre nach ihrer Karte, 2 bis 6 Schafe
  (über den Zaun auf der dem Dorf abgewandten Seite). 🐕 **Hunde verwildern:** einmal je Karte
  „Hütehunde“, 4 Jahre danach, 3 bis 4 Hunde (vorher 2 bis 3: sie starben oft gleich wieder aus). (Bis zur dritten Abstimmung brachen sie immer wieder
  aus; das gab ihnen einen unfairen Vorteil, die Messung unten stammt noch von dort.) Im nächsten Frühjahr füllen die Siedler Weide und Hunde wieder auf.
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
- **Hunde** sind wie Wölfe (gleiche Werte) und tragen **Staupe**: Wölfe in ihrer
  Nähe erkranken mit der Zeit, werden schwach und sterben oft daran (Folgekarte 🦠 „Wölfe
  erkranken“, Todesursache „Krankheit“, kranke Tiere mit grünem Punkt). Sie finden Abfälle in der
  Nähe der Dörfer (`scraps`) und **verdrängen die Wölfe** (`dominates`): In einem Hunderevier
  gründen Wölfe kein Revier. So rotten die Hunde die Wölfe in 15–20 Jahren aus (`data/arten.md`).
- **Bilder:** eigene Bilder in `assets/schaf` und `assets/hund` (vorher eingefärbte Hirsche und
  Wölfe). Auch die Haustiere auf der Weide und im Dorf werden so gezeichnet.
- **Oberfläche:** Kacheln für Schafe und Hunde erscheinen, sobald die Art auf der Insel ist; in
  den Diagrammen stehen sie bei Pflanzenfressern bzw. Räubern. Keine Startregler für sie. Im
  Reiter Menschen: Schafe auf den Weiden, Hütehunde.
- `tools/balance.js … --karten=schafe@1,hunde@1` landet an der Westküste und spielt Karten zu
  Jahresbeginn; `tools/shot.js … --landung=… --karten=schafe,hunde`.
- **Fassen sie Fuß?** (`node tools/invasion.js 8 30 --karten=…`, Vergleich: dieselbe Insel nur
  mit Landung; Mittel der letzten 10 Jahre, Median über 8 Inseln). Stand nach der zweiten
  Abstimmung (genügsame Schafe, Grasnarbe, 1–2 Lämmer, Flucht zum Wasser, Schafe als
  Ausweichbeute, Hunde jagen Laufvögel 0,6):

  | Karten | Schafe etabliert (≥ 20 am Ende) | Hunde etabliert (Rudel mit Revier) | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|---|
  | nur Schafe | 8 von 8 (24–484, Spitzen 130–935) | – | **69 %** | 84 % | 65 % | schwankt stark |
  | nur Hunde | – | 8 von 8 (6–11 Rudel) | 79 % | 72 % | **0 %** (7 von 8 ausgestorben) | **2 %** (6 von 8) |
  | Schafe und Hunde | 6 von 8 | 8 von 8 | **47 %** | **44 %** | **2 %** | **10 %** |

  Vorher (erste Fassung): nur Schafe Hirsch 97 %; Schafe und Hunde Hirsch 75 %, Laufvogel 71 %,
  Wolf 0 %, Adler 45 %. Die Hunde verdrängen jetzt Wölfe und Adler (sie fressen die Laufvögel weg),
  Schafe und Hunde zusammen drücken Hirsche und Laufvögel auf etwa die Hälfte. Die Schafe schwanken
  stark: Sie vermehren sich auf mehrere Hundert, fressen das Grasland kahl und brechen wieder ein.
- **Dritte Abstimmung** (Ausbruch nur einmal, Schafe leichte und bevorzugte Beute, kein Verdursten
  am Zaun; `invasion.js 24 30`, Median gegenüber nur Landung):

  | Karten | Inseln | Schafe (Mittel) | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|---|
  | nur Schafe | 15 von 24 mit Schafen | 70 | 91 % | 91 % | 115 % | 104 % |
  | | 9 ohne (ausgestorben) | – | 102 % | 75 % | 105 % | 171 % |
  | Schafe und Hunde | 15 von 24 mit Schafen, Hunde 21 von 24 | 67 | 93 % | 79 % | 3 % | 11 % |

  Die Wölfe halten die Schafe jetzt klein (sie reißen 200 bis 600 Schafe in 30 Jahren) und werden
  dabei etwas zahlreicher; die Hirsche sinken um etwa 10 % (scheinbare Konkurrenz, schwach).
- **Vierte Abstimmung:** Schafe weniger leichte Beute (`easyPrey` 1,2 statt 1,4), nur Schafe, 24 Inseln:
  auf 11 Inseln halten sich die Schafe (Mittel 104), dort Hirsch 74 %, Laufvogel 98 %, Wolf 122 %,
  Adler 82 %. Auf den 13 Inseln, wo sie aussterben: Hirsch 116 %, Wolf 70 %. Die meisten Schafe
  verhungern im Sommer nach der Lammzeit (4 Inseln: Frühling 556, Sommer 991, Herbst 494, Winter
  668), nicht im Winter; robustere Schafe im Winter würden wenig ändern.
- **Fünfte Abstimmung:** Schafe fressen auch Laub und Triebe (0,08 statt 0,05; Busch 0,8, Farnwald
  0,5, Moos 0,3). 24 Inseln, nur Schafe: auf 16 Inseln halten sie sich (vorher 11), Mittel 116;
  dort Hirsch 100 %, Laufvogel 96 %, Wolf 124 %, Adler 107 %. Versuch zusätzlich ohne leichte Beute
  (`easyPrey` 1): Schafe schießen auf etwa 380 hoch und brechen auf etwa 80 ein, Hirsch 92 %,
  Wolf 135 %. **Die Wölfe deckeln die Schafe:** Mehr Futter für die Schafe wird zu mehr Wölfen.
  Großen Einfluss aufs ganze Ökosystem haben die Schafe erst, wenn die Wölfe fehlen (wie in
  Neuseeland, das keine Raubtiere hatte).
- **Sechste Abstimmung** (nach dem Suchbild im Blick; Ziel: Schafe drücken die Hirsche sichtbar,
  Hunde rotten die Wölfe über mehrere Jahre aus). Schafe `scarce` 0,9 statt 0,3 (sonst galten
  schon die frisch ausgebrochenen als Suchbild); Hunde mit Dorfabfällen, Verdrängung der Wölfe,
  3–4 Ausreißern, Laufvogel 0,15 und Jagderfolg wie der Wolf. `invasion.js 8 30`, Median
  gegenüber nur Landung (Einzelheiten in `data/arten.md`):

  | Karten | Schafe etabliert | Hunde etabliert | Wölfe ausgestorben | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|---|---|
  | nur Schafe | 7 von 8 (vorher 1) | – | 0 | 56 % | 87 % | 111 % | 107 % |
  | nur Hunde | – | 8 von 8 (vorher 5) | 8 von 8 (vorher 2) | 68 % | 73 % | 4 % | 42 % |
  | Schafe und Hunde | 8 von 8 | 8 von 8 | 8 von 8 | 35 % | 74 % | 2 % | 23 % |

- **Noch nicht:** Wölfe reißen Schafe auf der Weide.
- **Mit Schafen und Hunden darf das Ökosystem kippen.** Die Werte sind noch nicht abgestimmt
  (das Testen übernimmt die Projektleitung). **Ohne Karte läuft alles exakt wie vorher.**

### Schritt 7: Jagd

Vorgezogen vor die Ratten. Werte in `BT.HUMANS.hunt` (`js/eco/humans.js`), Begründung und Tabelle
je Art in `data/arten.md` („Jagd“).

- **Jäger** (`humans.hunters`): Jede Karte bringt 2 Jäger. Sie ziehen auf Jagdzüge (bis 12 Tage,
  nachts lagern sie draußen) bis 1000 vom Dorf (jede weitere Karte derselben Sorte 30 % weiter),
  schleichen sich an und schießen aus 90. Heim gehen sie geradewegs; bleiben sie dabei hängen (an Seen),
  gehen sie auf ihrer eigenen Spur zurück. Danach 2–4 Tage im Dorf.
- **Karte „Wild jagen“:** Die Jäger nehmen, was sie zuerst sehen (Hirsch, Laufvogel, wildes
  Schaf), und bringen ein Tier heim. Wie weit sie hinausgehen, wird je Jagdzug neu gewürfelt
  (0–500 vom Dorf): erst ab dort wählen sie Beute und wechseln auf das, was sie sehen. So jagen sie
  mal am Dorf, mal weit draußen, wo die Wölfe sind (gilt auch für Wolfsjäger); ein Viertel bleibt als Aas liegen. Hirsche fliehen vor
  Jägern (`scheu` ≥ 0,5), Laufvögel nicht.
- **Karte „Wölfe jagen“:** Wolfsjäger verfolgen Rudel (auch wilde Hunde). Ein beschossenes Rudel
  flieht 300 weit, die Jäger folgen ihm und jagen weiter, bis der Jagdzug um ist.
- **Wölfe gegen Jäger:** Hungrige Rudel greifen Jäger an, die näher als 50 kommen (8 % je Tick, mit
  Beute 16 %). Wildjäger sterben zu 30 %, der Wolf zu 40 %, sonst nehmen die Wölfe die Beute.
  Wolfsjäger sterben zu 5 %, der Wolf zu 85 %. Ein toter Jäger ist die Folgekarte
  🐺 **Wölfe töten einen Jäger**; im Frühling kommt ein neuer.
- **Chronik:** jedes Jahr 🎯 **Jagdbilanz** (erlegt je Art, Angriffe). Reiter Menschen: Jäger,
  Wild erlegt, Wölfe erlegt, Angriffe. Todesursache „Jagd“.
- **Gehen** (seit den neuen Bildern): Früher blieben nachts (2 von 6 Ticks) alle Jäger und Sammler
  zugleich stehen, das sah aus wie ein Takt. Jetzt laufen sie auch nachts, jeder bleibt für sich
  ab und zu kurz stehen (`pause` 12 % je Tick, 1–2 Ticks), jeder hat sein Tempo (0,85–1,15 ×
  `speed` 25, vorher 30 nur tagsüber), auf langen Wegen pendeln sie um die gerade Linie (`sway`),
  und morgens brechen sie nicht alle im selben Tick auf. Der Jagdzug zählt jetzt alle Ticks (12
  Tage wie vorher), Nachladen 3 Ticks (vorher 2 Tagticks), Sammeln 2 je Tick (vorher 3 je Tagtick).
  So bleibt die Strecke je Tag etwa gleich. Messung `--karten=wildJagen@1,woelfeJagen@1,sammeln@1`
  (8 × 30 Jahre): gesammelt 4700–7000 (vorher 5900–7500), Laufvögel 343–383 (352–393), Wölfe 25–78
  (30–86), Hirsche 29–66 (31–65), Median gegenüber nur Landung Hirsch 135 % (168 %), Laufvogel 87 %
  (88 %), Wolf 29 % (6 %), Adler 67 % (39 %). Im Rahmen der Streuung zwischen den Läufen.
- **Ohne Jagdkarte läuft alles exakt wie vorher** (gleiche Prüfsummen der Bestände).
- **Messung** (`node tools/invasion.js 8 30 --karten=…`, Median gegenüber nur Landung):

  | Karten | erlegt in 30 Jahren (je Insel) | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|
  | Wild jagen | 333–382 Laufvögel, 1–27 Hirsche; 4–13 Angriffe, 0–6 Jäger tot | 74 % | 105 % | 89 % | 74 % (3 von 8 ausgestorben) |
  | Wild jagen, immer am Dorf (`out` 0) | 550–720 Laufvögel, 2–17 Hirsche; 0–2 Angriffe | 83 % | 115 % | 85 % | **21 %** (5 von 8) |
  | Wölfe jagen | 36–89 Wölfe | 122 % | 91 % | **20 %** (3 von 8 ausgestorben) | 67 % |
  | beide | Laufvögel wie oben, 36–56 Wölfe, 5–96 Hirsche | 128 % | 79 % | **6 %** (5 von 8) | 65 % |
  | beide, mit „mal nah, mal weit“ und geradem Heimweg | 376–412 Laufvögel, 38–70 Wölfe, 24–62 Hirsche; 0–2 Angriffe | 158 % | 101 % | **16 %** (5 von 8) | **2 %** (6 von 8) |

  Laufvögel gibt es viel mehr als Hirschherden, und sie fliehen nicht; deshalb erlegen die Jäger
  auch weit draußen meist Laufvögel. Die Hirsche gehen trotzdem zurück (sie fliehen oft vor den
  Jägern und fressen dann nicht). Bleiben die Jäger immer am Dorf, treffen sie fast nur Laufvögel (die Hirsche meiden das Dorf). Sie nehmen den
  Adlern die Beute weg, die Adler sterben aus, und die Laufvögel werden dadurch sogar etwas mehr.
  Weil die Jäger nah am Dorf bleiben, begegnen sie kaum Wölfen. Mit der vorigen Regel (Ziel nach
  Gewicht wählen, Laufvogel 0,6, kein Wechsel unterwegs; 8 Inseln × 30 Jahre) erlegten sie 70–130
  Hirsche und 180–330 Laufvögel, wurden 3–15-mal angegriffen (2–5 Jäger tot), Adler 83 %.
  Die Wolfsjäger lassen nur Rudel weit vom Dorf übrig; die Hirsche nehmen zu.

  Neu (letzte Zeile): Mit beiden Karten sterben jetzt die Adler fast überall aus. Auf Insel 24757
  brechen die Laufvögel in Jahr 13–19 ein (Jäger und Adler zugleich auf ihnen, die Wölfe fehlen
  als Lieferanten von Aas), die Adler verhungern und kommen nicht zurück. Noch nicht genauer
  untersucht.

### Schritt 8: Sammeln

Nach dem Prinzip der Jagd (`BT.HUMANS.gather`, `js/eco/humans.js`; die Sammler stehen mit den
Jägern in `humans.hunters`, `kind: 'sammel'`).

- **Karte „Sammeln“:** 2 Sammler je Karte. Je Gang wird gewürfelt, wie weit sie hinausgehen
  (0–500 vom Dorf). Ab dort pflücken sie Früchte und Samen, wo sie zuerst welche finden
  (mindestens 0,5 je Weidezelle), 2 je Tick aus der Zelle und ihren Nachbarn, dann weiter zur
  nächsten vollen Zelle in der Nähe. Heim gehen sie mit 60 (3 Körben) oder nach 10 Tagen, danach
  1–2 Tage im Dorf. Wo keine Früchte sind (Winterende, Frühling), bleiben sie daheim.
- **Wölfe:** Hungrige Wölfe greifen auch Sammler an. Die haben keine Waffen: der Sammler stirbt zu
  40 %, der Wolf zu 5 %. Folgekarte 🐺 „Wölfe töten einen Menschen“ (vorher „… einen Jäger“).
- **Chronik:** jedes Jahr 🫐 **Sammelbilanz** (Körbe, Angriffe). Reiter Menschen: Sammler,
  Körbe gesammelt. Auf der Karte: Sammler mit Korb (Bild).
- **Messung** (`invasion.js 8 30 --karten=…`, Median gegenüber nur Landung; die Laufvögel fressen
  auf der mittleren Insel etwa 3600 Früchte im Jahr):

  | Karten | gesammelt in 30 Jahren (je Insel) | Angriffe (Sammler tot) | Hirsch | Laufvogel | Wolf | Adler |
  |---|---|---|---|---|---|---|
  | 1 × Sammeln | 4900–7100 (etwa 200 im Jahr) | 3–19 (1–8) | 81 % | 90 % | 88 % | 99 % |
  | 3 × Sammeln (Jahr 1, 3, 5) | 12800–17800 | 4–24 (1–14) | 93 % | 90 % | 74 % | schwankt |

  Die Laufvögel gehen um etwa 10 % zurück. Die Sammler werden oft angegriffen, weil sie lange an
  einer Stelle bleiben.

### Mehrere Dörfer, Zurücknehmen, Infofenster

- **Dörfer** (`humans.villages`): Jede Landung gründet ein Dorf (Dorf 1, 2, … in der Reihenfolge der
  Landung). Häuser, Äcker, Weiden, Hütehunde, Jäger und Sammler gehören zu einem Dorf und rechnen
  von seiner Mitte aus (Rodung, Ackerplatz, Jagdgebiet, Ausreißer). Gibt es mehrere Dörfer, klickt
  man nach + auf das Dorf, das die Karte bekommen soll (`sim.cardTarget`; `params.x/y` → nächstes
  Dorf, ohne Ort das zuletzt gegründete). Auch die Landung unterliegt jetzt der Pause.
- **Zurücknehmen** (`sim.unplay(karte, ort)`, Ereignis mit `undo: true`): nimmt die zuletzt
  gespielte Karte dieser Sorte im Dorf zurück. Wirkt sie in mehreren Dörfern, klickt man das Dorf an.
  Zurücknehmen ist nicht an die Pause gebunden und startet keine.

  | Karte | − bewirkt | bleibt |
  |---|---|---|
  | Landung | Das Dorf wird verlassen, mit allem, was dazugehört | Rodungen; wilde Schafe und Hunde |
  | Dorf vergrößern | Die Häuser dieser Karte werden verlassen, ihre Siedler gehen | die Rodung |
  | Acker | Der Acker wird aufgegeben | – |
  | Schafweide | Weide und Zaun weg, die Schafe darauf nehmen die Siedler mit | ausgebüchste Schafe |
  | Hütehunde | 3 Hunde weniger, der Ausbruch dieser Karte entfällt | verwilderte Hunde, Staupe |
  | Jagd, Sammeln | 2 Jäger bzw. Sammler weniger | was sie erlegt oder gesammelt haben |

  Verlassene Dorfplätze und Äcker werden zu **Erde** und wachsen nach 3–5 Jahren zu: wo Wald war,
  zu Wiese, sonst wieder zu dem, was dort von Natur aus war (`Landuse.abandon`).
- **Anzeige:** Die Karten in der Leiste haben − Zahl +; die Zahl sagt, wie oft die Karte gerade
  wirkt. Karte antippen öffnet das **Infofenster** mit Bild, Erklärung (`more`) und was − bewirkt
  (`undo`, beides in `BT.CARDS`). Das Bild ist ein Ausschnitt der echten Inselkarte
  (`assets/karte_<id>.png`, erzeugt mit `tools/kartenbilder.js`, siehe unten). Zurückgenommene
  Karten stehen in der Chronik mit ↩ und als lang gestrichelte blaue Marke im Diagramm.
- **Mit einem Dorf läuft alles exakt wie vorher** (gleiche Prüfsummen mit allen Karten).

### Oberfläche: Reiter und Marken

- Unter der Zeitsteuerung gibt es zwei Reiter: **🦌 Tierbestand** (Startbestand, Bestand,
  Diagramme, Todesursachen, CSV) und **🏠 Menschen** (Übersicht: Siedler, Häuser, Äcker, gerodeter
  Wald, Fraß an der letzten Ernte; Karten, Pause, Chronik). Darf wieder eine Karte gespielt
  werden, steht am Reiter „Menschen“ das Schild **Karte bereit**.
- **Marken in den Diagrammen:** gespielte Karte = durchgezogene orange Linie mit Symbol;
  Folgekarte, die von selbst eintritt = gestrichelte rote Linie, aber nur für 🐑 Schafe brechen aus
  und 🐕 Hunde verwildern (`mark: true` in `BT.CARDS`); die übrigen Folgen nur in der Chronik.
  Meldungen wie die jährliche Ernte stehen nur in der Chronik. Die gelblichen Bänder sind
  **Mastjahre** (Wetter, viele Früchte), die bläulichen harte Winter. Beides hat nichts mit den
  Menschen zu tun. Die Legende unter den Diagrammen erklärt alle vier.

### Bilder der Menschen

- **Dateien** (`js/render/humanRenderer.js`, `FILES`): `assets/schiff.png` (Bug links),
  `assets/haus_fachwerk.png`, `assets/haus_holz.png`, in `assets/doerfler/` die Menschen von vorn:
  `villager_1…11` (Siedler), `jagdwild_1…7` (Jäger mit Bogen), `jagdwolf_1…7` (Wolfsjäger mit
  Speer), `sammeln_1…5` (Sammler mit Korb). Jedes Haus und jeder Mensch bekommt zufällig eines
  der Bilder seiner Sorte, fest nach seiner Nummer (er sieht immer gleich aus). Die Bilder sind
  auf ihren Umriss zugeschnitten. Der Ordner heißt `doerfler` (ohne Umlaut), weil Umlaute in
  Pfaden beim Kopieren und Entpacken leicht kaputtgehen. Neue Varianten: Datei ablegen und die
  Zahl in `numbered(…)` erhöhen.
- **Darstellung:** Menschen sind 1,7 × `settler.size` hoch und wippen im Schritt (nur Zeichnung).
  Ein Jäger mit Beute trägt das Bild des Tiers über der Schulter.
- **Kartenleiste:** Die Karten zeigen statt des Symbols ein Bild (`image` in `BT.CARDS`; der Acker
  hat noch keines und behält 🌾).
- **Infofenster:** `node tools/kartenbilder.js [karte …]` lädt die Insel (Seed 482917, Landung bei
  0,17/0,5), spielt die Karte, simuliert, bis die Szene zu sehen ist (z. B. ein Jäger nahe bei
  Wölfen, Frühling oder Sommer), und schneidet 960 × 480 Pixel um diese Stelle aus. Die Ratten gibt
  es in der Simulation noch nicht, dort stehen die Rattenbilder am Strand neben dem Schiff. Nach
  Änderungen an Grafiken die Bilder neu erzeugen.
- **Siedler gehen** jeder für sich: eigenes Tempo (0,75–1,25 × 3), an jedem Ziel 2–9 Ticks, ab
  und zu (20 %, nachts meist) heim und dann 3–12 Ticks im Haus. Vorher gingen nachts alle zugleich
  Richtung Haus. Ihre Wege haben einen eigenen Zufall (`walkRng`) und wirken nicht auf die Tiere.
