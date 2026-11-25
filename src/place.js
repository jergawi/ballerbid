/* ---------- automatic placement ----------
 A won card goes straight onto the roster; nobody has to pick a spot mid-auction. After every sale the buyer's whole
 roster is re-arranged: the best starting five by value and position fit, the rest on the bench with roles. Starter
 spots stay open when no owned player fits them well, so "open spots" keep meaning "what this team still needs".
 Players fine-tune everything in the lineup screen (drag to swap, tap a bench role), so this choice never locks
 anyone in. Slot missions (e.g. a classic center at C) get a nudge so the arrangement already shows them done.
 The same search scores hypothetical rosters for the AI opponents (bot.js), so they judge needs exactly this way. */
const PLACE_PEN = [0, 0.6, 2.2, 4.5], // value lost playing a position: natural / can play / stretch / wrong
  PLACE_BENCH = 0.3, // bench players count for less than starters
  PLACE_STAY = 0.05, // tie-break: leave players where they are
  PLACE_MIS = 1.5, // nudge for the player a slot mission needs
  PLACE_NAT = 0.1; // tie-break: closer to his listed position (Jordan SG, not PG)
// distance from his listed position; moving down (a SG at PG) costs a little more than moving up (to SF)
const natGap = d => PLACE_NAT * (d < 0 ? 1.3 : 1) * Math.abs(d);
const slotMisOf = (g, s) => {
  const M = g.mis && g.mis[s],
    m = M && M.pick != null ? misOf(M.opts[M.pick].id) : null;
  return m && m.k === 'slot' ? m : null;
};
/* best arrangement of a list of players. L: [{p, v (value), slot (current, for the stay tie-break), flex (fits anywhere)}]
   empty: what an open starter spot is worth (a future buy from this deck). Returns {score, A}: A[j] is the index in L
   starting at POS[j] (-1 = open); everyone else is on the bench */
function placeSearch(g, L, slotMis, empty) {
  const cap = SLOTS(g).length - POS.length;
  const fit = (x, sl, j) => (x.flex ? 0 : PLACE_PEN[Math.min(3, posInfo(x.p, sl).tier)] + natGap(j + 1 - peOf(x.p)));
  const sc = POS.map((sl, j) =>
    L.map(
      x =>
        x.v -
        fit(x, sl, j) +
        (x.slot === sl ? PLACE_STAY : 0) +
        (slotMis && !x.flex && slotMis.slot === sl && slotMis.f(x.p) ? PLACE_MIS : 0)
    )
  );
  const benchSc = L.map(x => PLACE_BENCH * x.v + (x.slot && isBench(x.slot) ? PLACE_STAY : 0));
  // exhaustive search: each starter spot takes an unused player or stays open (at most 11^5 leaves for 10-man)
  let best = -Infinity,
    bestA = null;
  const A = [],
    used = L.map(() => false);
  (function go(j, tot, n) {
    if (j === POS.length) {
      if (L.length - n > cap) return;
      let t = tot;
      L.forEach((_, i) => {
        if (!used[i]) t += benchSc[i];
      });
      if (t > best) {
        best = t;
        bestA = A.slice();
      }
      return;
    }
    for (let i = 0; i < L.length; i++)
      if (!used[i]) {
        used[i] = true;
        A[j] = i;
        go(j + 1, tot + sc[j][i], n + 1);
        used[i] = false;
      }
    if (L.length - n <= cap + POS.length - j - 1) {
      A[j] = -1;
      go(j + 1, tot + empty, n);
    }
  })(0, 0, 0);
  return { score: best, A: bestA };
}
const placeVal = p => (p.fa ? -1 : pval(p));
// an open spot is worth a modest card still to come (lower quartile of the rest of the deck), so a decent buy starts
// rather than sitting on the bench waiting for stars that may go elsewhere
function placeEmpty(g) {
  const v = g.items
    .slice((g.idx | 0) + 1)
    .filter(p => !p.fa)
    .map(pval)
    .sort((a, b) => a - b);
  return v.length ? v[v.length >> 2] : -1;
}
function autoPlace(g, s) {
  const E = g.rosters[s];
  if (!E.length) return;
  const { A } = placeSearch(
    g,
    E.map(r => ({ p: g.items[r.k], v: placeVal(g.items[r.k]), slot: r.slot })),
    slotMisOf(g, s),
    placeEmpty(g)
  );
  const onB = E.filter((_, i) => !A.includes(i)).sort((a, b) => pval(g.items[b.k]) - pval(g.items[a.k]));
  A.forEach((i, j) => {
    if (i >= 0) {
      E[i].slot = POS[j];
      delete E[i].role;
    }
  });
  onB.forEach((r, j) => {
    r.slot = BENCH[j];
    r.role = natRole(g.items[r.k]);
  });
  benchFix(g, s);
}
// short "where did he go" note for the sale toast
const placeNote = (g, s, k) => {
  const e = g.rosters[s].find(r => r.k === k);
  return !e ? '' : isBench(e.slot) ? roleLab(e.role) : '先發 ' + e.slot;
};
