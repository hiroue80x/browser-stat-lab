// ===== 構造方程式モデリング：アイテム・パーセリング（項目をまとめて小包＝パーセルにする） =====
// 分け方：項目と構成概念のバランス法（Little et al., 2002）・無作為・奇数偶数・手動（下位尺度など）
// 無作為配分のばらつき（Sterba & MacCallum, 2010）も調べられる
const PAR = { cfg: {}, seed: 1234, nAlloc: '100', job: null, msg: '', cfaCache: {} };
const PAR_METHODS = [['balance', '項目と構成概念のバランス法（推奨）'], ['random', '無作為'], ['oddeven', '奇数・偶数（項目の順に交互）'], ['manual', '手動（下位尺度などに合わせる）']];

// 潜在変数ごとの指標（潜在変数 → 観測変数 の矢印の先）
function parItemsOf(m, lat) { return m.edges.filter(e => e.type === 'path' && e.from === lat.id).map(e => m.nodes.find(n => n.id === e.to)).filter(n => n && n.kind === 'obs'); }
function parCandidates(m) { return m.nodes.filter(n => n.kind === 'lat' && parItemsOf(m, n).length >= 4); }
function parColNum(name) { const j = state.db.cols.findIndex(c => c.name === name); need(j >= 0, `「${name}」がデータの列にありません。`); need(colType(j) === 'num', `「${name}」は数値の列ではありません。`); return dbCol(j).map(toNum); }

// 1 因子 CFA（1 次元性の確認と、バランス法の負荷量）
function parCfa1(lat, items) {
  const key = lat.name + '|' + items.join('|'); if (PAR.cfaCache[key]) return PAR.cfaCache[key];
  const raw = items.map(parColNum), ok = raw[0].map((_, i) => raw.every(c => isFinite(c[i]))), data = raw.map(c => c.filter((_, i) => ok[i]));
  need(data[0].length > items.length + 2, 'データの人数が少なすぎます。');
  const F = S.sem.fit(S.sem.parse(`F1 =~ ${items.join(' + ')}`), data), load = {};
  F.est.filter(e => e.role === 'load').forEach(e => { load[e.to] = e.std; });
  return (PAR.cfaCache[key] = { F, load, n: data[0].length });
}

