/* ---------- events ---------- */
/* drag a lineup plate onto another to swap them (pointer events, works with touch) */
let drag = null;
document.addEventListener('pointerdown', e => {
  const pl = e.target.closest('[data-drag]');
  if (!pl || !pl.dataset.drag || !e.target.closest('.grip')) return;
  e.preventDefault();
  const r = pl.getBoundingClientRect();
  const gh = pl.cloneNode(true);
  gh.classList.add('ghost2');
  gh.style.width = r.width + 'px';
  gh.style.left = r.left + 'px';
  gh.style.top = r.top + 'px';
  document.body.appendChild(gh);
  drag = { who: pl.dataset.drag, from: pl.dataset.v, gh, dy: e.clientY - r.top, dx: e.clientX - r.left, over: null };
  pl.classList.add('dragging');
});
document.addEventListener(
  'pointermove',
  e => {
    if (!drag) return;
    e.preventDefault();
    drag.gh.style.top = e.clientY - drag.dy + 'px';
    drag.gh.style.left = e.clientX - drag.dx + 'px';
    drag.gh.style.display = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    drag.gh.style.display = '';
    const t = el && el.closest('[data-drag]');
    document.querySelectorAll('.plate.over').forEach(x => x.classList.remove('over'));
    drag.over = t && t.dataset.drag === drag.who && t.dataset.v !== drag.from ? t.dataset.v : null;
    if (drag.over) t.classList.add('over');
  },
  { passive: false }
);
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.gh.remove();
  document.querySelectorAll('.plate.over,.plate.dragging').forEach(x => x.classList.remove('over', 'dragging'));
  if (d.over) {
    ui.sel = null;
    dispatch({ a: 'swap', who: d.who, x: d.from, y: d.over });
  }
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const a = t.dataset.act,
    d = t.dataset;
  if (a !== 'quit') ui.quit = false;
  if (a !== 'endSeason') ui.endSe = false;
  switch (a) {
    case 'local':
      return startLocal();
    case 'ai':
      return startAI();
    case 'ailv':
      return dispatch({ a: 'ailv', v: d.v });
    case 'aist':
      return dispatch({ a: 'aist', s: d.who, v: d.v });
    case 'create':
      return createRoom();
    case 'join':
      return joinRoom(document.querySelector('[data-in="code"]').value);
    case 'joinhash': {
      const m = /^#room-([a-z0-9]{6})(?:-(\d))?$/.exec(location.hash);
      if (m) joinRoom(m[1], m[2] != null ? +m[2] : undefined);
      return;
    }
    case 'reload':
      return location.reload();
    case 'exit':
      if (!offline()) leaveNet();
      else NET.mode = null;
      S = null;
      return render();
    case 'share': {
      const url = inviteLink(),
        txt = '來玩 BALLER BID 球星喊價！點連結直接加入：';
      if (navigator.share) {
        navigator.share({ title: 'BALLER BID 球星喊價', text: txt, url }).catch(() => {});
      } else copyText(txt + url, '邀請連結已複製 ✅');
      return;
    }
    case 'copy':
      return withView(() => copyText(summaryText(), '已複製 ✅'));
    case 'copyseason':
      return copyText(seasonText(), '已複製 ✅');
    case 'mstrip':
      e.preventDefault();
      ui.mstrip = !ui.mstrip;
      return render();
    case 'peek':
      ui.peek = d.who;
      clearTimeout(ui.peekT);
      ui.peekT = setTimeout(() => {
        ui.peek = null;
        render();
      }, 5000);
      return render();
    case 'sready':
      return dispatch({ a: 'sready', v: d.v === '1' });
    case 'again':
      ui.backGid = S.last ? S.last.game.gid : S.game && S.game.gid;
      scrollTo(0, 0);
      return dispatch({ a: 'again' });
    case 'specback':
      ui.backGid = S.last ? S.last.game.gid : S.game && S.game.gid;
      scrollTo(0, 0);
      return render();
    case 'pbsp':
    case 'pbnext':
    case 'pbskip':
      return withView(() => pbAct(a));
    case 'reveal':
      ui.reveal.add(d.v);
      return render();
  }
  function pbAct(a) {
    switch (a) {
      case 'pbsp': {
        const p = ui.pb;
        if (!p) return;
        p.sp = ui.pbSp = p.sp >= 4 ? 1 : p.sp + 1;
        return render();
      }
      case 'pbnext': {
        const st = pbState();
        if (!st) return;
        if (!st.done) {
          ui.pb.vt = st.P * PB_Q;
          return render();
        }
        return pbNext();
      }
      case 'pbskip':
        if (!ui.pbDone.has(S.game.gid)) champSound(0.2);
        ui.pbDone.add(S.game.gid);
        ui.pbFast = true;
        ui.pb = null;
        render();
        return scrollTo(0, 0);
    }
  }
  switch (a) {
    case 'reveal':
      ui.reveal.add(d.v);
      return render();
    case 'seat':
      return dispatch({ a: 'seat', seat: d.v, name: MYNAME });
    case 'theme':
      return dispatch({ a: 'cfg', cfg: { theme: d.id } });
    case 'tmode':
      return dispatch({ a: 'cfg', cfg: { theme: d.v } });
    case 'ptog': {
      const p = new Set(S.cfg.picks || []);
      p.has(d.v) ? p.delete(d.v) : p.add(d.v);
      return dispatch({ a: 'cfg', cfg: { picks: [...p] } });
    }
    case 'pall': {
      const ids = THEMES.filter(t => t.cat === (S.cfg.pcat || '夢幻隊') && t.id !== 'usaall').map(t => t.id);
      const p = new Set(S.cfg.picks || []);
      const all = ids.every(x => p.has(x));
      ids.forEach(x => (all ? p.delete(x) : p.add(x)));
      return dispatch({ a: 'cfg', cfg: { picks: [...p] } });
    }
    case 'tdel':
      return dispatch({ a: 'cfg', cfg: { teams: (S.cfg.teams || []).filter(x => x !== d.v) } });
    case 'tclr':
      return dispatch({ a: 'cfg', cfg: { teams: [] } });
    case 'pdel':
      return dispatch({ a: 'cfg', cfg: { picks: (S.cfg.picks || []).filter(x => x !== d.v) } });
    case 'cat': {
      const c = new Set(S.cfg.cats);
      c.has(d.v) ? c.delete(d.v) : c.add(d.v);
      return dispatch({ a: 'cfg', cfg: { cats: [...c] } });
    }
    case 'cfg': {
      const val = ['showStats', 'hints', 'mis', 'bal', 'cards', 'showYr', 'ovr'].includes(d.k)
        ? d.v === '1'
        : ['pmode', 'fmt'].includes(d.k)
          ? d.v
          : +d.v;
      return dispatch({ a: 'cfg', cfg: { [d.k]: val } });
    }
    case 'csel': {
      const g = S.game,
        who = d.who || (NET.mode === 'local' ? g.sides.find(s => !g.cards[s].pick) : myRole());
      let L =
        (ui.csel && ui.csel.gid === g.gid && ui.csel.who === who ? ui.csel.ids : g.cards[who] && g.cards[who].pick) ||
        [];
      L = L.slice();
      const i = L.indexOf(d.v);
      if (i >= 0) L.splice(i, 1);
      else {
        L.push(d.v);
        if (L.length > CARD_PICK) L.shift();
      }
      ui.csel = { gid: g.gid, who, ids: L };
      return render();
    }
    case 'cpick': {
      const g = S.game;
      const ids = ui.csel && ui.csel.gid === g.gid && ui.csel.who === d.who ? ui.csel.ids : g.cards[d.who].pick;
      ui.csel = null;
      return dispatch({ a: 'card', id: 'pick', who: d.who, ids });
    }
    case 'cinfo':
      ui.csheet = { who: d.who, id: d.v };
      return render();
    case 'cclose':
      ui.csheet = null;
      return render();
    case 'cuse': {
      const x = ui.csheet;
      ui.csheet = null;
      if (!x) return render();
      return dispatch({ a: 'card', id: d.v, who: x.who, t: d.t, idx: S.game.idx });
    }
    case 'mpick':
      return dispatch({ a: 'mpick', who: d.who, i: +d.i });
    case 'endSeason':
      if (!ui.endSe) {
        ui.endSe = true;
        return render();
      }
      ui.endSe = false;
      scrollTo(0, 0);
      return dispatch({ a: 'endSeason' });
    case 'closeSeason':
      scrollTo(0, 0);
      return dispatch({ a: 'closeSeason' });
    case 'bid':
      ui.amt = {};
      return dispatch({ a: 'bid', who: d.who, amt: +d.amt, idx: S.game.idx });
    case 'bidv':
      return bidTyped(d.who);
    case 'step': {
      const g = S.game;
      ui.amt[d.who] = clamp(amtFor(g, d.who) + +d.v, g.bid.amt + 1, maxBid(g, d.who));
      const el = document.querySelector(`[data-in="amt"][data-who="${d.who}"]`);
      if (el) el.value = ui.amt[d.who];
      return render();
    }
    case 'pass':
      return dispatch({ a: 'pass', who: d.who, idx: S.game.idx });
    case 'lsel':
      ui.leftSel = { gid: S.game.gid, idx: S.game.idx, j: +d.v };
      return render();
    case 'lpick':
      if (d.v === '') return;
      return dispatch({ a: 'lpick', j: +d.v, who: S.game.solo.who, idx: S.game.idx });
    case 'lnone':
      if (!ui.lnone) {
        ui.lnone = true;
        return render();
      }
      ui.lnone = false;
      return dispatch({ a: 'lnone', who: S.game.solo.who, idx: S.game.idx });
    case 'nompick':
      ui.nomSel = { gid: S.game.gid, idx: S.game.idx, j: +d.v };
      return render();
    case 'nominate':
      if (d.v === '') return;
      return dispatch({ a: 'nominate', who: S.game.nomBy, j: +d.v, idx: S.game.idx });
    case 'sstep': {
      const g = S.game,
        lo = g.tie ? g.tie.amt : 0,
        k = 's' + g.idx + d.who,
        cur0 =
          ui.amt[k] != null
            ? ui.amt[k]
            : +(document.querySelector(`[data-in="samt"][data-who="${d.who}"]`) || {}).value || 0;
      ui.amt[k] = clamp(cur0 + +d.v, lo, maxBid(g, d.who));
      return render();
    }
    case 'sbid': {
      const g = S.game,
        el = document.querySelector(`[data-in="samt"][data-who="${d.who}"]`);
      let v = +d.amt;
      if (el && !t.classList.contains('pass')) v = parseInt(el.value, 10);
      const lo = g.tie ? g.tie.amt : 0,
        mx = maxBid(g, d.who);
      if (isNaN(v) || v < lo) return toast(`至少 $${lo}`);
      if (v > mx) return toast(`你最多只能出 $${mx}（要留錢補滿陣容）`);
      return dispatch({ a: 'sbid', who: d.who, amt: v, idx: g.idx });
    }
    case 'rdone': {
      const g = S.game,
        me = myRole();
      return dispatch({ a: 'rdone', who: me === 'all' || !g.sides.includes(me) ? g.sides[0] : me });
    }
    case 'logexp':
      logExport();
      return;
    case 'rules':
      ui.rulesOpen = !ui.rulesOpen;
      return render();
    case 'rtab':
      ui.rtab = d.v;
      return render();
    case 'grab':
      sfx('grab');
      return dispatch({ a: 'grab', who: d.who, idx: S.game.idx, p: dutchAt(S.game, now()) });
    case 'spass':
      return dispatch({ a: 'spass', who: d.who, idx: S.game.idx });
    case 'brole':
      return dispatch({ a: 'brole', who: d.who, slot: d.v, role: d.role });
    case 'sfx': {
      const nx = (SFX.lv + 2) % 3;
      sfxSet(nx);
      toast(['🔇 音效關閉', '🔈 音效：小聲', '🔊 音效：正常'][nx], 1200);
      if (nx) setTimeout(() => sfx('bid'), 60);
      return render();
    }
    case 'tac':
      return dispatch({ a: 'tac', who: d.who, k: d.k, v: d.v });
    case 'lu': {
      const who = d.who,
        sl = d.v;
      if (ui.sel && ui.sel.who === who) {
        const x = ui.sel.slot;
        ui.sel = null;
        if (x === sl) return render();
        return dispatch({ a: 'swap', who, x, y: sl });
      }
      ui.sel = { who, slot: sl };
      return render();
    }
    case 'ready':
      ui.sel = null;
      return dispatch({ a: 'ready', who: d.who, v: d.v === '1' });
    case 'quit':
      if (!ui.quit) {
        ui.quit = true;
        return render();
      }
      ui.quit = false;
      return dispatch({ a: 'quit' });
    default:
      return dispatch({ a });
  }
});
let deb = {};
const debounced = (k, fn, ms = 600) => {
  clearTimeout(deb[k]);
  deb[k] = setTimeout(fn, ms);
};
document.addEventListener('input', e => {
  const t = e.target,
    k = t.dataset.in;
  if (!k) return;
  if (k === 'myname') {
    MYNAME = clean(t.value);
    lsSet('bb_name', MYNAME);
  }
  if (k === 'name') {
    const s = t.dataset.i;
    S.names[s] = t.value;
    debounced('names', () => dispatch({ a: 'names', [s]: S.names[s] }));
  }
  if (k === 'cname' || k === 'ctext') {
    const c = S.cfg.custom;
    const nc = { name: k === 'cname' ? t.value : c.name, text: k === 'ctext' ? t.value : c.text };
    S.cfg.custom = nc;
    debounced('custom', () => dispatch({ a: 'cfg', cfg: { custom: nc } }), 700);
  }
  if (k === 'samt') {
    const v = parseInt(t.value, 10),
      g = S.game;
    if (g) ui.amt['s' + g.idx + t.dataset.who] = isNaN(v) ? 0 : v;
    const go = document.querySelector(`[data-act="sbid"][data-who="${t.dataset.who}"]:not(.pass) small`);
    if (go) go.textContent = '$' + (isNaN(v) ? '' : v);
    return;
  }
  if (k === 'amt') {
    const v = parseInt(t.value, 10);
    ui.amt[t.dataset.who] = isNaN(v) ? 0 : v;
    const go = document.querySelector(`[data-act="bidv"][data-who="${t.dataset.who}"] small`);
    if (go) go.textContent = '$' + (isNaN(v) ? '' : v);
    return;
  }
  if (k === 'budget') {
    const v = parseInt(t.value, 10);
    if (v >= 5) debounced('budget', () => dispatch({ a: 'cfg', cfg: { budget: v } }), 700);
  }
});
function bidTyped(who) {
  const g = S.game;
  if (!g) return;
  const el = document.querySelector(`[data-in="amt"][data-who="${who}"]`);
  const v = el ? parseInt(el.value, 10) : amtFor(g, who),
    mx = maxBid(g, who);
  if (isNaN(v) || v <= g.bid.amt) return toast(`至少要出 $${g.bid.amt + 1}`);
  if (v > mx) return toast(`你最多只能出 $${mx}（要留錢補滿陣容）`);
  if (el) el.blur();
  ui.amt = {};
  return dispatch({ a: 'bid', who, amt: v, idx: g.idx });
}
document.addEventListener('change', e => {
  const t = e.target,
    k = t.dataset && t.dataset.in;
  if (!k || t.tagName !== 'SELECT' || !S) return;
  const v = t.value,
    c = S.cfg;
  if (k === 'era0' || k === 'era1') {
    const o = c.era ? [...c.era] : [null, null];
    o[k === 'era0' ? 0 : 1] = v ? +v : null;
    let era = null;
    if (o[0] != null || o[1] != null) {
      const a = o[0] != null ? o[0] : o[1],
        b = o[1] != null ? o[1] : o[0];
      era = [a, b];
    }
    return dispatch({ a: 'cfg', cfg: { era } });
  }
  if (k === 'team') {
    if (!v) return;
    t.value = '';
    return dispatch({ a: 'cfg', cfg: { teams: [...(c.teams || []), v] } });
  }
  if (k === 'aist') return dispatch({ a: 'aist', s: t.dataset.i, v });
  if (k === 'pcat') return dispatch({ a: 'cfg', cfg: { pcat: v } });
  if (k === 'ptheme') {
    if (!v) return;
    t.value = '';
    return dispatch({ a: 'cfg', cfg: { picks: [...(c.picks || []), v] } });
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset) return;
  if (e.target.dataset.in === 'code') joinRoom(e.target.value);
  if (e.target.dataset.in === 'amt') bidTyped(e.target.dataset.who);
});
window.addEventListener('hashchange', () => {
  if (!NET.mode) render();
});

(async () => {
  try {
    await loadData();
  } catch (e) {
    document.getElementById('app').innerHTML = '<div class="err">球員資料載入失敗，請重新整理。</div>';
    return;
  }
  render();
})();
