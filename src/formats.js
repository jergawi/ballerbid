/* ---------- auction formats & nominations ----------
 Every card ends the same way whatever the format: sold to one player at a price (sell) or passed (skipCard).
 Formats only decide how that result is reached, so slots, budgets, the last-team $1 rule, missions, extra cards and
 seasons keep working unchanged.
   open   – the original turn-by-turn bidding
   sealed – everyone bids once in secret; highest bid wins and pays it. A tie gets one sealed re-bid between the tied
            players (a silent player keeps the tied amount); a second tie goes to the team with more empty spots,
            then to the earlier player in this card's turn order.
   snatch – 降價搶標, a Dutch clock: the price starts high and drops $1 at a time; the first to tap buys at the price
            shown. Everyone sees the price at every moment; the skill is waiting versus losing the card. The clock runs a
            full descent in about 8 s (a very fast clock pushes prices down). Taps that reach the game within GRAB_WIN of
            the first one count as simultaneous and are settled by a seeded coin flip, so network delay does not decide.
 Nominations (optional): a market of up to MKT face-up cards; players take turns choosing which one goes up next.
 The chosen card is swapped into the current deck position, so the rest of the deck logic is untouched.
 Leftovers: once only one team still has open spots there is nobody to bid against, so every card left in the deck is
 turned face up and that team signs the ones it wants for $1 each (or lets free agents fill the rest). No extra cards
 are added in this stage, so there is nothing to farm: the team only chooses among cards that were already dealt. */
const FMTS = {
  open: { nm: '一般喊價', ic: '🔨', d: '輪流加價，最高價得標' },
  sealed: { nm: '暗標', ic: '🤫', d: '大家同時偷偷出價，一次揭曉，最高價得標' },
  snatch: { nm: '降價搶標', ic: '⚡', d: '標價從高往下掉，第一個按的人用當下價格買走' }
};
const FMT_ROT = ['open', 'sealed', 'snatch'];
const T_SEAL = 20000,
  T_SEAL_TIE = 12000,
  T_FLOOR = 2500,
  DUTCH_RUN = 8000,
  SNATCH_LEAD = 1600,
  GRAB_WIN = 600,
  T_NOM = 20000,
  MKT = 4,
  T_LEFT = 25000;
const fmtOf = g => (g && FMTS[g.fmt] ? g.fmt : 'open');
// format of the next game: fixed in a single game; in a season 'rotate' cycles through all three
function fmtFor(S) {
  const c = S.cfg;
  if (c.fmt === 'rotate' && S.season) return FMT_ROT[((S.season.fmt0 || 0) + S.season.rounds.length) % FMT_ROT.length];
  return FMTS[c.fmt] ? c.fmt : 'open';
}
const bidders = g => g.sides.filter(s => openN(g, s) > 0 && maxBid(g, s) >= 1);
/* a card's standing among every card in the game, from what the card face shows. Measured against all cards rather
   than this deck, so a price never hints at what is still face down. */
let ALLSTARS = {};
function starPct(p) {
  const md = pubMode();
  let ALLSTAR = ALLSTARS[md];
  if (!ALLSTAR) {
    const seen = new Set();
    ALLSTAR = ALLSTARS[md] = [];
    THEMES.forEach(t =>
      t.items.forEach(q => {
        const k = q.id + ':' + q.y0;
        if (!q.fa && !seen.has(k)) {
          seen.add(k);
          ALLSTAR.push(pubStar(q));
        }
      })
    );
    ALLSTAR.sort((a, b) => a - b);
  }
  const v = pubStar(p);
  let lo = 0,
    hi = ALLSTAR.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (ALLSTAR[m] < v) lo = m + 1;
    else hi = m;
  }
  return ALLSTAR.length ? lo / ALLSTAR.length : 0.5;
}
// Dutch clock start price: average price per spot, ~0.35x to ~2x
function snatchPrice(g, p) {
  const pct = starPct(p),
    avg = (g.budget || 10) / (g.size || 5);
  return clamp(Math.round(avg * (0.35 + 1.65 * pct)), 1, Math.max(1, Math.round(avg * 2.2)));
}
/* last-team table: with no rival left a card is not free; it costs about what it would fetch in an auction
   ($1 for the weaker half of the deck, up to about one and a half times the average price per spot for the best) */