// 項目をパーセルに割り当てる（戻り値：項目名 → パーセル番号 0..k-1）
function parAllocate(items, k, method, load, R) {
  const out = {};
  if (method === 'balance') { // 負荷の高い順に 1→k、k→1、1→k … と蛇行して配る
    const ord = items.slice().sort((a, b) => Math.abs(load[b]) - Math.abs(load[a]));
    ord.forEach((it, i) => { const r = Math.floor(i / k), c = i % k; out[it] = r % 2 === 0 ? c : k - 1 - c; });
  } else if (method === 'random') {
    const ord = items.slice(); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
    ord.forEach((it, i) => { out[it] = i % k; });
  } else items.forEach((it, i) => { out[it] = i % k; }); // 奇数・偶数（項目の順に交互）
  return out;
}
const parGroups = (items, k, asg) => Array.from({ length: k }, (_, p) => items.filter(it => asg[it] === p));
const parName = (lat, p) => `${lat}_P${p + 1}`;
function parColRaw(name) { const j = state.db.cols.findIndex(c => c.name === name); return (typeof rawColBase === 'function' ? rawColBase(j) : dbCol(j)).map(toNum); } // ケースの選択に関係なく全員分
function parMeans(groups) { // 各パーセルの得点＝項目の平均（欠測は除いて平均。すべて欠測なら欠測）
  return groups.map(g => { const cols = g.map(parColRaw); return cols[0].map((_, i) => { const v = cols.map(c => c[i]).filter(isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }); });
}

// 設定（潜在変数ごと）
function parConf(m, lat) {
  const items = parItemsOf(m, lat).map(n => n.name), c = PAR.cfg[lat.id] || (PAR.cfg[lat.id] = { use: true, k: 3, method: 'balance', manual: null });
  c.k = Math.max(2, Math.min(c.k, items.length - 1));
  let asg;
  if (c.method === 'manual' && c.manual && items.every(it => c.manual[it] != null && c.manual[it] < c.k)) asg = c.manual;
  else { let load = {}; try { load = parCfa1(lat, items).load; } catch (e) { } asg = parAllocate(items, c.k, c.method === 'manual' ? 'balance' : c.method, load, rng(PAR.seed + lat.id.length * 7919 + lat.name.length)); }
  return { items, c, asg, groups: parGroups(items, c.k, asg) };
}

// ----- ダイアログ -----
function parOpen() {
  let dl = $('#parDlg');
  if (!dl) { dl = document.createElement('div'); dl.id = 'parDlg'; dl.className = 'pardlg'; document.body.appendChild(dl); parBind(dl); }
  PAR.msg = ''; dl.hidden = false; parRender();
}
function parClose() { const dl = $('#parDlg'); if (dl) dl.hidden = true; }
function parRender() {
  const dl = $('#parDlg'), m = state.db.semModel, cands = parCandidates(m), done = m.parcels && Object.keys(m.parcels).length;
  const J = v => v === 'good' ? '<span style="color:var(--accent)">○</span>' : v === 'poor' ? '<span style="color:var(--sig)">×</span>' : v ? '△' : '';
  let body = '';
  if (done) body += `<div class="parnote">このモデルは、すでにパーセルを使っています（${Object.keys(m.parcels).map(esc).join('・')}）。作り直すときは「元の項目に戻す」を押してから、もう一度設定してください。</div>`;
  if (!cands.length) body += `<p class="hint">指標（観測変数）を 4 つ以上もつ潜在変数がありません。パーセリングは、1 つの潜在変数に項目がたくさんあるときに使います。</p>`;
  cands.forEach(lat => {
    const { items, c, asg, groups } = parConf(m, lat); let cfa = null, err = '';
    try { cfa = parCfa1(lat, items); } catch (e) { err = e.message; }
    const F = cfa && cfa.F, v = F ? semFitVerdict(F) : {}, warn = [];
    if (F && F.df > 0 && (v.CFI === 'poor' || v.RMSEA === 'poor' || v.SRMR === 'poor')) warn.push('1 因子モデルの適合がよくありません。項目が 1 次元でない（下位因子がある）可能性があります。そのままパーセルにすると、モデルの誤りが見えなくなります。下位尺度ごとにまとめる（手動）か、パーセリングをやめることを考えてください。');
    if (cfa && items.some(it => cfa.load[it] < 0)) warn.push(`負の負荷の項目（${items.filter(it => cfa.load[it] < 0).map(esc).join('・')}）があります。逆転項目を反転していない可能性があります。「データの加工」で反転してから使ってください。`);
    if (cfa && items.some(it => Math.abs(cfa.load[it]) < .3)) warn.push(`負荷が .30 未満の項目（${items.filter(it => Math.abs(cfa.load[it]) < .3).map(esc).join('・')}）があります。`);
    if (groups.some(g => !g.length)) warn.push('項目が 1 つも入っていないパーセルがあります。');
    const other = m.edges.filter(e => items.some(it => { const id = m.nodes.find(n => n.name === it).id; return (e.from === id || e.to === id) && !(e.type === 'path' && e.from === lat.id); }));
    if (other.length) warn.push('これらの項目には、ほかの矢印や共分散（誤差相関など）がついています。パーセルに置き換えると、それらは消えます。');
    const sumL = groups.map(g => cfa ? g.reduce((a, it) => a + Math.abs(cfa.load[it] || 0), 0) / (g.length || 1) : NaN);
    body += `<section class="parcard"><div class="parhd"><label><input type="checkbox" data-par-use="${lat.id}" ${c.use ? 'checked' : ''}> <b>${esc(lat.name)}</b>（${items.length} 項目）</label>
      <label>パーセルの数 <select data-par-k="${lat.id}">${[2, 3, 4, 5].filter(k => k < items.length).map(k => `<option ${k === c.k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>分け方 <select data-par-m="${lat.id}">${PAR_METHODS.map(([k, l]) => `<option value="${k}" ${k === c.method ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${err ? `<p class="hint" style="color:var(--sig)">${esc(err)}</p>` : `<p class="parfit">1 因子 CFA（n = ${cfa.n}）：${F.df > 0 ? `χ²(${F.df}) = ${fmt(F.chi, 2)}, CFI = ${c2(F.cfi)} ${J(v.CFI)}, RMSEA = ${c2(F.rmsea)} ${J(v.RMSEA)}, SRMR = ${c2(F.srmr)} ${J(v.SRMR)}` : '自由度 0'}</p>`}
      ${warn.map(w => `<p class="parwarn">${w}</p>`).join('')}
      <div class="partbl"><table><thead><tr><th>項目</th><th class="c">標準化負荷</th>${groups.map((_, p) => `<th class="c">P${p + 1}</th>`).join('')}</tr></thead><tbody>
      ${items.map(it => `<tr><td>${esc(it)}</td><td class="c">${cfa ? c2(cfa.load[it]) : '—'}</td>${groups.map((_, p) => `<td class="c"><input type="radio" name="pr-${lat.id}-${esc(it)}" data-par-a="${lat.id}" data-it="${esc(it)}" value="${p}" ${asg[it] === p ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}
      <tr class="parsum"><td>項目数／負荷の平均</td><td></td>${groups.map((g, p) => `<td class="c">${g.length}／${isFinite(sumL[p]) ? c2(sumL[p]) : '—'}</td>`).join('')}</tr></tbody></table></div>
      <p class="hint">${c.method === 'balance' ? '1 因子 CFA の負荷が高い順に P1 → P' + c.k + '、P' + c.k + ' → P1 … と配り、パーセルどうしの負荷をそろえます（Little et al., 2002）。' : c.method === 'random' ? '乱数で配りました（乱数の種は下で変えられます）。' : c.method === 'oddeven' ? '項目の並び順に P1, P2, … と交互に配りました。' : '丸をクリックして、項目ごとにパーセルを決めます（下位尺度ごとにまとめるときなど）。'}丸をクリックすると手動に切り替わります。</p></section>`;
  });
  dl.innerHTML = `<div class="parbox" role="dialog" aria-label="アイテム・パーセリング"><div class="parhead"><b>アイテム・パーセリング</b><span style="flex:1"></span><button class="btn" data-par="close">閉じる</button></div>
    <div class="parscroll"><p class="hint">1 つの潜在変数の項目を、いくつかの「パーセル」（項目の平均）にまとめて指標にします。推定が安定し、適合度もよくなりやすい方法です。ただし、<b>測定モデルそのもの（尺度の因子構造）を確かめたいときには向きません。</b>関心が潜在変数どうしの関係（構造部分）にあるときに使い、項目が 1 次元であることを先に確かめます（Little et al., 2002, 2013; Bandalos, 2002）。</p>
    ${body}${PAR.msg}</div>
    <div class="parfoot"><label class="hint">乱数の種 <input id="parSeed" type="number" value="${PAR.seed}" style="width:6em"></label>
      <label class="hint">無作為配分 <select id="parN">${['50', '100', '200', '500'].map(v => `<option ${PAR.nAlloc === v ? 'selected' : ''}>${v}</option>`).join('')}</select> 通り</label>
      <button class="btn" data-par="alloc" ${cands.length && !done ? '' : 'disabled'}>無作為配分のばらつきを調べる</button><span style="flex:1"></span>
      ${done ? '<button class="btn" data-par="revert">元の項目に戻す</button>' : ''}<button class="btn primary" data-par="apply" ${cands.length && !done ? '' : 'disabled'}>パーセルを作って図を置き換える</button></div></div>`;
}
function parBind(dl) {
  dl.addEventListener('click', e => {
    if (e.target === dl) { parClose(); return; }
    const b = e.target.closest('[data-par]'); if (!b) return; const a = b.dataset.par;
    try {
      if (a === 'close') parClose();
      if (a === 'apply') parApply();
      if (a === 'revert') parRevert();
      if (a === 'alloc') parAllocRun();
      if (a === 'cancel' && PAR.job) PAR.job.cancel = true;
    } catch (err) { PAR.msg = `<p class="parwarn">${esc(err.message)}</p>`; parRender(); }
  });
  dl.addEventListener('change', e => {
    const t = e.target, m = state.db.semModel, lat = id => m.nodes.find(n => n.id === id);
    if (t.dataset.parUse) { PAR.cfg[t.dataset.parUse].use = t.checked; }
    if (t.dataset.parK) { const c = PAR.cfg[t.dataset.parK]; c.k = +t.value; c.manual = null; if (c.method === 'manual') c.method = 'balance'; }
    if (t.dataset.parM) { const c = PAR.cfg[t.dataset.parM]; if (t.value === 'manual') c.manual = { ...parConf(m, lat(t.dataset.parM)).asg }; c.method = t.value; }
    if (t.dataset.parA) { const L = lat(t.dataset.parA), c = PAR.cfg[L.id], cur = parConf(m, L).asg; c.manual = { ...cur, [t.dataset.it]: +t.value }; c.method = 'manual'; }
    if (t.id === 'parSeed') PAR.seed = Math.round(+t.value) || 1;
    if (t.id === 'parN') { PAR.nAlloc = t.value; return; }
    PAR.msg = ''; parRender();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#parDlg') && !$('#parDlg').hidden) { e.stopImmediatePropagation(); parClose(); } }, true);
}

// パーセルに置き換えたモデル（m は変えずに複製を返す）。groups: { latId: [[項目…], …] }
function parModel(m, plan) {
  const mm = JSON.parse(JSON.stringify(m));
  Object.entries(plan).forEach(([lid, groups]) => {
    const lat = mm.nodes.find(n => n.id === lid), its = parItemsOf(mm, lat), ids = new Set(its.map(n => n.id));
    const xs = its.map(n => n.x), ys = its.map(n => n.y), vert = Math.max(...ys) - Math.min(...ys) >= Math.max(...xs) - Math.min(...xs);
    const ax = vert ? ys : xs, lo = Math.min(...ax), hi = Math.max(...ax), cx = S.mean(xs), cy = S.mean(ys), k = groups.length;
    mm.nodes = mm.nodes.filter(n => !ids.has(n.id)); mm.edges = mm.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
    groups.forEach((g, p) => {
      const t = k > 1 ? lo + (hi - lo) * p / (k - 1) : (lo + hi) / 2, n = { id: 'n' + mm.nid++, name: parName(lat.name, p), kind: 'obs', x: Math.round(vert ? cx : t), y: Math.round(vert ? t : cy) };
      mm.nodes.push(n); mm.edges.push({ id: 'e' + mm.nid++, type: 'path', from: lat.id, to: n.id, fix: null });
    });
  });
  return mm;
}
// パーセルの列の値をモデルに使って推定する（データの列は作らない）
function parFit(mm, extra) {
  const spec = semSpec(mm), raw = spec.obs.map(v => extra[v] || parColNum(v)), ok = raw[0].map((_, i) => raw.every(c => isFinite(c[i]))), data = raw.map(c => c.filter((_, i) => ok[i]));
  need(data[0].length > spec.obs.length + 2, 'データの人数が少なすぎます。');
  return S.sem.fit(spec, data);
}
function parPlan(m) { // 使う潜在変数ごとの割り当て
  const plan = {}, info = [];
  parCandidates(m).forEach(lat => { const { items, c, groups } = parConf(m, lat); if (!c.use) return; need(groups.every(g => g.length), `「${lat.name}」に、項目が 1 つも入っていないパーセルがあります。`); plan[lat.id] = groups; info.push({ lat, items, c, groups }); });
  need(info.length, 'パーセルにする潜在変数を 1 つ以上選んでください。');
  return { plan, info };
}

// ----- パーセルを作る -----
function parSetCol(name, label, vals, recipe) { // 同じ名前の列があれば値を書き換える（作り直しに対応）
  const d = state.db, j = d.cols.findIndex(c => c.name === name);
  if (j < 0) return ppAddCol({ name, label }, vals, recipe);
  d.rows.forEach((r, i) => { while (r.length < d.cols.length) r.push(''); r[j] = isFinite(vals[i]) ? String(+vals[i].toFixed(6)) : ''; });
  d.cols[j].label = label; if (d.recipe) d.recipe = d.recipe.filter(x => !x.t.startsWith(`パーセル ${name}：`)); d.recipe = d.recipe || []; d.recipe.push({ t: recipe.t, r: recipe.r }); return name;
}
function parApply() {
  const m = state.db.semModel, { plan, info } = parPlan(m), before = JSON.parse(JSON.stringify(m)), cfas = {};
  info.forEach(({ lat, items, groups }) => {
    try { cfas[lat.id] = parCfa1(lat, items); } catch (e) { }
    const vals = parMeans(groups);
    groups.forEach((g, p) => { const nm = parName(lat.name, p); parSetCol(nm, `${lat.name} のパーセル ${p + 1}（${g.join('・')} の平均）`, vals[p], { t: `パーセル ${nm}：${g.join('・')} の平均`, r: `d$${RQ(nm)} <- rowMeans(d[, c(${g.map(RS).join(', ')})], na.rm = TRUE)   # パーセル（項目の平均）` }); });
  });
  semPush(); const mm = parModel(m, plan);
  mm.parcels = {}; info.forEach(({ lat, items, c, groups }) => { mm.parcels[lat.name] = { method: c.method, k: c.k, items, groups }; });
  mm.parcelOrig = before; state.db.semModel = mm; SE.sel = null; SE.fit = null; save();
  addResult({ title: `アイテム・パーセリング（${info.map(x => x.lat.name).join('・')}）`, html: parReport(info, cfas), r: parRcode(before, mm, info) }, true);
  parClose(); renderSemEditor(true);
  const h = $('#semHint'); if (h) h.textContent = 'パーセルを作り、図の指標を置き換えました。データにパーセルの列を加えています。「推定する」で推定できます（パーセルの中身は結果ツリーに出しました）。';
}
function parRevert() {
  const m = state.db.semModel; need(m.parcelOrig, '元に戻せる情報がありません。');
  semPush(); const o = m.parcelOrig; semKeepLook(m, o); state.db.semModel = o; SE.sel = null; SE.fit = null; save(); PAR.msg = '<p class="hint">元の項目のモデルに戻しました（データに加えたパーセルの列は残しています）。</p>'; parRender(); renderSemEditor(true);
}
const PAR_DESC = { balance: '項目と構成概念のバランス法（item-to-construct balance; Little et al., 2002）', random: '無作為配分', oddeven: '項目の順に交互に配る方法', manual: '内容（下位尺度）に基づく手動の割り当て' };
function parReport(info, cfas) {
  let h = '<p class="note">パーセルの得点は、含まれる項目の平均です（欠測は除いて平均）。データシートに列として加えました。</p>';
  info.forEach(({ lat, items, c, groups }) => {
    const cf = cfas[lat.id], F = cf && cf.F;
    h += `<h4>${esc(lat.name)}：${groups.length} パーセル（${PAR_DESC[c.method]}）</h4>` + table(['パーセル', '項目', '項目数', '標準化負荷の平均'], groups.map((g, p) => [parName(esc(lat.name), p), g.map(esc).join('・'), g.length, cf ? c2(g.reduce((a, it) => a + Math.abs(cf.load[it]), 0) / g.length) : '—']));
    if (F) h += `<p class="note">1 因子 CFA（項目 ${items.length}、n = ${cf.n}）：${F.df > 0 ? `χ²(${F.df}) = ${fmt(F.chi, 2)}, ${apaP(F.pv)}, CFI = ${c2(F.cfi)}, TLI = ${c2(F.tli)}, RMSEA = ${c2(F.rmsea)}, SRMR = ${c2(F.srmr)}` : '自由度 0'}。標準化負荷：${items.map(it => `${esc(it)} ${c2(cf.load[it])}`).join('、')}。</p>`;
  });
  h += interp('パーセリングは、項目を少数のパーセルにまとめて指標にする方法です。指標が減るので推定が安定し、項目ごとの細かな誤差がならされて適合度もよくなりやすくなります。', '一方で、項目が 1 次元でないままパーセルにすると、本来あるはずのモデルの誤り（交差負荷や誤差相関）が隠れてしまいます（Bandalos, 2002; Marsh et al., 2013）。上の 1 因子 CFA の適合がよいことを確かめたうえで使い、論文には「どの項目をどのパーセルにまとめたか」と「分け方」を書きます。', 'バランス法は、各パーセルの負荷の平均がそろうように配る方法です。無作為に分けた場合は、分け方しだいで結果が変わることがあるため、「無作為配分のばらつきを調べる」で確かめておくと安心です（Sterba & MacCallum, 2010）。');
  const t = info.map(({ lat, items, c, groups }) => `${esc(lat.name)}の ${items.length} 項目は${PAR_DESC[c.method].replace(/（.*）/, '')}により ${groups.length} つのパーセルにまとめた（${groups.map((g, p) => `${parName(esc(lat.name), p)}：${g.map(esc).join('・')}`).join('、')}）`).join('。');
  h += apa('論文記載例（方法）', `推定の安定性を高めるため、項目をパーセルにまとめて潜在変数の指標とした（Little et al., 2002）。${t}。パーセルの得点には項目の平均を用いた。事前に各尺度の 1 因子確認的因子分析を行い、1 次元性を確認した。`);
  return h;
}
function parRcode(before, mm, info) {
  const items = [...new Set(info.flatMap(x => x.items))], others = semSpec(mm).obs.filter(v => !info.some(x => x.groups.some((_, p) => parName(x.lat.name, p) === v)));
  const J = [...items, ...others].map(nm0 => state.db.cols.findIndex(c => c.name === nm0)).filter(j => j >= 0);
  let s = rHeader('アイテム・パーセリング', ['lavaan']) + rDataFrame(J.map(j => state.db.cols[j].name), J.map(j => dbCol(j)));
  info.forEach(({ lat, items: its, groups }) => {
    s += `\n# ${lat.name}：1 因子 CFA で 1 次元性を確認\nfit1 <- lavaan::cfa('F1 =~ ${its.join(' + ')}', data = d)\nlavaan::fitMeasures(fit1, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr"))\nlavaan::standardizedSolution(fit1)[1:${its.length}, c("rhs", "est.std")]\n# パーセル（項目の平均）\n`;
    groups.forEach((g, p) => { s += `d$${RQ(parName(lat.name, p))} <- rowMeans(d[, c(${g.map(RS).join(', ')})], na.rm = TRUE)\n`; });
  });
  const auto = semAutoCov(mm).map(e => `${mm.nodes.find(n => n.id === e.from).name} ~~ ${mm.nodes.find(n => n.id === e.to).name}`);
  s += `\n# パーセルを指標にしたモデル\nmodel <- '\n${semSyntax(mm)}${auto.length ? '\n' + auto.join('\n') : ''}\n'\nfit <- lavaan::sem(model, data = d${mm.autoCov ? '' : ', auto.cov.lv.x = FALSE'})\nsummary(fit, fit.measures = TRUE, standardized = TRUE)\n`;
  s += `\n# 無作為配分のばらつき（Sterba & MacCallum, 2010）は semTools でも調べられます\n# item.syntax <- '\n${info.map(x => `#   ${x.lat.name} =~ ${x.items.join(' + ')}`).join('\n')}\n# '\n# semTools::parcelAllocation(model, data = d, parcel.names = c(${info.flatMap(x => x.groups.map((_, p) => RS(parName(x.lat.name, p)))).join(', ')}), item.syntax = item.syntax, nAlloc = 100)\n`;
  return s;
}

// ----- 無作為配分のばらつき -----
function parAllocRun() {
  const m = state.db.semModel, { info } = parPlan(m), N = +PAR.nAlloc, R = rng(PAR.seed * 31 + 7);
  const cols = {}; info.forEach(({ items }) => items.forEach(it => { cols[it] = parColNum(it); }));
  const plan0 = {}; info.forEach(x => { plan0[x.lat.id] = x.groups; });
  const keyOf = e => e.type === 'A' ? `${e.from} → ${e.to}` : `${e.from} ↔ ${e.to}`;
  const isPN = name => info.some(x => x.groups.some((_, p) => parName(x.lat.name, p) === name));
  const pick = F => { const o = { CFI: F.cfi, TLI: F.tli, RMSEA: F.rmsea, SRMR: F.srmr, 'χ²': F.chi }; F.est.filter(e => (e.type === 'A' && e.role !== 'load') || (e.type === 'S' && e.i !== e.j && !isPN(e.from) && !isPN(e.to))).forEach(e => { o[keyOf(e)] = e.std; o['p:' + keyOf(e)] = e.p; }); return o; };
  const fitPlan = plan => { const mm = parModel(m, plan), extra = {}; Object.entries(plan).forEach(([lid, groups]) => { const L = m.nodes.find(n => n.id === lid); groups.forEach((g, p) => { extra[parName(L.name, p)] = cols[g[0]].map((_, i) => { const v = g.map(it => cols[it][i]).filter(isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }); }); }); return parFit(mm, extra); };
  const ref = fitPlan(plan0); need(ref.conv, '今の割り当てで推定が収束しませんでした。');
  const res = [], job = PAR.job = { cancel: false }; let fail = 0, done = 0;
  const tick = () => {
    if (job.cancel) { PAR.job = null; PAR.msg = '<p class="hint">無作為配分の計算を中止しました。</p>'; parRender(); return; }
    const t0 = performance.now();
    while (done < N && performance.now() - t0 < 60) {
      const plan = {}; info.forEach(({ lat, items, c }) => { plan[lat.id] = parGroups(items, c.k, parAllocate(items, c.k, 'random', {}, R)); });
      try { const F = fitPlan(plan); if (F.conv && !F.heywood.length) res.push(pick(F)); else fail++; } catch (e) { fail++; }
      done++;
    }
    PAR.msg = `<div class="parprog"><b>無作為配分を推定中</b> ${done} / ${N}<progress max="${N}" value="${done}"></progress><button class="btn" data-par="cancel">中止</button></div>`; parRender();
    if (done < N) { setTimeout(tick, 0); return; }
    PAR.job = null; need(res.length >= 10, '多くの配分で推定が収束しませんでした。');
    const html = parAllocReport(info, pick(ref), res, N, fail);
    addResult({ title: `無作為配分のばらつき（${info.map(x => x.lat.name).join('・')}、${N} 通り）`, html, r: parRcode(m, parModel(m, plan0), info) }, true);
    PAR.msg = `<div class="parres"><h5>無作為配分のばらつき（${res.length} 通り）</h5>${html.split('<h4>')[1] ? '<h4>' + html.split('<h4>')[1].split('<div class="interp">')[0] : ''}<p class="hint">詳しい表は結果ツリーにも出しました。</p></div>`; parRender();
    const sc = $('#parDlg .parscroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  };
  setTimeout(tick, 0);
}
function parAllocReport(info, ref, res, N, fail) {
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
  const keys = Object.keys(ref).filter(k => !k.startsWith('p:'));
  const rows = keys.map(k => { const a = res.map(r => r[k]).filter(isFinite), P = res.map(r => r['p:' + k]).filter(isFinite), d = k === 'χ²' ? 2 : null, f = v => d ? fmt(v, d) : c2(v);
    return [esc(k), f(ref[k]), f(q(a, .5)), `${f(Math.min(...a))} 〜 ${f(Math.max(...a))}`, `[${f(q(a, .025))}, ${f(q(a, .975))}]`, P.length ? Math.round(P.filter(p => p < .05).length / P.length * 100) + '%' : '']; });
  let h = `<p class="note">各潜在変数の項目を、同じパーセル数のまま無作為に ${N} 通り配り直して推定しました（収束 ${res.length} 通り${fail ? `、収束しない・不適解の ${fail} 通りは除外` : ''}）。係数は標準化推定値です。</p>`;
  h += '<h4>配分による変動</h4>' + table(['指標・係数', '今の割り当て', '中央値', '最小 〜 最大', '95% の範囲', '有意（p < .05）の割合'], rows);
  const paths = keys.filter(k => k.includes('→') || k.includes('↔')), unstable = paths.filter(k => { const P = res.map(r => r['p:' + k]).filter(isFinite), s = P.filter(p => p < .05).length / (P.length || 1); return s > .05 && s < .95; });
  const cfi = res.map(r => r.CFI).filter(isFinite);
  h += interp(`無作為に分けると、どの項目が同じパーセルに入るかで結果が少し変わります。この表は、その揺れの大きさを示します（Sterba & MacCallum, 2010）。CFI は ${c2(Math.min(...cfi))} 〜 ${c2(Math.max(...cfi))} の範囲で動きました。`,
    unstable.length ? `<b>${unstable.map(esc).join('、')}</b> は、配分によって有意になったりならなかったりします。結論がパーセルの分け方に左右されるので、無作為の 1 回だけで判断せず、バランス法や内容に基づく割り当てを使い、この表もあわせて報告することを勧めます。` : (paths.length ? 'どのパスも、ほとんどの配分で有意かどうかの判断が変わりませんでした。結論はパーセルの分け方に左右されにくいといえます。' : ''),
    '「今の割り当て」は、ダイアログで選んでいる分け方（バランス法など）の結果です。中央値に近ければ、典型的な結果だといえます。');
  return h;
}
