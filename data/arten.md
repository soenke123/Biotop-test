# Artenkatalog

Fachliche Grundlage für `js/eco/species.js`. Die Zahlen sind **Startwerte für die Abstimmung**,
keine biologisch kalibrierten Daten. Ändert sich ein Wert im Code, wird er auch hier
nachgetragen.

Die Arten sind ausgedacht, haben aber reale Vorbilder. Die Zeit ist gestaucht: Ein Jahr hat
60 Tage (4 Jahreszeiten zu je 15 Tagen), ein Tag hat 6 Ticks.

## Grafiken (Platzhalter)

Die Bilder stammen vorerst aus Wild Clusters und liegen in `assets/`. Eigene Grafiken ersetzen
einfach die Datei. Format: PNG mit transparentem Hintergrund, Seitenansicht **nach links**
blickend (läuft das Tier nach rechts, wird gespiegelt), Seitenverhältnis etwa 254 × 219.

| Datei | Art | Platzhalter aus Wild Clusters |
|---|---|---|
| `assets/zwerghirsch.png` | Zwerghirsch | Reh |
| `assets/laufvogel.png` | Laufvogel | Storch |
| `assets/inselwolf.png` | Inselwolf | Fuchs |
| `assets/inseladler.png` | Inseladler | Bussard |

## Nahrung (Felder, keine Tiere)

| Schicht | wächst vor allem in | Jahreszeit |
|---|---|---|
| Gras und Kräuter | Tussock-Grasland, Sumpf, Buschland | Frühling stark, Winter schwach |
| Triebe und Laub | Farnwald, Moosnebelwald, Buschland | Frühling/Sommer |
| Früchte und Samen | Buschland, Farnwald | Sommer/Herbst, im Winter keine |
| Insekten | Sumpf, Farnwald | Frühling/Sommer |

Eine Weidezelle fasst 4 × 4 Rasterzellen zusammen (24 × 24 Einheiten).

**Nachwachsen:** Pflanzen wachsen aus ihren Blättern. Halb abgefressen wächst am meisten nach,
kahl gefressen kaum noch (nur aus Wurzeln und Samen, 5 % der Kapazität). Pro Tag:
`v += Rate · Jahreszeit · (v + 0,05·K) · (1 − v/K)`. Raten: Gras 0,13, Laub 0,1, Früchte 0,18,
Insekten 0,3.

**Überweidung:** Wird eine Weidezelle in der Wachstumszeit unter 25 % ihrer Kapazität
abgefressen (Laub: 30 %), sinkt ihr Pflanzenzustand (Gras um 0,05 je Tag, Laub um 0,03, mal
Jahreszeit; im Winter ruhen die Pflanzen, Abweiden schadet dann nicht). Abgestorbene Pflanzen
tragen kaum noch: Bei Zustand 0 wächst nur noch 2 % der Kapazität. Erholen kann sich eine Zelle
erst nach 60 Tagen (einem Jahr) ohne Überweidung, dann um 0,006 je Tag (Laub 0,004), mal
Jahreszeit und mal 0,2 + 0,8 · Zustand: Kahler Boden muss erst wieder besiedelt werden. Eine
völlig kahle Graszelle ist nach 3 Jahren zu einem Fünftel, nach 5 Jahren zur Hälfte und nach
etwa 7 Jahren ganz erholt. Früchte hängen am Zustand des Laubs (Büsche, die verbissen werden,
tragen weniger).

Gras und Laub werden nur von den Zwerghirschen gefressen. Damit hängt der Zustand der Weiden
allein an ihnen – und über sie an den Wölfen. Auf der Karte erscheinen
abgefressene Flächen strohfarben, überweidete als brauner Boden (Auswahl „Karte“ oben,
Standard „Weidezustand“). Dieselbe Auswahl zeigt auch jede Nahrungsschicht einzeln: abgefressen
braun, voll leicht grün – so sieht man z. B., wo die Laufvögel Früchte und Insekten leer fressen.

## Jahreswetter

Kein Jahr ist wie das andere (`js/eco/weather.js`). Zu Beginn jedes Jahres wird gewürfelt:

| Größe | Spanne | Wirkung |
|---|---|---|
| Wachstum | 0,75–1,25 | wie gut alle Pflanzen in diesem Jahr wachsen |
| Winterhärte | 0,55–1,5 | Energieverbrauch im Winter, Wachstum im Winter, Schwund von Früchten und Insekten |
| Mastjahr | 16 % (nie zweimal hintereinander) | Früchte bis zum 2,4-Fachen im Sommer und Herbst |

Das Wetter hat einen eigenen Zufallsgenerator: Dieselbe Insel hat immer dieselbe Wetterfolge,
auch wenn man die Startbestände ändert. Vergleichsläufe sind dadurch fair. In den Diagrammen sind
Mastjahre gelb und harte Winter blau hinterlegt.

**Winterschwund:** Früchte verrotten ab dem Herbst (im Winter 7 % pro Tag), Insekten sterben im
Winter (12 % pro Tag), in harten Wintern schneller. Insekten überwintern aber als Eier und
Larven (Reserve 35 % statt 5 %) und sind im Frühling schnell zurück. Für den Laufvogel wird der
Winter so zum Engpass, Mastjahre lassen seinen Bestand wachsen.