// Measured within this game's deck: at the last table every card in it is face up or already sold, so this tells
// nobody anything new, and the weakest cards of even a Dream Team deck cost $1.
function leftPrice(g, p) {
  const avg = (g.budget || 10) / (g.size || 5),
    L = g.items
      .filter(x => !x.fa)
      .map(pubStar)
      .sort((a, b) => a - b),
    v = pubStar(p);
  const pct = L.length > 1 ? L.filter(x => x < v).length / (L.length - 1) : 0.5;
  return clamp(Math.round(avg * 1.5 * Math.pow(pct, 1.5)), 1, Math.max(1, Math.round(avg * 1.6)));
}
const leftOK = (g, s, p) => leftPrice(g, p) <= maxBid(g, s);
// the Dutch clock: price shown at time t (never below $1)
const dutchAt = (g, t) =>
  g.price == null ? null : clamp(g.price - Math.floor(Math.max(0, t - g.openAt) / (g.step || 1000)), 1, g.price);
const market = g => g.items.slice(g.idx, g.idx + MKT).map((p, i) => ({ p, j: g.idx + i }));
const leftovers = g =>
  g.items
    .slice(g.idx)
    .map((p, i) => ({ p, j: g.idx + i }))
    .filter(x => !x.p.fa);
// the leftover card that helps this team most (timeouts, offline players, bots)
// the leftover card worth most to this team for its price (timeouts, offline players, bots); none if nothing is worth it
// money only counts in the match up to the savings cap, so a team sitting on more than that pays with money it cannot use
function bestLeft(g, s) {
  const spare = Math.max(0, left(g, s) - openN(g, s)),
    useless = Math.max(0, spare - SAVE_CAP / SAVE_PT);
  const L = leftovers(g)
    .filter(x => leftOK(g, s, x.p))
    .map(x => {
      const pr = leftPrice(g, x.p) - 1;
      return { j: x.j, v: botGainFA(g, s, x.p) - SAVE_PT * Math.max(0, pr - useless) };
    })
    .filter(x => x.v > 0);
  return L.length ? L.sort((a, b) => b.v - a.v)[0].j : null;
}
function leftPick(S, j) {
  const g = S.game;
  if (j < g.idx || j >= g.items.length || g.items[j].fa) return false;
  const who = g.solo.who,
    pr = leftPrice(g, g.items[j]);
  if (!leftOK(g, who, g.items[j])) return false;
  if (j !== g.idx) {
    const t = g.items[g.idx];
    g.items[g.idx] = g.items[j];
    g.items[j] = t;
  }
  g.stage = null;
  g.bid = { who, amt: pr };
  sell(S, who, pr);
  return true;
}
// sign nobody else: drop the rest of the deck, free agents fill the open spots
function leftNone(S) {
  const g = S.game;
  g.items.length = g.idx;
  g.idx--;
  g.stage = null;
  nextCard(S);
  return true;
}
// called by startCard after the usual reset; returns true when the format took over the card
function fmtStart(S) {
  const g = S.game;
  g.sb = null;
  g.grab = null;
  g.price = null;
  g.openAt = null;
  g.tie = null;
  g.stage = null;
  g.readEnd = 0;
  g.rd = {};
  if (g.solo) {
    g.stage = 'left';
    g.leftEnd = t0(g) + T_LEFT;
    g.turn = null;
    return true;
  } // the last team picks from what is left
  if (g.nominated) {
    g.nominated = false;
    g.order = [g.nomBy].concat(g.order.filter(s => s !== g.nomBy));
  } // the nominator acts first
  else if (g.nom && remain(g) >= 2) {
    const by = g.order.find(s => openN(g, s) > 0);
    if (by) {
      g.stage = 'nom';
      g.nomBy = by;
      g.nomEnd = t0(g) + T_NOM;
      g.turn = null;
      return true;
    }
  }
  g.rd = {};
  g.readEnd = Math.max(now(), g.gapEnd || 0) + readMs(g); // reading time for the card that is now up (not for the nomination market)
  const f = fmtOf(g);
  if (f === 'sealed') {
    g.sb = {};
    g.deadline = t0(g) + T_SEAL;
    g.turn = null;
    return true;
  }
  if (f === 'snatch') {
    const cap = Math.max(1, ...bidders(g).map(s => maxBid(g, s))),
      avg = (g.budget || 10) / (g.size || 5);
    g.price = clamp(Math.round(snatchPrice(g, cur(g)) * 1.8), 3, Math.max(3, Math.min(cap, Math.round(avg * 4)))); // start price; it only goes down
    g.step = clamp(Math.round(DUTCH_RUN / Math.max(1, g.price - 1)), 550, 1100);
    g.openAt = t0(g) + SNATCH_LEAD;
    g.deadline = g.openAt + (g.price - 1) * g.step + T_FLOOR;
    g.turn = null;
    return true;
  }
  return false;
}
function nominate(S, j) {
  const g = S.game;
  if (j < g.idx || j >= Math.min(g.items.length, g.idx + MKT)) return false;
  if (j !== g.idx) {
    const t = g.items[g.idx];
    g.items[g.idx] = g.items[j];
    g.items[j] = t;
  }
  g.stage = null;
  g.nominated = true;
  startCard(S);
  return true;
}
function autoNominate(S) {
  const g = S.game,
    M = market(g);
  const best = M.slice().sort((a, b) => starScore(b.p) - starScore(a.p))[0];
  return nominate(S, best ? best.j : g.idx);
}
// who wins if a re-bid is tied again: more empty spots (the team that needs players), then earlier in this card's order.
// It is shown on the tie screen before anyone re-bids, so the other player knows they have to raise.
const tieWinner = (g, L) =>
  L.slice().sort((a, b) => openN(g, b) - openN(g, a) || g.order.indexOf(a) - g.order.indexOf(b))[0];
