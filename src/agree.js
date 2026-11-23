// ===== 評定者間一致：κ 係数（Cohen・重みつき・Fleiss）と ICC（6 種類） =====
state.opt.kappaW = state.opt.kappaW || 'quadratic'; state.opt.iccModel = state.opt.iccModel || 'twoway-random'; state.opt.iccType = state.opt.iccType || 'agreement'; state.opt.iccUnit = state.opt.iccUnit || 'single';
function makeAgreeSample() { // 例として入っている架空データ（作文 40 編を 3 人が 10 段階で評定、発言 40 個を 3 人がコーディング）
  const R = rng(5150), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [], cl = v => Math.min(10, Math.max(1, Math.round(v)));
  for (let i = 0; i < 40; i++) {
    const T = 5.8 + 1.7 * nrm(), cat = R() < .4 ? 1 : R() < .55 ? 2 : 3, code = () => R() < .8 ? cat : 1 + Math.floor(R() * 3);
    rows.push([String(i + 1), cl(T + .7 * nrm()), cl(T + .9 + .7 * nrm()), cl(T + 1.0 * nrm()), code(), code(), code()].map(String));
  }
  const lab = [['1', '肯定的'], ['2', '中立'], ['3', '否定的']];
  return { cols: [{ name: 'ID', on: true }, ...['A', 'B', 'C'].map(x => ({ name: `評定者${x}`, on: true, label: `作文の評価（10 段階）・評定者${x}` })), ...[1, 2, 3].map(k => ({ name: `コーダー${k}`, on: true, label: `発言の分類・コーダー${k}`, measure: 'nominal', values: lab.map(v => [...v]) }))],
    rows, roles: { y: 1, a: -1, b: -1, x: [], rep: [], fa: [], ag: [1, 2, 3] } };
}
function agData(needNum) {
  const R = state.db.roles, js = [...(R.ag || [])].filter(j => j < state.db.cols.length && colType(j) !== 'empty').sort((a, b) => a - b);
  need(js.length >= 2, '評定者の列を 2 つ以上、右のリストに入れてください（1 行 ＝ 評定される対象、1 列 ＝ 評定者）。');
  if (needNum) { const bad = js.filter(j => colType(j) !== 'num'); need(!bad.length, `ICC には数値の列が必要です（数値でない列：${bad.map(j => state.db.cols[j].name).join('、')}）。カテゴリの評定には κ 係数を使ってください。`); }
  const C = js.map(j => rawCol(j)), ok = C[0].map((_, i) => C.every(c => c[i] !== '')), rows = C[0].map((_, i) => i).filter(i => ok[i]);
  need(rows.length >= 3, `すべての評定者がそろって評定している対象が ${rows.length} 件しかありません。`);
  return { js, names: js.map(j => state.db.cols[j].name), C: C.map(c => rows.map(i => c[i])), n: rows.length, nMiss: ok.length - rows.length, k: js.length };
}
const agLand = k => k < 0 ? '一致は偶然以下（poor）' : k <= .20 ? 'わずかな一致（slight）' : k <= .40 ? 'まずまずの一致（fair）' : k <= .60 ? '中程度の一致（moderate）' : k <= .80 ? 'かなりの一致（substantial）' : 'ほぼ完全な一致（almost perfect）';
const agKoo = v => v < .5 ? '低い（poor）' : v < .75 ? '中程度（moderate）' : v < .9 ? '良好（good）' : '非常に良好（excellent）';
function agLevels(cols, js) { const all = [...new Set(cols.flat())]; return all.every(v => isFinite(toNum(v))) ? all.sort((a, b) => toNum(a) - toNum(b)) : levelsOf(all); }
// Cohen の κ（重みなし・重みつき）：値は irr::kappa2、信頼区間は psych::cohen.kappa と同じ
function cohenKappa(x1, x2, lev, wt) {
  const L = lev.length, n = x1.length, ix = Object.fromEntries(lev.map((v, i) => [v, i])), T = Array.from({ length: L }, () => new Array(L).fill(0));
  x1.forEach((v, i) => T[ix[v]][ix[x2[i]]]++);
  const W = (e) => lev.map((_, i) => lev.map((_, j) => L < 2 ? 1 : 1 - Math.abs(i - j) ** e / (L - 1) ** e));
  const P = T.map(r => r.map(v => v / n)), rs = P.map(r => S.sum(r)), cs = lev.map((_, j) => S.sum(P.map(r => r[j])));
  const est = (w) => { const po = S.sum(P.flatMap((r, i) => r.map((v, j) => v * w[i][j]))), pc = S.sum(rs.flatMap((a, i) => cs.map((b, j) => a * b * w[i][j]))), k = (po - pc) / (1 - pc);
    // 帰無仮説のもとでの SE（irr::kappa2 の z 検定）
    const wi = lev.map((_, i) => S.sum(cs.map((b, j) => b * w[i][j]))), wj = lev.map((_, j) => S.sum(rs.map((a, i) => a * w[i][j])));
    const v0 = (S.sum(rs.flatMap((a, i) => cs.map((b, j) => a * b * (w[i][j] - (wi[i] + wj[j])) ** 2))) - pc * pc) / (n * (1 - pc) ** 2), z = k / Math.sqrt(v0);
    // 漸近分散（psych::cohen.kappa の信頼区間）
    const colw = lev.map((_, j) => S.sum(cs.map((b, i) => w[i][j] * b))), roww = lev.map((_, j) => S.sum(rs.map((a, i) => w[i][j] * a)));
    const va = (S.sum(P.flatMap((r, i) => r.map((v, j) => v * (w[i][j] * (1 - pc) - (colw[i] + roww[j]) * (1 - po)) ** 2))) - (po * pc - 2 * pc + po) ** 2) / (n * (1 - pc) ** 4);
    const se = Math.sqrt(Math.max(va, 0)); return { k, po, pc, z, p: 2 * (1 - S.pnorm(Math.abs(z))), se, lo: k - 1.959963984540054 * se, hi: k + 1.959963984540054 * se }; };
  const I = lev.map((_, i) => lev.map((_, j) => +(i === j)));
  return { T, n, un: est(I), lin: est(W(1)), quad: est(W(2)) };
}
function fleissKappa(cols, lev) { // irr::kappam.fleiss（detail = TRUE）と同じ
  const n = cols[0].length, m = cols.length, L = lev.length, ix = Object.fromEntries(lev.map((v, i) => [v, i])), T = Array.from({ length: n }, (_, i) => { const r = new Array(L).fill(0); cols.forEach(c => r[ix[c[i]]]++); return r; });
  const Pa = S.sum(T.map(r => (S.sum(r.map(v => v * v)) - m) / (m * (m - 1)))) / n, tot = lev.map((_, j) => S.sum(T.map(r => r[j]))), pj = tot.map(v => v / (n * m)), qj = pj.map(p => 1 - p), Pe = S.sum(pj.map(p => p * p));
  const k = (Pa - Pe) / (1 - Pe), spq = S.sum(pj.map((p, j) => p * qj[j])), v = 2 / (spq * spq * n * m * (m - 1)) * (spq * spq - S.sum(pj.map((p, j) => p * qj[j] * (qj[j] - p)))), z = k / Math.sqrt(v);
  const cat = lev.map((_, j) => { const pjk = (S.sum(T.map(r => r[j] * r[j])) - n * m * pj[j]) / (n * m * (m - 1) * pj[j]), kk = (pjk - pj[j]) / (1 - pj[j]), zz = kk / Math.sqrt(2 / (n * m * (m - 1))); return { k: kk, z: zz, p: 2 * (1 - S.pnorm(Math.abs(zz))) }; });
  return { k, z, p: 2 * (1 - S.pnorm(Math.abs(z))), Pa, Pe, cat, pj };
}
// ICC：irr::icc と同じ計算（r0 = 0）
function iccAll(X) {
  const ns = X.length, nr = X[0].length, all = X.flat(), gm = S.mean(all), rm = X.map(r => S.mean(r)), cm = X[0].map((_, j) => S.mean(X.map(r => r[j])));
  const SST = S.sum(all.map(v => (v - gm) ** 2)), MSr = nr * S.sum(rm.map(v => (v - gm) ** 2)) / (ns - 1), MSc = ns * S.sum(cm.map(v => (v - gm) ** 2)) / (nr - 1), MSw = S.sum(X.map((r, i) => S.sum(r.map(v => (v - rm[i]) ** 2)) / (nr - 1))) / ns;
  const MSe = (SST - MSr * (ns - 1) - MSc * (nr - 1)) / ((ns - 1) * (nr - 1)), q = (d1, d2) => S.qf(.025, d1, d2), pf = (F, d1, d2) => S.pfU(F, d1, d2);
  const one = (avg) => { const c = avg ? (MSr - MSw) / MSr : (MSr - MSw) / (MSr + (nr - 1) * MSw), F = MSr / MSw, d1 = ns - 1, d2 = ns * (nr - 1), FL = F / q(d1, d2), FU = F * q(d2, d1); return { c, F, d1, d2, p: pf(F, d1, d2), lo: avg ? 1 - 1 / FL : (FL - 1) / (FL + nr - 1), hi: avg ? 1 - 1 / FU : (FU - 1) / (FU + nr - 1) }; };
  const cons = (avg) => { const c = avg ? (MSr - MSe) / MSr : (MSr - MSe) / (MSr + (nr - 1) * MSe), F = MSr / MSe, d1 = ns - 1, d2 = (ns - 1) * (nr - 1), FL = F / q(d1, d2), FU = F * q(d2, d1); return { c, F, d1, d2, p: pf(F, d1, d2), lo: avg ? 1 - 1 / FL : (FL - 1) / (FL + nr - 1), hi: avg ? 1 - 1 / FU : (FU - 1) / (FU + nr - 1) }; };
  const agr = (avg) => { const c = avg ? (MSr - MSe) / (MSr + (MSc - MSe) / ns) : (MSr - MSe) / (MSr + (nr - 1) * MSe + (nr / ns) * (MSc - MSe)), F = MSr / MSe, d1 = ns - 1, d2 = (ns - 1) * (nr - 1);
    const a = (nr * c) / (ns * (1 - c)), b = 1 + (nr * c * (ns - 1)) / (ns * (1 - c)), v = (a * MSc + b * MSe) ** 2 / ((a * MSc) ** 2 / (nr - 1) + (b * MSe) ** 2 / ((ns - 1) * (nr - 1))), FL = q(ns - 1, v), FU = q(v, ns - 1);
    const lo = avg ? (ns * (MSr - FL * MSe)) / (FL * (MSc - MSe) + ns * MSr) : (ns * (MSr - FL * MSe)) / (FL * (nr * MSc + (nr * ns - nr - ns) * MSe) + ns * MSr);
    const hi = avg ? (ns * (FU * MSr - MSe)) / (MSc - MSe + ns * FU * MSr) : (ns * (FU * MSr - MSe)) / (nr * MSc + (nr * ns - nr - ns) * MSe + ns * FU * MSr);
    return { c, F, d1, d2, p: pf(F, d1, d2), lo, hi }; };
  return { ns, nr, MSr, MSc, MSw, MSe, rows: [
    { key: '1', sf: 'ICC(1,1)', mw: 'ICC(1)', d: '一元配置・単一の評定者', ...one(false), model: 'oneway', type: 'agreement', unit: 'single' },
    { key: '2', sf: 'ICC(2,1)', mw: 'ICC(A,1)', d: '二元配置・絶対一致・単一の評定者', ...agr(false), model: 'twoway', type: 'agreement', unit: 'single' },
    { key: '3', sf: 'ICC(3,1)', mw: 'ICC(C,1)', d: '二元配置・一貫性・単一の評定者', ...cons(false), model: 'twoway', type: 'consistency', unit: 'single' },
    { key: '1k', sf: `ICC(1,${nr})`, mw: `ICC(${nr})`, d: '一元配置・評定者の平均', ...one(true), model: 'oneway', type: 'agreement', unit: 'average' },
    { key: '2k', sf: `ICC(2,${nr})`, mw: `ICC(A,${nr})`, d: '二元配置・絶対一致・評定者の平均', ...agr(true), model: 'twoway', type: 'agreement', unit: 'average' },
    { key: '3k', sf: `ICC(3,${nr})`, mw: `ICC(C,${nr})`, d: '二元配置・一貫性・評定者の平均', ...cons(true), model: 'twoway', type: 'consistency', unit: 'average' }] };
}
function iccChosenKey() { const m = state.opt.iccModel, t = state.opt.iccType, u = state.opt.iccUnit === 'average' ? 'k' : ''; return (m === 'oneway' ? '1' : t === 'agreement' ? '2' : '3') + u; }
const ICC_MODEL_L = { oneway: '一元配置（対象ごとに別の評定者）', 'twoway-random': '二元配置・変量（評定者は母集団からの標本）', 'twoway-mixed': '二元配置・混合（この評定者たちだけに関心）' };

