/**
 * Abstimmwerkzeug: rechnet mehrere Inseln ueber viele Jahre ohne Grafik und
 * meldet, ob das Oekosystem haelt.
 *
 *   node tools/balance.js [seeds=6] [jahre=30] [--verlauf] [--size=mittel] [--seed=1000]
 *
 * --verlauf  zeigt fuer den ersten Seed die Bestaende am Ende jedes Jahres
 */
const { load } = require('./load.js');
const BT = load();

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const pos = args.filter((a) => !a.startsWith('--'));
const SEEDS = +(pos[0] || 6);
const YEARS = +(pos[1] || 30);
const size = flags.size || 'mittel';
const ids = BT.SPECIES_ORDER;
const short = { zwerghirsch: 'Hirsch', laufvogel: 'Vogel', inselwolf: 'Wolf', inseladler: 'Adler' };

const summary = [];
for (let s = 0; s < SEEDS; s++) {
  const seed = flags.seed ? +flags.seed + s * 7919 : 1000 + s * 7919;
  const world = BT.World.generate(seed, { size });
  const t0 = Date.now();
  const sim = new BT.Simulation(world);
  const yearly = [];
  for (let y = 0; y < YEARS; y++) {
    sim.runDays(BT.Time.DAYS_PER_YEAR);
    const r = sim.stats.latest();
    yearly.push(r);
    if (ids.every((id) => r.count[id] === 0)) break;
  }
  const ms = Date.now() - t0;
  const hist = sim.stats.history;
  const range = {};
  for (const id of ids) {
    const vals = hist.slice(Math.floor(hist.length / 3)).map((r) => r.count[id]);
    range[id] = [Math.min(...vals), Math.max(...vals)];
  }
  summary.push({ seed, sim, range, ms, years: yearly.length });

  if (flags.verlauf && s === 0) {
    console.log(`Seed ${seed}: Bestand am Jahresende (Jungtiere in Klammern) · Nahrung in %`);
    console.log('Jahr  ' + ids.map((id) => short[id].padStart(11)).join('') + '   Gras Laub Frucht Insekt');
    yearly.forEach((r, i) => {
      console.log(String(i + 1).padStart(4) + '  ' + ids.map((id) => `${r.count[id]}(${r.young[id]})`.padStart(11)).join('') +
        '   ' + BT.FOOD_ORDER.map((k) => String(Math.round(r.food[k] * 100)).padStart(5)).join(''));
    });
    console.log('Todesursachen:');
    for (const id of ids) console.log('  ' + short[id].padEnd(7) + JSON.stringify(sim.stats.deaths[id]) + '  Geburten ' + sim.stats.births[id]);
    console.log('');
  }
}

console.log(`${SEEDS} Inseln × ${YEARS} Jahre (${size})`);
for (const r of summary) {
  const ext = ids.filter((id) => r.sim.stats.extinct[id] != null).map((id) => short[id] + ' J' + BT.Time.calendar(r.sim.stats.extinct[id]).year);
  console.log(`  ${r.seed}: ` + ids.map((id) => `${short[id]} ${r.range[id][0]}–${r.range[id][1]}`).join(' · ') +
    (ext.length ? '  ✗ ausgestorben: ' + ext.join(', ') : '  ✓') + `  (${(r.ms / 1000).toFixed(1)} s)`);
}
const survived = summary.filter((r) => ids.every((id) => r.sim.stats.extinct[id] == null)).length;
console.log(`Alle Arten überlebt: ${survived} von ${SEEDS}`);