function resolveSealed(S) {
  const g = S.game,
    el = g.tie ? g.tie.sides : bidders(g),
    bids = {};
  el.forEach(s => {
    const v = g.sb[s];
    bids[s] = v == null ? (g.tie ? g.tie.amt : 0) : v;
  });
  const mx = Math.max(0, ...Object.values(bids)),
    top = el.filter(s => bids[s] === mx && mx > 0);
  const rev = { bids: { ...(g.tie ? g.tie.first : {}), ...bids }, max: mx, tie: !!g.tie };
  if (!top.length) {
    g.reveal = { ...rev, idx: g.idx, win: null };
    g.sb = null;
    skipCard(S);
    return;
  }
  if (top.length > 1 && !g.tie) {
    g.tie = { sides: top, amt: mx, first: bids, tb: tieWinner(g, top) };
    g.sb = {};
    g.deadline = now() + T_SEAL_TIE;
    g.reveal = { ...rev, idx: g.idx, win: null, retie: 1 };
    return;
  }
  let w = top[0];
  if (top.length > 1) {
    w = tieWinner(g, top);
    rev.tb = 1;
  }
  g.reveal = { ...rev, idx: g.idx, win: w };
  g.sb = null;
  g.tie = null;
  g.bid = { who: w, amt: mx };
  sell(S, w, mx);
}
function resolveGrab(S) {
  const g = S.game,
    L = g.grab.who;
  const w = L.length === 1 ? L[0] : L[Math.floor(rng(hash(g.gid + ':' + g.idx))() * L.length)];
  const pr = g.grab.price;
  g.reveal = { idx: g.idx, grab: L.slice(), win: w, price: pr };
  g.grab = null;
  g.bid = { who: w, amt: pr };
  sell(S, w, pr);
}
// actions for the new formats (return true when the state changed)
function fmtApply(S, a, who) {
  const g = S.game;
  if (!g || S.phase !== 'auction' || inGap(g)) return false;
  if (a.idx != null && a.idx !== g.idx) return false;
  switch (a.a) {
    case 'nominate': {
      if (g.stage !== 'nom' || who !== g.nomBy) return false;
      return nominate(S, a.j | 0);
    }
    case 'lpick': {
      if (g.stage !== 'left' || who !== g.solo.who) return false;
      return leftPick(S, a.j | 0);
    }
    case 'lnone': {
      if (g.stage !== 'left' || who !== g.solo.who) return false;
      return leftNone(S);
    }
    case 'sbid': {
      if (g.stage || !g.sb) return false;
      const el = g.tie ? g.tie.sides : bidders(g);
      if (!el.includes(who)) return false;
      const v = a.amt | 0,
        lo = g.tie ? g.tie.amt : 0;
      if (v < lo || v > maxBid(g, who)) return false;
      g.sb[who] = v;
      if (el.every(s => g.sb[s] != null)) resolveSealed(S);
      return true;
    }
    case 'grab': {
      if (g.stage || g.price == null || !bidders(g).includes(who) || g.pass[who]) return false;
      const t = now();
      if (t < g.openAt - 80) return false;
      // pay the price on the clock when the tap arrives; a tap made one step earlier (network delay) keeps the price that was on screen
      let pr = dutchAt(g, t);
      if (a.p != null && (a.p | 0) === pr + 1 && t - g.openAt < (g.price - pr) * g.step + 400) pr = a.p | 0;
      if (!g.grab) {
        if (maxBid(g, who) < pr) return false;
        g.grab = { who: [who], until: t + GRAB_WIN, price: pr };
        return true;
      }
      if (maxBid(g, who) < g.grab.price) return false;
      if (t <= g.grab.until && !g.grab.who.includes(who)) {
        g.grab.who.push(who);
        return true;
      }
      return false;
    }
    case 'spass': {
      if (g.stage || g.price == null || g.grab || !bidders(g).includes(who)) return false;
      g.pass[who] = true;
      if (bidders(g).every(s => g.pass[s])) {
        skipCard(S);
      }
      return true;
    }
  }
  return false;
}
// timers and offline players, run by the device that owns the game
function fmtTick(S, off) {
  const g = S.game,
    t = now();
  if (S.phase !== 'auction' || inGap(g)) return false;
  if (g.stage === 'nom') {
    if (t > g.nomEnd || off.has(g.nomBy)) return autoNominate(S);
    return false;
  }
  if (g.stage === 'left') {
    if (t > g.leftEnd || off.has(g.solo.who)) {
      const j = bestLeft(g, g.solo.who);
      return j == null ? leftNone(S) : leftPick(S, j);
    }
    return false;
  }
  if (g.sb) {
    const el = g.tie ? g.tie.sides : bidders(g);
    let ch = false;
    el.forEach(s => {
      if (off.has(s) && g.sb[s] == null) {
        g.sb[s] = g.tie ? g.tie.amt : 0;
        ch = true;
      }
    });
    if (t > g.deadline || el.every(s => g.sb[s] != null)) {
      resolveSealed(S);
      return true;
    }
    return ch;
  }
  if (g.price != null) {
    if (g.grab && t > g.grab.until) {
      resolveGrab(S);
      return true;
    }
    if (!g.grab) {
      let ch = false;
      bidders(g).forEach(s => {
        if (off.has(s) && !g.pass[s]) {
          g.pass[s] = true;
          ch = true;
        }
      });
      if (t > g.deadline || bidders(g).every(s => g.pass[s])) {
        skipCard(S);
        return true;
      }
      return ch;
    }
  }
  return false;
}
