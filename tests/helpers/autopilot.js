// Autopilot for Sky Siege, driven entirely through window.__sky.
// runBattle() is serialized and executed inside the page by Playwright, so it
// must be self-contained (no closures over Node-side variables).
//
// Determinism: Math.random is replaced with a seeded PRNG right before start(),
// and the whole battle runs synchronously inside one evaluate() call, so no
// requestAnimationFrame frame can interleave and consume random numbers.
// Same seed + same game code => bit-identical result.

// collect: also return every floating text and castle label seen (read-only; for language tests).
export function runBattle({ mode, diff, seed = 1, maxSeconds = 200, dt = 1 / 60, collect = false }) {
  // mulberry32
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const S = window.__sky;
  document.querySelector(`#modeSeg button[data-m="${mode}"]`).click();
  document.querySelector(`#diffSeg button[data-d="${diff}"]`).click();
  S.start();

  const GROUND = 1000, COL = 40, BOMB_G = 430;
  const HOME = { x0: 170, x1: 270, top: 800 };
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const top = c => GROUND - Math.max(...c.heights) * COL;
  const mid = c => c.x0 + (c.heights.length * COL) / 2;
  const right = c => c.x0 + c.heights.length * COL;

  function pilot(G) {
    const me = G.me, inp = S.input;
    inp.up = inp.down = false;
    if (me.dead) return;
    const foe = G.foe, attack = me.bombs > 0;
    let tx, alt;
    if (attack) { tx = mid(foe); alt = top(foe) - 160; }
    else if (G.duel) { tx = mid(G.mine); alt = top(G.mine) - 100; }
    else { tx = (HOME.x0 + HOME.x1) / 2; alt = Math.abs(me.x - tx) < 600 ? HOME.top - 95 : top(foe) - 160; }
    alt = clamp(alt, 150, GROUND - 170);

    const dx = tx - me.x, want = Math.sign(dx) || me.facing;
    if (me.flip === 0 && want !== me.facing && Math.abs(dx) > (attack ? 250 : 90)) S.press('flip');

    const dirx = me.facing * Math.cos(me.p), diry = -Math.sin(me.p);
    let desired = clamp((me.y - alt) * 0.004, -0.45, 0.45);
    if (me.s < me.st.vstall * 1.18) desired = Math.min(desired, -0.2);
    const ahead = me.x + dirx * 140;
    for (const c of G.castles) if (ahead > c.x0 - 30 && ahead < right(c) + 30 && me.y > top(c) - 70) desired = 0.6;
    if (!G.duel && ahead > HOME.x0 - 30 && ahead < HOME.x1 + 30 && me.y > HOME.top - 50) desired = 0.6;
    if (me.y > GROUND - 170) desired = 0.6;
    if (me.p < desired - 0.05) inp.up = true; else if (me.p > desired + 0.05) inp.down = true;

    if (attack && me.facing === want && me.flip === 0 && me.bombCD <= 0) {
      const vx = dirx * me.s * 0.9, vy = diry * me.s * 0.9 + me.vz + 20;
      const h = top(foe) + 60 - (me.y + 12), disc = vy * vy + 2 * BOMB_G * h;
      if (h > 0 && disc > 0) {
        const t = (-vy + Math.sqrt(disc)) / BOMB_G;
        if (Math.abs(me.x + vx * t - tx) < 40) S.press('bomb');
      }
    }
  }

  const maxSteps = Math.round(maxSeconds / dt);
  let steps = 0;
  const seen = new Set();
  while (steps < maxSteps) {
    const G = S.G;
    if (!G || G.state === 'wonDone' || G.state === 'lostDone') break;
    pilot(G);
    S.step(1, dt);
    steps++;
    if (collect && S.G) { for (const f of S.G.floaters) seen.add(f.text); for (const c of S.G.castles) seen.add(c.label); }
  }
  const G = S.G;
  const r = x => Math.round(x * 1000) / 1000;
  return {
    mode, diff, seed, steps,
    state: G.state,
    ended: G.state === 'wonDone' || G.state === 'lostDone',
    t: r(G.t),
    winTime: G.winTime === undefined ? null : r(G.winTime),
    timeUp: !!G.timeUp,
    foeHp: r(G.foe.hp), foeMax: G.foe.max,
    mineHp: G.mine ? r(G.mine.hp) : null,
    meHp: r(G.me.hp), meDowns: G.me.downs,
    botDowns: G.botDowns, killedDefs: G.killedDefs,
    coins: S.prog.coins, xp: S.prog.xp,
    resultVisible: !document.getElementById('resultScreen').classList.contains('hidden'),
    ...(collect ? { texts: [...seen] } : {}),
  };
}

export const MATRIX = ['duel', 'campaign'].flatMap(mode => ['easy', 'medium', 'hard'].map(diff => ({ mode, diff })));
