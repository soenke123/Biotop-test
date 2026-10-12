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
allein an ihnen – und über sie an den Wölfen. Auf der Karte verliert die Landschaft dort ihre
Farbe: abgefressene Flächen werden etwas blasser, überweidete grau und fahl. Die Textur bleibt
sichtbar, sie wird nur entsättigt (Auswahl „Karte“ oben, Standard „Weidezustand“). Dieselbe Auswahl zeigt auch jede Nahrungsschicht einzeln: abgefressen
braun, voll leicht grün – so sieht man z. B., wo die Laufvögel Früchte und Insekten leer fressen.

**Übernutzte Insekten:** Auch die Laufvögel können ihre Nahrung zerstören. Sie scharren den
Boden nach Larven und Puppen ab. Fällt der Insektenbestand einer ganzen Gegend (5 × 5
Weidezellen, also 120 × 120 Einheiten) in Sommer oder Herbst unter 30 % dessen, was eine gesunde
Gegend trägt, sinkt dort, wo gefressen wird, der Zustand der Insekten um 0,1 je Tag. Ein
durchziehender Trupp schadet also nicht, nur zu viele Vögel in der ganzen Gegend. Ist eine Gegend
einmal verarmt, schadet jedes weitere Fressen, und erholen kann sie sich erst nach 120 Tagen Ruhe
(um 0,006 je Tag, kahl nur zu 3 %).

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
- **Gruppe:** Rudel mit bis zu 6 Tieren und festem Revier (Radius 380).
- **Beute:** vor allem Zwerghirsch, Laufvögel nur selten. Frisst auch Aas. Wie sein Vorbild frisst er
  nebenher Insekten und Früchte, wenn er hungrig umherstreift. Das trägt ihn durch magere
  Zeiten, reicht aber nicht für Nachwuchs.
- **Jagd:** erst anschleichen, dann sprinten. Der Erfolg steigt mit der Zahl der Jäger und
  sinkt mit der Deckung, der Herdengröße und der Verfassung der Beute (ausgehungerte Tiere
  entkommen schlechter). Bevorzugte Opfer sind Jungtiere, schwache und alte Tiere. Ein erlegter
  Hirsch liefert 1,5 Energie (ein Laufvogel 0,6). Nach einem Riss ruht das Rudel nur, wenn es satt
  ist, sonst jagt es weiter. Gejagt wird unter 70 % Energie. Erfolg je Angriff und Jäger 0,32,
  Verbrauch 0,042 Energie am Tag.
- **Fortpflanzung:** nur das älteste Paar des Rudels, 2–4 Welpen im Frühling, und nur wenn das
  Rudel gut genährt ist (≥ 50 %), ein eigenes Revier hat und noch nicht voll ist (höchstens 6).
- **Mit Welpen mehr jagen** wurde ausprobiert (Jagd schon unter 85 % bzw. 76 % Energie, solange
  Welpen unter ½ Jahr im Rudel sind) und wieder abgeschaltet: Die Wölfe reißen dann mehr Hirsche,
  als sie brauchen, und sterben danach häufiger aus (in 48 Testläufen 4–6-mal statt 1–2-mal). Der
  Mechanismus steht noch im Code (`rearing` in der Artentabelle) und kann zum Experimentieren
  eingeschaltet werden.
- **Abwanderung:** Im Herbst verlassen junge Wölfe Rudel ab 4 Tieren (jeder mit 60 %). Wanderer suchen Artgenossen,
  schließen sich Rudeln an, denen ein Geschlecht fehlt, und gründen mit Partner ein Revier, wo
  Platz ist. Wanderer mit Partner steuern gezielt freien Platz an. Aus fremden Revieren werden
  Wanderer vertrieben und jagen dort nicht. Anders als bei Adlern ist das auch in der Natur so:
  Wolfsrudel verteidigen ihr ganzes Revier, und Kämpfe mit fremden Rudeln sind bei Wölfen eine
  der häufigsten natürlichen Todesursachen. Getestet wurde, Wanderer in den Randzonen fremder
  Reviere jagen zu lassen (außerhalb von 270 um die Reviermitte). Das war deutlich schlechter
  (35 statt 42 von 48 Läufen überleben).

## Inseladler

- **Vorbild:** Haastadler (Neuseeland, ausgestorben).
- **Gruppe:** Paar mit Revier (Radius 330), im Frühling und Sommer dazu die Küken im Horst.
- **Beute:** Laufvögel, junge Zwerghirsche (bis ½ Jahr). Sieht schlecht unter Bäume. Frisst Aas.
  Jagt unter 65 % Energie, verbraucht 0,03 Energie am Tag. Erfolg je Angriff und Jäger 0,3.
