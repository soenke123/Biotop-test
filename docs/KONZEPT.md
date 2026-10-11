# Biotop – Konzept

Stand: Entwurf zur gemeinsamen Planung. Alle Zahlen sind Platzhalter, keine kalibrierten Daten.

## 1. Die Idee in einem Satz

Eine fiktive, große Insel mit einem funktionierenden Ökosystem. Erst beobachtet man es ungestört,
dann kommen Siedler, und man sieht, was ihr Handeln auslöst.

**Zielgruppe:** Biologieunterricht. Die Lernenden programmieren nicht, sie beobachten,
verändern Startwerte und greifen ein. Umgesetzt wird alles in JavaScript im Browser,
lauffähig auf Schul-Tablets und am Beamer.

**Anspruch:** Das Modell soll *qualitativ* realistisch sein. Richtungen, Zeitverzögerungen und
Kaskaden sollen stimmen. Es soll *nicht quantitativ* vorhersagen, wie viele Füchse es auf
einer echten Insel gäbe.

## 2. Die vier Ausbaustufen

| Stufe | Inhalt | Was man im Unterricht tut |
|---|---|---|
| **1 Insel und Ökosystem** | Generierte Insel, Pflanzen, Pflanzenfresser, Räuber; stabil über Jahrzehnte | Beobachten: Wer lebt wo? Wie schwanken die Bestände? |
| **2 Experimentieren** | Startwerte und Parameter änderbar, Vergleichsläufe, Diagramme, CSV-Export | Hypothese → Lauf → Vergleich |
| **3 Siedler** | Ein kleines Dorf entsteht; Störung, Abfall, Haustiere; Kulturfolger und Kulturflüchter | Welche Arten profitieren, welche weichen aus? |
| **4 Landnutzung** | Viehhaltung, Ackerbau, Jagd, Rodung, Auswilderung fremder Arten | Eingriff → Folgen über Jahre messen |

Gebaut werden jetzt die Stufen 1 und 2. Die Stufen 3 und 4 bestimmen aber schon heute die
Architektur (siehe Abschnitt 7), damit später nichts umgebaut werden muss.

## 3. Die Insel

Fiktiv, gemäßigtes Klima und mitteleuropäische Arten. Dadurch ist sie für den Biologieunterricht
anschlussfähig, und die Tierbilder aus Wild Clusters lassen sich verwenden. Eine Insel ist
**abgeschlossen**: Es gibt keine Zu- oder Abwanderung, jede Veränderung ist hausgemacht.

### Erzeugung

Die Karte entsteht aus einem Seed (gleicher Seed = gleiche Insel), in drei Schichten:

1. **Höhe**: Rauschen mal radialem Abfall ergibt die Küstenlinie, dazu ein Hügel- oder Bergzug.
2. **Feuchte**: Abstand zu Wasser, Höhe und Rauschen.
3. **Lebensraum** aus Höhe und Feuchte:

| Lebensraum | Lage | Rolle im Ökosystem |
|---|---|---|
| Meer | außen | Grenze, unpassierbar |
| Strand, Dünen | Küste | karg, Übergangszone |
| Grasland, Wiese | tief, mittel feucht | viel Gras: Hauptnahrung der Kaninchen |
| Laubwald | mittel | Laub, Triebe, Früchte; Deckung |
| Nadelwald / Berg | hoch | wenig Nahrung, Rückzugsraum |
| Feuchtgebiet, Moor | feucht, tief | Kleinsäuger, Wasser |
| Seen, Bach | Senken | **Wasser als Bedarf** (Durst) |
| Fels | sehr hoch | ohne Nahrung, Bau- und Versteckplätze |

Das Mosaik ist entscheidend: **Rückzugsräume und Übergänge stabilisieren Räuber-Beute-Systeme.**
Auf einer gleichförmigen Fläche stirbt fast immer eine Art aus. Die Landschaft ist damit keine
Dekoration, sondern Teil des Modells.

### Herkunft aus Wild Clusters

Aus `newTablet-Schulung/MPSkills/tools/wildclusters` übernehmen wir:

- `core/` (Zufallsgenerator mit Seed-Forks, Rauschen, Raster, Konturglättung, Geometrie)
- den Gelände-Renderer mit weichen Umrissen, Kamera (Zoom, Pan), Palette und Tierbilder
- die Prinzipien: Raster als Wahrheit und Vektor als Bild, ein Sub-RNG pro Schritt,
  Regeln an genau einer Stelle, kein Build und `index.html` per Doppelklick,
  Vorschau-Werkzeug in Node

Neu gebaut werden:

- der Inselgenerator (Höhe und Feuchte statt Teiche auf einem Rechteck)
- veränderliches Gelände (nötig für Stufe 4)
- die gesamte Simulation, denn Wild Clusters spielt 5 Tage Verhalten ohne Geburt und Tod ab,
  wir brauchen dagegen Jahrzehnte Populationsdynamik

## 4. Das Ökosystem

### Zwei Arten von Lebewesen

