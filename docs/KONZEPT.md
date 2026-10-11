# Biotop – Konzept einer Räuber-Beute-Simulation mit menschlichen Eingriffen

Stand: Entwurf zur gemeinsamen Planung. Alle Zahlenwerte sind Platzhalter für einen
Prototyp, keine biologisch kalibrierten Daten.

## 1. Ziel und Abgrenzung

Eine browserbasierte Simulation für den Informatikunterricht. Auf einer Pixel-Art-Karte
leben Pflanzen, Hasen und Füchse. Der Mensch greift über Werkzeuge ein, zum Beispiel durch
Rodung, Entnahme oder Aussetzen von Tieren. Die Lernenden messen die Folgen.

**Das Projekt soll:**

- ein einfaches, nachvollziehbares Nahrungskettenmodell abbilden: Pflanze → Hase → Fuchs.
- menschliche Eingriffe ermöglichen und protokollieren.
- reproduzierbare Experimente erlauben (fester Zufalls-Seed).
- Ergebnisse als Diagramme und Zahlen liefern.

**Das Projekt soll nicht:**

- ein Spiel mit Punkten, Zielen oder einer Story sein.
- reale Ökosysteme quantitativ vorhersagen. Es ist ein Denkmodell.
- in Version 1 Jahreszeiten, Krankheiten, Genetik oder weitere Arten enthalten.

**Realistische Erwartung:** Agentenbasierte Räuber-Beute-Modelle erzeugen nicht automatisch
die bekannten Lotka-Volterra-Schwingungen. Häufig stirbt eine Art schnell aus. Die Parameter
müssen deshalb abgestimmt werden, und auch ein Aussterben ist ein gültiges Ergebnis, das
man im Unterricht besprechen kann.

## 2. Welt

### Karte

- Kachelkarte von oben, zum Start 60 × 40 Kacheln.
- Biome bilden zusammenhängende Flächen, keine zufällig verteilten Einzelkacheln.
- Feste Startkarte als Standard, damit Klassen vergleichbare Ausgangslagen haben.
  Ein Kartengenerator kann später hinzukommen.

### Geländetypen (Version 1)

| Gelände | Pflanzenwachstum | Deckung für Hasen | Begehbar | Bemerkung |
|---|---|---|---|---|
| Wiese | hoch | gering | ja | Hauptnahrungsquelle der Hasen |
| Wald | mittel | hoch | ja | Füchse entdecken Hasen schwerer |
| Ufer | mittel | mittel | ja | Übergang zum See |
| See | keins | – | nein | Hindernis |
| Acker | einstellbar | gering | ja | vom Menschen angelegt |
| Bebaut / Straße | keins | keine | ja, mit Risiko | entsteht nur durch Eingriffe |

Wasser ist in Version 1 nur ein Hindernis. Durst als eigener Bedarf ist eine mögliche
spätere Erweiterung. Trockenland aus den ersten Überlegungen ist durch Acker ersetzt und
kann als Erweiterung zurückkommen.

## 3. Lebewesen

### Pflanzen: Wert pro Kachel, keine einzelnen Objekte

Jede Kachel hat einen Wert `biomasse` zwischen 0 und `maxBiomasse(gelände)`.

- Wachstum pro Tick: `biomasse += wachstumsrate(gelände) * (max - biomasse)`
  (logistisch: wächst langsam, wenn fast leer oder fast voll).
- Hasen fressen Biomasse von ihrer Kachel ab.
- Sinkt die Biomasse auf 0, wächst sie nur langsam oder durch Ausbreitung von Nachbarkacheln nach.

Begründung: Tausende Pflanzenobjekte bringen didaktisch wenig und kosten Rechenzeit.

### Tiere: Hase und Fuchs

Gemeinsame Eigenschaften: `position`, `energie`, `alter`, `id`.

| | Hase | Fuchs |
|---|---|---|
| Nahrung | Pflanzenbiomasse | Hasen |
| Sichtweite | klein | mittel, im Wald reduziert |
| Bewegung pro Tick | 1 Kachel | 1–2 Kacheln |
| Besonderes | flieht, nutzt Deckung | Jagd gelingt nur mit Wahrscheinlichkeit |

**Verhalten als einfache Prioritätenliste** (kein komplexer Zustandsautomat nötig):

Hase:
1. Fuchs in Sichtweite → von ihm weg bewegen, Deckung bevorzugen.
2. Hungrig → zur besten Pflanzenkachel in Sichtweite gehen und fressen.
3. Sonst → zufällig umherlaufen.

Fuchs:
1. Hase in Sichtweite → auf ihn zu bewegen; auf derselben Kachel Jagdversuch.
2. Sonst → zufällig umherlaufen.

## 4. Regeln und Ablauf eines Ticks

Ein Tick entspricht einem simulierten Tag.

