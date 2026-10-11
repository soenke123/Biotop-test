/**
 * Jahreszeiten auf der Karte: eine Farbschicht ueber dem fertigen Gelaende.
 *
 *   Fruehling  frisches Gruen auf Grasland und Busch
 *   Sommer     warmes, trockenes Gold
 *   Herbst     Waelder und Busch faerben sich rostrot
 *   Winter     Reif auf dem Land, Schnee von den Gipfeln abwaerts, Eis auf Seen
 *
 * Die Schicht wird jedes Bild neu gezeichnet (der Bildpuffer des Gelaendes
 * bleibt unveraendert). An den Grenzen gehen die Jahreszeiten weich ineinander
 * ueber. Reine Darstellung - die Simulation kennt nur cal.season.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var B = BT.BIOME;

  var FADE = 0.35;  // Uebergangsbreite in Jahreszeiten

  /**
   * Gewichte der vier Jahreszeiten fuer eine Position im Jahr.
   * @param pos  Jahreszeiten seit Jahresbeginn, 0..4 (2,5 = Mitte Herbst)
   */
  function weights(pos) {
    var w = [0, 0, 0, 0];
    var s = Math.floor(pos) % 4, f = pos - Math.floor(pos);
    if (f > 1 - FADE / 2) {
      var t = (f - (1 - FADE / 2)) / FADE;       // 0 .. 0,5
      w[s] = 1 - t; w[(s + 1) % 4] = t;
    } else if (f < FADE / 2) {
      var u = (FADE / 2 - f) / FADE;             // 0,5 .. 0
      w[s] = 1 - u; w[(s + 3) % 4] = u;
    } else {
      w[s] = 1;
    }
    return w;
  }

  /** Schneemaske: ein Pixel pro Zelle, Deckung waechst mit der Hoehe. */
  function snowMask(world) {
    if (world._snowMask !== undefined) return world._snowMask;
    var doc = typeof document !== 'undefined' ? document : null;
    if (!doc) { world._snowMask = null; return null; }
    var cols = world.cols, rows = world.rows, h = world.height_, g = world.biome.data;
    var c = doc.createElement('canvas');
    c.width = cols; c.height = rows;
    var cx = c.getContext('2d');
    var img = cx.createImageData(cols, rows);
    for (var i = 0; i < cols * rows; i++) {
      if (!BT.BIOME_INFO[g[i]].land) continue;
      var a = Math.max(0, Math.min(1, (h[i] - 0.48) / 0.2));
      // Schnee selbst schattieren (Licht von Nordwesten wie das Relief)
      var x = i % cols, y = (i - x) / cols;
      var dx = h[y * cols + Math.min(cols - 1, x + 1)] - h[y * cols + Math.max(0, x - 1)];
      var dy = h[Math.min(rows - 1, y + 1) * cols + x] - h[Math.max(0, y - 1) * cols + x];
      var light = Math.max(-1, Math.min(1, (dx + dy) * -14));   // > 0: dem Licht zugewandt
      var o = i * 4;
      img.data[o] = Math.round(232 + 22 * light); img.data[o + 1] = Math.round(238 + 16 * light); img.data[o + 2] = 250;
      img.data[o + 3] = Math.round(a * 255);
    }
    cx.putImageData(img, 0, 0);
    world._snowMask = c;
    return c;
  }

  /** Pfad aus mehreren Landbiomen (einmal pro Welt). */
  function biomePath(world, list, key) {
    var cacheKey = '_seasonPath_' + key;
    if (world[cacheKey]) return world[cacheKey];
    var shapes = BT.Shapes.build(world);
    var p = new Path2D();
    for (var k = 0; k < shapes.biomes.length; k++) {
      var e = shapes.biomes[k];
      if (list.indexOf(e.biome) >= 0 && e.shape.path) p.addPath(e.shape.path);
    }
    world[cacheKey] = p;
    return p;
  }

  function tint(ctx, path, color, alpha, op) {
    if (alpha <= 0.01) return;
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill(path, 'evenodd');
  }

  /**
   * @param ctx    auf Weltkoordinaten transformiert
   * @param pos    Position im Jahr in Jahreszeiten (0..4)
   */
  function draw(ctx, world, pos) {
    if (typeof Path2D === 'undefined') return;
    var w = weights(pos);
    var shapes = BT.Shapes.build(world);
    var island = shapes.island.path;
    var open = biomePath(world, [B.TUSSOCK, B.SCRUB, B.SWAMP], 'open');
    var forest = biomePath(world, [B.SCRUB, B.FERN, B.MOSS], 'forest');

    ctx.save();
    // Fruehling: saftiges Gruen auf dem offenen Land
    tint(ctx, open, '#6fd35a', w[0] * 0.35, 'color');
    tint(ctx, open, '#9be36b', w[0] * 0.4, 'soft-light');
    tint(ctx, forest, '#4fc46a', w[0] * 0.3, 'soft-light');
    // Sommer: warmes Licht, Grasland trocknet aus
    tint(ctx, island, '#ffcf5a', w[1] * 0.4, 'soft-light');
    tint(ctx, open, '#d9a640', w[1] * 0.25, 'color');
    // Herbst: Laub faerbt sich rot und orange, Gras wird braun
    tint(ctx, forest, '#e2621c', w[2] * 0.55, 'color');
    tint(ctx, forest, '#ff9a3c', w[2] * 0.3, 'soft-light');
    tint(ctx, open, '#b07a36', w[2] * 0.3, 'color');
    // Winter: blasses Land mit Reif, Schnee auf Fels und Gipfeln, Eis auf Seen
    if (w[3] > 0.01) {
      tint(ctx, island, '#808890', w[3] * 0.5, 'saturation');
      tint(ctx, island, '#e8f0f7', w[3] * 0.22, 'source-over');
      var snow = snowMask(world);
      if (snow) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.clip(island, 'evenodd');
        ctx.globalAlpha = w[3] * 0.85;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(snow, 0, 0, world.cols * world.cellSize, world.rows * world.cellSize);
        ctx.restore();
      }
      if (shapes.lake.path) tint(ctx, shapes.lake.path, '#e4f2f8', w[3] * 0.55, 'source-over');
    }
    ctx.restore();
  }

  BT.SeasonRenderer = { draw: draw, weights: weights };
})(typeof window !== 'undefined' ? window : globalThis);