- **Felder** (ein Wert pro Rasterzelle): Pflanzen und sehr kleine, sehr zahlreiche Tiere.
  Sie wachsen und werden abgefressen.
- **Agenten** (einzelne Tiere): alles, was man auf der Karte sehen und anklicken will.

Diese Trennung macht große Bestände im Browser überhaupt erst möglich.

### Nahrungsnetz für Stufe 1 (Vorschlag)

```
            Luchs ─────────┐               Fuchs (Generalist)
              │            │             ╱    │     ╲
              ▼            ▼            ▼     ▼      ▼
             Reh       (Kaninchen) ◀── Kaninchen  Mäuse (Feld)  Beeren
              │                         │           │
              ▼                         ▼           ▼
       Triebe / Laub (Feld)        Gras (Feld)   Samen (Feld)
```

| Art | Typ | Lebensraum | Besonderheit |
|---|---|---|---|
| Gras, Kräuter | Feld | Wiese, Waldrand | wächst schnell |
| Triebe, Laub | Feld | Wald | wächst langsam, Reh-Nahrung |
| Samen, Beeren | Feld | Wald, Feuchtgebiet | saisonal |
| Mäuse | Feld | Wiese, Feuchtgebiet | Puffer-Beute für den Fuchs |
| Kaninchen | Agent | Wiese mit Deckung in der Nähe | Bau als Rückzugsort, schnelle Vermehrung |
| Reh | Agent | Wald, Waldrand | langsame Vermehrung |
| Fuchs | Agent | überall | Generalist: Kaninchen, Mäuse, Beeren; Revier |
| Luchs | Agent | Wald, Berg | Spezialist auf Reh, großes Revier, wenige Tiere |

Für die Stabilität ist der **Generalist** wichtig: Gibt es wenige Kaninchen, frisst der Fuchs
Mäuse und Beeren, statt mit den Kaninchen unterzugehen. Das ist echte Ökologie und ein gutes
Unterrichtsthema.

Vorgehen: zuerst **Gras, Kaninchen und Fuchs** stabil bekommen, dann eine Art nach der anderen
dazunehmen, jeweils mit Abstimmung (wie in Wild Clusters: besprechen → Parameter → Test →
ansehen → nachjustieren).

### Zeit

- **1 Tick = 1 Tag.** Ein Lauf umfasst 20–50 Jahre, also etwa 7.000–18.000 Ticks.
- **Jahreszeiten** über einen einfachen Jahresfaktor: Pflanzenwachstum, Fortpflanzung nur in
  der Fortpflanzungszeit, Winter als Engpass. Das kostet wenig und macht das Modell deutlich
  realistischer, weil Zyklen und Engpässe so überhaupt erst entstehen.
- Tag und Nacht werden nicht simuliert, sondern höchstens dargestellt.

### Regeln je Tier (für alle Arten gleich, nur die Parameter unterscheiden sich)

Jeden Tick in zufälliger, aber über den Seed festgelegter Reihenfolge:

1. **Gefahr** in Sichtweite → fliehen, Deckung oder Bau bevorzugen.
2. **Durst** über der Schwelle → zum nächsten Wasser.
3. **Hunger** über der Schwelle → Nahrung im Streifgebiet suchen (Feld abgrasen oder Beute jagen).
4. Sonst → im Streifgebiet oder Revier umherziehen.

Dazu kommen Energiehaushalt, Alter, Fortpflanzung (Saison, Energie, Partner in der Nähe) und
Tod mit festgehaltener **Ursache**: Hunger, Durst, Alter, Räuber, Winter, später auch Jagd,
Verkehr oder Krankheit.

Jagd gelingt nur mit einer Wahrscheinlichkeit, die von Deckung, Zustand der Beute und Art abhängt.

## 5. Stufe 2: Experimentieren

- **Startwerte:** Anzahl je Art, Pflanzenwachstum und einige Kernparameter
  (Vermehrungsrate, Jagderfolg, Energiebedarf).
- **Vorgefertigte Szenarien** mit erprobten Seeds: „Ausgeglichen“, „Zu viele Füchse“,
  „Kein Luchs“, „Strenger Winter“.
- **Vergleich:** zwei Läufe nebeneinander bzw. übereinander im Diagramm.
- **Schnelllauf ohne Animation** (Jahre in Sekunden), anschließend die Diagramme ansehen.
- **Auswertung:** Bestandskurven je Art, Todesursachen, Verteilung über die Lebensräume,
  Pflanzenmenge, CSV-Export.

Die Oberfläche bleibt einfach: Karte, Zeitsteuerung, Diagramm. Expertenparameter werden versteckt
und nur bei Bedarf aufgeklappt.

## 6. Ausblick auf die Stufen 3 und 4 (nur Planung)

