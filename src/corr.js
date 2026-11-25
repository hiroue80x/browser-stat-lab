// ===== 左の一覧から右の箱へ変数を移す部品（箱は複数可）と、相関係数（偏相関つき） =====
// DL2.html(id, spec) で描き、移動のたびに spec.set(boxKey, keys) → spec.rerender() を呼ぶ。
const DL2 = { reg: {}, sel: {} }; // reg: id → spec、sel: id → { side, keys:Set, last }
DL2.html = function (id, spec) {
  DL2.reg[id] = spec; const S0 = DL2.sel[id] || (DL2.sel[id] = { side: 'L', keys: new Set(), last: null });
  const used = new Set(spec.boxes.flatMap(b => spec.get(b.key))), byKey = new Map(spec.items.map(it => [String(it.key), it]));
  const item = (it, side) => `<div class="dli${S0.side === side && S0.keys.has(String(it.key)) ? ' on' : ''}" data-dl2="${id}" data-dlside="${side}" data-dlkey="${esc(String(it.key))}" title="ダブルクリックで${side === 'L' ? '右の箱へ入れる' : '左へ戻す'}"><b>${esc(it.name)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</div>`;
  const left = spec.items.filter(it => !used.has(it.key)), nb = spec.boxes.length;
  let h = `<div class="dual2" style="grid-template-rows:repeat(${nb}, auto)">
    <div class="dlcol" style="grid-row:1 / span ${nb};grid-column:1"><div class="dlhead">${spec.leftTitle || '変数'} <small>（${left.length}）</small></div><div class="dlist" style="height:${spec.leftHeight || 240}px">${left.map(it => item(it, 'L')).join('') || '<div class="dlempty">すべて右に入っています</div>'}</div></div>`;
  spec.boxes.forEach((b, i) => {
    const ks = spec.get(b.key).filter(k => byKey.has(String(k)));
    h += `<div class="dlbtns" style="grid-row:${i + 1};grid-column:2"><button class="btn primary" data-dl2mv="${id}" data-box="${b.key}" data-dir="in" title="左で選んだ変数を「${esc(b.title)}」へ">→</button><button class="btn" data-dl2mv="${id}" data-box="${b.key}" data-dir="out" title="「${esc(b.title)}」で選んだ変数を左へ">←</button></div>
      <div class="dlcol" style="grid-row:${i + 1};grid-column:3"><div class="dlhead">${esc(b.title)} <small>（${ks.length}）${b.note ? ' ' + esc(b.note) : ''}</small></div><div class="dlist" style="height:${b.height || 110}px">${ks.map(k => item(byKey.get(String(k)), b.key)).join('') || `<div class="dlempty">${esc(b.empty || '左から入れてください')}</div>`}</div></div>`;
  });
  return h + `</div><p class="hint" style="margin:4px 0 0">クリックで選び（Shift で範囲、⌘ / Ctrl で追加）、→ で右の箱へ入れます。ダブルクリックでもすぐ移せます。${spec.hint || ''}</p>`;
};
DL2.move = function (id, box, dir) {
  const spec = DL2.reg[id], S0 = DL2.sel[id]; if (!spec || !S0) return;
  const keyOf = k => spec.items.find(it => String(it.key) === k)?.key;
  if (dir === 'in') {
    if (S0.side !== 'L' || !S0.keys.size) return;
    const add = spec.items.filter(it => S0.keys.has(String(it.key))).map(it => it.key), b = spec.boxes.find(x => x.key === box), cur = spec.get(box);
    let next = [...cur, ...add.filter(k => !cur.includes(k))]; if (b.max) next = next.slice(0, b.max);
    spec.set(box, next);
  } else {
    if (S0.side !== box || !S0.keys.size) return;
    spec.set(box, spec.get(box).filter(k => !S0.keys.has(String(k))));
  }
  S0.keys.clear(); S0.side = 'L'; S0.last = null; spec.rerender();
};
document.addEventListener('click', e => {
  const mv = e.target.closest('[data-dl2mv]'); if (mv) { DL2.move(mv.dataset.dl2mv, mv.dataset.box, mv.dataset.dir); return; }
  const it = e.target.closest('[data-dl2]'); if (!it) return;
  const id = it.dataset.dl2, side = it.dataset.dlside, k = it.dataset.dlkey, S0 = DL2.sel[id]; if (!S0) return;
  if (S0.side !== side) { S0.keys.clear(); S0.side = side; }
  const list = [...it.parentElement.querySelectorAll('[data-dl2]')].map(x => x.dataset.dlkey);
  if (e.shiftKey && S0.last != null && list.includes(S0.last)) { const a = list.indexOf(S0.last), b = list.indexOf(k); list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => S0.keys.add(x)); }
  else if (e.metaKey || e.ctrlKey) { S0.keys.has(k) ? S0.keys.delete(k) : S0.keys.add(k); S0.last = k; }
  else { S0.keys.clear(); S0.keys.add(k); S0.last = k; }
  document.querySelectorAll(`[data-dl2="${id}"]`).forEach(x => x.classList.toggle('on', x.dataset.dlside === S0.side && S0.keys.has(x.dataset.dlkey)));
});
document.addEventListener('dblclick', e => {
  const it = e.target.closest('[data-dl2]'); if (!it) return;
  const id = it.dataset.dl2, side = it.dataset.dlside, S0 = DL2.sel[id], spec = DL2.reg[id]; if (!S0 || !spec) return;
  S0.side = side; S0.keys = new Set([it.dataset.dlkey]);
  if (side === 'L') { const b = spec.boxes.find(x => !x.max || spec.get(x.key).length < x.max) || spec.boxes[0]; DL2.move(id, b.key, 'in'); } else DL2.move(id, side, 'out');
});

