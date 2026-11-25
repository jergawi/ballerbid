/* ---------- legendary groups ----------
 Famous big threes, duos and dynasty cores (Russell's Celtics, Showtime, Bird's Celtics, Jordan's Bulls, Duncan's Spurs,
 the Heat and Warriors dynasties...). Owning enough of a group on one roster gives a bonus on top of normal teammate chemistry,
 whatever season each card comes from. */
const LEGENDS = [
  {
    id: 'bulls',
    nm: '公牛王朝',
    ic: '🐂',
    m: ['jordami01', 'pippesc01', 'rodmade01', 'grantho01', 'kukocto01'],
    need: 3,
    must: ['jordami01', 'pippesc01']
  },
  {
    id: 'celt60',
    nm: '六〇年代綠衫軍',
    ic: '☘️',
    m: ['russebi01', 'cousybo01', 'havlijo01', 'jonessa01', 'heinsto01'],
    need: 3,
    must: ['russebi01']
  },
  { id: 'show', nm: 'Showtime 湖人', ic: '🎬', m: ['johnsma02', 'abdulka01', 'worthja01'], need: 3 },
  { id: 'celt80', nm: '八〇年代綠衫軍三巨頭', ic: '☘️', m: ['birdla01', 'mchalke01', 'parisro01'], need: 3 },
  {
    id: 'bad',
    nm: '壞孩子軍團',
    ic: '😈',
    m: ['thomais01', 'dumarjo01', 'laimbbi01', 'rodmade01'],
    need: 3,
    must: ['thomais01']
  },
  { id: 'gdp', nm: '馬刺 GDP', ic: '🤠', m: ['duncati01', 'parketo01', 'ginobma01'], need: 3 },
  { id: 'ok', nm: 'OK 連線', ic: '💜', m: ['onealsh01', 'bryanko01'], need: 2 },
  { id: 'celt08', nm: '2008 綠衫軍三巨頭', ic: '☘️', m: ['piercpa01', 'garneke01', 'allenra02'], need: 3 },
  { id: 'heat', nm: '熱火三巨頭', ic: '🔥', m: ['jamesle01', 'wadedw01', 'boshch01'], need: 3 },
  {
    id: 'gsw',
    nm: '勇士王朝',
    ic: '💦',
    m: ['curryst01', 'thompkl01', 'greendr01', 'duranke01', 'iguodan01'],
    need: 3,
    must: ['curryst01']
  },
  { id: 'utah', nm: '猶他雙煞', ic: '📮', m: ['stockjo01', 'malonka01'], need: 2 },
  { id: 'twin', nm: '火箭雙塔', ic: '🗼', m: ['olajuha01', 'sampsra01'], need: 2 },
  { id: 'okc', nm: '雷霆三少', ic: '⚡', m: ['duranke01', 'westbru01', 'hardeja01'], need: 3 },
  { id: 'bkn', nm: '籃網三巨頭', ic: '🕸️', m: ['duranke01', 'irvinky01', 'hardeja01'], need: 3 },
  { id: 'lob', nm: '空拋之城', ic: '🛫', m: ['paulch01', 'griffbl01', 'jordade01'], need: 3 },
  { id: 'phi83', nm: '費城雙巨頭', ic: '🔔', m: ['ervinju01', 'malonmo01'], need: 2 },
  { id: 'mil', nm: '公鹿三巨頭', ic: '🦌', m: ['antetgi01', 'middlkh01', 'holidjr01'], need: 3 },
  { id: 'den', nm: '金塊雙人組', ic: '⛏️', m: ['jokicni01', 'murraja01'], need: 2 },
  { id: 'phx', nm: '太陽七秒', ic: '☀️', m: ['nashst01', 'stoudam01', 'mariosh01'], need: 3 },
  { id: 'sac', nm: '國王地表最強秀', ic: '👑', m: ['webbech01', 'bibbymi01', 'stojape01', 'divacvl01'], need: 3 },
  { id: 'tmc', nm: 'Run TMC', ic: '🏃', m: ['hardati01', 'richmmi01', 'mullich01'], need: 3 },
  { id: 'sea', nm: '超音速雙人組', ic: '🛩️', m: ['paytoga01', 'kempsh01'], need: 2 },
  { id: 'orl', nm: '魔術雙星', ic: '🪄', m: ['onealsh01', 'hardaan01'], need: 2 },
  {
    id: 'det04',
    nm: '2004 活塞先發',
    ic: '🔧',
    m: ['billuch01', 'hamilri01', 'princta01', 'wallara01', 'wallabe01'],
    need: 4
  },
  { id: 'nyk', nm: '七〇年代尼克', ic: '🗽', m: ['fraziwa01', 'reedwi01', 'debusda01'], need: 3 },
  { id: 'lal60', nm: '湖人 West＋Baylor', ic: '🌴', m: ['westje01', 'bayloel01'], need: 2 },
  { id: 'dal', nm: '2011 小牛', ic: '🐴', m: ['nowitdi01', 'kiddja01', 'terryja01'], need: 3 },
  { id: 'tor', nm: '2019 暴龍', ic: '🦖', m: ['leonaka01', 'lowryky01', 'siakapa01'], need: 3 },
  { id: 'bos24', nm: '雙探花', ic: '☘️', m: ['tatumja01', 'brownja02'], need: 2 },
  { id: 'okc25', nm: '雷霆新王朝', ic: '⚡', m: ['gilgesh01', 'holmgch01', 'willija06'], need: 3 },
  { id: 'mpls', nm: '明尼亞波利斯湖人', ic: '🌲', m: ['mikange01', 'mikkeve01', 'pollaji01'], need: 3 }
];
// a duo is worth less than a trio; owning the whole of a bigger core adds a little more. Capped per roster.
const legVal = (L, k) => (L.need === 2 ? 0.8 : 1.5) + (k > L.need && k === L.m.length ? 0.5 : 0);
function legendsOf(roster) {
  const ids = new Set(roster.filter(p => !p.fa).map(p => p.id)),
    out = [];
  LEGENDS.forEach(L => {
    const have = L.m.filter(x => ids.has(x));
    if (have.length >= L.need && (L.must || []).every(x => ids.has(x)))
      out.push({
        id: L.id,
        nm: L.nm,
        ic: L.ic,
        ns: roster.filter(p => have.includes(p.id)).map(p => p.n),
        v: legVal(L, have.length)
      });
  });
  return out;
}
// "one more card completes a legend" hints for the auction screen (rosters are public, so everyone sees these)
function legendHints(g, pl) {
  if (!pl || pl.fa || !pl.id) return [];
  const out = [];
  g.sides.forEach(s => {
    if (!openN(g, s)) return;
    const R = g.rosters[s].map(r => g.items[r.k]),
      ids = new Set(R.map(p => p.id));
    LEGENDS.forEach(L => {
      if (!L.m.includes(pl.id) || ids.has(pl.id)) return;
      const have = L.m.filter(x => ids.has(x)).length;
      const after = new Set([...ids, pl.id]);
      const done = have + 1 >= L.need && (L.must || []).every(x => after.has(x));
      const was = have >= L.need && (L.must || []).every(x => ids.has(x));
      if (done && !was) out.push({ s, L, t: 'complete' });
      else if (!was && have + 1 === L.need - 1 && have >= 1) out.push({ s, L, t: 'close' });
    });
  });
  return out;
}
