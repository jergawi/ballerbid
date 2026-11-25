/* ---------- season ----------
 A season is 3/5/7 rounds with the same players and settings. Each round is a full game (new theme, new deck).
 Points: champion 3; 2 players – the loser gets 1 if the series went 7 games; 3 players – 2nd place 1.
 A completed mission adds 1 point (2 for ★★★). Ties: points → round titles → series W–L → total point differential.
 Catch-up (optional): the last round's champion bids with 10% less budget, the last-placed team(s) with 10% more. */
const SEASON_N = [3, 5, 7];
function seasonPts(g, sim) {
  const sides = g.sides,
    b = {};
  sides.forEach(s => (b[s] = 0));
  if (sides.length === 2) {
    const z = sim.series[0];
    b[sim.champ] = 3;
    const lo = sides.find(s => s !== sim.champ);
    if (z.games.length === 7) b[lo] = 1;
  } else {
    b[sim.order[0]] = 3;
    b[sim.order[1]] = 1;
  }
  return b;
}
function seasonTable(S) {
  const se = S.season || S.lastSeason;
  if (!se) return [];
  const sides = se.sides,
    T = {};
  sides.forEach(s => (T[s] = { s, pts: 0, titles: 0, sw: 0, sl: 0, gd: 0, mis: 0, misN: 0 }));
  se.rounds.forEach(R => {
    sides.forEach(s => {
      const p = R.pts[s];
      if (p) T[s].pts += p.t;
      T[s].gd += R.gd[s] || 0;
      if (R.mis && R.mis[s]) {
        T[s].misN++;
        if (R.mis[s].done) T[s].mis++;
      }
    });
    T[R.champ].titles++;
    R.ser.forEach(([a, b, wa, wb, , win]) => {
      T[win].sw++;
      T[win === a ? b : a].sl++;
    });
  });
  const L = Object.values(T).sort(
    (x, y) => y.pts - x.pts || y.titles - x.titles || y.sw - y.sl - (x.sw - x.sl) || y.gd - x.gd
  );
  L.forEach((x, i) => {
    const p = L[i - 1];
    x.rank =
      p && p.pts === x.pts && p.titles === x.titles && p.sw - p.sl === x.sw - x.sl && p.gd === x.gd ? p.rank : i + 1;
  });
  return L;
}
// budgets for the next round (catch-up rule)
function seasonBudgets(S) {
  const c = S.cfg,
    se = S.season,
    sd = sidesOf(c.players),
    b = {},
    adj = {},
    size = c.size === 10 ? 10 : 5;
  sd.forEach(s => (b[s] = c.budget));
  if (se && se.bal && se.rounds.length && !se.done) {
    const v = Math.max(1, Math.round(c.budget * 0.1)),
      last = se.rounds[se.rounds.length - 1];
    if (own(b, last.champ)) {
      b[last.champ] = Math.max(size, b[last.champ] - v);
      adj[last.champ] = b[last.champ] - c.budget;
    }
    const T = seasonTable(S),
      lo = Math.min(...T.map(x => x.pts)),
      lows = T.filter(x => x.pts === lo);
    if (lows.length < sd.length)
      lows.forEach(x => {
        if (x.s === last.champ || !own(b, x.s)) return;
        b[x.s] += v;
        adj[x.s] = (adj[x.s] || 0) + v;
      });
  }
  return { b, adj };
}
function seasonRecord(S) {
  const se = S.season;
  if (!se || se.done) return;
  const g = S.game,
    sim = S.sim,
    sides = g.sides;
  const base = seasonPts(g, sim),
    mr = g.misRes || {},
    pts = {};
  sides.forEach(s => {
    const m = mr[s] ? mr[s].pt : 0;
    pts[s] = { b: base[s], m, t: base[s] + m };
  });
  const gd = {};
  sides.forEach(s => (gd[s] = 0));
  sim.series.forEach(z =>
    z.games.forEach(([x, y]) => {
      gd[z.a] += x - y;
      gd[z.b] += y - x;
    })
  );
  const best = {};
  sides.forEach(s => {
    let b = null;
    rosterOf(g, s).forEach(p => {
      if (p.fa || !p.price) return;
      const v = pval(p) - (REPL.obpm + REPL.dbpm),
        val = v / p.price;
      if (!b || val > b.val) b = { n: p.n, price: p.price, v: +v.toFixed(1), val: +val.toFixed(2) };
    });
    best[s] = b;
  });
  se.rounds.push({
    k: se.rounds.length + 1,
    th: g.theme.name,
    champ: sim.champ,
    order: sim.order.slice(),
    pts,
    mis: mr,
    ser: sim.series.map(z => [z.a, z.b, z.wa, z.wb, z.pser, z.win, z.fav]),
    gd,
    bud: { ...(g.bud || {}) },
    spent: { ...g.spent },
    mvp: sim.mvp ? { n: sim.mvp.n, s: sim.champ } : null,
    best,
    str: Object.fromEntries(sides.map(s => [s, sim.teams[s].strength]))
  });
  if (se.rounds.length >= se.n) seasonEnd(S);
}
function seasonEnd(S) {
  const se = S.season;
  if (!se || se.done) return;
  se.done = true;
  se.endedAt = se.rounds.length;
  seasonTable(S)
    .filter(x => x.rank === 1)
    .forEach(x => {
      const k = scoreKey(S, x.s),
        o = S.scores[k] || { n: nm(S, x.s), w: 0 };
      o.n = nm(S, x.s);
      o.st = (o.st || 0) + 1;
      S.scores[k] = o;
    });
}
// season awards for the closing ceremony
function seasonAwards(S) {
  const se = S.season || S.lastSeason;
  if (!se || !se.rounds.length) return [];
  const T = seasonTable(S),
    A = [];
  const mv = {};
  se.rounds.forEach(R => {
    if (R.mvp) {
      const k = R.mvp.n;
      mv[k] = mv[k] || { n: k, s: R.mvp.s, c: 0 };
      mv[k].c++;
    }
  });
  const champs = new Set(T.filter(x => x.rank === 1).map(x => x.s)),
    mvl = Object.values(mv).sort((a, b) => b.c - a.c || (champs.has(b.s) ? 1 : 0) - (champs.has(a.s) ? 1 : 0));
  if (mvl.length) A.push({ ic: '⭐', t: '季賽 MVP', v: mvl[0].n, s: mvl[0].s, d: `拿下 ${mvl[0].c} 次冠軍 MVP` });
  if (se.mis) {
    const mx = Math.max(...T.map(x => x.mis));
    const w = T.filter(x => x.mis === mx);
    if (mx > 0 && w.length < T.length) {
      A.push({
        ic: '🎯',
        t: '任務王',
        v: w.map(x => nm(S, x.s)).join('、'),
        s: w.length === 1 ? w[0].s : null,
        d: `完成 ${mx} 個任務`
      });
    }
  }
  let bv = null;
  se.rounds.forEach(R =>
    Object.entries(R.best || {}).forEach(([s, b]) => {
      if (b && b.v > 0 && (!bv || b.val > bv.val)) bv = { ...b, s, k: R.k };
    })
  );
  if (bv) A.push({ ic: '💎', t: '最划算簽約', v: bv.n, s: bv.s, d: `第 ${bv.k} 局只花 $${bv.price}` });
  let up = null;
  se.rounds.forEach(R =>
    R.ser.forEach(([a, b, wa, wb, pser, win, fav]) => {
      if (win !== fav) {
        const pw = win === a ? pser : 1 - pser;
        if (pw < 0.4 && (!up || pw < up.pw)) up = { pw, win, los: win === a ? b : a, k: R.k };
      }
    })
  );
  if (up)
    A.push({
      ic: '😱',
      t: '最大爆冷',
      v: nm(S, up.win),
      s: up.win,
      d: `第 ${up.k} 局以 ${Math.round(up.pw * 100)}% 的系列賽勝率擊敗 ${nm(S, up.los)}`
    });
  const gd = T.slice().sort((a, b) => b.gd - a.gd)[0];
  if (gd && gd.gd > 0) A.push({ ic: '📈', t: '淨勝分最多', v: nm(S, gd.s), s: gd.s, d: `整季 +${gd.gd} 分` });
  return A;
}
