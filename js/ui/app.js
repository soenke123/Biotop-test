/**
 * Oberflaeche: Karte mit Verschieben/Zoomen, Seed, Inselgroesse, Legende,
 * Tooltip mit dem Lebensraum unter dem Zeiger.
 *
 * Der Seed steht in der Adresszeile (#seed=482917&size=mittel) - so laesst
 * sich dieselbe Insel teilen.
 */
(function (global) {
  'use strict';

  var BT = global.BT;
  var doc = global.document;

  var canvas = doc.getElementById('map');
  var ctx = canvas.getContext('2d');
  var seedInput = doc.getElementById('seed');
  var sizeSelect = doc.getElementById('size');
  var tooltip = doc.getElementById('tooltip');
  var legend = doc.getElementById('legend');
  var legendBtn = doc.getElementById('toggleLegend');
  var status = doc.getElementById('status');

  var world = null;
  var camera = null;
  var dirty = true;
  var dpr = 1;

  // Bildpuffer: die ganze Insel einmal vorgezeichnet. Beim Verschieben und
  // Zoomen wird nur noch dieses Bild kopiert; wer weiter hineinzoomt, als der
  // Puffer aufloest, bekommt nach kurzer Ruhe ein scharf gezeichnetes Bild.
  var CACHE_MAX_PX = 4096;
  var cache = null;
  var lastInteraction = 0;
  var sharpTimer = null;

  // ---------------------------------------------------------------- Welt
  function readHash() {
    var out = {};
    global.location.hash.replace(/^#/, '').split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) out[kv[0]] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function writeHash(seed, size) {
    var hash = '#seed=' + seed + '&size=' + size;
    if (global.history && global.history.replaceState) global.history.replaceState(null, '', hash);
    else global.location.hash = hash;
  }

  function load(seed, size) {
    status.textContent = 'erzeuge Insel …';
    // Kurz Luft holen, damit der Status sichtbar wird
    global.setTimeout(function () {
      world = BT.World.generate(seed, { size: size });
      seedInput.value = seed;
      sizeSelect.value = world.size;
      writeHash(seed, world.size);
      if (!camera) camera = new BT.Camera(world);
      else camera.setWorld(world);
      resize();
      cache = buildCache(world);
      buildLegend();
      status.textContent = world.cols + ' × ' + world.rows + ' Zellen · ' + world.meta.generationMs + ' ms';
      dirty = true;
    }, 10);
  }

  // ---------------------------------------------------------------- Zeichnen
  function resize() {
    dpr = global.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (camera) camera.setViewport(rect.width, rect.height);
    dirty = true;
  }

  function buildCache(w) {
    var scale = Math.min(2, CACHE_MAX_PX / w.width, CACHE_MAX_PX / w.height);
    var c = doc.createElement('canvas');
    c.width = Math.ceil(w.width * scale);
    c.height = Math.ceil(w.height * scale);
    var cc = c.getContext('2d');
    cc.setTransform(scale, 0, 0, scale, 0, 0);
    BT.TerrainRenderer.draw(cc, w, { x: 0, y: 0, width: w.width, height: w.height }, scale);
    return { world: w, canvas: c, scale: scale };
  }

  function interacted() {
    lastInteraction = global.performance.now();
    dirty = true;
    if (sharpTimer) global.clearTimeout(sharpTimer);
    sharpTimer = global.setTimeout(function () { dirty = true; }, 180);
  }

  function frame() {
    if (dirty && world && camera) {
      dirty = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = BT.PALETTE.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, -camera.x * camera.scale * dpr, -camera.y * camera.scale * dpr);
      var needSharp = !cache || camera.scale * dpr > cache.scale * 1.1;
      var idle = global.performance.now() - lastInteraction > 150;
      if (needSharp && idle) {
        BT.TerrainRenderer.draw(ctx, world, camera.visibleRect(0), camera.scale);
      } else {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(cache.canvas, 0, 0, world.width, world.height);
      }
    }
    global.requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- Legende
  function buildLegend() {
    var P = BT.PALETTE;
    var shares = world.areaShares;
    var html = '<h2>Lebensräume</h2>';
    for (var b = BT.BIOME.BEACH; b < BT.BIOME_INFO.length; b++) {
      var info = BT.BIOME_INFO[b];
      var pct = shares[info.key] * 100;
      if (pct < 0.05) continue;
      html += '<div class="row"><span class="swatch" style="background:' + P[info.key].base + '"></span>' +
        info.name + '<span class="pct">' + pct.toFixed(1) + ' %</span></div>';
    }
    legend.innerHTML = html;
  }

  // ---------------------------------------------------------------- Eingabe
  var pointers = new Map();
  var pinchDist = 0;

  function localPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localPos(e));
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      var p = Array.from(pointers.values());
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    var pos = localPos(e);
    if (pointers.has(e.pointerId) && camera) {
      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, pos);
      if (pointers.size === 1) {
        camera.panByScreen(pos.x - prev.x, pos.y - prev.y);
      } else if (pointers.size === 2) {
        var p = Array.from(pointers.values());
        var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0) camera.zoomAt((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, d / pinchDist);
        pinchDist = d;
      }
      interacted();
      tooltip.hidden = true;
      return;
    }
    showTooltip(pos);
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!pointers.size) canvas.classList.remove('dragging');
    pinchDist = 0;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', function () { tooltip.hidden = true; });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (!camera) return;
    var pos = localPos(e);
    camera.zoomAt(pos.x, pos.y, Math.exp(-e.deltaY * 0.0015));
    interacted();
  }, { passive: false });

  canvas.addEventListener('dblclick', function (e) {
    if (!camera) return;
    var pos = localPos(e);
    camera.zoomAt(pos.x, pos.y, 2);
    interacted();
  });

  function showTooltip(pos) {
    if (!world || !camera) return;
    var w = camera.screenToWorld(pos.x, pos.y);
    if (w.x < 0 || w.y < 0 || w.x >= world.width || w.y >= world.height) { tooltip.hidden = true; return; }
    var b = world.query.biomeAt(w.x, w.y);
    var text = BT.BIOME_INFO[b].name;
    if (BT.BIOME_INFO[b].land) {
      text += ' · Höhe ' + Math.round(world.query.heightAt(w.x, w.y) * 100) +
        ' · Feuchte ' + Math.round(world.query.moistureAt(w.x, w.y) * 100);
    }
    tooltip.textContent = text;
    tooltip.style.left = pos.x + 'px';
    tooltip.style.top = pos.y + 'px';
    tooltip.hidden = false;
  }

  doc.getElementById('newWorld').addEventListener('click', function () {
    load(BT.randomSeed(), sizeSelect.value);
  });
  seedInput.addEventListener('change', function () {
    load(BT.parseSeed(seedInput.value), sizeSelect.value);
  });
  sizeSelect.addEventListener('change', function () {
    load(world ? world.seed : BT.randomSeed(), sizeSelect.value);
  });
  doc.getElementById('resetView').addEventListener('click', function () {
    if (camera) { camera.reset(); dirty = true; }
  });
  legendBtn.addEventListener('click', function () {
    legend.hidden = !legend.hidden;
    legendBtn.setAttribute('aria-pressed', String(!legend.hidden));
  });
  global.addEventListener('keydown', function (e) {
    if (e.target === seedInput) return;
    if (e.key === 'r' || e.key === 'R') { if (camera) { camera.reset(); dirty = true; } }
  });
  global.addEventListener('resize', resize);

  // ---------------------------------------------------------------- Start
  var h = readHash();
  load(h.seed ? BT.parseSeed(h.seed) : BT.randomSeed(), h.size || BT.CONFIG.size);
  global.requestAnimationFrame(frame);

  // Fuer Tests und Screenshots
  BT.app = {
    get world() { return world; },
    get camera() { return camera; },
    redraw: function () { dirty = true; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