// ---- 図 ----
function kappaHeat(T, lev, labs, n1, n2) {
  const L = lev.length, cw = Math.max(46, Math.min(80, 360 / L)), M = { l: 110, t: 64 }, W = M.l + cw * L + 20, H = M.t + cw * L + 34, mx = Math.max(...T.flat(), 1);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:${W}px">`;
  s += `<text x="${M.l + cw * L / 2}" y="16" text-anchor="middle" style="fill:var(--fg);font-size:11.5px;font-weight:600">${esc(n2)}</text><text x="14" y="${M.t + cw * L / 2}" text-anchor="middle" transform="rotate(-90 14 ${M.t + cw * L / 2})" style="fill:var(--fg);font-size:11.5px;font-weight:600">${esc(n1)}</text>`;
  lev.forEach((_, j) => s += `<text x="${M.l + cw * (j + .5)}" y="${M.t - 8}" text-anchor="middle" style="font-size:10.5px">${esc(labs[j])}</text>`);
  T.forEach((r, i) => { s += `<text x="${M.l - 8}" y="${M.t + cw * (i + .5) + 4}" text-anchor="end" style="font-size:10.5px">${esc(labs[i])}</text>`; r.forEach((v, j) => { const op = .08 + .8 * v / mx, diag = i === j; s += `<rect x="${M.l + cw * j}" y="${M.t + cw * i}" width="${cw - 2}" height="${cw - 2}" rx="3" fill="${diag ? 'var(--accent)' : 'var(--sig)'}" fill-opacity="${op}" ${diag ? 'stroke="var(--accent)" stroke-width="1.5"' : ''}/><text x="${M.l + cw * (j + .5)}" y="${M.t + cw * (i + .5) + 4}" text-anchor="middle" style="fill:${op > .55 ? '#fff' : 'var(--fg)'};font-size:12px;font-weight:600">${v}</text>`; }); });
  s += `<text x="${M.l}" y="${H - 8}" style="font-size:10.5px">青＝一致した件数、赤＝食い違った件数</text>`;
  return s + '</svg>';
}
function blandAltman(a, b, na, nb) {
  const m = a.map((v, i) => (v + b[i]) / 2), d = a.map((v, i) => v - b[i]), md = S.mean(d), sd = S.sd(d), lo = md - 1.96 * sd, hi = md + 1.96 * sd;
  const W = 520, H = 290, M = { l: 52, r: 120, t: 34, b: 42 }, xt = niceTicks(Math.min(...m), Math.max(...m)), yt = niceTicks(Math.min(...d, lo), Math.max(...d, hi));
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, `差（${na} − ${nb}）`, fy); xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(4)}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">2 人の評定の平均</text>`;
  const Rn = rng(3); m.forEach((v, i) => s += `<circle cx="${fx(v) + (Rn() - .5) * 4}" cy="${fy(d[i]) + (Rn() - .5) * 4}" r="3.2" fill="var(--accent)" fill-opacity=".55"/>`);
  [[0, 'var(--line)', '0', ''], [md, 'var(--accent)', `平均の差 ${fmt(md, 2)}`, ''], [hi, 'var(--sig)', `+1.96 SD ${fmt(hi, 2)}`, '5 4'], [lo, 'var(--sig)', `−1.96 SD ${fmt(lo, 2)}`, '5 4']].forEach(([v, c, t, da], q) => { s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="${c}" stroke-width="${q ? 1.6 : 1}" ${da ? `stroke-dasharray="${da}"` : ''}/>`; if (t && q) s += `<text x="${W - M.r + 6}" y="${fy(v) + 4}" style="fill:${c};font-size:10.5px">${t}</text>`; });
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">Bland-Altman プロット：点が 0 の線の上下に偏らず、赤い線（一致の限界）の間に収まっていれば、2 人の評定はよく一致しています。</text>`;
  return { svg: s + '</svg>', md, sd, lo, hi };
}
function raterProfile(X, names) { // 対象（評定の平均順）× 評定者
  const n = X.length, ord = X.map((r, i) => [S.mean(r), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]), all = X.flat(), yt = niceTicks(Math.min(...all), Math.max(...all));
  const W = 560, H = 270, M = { l: 44, r: 110, t: 30, b: 34 }, fx = q => M.l + (q + .5) * (W - M.l - M.r) / n, fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, '評定', fy);
  const ly = lmSpread(names.map((_, j) => fy(S.mean(X.map(r => r[j])))), 13);
  names.forEach((nm, j) => { const c = GC[j % 6]; s += `<polyline points="${ord.map((i, q) => `${fx(q)},${fy(X[i][j])}`).join(' ')}" fill="none" stroke="${c}" stroke-width="1.6" stroke-opacity=".85"/><text x="${W - M.r + 8}" y="${ly[j] + 4}" style="fill:${c};font-size:11px;font-weight:600">${esc(nm)}（平均 ${fmt(S.mean(X.map(r => r[j])), 2)}）</text>`; });
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle" style="font-size:10.5px">評定された対象（平均が低い順に並べたもの）</text><text x="${M.l}" y="16" style="font-size:10.5px">線が重なるほど一致しています。ある評定者の線がいつも上（下）にあれば、その人は甘め（辛め）に評定する傾向があります。</text>`;
  return s + '</svg>';
}
function agreeGuide(open) {
  return `<details class="mcguide" ${open ? 'open' : ''}><summary>κ 係数と ICC の選び方（クリックで開く）</summary><div style="padding:6px 2px">
    ${table(['評定の種類', '評定者', '使う指標'], [['カテゴリ（分類・コーディング）', '2 人', 'Cohen の κ'], ['順序のあるカテゴリ（例：重症度 軽・中・重）', '2 人', '重みつき κ（ずれが小さい食い違いを部分的に一致とみなす）'], ['カテゴリ', '3 人以上', 'Fleiss の κ'], ['数値（得点・評価点）', '2 人以上', 'ICC（級内相関係数）']])}
    <h4>ICC の 3 つの選択</h4>${table(['選ぶこと', '選択肢と使う場面'], [
      ['モデル', '<b>一元配置</b>：対象ごとに別の評定者が評定した（例：作文ごとにたまたま手の空いた先生が採点）<br><b>二元配置・変量</b>：同じ評定者が全員を評定し、評定者を「多くの評定者の代表」と考える（結果を一般化したい。ふつうはこれ）<br><b>二元配置・混合</b>：同じ評定者が全員を評定し、この評定者たちだけに関心がある'],
      ['タイプ', '<b>絶対一致</b>：評定の値そのものが一致しているか（甘い・辛いの違いも不一致とみなす）<br><b>一貫性</b>：順位や高低のパターンが一致しているか（全体に 1 点ずれていても一致とみなす）'],
      ['単位', '<b>単一</b>：今後 1 人の評定者の評定を使う<br><b>平均</b>：今後も複数の評定者の平均を使う（平均のほうが信頼性は高くなる）']])}
    <p class="note">評定者の甘い・辛いの違いが問題になる場面（臨床の評定、採点など）では「絶対一致」を選びます。目安（Koo &amp; Li, 2016）：ICC が .50 未満 低い、.50〜.75 中程度、.75〜.90 良好、.90 以上 非常に良好。κ の目安（Landis &amp; Koch, 1977）：.21〜.40 まずまず、.41〜.60 中程度、.61〜.80 かなり、.81 以上 ほぼ完全。</p></div></details>`;
}

