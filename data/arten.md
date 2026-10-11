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

**Überweidung:** Wird eine Weidezelle immer wieder unter 20 % ihrer Kapazität abgefressen, sinkt
ihr Pflanzenzustand (Gras um 0,03 je Tag, Laub um 0,015). Abgestorbene Pflanzen tragen weniger:
Bei Zustand 0 wächst nur noch 15 % der Kapazität. Ohne Fraß erholt sich der Zustand langsam
(Gras 0,006, Laub 0,003 je Tag, mal Jahreszeit), also über mehrere Jahre. Früchte hängen am
Zustand des Laubs (Büsche, die verbissen werden, tragen weniger). Auf der Karte erscheinen
abgefressene Flächen strohfarben, überweidete als brauner Boden (Knopf „Weidezustand“).

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
- **Gruppe:** lose Gruppe mit 2–6 Tieren. Einzelne Vögel schließen sich der nächsten Gruppe an
  (sonst finden sie keinen Partner).
- **Nahrung:** Früchte, Insekten, etwas Gras.
- **Lebensraum:** Buschland, Wald, Sumpf.
- **Fortpflanzung:** Im Frühling legt jedes Paar 2–4 Eier in ein gemeinsames **Nest am Boden**.
  Die Küken schlüpfen nach 8 Tagen. Solange brütet die Gruppe in der Nähe des Nests.
- **Verhalten:** sucht Futter, flieht vor Räubern, brütet.

## Inselwolf

- **Vorbild:** Falklandfuchs (Warrah), der einzige heimische Landräuber der Falklandinseln, von
  Siedlern ausgerottet.
- **Gruppe:** Rudel mit bis zu 5 Tieren und festem Revier (Radius 420).
- **Beute:** vor allem Zwerghirsch, seltener Laufvogel. Frisst auch Aas. Wie sein Vorbild frisst er
  nebenher Insekten und Früchte, wenn er hungrig umherstreift. Das trägt ihn durch magere
  Zeiten, reicht aber nicht für Nachwuchs.
- **Jagd:** erst anschleichen, dann sprinten. Der Erfolg steigt mit der Zahl der Jäger und
  sinkt mit der Deckung, der Herdengröße und der Verfassung der Beute (ausgehungerte Tiere
  entkommen schlechter). Bevorzugte Opfer sind Jungtiere, schwache und alte Tiere. Ein erlegter
  Hirsch liefert 1,5 Energie (ein Laufvogel 0,6). Nach einem Riss ruht das Rudel nur, wenn es satt
  ist, sonst jagt es weiter. Gejagt wird unter 70 % Energie.
- **Fortpflanzung:** nur das älteste Paar des Rudels, 2–4 Welpen im Frühling, und nur wenn das
  Rudel gut genährt ist (≥ 60 %), ein eigenes Revier hat und noch nicht voll ist (höchstens 5).
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

Die Pflanzen können überweidet werden (siehe oben). Daraus ergibt sich, was die Räuber im
Ökosystem leisten: Sie halten die Pflanzenfresser unter der Grenze, an der die Weiden kaputtgehen.

Vergleich (`node tools/balance.js 8 30` und `… --ohne=inselwolf,inseladler`, mittlere Insel,
Bestände ab Jahr 10):

| | mit Räubern | ohne Räuber |
|---|---|---|
| Zwerghirsche, Jahr 2 | etwa 250 | etwa 370 (Massenvermehrung) |
| Zwerghirsche, Jahr 3–4 | etwa 250–300 | Zusammenbruch auf 80–130 (Hungersnot) |
| Zwerghirsche, danach | etwa 240, schwankend | etwa 210, viele verhungern jedes Jahr |
| Laufvögel | etwa 430 | etwa 490 |
| Zustand des Graslands | etwa 80 % | etwa 45 %, ein Drittel der Weiden kahl |

Ohne Räuber verläuft es wie auf dem Kaibab-Plateau: erst viel mehr Pflanzenfresser, dann
kahl gefressene Weiden, Hungersnot und auf Dauer *weniger* Pflanzenfresser auf schlechterem Land.

## Abstimmung (Stand)

`node tools/balance.js 8 30` rechnet 8 Inseln über 30 Jahre:

- mittlere Insel: in 8 von 8 Läufen überleben alle vier Arten
- kleine Insel: nur in 1 von 6 Läufen; Wölfe und Adler sterben meist nach 8–25 Jahren aus
