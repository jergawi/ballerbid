/* ---------- matchup model ----------
 Base: OBPM+DBPM (Box Plus/Minus, Basketball-Reference), shrunk toward replacement level for small samples.
 Calibration (1985-2025, 1,230 real team-seasons): the top-5 BPM sum explains SRS with R²=0.73 at 0.79 pts per BPM;
 adding usage/playmaker/rebounding/rim-protection fit terms raised R² by only 0.001, so those are dropped except a mild
 usage-overlap penalty for fantasy lineups far outside the real range. Positions, matchups and chemistry are game rules. */
const REPL = { obpm: -1.5, dbpm: -0.5, usg: 18, astp: 12, trbp: 10, blkp: 1, stlp: 1.5 };
const KMIN = 800,
  MARGIN = 0.79,
  GSD = 12.7;
const shr = (v, p, prior) => {
  const m = num(p.mp, 20) * num(p.g, 40);
  return (num(v, prior) * m + prior * KMIN) / (m + KMIN);
};
const st = p => ({
  pts: num(p.pts, 8),
  trb: num(p.trb, num(p.trbp, 10) * 0.45),
  ast: num(p.ast, num(p.astp, 12) * 0.25),
  stl: num(p.stl, num(p.stlp, 1.5) * 0.55),
  blk: num(p.blk, num(p.blkp, 1) * 0.5),
  tov: num(p.tov, 0.11 * num(p.pts, 8) + 0.15 * num(p.ast, 2) + 0.5)
});
const crea = p => clamp((num(p.usg, 18) - 15) / 15, 0, 1) * 0.6 + clamp((num(p.astp, 12) - 10) / 30, 0, 1) * 0.4;
const postS = p => clamp((num(p.trbp, 10) - 8) / 12, 0, 1) * 0.5 + clamp((num(p.usg, 18) - 15) / 15, 0, 1) * 0.5;
const rebS = p => clamp((num(p.trbp, 10) - 8) / 12, 0, 1);
// floor spacing: 3PA per game × 3P% (Kevin Love, Towns, Porziņģis ≈1; Shaq, Gobert, Duncan ≈0)
const spc = p => clamp((num(p.tpa, 0) - 0.8) / 3.5, 0, 1) * clamp((num(p.tp, 0) - 0.3) / 0.07, 0, 1);
// one player's multipliers in a slot, optionally against a specific opponent in the same slot
function playerFx(p, q) {
  const m = { pts: 1, reb: 1, ast: 1, stl: 1, blk: 1, tov: 1, off: 0, def: 0, why: [] };
  const pi = posInfo(p, p.slot);
  if (pi.x > 0) {
    if (pi.dir > 0) {
      m.blk *= 1 - 0.15 * pi.x;
      m.tov *= 1 + 0.1 * pi.x;
      m.def -= 1.2 * pi.x;
      m.why.push('size');
    } else {
      m.tov *= 1 + 0.4 * pi.x;
      m.ast *= 1 - 0.1 * pi.x;
      m.stl *= 1 - 0.1 * pi.x;
      m.off -= 1.2 * pi.x;
      m.why.push('handle');
    }
  }
  if (q) {
    const gap = peOf(q) - peOf(p);
    if (Math.abs(gap) >= 0.75) {
      const ge = Math.min(1.5, Math.abs(gap));
      if (gap > 0) {
        m.pts *= 1 + 0.1 * ge * crea(p);
        m.reb *= 1 - 0.06 * ge;
        m.why.push('speed');
      } else {
        m.pts *= 1 + 0.08 * ge * postS(p);
        m.reb *= 1 + 0.08 * ge * rebS(p);
        m.why.push('post');
      }
    }
    // stretch big vs traditional big (PF/C only). Spacing helps the shooter score; standing at the arc costs him only
    // offensive boards (about a quarter of a big's rebounds), so his rebounding stays his own - a Towns who rebounds
    // like a center keeps doing so. The traditional big guarding him is dragged out to the arc: fewer blocks and a
    // few fewer defensive boards, because he is no longer under the rim.
    if (POS.indexOf(p.slot) >= 3) {
      const ds = spc(p) - spc(q);
      if (ds >= 0.3) {
        m.pts *= 1 + 0.06 * ds;
        m.reb *= 1 - 0.03 * ds;
        m.why.push('stretch');
      } else if (ds <= -0.3) {
        const a = -ds;
        m.blk *= 1 - 0.25 * a;
        m.reb *= 1 - 0.03 * a;
        m.why.push('pulled');
      }
    }
  }
  return m;
}
function fxPoints(p, m) {
  const b = st(p);
  const off =
    b.pts * (m.pts - 1) + 0.4 * b.ast * (m.ast - 1) - 1.0 * b.tov * (m.tov - 1) + 0.3 * b.trb * (m.reb - 1) + m.off;
  const def = 1.0 * b.stl * (m.stl - 1) + 0.6 * b.blk * (m.blk - 1) + 0.3 * b.trb * (m.reb - 1) + m.def;
  return { off, def };
}
// bench (夢幻隊 10-man mode): each bench player is worth ~25% of a starter, measured against replacement level,
// so a 5-man team (whose bench is implicitly replacement level) and a 10-man team with a replacement bench rate the same
/* temper & fouls (10-man mode). Hot heads = players known for technical-foul totals or on-court fights.
   Foul trouble comes from personal fouls per 36 minutes in the player's window. Kept small on purpose:
   an ejection costs about a point of margin in that one game, so these players stay worth buying. */
