/**
 * Screenshot der echten Seite in headless Chromium (Playwright).
 * Nur ein Entwicklungswerkzeug - die Anwendung selbst braucht nichts davon.
 *
 *   node tools/shot.js <out.png> [seed] [size] [zoom] [cx] [cy] [tage]
 *
 *   zoom  Vergroesserung relativ zur Gesamtansicht (Standard 1)
 *   cx,cy Mittelpunkt des Ausschnitts als Anteil der Welt (0..1)
 */
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
}

(async () => {
  const [out = 'shot.png', seed = '482917', size = 'mittel', zoom = '1', cx = '0.5', cy = '0.5', days = '0'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.join(__dirname, '..', 'index.html') + '#seed=' + seed + '&size=' + size;
  await page.goto(url);
  await page.waitForFunction(() => window.BT && BT.app && BT.app.world && BT.app.sim, null, { timeout: 30000 });
  if (+days > 0) {
    const t0 = Date.now();
    await page.evaluate((d) => BT.app.runDays(d), +days);
    console.log(days, 'Tage simuliert in', Date.now() - t0, 'ms');
  }
  await page.evaluate(({ zoom, cx, cy }) => {
    const cam = BT.app.camera, w = BT.app.world;
    if (zoom !== 1) {
      cam.scale = Math.min(cam.maxScale, cam.minScale * zoom);
      cam.x = w.width * cx - cam.viewWidth / cam.scale / 2;
      cam.y = w.height * cy - cam.viewHeight / cam.scale / 2;
      cam.clampPosition();
    }
    BT.app.redraw();
  }, { zoom: +zoom, cx: +cx, cy: +cy });
  const t = await page.evaluate(() => new Promise((res) => {
    requestAnimationFrame(() => { const t0 = performance.now(); BT.app.redraw(); requestAnimationFrame(() => res(performance.now() - t0)); });
  }));
  await page.screenshot({ path: out });
  console.log('geschrieben:', out, '· Bild in ca.', Math.round(t), 'ms');
  if (errors.length) { console.log('Fehler:\n' + errors.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
