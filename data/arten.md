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

**Wie Nahrung nachwächst:**

- **Gras, Laub, Insekten** wachsen aus dem vorhandenen Bestand (logistisch), dazu kommt eine
  kleine Reserve aus Wurzeln, Samen oder Eiern. Eine kahl gefressene Fläche erholt sich deshalb
  nur langsam. Das ist **Überweidung**: Zu viele Fresser zerstören ihre eigene Nahrungsgrundlage,
  der Bestand bricht ein und erholt sich erst, wenn die Pflanzen nachgewachsen sind. Insekten
  haben eine große Reserve (überwinternde Eier und Larven) und sind im Frühling schnell zurück.
- **Früchte** werden von den Büschen gebildet. Wie viel nachwächst, hängt davon ab, wie
  gesund die Büsche sind, also vom Füllstand von Laub. Verbeißen die Zwerghirsche das Laub,
  gibt es weniger Früchte für die Laufvögel – eine indirekte Konkurrenz.

**Auf der Karte sichtbar:** Unter „Karte“ oben lässt sich die Nahrungsansicht einschalten
(alles oder eine einzelne Schicht). Abgefressene Flächen werden braun, volle leicht grün.

## Grenzen jeder Art (Test: nur diese Art auf der Insel)

| Art allein | Verlauf | Was sie begrenzt |
|---|---|---|
| Laufvögel | wachsen bis ~1.100, fressen Früchte, Insekten und Gras kahl, brechen dann z. B. auf ~630 ein, schwanken danach mit dem Wetter | Nahrung, vor allem im Winter |
| Zwerghirsche | wachsen schnell, Gras und Laub werden kahl gefressen, Einbruch auf etwa ein Drittel | Nahrung (Überweidung) |
| Räuber allein | verhungern | keine Beute |

Die Obergrenze ist nirgends fest eingestellt. Sie ergibt sich allein aus Nahrung, Wetter und
Fressfeinden.

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

Früchte verrotten ab dem Herbst (im Winter 7 % pro Tag), Insekten sterben im Winter (12 % pro
Tag); in harten Wintern geht es schneller.

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
- **Fortpflanzung:** Jedes erwachsene Weibchen bekommt im Frühling 1–2 Kälber, wenn es genug
  Energie hat (≥ 40 %) und ein erwachsenes Männchen in der Herde ist. Erwachsen mit 1 Jahr,
  Höchstalter etwa 8 Jahre.
- **Verhalten:** grast, zieht auf abgeweideten Flächen zügig weiter, geht trinken, flieht vor
  jagenden Räubern (kurzer Sprint, dann Trab). Mehr Tiere in der Herde bemerken Gefahr früher.

## Laufvogel

- **Vorbild:** Takahē, Moa, Dodo – flugunfähige Bodenbrüter.
- **Rolle:** Beute für Adler und Wölfe; später besonders gefährdet durch eingeschleppte Ratten.
- **Gruppe:** lose Gruppe mit 1–6 Tieren.
- **Lebensraum:** Buschland, Wald, Sumpf.
- **Fortpflanzung:** Im Frühling legt jedes Paar 2–4 Eier in ein gemeinsames **Nest am Boden**.
  Die Küken schlüpfen nach 8 Tagen. Solange brütet die Gruppe in der Nähe des Nests.
- **Verhalten:** sucht Futter, flieht vor Räubern, brütet.

### Ökologische Nische

Der Laufvogel ist **Allesfresser am Boden**: Früchte und Samen, Insekten, etwas Gras. Damit
überschneidet er sich kaum mit dem Zwerghirsch, der Gras und Laub frisst. Die beiden
Pflanzenfresser konkurrieren also wenig und werden von verschiedenen Dingen begrenzt.

**Was den Laufvogel begrenzt:**

1. **Der Winter.** Früchte gibt es nur im Sommer und Herbst, Insekten nur im Frühling und
   Sommer. Im Winter verrotten die Früchte und die Insekten sterben. Bleibt nur Gras, und das
   ist für ihn wenig wert. Ein harter Winter lässt viele Vögel verhungern.
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
- **Gruppe:** Rudel mit bis zu 8 Tieren und festem Revier (Radius 320).
- **Beute:** Zwerghirsch, Laufvogel. Frisst auch Aas.
- **Jagd:** erst anschleichen (mindestens so schnell wie die ziehende Herde), dann sprinten. Der Erfolg steigt mit der Zahl der Jäger und
  sinkt mit der Deckung und der Herdengröße. Bevorzugte Opfer sind Jungtiere, schwache und alte
  Tiere.
- **Fortpflanzung:** nur das älteste Paar des Rudels, 2–4 Welpen im Frühling, und nur wenn das
  Rudel gut genährt ist (≥ 60 %).
- **Abwanderung:** Im Herbst verlassen junge Wölfe große Rudel. Wanderer suchen Artgenossen,
  schließen sich Rudeln an, denen ein Geschlecht fehlt, und gründen mit Partner ein Revier, wo
  Platz ist. Wanderer werden aus fremden Revieren vertrieben.

## Inseladler

- **Vorbild:** Haastadler (Neuseeland, ausgestorben).
- **Gruppe:** Paar mit Revier (Radius 330), dazu höchstens ein Junges.
- **Beute:** Laufvögel, junge Zwerghirsche (bis ½ Jahr). Sieht schlecht unter Bäume. Frisst Aas.
- **Fortpflanzung:** 1–2 Junge im Frühling. Erwachsen mit 2 Jahren, Höchstalter etwa 14 Jahre.
- **Abwanderung:** wie beim Wolf.
- **Trinkt nicht** (Wasser aus der Beute).

## Was das Ökosystem stabil hält

Diese Mechanismen sind bewusst eingebaut, weil sie auch in der Natur stabilisieren. Ohne sie
stirbt in der Simulation fast immer eine Art aus.

1. **Reviere:** Räuber ohne Revier dürfen nicht in fremden Revieren jagen. Das begrenzt die
   Zahl der Räuber auf die Zahl der Reviere.
2. **Beutewechsel (Holling Typ III):** Wird eine Beuteart selten, wird sie kaum noch gezielt
   gejagt.
3. **Rückzugsräume:** Im Wald werden Beutetiere schlechter entdeckt und erwischt.
4. **Aas:** Verhungerte Tiere und Reste von Rissen ernähren die Räuber in schlechten Zeiten.
5. **Fortpflanzung je nach Futterlage:** Hungrige Räuber bekommen keinen Nachwuchs.
6. **Inselgröße:** Auf einer kleinen Insel sind die Räuberbestände so klein, dass Pech reicht,
   um sie auszulöschen.

## Abstimmung (Stand)

`node tools/balance.js 8 30` rechnet 8 Inseln über 30 Jahre:

- mittlere Insel: in 6 von 8 Läufen überleben alle vier Arten. Die Bestände schwanken kräftig
  (Hirsche etwa 130–800), und in einzelnen Läufen bricht nach einem Boom ein Räuber zusammen.
- kleine Insel: Wölfe und Adler sterben meist nach wenigen Jahren aus (Stand vor der Umstellung
  auf logistisches Wachstum, noch nicht neu gemessen).
