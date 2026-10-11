/**
 * Zeichnet Tiere, Nester und Aas ueber die Karte.
 *
 * Positionen werden zwischen zwei Ticks interpoliert (alpha 0..1), damit die
 * Bewegung bei langsamer Geschwindigkeit fluessig aussieht. Das aendert nur
 * das Bild, nie die Simulation.
 *
 * Die Sprites sind Seitenansichten nach links; laeuft ein Tier nach rechts,
 * wird gespiegelt statt gedreht (wie in Wild Clusters).
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  var MIN_PX = 12;  // Mindestgroesse eines Tiers auf dem Bildschirm

  function draw(ctx, sim, view, scale, alpha) {
    if (!sim) return;
    var pad = 30;

    // Aas
    ctx.fillStyle = 'rgba(70, 40, 30, 0.75)';
    ctx.strokeStyle = 'rgba(240, 230, 210, 0.9)';
    ctx.lineWidth = Math.max(1, 1.2 / scale);
    for (var c = 0; c < sim.carcasses.length; c++) {
      var cc = sim.carcasses[c];
      if (!inView(cc, view, pad)) continue;
      var r = Math.max(3, 5 / scale) * Math.min(1, 0.4 + cc.meat);
      ctx.beginPath();
      ctx.ellipse(cc.x, cc.y, r * 1.4, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cc.x - r, cc.y - r * 0.2); ctx.lineTo(cc.x + r, cc.y + r * 0.2);
      ctx.stroke();
    }

    // Nester der Laufvoegel
    for (var i = 0; i < sim.groups.length; i++) {
      var g = sim.groups[i];
      if (!g.nest || !inView(g.nest, view, pad)) continue;
      var nr = Math.max(5, 7 / scale);
      ctx.fillStyle = '#8a6a3c';
      ctx.beginPath(); ctx.arc(g.nest.x, g.nest.y, nr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6f0dc';
      for (var e = 0; e < Math.min(4, g.nest.eggs); e++) {
        var a = e * 1.7;
        ctx.beginPath();
        ctx.ellipse(g.nest.x + Math.cos(a) * nr * 0.4, g.nest.y + Math.sin(a) * nr * 0.4, nr * 0.32, nr * 0.24, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tiere: Pflanzenfresser zuerst, Raeuber obenauf
    drawList(ctx, sim.herbivoreGroups, view, scale, alpha, pad);
    drawList(ctx, sim.predatorGroups, view, scale, alpha, pad);
  }

  function drawList(ctx, groups, view, scale, alpha, pad) {
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var spec = g.spec;
      var img = BT.Sprites.get(spec.id);
      var base = Math.max(spec.size, MIN_PX / scale);
      for (var m = 0; m < g.members.length; m++) {
        var a = g.members[m];
        var x = a.px + (a.x - a.px) * alpha, y = a.py + (a.y - a.py) * alpha;
        if (x < view.x - pad || x > view.x + view.width + pad || y < view.y - pad || y > view.y + view.height + pad) continue;
        var size = a.age < spec.maturity ? base * (0.55 + 0.45 * a.age / spec.maturity) : base;
        // Schatten (fliegende Tiere: weiter versetzt)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        var so = spec.flies ? size * 0.6 : size * 0.12;
        ctx.ellipse(x + so, y + size * 0.3 + so, size * 0.36, size * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        if (img) {
          var h = size * img.height / img.width;
          ctx.save();
          ctx.translate(x, y);
          if (Math.cos(a.heading) > 0) ctx.scale(-1, 1);
          ctx.drawImage(img, -size / 2, -h / 2, size, h);
          ctx.restore();
        } else {
          ctx.fillStyle = spec.color;
          ctx.beginPath(); ctx.arc(x, y, size * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  function inView(p, view, pad) {
    return p.x >= view.x - pad && p.x <= view.x + view.width + pad &&
      p.y >= view.y - pad && p.y <= view.y + view.height + pad;
  }

  /** Das Tier unter einem Weltpunkt (fuer Tooltip/Auswahl), sonst null. */
  function pick(sim, wx, wy, radius) {
    var best = null, bestD = radius;
    for (var i = 0; i < sim.groups.length; i++) {
      var g = sim.groups[i];
      for (var m = 0; m < g.members.length; m++) {
        var a = g.members[m];
        var d = Math.hypot(a.x - wx, a.y - wy);
        if (d < bestD) { bestD = d; best = a; }
      }
    }
    return best;
  }

  BT.AgentRenderer = { draw: draw, pick: pick };
})(typeof window !== 'undefined' ? window : globalThis);
