/* ---------- career phase badges ----------
 Every card is one version of a player: a single season or a span (the match sim uses that version's numbers), while
 the card face shows career numbers and honours. Like the Base / Mid / Prime versions of legend cards in football
 card games, a badge says which part of the career this card is, without naming the team:
   🐣 新秀年   the player's first season
   🌱 生涯早期 before his best five-season stretch
   🔥 巔峰期   mostly inside his best five-season stretch
   🍂 生涯晚期 after it
 The best stretch comes from the career data (best five seasons), the first and last seasons from the bios.
 Optional: the season itself ('86, '83–'88), which hints at the era. */
const PHASE = {
  rook: { ic: '🐣', nm: '新秀年', c: '#1f9d6a' },
  early: { ic: '🌱', nm: '生涯早期', c: '#2a8f9e' },
  prime: { ic: '🔥', nm: '巔峰期', c: '#e5591d' },
  late: { ic: '🍂', nm: '生涯晚期', c: '#8a6a4a' }
};
const PHC = new WeakMap();
function phaseOf(p) {
  if (!p || p.fa || !p.y0 || !p.y1) return null;
  if (PHC.has(p)) return PHC.get(p);
  let r = null;
  const c = CAREER && CAREER.get(normName(p.n)),
    b = bioOf(p);
  if (c && c.y0 && c.y1) {
    const a = +p.y0,
      z = +p.y1,
      len = z - a + 1,
      ov = Math.max(0, Math.min(z, c.y1) - Math.max(a, c.y0) + 1),
      mid = (a + z) / 2;
    if (ov * 2 >= len) r = 'prime';
    else if (mid < c.y0) r = b && b.from && a === z && a === b.from ? 'rook' : 'early';
    else r = 'late';
  }
  PHC.set(p, r);
  return r;
}
const yrLab = p =>
  !p || p.fa || !p.y0
    ? ''
    : p.y0 === p.y1
      ? `'${String(p.y0).slice(2)}`
      : `'${String(p.y0).slice(2)}–'${String(p.y1).slice(2)}`;
/* what the card's own season actually played like, on the same scale as 攻守貢獻 (shown only after the games) */
const OVR_K = 2.65,
  toOvr = v => Math.max(45, Math.min(99, Math.round(72 + OVR_K * v)));
const seasonOvr = p => (!p || p.fa ? 45 : toOvr(pval(p)));
function phaseBadge(p, g, small) {
  const k = phaseOf(p),
    yr = g && g.showYr && yrLab(p),
    tk = typeof tkRate === 'function' && tkRate(p) > 0;
  if (!k && !yr && !tk) return '';
  const P = k && PHASE[k];
  return `<div class="phb ${small ? 'sm' : ''}">${P ? `<span class="ph" style="--c:${P.c}">${P.nm}</span>` : ''}${tk ? `<span class="ph tk" style="--c:#b0186a" title="這張卡偶爾會單場接管比賽">爆發型</span>` : ''}${yr ? `<span class="yr">${yr}</span>` : ''}</div>`;
}
/* what the badge tells a reader, in rating points: the typical gap between a card of that phase and the player's best
   stretch, measured over every card in the game. Bots use it, since people can see the badge too. */
let PH_D = null;
function phaseGap(k) {
  if (!PH_D) {
    const acc = {};
    THEMES.forEach(t =>
      t.items.forEach(p => {
        const k2 = phaseOf(p),
          c = CAREER && CAREER.get(normName(p.n));
        if (!k2 || !c || typeof c.obpm !== 'number') return;
        (acc[k2] = acc[k2] || []).push(pval(p) - pval(careerAsSeason(p, c)));
      })
    );
    PH_D = {};
    Object.keys(PHASE).forEach(x => {
      const L = (acc[x] || []).sort((a, b) => a - b);
      PH_D[x] = L.length ? L[L.length >> 1] : 0;
    });
  }
  return k ? PH_D[k] || 0 : 0;
}

/* 攻守貢獻 (shown on the card): the card's own season (its BPM, through the same small-sample shrink the match sim
   uses), the same public number the bots price cards with (pubVal in bot.js), put on a 2K-style 45-99 scale (72 + 2.65 per rating point): role players in the 60s-70s, All-Stars mid-80s, the very top 95+.
   It exists so a person does not have to work out from points per game what the computer already knows. */
const ovrOf = p => (!p || p.fa ? 45 : toOvr(pubVal(p)));
/* how far the card's own season usually lands from the number on the card: one standard deviation, measured over
   every card in the game (about 0.6 rating points for role players, 1.5 for the best stars). Shown as a range so a
   95 that plays like an 89 is a known risk, not a surprise. */
const ovrTier = v => (v >= 92 ? 't5' : v >= 86 ? 't4' : v >= 80 ? 't3' : v >= 74 ? 't2' : 't1');
function ovrBadge(p, g, small) {
  if (!p || (g && g.ovr === false)) return '';
  const v = ovrOf(p),
    rg = null;
  return `<div class="ovrb ${ovrTier(v)} ${small ? 'sm' : ''}"><b>${v}</b><i>攻守貢獻</i></div>${rg ? `<div class="ovrr">這一季多半在 ${rg[0]}–${rg[1]}</div>` : ''}`;
}