## Wasser

Durst steigt jeden Tag. Er sinkt beim **Trinken** (an See oder Fluss) und beim **Fressen**, denn
Nahrung enthält Wasser: Gras wenig (0,04 je Einheit), Laub etwas mehr (0,06), Insekten (0,14) und
Früchte (0,16) viel. Räuber decken einen Teil über das Fleisch. Trinken bleibt trotzdem nötig.
Ohne Wasser halten Zwerghirsch und Laufvogel 14 Tage durch, der Inselwolf 10. Der Inseladler
trinkt nicht.

## Zwerghirsch

- **Vorbild:** Inselverzwergung bei Hirschen (z. B. ausgestorbene Zwerghirsche auf Kreta).
- **Rolle:** Hauptbeute der Wölfe.
- **Gruppe:** Herde mit 2–16 Tieren. Wird sie größer, teilt sie sich.
- **Nahrung:** Gras, Laub.
- **Lebensraum:** Grasland, Buschland, Waldrand.
- **Fortpflanzung:** Jedes erwachsene Weibchen bekommt im Frühling 1 Kalb, wenn es genug
  Energie hat (≥ 40 %) und ein erwachsenes Männchen in der Herde ist. Erwachsen mit 1 Jahr,
  Höchstalter etwa 8 Jahre.
- **Verhalten:** grast, zieht auf abgeweideten Flächen zügig weiter, geht trinken, flieht vor
  jagenden Räubern (kurzer Sprint, dann Trab). Mehr Tiere in der Herde bemerken Gefahr früher.

## Laufvogel

- **Vorbild:** Takahē, Moa, Dodo – flugunfähige Bodenbrüter.
- **Rolle:** Beute für Adler und Wölfe; später besonders gefährdet durch eingeschleppte Ratten.
- **Gruppe:** lose Gruppe mit 2–6 Tieren. Einzelne Vögel schließen sich der nächsten Gruppe an
  (sonst finden sie keinen Partner).
- **Nahrung:** Früchte, Samen, Insekten (kein Gras).
- **Lebensraum:** Buschland, Wald, Sumpf.
- **Fortpflanzung:** Im Frühling legt jedes Paar 2–4 Eier in ein gemeinsames **Nest am Boden**.
  Die Küken schlüpfen nach 8 Tagen. Solange brütet die Gruppe in der Nähe des Nests.
- **Verhalten:** sucht Futter, flieht vor Räubern, brütet.

### Ökologische Nische

Der Laufvogel ist **Allesfresser am Boden**: Früchte und Samen, Insekten (kein Gras). Damit
überschneidet er sich nicht mit dem Zwerghirsch, der Gras und Laub frisst. Die beiden
Pflanzenfresser konkurrieren also wenig und werden von verschiedenen Dingen begrenzt.

**Was den Laufvogel begrenzt:**

1. **Der Winter.** Früchte gibt es nur im Sommer und Herbst, Insekten nur im Frühling und
   Sommer. Im Winter verrotten die Früchte und die Insekten sterben.
   Ein harter Winter lässt viele Vögel verhungern.
2. **Das Fruchtangebot schwankt von Jahr zu Jahr.** In einem **Mastjahr** tragen Büsche und
   Bäume massenhaft Früchte, die Vögel gehen gut genährt in den Winter und brüten im
   Frühling erfolgreich. Danach wächst der Bestand, bis ein mageres Jahr oder ein harter Winter
   ihn wieder einbrechen lässt.
3. **Der Inseladler** jagt vor allem Laufvögel. Er folgt dem Vogelbestand mit Verzögerung: Viele
   Vögel bedeuten viele junge Adler, die dann die Vögel stärker dezimieren.
4. **Der Inselwolf** nimmt Laufvögel nebenbei, vor allem wenn Zwerghirsche knapp sind.
5. **Deckung:** Im Wald und Buschland sieht der Adler die Vögel schlecht. Im offenen Grasland
   sind sie gefährdet.

## Inselwolf

- **Vorbild:** Falklandfuchs (Warrah), der einzige heimische Landräuber der Falklandinseln, von
  Siedlern ausgerottet.
- **Gruppe:** Rudel mit bis zu 5 Tieren und festem Revier (Radius 420).
- **Beute:** vor allem Zwerghirsch, Laufvögel nur selten. Frisst auch Aas. Wie sein Vorbild frisst er
  nebenher Insekten und Früchte, wenn er hungrig umherstreift. Das trägt ihn durch magere
  Zeiten, reicht aber nicht für Nachwuchs.
- **Jagd:** erst anschleichen, dann sprinten. Der Erfolg steigt mit der Zahl der Jäger und
  sinkt mit der Deckung, der Herdengröße und der Verfassung der Beute (ausgehungerte Tiere
  entkommen schlechter). Bevorzugte Opfer sind Jungtiere, schwache und alte Tiere. Ein erlegter
  Hirsch liefert 1,5 Energie (ein Laufvogel 0,6). Nach einem Riss ruht das Rudel nur, wenn es satt
  ist, sonst jagt es weiter. Gejagt wird unter 70 % Energie.
