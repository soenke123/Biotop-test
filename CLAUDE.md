# CLAUDE.md

## Projekt

**Biotop**: Ökosystem-Simulation für den Biologieunterricht auf einer fiktiven Insel
(Neuseeland als Vorbild, mit fantasievollen Elementen). Die Lernenden programmieren nicht, sie
beobachten und greifen ein. Das Konzept mit den Ausbaustufen und der Begründung der
Architektur steht in `docs/KONZEPT.md`. **Vor größeren Änderungen lesen.**

Stand: Stufe 1 steht – Insel, Nahrungsfelder und vier Arten (Zwerghirsch, Laufvogel,
Inselwolf, Inseladler) mit Herden, Rudeln, Revieren, Nestern, Aas, Jahreszeiten.
**Vor jeder Arbeit an Tieren `data/arten.md` lesen** – dort stehen die Arten, ihre Werte und die
Mechanismen, die das Ökosystem stabil halten. Werte, die im Code geändert werden, wandern
zurück in die Datei.

Soll später ein Skill in MPSkills werden (wie Wild Clusters in `newTablet-Schulung`).

## Regeln

- **Kein Modulsystem, kein Build.** Klassische `<script>`-Tags, jede Datei eine IIFE, die an
  `BT` hängt. `import` scheitert unter `file://`. Die Ladereihenfolge in `index.html` ist die
  einzige Abhängigkeitsauflösung; eine neue Datei braucht auch einen Eintrag in `tools/load.js`.
- **Deterministisch:** Nur `BT.Rng` verwenden, nie `Math.random()` (Ausnahme:
  `BT.randomSeed()`). Jeder Generierungsschritt bekommt mit `rng.fork('name')` einen eigenen
  Sub-RNG, damit neue Schritte alte Seeds nicht verschieben.
- **Gleich auf jedem Gerät:** In `js/core`, `js/world`, `js/eco` kein `Math.sin/cos/atan2/exp/
  log/pow/hypot` – diese rundet jede Engine anders, und die Simulation läuft dann nach etwa
  einem Jahr auseinander. Stattdessen `BT.M.*` (`js/core/dmath.js`). Erlaubt sind die exakt
  festgelegten: `+ - * /`, `Math.sqrt/floor/ceil/round/min/max/abs/imul`.
- **Arten sind Daten:** Unterschiede zwischen Arten gehören in `BT.SPECIES`, nicht in
  artspezifischen Code. Das Verhalten (`js/eco/behavior.js`) gilt für alle.
- **Nach jeder Änderung an Arten oder Verhalten** `node tools/balance.js 8 30` laufen lassen.
  Ziel: mittlere Insel überlebt in den meisten Läufen mit allen Arten.
- **Raster als Wahrheit, Vektor als Bild:** `world.biome` hat genau einen Lebensraum pro
  Zelle. Gezeichnet werden geglättete Konturen (`js/render/shapes.js`), nie Zellen.
- **Modell ohne Darstellung:** `js/core`, `js/world` (und später `js/eco`) laufen in Node ohne
  DOM. Nur `js/render` und `js/ui` dürfen den Browser kennen.
- **Gelände wird später veränderbar** (Rodung, Acker, Dorf). Neue Logik nicht darauf bauen,
  dass `world.biome` nach der Generierung fest ist.

## Aufbau

```
js/core/    rng, noise, grid, geometry, contour     (aus Wild Clusters, WL -> BT)
js/world/   config.js (alle Stellschrauben, Lebensräume), island.js (Generator),
            decor.js (Streudetails), world.js (world-Objekt, query)
js/render/  palette, shapes (Konturen), camera, terrainRenderer (inkl. Reliefschattierung),
            seasonRenderer (Jahreszeiten als Farbschicht), plantRenderer (Weidezustand:
            entsättigt die Textur, abgefressen blasser, überweidet grau), sprites, agentRenderer (Tiere, Hervorhebung einer Art)
js/eco/     time (Kalender), species (Artentabelle, Nahrungsschichten), fields (Nahrung und
            Pflanzenzustand je Weidezelle, Überweidung), movement, behavior (Gruppen-Entscheidungen), stats, simulation (Tick/Tag)
js/ui/      app.js (Karte, Zeitregler, Seitenleiste, Bildpuffer, Großansicht der Diagramme),
            charts.js (LineChart; ChartView: gemeinsamer Zeitraum und Fadenkreuz)
data/       arten.md (fachliche Wahrheit für species.js)
assets/     Tierbilder (Platzhalter aus Wild Clusters)
tools/      load.js (Skripte in Node laden), smoketest.js, balance.js (Abstimmung),
            shot.js (Playwright-Screenshot, optional nach N simulierten Tagen)
```

Simulation: Entschieden wird je **Gruppe** (Herde, Rudel …), die Tiere folgen dem Anker der
Gruppe mit eigenem Versatz. Pro Tick: Verhalten, Bewegung, Fressen, Energie, Durst. Pro Tag:
Wachstum, Alter, Geburt, Nester, Abwanderung, Gruppen teilen/zusammenlegen, Statistik.

Generator-Reihenfolge in `island.js`: Form → Relief → Feuchte (ohne Gewässer) → Wasser
(Priority-Flood, Seen, Abfluss, Flüsse) → Feuchte (mit Gewässern) → Biome.

## Prüfen

```
node tools/smoketest.js 20
node tools/balance.js 8 30
node tools/balance.js 8 30 --ohne=inselwolf,inseladler   # Vergleich ohne Räuber
node tools/shot.js /tmp/x.png 482917 mittel 1 0.5 0.5 300 [inselwolf,inseladler]
```

`tools/shot.js` meldet Fehler aus der Browser-Konsole und endet dann mit Code 1. Nach
Änderungen an Generator oder Darstellung immer einen Screenshot ansehen.
