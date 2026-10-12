/**
 * Zeichnet die Menschen: Schiffe, Haeuser, Siedler.
 *
 * Bis es Bilder gibt, zeichnet das Programm einfache Platzhalter. Sobald eine
 * Grafik da ist, wird sie in FILES eingetragen (Pfad relativ zu index.html)
 * und statt des Platzhalters benutzt. Blickrichtung der Bilder: rechts.
 * Haeuser: haus_1, haus_2, haus_3 (Varianten), Siedler: siedler_gehend,
 * siedler_stehend, siedler_arbeitend.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});

  // z. B. schiff: 'assets/schiff.png', haus_1: 'assets/haus_1.png'
  var FILES = {};
  var images = {};

  function image(name) {
    if (images[name] !== undefined) return images[name];
    images[name] = null;
    if (!FILES[name] || typeof global.Image === 'undefined') return null;
    var img = new global.Image();
    img.onload = function () { images[name] = img; if (BT.app) BT.app.redraw(); };
    img.src = FILES[name];
    return null;
  }

  var SHIP_SIZE = 64, HOUSE_SIZE = 30;

  function lerp(o, alpha) {
    return { x: o.px + (o.x - o.px) * alpha, y: o.py + (o.y - o.py) * alpha };
  }

  function inView(p, view, pad) {
    return p.x >= view.x - pad && p.x <= view.x + view.width + pad &&
      p.y >= view.y - pad && p.y <= view.y + view.height + pad;
  }

  /** Haeuser und Siedler (unter den Tieren). */
  function drawGround(ctx, sim, view, scale, alpha) {
    var H = sim && sim.humans;
    if (!H || !H.houses.length) return;
    var hs = Math.max(HOUSE_SIZE, 18 / scale);
    for (var i = 0; i < H.houses.length; i++) {
      var h = H.houses[i];
      if (inView(h, view, hs * 2)) drawHouse(ctx, h, hs);
    }
    var ps = Math.max(BT.HUMANS.settler.size, 10 / scale);
    for (i = 0; i < H.people.length; i++) {
      var p = H.people[i];
      if (p.inside) continue;
      var q = lerp(p, alpha);
      if (inView(q, view, ps * 2)) drawSettler(ctx, p, q, ps);
    }
  }

  /** Schiffe (ueber allem, sie fahren auf dem Meer). */
  function drawSea(ctx, sim, view, scale, alpha) {
    var H = sim && sim.humans;
    if (!H) return;
    var ss = Math.max(SHIP_SIZE, 34 / scale);
    for (var i = 0; i < H.ships.length; i++) {
      var s = H.ships[i];
      var q = lerp(s, alpha);
      if (inView(q, view, ss * 2)) drawShip(ctx, s, q, ss, scale);
    }
  }

  function drawHouse(ctx, h, size) {
    var img = image('haus_' + (h.kind + 1));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(h.x + size * 0.08, h.y + size * 0.42, size * 0.62, size * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    if (img) {
      var ih = size * 1.3 * img.height / img.width;
      ctx.drawImage(img, h.x - size * 0.65, h.y + size * 0.45 - ih, size * 1.3, ih);
      return;
    }
    var w = size, wallH = size * 0.5, x0 = h.x - w / 2, base = h.y + size * 0.4;
    ctx.lineWidth = Math.max(0.6, size * 0.04);
    ctx.strokeStyle = '#4a3220';
    ctx.fillStyle = ['#d8b27a', '#c99e6a', '#e0c08c'][h.kind % 3];
    ctx.fillRect(x0, base - wallH, w, wallH);
    ctx.strokeRect(x0, base - wallH, w, wallH);
    ctx.fillStyle = ['#9a4a32', '#7d5a36', '#8b3f2c'][h.kind % 3];
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.12, base - wallH);
    ctx.lineTo(h.x, base - wallH - size * 0.42);
    ctx.lineTo(x0 + w * 1.12, base - wallH);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(h.x - w * 0.09, base - wallH * 0.62, w * 0.18, wallH * 0.62);
    ctx.fillStyle = '#f2d98a';
    ctx.fillRect(x0 + w * 0.12, base - wallH * 0.75, w * 0.17, wallH * 0.3);
  }

  function drawSettler(ctx, p, q, size) {
    var moving = Math.abs(p.x - p.px) + Math.abs(p.y - p.py) > 0.3;
    var img = image(moving ? 'siedler_gehend' : p.working ? 'siedler_arbeitend' : 'siedler_stehend') || image('siedler_gehend');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath(); ctx.ellipse(q.x, q.y + size * 0.42, size * 0.3, size * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    if (img) {
      var ih = size * img.height / img.width;
      ctx.save();
      ctx.translate(q.x, q.y);
      if (Math.cos(p.heading) < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -size / 2, size * 0.45 - ih, size, ih);
      ctx.restore();
      return;
    }
    // Platzhalter: Koerper, Kopf, Hut
    var tone = ['#3d6fb0', '#a8452f', '#4f7d3a', '#7a5aa6', '#b07a2a'][p.id % 5];
    ctx.lineWidth = Math.max(0.5, size * 0.07);
    ctx.strokeStyle = '#2a1d14';
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(q.x - size * 0.22, q.y + size * 0.42);
    ctx.lineTo(q.x - size * 0.15, q.y - size * 0.08);
    ctx.lineTo(q.x + size * 0.15, q.y - size * 0.08);
    ctx.lineTo(q.x + size * 0.22, q.y + size * 0.42);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(q.x, q.y - size * 0.24, size * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(q.x - size * 0.2, q.y - size * 0.42, size * 0.4, size * 0.07);
  }

  function drawShip(ctx, s, q, size, scale) {
    var right = Math.cos(s.heading) >= 0;
    var moving = s.phase !== 'liegt';
    // Kielwasser
    if (moving) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1, 1.5 / scale);
      var bx = -Math.cos(s.heading), by = -Math.sin(s.heading);
      for (var k = -1; k <= 1; k += 2) {
        ctx.beginPath();
        ctx.moveTo(q.x + bx * size * 0.35, q.y + by * size * 0.35 + size * 0.12);
        ctx.lineTo(q.x + bx * size * 1.1 - by * k * size * 0.25, q.y + by * size * 1.1 + bx * k * size * 0.25 + size * 0.12);
        ctx.stroke();
      }
    }
    var img = image('schiff');
    ctx.save();
    ctx.translate(q.x, q.y);
    if (!right) ctx.scale(-1, 1);
    if (img) {
      var ih = size * img.height / img.width;
      ctx.drawImage(img, -size / 2, size * 0.2 - ih, size, ih);
      ctx.restore();
      return;
    }
    // Platzhalter: Rumpf, Mast, zwei Segel (Bug nach rechts)
    ctx.lineWidth = Math.max(0.8, size * 0.025);
    ctx.strokeStyle = '#3a2414';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath(); ctx.ellipse(0, size * 0.2, size * 0.5, size * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a26';
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, -size * 0.04);
    ctx.lineTo(size * 0.5, -size * 0.06);
    ctx.lineTo(size * 0.34, size * 0.17);
    ctx.lineTo(-size * 0.4, size * 0.17);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9934f';
    ctx.fillRect(-size * 0.44, -size * 0.04, size * 0.88, size * 0.05);
    ctx.beginPath(); ctx.moveTo(-size * 0.02, -size * 0.04); ctx.lineTo(-size * 0.02, -size * 0.62); ctx.stroke();
    ctx.fillStyle = '#f4ecd6';
    ctx.beginPath();
    ctx.moveTo(-size * 0.04, -size * 0.58);
    ctx.quadraticCurveTo(-size * 0.34, -size * 0.32, -size * 0.36, -size * 0.1);
    ctx.lineTo(-size * 0.04, -size * 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.quadraticCurveTo(size * 0.22, -size * 0.3, size * 0.3, -size * 0.1);
    ctx.lineTo(0, -size * 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(-size * 0.02, -size * 0.62); ctx.lineTo(size * 0.12, -size * 0.58); ctx.lineTo(-size * 0.02, -size * 0.54); ctx.fill();
    ctx.restore();
  }

  /** Haus oder Siedler unter einem Weltpunkt (fuer den Tooltip), sonst null. */
  function pick(sim, wx, wy, radius) {
    var H = sim && sim.humans;
    if (!H) return null;
    var best = null, bestD = radius;
    for (var i = 0; i < H.people.length; i++) {
      var p = H.people[i];
      if (p.inside) continue;
      var d = Math.hypot(p.x - wx, p.y - wy);
      if (d < bestD) { bestD = d; best = { kind: 'siedler', obj: p }; }
    }
    for (i = 0; i < H.houses.length; i++) {
      var h = H.houses[i];
      d = Math.hypot(h.x - wx, h.y - wy);
      if (d < Math.max(bestD, HOUSE_SIZE * 0.6)) { bestD = d; best = { kind: 'haus', obj: h }; }
    }
    for (i = 0; i < H.ships.length; i++) {
      var s = H.ships[i];
      d = Math.hypot(s.x - wx, s.y - wy);
      if (d < Math.max(bestD, SHIP_SIZE * 0.5)) { bestD = d; best = { kind: 'schiff', obj: s }; }
    }
    return best;
  }

  BT.HumanRenderer = { drawGround: drawGround, drawSea: drawSea, pick: pick, FILES: FILES };
})(typeof window !== 'undefined' ? window : globalThis);