- **Fortpflanzung:** nur das älteste Paar des Rudels, 2–4 Welpen im Frühling, und nur wenn das
  Rudel gut genährt ist (≥ 50 %), ein eigenes Revier hat und noch nicht voll ist (höchstens 5).
- **Abwanderung:** Im Herbst verlassen junge Wölfe große Rudel. Wanderer suchen Artgenossen,
  schließen sich Rudeln an, denen ein Geschlecht fehlt, und gründen mit Partner ein Revier, wo
  Platz ist. Wanderer werden aus fremden Revieren vertrieben.

## Inseladler

- **Vorbild:** Haastadler (Neuseeland, ausgestorben).
- **Gruppe:** Paar mit Revier (Radius 330), dazu höchstens ein Junges.
- **Beute:** Laufvögel, junge Zwerghirsche (bis ½ Jahr). Sieht schlecht unter Bäume. Frisst Aas.
  Jagt unter 65 % Energie, verbraucht 0,03 Energie am Tag.
- **Fortpflanzung:** 1–2 Junge im Frühling, nur im eigenen Revier und nur, solange die Familie
  nicht voll ist (höchstens 3). Erwachsen mit 2 Jahren, Höchstalter etwa 14 Jahre.
- **Abwanderung:** wie beim Wolf.
- **Trinkt nicht** (Wasser aus der Beute).

## Was das Ökosystem stabil hält

Diese Mechanismen sind bewusst eingebaut, weil sie auch in der Natur stabilisieren. Ohne sie
stirbt in der Simulation fast immer eine Art aus.

1. **Reviere:** Räuber ohne Revier dürfen nicht in fremden Revieren jagen und bekommen keinen
   Nachwuchs, volle Rudel auch nicht. Das begrenzt die Zahl der Räuber auf die Zahl der Reviere.
2. **Beutewechsel (Holling Typ III):** Wird eine Beuteart selten, wird sie seltener gewählt und
   seltener verfolgt. Die Räuber hungern dann, bevor die Beute verschwindet (Bezug: 80 % des
   Startbestands).
3. **Rückzugsräume:** Im Wald werden Beutetiere schlechter entdeckt und erwischt.
4. **Aas:** Verhungerte Tiere und Reste von Rissen ernähren die Räuber in schlechten Zeiten.
5. **Fortpflanzung je nach Futterlage:** Hungrige Räuber bekommen keinen Nachwuchs.
6. **Inselgröße:** Auf einer kleinen Insel sind die Räuberbestände so klein, dass Pech reicht,
   um sie auszulöschen.
7. **Allesfresser-Räuber:** Der Inselwolf überbrückt magere Jahre mit Insekten und Früchten.

## Wozu die Räuber da sind

Das System ist so gebaut, dass es **nur mit allen Arten zusammen** funktioniert. Die Weiden
können überweidet werden und erholen sich dann jahrelang nicht. Ohne Räuber vermehren sich die
Hirsche, bis sie ihre Weiden zerstören. Die Wölfe halten sie darunter.

Vergleich (`node tools/balance.js 8 30` und `… --ohne=inselwolf,inseladler`, mittlere Insel):

| | mit Räubern | ohne Räuber |
|---|---|---|
| Zwerghirsche, Jahr 2–3 | etwa 100–180 | etwa 320–400 (Massenvermehrung) |
| Zwerghirsche, ab Jahr 10 | etwa 110, schwankend | etwa 110, die meisten sterben an Hunger |
| Laufvögel, ab Jahr 10 | etwa 310 | etwa 390, viele verhungern (Früchte fehlen) |
| Zustand Grasland / Laub | etwa 75–95 % / 93 % | etwa 25 % / 65 % |
| alle Arten überleben | 7 von 8 Läufen | – |

Ohne Räuber verläuft es wie auf dem Kaibab-Plateau: erst viel mehr Pflanzenfresser, dann
kahl gefressene Weiden und Hungersnot. Die Insel bleibt danach kahl, weil die übrigen Hirsche
die Weiden nie lange genug schonen.

Mit Räubern sieht man eine **Kaskade**: Werden die Wölfe in einem Jahr knapp, steigen die
Hirsche, das Grasland leidet. Erholen sich die Wölfe, sinken die Hirsche, und die Weiden heilen
über Jahre. Stirbt das Wolfsrudel aus, kippt die Insel in den kahlen Zustand.

## Abstimmung (Stand)

`node tools/balance.js 8 30` rechnet 8 Inseln über 30 Jahre:

- mittlere Insel: in 6 von 8 Läufen überleben alle vier Arten (mit Jahreswetter; ohne Wetter
  waren es 7 von 8). Mittlere Bestände ab Jahr 10: Hirsche ~126, Laufvögel ~326 (schwankend
  etwa 70–730), Wölfe ~13, Adler ~13.
- kleine Insel: nur in 1 von 6 Läufen; meist sterben die Wölfe nach 9–21 Jahren aus, in einem
  Lauf auch die Zwerghirsche
