/**
 * Kleine Liniendiagramme fuer die Zeitreihen (Canvas, ohne Bibliothek).
 *
 * Jedes Diagramm hat genau eine y-Achse. Bestaende sehr unterschiedlicher
 * Groesse (Hirsche vs. Woelfe) stehen deshalb in getrennten Diagrammen.
 * Die Legende ueber dem Diagramm nennt jede Reihe mit aktuellem Wert, damit
 * die Zuordnung nie nur an der Farbe haengt. Beim Ueberfahren zeigt ein
 * Fadenkreuz die Werte an diesem Tag.
 */
(function (global) {
  'use strict';

  var BT = global.BT || (global.BT = {});
  var doc = global.document;

  var INK = { axis: 'rgba(232, 241, 244, 0.25)', grid: 'rgba(232, 241, 244, 0.08)', text: 'rgba(232, 241, 244, 0.7)' };

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }

  /**
   * @param container  Element, in das Titel, Legende und Canvas kommen
   * @param opts       { title, series: [{label, color, get(row)}], percent }
   */
  function LineChart(container, opts) {
    this.opts = opts;
    this.root = doc.createElement('div');
    this.root.className = 'chart';
    this.root.innerHTML = '<div class="chart-head"><h3></h3><div class="chart-legend"></div></div>' +
      '<div class="chart-plot"><canvas></canvas><div class="chart-tip" hidden></div></div>';
    this.root.querySelector('h3').textContent = opts.title;
    this.legend = this.root.querySelector('.chart-legend');
    this.canvas = this.root.querySelector('canvas');
    this.tip = this.root.querySelector('.chart-tip');
    this.ctx = this.canvas.getContext('2d');
    this.history = [];
    this.hoverX = null;
    container.appendChild(this.root);

    var self = this;
    this.canvas.addEventListener('pointermove', function (e) {
      var r = self.canvas.getBoundingClientRect();
      self.hoverX = e.clientX - r.left;
      self.draw();
    });
    this.canvas.addEventListener('pointerleave', function () {
      self.hoverX = null; self.tip.hidden = true; self.draw();
    });
    this.buildLegend();
  }

  LineChart.prototype.buildLegend = function () {
    var html = '';
    this.opts.series.forEach(function (s) {
      html += '<span class="lg"><i style="background:' + s.color + '"></i>' + s.label + ' <b data-k="' + s.label + '">–</b></span>';
    });
    this.legend.innerHTML = html;
    this.values = this.legend.querySelectorAll('b');
  };

  LineChart.prototype.fmt = function (v) {
    return this.opts.percent ? Math.round(v * 100) + ' %' : String(Math.round(v));
  };

  LineChart.prototype.update = function (history) {
    this.history = history;
    var last = history[history.length - 1];
    if (last) {
      for (var i = 0; i < this.opts.series.length; i++) this.values[i].textContent = this.fmt(this.opts.series[i].get(last));
    }
    this.draw();
  };

  LineChart.prototype.draw = function () {
    var c = this.canvas, ctx = this.ctx;
    var dpr = global.devicePixelRatio || 1;
    var W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var hist = this.history, series = this.opts.series;
    var L = 34, R = 8, Tp = 6, Bt = 18;
    var pw = W - L - R, ph = H - Tp - Bt;
    var n = hist.length;
    if (n < 2) return;

    var max = 0;
    for (var i = 0; i < n; i++) for (var s = 0; s < series.length; s++) max = Math.max(max, series[s].get(hist[i]));
    max = this.opts.percent ? 1 : niceMax(max * 1.05);

    var x = function (k) { return L + (k / (n - 1)) * pw; };
    var y = function (v) { return Tp + ph - (v / max) * ph; };

    // Gitter und Achsen
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = INK.text;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var t = 0; t <= 2; t++) {
      var v = max * t / 2;
      ctx.strokeStyle = t === 0 ? INK.axis : INK.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Math.round(y(v)) + 0.5); ctx.lineTo(L + pw, Math.round(y(v)) + 0.5); ctx.stroke();
      ctx.fillText(this.fmt(v), L - 5, y(v));
    }
    // Jahresmarken
    var days = hist[n - 1].day - hist[0].day;
    var years = days / BT.Time.DAYS_PER_YEAR;
    var stepY = Math.max(1, niceMax(years / 5));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var yr = 0; yr <= years; yr += stepY) {
      var k = Math.round(yr * BT.Time.DAYS_PER_YEAR / Math.max(1, days) * (n - 1));
      ctx.fillText('J' + (yr + 1), x(k), Tp + ph + 4);
    }

    // Linien: hoechstens ein Punkt je Pixel
    var stride = Math.max(1, Math.floor(n / pw));
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (s = 0; s < series.length; s++) {
      ctx.strokeStyle = series[s].color;
      ctx.beginPath();
      for (i = 0; i < n; i += stride) {
        var px = x(i), py = y(series[s].get(hist[i]));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.lineTo(x(n - 1), y(series[s].get(hist[n - 1])));
      ctx.stroke();
    }

    // Fadenkreuz und Tooltip
    if (this.hoverX !== null && this.hoverX >= L && this.hoverX <= L + pw) {
      var idx = Math.round((this.hoverX - L) / pw * (n - 1));
      var row = hist[idx];
      ctx.strokeStyle = INK.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(x(idx)) + 0.5, Tp); ctx.lineTo(Math.round(x(idx)) + 0.5, Tp + ph); ctx.stroke();
      var html = '<div class="tt-head">' + BT.Time.label(row.day) + '</div>';
      for (s = 0; s < series.length; s++) {
        var val = series[s].get(row);
        ctx.fillStyle = series[s].color;
        ctx.beginPath(); ctx.arc(x(idx), y(val), 4, 0, Math.PI * 2); ctx.fill();
        html += '<div><i style="background:' + series[s].color + '"></i>' + series[s].label + ' <b>' + this.fmt(val) + '</b></div>';
      }
      this.tip.innerHTML = html;
      this.tip.hidden = false;
      var left = x(idx) + 10;
      if (left + 150 > W) left = x(idx) - 160;
      this.tip.style.left = left + 'px';
    }
  };

  BT.LineChart = LineChart;
})(typeof window !== 'undefined' ? window : globalThis);