// ---- 解析 ----
ANALYSES.db.kappa = function () {
  const D = agData(false), lev = agLevels(D.C, D.js), labs = lev.map(v => { const j = D.js.find(j => (state.db.cols[j].values || []).length); return j != null ? codeToLabel(state.db.cols[j], v) : v; });
  need(lev.length >= 2, '評定がすべて同じ値なので、κ を計算できません。'); need(lev.length <= 20, `カテゴリの数が ${lev.length} と多すぎます。数値の評定なら ICC を使ってください。`);
  const kw = state.opt.kappaW, wName = { none: '重みなし', linear: '線形の重み', quadratic: '2 次の重み' };
  let h = guideBox('κ 係数とは', [['何がわかる？', '2 人（以上）の評定者が、同じ対象を同じカテゴリに分類した程度を、<b>偶然の一致を差し引いて</b>表します。単純な一致率は、カテゴリの偏りがあると偶然でも高くなるため、κ を使います。'], ['読み方', '1 で完全な一致、0 で偶然と同じ程度、負の値は偶然以下です。'], ['データ', '1 行 ＝ 評定される対象（発言・作文・患者など）、1 列 ＝ 評定者。']]);
  h += `<p class="note">評定者：${D.names.map(esc).join('・')}、対象 n = ${D.n}${D.nMiss ? `（評定がそろっていない ${D.nMiss} 件を除外）` : ''}、カテゴリ：${labs.map(esc).join('・')}。</p>`;
  let rText = '', apaT = '';
  if (D.k === 2) {
    const K = cohenKappa(D.C[0], D.C[1], lev), rowsK = [['重みなし（Cohen の κ）', K.un], ['線形の重み', K.lin], ['2 次の重み', K.quad]];
    h += '<h4>Cohen の κ 係数</h4>' + table(['', 'κ', '95% 信頼区間', 'z', 'p 値', '一致率'], rowsK.map(([l, r], q) => [(q === 0 || (q === 1 && kw === 'linear') || (q === 2 && kw === 'quadratic')) ? `<b>${l}</b>` : l, fmt(r.k, 3), `[${fmt(r.lo, 3)}, ${fmt(r.hi, 3)}]`, fmt(r.z, 2), pcell(r.p), q === 0 ? `${fmt(r.po * 100, 1)}%` : `${fmt(r.po * 100, 1)}%<small>（重みつき）</small>`]))
      + `<p class="note">偶然に期待される一致率は ${fmt(K.un.pc * 100, 1)}% です。z 検定は「κ = 0（偶然の一致）」の検定です（irr::kappa2 と同じ）。信頼区間は漸近分散によるもので、psych::cohen.kappa と同じです。重みつき κ は、順序のあるカテゴリで「少しのずれ」を部分的な一致とみなす指標です（2 次の重みは ICC に近い値になります）。</p>`;
    h += '<h4>2 人の評定のクロス表</h4>' + kappaHeat(K.T, lev, labs, D.names[0], D.names[1]);
    const agreeBy = lev.map((_, i) => { const r = S.sum(K.T[i]), c = S.sum(K.T.map(x => x[i])); return 2 * K.T[i][i] / (r + c); });
    h += table(['カテゴリ', ...labs.map(esc)], [['カテゴリごとの一致（2 × 一致数 ÷ 両者の件数）', ...agreeBy.map(v => isFinite(v) ? fmt(v, 3) : '—')], [`${esc(D.names[0])} の件数`, ...K.T.map(r => S.sum(r))], [`${esc(D.names[1])} の件数`, ...lev.map((_, j) => S.sum(K.T.map(r => r[j])))]]);
    const main = kw === 'none' ? K.un : kw === 'linear' ? K.lin : K.quad;
    rText = `Cohen の κ は ${fmt(K.un.k, 2)}（95% CI [${fmt(K.un.lo, 2)}, ${fmt(K.un.hi, 2)}]）で、${agLand(K.un.k)}といえます（Landis & Koch, 1977 の目安）。単純な一致率は ${fmt(K.un.po * 100, 1)}% ですが、そのうち偶然でも ${fmt(K.un.pc * 100, 1)}% は一致すると見込まれます。` + (kw !== 'none' ? `${wName[kw]}による重みつき κ は ${fmt(main.k, 2)} です。カテゴリに順序があるときは、重みつき κ も報告します。` : '');
    apaT = `2 名の評定者（${D.names.join('・')}）による ${D.n} 件の評定について、評定者間一致を Cohen の κ 係数で検討した。κ = ${fmt(K.un.k, 2)}, 95% CI [${fmt(K.un.lo, 2)}, ${fmt(K.un.hi, 2)}] であり、${agLand(K.un.k).replace(/（.*）/, '')}が得られた${kw !== 'none' ? `（${wName[kw]}による重みつき κ = ${fmt(main.k, 2)}）` : ''}。`;
  } else {
    const F = fleissKappa(D.C, lev), pairs = [];
    for (let a = 0; a < D.k; a++) for (let b = a + 1; b < D.k; b++) pairs.push({ a, b, k: cohenKappa(D.C[a], D.C[b], lev).un.k });
    const light = S.mean(pairs.map(p => p.k));
    h += '<h4>Fleiss の κ 係数（3 人以上）</h4>' + table(['', 'κ', 'z', 'p 値'], [['<b>Fleiss の κ</b>', fmt(F.k, 3), fmt(F.z, 2), pcell(F.p)], ['Light の κ（2 人ずつの Cohen の κ の平均）', fmt(light, 3), '', '']]) + `<p class="note">観測された一致率 ${fmt(F.Pa * 100, 1)}%、偶然に期待される一致率 ${fmt(F.Pe * 100, 1)}%。値と z 検定は irr::kappam.fleiss と同じです。</p>`;
    h += '<h4>カテゴリごとの κ</h4>' + table(['カテゴリ', '全体に占める割合', 'κ', 'z', 'p 値'], lev.map((_, j) => [esc(labs[j]), `${fmt(F.pj[j] * 100, 1)}%`, fmt(F.cat[j].k, 3), fmt(F.cat[j].z, 2), pcell(F.cat[j].p)])) + '<p class="note">一致しにくいカテゴリがあれば、その定義（コーディングの基準）を見直す手がかりになります。</p>';
    h += '<h4>評定者 2 人ずつの Cohen の κ</h4>' + table(['', ...D.names.map(esc)], D.names.map((nm, a) => [esc(nm), ...D.names.map((_, b) => a === b ? '—' : fmt(pairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a)).k, 3))])) + '<p class="note">ほかの人との κ がいつも低い評定者がいれば、その人の基準がずれている可能性があります。</p>';
    rText = `Fleiss の κ は ${fmt(F.k, 2)} で、${agLand(F.k)}といえます（Landis & Koch, 1977 の目安）。カテゴリごとに見ると、${lev.map((_, j) => `${labs[j]} ${fmt(F.cat[j].k, 2)}`).join('、')} です。`;
    apaT = `${D.k} 名の評定者（${D.names.join('・')}）による ${D.n} 件の評定について、評定者間一致を Fleiss の κ 係数で検討した。κ = ${fmt(F.k, 2)}（z = ${fmt(F.z, 2)}, ${apaP(F.p)}）であり、${agLand(F.k).replace(/（.*）/, '')}が得られた。`;
  }
  h += agreeGuide(false);
  h += interp(rText, '一致が低いときは、カテゴリの定義をより具体的にする、評定者の訓練（練習用のデータで基準を合わせる）を行う、などで改善できます。', '論文では、κ の値と信頼区間、評定者の人数と評定した件数、（一部だけを 2 人で評定したときは）その割合を報告します。');
  h += apa('論文記載例', apaT);
  return { title: `評定者間一致（${D.k === 2 ? 'Cohen' : 'Fleiss'} の κ・${D.names.join('・')}）`, html: h };
};
ANALYSES.db.icc = function () {
  const D = agData(true), X = D.C[0].map((_, i) => D.C.map(c => toNum(c[i]))), A = iccAll(X), ck = iccChosenKey(), ch = A.rows.find(r => r.key === ck);
  need(A.MSr > 0, '対象の間に評定のばらつきがないため、ICC を計算できません。');
  let h = guideBox('ICC（級内相関係数）とは', [['何がわかる？', '数値の評定（得点・評価点など）が、評定者のあいだでどれだけ一致しているかを表します。評定の違いのうち、<b>対象（人・作文など）の本当の違いによる部分の割合</b>と考えることができます。'], ['読み方', '1 に近いほど一致しています。.75 以上で良好、.90 以上で非常に良好（Koo & Li, 2016）。'], ['6 種類の ICC', 'モデル（一元・二元）、タイプ（絶対一致・一貫性）、単位（単一・平均）の組み合わせで値が変わります。下の「ICC の選び方」を見て、研究の目的に合うものを選びます。']]);
  h += `<p class="note">評定者：${D.names.map(esc).join('・')}、対象 n = ${D.n}${D.nMiss ? `（評定がそろっていない ${D.nMiss} 件を除外）` : ''}。選んだ ICC：${ICC_MODEL_L[state.opt.iccModel]}・${state.opt.iccModel === 'oneway' ? '' : (state.opt.iccType === 'agreement' ? '絶対一致・' : '一貫性・')}${state.opt.iccUnit === 'average' ? '評定者の平均' : '単一の評定者'} → <b>${ch.sf}</b>（McGraw & Wong の表記では ${ch.mw}）。</p>`;
  if (state.opt.iccModel === 'oneway' && state.opt.iccType === 'consistency') h += '<p class="warn">一元配置では「一貫性」は定義されないので、絶対一致として計算しています。</p>';
  h += '<h4>ICC（6 種類）</h4>' + table(['Shrout & Fleiss', 'McGraw & Wong', '種類', 'ICC', '95% 信頼区間', 'F', '自由度', 'p 値'], A.rows.map(r => { const b = r.key === ck, w = x => b ? `<b>${x}</b>` : x; return [w(r.sf), w(r.mw), w(r.d), w(fmt(r.c, 3)), w(`[${fmt(r.lo, 3)}, ${fmt(r.hi, 3)}]`), fmt(r.F, 2), `${r.d1}, ${+r.d2.toFixed(2)}`, pcell(r.p)]; }))
    + `<p class="note">太字が選んだ ICC です。値・信頼区間・F 検定は R の irr::icc と同じ計算です（psych::ICC の ICC1・ICC2・ICC3・ICC1k・ICC2k・ICC3k に対応）。二元配置の「変量」と「混合」は計算式が同じで、解釈（評定者を一般化するかどうか）が違います。F 検定は「ICC = 0」の検定です。</p>`;
  const cm = D.names.map((_, j) => S.mean(X.map(r => r[j]))), cs = D.names.map((_, j) => S.sd(X.map(r => r[j])));
  h += '<h4>評定者ごとの平均</h4>' + table(['評定者', '平均', 'SD'], D.names.map((nm, j) => [esc(nm), fmt(cm[j], 2), fmt(cs[j], 2)])) + `<p class="note">評定者のあいだの平均の違い（甘い・辛い）は、MS（評定者）＝ ${fmt(A.MSc, 3)} に表れます。「絶対一致」の ICC はこの違いを不一致として数えるため、「一貫性」の ICC より低くなります。</p>`;
  h += '<h4>図：対象 × 評定者</h4>' + raterProfile(X, D.names);
  let ba = null; if (D.k === 2) { ba = blandAltman(X.map(r => r[0]), X.map(r => r[1]), D.names[0], D.names[1]); h += '<h4>図：Bland-Altman プロット</h4>' + ba.svg + `<p class="note">平均の差 ${fmt(ba.md, 2)}（SD ${fmt(ba.sd, 2)}）、一致の限界（95%）は ${fmt(ba.lo, 2)} 〜 ${fmt(ba.hi, 2)} です。2 人の評定が、ふつうこの範囲内でずれるという意味です。</p>`; }
  h += agreeGuide(false);
  const r3 = A.rows.find(r => r.key === '3' + (ck.endsWith('k') ? 'k' : '')), r2 = A.rows.find(r => r.key === '2' + (ck.endsWith('k') ? 'k' : ''));
  h += interp(`${ch.sf} ＝ ${fmt(ch.c, 2)}（95% CI [${fmt(ch.lo, 2)}, ${fmt(ch.hi, 2)}]）で、信頼性は${agKoo(ch.c)}です（Koo & Li, 2016 の目安）。信頼区間の下限でも判断するのが慎重な読み方です。`,
    Math.abs(r2.c - r3.c) > .03 ? `絶対一致（${r2.sf} = ${fmt(r2.c, 2)}）が一貫性（${r3.sf} = ${fmt(r3.c, 2)}）より低いのは、評定者によって全体的に甘い・辛いの違いがあるためです（評定者ごとの平均を参照）。` : `絶対一致（${r2.sf} = ${fmt(r2.c, 2)}）と一貫性（${r3.sf} = ${fmt(r3.c, 2)}）がほぼ同じなので、評定者のあいだに系統的な甘い・辛いの違いはほとんどありません。`,
    '論文では、どの ICC を使ったか（モデル・タイプ・単位）を必ず書きます。「ICC = .85」だけでは、どの式で計算したかがわかりません。');
  h += apa('論文記載例', `${D.k} 名の評定者（${D.names.join('・')}）による ${D.n} 件の評定について、評定者間信頼性を級内相関係数（${state.opt.iccModel === 'oneway' ? '一元配置' : `二元配置${state.opt.iccModel === 'twoway-random' ? '変量' : '混合'}効果モデル`}、${state.opt.iccModel === 'oneway' ? '' : (state.opt.iccType === 'agreement' ? '絶対一致、' : '一貫性、')}${state.opt.iccUnit === 'average' ? '評定者の平均' : '単一の評定者'}）で検討した。${ch.sf} = ${fmt(ch.c, 2)}, 95% CI [${fmt(ch.lo, 2)}, ${fmt(ch.hi, 2)}] であり、信頼性は${agKoo(ch.c).replace(/（.*）/, '')}であった。`);
  return { title: `評定者間一致（ICC・${D.names.join('・')}）`, html: h };
};
