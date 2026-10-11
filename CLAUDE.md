# CLAUDE.md

## Projekt

**Biotop**: Ökosystem-Simulation für den Biologieunterricht auf einer fiktiven Insel
(Neuseeland als Vorbild, mit fantasievollen Elementen). Die Lernenden programmieren nicht, sie
beobachten und greifen ein. Das Konzept mit den Ausbaustufen und der Begründung der
Architektur steht in `docs/KONZEPT.md`. **Vor größeren Änderungen lesen.**

Stand: Inselgenerator und Darstellung. Simulation folgt (Stufe 1: Pflanzen → Zwerghirsch
(Herde) → Inselwolf (Rudel), danach Laufvogel, Inseladler).

Soll später ein Skill in MPSkills werden (wie Wild Clusters in `newTablet-Schulung`).

## Regeln

- **Kein Modulsystem, kein Build.** Klassische `<script>`-Tags, jede Datei eine IIFE, die an
  `BT` hängt. `import` scheitert unter `file://`. Die Ladereihenfolge in `index.html` ist die
  einzige Abhängigkeitsauflösung; eine neue Datei braucht auch einen Eintrag in `tools/load.js`.
- **Deterministisch:** Nur `BT.Rng` verwenden, nie `Math.random()` (Ausnahme:
  `BT.randomSeed()`). Jeder Generierungsschritt bekommt mit `rng.fork('name')` einen eigenen
  Sub-RNG, damit neue Schritte alte Seeds nicht verschieben.
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
js/render/  palette, shapes (Konturen), camera, terrainRenderer (inkl. Reliefschattierung)
js/ui/      app.js (Karte, Seed, Größe, Legende, Tooltip, Bildpuffer)
tools/      load.js (Skripte in Node laden), smoketest.js, shot.js (Playwright-Screenshot)
```

Generator-Reihenfolge in `island.js`: Form → Relief → Feuchte (ohne Gewässer) → Wasser
(Priority-Flood, Seen, Abfluss, Flüsse) → Feuchte (mit Gewässern) → Biome.

## Prüfen

```
node tools/smoketest.js 20
node tools/shot.js /tmp/x.png 482917 mittel
```

`tools/shot.js` meldet Fehler aus der Browser-Konsole und endet dann mit Code 1. Nach
Änderungen an Generator oder Darstellung immer einen Screenshot ansehen.
