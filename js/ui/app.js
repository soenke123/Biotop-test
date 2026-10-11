/**
 * Oberflaeche: Karte (Verschieben/Zoomen), Seed, Inselgroesse, Simulation mit
 * Zeitregler, Bestaende, Diagramme, Todesursachen, Startwerte.
 *
 * Der Seed steht in der Adresszeile (#seed=482917&size=mittel) - so laesst
 * sich dieselbe Insel teilen.
 *
 * Zeit: Der Regler bestimmt, wie viele Ticks pro Sekunde gerechnet werden.
 * Gezeichnet wird hoechstens einmal pro Bildschirmbild. Gleicher Seed und
 * gleiche Startwerte ergeben bei jeder Reglerstellung denselben Verlauf.
 */
(function (global) {
  'use strict';

  var BT = global.BT;
  var doc = global.document;
  var $ = function (id) { return doc.getElementById(id); };

  var canvas = $('map');
  var ctx = canvas.getContext('2d');
  var seedInput = $('seed'), sizeSelect = $('size');
  var tooltip = $('tooltip'), legend = $('legend'), legendBtn = $('toggleLegend');
  var status = $('status');
  var seasonBadge = $('season'), hlBadge = $('highlight');
  var SEASON_ICON = ['🌸', '☀️', '🍂', '❄️'];
  var highlight = null;   // Art-ID, deren Tiere auf der Karte markiert sind
  // Karte: Weidezustand (Standard), reine Landschaft oder eine Nahrungsschicht
  var mapMode = $('mapMode');
  function showPlants() { return mapMode.value === 'weide'; }
  var playBtn = $('play'), speedInput = $('speed'), speedLabel = $('speedLabel'), clock = $('clock');

  var world = null, sim = null, camera = null;
  var dirty = true, dpr = 1;
  var running = false, tickAcc = 0, lastFrame = 0;
  var skipping = false;
  // Startbestand: empfohlen = passend zur Inselgroesse; mit den Reglern aenderbar.
  // Eigene Werte bleiben beim Wechsel des Seeds erhalten, bei anderer Inselgroesse
  // wird wieder auf die Empfehlung gesetzt.
  var startValues = {};
  var recommended = {};
  var customStart = false;
  var startSize = null;

  // Bildpuffer: ganze Insel einmal vorgezeichnet; beim Hineinzoomen zusaetzlich
  // ein scharfer Puffer fuer genau den sichtbaren Ausschnitt.
  var CACHE_MAX_PX = 4096;
  var cache = null, viewCache = null;
  var lastInteraction = 0, sharpTimer = null;

  // ---------------------------------------------------------------- Welt und Simulation
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
    setRunning(false);
    global.setTimeout(function () {
      world = BT.World.generate(seed, { size: size });
      seedInput.value = seed;
      sizeSelect.value = world.size;
      writeHash(seed, world.size);
      if (!camera) camera = new BT.Camera(world);
      else camera.setWorld(world);
      resize();
      cache = buildCache(world);
      viewCache = null;
      buildLegend();
      restart();
      status.textContent = world.cols + ' × ' + world.rows + ' Zellen · ' + world.meta.generationMs + ' ms';
    }, 10);
  }

  function restart() {
    if (!world) return;
    recommended = BT.Simulation.defaultStart(world);
    if (startSize !== world.size) { customStart = false; startSize = world.size; }
    if (!customStart) startValues = Object.assign({}, recommended);
    syncStartSliders();
    sim = new BT.Simulation(world, { start: startValues });
    tickAcc = 0;
    $('restart').classList.remove('primary');
    updatePanel(true);
    dirty = true;
  }

  /** Regler und Anzeigen an startValues/recommended angleichen. */
  function syncStartSliders() {
    BT.SPECIES_ORDER.forEach(function (id) {
      var rec = recommended[id] || BT.SPECIES[id].start;
      var max = Math.max(6, Math.ceil(rec * 3 / 2) * 2);
      var inp = doc.querySelector('#startInputs input[data-id="' + id + '"]');
      inp.max = max;
      inp.value = startValues[id];
      $('mark-' + id).style.left = 'calc(8px + (100% - 16px) * ' + (rec / max) + ')';
      $('sv-' + id).textContent = startValues[id];
      $('sv-' + id).classList.toggle('changed', startValues[id] !== rec);
      $('rec-' + id).textContent = 'empf. ' + rec;
    });
  }

  /** Startbestand geaendert: vor dem Start sofort uebernehmen, sonst Neustart anbieten. */
  function startValuesChanged() {
    customStart = BT.SPECIES_ORDER.some(function (id) { return startValues[id] !== recommended[id]; });
    syncStartSliders();
    if (sim && sim.day === 0 && !running) restart();
    else $('restart').classList.add('primary');
  }

  // ---------------------------------------------------------------- Zeit
  /** Regler 0..100 -> Ticks pro Sekunde, logarithmisch von 2 bis 2000 (~5 Jahre/s). */
  function ticksPerSecond() {
    return 2 * Math.pow(10, speedInput.value / 100 * 3);
  }

  function updateSpeedLabel() {
    var daysPerSec = ticksPerSecond() / BT.Time.TICKS_PER_DAY;
    var text;
    if (daysPerSec < 1) text = (1 / daysPerSec).toFixed(1).replace('.', ',') + ' s pro Tag';
    else if (daysPerSec < BT.Time.DAYS_PER_YEAR / 2) text = Math.round(daysPerSec) + ' Tage/s';
    else text = (daysPerSec / BT.Time.DAYS_PER_YEAR).toFixed(1).replace('.', ',') + ' Jahre/s';
    speedLabel.textContent = text;
  }

  function setRunning(on) {
    running = on && !!sim;
    playBtn.textContent = running ? '⏸ Pause' : '▶ Start';
    lastFrame = 0;
  }

  /** Ohne Zeichnen vorspulen, in Haeppchen, damit die Seite bedienbar bleibt. */
  function skipYears(years) {
    if (!sim || skipping) return;
    var wasRunning = running;
    setRunning(false);
    skipping = true;
    var targetDay = sim.day + years * BT.Time.DAYS_PER_YEAR;
    $('skip').disabled = true;
    (function chunk() {
      var t0 = global.performance.now();
      while (sim.day < targetDay && global.performance.now() - t0 < 40) sim.runDays(1);
      clock.textContent = BT.Time.label(sim.day) + ' · spule vor …';
      updatePanel(true);
      dirty = true;
      if (sim.day < targetDay) global.setTimeout(chunk, 0);
      else {
        skipping = false;
        $('skip').disabled = false;
        setRunning(wasRunning);
        updatePanel(true);
      }
    })();
  }

  // ---------------------------------------------------------------- Zeichnen
  function resize() {
    dpr = global.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    if (camera) camera.setViewport(rect.width, rect.height);
    viewCache = null;
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
    return { canvas: c, scale: scale };
  }

  function interacted() {
    lastInteraction = global.performance.now();
    dirty = true;
    if (sharpTimer) global.clearTimeout(sharpTimer);
    sharpTimer = global.setTimeout(function () { dirty = true; }, 180);
  }

  function setWorldTransform(c) {
    c.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale, -camera.x * camera.scale * dpr, -camera.y * camera.scale * dpr);
  }

  function drawTerrain() {
    var needSharp = camera.scale * dpr > cache.scale * 1.1;
    var idle = global.performance.now() - lastInteraction > 150;
    if (needSharp && idle) {
      var key = camera.x + ',' + camera.y + ',' + camera.scale + ',' + canvas.width + ',' + canvas.height;
      if (!viewCache || viewCache.key !== key) {
        var c = viewCache && viewCache.canvas.width === canvas.width && viewCache.canvas.height === canvas.height
          ? viewCache.canvas : doc.createElement('canvas');
        c.width = canvas.width; c.height = canvas.height;
        var vc = c.getContext('2d');
        vc.setTransform(1, 0, 0, 1, 0, 0);
        vc.fillStyle = BT.PALETTE.background;
        vc.fillRect(0, 0, c.width, c.height);
        setWorldTransform(vc);
        BT.TerrainRenderer.draw(vc, world, camera.visibleRect(0), camera.scale);
        viewCache = { key: key, canvas: c };
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(viewCache.canvas, 0, 0);
      setWorldTransform(ctx);
    } else {
      setWorldTransform(ctx);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cache.canvas, 0, 0, world.width, world.height);
    }
  }

  /** Position im Jahr in Jahreszeiten (0..4), stufenlos zwischen den Ticks. */
  function seasonPos(alpha) {
    var T = BT.Time;
    var days = sim.day % T.DAYS_PER_YEAR + ((sim.tick % T.TICKS_PER_DAY) + (alpha < 1 ? alpha : 0)) / T.TICKS_PER_DAY;
    return days / T.DAYS_PER_SEASON;
  }

  function updateSeasonBadge() {
    var c = BT.Time.calendar(sim.day);
    seasonBadge.textContent = SEASON_ICON[c.season] + ' ' + c.seasonName;
    seasonBadge.dataset.season = c.season;
  }

  // ---------------------------------------------------------------- Hervorheben einer Art
  /** Klick auf eine Kachel: alle Tiere dieser Art auf der Karte markieren (nochmal: aus). */
  function setHighlight(id) {
    highlight = id && id !== highlight ? id : null;
    var tiles = doc.querySelectorAll('#tiles .tile');
    for (var i = 0; i < tiles.length; i++) {
      var on = tiles[i].dataset.id === highlight;
      tiles[i].classList.toggle('active', on);
      tiles[i].setAttribute('aria-pressed', String(on));
    }
    if (highlight) {
      var s = BT.SPECIES[highlight];
      hlBadge.innerHTML = '<i style="background:' + SERIES_COLOR[highlight] + '"></i>' + s.plural +
        ' hervorgehoben <span id="hlCount"></span> <button type="button" aria-label="Hervorhebung aufheben">✕</button>';
      updateHighlightCount();
    }
    hlBadge.hidden = !highlight;
    dirty = true;
  }

  function updateHighlightCount() {
    var el = $('hlCount');
    if (!el || !sim || !highlight) return;
    el.textContent = '(' + sim.stats.latest().count[highlight] + ')';
  }

  function frame(now) {
    if (running && sim && !skipping) {
      if (lastFrame) {
        var dt = Math.min(0.25, (now - lastFrame) / 1000);
        tickAcc += dt * ticksPerSecond();
        var t0 = global.performance.now();
        var dayBefore = sim.day;
        // Rechnen mit Zeitbudget: reicht die Zeit nicht, laeuft es langsamer, aber gleich
        while (tickAcc >= 1 && global.performance.now() - t0 < 30) { sim.step(); tickAcc -= 1; }
        if (tickAcc > 1) tickAcc = 1;
        if (sim.day !== dayBefore) updatePanel(false);
      }
      lastFrame = now;
      dirty = true;
    }
    if (dirty && world && camera && cache) {
      dirty = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = BT.PALETTE.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawTerrain();
      var alpha = running && ticksPerSecond() <= 90 ? Math.min(1, tickAcc) : 1;
      if (sim) BT.SeasonRenderer.draw(ctx, world, seasonPos(alpha));
      // nach den Jahreszeiten, sonst faerbt der Fruehling den kahlen Boden gruen
      if (sim && showPlants()) BT.PlantRenderer.draw(ctx, world, sim);
      else if (sim) BT.FoodOverlay.draw(ctx, sim, mapMode.value);
      BT.AgentRenderer.draw(ctx, sim, camera.visibleRect(0), camera.scale, alpha,
        { highlight: highlight, highlightColor: highlight && SERIES_COLOR[highlight] });
    }
    global.requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- Seitenleiste
  var SERIES_COLOR = {
    zwerghirsch: '#d95926', laufvogel: '#3987e5', inselwolf: '#9085e9', inseladler: '#c98500',
    gras: '#199e70', frucht: '#e66767', laub: '#008300', insekten: '#d55181'
  };
  var charts = [], bigCharts = [], chartView = null;
  // Schichten mit Pflanzenzustand (Gras, Laub, ... - je nach Artentabelle)
  var HEALTH_KEYS = BT.FOOD_ORDER.filter(function (k) { return BT.FOOD[k].damage; });
  var lastPanelUpdate = 0;

  function makeCharts(box) {
    function series(ids, get) {
      return ids.map(function (id) { return { label: (BT.SPECIES[id] || BT.FOOD[id]).plural || BT.FOOD[id].name, color: SERIES_COLOR[id], get: get(id) }; });
    }
    var count = function (id) { return function (r) { return r.count[id]; }; };
    return [
      new BT.LineChart(box, { view: chartView, title: 'Pflanzenfresser', series: series(['zwerghirsch', 'laufvogel'], count) }),
      new BT.LineChart(box, { view: chartView, title: 'Räuber', series: series(['inselwolf', 'inseladler'], count) }),
      new BT.LineChart(box, {
        view: chartView, title: 'Nahrung (Anteil am Höchststand)', percent: true,
        series: ['gras', 'frucht', 'laub', 'insekten'].map(function (k) {
          return { label: BT.FOOD[k].name, color: SERIES_COLOR[k], get: function (r) { return r.food[k]; } };
        })
      }),
      new BT.LineChart(box, {
        view: chartView, title: 'Zustand der Pflanzen (100 % = gesund, sinkt bei Übernutzung)', percent: true,
        series: HEALTH_KEYS.map(function (k) {
          return { label: BT.FOOD[k].name, color: SERIES_COLOR[k], get: function (r) { return r.health && r.health[k] != null ? r.health[k] : 1; } };
        })
      })
    ];
  }

  function updateCharts() {
    if (!sim) return;
    var h = sim.stats.history;
    for (var i = 0; i < charts.length; i++) charts[i].update(h);
    if (bigOpen()) for (i = 0; i < bigCharts.length; i++) bigCharts[i].update(h);
  }

  // Grossansicht: alle Diagramme ueber die volle Breite untereinander
  var bigBox = $('bigView');
  function bigOpen() { return !bigBox.hidden; }
  function setBig(open) {
    bigBox.hidden = !open;
    $('openBig').setAttribute('aria-expanded', String(open));
    chartView.setHover(null, null);
    if (open) { updateCharts(); $('closeBig').focus(); }
  }

  function buildPanel() {
    // Kacheln je Art
    var tiles = $('tiles');
    tiles.innerHTML = BT.SPECIES_ORDER.map(function (id) {
      var s = BT.SPECIES[id];
      return '<div class="tile" role="button" tabindex="0" aria-pressed="false" data-id="' + id + '" title="Alle ' + s.plural + ' auf der Karte zeigen">' +
        '<img src="' + s.sprite + '" alt=""><div><div class="tile-name">' +
        '<i style="background:' + SERIES_COLOR[id] + '"></i>' + s.plural + '</div>' +
        '<div class="tile-count" id="count-' + id + '">–</div><div class="tile-sub" id="sub-' + id + '"></div></div></div>';
    }).join('');

    // Diagramme: kleine in der Seitenleiste, grosse in der Grossansicht.
    // Beide teilen Zeitraum und Fadenkreuz.
    chartView = new BT.ChartView();
    chartView.rangeButtons($('chartTools'));
    chartView.rangeButtons($('bigTools'));
    charts = makeCharts($('charts'));
    bigCharts = makeCharts($('bigCharts'));
    // Bei geaendertem Zeitraum stehen die neuen Werte sofort in der Legende
    chartView.onRange(function () { updateCharts(); });

    // Startbestand: ein Regler je Art, die Empfehlung ist als Strich markiert
    $('startInputs').innerHTML = BT.SPECIES_ORDER.map(function (id) {
      return '<div class="sv"><span class="sv-name"><i style="background:' + SERIES_COLOR[id] + '"></i>' + BT.SPECIES[id].plural + '</span>' +
        '<small id="rec-' + id + '" class="sv-rec"></small><b id="sv-' + id + '" class="sv-value"></b>' +
        '<div class="sv-track"><input type="range" min="0" step="1" data-id="' + id + '" aria-label="Startbestand ' + BT.SPECIES[id].plural + '">' +
        '<span class="sv-mark" id="mark-' + id + '"></span></div></div>';
    }).join('');
  }

  function updatePanel(force) {
    if (!sim) return;
    var now = global.performance.now();
    clock.textContent = BT.Time.label(sim.day);
    $('weather').textContent = BT.Weather.describe(sim.weatherNow);
    updateSeasonBadge();
    if (!force && now - lastPanelUpdate < 250) return;
    lastPanelUpdate = now;
    var row = sim.stats.latest();
    BT.SPECIES_ORDER.forEach(function (id) {
      $('count-' + id).textContent = row.count[id];
      var g = row.groups[id];
      var kind = { herd: ['Herde', 'Herden'], flock: ['Gruppe', 'Gruppen'], pack: ['Rudel', 'Rudel'], pair: ['Paar/Revier', 'Paare/Reviere'] }[BT.SPECIES[id].group.kind];
      $('sub-' + id).textContent = row.count[id] ? row.young[id] + ' Jungtiere · ' + g + ' ' + kind[g === 1 ? 0 : 1]
        : sim.startCounts[id] ? 'ausgestorben in ' + BT.Time.label(sim.stats.extinct[id]).replace(/,.*/, '') : 'nicht auf der Insel';
    });
    updateCharts();
    updateDeaths();
    updateHighlightCount();
  }

  function updateDeaths() {
    var causes = [['hunger', 'Hunger'], ['durst', 'Durst'], ['alter', 'Alter'], ['inselwolf', 'Wolf'], ['inseladler', 'Adler']];
    var html = '<tr><th></th>' + causes.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr>';
    BT.SPECIES_ORDER.forEach(function (id) {
      var d = sim.stats.deaths[id];
      html += '<tr><td>' + BT.SPECIES[id].plural + '</td>' + causes.map(function (c) {
        return '<td>' + (d[c[0]] || '·') + '</td>';
      }).join('') + '</tr>';
    });
    $('deaths').innerHTML = html;
  }

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
    if (showPlants()) {
      // Beispiel: Grasland und Farnwald, wie sie bei Uebernutzung ihre Farbe verlieren
      var hex = function (h) { return [1, 3, 5].map(function (k) { return parseInt(h.substr(k, 2), 16); }); };
      var sw = function (key, s) { return 'rgb(' + BT.PlantRenderer.sample(hex(P[key].base), s).join(',') + ')'; };
      var pair = function (s) {
        return '<span class="swatch" style="background:linear-gradient(90deg,' + sw('tussock', s) + ' 50%,' + sw('fern', s) + ' 50%)"></span>';
      };
      html += '<h2>Weidezustand</h2>' +
        '<div class="row">' + pair(0) + 'gesund</div>' +
        '<div class="row">' + pair(0.35) + 'abgefressen: blasser</div>' +
        '<div class="row">' + pair(1) + 'überweidet: grau und fahl</div>';
    }
    legend.innerHTML = html;
  }

  // ---------------------------------------------------------------- Eingabe Karte
  var pointers = new Map();
  var pinchDist = 0;
  var clickStart = null;   // Zeigerposition beim Druecken: kaum bewegt = Klick

  function localPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localPos(e));
    clickStart = pointers.size === 1 ? localPos(e) : null;
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
    // Klick auf ein Tier hebt seine Art hervor
    if (e.type === 'pointerup' && clickStart && pointers.size === 1 && sim && camera) {
      var pos = localPos(e);
      if (Math.abs(pos.x - clickStart.x) + Math.abs(pos.y - clickStart.y) < 5) {
        var w = camera.screenToWorld(pos.x, pos.y);
        var a = BT.AgentRenderer.pick(sim, w.x, w.y, Math.max(14, 12 / camera.scale));
        if (a) setHighlight(a.spec.id);
      }
    }
    clickStart = null;
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

  var STATE_TEXT = {
    fressen: 'frisst', fliehen: 'flieht', trinken: 'geht trinken', brueten: 'brütet',
    streifen: 'streift durchs Revier', jagen: 'jagt', ruhen: 'ruht', aas: 'frisst Aas', wandern: 'sucht ein Revier'
  };
  var GROUP_TEXT = { herd: 'Herde', flock: 'Gruppe', pack: 'Rudel', pair: 'Paar' };

  function showTooltip(pos) {
    if (!world || !camera) return;
    var w = camera.screenToWorld(pos.x, pos.y);
    if (w.x < 0 || w.y < 0 || w.x >= world.width || w.y >= world.height) { tooltip.hidden = true; return; }
    var a = sim ? BT.AgentRenderer.pick(sim, w.x, w.y, Math.max(14, 12 / camera.scale)) : null;
    var text;
    if (a) {
      var years = a.age / BT.Time.DAYS_PER_YEAR;
      var g = a.group;
      text = a.spec.name + (a.sex === 'f' ? ' ♀' : ' ♂') + ' · ' +
        (a.age < a.spec.maturity ? 'Jungtier' : years.toFixed(1).replace('.', ',') + ' Jahre') +
        ' · Energie ' + Math.round(a.energy * 100) + ' %' +
        (g ? ' · ' + GROUP_TEXT[a.spec.group.kind] + ' mit ' + g.members.length + ' · ' + (STATE_TEXT[g.state] || g.state) : '');
    } else {
      var b = world.query.biomeAt(w.x, w.y);
      text = BT.BIOME_INFO[b].name;
      if (BT.BIOME_INFO[b].land && sim) {
        var f = sim.fields, i = f.index(w.x, w.y);
        text += ' · Gras ' + pctOf(f, 'gras', i) + ' · Laub ' + pctOf(f, 'laub', i) +
          ' · Früchte ' + pctOf(f, 'frucht', i) + ' · Insekten ' + pctOf(f, 'insekten', i) +
          healthOf(f, i);
      }
    }
    tooltip.textContent = text;
    tooltip.style.left = pos.x + 'px';
    tooltip.style.top = pos.y + 'px';
    tooltip.hidden = false;
  }

  /** Pflanzenzustand der Zelle, nur wenn durch Ueberweidung geschaedigt. */
  function healthOf(f, i) {
    var parts = [];
    ['gras', 'laub'].forEach(function (key) {
      if (f.capacity[key][i] > 0.05 && f.health[key][i] < 0.95) {
        parts.push(BT.FOOD[key].name.split(' ')[0] + ' ' + Math.round(f.health[key][i] * 100) + ' %');
      }
    });
    return parts.length ? ' · überweidet, Zustand: ' + parts.join(', ') : '';
  }

  function pctOf(f, key, i) {
    var K = f.capacity[key][i];
    return K > 0.05 ? Math.round(f.value[key][i] / K * 100) + ' %' : '–';
  }

  // ---------------------------------------------------------------- Bedienelemente
  $('newWorld').addEventListener('click', function () { load(BT.randomSeed(), sizeSelect.value); });
  seedInput.addEventListener('change', function () { load(BT.parseSeed(seedInput.value), sizeSelect.value); });
  sizeSelect.addEventListener('change', function () { load(world ? world.seed : BT.randomSeed(), sizeSelect.value); });
  $('resetView').addEventListener('click', function () { if (camera) { camera.reset(); interacted(); } });
  legendBtn.addEventListener('click', function () {
    legend.hidden = !legend.hidden;
    legendBtn.setAttribute('aria-pressed', String(!legend.hidden));
  });
  playBtn.addEventListener('click', function () { setRunning(!running); });
  mapMode.addEventListener('change', function () { if (world) buildLegend(); dirty = true; });
  $('stepDay').addEventListener('click', function () {
    if (!sim || skipping) return;
    setRunning(false);
    sim.runDays(1);
    updatePanel(true);
    dirty = true;
  });
  $('skip').addEventListener('click', function () { skipYears(5); });
  $('tiles').addEventListener('click', function (e) {
    var tile = e.target.closest('.tile');
    if (tile) setHighlight(tile.dataset.id);
  });
  $('tiles').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tile = e.target.closest('.tile');
    if (!tile) return;
    e.preventDefault();
    e.stopPropagation();
    setHighlight(tile.dataset.id);
  });
  hlBadge.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') setHighlight(null); });
  speedInput.addEventListener('input', updateSpeedLabel);
  $('startInputs').addEventListener('input', function (e) {
    var id = e.target.dataset && e.target.dataset.id;
    if (!id) return;
    startValues[id] = parseInt(e.target.value, 10) || 0;
    startValuesChanged();
  });
  $('defaults').addEventListener('click', function () {
    startValues = Object.assign({}, recommended);
    startValuesChanged();
  });
  $('restart').addEventListener('click', function () {
    setRunning(false);
    restart();
  });
  $('csv').addEventListener('click', function () {
    if (!sim) return;
    var blob = new global.Blob(['﻿' + sim.stats.toCSV()], { type: 'text/csv;charset=utf-8' });
    var a = doc.createElement('a');
    a.href = global.URL.createObjectURL(blob);
    a.download = 'biotop-seed' + world.seed + '-jahr' + BT.Time.calendar(sim.day).year + '.csv';
    a.click();
    global.setTimeout(function () { global.URL.revokeObjectURL(a.href); }, 1000);
  });
  global.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'r' || e.key === 'R') { if (camera) { camera.reset(); interacted(); } }
    if (e.key === ' ') { e.preventDefault(); setRunning(!running); }
    if (e.key === 'Escape') { if (bigOpen()) setBig(false); else setHighlight(null); }
  });
  global.addEventListener('resize', function () {
    resize();
    chartView.drawAll();
  });
  $('openBig').addEventListener('click', function () { setBig(true); });
  $('closeBig').addEventListener('click', function () { setBig(false); });

  // ---------------------------------------------------------------- Start
  buildPanel();
  updateSpeedLabel();
  BT.Sprites.preload(function () { dirty = true; });
  var h = readHash();
  load(h.seed ? BT.parseSeed(h.seed) : BT.randomSeed(), h.size || BT.CONFIG.size);
  global.requestAnimationFrame(frame);

  // Fuer Tests und Screenshots
  BT.app = {
    get world() { return world; },
    get sim() { return sim; },
    get camera() { return camera; },
    redraw: function () { dirty = true; },
    highlight: setHighlight,
    runDays: function (n) { sim.runDays(n); updatePanel(true); dirty = true; },
    /** Neu starten mit eigenen Startwerten, z. B. { inselwolf: 0, inseladler: 0 } */
    restartWith: function (start) {
      startValues = Object.assign({}, recommended, start);
      customStart = true;
      restart();
    },
    setRunning: setRunning
  };
})(typeof window !== 'undefined' ? window : globalThis);
