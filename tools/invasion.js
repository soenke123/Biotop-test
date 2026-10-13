/**
 * Fassen Schafe und Hunde Fuss? Was richtet die Jagd an? Rechnet jede Insel zweimal: nur mit Landung
 * (Vergleich) und mit Landung und Karten (wie balance.js --karten). Gemeldet
 * wird je Insel, ob die eingeschleppten Arten am Ende leben, und wie viele
 * heimische Tiere es im Vergleich zum Lauf ohne die Karten gibt.
 *
 *   node tools/invasion.js [seeds=8] [jahre=30] [--karten=schafe@1,hunde@1] [--seed=1000] [--jobs=4]
 *                          [--set=schaf.costPerDay=0.035,schaf.habitat.SCRUB=0.9]
 *
 * --set  ueberschreibt Werte der Artentabelle zum Ausprobieren (Lebensraeume beim Namen).
 *
 * Etabliert heisst: am Ende mindestens 20 wilde Schafe bzw. ein wildes
 * Hunderudel mit Revier. Mit Jagdkarten (woelfeJagen, wildJagen) steht dazu, was
 * die Jaeger erlegt haben und wie oft Woelfe sie angegriffen haben. Die Inseln
 * laufen parallel in eigenen Prozessen.
 */
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const t = a.replace(/^--/, ''), i = t.indexOf('=');
  return i < 0 ? [t, true] : [t.slice(0, i), t.slice(i + 1)];
}));
const pos = args.filter((a) => !a.startsWith('--'));