const HOT = new Set([
  'wallara01',
  'couside01',
  'greendr01',
  'westbru01',
  'howardw01',
  'rodmade01',
  'laimbbi01',
  'barklch01',
  'artesro01',
  'garneke01',
  'jacksst02',
  'brookdi01',
  'perkike01',
  'mahorri01',
  'oaklech01'
]);
const foulK = p => clamp((num(p.pf36, 3.2) - 3.6) / 2, 0, 1);
const isHot = p => !!p && HOT.has(p.id),
  foulProne = p => num(p.pf36, 0) >= 4.6;
const pval = p => shr(p.obpm, p, REPL.obpm) + shr(p.dbpm, p, REPL.dbpm);
function incidents(R, side, r) {
  const out = [],
    used = new Set();
  const bench = benchOf(R)
    .slice()
    .sort((x, y) => pval(y) - pval(x));
  const sub1 = p => {
    const b = subFor(p.slot, bench, used);
    if (b) used.add(b.n);
    return b;
  };
  starters(R).forEach(p => {
    const k = foulK(p),
      hot = isHot(p),
      u = r(),
      v = r();
    let inc = null;
    if (hot && u < 0.05) inc = { kind: 'eject', q: 1 + Math.floor(r() * 3), t: 0.15 + 0.7 * r() };
    else if (v < 0.005 + 0.1 * k) inc = { kind: 'foulout', q: 3, t: 0.25 + 0.65 * r() };
    else if (v < 0.035 + 0.25 * k) inc = { kind: 'trouble', q: 1 + Math.floor(r() * 2), t: 0.3 + 0.5 * r() };
    else if (hot && u < 0.3) inc = { kind: 'tech', q: Math.floor(r() * 4), t: 0.1 + 0.8 * r() };
    if (!inc) return;
    inc.side = side;
    inc.n = p.n;
    if (inc.kind === 'tech') {
      out.push(inc);
      return;
    }
    const s = sub1(p);
    inc.sub = s ? s.n : null;
    inc.lost = inc.kind === 'trouble' ? 0.12 : Math.max(0.05, (4 - (inc.q + inc.t)) / 4);
    inc.cost = +((Math.max(0, pval(p) - (s ? pval(s) : REPL.obpm + REPL.dbpm)) + 0.6) * inc.lost * 0.8).toFixed(2);
    out.push(inc);
  });
  return out;
}
function baseRate(Rall, g, leftover) {
  const R = starters(Rall),
    Bn = benchOf(Rall);
  const O = R.reduce((t, p) => t + shr(p.obpm, p, REPL.obpm), 0),
    D = R.reduce((t, p) => t + shr(p.dbpm, p, REPL.dbpm), 0);
  const bv = benchValue(Bn),
    benchAdj = bv.adj;
  const U = R.reduce((t, p) => t + num(p.usg, REPL.usg), 0),
    usgAdj = -0.05 * Math.max(0, U - 110);
  const ch = chem(Rall, g),
    savAdj = Math.min(SAVE_CAP, SAVE_PT * Math.max(0, leftover || 0));
  const off = O + usgAdj + ch.tm / 2 + ch.lgv / 2 - 0.6 * ch.fd + savAdj / 2 + benchAdj / 2,
    def = D + ch.tm / 2 + ch.lgv / 2 + ch.sw - 0.4 * ch.fd + savAdj / 2 + benchAdj / 2;
  return {
    bv,
    O,
    D,
    U,
    usgAdj,
    tmAdj: ch.tm,
    lgAdj: ch.lgv,
    swAdj: ch.sw,
    fdAdj: -ch.fd,
    savAdj,
    benchAdj,
    off,
    def,
    net: off + def,
    ch
  };
}
function pairRate(base, R, Ropp) {
  let o = 0,
    d = 0;
  const per = [];
  starters(R).forEach(p => {
    const q = Ropp ? Ropp.find(x => x.slot === p.slot) : null;
    const m = playerFx(p, q);
    const f = fxPoints(p, m);
    o += f.off;
    d += f.def;
    per.push({ p, q, m, f });
  });
  return { off: base.off + o, def: base.def + d, posAdj: o + d, per };
}
const strength = (R, g, leftover) => {
  const b = baseRate(R, g, leftover);
  return b.net + pairRate(b, R, null).posAdj;
};
function percentile(g, R, val) {
  const r = rng(hash(g.gid + 'pct'));
  const pool = g.pool;
  let below = 0,
    N = 300;
  const sz = g.size === 10 ? 10 : 5;
  for (let i = 0; i < N; i++) {
    const sh = shuffle(pool, r),
      pick = sh
        .slice(0, 5)
        .sort((a, b) => peOf(a) - peOf(b))
        .map((p, j) => ({ ...p, slot: POS[j] }))
        .concat(sh.slice(5, sz).map((p, j) => ({ ...p, slot: BENCH[j] })));
    if (strength(pick, g, 0) < val) below++;
  }
  return Math.round((below / N) * 100);
}
function grade(pct) {
  return pct >= 90 ? 'S' : pct >= 70 ? 'A' : pct >= 40 ? 'B' : pct >= 15 ? 'C' : 'D';
}
function rosterOf(g, s) {
  const L = SLOTS(g);
  return g.rosters[s]
    .map(r => ({ ...g.items[r.k], slot: r.slot, price: r.price, role: r.role }))
    .sort((a, b) => L.indexOf(a.slot) - L.indexOf(b.slot));
}
function alloc(total, weights) {
  const W = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => (w / W) * total);
  const fl = raw.map(Math.floor);
  let rem = total - fl.reduce((a, b) => a + b, 0);
  raw
    .map((x, i) => [x - fl[i], i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (rem > 0) {
        fl[i]++;
        rem--;
      }
    });
  return fl;
}
const Phi = x => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x)),
    d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};