- **Horst:** Jedes Paar hat einen festen Horst nahe der Reviermitte, am liebsten auf Bäumen oder
  Felsen, und nutzt ihn jedes Jahr wieder. Auf der Karte ist er ein Reisignest, während der Brut
  mit Eiern.
  1. **Brut** (10 Tage ab Frühlingstag 1): Das Paar legt 2–3 Eier, wenn das Weibchen gut genährt
     ist (≥ 55 %, Chance 85 %). Ein Vogel sitzt immer im Horst, der andere jagt. Jede Beute wird
     zum Horst gebracht, dann wechseln sie sich ab. Sinkt der Brutvogel unter 25 % Energie oder
     stirbt ein Partner, wird das Gelege aufgegeben.
  2. **Nestlinge** (15 Tage): Die Küken sitzen im Horst, beide Eltern jagen und bringen jede Beute
     heim. Küken wachsen und brauchen viel (0,045 Energie am Tag zusätzlich). Verteilt wird so:
     erst fressen sich die Eltern bis 40 % satt, dann bekommen die Küken in der Reihenfolge des
     Schlüpfens, der Rest wird geteilt. In guten Jahren kommen alle Küken durch, in mageren nur das
     älteste. Hungern beide Eltern (unter 25 %), geben sie die Brut auf.
  3. **Flügge:** Danach fliegt jedes Junge allein los und sucht sich ein eigenes Revier.

  Am Horst jagen die Adler fast ununterbrochen (unter 95 % Energie) und erfolgreicher (× 1,3,
  sie kennen die Umgebung genau), aber nur im Umkreis von 300 um den Horst. Die Brutzeit fällt
  auf die Zeit, in der die Laufvögel ihre Küken haben.
- **Junge Adler ohne Revier (Floater)** werden geduldet, wie bei echten Steinadlern. Sie jagen
  überall, auch in fremden Revieren, und werden nur aus der Nähe eines fremden Horsts
  vertrieben (Umkreis 150). Bis sie erwachsen sind, jagen sie ungeübt (Jagderfolg × 0,6).
- **Konkurrenz:** Jagen andere Adler im Umkreis von 250 um die Beute, gelingt ein Angriff
  seltener (Erfolg geteilt durch 1 + 0,4 × Zahl der anderen Adler). Die Beute wird früher
  gewarnt, Beute wird streitig gemacht. Ohne diese Bremse sammeln sich in guten Jahren bis zu
  20 Floater an, fressen die Laufvögel leer und verhungern danach alle.
- **Revier gründen:** Junge Adler ohne Revier suchen einen Partner des anderen Geschlechts.
  Sie fliegen nur zu Artgenossen, denen genau ihr Geschlecht fehlt, und tun sich nie mit
  Artgenossen desselben Geschlechts zusammen. Hat ein Wanderer einen Partner, steuert das Paar
  gezielt freien Platz an. Ein junges Paar besetzt ein freies Revier
  und brütet, sobald beide erwachsen sind (2 Jahre). Wer ein Revier hat, verliert es erst nach
  einem Jahr ohne Partner. Höchstalter etwa 14 Jahre.
- **Trinkt nicht** (Wasser aus der Beute).

## Was das Ökosystem stabil hält

Diese Mechanismen sind bewusst eingebaut, weil sie auch in der Natur stabilisieren. Ohne sie
stirbt in der Simulation fast immer eine Art aus.

1. **Reviere:** Räuber ohne Revier dürfen nicht in fremden Revieren jagen und bekommen keinen
   Nachwuchs, volle Rudel auch nicht. Das begrenzt die Zahl der Räuber auf die Zahl der Reviere.
2. **Beutewechsel (Holling Typ III):** Wird eine Beuteart selten, wird sie seltener gewählt und
   seltener verfolgt. Die Räuber hungern dann, bevor die Beute verschwindet (Bezug: 80 % des
   Startbestands, `scarce` in der Artentabelle). Die vergebliche Suche nach seltener Beute kostet
   einen Tag – sonst würde ein hungriger Räuber es einfach gleich wieder versuchen.
3. **Rückzugsräume:** Im Wald werden Beutetiere schlechter entdeckt und erwischt.
4. **Aas:** Verhungerte Tiere und Reste von Rissen ernähren die Räuber in schlechten Zeiten.
5. **Fortpflanzung je nach Futterlage:** Hungrige Räuber bekommen keinen Nachwuchs.
6. **Inselgröße:** Auf einer kleinen Insel sind die Räuberbestände so klein, dass Pech reicht,
   um sie auszulöschen.
7. **Allesfresser-Räuber:** Der Inselwolf überbrückt magere Jahre mit Insekten und Früchten.

## Wozu die Räuber da sind

Das System ist so gebaut, dass es **nur mit allen Arten zusammen** funktioniert. Weiden und
Insektenbestände können übernutzt werden und erholen sich dann jahrelang nicht.

- Ohne Wölfe vermehren sich die Hirsche, bis sie ihre Weiden zerstören.
- Ohne Adler (und Wölfe) vermehren sich die Laufvögel, bis sie die Insekten ganzer Gegenden
  ausgeräumt haben. Danach überlebt nur ein Rest – weniger als mit Räubern.