// ------------------------------------------------------------ ein Lauf (Kindprozess)
if (flags.lauf) {
  const { load } = require('./load.js');
  const BT = load();
  for (const kv of flags.set ? String(flags.set).split(',') : []) {
    const [key, val] = kv.split('=');
    const parts = key.split('.');
    let o = BT.SPECIES;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    const last = parts[parts.length - 1];
    o[last in BT.BIOME && Array.isArray(o) ? BT.BIOME[last] : last] = JSON.parse(val);
  }
  const seed = +flags.lauf, YEARS = +flags.jahre;
  const cards = flags.karten ? String(flags.karten).split(',').map((c) => { const [id, y] = c.split('@'); return { id, year: +(y || 0) }; }) : [];
  const world = BT.World.generate(seed, { size: flags.size || 'mittel' });
  const sim = new BT.Simulation(world, { cardPause: 0 });
  {
    let best = null, bestD = Infinity;
    const tx = world.width * 0.1, ty = world.height * 0.5;
    for (let gy = 0; gy < world.rows; gy++) for (let gx = 0; gx < world.cols; gx++) {
      const i = gy * world.cols + gx;
      if (!BT.BIOME_INFO[world.biome.data[i]].land || world.fields.distSea[i] > 1.5) continue;
      const x = (gx + 0.5) * world.cellSize, y = (gy + 0.5) * world.cellSize, d = (x - tx) ** 2 + (y - ty) ** 2;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
    sim.play('landung', best);
    sim.runDays(10);
  }
  const yearly = [];
  for (let y = 0; y < YEARS; y++) {
    for (const c of cards) if (c.year === y) sim.play(c.id, {});
    sim.runDays(BT.Time.DAYS_PER_YEAR);
    yearly.push(Object.assign({}, sim.stats.latest().count));
  }
  const ids = BT.SPECIES_ORDER;
  const late = yearly.slice(Math.floor(YEARS * 2 / 3));
  const mean = {};
  for (const id of ids) mean[id] = late.reduce((a, r) => a + r[id], 0) / late.length;
  const dogPacks = sim.predatorGroups.filter((g) => g.spec.id === 'hund' && g.home && g.members.length).length;
  const herds = sim.herbivoreGroups.filter((g) => g.spec.id === 'schaf' && g.members.length).map((g) => g.members.length);
  const peak = {};
  for (const id of ids) peak[id] = Math.max(...yearly.map((r) => r[id]));
  const extinct = {};
  for (const id of ids) if (sim.stats.extinct[id] != null) extinct[id] = BT.Time.calendar(sim.stats.extinct[id]).year;
  const escapes = sim.events.filter((e) => e.card === 'schafeAus' || e.card === 'hundeWild').map((e) => e.card[0] + BT.Time.calendar(e.day).year);
  process.stdout.write(JSON.stringify({ seed, end: yearly[yearly.length - 1], mean, peak, dogPacks, herds, extinct, escapes,
    deaths: { schaf: sim.stats.deaths.schaf, hund: sim.stats.deaths.hund },
    hunt: { bag: sim.humans.bag, attacks: sim.humans.attacks } }));
  process.exit(0);
}

// ------------------------------------------------------------ Steuerung
const SEEDS = +(pos[0] || 8), YEARS = +(pos[1] || 30);
const karten = flags.karten || 'schafe@1,hunde@1';
const JOBS = +(flags.jobs || 4);
const seeds = Array.from({ length: SEEDS }, (_, s) => (flags.seed ? +flags.seed : 1000) + s * 7919);
const jobs = [];
for (const seed of seeds) {
  const set = flags.set ? ['--set=' + flags.set] : [];
  jobs.push({ seed, kind: 'ohne', argv: ['--lauf=' + seed, '--jahre=' + YEARS] });
  jobs.push({ seed, kind: 'mit', argv: ['--lauf=' + seed, '--jahre=' + YEARS, '--karten=' + karten].concat(set) });
}
const results = {};
let next = 0, running = 0, reported = false;
function startNext(done) {
  if (next >= jobs.length) { if (!running && !reported) { reported = true; done(); } return; }
  const j = jobs[next++];
  running++;
  let out = '';
  const p = spawn(process.execPath, [__filename, ...j.argv, ...(flags.size ? ['--size=' + flags.size] : [])]);
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => process.stderr.write(d));
  p.on('close', () => {
    running--;
    (results[j.seed] = results[j.seed] || {})[j.kind] = JSON.parse(out);
    startNext(done);
  });
}
const short = { zwerghirsch: 'Hirsch', laufvogel: 'Vogel', inselwolf: 'Wolf', inseladler: 'Adler', schaf: 'Schaf', hund: 'Hund' };
const NATIVE = ['zwerghirsch', 'laufvogel', 'inselwolf', 'inseladler'];
function report() {
  console.log(`${SEEDS} Inseln × ${YEARS} Jahre, Karten ${karten}${flags.set ? ', ' + flags.set : ''}. Mittel im letzten Drittel, mit Karten / nur Landung`);
  let sheepOk = 0, dogOk = 0;
  const ratio = Object.fromEntries(NATIVE.map((id) => [id, []]));
  for (const seed of seeds) {
    const { mit, ohne } = results[seed];
    const sheep = mit.end.schaf >= 20, dogs = mit.dogPacks > 0;
    if (sheep) sheepOk++;
    if (dogs) dogOk++;
    const nat = NATIVE.map((id) => {
      ratio[id].push(ohne.mean[id] > 0 ? mit.mean[id] / ohne.mean[id] : (mit.mean[id] > 0 ? 1 : 0));
      return `${short[id]} ${Math.round(mit.mean[id])}/${Math.round(ohne.mean[id])}`;
    }).join(' · ');
    const ext = Object.keys(mit.extinct).map((id) => short[id] + ' J' + mit.extinct[id]).join(', ');
    console.log(`  ${seed}: Schafe ${sheep ? '✓' : '✗'} ${mit.end.schaf} (Spitze ${mit.peak.schaf}, Herden ${mit.herds.join('/') || '-'})` +
      ` · Hunde ${dogs ? '✓' : '✗'} ${mit.end.hund} (${mit.dogPacks} Rudel, Spitze ${mit.peak.hund}) · ${nat}` +
      (ext ? '  ✗ ' + ext : '') + `\n          Ausbrüche ${mit.escapes.join(' ')} · Tod Schafe ${JSON.stringify(mit.deaths.schaf)} · Hunde ${JSON.stringify(mit.deaths.hund)}` +
      (/jagen/i.test(karten) ? `\n          Erlegt ${Object.entries(mit.hunt.bag).map(([id, n]) => short[id] + ' ' + n).join(', ') || '-'}` +
        ` · Angriffe auf Jäger ${mit.hunt.attacks.total} (Jäger tot ${mit.hunt.attacks.hunters}, Wolf tot ${mit.hunt.attacks.wolves})` : ''));
  }
  console.log(`Schafe etabliert: ${sheepOk} von ${SEEDS} · Hunde etabliert: ${dogOk} von ${SEEDS}`);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  console.log('Heimische Arten mit Karten gegenüber nur Landung (Median): ' +
    NATIVE.map((id) => short[id] + ' ' + Math.round(med(ratio[id]) * 100) + ' %').join(' · '));
}
startNext(report);
for (let k = 1; k < JOBS; k++) startNext(report);