function gauss(r) {
  let u = 0,
    v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const withBench = (R, per) =>
  per.concat(benchOf(R).map(p => ({ p, m: playerFx(p, null), bench: 1, bw: (BROLE[p.role] || BROLE.G).mins })));
// minutes shift after foul trouble / foul-out / ejection: the starter loses the time, his sub picks it up
function withMins(per, inc) {
  return per.map(x => {
    let play = 1,
      extra = 0;
    (inc || []).forEach(i => {
      if (i.kind === 'tech') return;
      if (i.n === x.p.n) play -= i.lost;
      if (i.sub && i.sub === x.p.n) extra += i.lost;
    });
    return play === 1 && !extra ? x : { ...x, play: Math.max(0.05, play), extra };
  });
}
/* breakout nights: now and then a role player (lower half of his roster by value) has the game of his life.
   About 8% per team per game; his team gets a few extra points that night and he takes a big share of the scoring. */
const BO_P = 0.08;
function boCands(R, gi) {
  const v = R.filter(p => !p.fa)
      .map(p => pval(p))
      .sort((a, b) => a - b),
    med = v[Math.floor(v.length / 2)];
  const out = new Set((gi || []).filter(i => i.kind === 'eject' || i.kind === 'foulout').map(i => i.n));
  return R.filter(p => !p.fa && pval(p) < med && !out.has(p.n));
}
/* star takeovers: a star (MVP, Finals MVP, 2+ All-NBA 1st teams or 8+ All-Star games) sometimes
   takes over a single game. Rate per star per game ~5-7%, a bit higher in his prime, lower as a rookie or late in
   his career. That night his team gets ~4 extra points and he takes well over his usual share of the scoring.
   Shown on the card as 爆發型. Bots value cards on the regular numbers only. */
const TK_PTS = 4;
function tkRate(p) {
  if (!p || p.fa) return 0;
  const b = bioOf(p) || {};
  let v = b.mvp > 0 ? 0.065 : b.all1 >= 2 || b.as >= 8 || b.fmvp ? 0.05 : 0;
  if (!v) return 0;
  const ph = typeof phaseOf === 'function' ? phaseOf(p) : null;
  return v * ({ prime: 1.15, early: 0.85, late: 0.7, rook: 0.6 }[ph] || 1);
}
/* a team's chance of a takeover in one game is capped at TK_TEAM: a roster of five MVPs (a Dream Team deck) should not
   turn the special night into a weekly event; the rates are scaled down together so who takes over stays fair */
const TK_TEAM = 0.25;
function tkPick(R, gi, r, mul) {
  const out = new Set((gi || []).filter(i => i.kind === 'eject' || i.kind === 'foulout').map(i => i.n)),
    rt0 = p => tkRate(p) * ((mul && mul[p.n]) || 1);
  const c = R.filter(p => !out.has(p.n) && tkRate(p) > 0),
    all = 1 - c.reduce((t, p) => t * (1 - rt0(p)), 1),
    sc = all > TK_TEAM ? Math.log(1 - TK_TEAM) / Math.log(1 - all) : 1,
    rt = p => 1 - Math.pow(1 - rt0(p), sc);
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  for (const p of c) if (r() < rt(p)) return p.n;
  return null;
}
function boxFor(R, per, score, r, bo, tk) {
  const mf = x => (x.bench ? x.bw || 0.35 : 1) * (x.play == null ? 1 : x.play) + (x.extra || 0),
    bx = (x, k) =>
      x.p.n === bo ? { reb: 1.3, ast: 1.3 }[k] || 1 : x.p.n === tk ? { reb: 1.15, ast: 1.25 }[k] || 1 : 1;
  const w = k =>
    per.map(x => {
      const b = st(x.p);
      return (
        mf(x) *
        bx(x, k) *
        {
          pts: Math.pow(Math.max(2, b.pts * x.m.pts), 0.65),
          reb: Math.max(1, b.trb * x.m.reb),
          ast: Math.max(0.5, b.ast * x.m.ast),
          stl: Math.max(0.2, b.stl * x.m.stl),
          blk: Math.max(0.1, b.blk * x.m.blk),
          tov: Math.max(0.3, b.tov * x.m.tov)
        }[k] *
        (0.75 + 0.5 * r())
      );
    });
  const tot = k =>
    per.reduce((t, x) => {
      const b = st(x.p);
      return t + b[k === 'reb' ? 'trb' : k] * x.m[k] * mf(x);
    }, 0);
  /* a big night is set as a share of the team's points rather than a multiplier, so it stays believable whatever the
     roster size: a takeover is about 30-40% of the scoring (at most ~50 points), a role player's career night a clear
     step above his usual share (at most ~40) */
  const wp = w('pts'),
    sum0 = wp.reduce((t, x) => t + x, 0),
    norm = i => wp[i] / sum0,
    share = (i, sh) => {
      if (i < 0 || sh <= norm(i)) return;
      const oth = wp.reduce((t, x, k) => (k === i ? t : t + x), 0);
      wp[i] = (oth * sh) / (1 - sh);
    },
    ti = tk ? per.findIndex(x => x.p.n === tk) : -1,
    bi = bo ? per.findIndex(x => x.p.n === bo) : -1,
    sc = Math.max(score, 60);
  if (ti >= 0) share(ti, Math.min(Math.max(norm(ti) + 0.1, 0.29 + 0.07 * r()), 0.42, 50 / sc));
  if (bi >= 0 && bi !== ti) share(bi, Math.min(Math.max(norm(bi) * 2.2, norm(bi) + 0.15), 0.3, 40 / sc));
  const pts = alloc(score, wp),
    reb = alloc(Math.round(clamp(tot('reb') * 1.05, 34, 58) + gauss(r) * 3), w('reb')),
    ast = alloc(Math.round(clamp(tot('ast'), 18, 32) + gauss(r) * 2), w('ast'));
  const stl = alloc(Math.round(clamp(tot('stl'), 4, 12) + r() * 2), w('stl')),
    blk = alloc(Math.round(clamp(tot('blk'), 2, 10) + r() * 2), w('blk')),
    tov = alloc(Math.round(clamp(tot('tov'), 8, 20) + gauss(r) * 2), w('tov'));
  return R.map((p, i) => {
    const m = per[i].m;
    return {
      n: p.n,
      slot: p.slot,
      pts: pts[i],
      reb: reb[i],
      ast: ast[i],
      stl: stl[i],
      blk: blk[i],
      tov: tov[i],
      m: {
        pts: +m.pts.toFixed(2),
        reb: +m.reb.toFixed(2),
        ast: +m.ast.toFixed(2),
        tov: +m.tov.toFixed(2),
        stl: +m.stl.toFixed(2),
        blk: +m.blk.toFixed(2)
      }
    };
  });
}
function simulate(S) {
  const g = S.game,
    sides = g.sides,
    ro = {},
    base = {},
    teams = {};
  tacResolve(g);
  const TR = g.tacR;
  sides.forEach(s => {
    ro[s] = rosterOf(g, s);
    base[s] = baseRate(ro[s], g, left(g, s));
  });
  sides.forEach(s => {
    const sv = base[s].net + pairRate(base[s], ro[s], null).posAdj;
    const pct = percentile(g, ro[s], sv);
    const mb = (g.misRes && g.misRes[s] && g.misRes[s].bonus) || 0;
    base[s].misAdj = mb;
    base[s].off += mb / 2;
    base[s].def += mb / 2;
    base[s].net += mb;
    const hc = homeAdj(g, s);
    base[s].hcAdj = hc;
    base[s].off += hc / 2;
    base[s].def += hc / 2;
    base[s].net += hc;
    teams[s] = {
      strength: +(sv + mb + hc).toFixed(2),
      pct,
      grade: grade(pct),
      base: Object.fromEntries(
        [
          'O',
          'D',
          'U',
          'usgAdj',
          'tmAdj',
          'lgAdj',
          'swAdj',
          'fdAdj',
          'savAdj',
          'benchAdj',
          'misAdj',
          'hcAdj',
          'net'
        ].map(k => [k, +(base[s][k] || 0).toFixed(2)])
      ),
      chem: base[s].ch,
      sw: 0,
      gw: 0,
      gl: 0,
      posSum: 0,
      posN: 0,
      tacAdj: +(TR[s].fit + TR[s].helio).toFixed(2),
      tac: { o: TR[s].o, d: TR[s].d }
    };
  });
  const series = [];
  for (let i = 0; i < sides.length; i++)
    for (let j = i + 1; j < sides.length; j++) {
      const a = sides[i],
        b = sides[j];
      const ra = pairRate(base[a], ro[a], ro[b]),
        rb = pairRate(base[b], ro[b], ro[a]);
      teams[a].posSum += ra.posAdj;
      teams[a].posN++;
      teams[b].posSum += rb.posAdj;
      teams[b].posN++;
      // tactics: fixed edge (fit + star system) plus each offense's counter against the other's defense; every game
      // draws its own execution (0.6-1.4) and a coach whose team lost a game takes 20% off the winner's counter edge
      const TA = TR[a],
        TB = TR[b],
        ea = TA.fit + TA.helio,
        eb = TB.fit + TB.helio,
        ca = tacCounter(TA, TB),
        cb = tacCounter(TB, TA),
        rtac = rng(hash(g.gid + a + b + 'tac'));
      let adjA = 1,
        adjB = 1;
      const sdA = 9 * (1 + TAC_VAR_O[TA.o] + TAC_VAR_D[TB.d]),
        sdB = 9 * (1 + TAC_VAR_O[TB.o] + TAC_VAR_D[TA.d]),
        gsd = Math.hypot(sdA, sdB);
      const mulA = TA.o === 'helio' && TA.F.star ? { [TA.F.star]: TK_HELIO } : null,
        mulB = TB.o === 'helio' && TB.F.star ? { [TB.F.star]: TK_HELIO } : null,
        tg2 = [];
      const margin = MARGIN * (ra.off + ra.def - (rb.off + rb.def)),
        avg = 112 + (0.2 * (ra.off - rb.def + (rb.off - ra.def))) / 2;
      const p = Phi((margin + MARGIN * (ea + ca - (eb + cb))) / gsd),
        r = rng(hash(g.gid + a + b)),
        ri = rng(hash(g.gid + a + b + 'inc')),
        rbo = rng(hash(g.gid + a + b + 'bo')),
        rtk = rng(hash(g.gid + a + b + 'tk'));
      let wa = 0,
        wb = 0;
      const games = [],
        inc = [],
        bo = [],
        tk = [];
      while (wa < 4 && wb < 4) {
        const gi = g.size === 10 ? incidents(ro[a], a, ri).concat(incidents(ro[b], b, ri)) : [];
        inc.push(gi);
        const xa = 0.6 + 0.8 * rtac(),
          xb = 0.6 + 0.8 * rtac(),
          ta = xa * (ea + ca * adjA),
          tb = xb * (eb + cb * adjB);
        tg2.push({
          ta: +ta.toFixed(2),
          tb: +tb.toFixed(2),
          ca: +(xa * ca * adjA).toFixed(2),
          cb: +(xb * cb * adjB).toFixed(2)
        });
        const ia = gi.filter(x => x.side === a).reduce((t, x) => t + (x.cost || 0), 0),
          ib = gi.filter(x => x.side === b).reduce((t, x) => t + (x.cost || 0), 0),
          mg = margin + MARGIN * (ib - ia) + MARGIN * (ta - tb);
        const bg = {};
        [a, b].forEach(s => {
          if (rbo() < BO_P) {
            const c = boCands(ro[s], gi);
            if (c.length) bg[s] = c[Math.floor(rbo() * c.length)].n;
          }
        });
        bo.push(bg);
        const tg = {};
        [a, b].forEach(s => {
          const n = tkPick(ro[s], gi, rtk, s === a ? mulA : mulB);
          if (n) tg[s] = n;
        });
        tk.push(tg);
        let sa = Math.round(avg + mg / 2 + gauss(r) * sdA) + (bg[a] ? 3 : 0) + (tg[a] ? TK_PTS : 0),
          sb = Math.round(avg - mg / 2 + gauss(r) * sdB) + (bg[b] ? 3 : 0) + (tg[b] ? TK_PTS : 0),
          ot = 0;
        if (Math.abs(sa - sb) === 1 && r() < 0.55) {
          sa = sb = Math.max(sa, sb);
        }
        /* NBA goes to OT ~6% of games; a raw gaussian tie alone gives ~2% */ while (sa === sb) {
          ot++;
          sa += Math.round(5 + r() * 8);
          sb += Math.round(5 + r() * 8);
        }
        games.push([sa, sb, ot]);
        if (sa > sb) {
          wa++;
          if (ca > 0) adjA *= 0.8;
        } else {
          wb++;
          if (cb > 0) adjB *= 0.8;
        }
      }
      let pser = 0;
      const C = (n, k) => {
        let x = 1;
        for (let t = 1; t <= k; t++) x = (x * (n - k + t)) / t;
        return x;
      };
      for (let l = 0; l <= 3; l++) pser += C(3 + l, l) * Math.pow(p, 4) * Math.pow(1 - p, l);
      const win = wa > wb ? a : b,
        fav = p >= 0.5 ? a : b,
        last = games[games.length - 1];
      const li = inc[inc.length - 1] || [],
        pa = withMins(withBench(ro[a], ra.per), li),
        pb = withMins(withBench(ro[b], rb.per), li);
      const lb = bo[bo.length - 1] || {},
        lt = tk[tk.length - 1] || {},
        box = {
          [a]: boxFor(
            pa.map(x => x.p),
            pa,
            last[0],
            r,
            lb[a],
            lt[a]
          ),
          [b]: boxFor(
            pb.map(x => x.p),
            pb,
            last[1],
            r,
            lb[b],
            lt[b]
          )
        };
      const mu = POS.map(sl => {
        const x = ra.per.find(z => z.p.slot === sl),
          y = rb.per.find(z => z.p.slot === sl);
        if (!x || !y) return null;
        if (!x.m.why.length && !y.m.why.length) return null;
        return {
          slot: sl,
          a: x.p.n,
          b: y.p.n,
          ma: x.m,
          mb: y.m,
          fa: +(x.f.off + x.f.def).toFixed(2),
          fb: +(y.f.off + y.f.def).toFixed(2)
        };
      }).filter(Boolean);
      teams[win].sw++;
      teams[a].gw += wa;
      teams[a].gl += wb;
      teams[b].gw += wb;
      teams[b].gl += wa;
      const r2o = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(2)])),
        tacS = s => ({
          o: TR[s].o,
          d: TR[s].d,
          F: { O: r2o(TR[s].F.O), D: r2o(TR[s].F.D), star: TR[s].F.star, starGap: +TR[s].F.starGap.toFixed(2) },
          fit: TR[s].fit,
          helio: TR[s].helio
        });
      series.push({
        a,
        b,
        wa,
        wb,
        games,
        inc,
        bo,
        tk,
        tac: { [a]: tacS(a), [b]: tacS(b) },
        tg: tg2,
        p: +p.toFixed(3),
        pser: +pser.toFixed(3),
        win,
        fav,
        upset: win !== fav && Math.abs(p - 0.5) > 0.05,
        box,
        mu,
        pa: +ra.posAdj.toFixed(2),
        pb: +rb.posAdj.toFixed(2)
      });
    }
  sides.forEach(s => {
    teams[s].posAdj = +(teams[s].posSum / Math.max(1, teams[s].posN)).toFixed(2);
  });
  const order = [...sides].sort(
    (x, y) =>
      teams[y].sw - teams[x].sw ||
      teams[y].gw - teams[y].gl - (teams[x].gw - teams[x].gl) ||
      teams[y].strength - teams[x].strength
  );
  // MVP from champion's deciding-game boxes
  const champ = order[0];
  let mvp = null;
  series
    .filter(z => z.a === champ || z.b === champ)
    .forEach(z =>
      z.box[champ].forEach(x => {
        const v = x.pts + x.reb * 1.2 + x.ast * 1.5 + x.stl * 2 + x.blk * 2;
        if (!mvp || v > mvp.v) mvp = { ...x, v };
      })
    );
  return { teams, series, order, champ, mvp };
}