// ----- 2変量型：相関係数の変数（相関を求める変数・影響を除く変数）と表示の設定 -----
function corState() {
  const d = state.bivar, n = d.cols.length, C = state.opt.cor || (state.opt.cor = { vars: d.cols.map((c, j) => j).filter(j => d.cols[j].on), ctrl: [] });
  C.vars = C.vars.filter(j => j < n); C.ctrl = C.ctrl.filter(j => j < n && !C.vars.includes(j));
  if (state.opt.corP == null) state.opt.corP = true; if (state.opt.corStar == null) state.opt.corStar = true;
  return C;
}
function corBox() {
  const d = state.bivar, C = corState();
  const items = d.cols.map((c, j) => ({ key: j, name: c.name || `列${j + 1}` }));
  const spec = {
    items, leftTitle: 'データシートの列', leftHeight: 230,
    boxes: [{ key: 'vars', title: '相関を求める変数', empty: '2 つ以上入れてください', height: 120 }, { key: 'ctrl', title: '影響を除く変数（偏相関）', note: '任意', empty: '入れると偏相関係数も出します', height: 80 }],
    get: k => C[k], set: (k, v) => { C[k] = v; if (k === 'vars') C.ctrl = C.ctrl.filter(j => !v.includes(j)); else C.vars = C.vars.filter(j => !v.includes(j)); save(); },
    rerender: () => renderPanel()
  };
  return `<div class="corbox"><h4 class="corh">相関係数で使う変数</h4>${DL2.html('cor', spec)}
    <div class="opts" style="margin-top:6px"><label><input type="checkbox" id="oCorP" ${state.opt.corP ? 'checked' : ''}> p 値を表示</label><label><input type="checkbox" id="oCorStar" ${state.opt.corStar ? 'checked' : ''}> 有意な相関にアスタリスク（* <i>p</i> &lt; .05, ** <i>p</i> &lt; .01, *** <i>p</i> &lt; .001）</label></div>
    <p class="hint" style="margin:2px 0 0">「相関係数」のボタンは、この箱に入れた変数で計算します（列見出しのチェックは使いません）。</p></div>`;
}
{ const rp0 = renderPanel; renderPanel = function () { rp0.apply(this, arguments); if (state.fmt === 'bivar') { const o = document.querySelector('#panelBody .opts'); if (o) o.insertAdjacentHTML('afterend', corBox()); } }; }
$('#panelBody').addEventListener('change', e => {
  if (e.target.id === 'oCorP') { state.opt.corP = e.target.checked; save(); }
  if (e.target.id === 'oCorStar') { state.opt.corStar = e.target.checked; save(); }
});

// 偏相関：相関行列の逆行列から（r_ij·Z = −P_ij / √(P_ii P_jj)）
function corInv(A) {
  const n = A.length, M = A.map((r, i) => [...r, ...A.map((_, j) => +(i === j))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('影響を除く変数どうしが、ほかの変数で完全に説明できてしまうため、偏相関を計算できません。同じ内容の変数が入っていないか確認してください。');
    [M[c], M[p]] = [M[p], M[c]]; const v = M[c][c]; M[c] = M[c].map(x => x / v);
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; M[r] = M[r].map((x, k) => x - f * M[c][k]); }
  }
  return M.map(r => r.slice(n));
}
function partialCor(x, y, Z) {
  const n = x.length, q = Z.length, P = corInv(S.corMatrix([x, y, ...Z])), r = -P[0][1] / Math.sqrt(P[0][0] * P[1][1]);
  const df = n - 2 - q, t = r * Math.sqrt(df / (1 - r * r)), z = Math.atanh(r), se = 1 / Math.sqrt(n - 3 - q), zc = S.qn(0.025);
  return { r, t, df, p: S.pt2(t, df), ciL: Math.tanh(z - zc * se), ciU: Math.tanh(z + zc * se) };
}