| Eingriff | Mechanismus im Modell |
|---|---|
| Dorf | Zellen werden „bebaut“; Störungsradius; Abfall als Nahrungsfeld |
| Kulturfolger / -flüchter | Art-Merkmal `stoerungstoleranz` und `nutztAbfall`; daraus folgt Verhalten, nicht ein festes Ergebnis |
| Viehhaltung | Weide-Zellen, Weidetiere als Feld, die Gras fressen; Räuber reißen Vieh → Konflikt |
| Ackerbau | Acker-Zellen: viel Nahrung in der Saison, kahl nach der Ernte, keine Deckung |
| Jagd | zusätzliche Sterblichkeit mit Ursache „Jagd“, wählbar nach Art und Gebiet |
| Rodung | Wald → Grasland oder bebaut; Laub und Deckung verschwinden |
| Auswilderung fremder Arten | neue Art aus der Artentabelle aussetzen, z. B. Waschbär, Ratte, Wildkatze |

Ob der Mensch über Werkzeuge (Lehrkraft klickt) oder automatisch (das Dorf wächst nach Regeln)
eingreift, entscheiden wir in Stufe 3. Die Architektur erlaubt beides.

## 7. Architektur

### Entscheidungen, die die Stufen 3 und 4 schon jetzt erfordern

1. **Gelände in Schichten:** `natur` (Lebensraum aus der Generierung) und `nutzung`
   (Mensch: bebaut, Acker, Weide, gerodet). Die Lebensraumqualität wird aus beiden berechnet
   und bei Änderung neu bestimmt. Die Umrisse werden nur für die geänderte Region neu gezeichnet.
2. **Arten als Daten, nicht als Code:** eine Artentabelle mit Merkmalen (Nahrung, Lebensräume,
   Tempo, Sichtweite, Vermehrung, Störungstoleranz …) und *ein* gemeinsames Verhaltensmodell.
   Neue und fremde Arten in Stufe 4 sind dann ein neuer Tabelleneintrag. (Wild Clusters hat
   500–1.700 Zeilen pro Art. Das skaliert für unser Ziel nicht.)
3. **Sterblichkeit und Störungen als einsteckbare Quellen:** Hunger, Räuber, Winter … später
   Jagd, Verkehr, Gift. Jede Quelle meldet ihre Todesfälle mit Ursache an die Statistik.
4. **Modell ohne Darstellung:** Die Simulation läuft auch in Node ohne Browser. Das ist die
   Voraussetzung für Schnelllauf, Tests und das Abstimmen.
5. **Deterministisch:** ein Seed, Sub-RNGs je Schritt, kein `Math.random()`.

### Werkzeug zum Abstimmen (wichtigster Baustein)

Ein Node-Skript, das z. B. 20 Seeds × 30 Jahre ohne Grafik rechnet und meldet: Wie viele Läufe
haben alle Arten überlebt? Wie stark schwanken die Bestände? Gibt es den Zeitversatz zwischen
Beute und Räuber? Ohne dieses Werkzeug ist ein „ausgeglichenes Ökosystem“ Glückssache.

### Struktur (Entwurf)

```
index.html
js/
  core/      rng, noise, grid, contour, geometry      (aus Wild Clusters)
  world/     island.js (Höhe, Feuchte, Lebensraum), layers.js (natur/nutzung), rules.js
  eco/       species.js (Tabelle), fields.js (Pflanzen, Mäuse), agents.js (Verhalten),
             mortality.js, seasons.js, simulation.js (Tick), stats.js
  render/    terrain, agents, camera, palette        (an Wild Clusters angelehnt)
  ui/        app, controls, charts, scenarios
tools/       balance.js (Abstimmung), preview.js (PNG), tests
data/        arten.md (fachliche Wahrheit für species.js, wie tiere.md in Wild Clusters)
```

## 8. Risiken (ehrlich)

| Risiko | Gegenmittel |
|---|---|
| Das Ökosystem kippt (eine Art stirbt aus) | Lebensraummosaik, Rückzugsorte, Generalisten, Abstimmwerkzeug; Aussterben in einzelnen Läufen akzeptieren und thematisieren |
| „Die Simulation zeigt nur, was wir programmiert haben“ | Mechanismen modellieren, nicht Ergebnisse; Annahmen in `data/arten.md` offenlegen |
| Leistung auf Tablets | Felder statt Agenten für Kleinstlebewesen, Obergrenzen, Schnelllauf ohne Zeichnen |
| Jede neue Art erschwert die Abstimmung | Arten einzeln hinzufügen, jeweils neu abstimmen |
| Zu viele Regler überfordern im Unterricht | Szenarien statt Parameterwüste |

## 9. Offene Entscheidungen

1. Artenliste für Stufe 1: passt Gras / Kaninchen / Fuchs + Reh / Luchs + Mäuse?
   Oder lieber Wolf statt Luchs (bekannter, aber Rudel sind aufwendiger)?
2. Inselgröße und Bestände: Richtwert ein paar hundert bis wenige tausend sichtbare Tiere?
3. Darstellung über Jahre: Tiere als Punkte/Bilder mit Sprüngen pro Tag, oder ruhiger,
   z. B. nur alle paar Tage aktualisiert?
4. Laufzeitumgebung: Soll Biotop später auch als Skill in MPSkills laufen wie Wild Clusters?
   (Das hätte Folgen für Struktur und Lehrkraft-Steuerung.)