Vergleich (`node tools/balance.js 8 30` und `… --ohne=inselwolf,inseladler`, mittlere Insel,
Mittel ab Jahr 10):

| | mit Räubern | ohne Räuber |
|---|---|---|
| Zwerghirsche, Jahr 2–3 | etwa 100–200 | etwa 310–400 (Massenvermehrung) |
| Zwerghirsche, ab Jahr 10 | etwa 130, schwankend | etwa 115, viele sterben an Hunger |
| Laufvögel, Jahr 3–4 | etwa 250–350 | etwa 500–640 (Massenvermehrung) |
| Laufvögel, ab Jahr 10 | etwa 260 | etwa 120 (Insekten ausgeräumt) |
| Zustand Grasland / Laub / Insekten | etwa 87 % / 97 % / 80 % | etwa 27 % / 68 % / 42 % |
| alle Arten überleben | 7 von 8 Läufen | – |

Ohne Räuber verläuft es wie auf dem Kaibab-Plateau: erst viel mehr Pflanzenfresser, dann
kahl gefressene Weiden, ausgeräumte Böden und Hungersnot. Die Insel bleibt danach verarmt, weil
die übrigen Tiere Weiden und Böden nie lange genug schonen.

Mit Räubern sieht man eine **Kaskade**: Werden die Wölfe in einem Jahr knapp, steigen die
Hirsche, das Grasland leidet. Erholen sich die Wölfe, sinken die Hirsche, und die Weiden heilen
über Jahre. Stirbt das Wolfsrudel aus, kippt die Insel in den kahlen Zustand. Ebenso hängen
Adler, Laufvögel und Insekten zusammen.

## Abstimmung (Stand)

**Floater, Konkurrenz, Partnersuche** (48 Inseln, gleiche Läufe wie unten):

- alle Arten überleben: 42 von 48 (wie vorher); Adler sterben aus: 4-mal (wie vorher), alle erst
  nach Jahr 16, meist nach Jahr 27
- Adler im Mittel 13–16, Laufvögel 230–250, Zustand der Insekten 89–93 %
- Größere Adlerreviere (400 statt 330) oder stärkere Konkurrenz (0,7) brachten keine Verbesserung,
  die Unterschiede lagen im Zufallsrauschen.
- Die Simulation ist chaotisch: Ob eine Art auf einer Insel ausstirbt, hängt stark vom Zufall
  ab. Unterschiede von 1–2 Läufen in 48 sind kein Beleg.

**Horst-System der Adler** (48 Inseln über 30 Jahre: `balance.js 8 30`, `16 30 --seed=5000`,
`24 30 --seed=9000`; vorher → nachher):

- alle Arten überleben: 42 → 43 von 48; Adler sterben aus: 4 → 4-mal (kein messbarer Unterschied)
- Adler im Mittel ab Jahr 10: 12 → 13–15; Laufvögel 260 → 250–256; Zustand der Insekten
  80 % → 88 % (Standardlauf); Hirsche 127 → 95 (Standardlauf, die übrigen Läufe ~105 wie vorher)
- Erste Fassung (Küken ohne Mehrbedarf): Die Adler verdoppelten sich in 3 Jahren, fraßen die
  Laufvögel herunter und brachen ein. Erst seit der Bruterfolg vom Futter abhängt, bleibt es ruhig.
- Junge Adler ohne Revier überall jagen lassen (nur der Kern um den Horst verteidigt) war deutlich
  schlechter: Die Adler starben in 12 von 24 Läufen aus.

Älterer Stand:

`node tools/balance.js 8 30` rechnet 8 Inseln über 30 Jahre:

- mittlere Insel: in 7 von 8 Läufen überleben alle vier Arten (vorher 6 von 8). Mittlere
  Bestände ab Jahr 10: Hirsche ~127 (schwankend etwa 35–370), Laufvögel ~260, Wölfe ~20 (vorher
  13), Adler ~12. Die Wölfe reißen mehr Hirsche, die Weiden bleiben dadurch gesünder (Gras 87 %
  statt 73 %); auf gesunden Weiden kommen aber auch mehr Kälber durch, deshalb sinkt die mittlere
  Hirschzahl kaum.
- Hungrigere Adler (Verbrauch 0,035–0,045) verhungerten in den Tests, sobald sie die Laufvögel
  dezimiert hatten. Stärker wirken sie deshalb über den Jagderfolg (0,22 → 0,3), nicht über Hunger.
- kleine Insel (`--size=klein`): wie vorher nur in 1 von 6 Läufen; meist sterben die Wölfe
  nach 8–29 Jahren aus, in 2 Läufen rotten die stärkeren Wölfe zuvor die Zwerghirsche aus
  (vorher 1). Die kleine Insel ist zu klein für stabile Räuberbestände.