ANALYSES.bivar.cor = function () {
  const d = state.bivar, C = corState(), showP = state.opt.corP, showS = state.opt.corStar;
  need(C.vars.length >= 2, '「相関を求める変数」の箱に、2 つ以上の列を入れてください。');
  const vs = C.vars.map(j => ({ ...d.cols[j], j })), zs = C.ctrl.map(j => ({ ...d.cols[j], j })), L = listwise([...vs, ...zs]), k = vs.length, q = zs.length;
  need(L.n >= 4 + q, `空欄のない行が ${4 + q} 行以上必要です。`);
  const X = L.cols.slice(0, k), Z = L.cols.slice(k), n = vs.map(x => x.name), zn = zs.map(x => x.name);
  const st = p => showS ? star(p) : '', rv = (r, p) => ({ v: fmt(r) + (st(p) ? `<sup>${st(p)}</sup>` : ''), cls: showS && p < .05 ? 'sig' : '' }), pv = p => fp(p);
  const pairs = S.pairs(k), PR = pairs.map(([i, j]) => ({ i, j, P: S.pearson(X[i], X[j]), Sp: S.spearman(X[i], X[j]), K: S.kendall(X[i], X[j]), Q: q ? partialCor(X[i], X[j], Z) : null }));
  let h = `<p class="note">n = ${L.n}${L.dropped ? `（空欄を含む ${L.dropped} 行を除外）` : ''}。${q ? `影響を除く変数：${zn.map(esc).join('・')}。` : ''}</p>`;
  // 一覧（組ごと）
  const head = ['組', 'Pearson r', '95%CI', ...(showP ? ['p 値'] : []), 'Spearman ρ', ...(showP ? ['p 値'] : []), 'Kendall τ<sub>b</sub>', ...(showP ? ['p 値'] : []), ...(q ? ['偏相関 r', '95%CI', ...(showP ? ['p 値'] : [])] : [])];
  h += '<h4>相関係数の一覧</h4>' + table(head, PR.map(o => [`${esc(n[o.i])} × ${esc(n[o.j])}`, rv(o.P.r, o.P.p), `[${fmt(o.P.ciL)}, ${fmt(o.P.ciU)}]`, ...(showP ? [pv(o.P.p)] : []), rv(o.Sp.rho, o.Sp.p), ...(showP ? [pv(o.Sp.p)] : []), rv(o.K.tau, o.K.p), ...(showP ? [pv(o.K.p)] : []),
    ...(q ? [rv(o.Q.r, o.Q.p), `[${fmt(o.Q.ciL)}, ${fmt(o.Q.ciU)}]`, ...(showP ? [pv(o.Q.p)] : [])] : [])]));
  // 相関行列（APA の形：下三角に r、M と SD つき）
  const apaR = r => fmt(r, 2).replace(/^([−-]?)0\./, '$1.'); // APA：相関は 1 を超えないので、小数点の前の 0 を省き小数 2 桁
  const cell = (r, p) => { const o = { v: apaR(r) + (st(p) ? `<sup>${st(p)}</sup>` : ''), cls: showS && p < .05 ? 'sig' : '' }; if (showP) o.v += `<br><small class="pp">(${p < .001 ? '< .001' : fp(p)})</small>`; return o; };
  const mat = (get, title) => '<h4>' + title + '</h4>' + table(['変数', '<i>M</i>', '<i>SD</i>', ...n.map((_, c) => String(c + 1))], n.map((nm, i) => [`${i + 1}. ${esc(nm)}`, fmt(S.mean(X[i]), 2), fmt(S.sd(X[i]), 2), ...n.map((_, c) => c < i ? cell(...get(c, i)) : c === i ? '—' : '')]));
  const find = (a, b) => PR.find(o => o.i === a && o.j === b);
  if (k >= 3) h += mat((a, b) => { const o = find(a, b); return [o.P.r, o.P.p]; }, `相関行列（Pearson の r${showP ? '、括弧内は p 値' : ''}）`);
  if (q && k >= 3) h += mat((a, b) => { const o = find(a, b); return [o.Q.r, o.Q.p]; }, `偏相関行列（${zn.map(esc).join('・')} の影響を除いた r、自由度 ${L.n - 2 - q}${showP ? '、括弧内は p 値' : ''}）`);
  h += `<p class="note">${showS ? '<sup>*</sup><i>p</i> &lt; .05, <sup>**</sup><i>p</i> &lt; .01, <sup>***</sup><i>p</i> &lt; .001（両側）。' : ''}${k >= 3 ? '相関行列は APA の形式（小数点の前の 0 を省き小数 2 桁）。' : ''}95%CI は Fisher の z 変換。Spearman・Kendall の p 値は正規近似（同順位補正あり）。${q ? `偏相関の自由度は n − 2 − ${q}（除いた変数の数）です。` : ''}</p>`;
  const sigTxt = p => p < .05 ? `（有意、${pTxt(p)}）` : `が、有意ではありません（${pTxt(p)}）`;
  h += interp(PR.slice(0, 6).map(o => { const nm = `${esc(n[o.i])} と ${esc(n[o.j])}`; let s = `${nm}：r = ${fmt(o.P.r, 2)} で、${o.P.r > 0 ? '一方が高いほどもう一方も高い（正の）' : '一方が高いほどもう一方は低い（負の）'}${rMag(o.P.r)}相関です${sigTxt(o.P.p)}。`;
      if (q) s += `${zn.map(esc).join('・')} の影響を除くと r = ${fmt(o.Q.r, 2)}${o.Q.p < .05 ? `（有意、${pTxt(o.Q.p)}）` : `（有意ではない、${pTxt(o.Q.p)}）`}で、${Math.abs(o.Q.r) < Math.abs(o.P.r) - .1 ? '関係の一部は、除いた変数を通した見かけの関係だったと考えられます。' : Math.abs(o.Q.r) > Math.abs(o.P.r) + .1 ? '除いた変数が関係を隠していた（抑制していた）と考えられます。' : '除く前とあまり変わりません。'}`;
      else if (Math.abs(o.P.r - o.Sp.rho) > .15) s += `Spearman の ρ（${fmt(o.Sp.rho, 2)}）と大きく違うので、外れ値や曲線的な関係がないか散布図で確認してください。`;
      return s; }),
    '相関の目安は |r| が .1 で弱い、.3 で中程度、.5 で強い（Cohen, 1988）です。相関は「一緒に変化する」ことを示すだけで、どちらが原因かは分かりません。' + (q ? '偏相関は、除いた変数の値が同じ人どうしで比べたときの相関にあたります。' : ''));
  const o0 = PR[0];
  h += apa('論文記載例', `${esc(n[0])}と${esc(n[1])}の間には、<i>r</i>(${L.n - 2}) = ${fmt(o0.P.r, 2)}, 95% CI [${fmt(o0.P.ciL, 2)}, ${fmt(o0.P.ciU, 2)}], ${apaP(o0.P.p)} の相関がありました。` + (q ? `${zn.map(esc).join('・')}の影響を除いた偏相関は、<i>r</i>(${o0.Q.df}) = ${fmt(o0.Q.r, 2)}, 95% CI [${fmt(o0.Q.ciL, 2)}, ${fmt(o0.Q.ciU, 2)}], ${apaP(o0.Q.p)} でした。` : '') + (k > 2 ? '相関行列は、表のように下三角に係数を示し、注に有意水準の記号を書きます。' : ''));
  return { title: q ? '相関係数・偏相関係数' : '相関係数', html: h };
};
RCODE.bivar.cor = function () {
  const d = state.bivar, C = corState(), names = [...C.vars, ...C.ctrl].map(j => d.cols[j].name), cols = [...C.vars, ...C.ctrl].map(j => d.rows.map(r => r[j] ?? '')), v = C.vars.map(j => RS(d.cols[j].name)), z = C.ctrl.map(j => RS(d.cols[j].name));
  let s = rHeader(z.length ? '相関係数・偏相関係数' : '相関係数', ['psych']) + rDataFrame(names, cols) + 'd <- na.omit(d)\n';
  s += `v <- c(${v.join(', ')})\npsych::corr.test(d[, v], adjust = "none")                       # Pearson の r と p 値（多重比較の調整なし。アプリと同じ）\npsych::corr.test(d[, v], method = "spearman", adjust = "none")  # Spearman の ρ\n`;
  if (v.length === 2) s += `cor.test(d[[v[1]]], d[[v[2]]], method = "kendall", exact = FALSE)\n`;
  if (z.length) s += `z <- c(${z.join(', ')})\npr <- psych::partial.r(d, x = v, y = z)          # 偏相関係数（z の影響を除く）\npr\npsych::corr.p(pr, n = nrow(d) - length(z), adjust = "none")  # 偏相関の p 値（自由度 n − 2 − 除いた変数の数）\n`;
  return s;
};