1. **Eingriffe anwenden**: Aktionen des Menschen aus der Warteschlange.
2. **Pflanzen wachsen**.
3. **Tiere handeln**: Die Reihenfolge wird jeden Tick mit dem Seed-Zufallsgenerator gemischt,
   damit nicht immer dieselben Tiere zuerst handeln.
4. **Energieverbrauch**: Grundbedarf und zusätzlicher Bedarf für Bewegung.
5. **Fortpflanzung**: Wenn `energie > schwelle`, entsteht mit Wahrscheinlichkeit p ein
   Jungtier auf einer Nachbarkachel. Das Elterntier gibt Energie ab.
6. **Tod**: bei `energie <= 0` oder `alter > maxAlter`.
7. **Statistik erfassen**.

Kernregeln:

| Prozess | Regel |
|---|---|
| Fressen (Hase) | nimmt bis zu X Biomasse und erhält Energie proportional dazu |
| Jagd (Fuchs) | Erfolg mit `jagderfolg * (1 - deckung(gelände))` |
| Energieverbrauch | fester Grundbedarf pro Tick plus Kosten pro bewegter Kachel |
| Fortpflanzung | Energieschwelle, Wahrscheinlichkeit und Mindestalter |
| Tod | Energie aufgebraucht oder Höchstalter erreicht |
| Abwanderung | ergibt sich aus der Nahrungssuche, keine eigene Regel |

## 5. Menschliche Eingriffe

Der Mensch tritt in Version 1 nicht als Figur auf, sondern über Werkzeuge. Jeder Eingriff
wird mit Tick, Art, Ort und Umfang im Eingriffsprotokoll gespeichert.

| Werkzeug | Wirkung |
|---|---|
| Roden | Wald → Wiese oder Acker, Biomasse wird reduziert |
| Bebauen / Straße | Kachel → bebaut, keine Pflanzen; Straße mit Todesrisiko beim Überqueren |
| Tiere entnehmen | N Hasen oder Füchse in einem Bereich entfernen (Jagd) |
| Tiere aussetzen | N Hasen oder Füchse an einer Stelle hinzufügen |
| Renaturieren | Kachel kehrt zum ursprünglichen Biom zurück; Biomasse beginnt bei 0 und wächst verzögert |
| Acker bewirtschaften | Ernte setzt die Biomasse periodisch auf 0 |
| Pestizid (optional) | Biomasse eines Bereichs sinkt; Hasen dort verlieren zusätzlich Energie |

Pestizide wirken in der Realität komplex. Im Modell wird bewusst nur der oben genannte
vereinfachte Effekt abgebildet, und das sollte im Unterricht auch so benannt werden.

## 6. Parameter

Alle Parameter liegen zentral in einer Konfigurationsdatei und sind in der Oberfläche
einstellbar.

| Gruppe | Parameter | Startwert (Platzhalter) |
|---|---|---|
| Welt | Kartengröße | 60 × 40 |
| Welt | Zufalls-Seed | 42 |
| Pflanzen | Wachstumsrate je Gelände | Wiese 0.10, Wald 0.05, Ufer 0.07, Acker 0.08 |
| Pflanzen | Maximale Biomasse je Gelände | 10 |
| Hase | Startanzahl | 80 |
| Hase | Energie pro Biomasse | 1 |
| Hase | Grundbedarf pro Tick | 0.5 |
| Hase | Fortpflanzungsschwelle / -wahrscheinlichkeit | 8 / 0.3 |
| Hase | Höchstalter | 300 |
| Fuchs | Startanzahl | 15 |
| Fuchs | Jagderfolg | 0.35 |
| Fuchs | Energie pro Hase | 10 |
| Fuchs | Grundbedarf pro Tick | 0.4 |
| Fuchs | Fortpflanzungsschwelle / -wahrscheinlichkeit | 20 / 0.05 |
| Fuchs | Höchstalter | 600 |
| Gelände | Deckung | Wiese 0.0, Wald 0.6, Ufer 0.3, Acker 0.1 |

## 7. Benutzeroberfläche

Drei Bereiche:

1. **Karte** (Canvas, etwa 2/3 der Breite): Gelände, Biomasse als Farbabstufung, Tiere als
   Sprites. Ein Klick auf ein Tier zeigt seine Werte, ein Klick auf eine Kachel ihre Werte.
2. **Steuerung und Werkzeuge**: Start, Pause, Einzelschritt, Geschwindigkeit, Neustart, Seed,
   Parameter, Werkzeugauswahl für Eingriffe.
3. **Auswertung**: Populationskurven, Biomasse, Lebensraumfläche je Biom und Eingriffsprotokoll.
   Eingriffe erscheinen als senkrechte Markierungen in den Kurven.

## 8. Auswertung

Messgrößen pro Tick: Anzahl Hasen, Anzahl Füchse, Gesamtbiomasse, Fläche je Geländetyp,
Tiere je Biom, Geburten, Todesfälle nach Ursache (Hunger, Alter, Jagd, Mensch, Straße).

Abgeleitete Kennzahlen:

- Aussterbezeitpunkt je Art
- Schwankungsbreite (Minimum, Maximum, Standardabweichung) über ein Zeitfenster
- Erholungszeit nach einem Eingriff
- Zeitversatz zwischen den Spitzen der Hasen- und Fuchspopulation

Export: CSV-Datei mit Zeitreihen und Eingriffsprotokoll, damit eine Auswertung auch in einer
Tabellenkalkulation möglich ist.

Weil der Zufall eine Rolle spielt, sollte jeder Versuch mit mehreren Seeds wiederholt werden.
Eine Batch-Funktion für „N Läufe ohne Animation“ ist dafür nützlich.

### Beispielexperimente

| Experiment | Leitfrage |
|---|---|
| Ohne Eingriff, mehrere Seeds | Wie stark schwanken die Bestände? Stirbt eine Art aus? |
| Füchse entnehmen | Was passiert mit Hasen und Pflanzen, kurz- und langfristig? |
| 20 vs. 100 Hasen aussetzen | Gibt es eine Tragfähigkeitsgrenze? |
| 50 % des Waldes roden | Wie verändern sich Verteilung und Jagderfolg? |
| Straße durch die Wiese | Welche Wirkung hat eine Zerschneidung des Lebensraums? |
| Renaturierung nach Rodung | Wie lange dauert die Erholung, und gelingt sie überhaupt? |

## 9. Unterrichtseinsatz (Use – Modify – Create)

- **Use**: vorgegebene Welt starten, Kurven beobachten, Hypothesen formulieren.
- **Modify**: Parameter und Eingriffe verändern, mit dem Ausgangslauf vergleichen.
- **Create**: Code erweitern, zum Beispiel durch eine neue Art, ein neues Werkzeug oder eine
  neue Verhaltensregel, und die Erweiterung mit Messdaten überprüfen.

Informatikbezug: Objektorientierung (Klassen für Tiere und Welt), Algorithmen (Suche, Flucht),
Zufall und Reproduzierbarkeit (Seed), Datenstrukturen (Gitter, Listen), Visualisierung,
Trennung von Modell und Darstellung.

## 10. Technische Architektur

HTML, CSS und JavaScript (ES-Module), Canvas für die Karte, keine Build-Tools und keine
externen Bibliotheken in Version 1.

```
src/
  config.js        Parameter und Startwerte
  rng.js           Zufallsgenerator mit Seed
  model/
    world.js       Gitter, Kacheln, Geländetypen
    animal.js      gemeinsame Basis
    hare.js
    fox.js
    simulation.js  Tick-Ablauf, Eingriffswarteschlange
    interventions.js
    statistics.js
  view/
    renderer.js    Canvas-Darstellung
    charts.js      Diagramme
    ui.js          Steuerung, Werkzeuge
index.html
```

Grundregeln:

- Das Modell (`model/`) kennt die Darstellung nicht und läuft auch ohne Browser.
  Das ermöglicht Tests und Batch-Läufe.
- Ein Einzelschritt berechnet genau einen Tick. Die Animationsgeschwindigkeit verändert nur
  die Darstellung, nicht das Modell.
- Sämtlicher Zufall läuft über `rng.js`. Gleicher Seed plus gleiche Eingriffe ergeben dasselbe Ergebnis.

## 11. Umfang und Reihenfolge

| Meilenstein | Inhalt |
|---|---|
| M1 Modell | Gitter, Pflanzen, Hasen, Füchse, Tick-Ablauf, Seed; Konsolenausgabe der Bestände |
| M2 Darstellung | Canvas-Karte mit einfachen Farbkacheln, Steuerung (Start, Pause, Schritt) |
| M3 Auswertung | Populationskurven, CSV-Export |
| M4 Eingriffe | Werkzeuge, Eingriffsprotokoll, Markierungen in den Kurven |
| M5 Abstimmung | Parameter so einstellen, dass die Ausgangswelt meist mehrere hundert Ticks besteht |
| M6 Pixel-Art | Sprites und Tilesets statt Farbflächen |
| Später | Jahreszeiten, Durst, weitere Arten, Kartengenerator, Batch-Läufe |

Pixel-Art kommt bewusst spät. Zuerst muss das Modell funktionieren.

## 12. Offene Entscheidungen

1. Zielgruppe und Programmiersprache: Sollen die Lernenden selbst in JavaScript programmieren,
   oder ist eine andere Sprache gesetzt, zum Beispiel Python oder Java?
2. Dürfen mehrere Tiere auf einer Kachel stehen? (Vorschlag: ja, mit einer Obergrenze.)
3. Grafiken: selbst erstellen oder freie Assets mit passender Lizenz (z. B. CC0) verwenden?
4. Soll Wasser schon in Version 1 ein Bedarf sein oder nur ein Hindernis?
5. Feste Karte oder Kartengenerator für Version 1?
