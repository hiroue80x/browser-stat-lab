// ---- クラスター分析（階層的・k-means） ----
state.opt.clMethod = state.opt.clMethod || 'ward'; state.opt.clK = state.opt.clK || 'auto'; if (state.opt.clZ === undefined) state.opt.clZ = true;
const CL_METHODS = { 'ward.D2': 'Ward 法', average: '群平均法', complete: '最遠隣法（完全連結法）', single: '最近隣法（単連結法）' };
let CL_LAST = null;

function makeClusterSample() { // 例として入っている架空データ（大学生の学習動機づけのタイプ、n = 160）
  const R = rng(9091), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // 内発的動機づけ・外的調整・テスト不安・自己効力感（1〜7 の尺度得点）のタイプ
  const prof = [[5.6, 3.2, 2.8, 5.4, 45], [4.0, 5.4, 5.3, 3.4, 42], [2.7, 5.2, 3.0, 4.1, 38], [2.6, 2.6, 3.4, 2.5, 35]], gpa = [3.2, 2.7, 2.6, 2.3], rows = [];
  prof.forEach((p, g) => { for (let i = 0; i < p[4]; i++) {
    const v = p.slice(0, 4).map(m => Math.min(7, Math.max(1, m + .75 * nrm()))), sex = R() < .5 ? '1' : '2', gp = Math.min(4, Math.max(0, gpa[g] + .25 * v[3] / 5 + .4 * nrm()));
    rows.push([sex, ...v.map(x => x.toFixed(2)), gp.toFixed(2)]); } });
  for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
  const labs = ['勉強そのものが面白いから学ぶ', 'ほめられたり叱られたりするから学ぶ', '試験の前は不安で落ち着かない', '努力すれば良い成績がとれると思う'];
  return { cols: [{ name: '性別', on: true, measure: 'nominal', values: [['1', '男性'], ['2', '女性']] }, ...['内発的動機づけ', '外的調整', 'テスト不安', '自己効力感'].map((n, j) => ({ name: n, on: true, label: labs[j] })), { name: 'GPA', on: true, label: '前期の GPA' }],
    rows, roles: { y: 5, a: -1, b: -1, x: [], rep: [], fa: [], cl: [1, 2, 3, 4] } };
}

function clData() {
  const R = state.db.roles, js = [...(R.cl || [])].filter(j => colType(j) === 'num').sort((a, b) => a - b);
  need(js.length >= 2, 'クラスター分析に使う変数を 2 つ以上、右のリストに入れてください。');
  const C = js.map(j => dbCol(j).map(toNum)), ok = C[0].map((_, i) => C.every(c => isFinite(c[i]))), rowIdx = ok.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const raw = rowIdx.map(i => C.map(c => c[i])), n = raw.length, p = js.length;
  need(n >= 6, `計算できる回答者（欠損のない人）が ${n} 人しかいません。`);
  const mu = js.map((_, q) => S.mean(raw.map(r => r[q]))), sd = js.map((_, q) => S.sd(raw.map(r => r[q])));
  const zero = js.filter((_, q) => !(sd[q] > 0)); need(!zero.length, `全員が同じ値の変数があります: ${zero.map(j => vn(j)).join('、')}`);
  const Z = raw.map(r => r.map((v, q) => (v - mu[q]) / sd[q])), X = state.opt.clZ ? Z : raw;
  return { js, names: js.map(j => state.db.cols[j].name || vn(j)), raw, Z, X, n, p, rowIdx, nMiss: ok.length - n };
}
const clD2 = (a, b) => { let s = 0; for (let q = 0; q < a.length; q++) { const d = a[q] - b[q]; s += d * d; } return s; };

// 階層的クラスター分析（Lance–Williams の更新式。R の hclust と同じ定義：Ward 法は ward.D2）
function hclustFit(X, method) {
  const n = X.length, D = new Float64Array(n * n), sq = method === 'ward.D2';
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { const v = sq ? clD2(X[i], X[j]) : Math.sqrt(clD2(X[i], X[j])); D[i * n + j] = D[j * n + i] = v; }
  const size = new Array(n).fill(1), act = new Uint8Array(n).fill(1), node = Array.from({ length: n }, (_, i) => i), merges = [];
  for (let s = 0; s < n - 1; s++) {
    let bi = -1, bj = -1, bv = Infinity;
    for (let i = 0; i < n; i++) if (act[i]) for (let j = i + 1; j < n; j++) if (act[j] && D[i * n + j] < bv) { bv = D[i * n + j]; bi = i; bj = j; }
    const ni = size[bi], nj = size[bj];
    merges.push({ a: node[bi], b: node[bj], h: sq ? Math.sqrt(Math.max(bv, 0)) : bv, size: ni + nj });
    for (let k = 0; k < n; k++) if (act[k] && k !== bi && k !== bj) {
      const dik = D[bi * n + k], djk = D[bj * n + k], nk = size[k]; let v;
      if (method === 'single') v = Math.min(dik, djk); else if (method === 'complete') v = Math.max(dik, djk);
      else if (method === 'average') v = (ni * dik + nj * djk) / (ni + nj);
      else v = ((ni + nk) * dik + (nj + nk) * djk - nk * bv) / (ni + nj + nk);
      D[bi * n + k] = D[k * n + bi] = v;
    }
    act[bj] = 0; size[bi] = ni + nj; node[bi] = n + s;
  }
  return { n, merges, method };
}
function cutTree(hc, k) { // R の cutree と同じ番号づけ（1 人目が属するクラスターが 1）
  const n = hc.n, par = Array.from({ length: 2 * n - 1 }, (_, i) => i), f = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  hc.merges.slice(0, n - k).forEach((m, s) => { par[f(m.a)] = n + s; par[f(m.b)] = n + s; });
  const lab = new Map(); return Array.from({ length: n }, (_, i) => { const r = f(i); if (!lab.has(r)) lab.set(r, lab.size); return lab.get(r); });
}
function leafOrder(hc) { const n = hc.n, out = [], st = [n + n - 2]; while (st.length) { const v = st.pop(); if (v < n) out.push(v); else { const m = hc.merges[v - n]; st.push(m.b, m.a); } } return out; }
function clCenters(X, as, k) { const p = X[0].length, c = Array.from({ length: k }, () => new Array(p).fill(0)), m = new Array(k).fill(0); X.forEach((x, i) => { m[as[i]]++; x.forEach((v, q) => c[as[i]][q] += v); }); return c.map((r, g) => r.map(v => v / m[g])); }
// k-means：Lloyd 法で収束させたあと、Hartigan の 1 点移動で仕上げる（R の kmeans の Hartigan–Wong と同じ基準）
function kmeansFit(X, init) {
  const n = X.length, k = init.length, p = X[0].length; let c = init.map(r => r.slice()), as = X.map(x => { let b = 0, bv = Infinity; c.forEach((ci, g) => { const d = clD2(x, ci); if (d < bv) { bv = d; b = g; } }); return b; }), iter = 0;
  for (let outer = 0; outer < 200; outer++) {
    let changed = true;
    while (changed && iter < 500) { iter++; changed = false; c = clCenters(X, as, k).map((r, g) => r.some(v => !isFinite(v)) ? c[g] : r);
      X.forEach((x, i) => { let b = as[i], bv = clD2(x, c[b]); c.forEach((ci, g) => { const d = clD2(x, ci); if (d < bv - 1e-12) { bv = d; b = g; } }); if (b !== as[i]) { as[i] = b; changed = true; } }); }
    const m = new Array(k).fill(0); as.forEach(g => m[g]++); c = clCenters(X, as, k); let moved = false;
    for (let i = 0; i < n; i++) { const a = as[i]; if (m[a] <= 1) continue; const rem = m[a] / (m[a] - 1) * clD2(X[i], c[a]); let best = -1, bv = rem;
      for (let g = 0; g < k; g++) if (g !== a) { const add = m[g] / (m[g] + 1) * clD2(X[i], c[g]); if (add < bv - 1e-12) { bv = add; best = g; } }
      if (best >= 0) { for (let q = 0; q < p; q++) { c[a][q] = (c[a][q] * m[a] - X[i][q]) / (m[a] - 1); c[best][q] = (c[best][q] * m[best] + X[i][q]) / (m[best] + 1); } m[a]--; m[best]++; as[i] = best; moved = true; } }
    if (!moved) break;
  }
  c = clCenters(X, as, k); const wss = c.map((ci, g) => S.sum(X.map((x, i) => as[i] === g ? clD2(x, ci) : 0)));
  return { as, centers: c, wss, iter };
}
function clStats(X, as, k, Dd) { // 群内・群間平方和、Calinski–Harabasz、シルエット
  const n = X.length, gm = X[0].map((_, q) => S.mean(X.map(x => x[q]))), c = clCenters(X, as, k);
  const W = S.sum(X.map((x, i) => clD2(x, c[as[i]]))), T = S.sum(X.map(x => clD2(x, gm))), B = T - W, ch = k > 1 && k < n ? (B / (k - 1)) / (W / (n - k)) : NaN;
  const Dm = Dd ? X.map((_, i) => Array.from(Dd.subarray(i * n, i * n + n))) : X.map(a => X.map(b => Math.sqrt(clD2(a, b)))), m = new Array(k).fill(0); as.forEach(g => m[g]++);
  const sil = X.map((_, i) => { if (m[as[i]] <= 1) return 0; const s = new Array(k).fill(0); Dm[i].forEach((d, j) => { if (j !== i) s[as[j]] += d; }); const a = s[as[i]] / (m[as[i]] - 1); let b = Infinity; for (let g = 0; g < k; g++) if (g !== as[i] && m[g]) b = Math.min(b, s[g] / m[g]); return (b - a) / Math.max(a, b); });
  return { W, T, B, ch, sil, silAvg: S.mean(sil), silBy: Array.from({ length: k }, (_, g) => S.mean(sil.filter((_, i) => as[i] === g))), size: m, centers: c };
}

// ---- 階層的クラスター分析：結合方法 7 つ・距離 7 つ ----
const CL_HM = { // 結合方法：[名前, 短い名前（列名用）]
  ward: ['Ward 法', 'ward'], average: ['グループ間平均連結法', 'bavg'], waverage: ['グループ内平均連結法', 'wavg'], single: ['最近隣法', 'near'],
  complete: ['最遠隣法', 'far'], centroid: ['重心法', 'cent'], median: ['メディアン法', 'med'] };
const CL_DIST = { sqeuclid: '平方ユークリッド距離', euclid: 'ユークリッド距離', cityblock: '都市ブロック距離', chebychev: 'Chebychev 距離', minkowski: 'Minkowski 距離', cosine: 'コサイン（1 − コサイン類似度）', correlation: 'Pearson の相関（1 − r）' };
if (!CL_HM[state.opt.clMethod]) state.opt.clMethod = 'ward'; state.opt.clDist = state.opt.clDist || 'sqeuclid'; state.opt.clP = state.opt.clP || '3';
function clDistMat(X, kind, p) { // n × n の非類似度行列
  const n = X.length, P = X[0].length, D = new Float64Array(n * n), nrm = X.map(r => Math.sqrt(S.sum(r.map(v => v * v)))), cen = X.map(r => { const m = S.mean(r); return r.map(v => v - m); }), cn = cen.map(r => Math.sqrt(S.sum(r.map(v => v * v))));
  if (kind === 'cosine') need(nrm.every(v => v > 0), 'すべての変数が 0 の人がいるため、コサインを計算できません。');
  if (kind === 'correlation') { need(P >= 3, 'Pearson の相関を距離に使うには、変数が 3 つ以上必要です（人ごとに変数間の相関を求めるため）。'); const bad = cn.filter(v => !(v > 1e-12)).length; need(!bad, `すべての変数で同じ値の人が ${bad} 人いるため、相関を計算できません（その人を除くか、ほかの距離を使ってください）。`); }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) {
    const a = X[i], b = X[j]; let v = 0;
    if (kind === 'sqeuclid' || kind === 'euclid') { v = clD2(a, b); if (kind === 'euclid') v = Math.sqrt(v); }
    else if (kind === 'cityblock') { for (let q = 0; q < P; q++) v += Math.abs(a[q] - b[q]); }
    else if (kind === 'chebychev') { for (let q = 0; q < P; q++) v = Math.max(v, Math.abs(a[q] - b[q])); }
    else if (kind === 'minkowski') { for (let q = 0; q < P; q++) v += Math.abs(a[q] - b[q]) ** p; v = v ** (1 / p); }
    else if (kind === 'cosine') { let s = 0; for (let q = 0; q < P; q++) s += a[q] * b[q]; v = 1 - s / (nrm[i] * nrm[j]); }
    else { let s = 0; for (let q = 0; q < P; q++) s += cen[i][q] * cen[j][q]; v = 1 - s / (cn[i] * cn[j]); }
    D[i * n + j] = D[j * n + i] = v;
  }
  return D;
}
// Lance–Williams の更新式（R の hclust と同じ）と、グループ内平均連結法（SPSS の方法）
function hclustD(D0, n, method, sqrtH) {
  const D = Float64Array.from(D0), size = new Array(n).fill(1), act = new Uint8Array(n).fill(1), node = Array.from({ length: n }, (_, i) => i), merges = [];
  const within = method === 'waverage', Sw = new Float64Array(n); // Sw：群の中のすべての組の距離の合計。within のとき D は「群どうしの距離の合計」
  for (let s = 0; s < n - 1; s++) {
    let bi = -1, bj = -1, bv = Infinity;
    for (let i = 0; i < n; i++) if (act[i]) for (let j = i + 1; j < n; j++) if (act[j]) {
      const v = within ? (Sw[i] + Sw[j] + D[i * n + j]) / ((size[i] + size[j]) * (size[i] + size[j] - 1) / 2) : D[i * n + j];
      if (v < bv) { bv = v; bi = i; bj = j; } }
    const ni = size[bi], nj = size[bj], dij = D[bi * n + bj];
    merges.push({ a: node[bi], b: node[bj], h: sqrtH ? Math.sqrt(Math.max(bv, 0)) : bv, size: ni + nj });
    for (let k = 0; k < n; k++) if (act[k] && k !== bi && k !== bj) {
      const dik = D[bi * n + k], djk = D[bj * n + k], nk = size[k]; let v;
      if (within) v = dik + djk;
      else if (method === 'single') v = Math.min(dik, djk); else if (method === 'complete') v = Math.max(dik, djk);
      else if (method === 'average') v = (ni * dik + nj * djk) / (ni + nj);
      else if (method === 'centroid') v = (ni * dik + nj * djk) / (ni + nj) - ni * nj * dij / (ni + nj) ** 2;
      else if (method === 'median') v = (dik + djk) / 2 - dij / 4;
      else v = ((ni + nk) * dik + (nj + nk) * djk - nk * dij) / (ni + nj + nk); // Ward
      D[bi * n + k] = D[k * n + bi] = v;
    }
    if (within) Sw[bi] = Sw[bi] + Sw[bj] + dij;
    act[bj] = 0; size[bi] = ni + nj; node[bi] = n + s;
  }
  return { n, merges, method };
}
function wardGuide() {
  return `<h4>Ward 法の 2 つの計算方式（ward.D と ward.D2）</h4>${table(['', 'ward.D', 'ward.D2'], [
    ['計算のしかた', '与えた距離に Ward の更新式をそのまま当てはめる', '与えた距離を 2 乗してから Ward の更新式を当てはめ、結合距離は平方根に戻す'],
    ['正しい Ward 法になる距離', '<b>平方ユークリッド距離</b>', '<b>ユークリッド距離</b>'],
    ['結合距離（高さ）の意味', '群内平方和の増え方の 2 倍', '上の値の平方根（元の距離と同じ単位）'],
    ['由来', 'R 3.0 までの "ward"。ユークリッド距離を渡すと Ward (1963) の基準（群内平方和の増加が最小）にならないことが指摘された（Murtagh &amp; Legendre, 2014）', 'その指摘を受けて R 3.1 で追加された、Ward (1963) の基準どおりの方式'],
    ['SPSS との関係', 'SPSS の Ward 法（平方ユークリッド距離）と同じ樹形図・同じ所属', '上と同じ樹形図・同じ所属（目盛りだけが違う）']])}
    <p class="note"><b>ポイント</b>：「ward.D ＋ 平方ユークリッド距離」と「ward.D2 ＋ ユークリッド距離」は、<b>まったく同じ分類</b>になり、違うのは樹形図の縦の目盛りだけです。組み合わせを間違えると（ward.D ＋ ユークリッド距離など）、Ward 法とは別の方法になります。論文には「Ward 法（平方ユークリッド距離）」と書けば十分ですが、R を使った場合は ward.D と ward.D2 のどちらかも書いておくと、再現しやすくなります。「自動」を選ぶと、距離に合わせて正しい方式を選びます。</p>`;
}
function clWardType(dk) { const w = state.opt.clWard; return w === 'D' || w === 'D2' ? w : (dk === 'sqeuclid' ? 'D' : 'D2'); }
function clHier(X) { // 選んだ方法・距離で樹形図を作る。R での対応も返す
  const m = state.opt.clMethod, dk = state.opt.clDist, p = Math.max(1, +state.opt.clP || 3), n = X.length, Dd = clDistMat(X, dk, p);
  let hc, rMethod = m, note = '';
  if (m === 'ward' && clWardType(dk) === 'D2') { const D2 = Dd.map(v => v * v); hc = hclustD(D2, n, 'ward', true); rMethod = 'ward.D2'; } // 距離を 2 乗して Ward（R の ward.D2）
  else { hc = hclustD(Dd, n, m, false); if (m === 'ward') rMethod = 'ward.D'; } // ward.D：距離をそのまま使う
  return { hc, Dd, rMethod, p };
}
function clWarnings(m, dk, hc) {
  const w = [], sqM = ['ward', 'centroid', 'median'].includes(m), wt = m === 'ward' ? clWardType(dk) : '';
  if (wt === 'D' && dk === 'euclid') w.push('<b>ward.D ＋ ユークリッド距離</b>は、Ward 法の基準（群内平方和の増え方が最小）になっていません（R 3.0 までの古い使い方）。平方ユークリッド距離を選ぶか、ward.D2 を選んでください。');
  if (wt === 'D2' && dk === 'sqeuclid') w.push('<b>ward.D2 ＋ 平方ユークリッド距離</b>は、内部でさらに 2 乗するため「距離の 4 乗」を使うことになり、Ward 法の基準になっていません。ユークリッド距離を選ぶか、ward.D を選んでください。');
  if (sqM && !['sqeuclid', 'euclid'].includes(dk)) w.push(`${CL_HM[m][0]}は、ユークリッド空間での重心や平方和にもとづく方法なので、本来は<b>平方ユークリッド距離</b>（Ward 法はユークリッド距離でも可）と組み合わせます。${CL_DIST[dk]}との組み合わせは、結果の解釈に注意してください。`);
  if ((m === 'centroid' || m === 'median') && dk === 'euclid') w.push(`${CL_HM[m][0]}は平方ユークリッド距離と組み合わせるのが基本です（SPSS でも推奨されています）。`);
  let inv = 0, mx = -Infinity; hc.merges.forEach(x => { if (x.h < mx - 1e-12) inv++; mx = Math.max(mx, x.h); });
  if (inv) w.push(`結合距離が前の段階より小さくなる「逆転」が ${inv} 回起きています（${m === 'centroid' || m === 'median' ? '重心法・メディアン法では起こりうる現象です' : 'この組み合わせでは起こりうる現象です'}）。デンドログラムが見にくくなるので、Ward 法やグループ間平均連結法も試してみてください。`);
  return { w, inv };
}
function clMethodGuide(open) {
  const mt = table(['方法', '2 つのクラスターの「遠さ」の決め方', '向いている場面', '注意点'], [
    ['<b>Ward 法</b>', 'まとめたときの群内平方和（ばらつき）の増え方が最も小さい組を結合', '人の類型化で最もよく使われる。人数のそろった、まとまりのよいクラスターができやすい', '平方ユークリッド距離（またはユークリッド距離）と組み合わせる。外れ値の影響を受けやすい'],
    ['<b>グループ間平均連結法</b><br><small>（群平均法、UPGMA）</small>', '2 つの群の人どうしのすべての組の距離の平均', '偏りが少なく、どの距離とも組み合わせられる汎用の方法。SPSS の既定', '群の形がはっきりしないデータでは、Ward 法より分かれ方が弱くなることがある'],
    ['<b>グループ内平均連結法</b>', 'まとめた後の群の中のすべての組の距離の平均が最も小さくなる組を結合', '群の内部がよくまとまったクラスターを作りたいとき', 'SPSS 独自の方法（R の hclust にはない）'],
    ['<b>最近隣法</b><br><small>（単連結法）</small>', '2 つの群で最も近い 2 人の距離', '細長い・不規則な形の群を見つけたいとき。外れ値（どこにも入らない人）の発見', '1 人ずつ鎖のようにつながる「連鎖」が起きやすく、大きな群が 1 つできがち。人の類型化には不向き'],
    ['<b>最遠隣法</b><br><small>（完全連結法）</small>', '2 つの群で最も遠い 2 人の距離', '群の直径が小さい、コンパクトなクラスターを作りたいとき', '外れ値に引きずられやすい。大きさのそろった群になりやすい'],
    ['<b>重心法</b>', '2 つの群の重心（平均）どうしの距離', '群の人数に違いがあるとき（人数で重みづけされる）', '平方ユークリッド距離で使う。結合距離の「逆転」が起こることがある'],
    ['<b>メディアン法</b>', '重心法と同じだが、群の人数に関係なく 2 群を等しく重みづけ', '人数の多い群に小さな群が吸収されるのを防ぎたいとき', '平方ユークリッド距離で使う。「逆転」が起こることがある']]);
  const dt = table(['距離', '何を測るか', '向いている場面', '注意点'], [
    ['<b>平方ユークリッド距離</b>', '直線距離の 2 乗。差の大きい人をより強く引き離す', 'Ward 法・重心法・メディアン法と組み合わせる（SPSS の既定）', '外れ値の影響が大きくなる'],
    ['<b>ユークリッド距離</b>', '多次元空間での直線距離', '最も一般的。連続変数（尺度得点など）', '単位や散らばりが違う変数は標準化してから'],
    ['<b>都市ブロック距離</b><br><small>（マンハッタン距離）</small>', '各変数の差の絶対値の合計', '外れ値の影響を弱めたいとき。「得点差の合計」として解釈したいとき', '変数どうしの相関は考慮しない'],
    ['<b>Chebychev 距離</b>', '差がいちばん大きい 1 つの変数の差', '「どれか 1 つでも大きく違えば別の人」とみなしたいとき', '最大の差の 1 変数だけで決まり、ほかの変数の情報は使われない'],
    ['<b>Minkowski 距離</b>', '上の 3 つの一般形（べき数 p）。p = 1 で都市ブロック、p = 2 でユークリッド、p が大きいほど Chebychev に近づく', '大きな差をどれだけ重視するかを調整したいとき', 'p の値によって結果が変わるので、選んだ理由を説明できるように'],
    ['<b>コサイン</b>', '回答パターンの「向き」（角度）の似かた。全体の高さ（大きさ）の違いは無視', 'どの変数が相対的に高いか（プロフィールの向き）で分けたいとき', '標準化した変数で使うのが普通。全変数が 0 の人は計算できない'],
    ['<b>Pearson の相関</b>', 'プロフィールの「形」（凸凹）の似かた。各人の平均の高さと散らばりを取り除く', '「どの変数が高くどれが低いか」という形のタイプで人を分けたいとき（例：得意・不得意のパターン）', '変数が 3 つ以上必要。全変数が同じ値の人は計算できない。全体的に高い人と低い人が同じ群になりうる']]);
  return `<details class="mcguide" ${open ? 'open' : ''}><summary>結合方法と距離の使い分け（クリックで開く）</summary><div style="padding:6px 2px">
    <p class="note"><b>迷ったら</b>：人を類型に分ける目的なら <b>Ward 法 ＋ 平方ユークリッド距離</b>（変数は標準化）が標準です。結果が方法によって大きく変わらないかを、グループ間平均連結法などでも確かめると安心です。</p>
    <h4>結合方法</h4>${mt}<h4>距離</h4>${dt}${wardGuide()}
    <p class="note">距離は「人と人の遠さ」の測り方、結合方法は「群と群の遠さ」の決め方です。コサインと Pearson の相関は「似ている度合い」なので、1 から引いて距離として使います。</p></div></details>`;
}

// ---- 図 ----
function dendroSvg(hc, k, title, inv) {
  const n = hc.n, W = 640, H = 346, M = { l: 52, r: 20, t: 50, b: n <= 60 ? 44 : 24 }, ord = leafOrder(hc), pos = new Array(n); ord.forEach((v, i) => pos[v] = i);
  const hmax = Math.max(...hc.merges.map(m => m.h)), hmin = Math.min(0, ...hc.merges.map(m => m.h)), yt = niceTicks(hmin, hmax), fy = h => H - M.b - (h - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), fx = i => M.l + (i + .5) * (W - M.l - M.r) / n;
  const as = cutTree(hc, k), cutH = k > 1 ? (hc.merges[n - k].h + hc.merges[n - k - 1].h) / 2 : hmax * 1.02;
  const nx = new Array(2 * n - 1), nh = new Array(2 * n - 1).fill(Math.max(0, yt[0])), ncl = new Array(2 * n - 1); for (let i = 0; i < n; i++) { nx[i] = fx(pos[i]); ncl[i] = as[i]; }
  let s = frame(W, H, M, yt, '結合距離（係数）', fy);
  hc.merges.forEach((m, t) => { const v = n + t; nx[v] = (nx[m.a] + nx[m.b]) / 2; nh[v] = m.h; ncl[v] = ncl[m.a] === ncl[m.b] ? ncl[m.a] : -1;
    const col = ncl[v] >= 0 && (inv || m.h <= cutH) ? GC[ncl[v] % 6] : 'var(--muted)', w = n > 150 ? 1 : 1.4;
    s += `<path d="M${nx[m.a]},${fy(nh[m.a])} V${fy(m.h)} H${nx[m.b]} V${fy(nh[m.b])}" fill="none" stroke="${col}" stroke-width="${w}"/>`; });
  if (k > 1 && !inv) s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(cutH)}" y2="${fy(cutH)}" stroke="var(--sig)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - M.r}" y="${fy(cutH) - 5}" text-anchor="end" style="fill:var(--sig);font-size:11px;font-weight:600">ここで切ると ${k} クラスター</text>`;
  if (n <= 60) ord.forEach((v, i) => s += `<text x="${fx(i)}" y="${H - M.b + 12}" text-anchor="end" transform="rotate(-90 ${fx(i)} ${H - M.b + 12})" style="font-size:8.5px">${v + 1}</text>`);
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">${esc(title)}。縦の高さ＝まとめたときの「遠さ」。色＝${k} クラスターに分けたときの所属。${n <= 60 ? '下の数字は回答者の番号。' : ''}</text>`;
  return s + '</svg>';
}
function heightPlot(hc, k) { // 結合距離の推移（右端ほど少ないクラスター数）
  const n = hc.n, K = Math.min(15, n - 1), hs = Array.from({ length: K }, (_, i) => ({ kk: i + 1, h: hc.merges[n - 2 - i].h })).reverse();
  const W = 520, H = 236, M = { l: 52, r: 20, t: 46, b: 40 }, yt = niceTicks(Math.min(0, ...hs.map(d => d.h)), Math.max(...hs.map(d => d.h))), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), fx = i => M.l + (i + .5) * (W - M.l - M.r) / K;
  let s = frame(W, H, M, yt, '結合距離', fy);
  s += `<polyline points="${hs.map((d, i) => `${fx(i)},${fy(d.h)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  hs.forEach((d, i) => { const on = d.kk === k; s += `<circle cx="${fx(i)}" cy="${fy(d.h)}" r="${on ? 5 : 3}" fill="${on ? 'var(--sig)' : 'var(--accent)'}"/><text x="${fx(i)}" y="${H - M.b + 15}" text-anchor="middle" style="font-size:10px">${d.kk + 1}→${d.kk}</text>`; });
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">クラスター数の変化（まとめる段階）</text><text x="${M.l}" y="16" style="font-size:10.5px">急に高くなる直前が、無理にまとめ始める手前＝クラスター数の目安です。</text>`;
  return s + '</svg>';
}
function kSelectPlot(rows, k, withW) { // k ごとのシルエット・CH・群内平方和
  const panels = [['平均シルエット', rows.map(r => r.sil), '大きいほど良い'], ['Calinski–Harabasz 指数', rows.map(r => r.ch), '大きいほど良い'], ...(withW ? [['群内平方和', rows.map(r => r.W), '肘（曲がり角）を探す']] : [])];
  const pw = 230, ph = 200, W = pw * panels.length, H = ph + 10;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  panels.forEach(([t, ys, hint], q) => {
    const ox = q * pw, M = { l: 44, r: 12, t: 40, b: 32 }, lo = Math.min(0, ...ys.filter(isFinite)), yt = niceTicks(lo, Math.max(...ys.filter(isFinite))), fy = v => ph - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (ph - M.t - M.b), fx = i => ox + M.l + (i + .5) * (pw - M.l - M.r) / rows.length;
    yt.forEach(v => s += `<line x1="${ox + M.l}" x2="${ox + pw - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${ox + M.l - 4}" y="${fy(v) + 4}" text-anchor="end" style="font-size:9.5px">${+v.toPrecision(4)}</text>`);
    s += `<polyline points="${ys.map((v, i) => `${fx(i)},${fy(v)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    rows.forEach((r, i) => { const on = r.k === k; s += `<circle cx="${fx(i)}" cy="${fy(ys[i])}" r="${on ? 5 : 3}" fill="${on ? 'var(--sig)' : 'var(--accent)'}"/><text x="${fx(i)}" y="${ph - M.b + 14}" text-anchor="middle" style="font-size:10px">${r.k}</text>`; });
    s += `<text x="${ox + pw / 2}" y="16" text-anchor="middle" style="fill:var(--fg);font-size:11.5px;font-weight:600">${t}</text><text x="${ox + pw / 2}" y="30" text-anchor="middle" style="font-size:10px">${hint}</text><text x="${ox + pw / 2}" y="${ph + 6}" text-anchor="middle" style="font-size:10px">クラスター数 k</text>`;
  });
  return s + '</svg>';
}
function profilePlot(zMeans, names, size) { // クラスターごとの平均（標準得点）
  const k = zMeans.length, p = names.length, W = Math.max(480, 110 * p + 150), H = 316, M = { l: 52, r: 130, t: 50, b: 52 };
  const all = zMeans.flat(), lim = Math.max(1, Math.ceil(Math.max(...all.map(Math.abs)) * 2) / 2), yt = niceTicks(-lim, lim), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), fx = q => M.l + (q + .5) * (W - M.l - M.r) / p;
  let s = frame(W, H, M, yt, '平均（標準得点 z）', fy);
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(0)}" y2="${fy(0)}" stroke="var(--fg)" stroke-width="1.2"/>`;
  names.forEach((nm, q) => s += `<text x="${fx(q)}" y="${H - M.b + 16}" text-anchor="middle" style="fill:var(--fg);font-size:11px">${esc(nm.length > 10 ? nm.slice(0, 10) + '…' : nm)}</text>`);
  const ly = lmSpread(zMeans.map(r => fy(r[p - 1])));
  zMeans.forEach((r, g) => { const c = GC[g % 6]; s += `<polyline points="${r.map((v, q) => `${fx(q)},${fy(v)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.6"/>` + r.map((v, q) => `<circle cx="${fx(q)}" cy="${fy(v)}" r="4.5" fill="${c}"/>`).join('') + `<text x="${W - M.r + 10}" y="${ly[g] + 4}" style="fill:${c};font-size:11.5px;font-weight:700">クラスター${g + 1}（${size[g]}人）</text>`; });
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">0 ＝ 全体の平均。上ほどその変数が高い群、下ほど低い群。線の形（プロフィール）から群に名前をつけます。</text>`;
  return s + '</svg>';
}
function silPlot(sil, as, k, avg) { // シルエット図（1 人 1 本の横棒）
  const n = sil.length, ord = sil.map((v, i) => i).sort((a, b) => as[a] - as[b] || sil[b] - sil[a]), W = 520, rowH = Math.max(.8, Math.min(4, 260 / n)), gap = 6, H = 40 + n * rowH + gap * (k - 1) + 34, M = { l: 100, r: 30 };
  const lo = Math.min(0, ...sil), fx = v => M.l + (v - lo) / (1 - lo) * (W - M.l - M.r); let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`, y = 32, cur = -1, start = 32;
  const lbl = (g, y0, y1) => `<text x="${M.l - 8}" y="${(y0 + y1) / 2 + 4}" text-anchor="end" style="fill:${GC[g % 6]};font-size:11px;font-weight:600">クラスター${g + 1}</text>`;
  ord.forEach(i => { if (as[i] !== cur) { if (cur >= 0) { s += lbl(cur, start, y); y += gap; } cur = as[i]; start = y; } s += `<rect x="${Math.min(fx(0), fx(sil[i]))}" y="${y}" width="${Math.abs(fx(sil[i]) - fx(0))}" height="${rowH}" fill="${GC[as[i] % 6]}" fill-opacity=".8"/>`; y += rowH; });
  s += lbl(cur, start, y);
  [0, .25, .5, .75, 1].filter(v => v >= lo).forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="28" y2="${y + 2}" stroke="var(--grid)"/><text x="${fx(v)}" y="${y + 16}" text-anchor="middle" style="font-size:10px">${v}</text>`);
  s += `<line x1="${fx(avg)}" x2="${fx(avg)}" y1="26" y2="${y + 2}" stroke="var(--sig)" stroke-dasharray="4 3" stroke-width="1.5"/><text x="${fx(avg)}" y="22" text-anchor="middle" style="fill:var(--sig);font-size:10.5px">平均 ${fmt(avg, 2)}</text>`;
  s += `<text x="10" y="${y + 30}" style="font-size:10.5px">1 本の棒＝1 人。右に長いほど自分の群にしっくり収まる人、左（負）は隣の群のほうが近い人。</text>`;
  return s + '</svg>';
}
function pcaScatter(Z, as, k) { // 主成分の平面に散布（色＝クラスター）
  const n = Z.length, p = Z[0].length, Rm = S.corMatrix(Z[0].map((_, q) => Z.map(r => r[q]))), E = S.eigSym(Rm), v1 = E.vectors[0], v2 = E.vectors[1] || v1.map(() => 0);
  const sc = Z.map(r => [S.sum(r.map((x, q) => x * v1[q])), S.sum(r.map((x, q) => x * v2[q]))]), pv = E.values.map(v => v / p * 100);
  const W = 460, H = 376, M = { l: 48, r: 20, t: 50, b: 44 }, xs = sc.map(s => s[0]), ys = sc.map(s => s[1]), xt = niceTicks(Math.min(...xs), Math.max(...xs)), yt = niceTicks(Math.min(...ys), Math.max(...ys));
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, `第2主成分（${fmt(pv[1] || 0, 1)}%）`, fy); xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(4)}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle" style="fill:var(--fg)">第1主成分（${fmt(pv[0], 1)}%）</text>`;
  sc.forEach((pt, i) => s += `<circle cx="${fx(pt[0])}" cy="${fy(pt[1])}" r="3" fill="${GC[as[i] % 6]}" fill-opacity=".7"/>`);
  for (let g = 0; g < k; g++) { const m = sc.filter((_, i) => as[i] === g); if (!m.length) continue; const cx = fx(S.mean(m.map(q => q[0]))), cy = fy(S.mean(m.map(q => q[1]))); s += `<circle cx="${cx}" cy="${cy}" r="9" fill="${GC[g % 6]}" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" style="fill:#fff;font-size:10px;font-weight:700">${g + 1}</text>`; }
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">${p} 変数を 2 次元に縮めた図（主成分分析）。群が離れているほど明確な分類。</text>`;
  return s + '</svg>';
}

// ---- 共通の出力 ----
function clGuide(kind) {
  return guideBox('クラスター分析とは', [
    ['何をする？', '回答のパターンが似ている人どうしを集めて、いくつかのグループ（クラスター）に分ける方法です。たとえば「学習動機づけのタイプ」「ストレス対処のタイプ」のように、<b>人を類型に分ける</b>ときに使います（変数をまとめる因子分析とは向きが逆です）。'],
    ['2 つのやり方', '<b>階層的クラスター分析</b>は、近い人どうしを 1 組ずつまとめていき、その過程を樹形図（デンドログラム）で示します。<b>非階層的クラスター分析（k-means 法）</b>は、クラスター数 k を決めて、各人を最も近い中心に割り当て直すことをくり返します。心理学では「Ward 法で k の目安をつけ、その結果を初期値にして k-means で仕上げる」2 段階の方法がよく使われます。'],
    ['標準化', '変数の単位や散らばりが違うと、散らばりの大きい変数だけで分類が決まってしまいます。ふつうは<b>標準化（z 得点）</b>してから分析します。'],
    ['クラスター数の決め方', '「正解」はありません。平均シルエット（.50 以上で明確な構造、.25〜.50 で弱い構造、.25 未満で構造なし）、Calinski–Harabasz 指数（大きいほど良い）、デンドログラムの高さの跳ね上がりを参考にしつつ、<b>各クラスターの特徴が解釈できるか</b>で決めます。'],
    ['結果の確かめ方', 'クラスターごとの平均（プロフィール）を見て名前をつけ、分類に使っていない変数（成績や性別など）でクラスター間の違いを調べると、分類の妥当性を示せます。下のボタンで所属クラスターをデータの列に追加すると、分散分析やクロス集計で比べられます。']]);
}
function clDescribe(D, as, k, st) { // サイズ・平均・F 検定・プロフィール
  const zM = Array.from({ length: k }, (_, g) => D.js.map((_, q) => S.mean(D.Z.filter((_, i) => as[i] === g).map(r => r[q]))));
  const rows = D.js.map((j, q) => { const grp = Array.from({ length: k }, (_, g) => D.raw.filter((_, i) => as[i] === g).map(r => r[q])), A = k > 1 ? S.anova1(grp) : null; return [esc(D.names[q]), ...grp.map(x => `${fmt(S.mean(x), 2)} <small>(${fmt(x.length > 1 ? S.sd(x) : 0, 2)})</small>`), A ? fmt(A.F, 2) : '—', A ? pcell(A.p) : '—', A ? fmt(A.eta2, 2) : '—']; });
  let h = '<h4>クラスターごとの平均（標準偏差）</h4>' + table(['変数', ...Array.from({ length: k }, (_, g) => `クラスター${g + 1}<br><small>n = ${st.size[g]}</small>`), 'F', 'p 値', 'η²'], rows)
    + '<p class="note">F 検定は、分類に使った変数そのもので群を比べているので、有意になるのは当然です（どの変数が分類に効いているかの目安として見てください）。分類の妥当性は、分類に使っていない変数で確かめます。</p>';
  h += '<h4>プロフィール（標準得点の平均）</h4>' + profilePlot(zM, D.names, st.size);
  const desc = zM.map((r, g) => { const hi = D.names.filter((_, q) => r[q] >= .5), lo = D.names.filter((_, q) => r[q] <= -.5); return `クラスター${g + 1}（${st.size[g]} 人）は${hi.length ? `「${hi.map(esc).join('」「')}」が高く` : ''}${hi.length && lo.length ? '、' : ''}${lo.length ? `「${lo.map(esc).join('」「')}」が低い` : ''}${!hi.length && !lo.length ? 'どの変数も平均的な' : ''}群`; });
  return { h, desc, zM };
}
function clSaveBtn(as, D, k, tag, label) {
  CL_LAST = { as, rowIdx: D.rowIdx, k, tag, label, nRows: state.db.rows.length };
  return `<div class="sheettools" style="margin:10px 0"><button class="btn primary" data-clsave="1">所属クラスターをデータに列として追加（列名「CL_${tag}${k}」）</button></div><p class="note">追加した列を要因A に選ぶと、分類に使っていない変数（例：GPA）をクラスター間で比べられます（分散分析タブやグラフ・集計タブ）。</p>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-clsave]'); if (!b || state.fmt !== 'db') return; const L = CL_LAST;
  if (!L || L.nRows !== state.db.rows.length) { b.textContent = 'データが変わったので追加できません。もう一度分析してください。'; return; }
  let name = `CL_${L.tag}${L.k}`, q = 2; while (state.db.cols.some(c => c.name === name)) name = `CL_${L.tag}${L.k}_${q++}`;
  const v = new Array(state.db.rows.length).fill(''); L.rowIdx.forEach((r, i) => v[r] = String(L.as[i] + 1));
  state.db.cols.push({ name, on: true, label: L.label, measure: 'nominal', values: Array.from({ length: L.k }, (_, g) => [String(g + 1), `クラスター${g + 1}`]) });
  state.db.rows.forEach((row, r) => row.push(v[r])); save(); renderSheet(); renderPanel();
  b.textContent = `列「${name}」を追加しました（データシートの右端）`; b.disabled = true;
});
function clKRange(n) { return Array.from({ length: Math.max(0, Math.min(8, n - 1) - 1) }, (_, i) => i + 2); }
function clChooseK(rows) { const fixed = state.opt.clK !== 'auto' ? +state.opt.clK : 0; if (fixed) return fixed; return rows.reduce((b, r) => r.sil > b.sil ? r : b, rows[0]).k; }

ANALYSES.db.hclust = function () {
  const D = clData(), m = state.opt.clMethod, dk = state.opt.clDist; need(D.n <= 1000, `人数が多すぎます（${D.n} 人）。1000 人以下にするか、k-means 法を使ってください。`);
  const H = clHier(D.X), hc = H.hc, ks = clKRange(D.n), rows = ks.map(k => { const as = cutTree(hc, k), st = clStats(D.X, as, k, H.Dd); return { k, sil: st.silAvg, ch: st.ch, W: st.W }; });
  const k = Math.min(clChooseK(rows), D.n - 1), as = cutTree(hc, k), st = clStats(D.X, as, k, H.Dd), mName = CL_HM[m][0], dist = CL_DIST[dk] + (dk === 'minkowski' ? `（p = ${H.p}）` : ''), Wn = clWarnings(m, dk, hc);
  let h = clGuide('h') + `<p class="note">変数：${D.names.map(esc).join('・')}（${state.opt.clZ ? '標準化して使用' : '標準化せずに使用'}）、n = ${D.n}${D.nMiss ? `（欠損のある ${D.nMiss} 人を除外）` : ''}。方法：${mName}、距離：${dist}。クラスター数：${state.opt.clK === 'auto' ? `平均シルエットが最大の k = ${k}` : `k = ${k}（指定）`}。</p>`;
  h += Wn.w.map(x => `<p class="warn">${x}</p>`).join('');
  if (m === 'ward') h += `<p class="note">Ward 法の計算方式：<b>${H.rMethod}</b>（${state.opt.clWard === 'D' || state.opt.clWard === 'D2' ? '指定' : '距離に合わせて自動'}）。R の <code>hclust(…, method = "${H.rMethod}")</code> と同じ計算です。${H.rMethod === 'ward.D' ? '結合距離は「群内平方和の増え方の 2 倍」です。' : '結合距離は「群内平方和の増え方の 2 倍」の平方根です。'}ward.D と ward.D2 の違いは、下の「結合方法と距離の使い分け」にあります。</p>`;
  h += '<h4>デンドログラム（樹形図）</h4>' + dendroSvg(hc, k, `${mName}・${CL_DIST[dk].replace(/（.*）/, '')}`, Wn.inv > 0);
  h += '<h4>クラスター数の目安</h4>' + table(['クラスター数 k', '平均シルエット', 'Calinski–Harabasz'], rows.map(r => [r.k === k ? `<b>${r.k}</b>` : r.k, fmt(r.sil), fmt(r.ch, 2)])) + `<p class="note">平均シルエットは、選んだ距離（${esc(CL_DIST[dk])}）で計算しています。Calinski–Harabasz 指数は、群間と群内の平方和（ユークリッド距離）の比です。</p>` + kSelectPlot(rows, k, false) + heightPlot(hc, k);
  const Dd = clDescribe(D, as, k, st); h += Dd.h;
  h += '<h4>シルエット図</h4>' + silPlot(st.sil, as, k, st.silAvg) + '<h4>2 次元に描いた分類</h4>' + pcaScatter(D.Z, as, k);
  h += clSaveBtn(as, D, k, CL_HM[m][1], `${mName}（${CL_DIST[dk].replace(/（.*）/, '')}）・k = ${k} の所属クラスター`);
  h += clMethodGuide(false);
  CL_LAST.rMethod = H.rMethod;
  h += interp(`${mName}（${dist}）による階層的クラスター分析で、${D.n} 人を ${k} つのクラスターに分けました。` + (m === 'single' ? '最近隣法は、鎖のように 1 人ずつつながる「連鎖」が起きやすく、大きな群と少人数の群に偏りがちです。人の類型化には Ward 法がよく使われます。' : ''),
    `平均シルエットは ${fmt(st.silAvg, 2)} で、${st.silAvg >= .5 ? 'クラスターがはっきり分かれた構造' : st.silAvg >= .25 ? '弱いながらもクラスター構造がある' : 'はっきりしたクラスター構造はない'}ことを示します（.50 以上で明確、.25〜.50 で弱い、.25 未満で構造なし）。`,
    Dd.desc.join('、') + 'です。この特徴から各クラスターに名前をつけます（例：「意欲型」「不安型」など）。',
    'クラスター数は、指標だけでなく「解釈できるか」「少なすぎる群がないか」もあわせて決めます。方法や距離を変えても似た分類になるかを確かめると、結果の安定性を示せます。');
  h += apa('論文記載例', `${D.names.join('・')}の ${D.p} 変数${state.opt.clZ ? 'の標準得点' : ''}を用いて、${mName}（${dist.replace('（1 − コサイン類似度）', '').replace('（1 − r）', '')}）による階層的クラスター分析を行った。デンドログラムと平均シルエット係数をもとに ${k} クラスター解を採用した（平均シルエット = ${fmt(st.silAvg, 2)}）。各クラスターの人数は ${st.size.map((x, g) => `クラスター${g + 1}が ${x} 名`).join('、')}であった。`);
  return { title: `階層的クラスター分析（${mName}${m === 'ward' ? `〔${H.rMethod}〕` : ''}・${CL_DIST[dk].replace(/（.*）/, '')}・${k} クラスター）`, html: h };
};
function wardInitCenters(X, k) { const hc = hclustFit(X, 'ward.D2'); return clCenters(X, cutTree(hc, k), k); }
function kppInit(X, k, R) { const n = X.length, c = [X[Math.floor(R() * n)]]; while (c.length < k) { const d = X.map(x => Math.min(...c.map(ci => clD2(x, ci)))), s = S.sum(d); let u = R() * s, i = 0; while (i < n - 1 && (u -= d[i]) > 0) i++; c.push(X[i]); } return c.map(r => r.slice()); }
ANALYSES.db.kmeans = function () {
  const D = clData(), ks = clKRange(D.n), useWard = D.n <= 800, R = rng(2024), hc = useWard ? hclustFit(D.X, 'ward.D2') : null;
  const fit = k => { if (useWard) return kmeansFit(D.X, clCenters(D.X, cutTree(hc, k), k)); let best = null; for (let s = 0; s < 20; s++) { const f = kmeansFit(D.X, kppInit(D.X, k, R)); if (!best || S.sum(f.wss) < S.sum(best.wss)) best = f; } return best; };
  const fits = {}, rows = ks.map(k => { const f = fits[k] = fit(k), st = clStats(D.X, f.as, k); return { k, sil: st.silAvg, ch: st.ch, W: st.W }; });
  const k = Math.min(clChooseK(rows), D.n - 1), F = fits[k] || fit(k), as = F.as, st = clStats(D.X, as, k);
  let h = clGuide('k') + `<p class="note">変数：${D.names.map(esc).join('・')}（${state.opt.clZ ? '標準化して使用' : '標準化せずに使用'}）、n = ${D.n}${D.nMiss ? `（欠損のある ${D.nMiss} 人を除外）` : ''}。初期値：${useWard ? 'Ward 法の結果（各クラスターの重心）' : 'k-means++ で 20 回試した中の最良'}。クラスター数：${state.opt.clK === 'auto' ? `平均シルエットが最大の k = ${k}` : `k = ${k}（指定）`}。</p>`;
  h += '<h4>クラスター数の目安</h4>' + table(['クラスター数 k', '平均シルエット', 'Calinski–Harabasz', '群内平方和'], rows.map(r => [r.k === k ? `<b>${r.k}</b>` : r.k, fmt(r.sil), fmt(r.ch, 2), fmt(r.W, 2)])) + kSelectPlot(rows, k, true);
  h += '<h4>クラスターの中心（' + (state.opt.clZ ? '標準得点' : '元の単位') + '）</h4>' + table(['変数', ...Array.from({ length: k }, (_, g) => `クラスター${g + 1}`)], D.names.map((nm, q) => [esc(nm), ...F.centers.map(c => fmt(c[q], 3))]))
    + table(['', '値'], [['群間平方和 ÷ 全体平方和（分類で説明できた割合）', `${fmt(st.B / st.T * 100, 1)}%`], ['群内平方和（合計）', fmt(st.W, 3)], ['反復回数', F.iter]]);
  const Dd = clDescribe(D, as, k, st); h += Dd.h;
  h += '<h4>シルエット図</h4>' + silPlot(st.sil, as, k, st.silAvg) + '<h4>2 次元に描いた分類</h4>' + pcaScatter(D.Z, as, k);
  h += clSaveBtn(as, D, k, 'km', `k-means・k = ${k} の所属クラスター`);
  h += interp(`k-means 法で ${D.n} 人を ${k} つのクラスターに分けました。分類によって、変数の散らばり全体の ${fmt(st.B / st.T * 100, 1)}% が説明されています。`,
    `平均シルエットは ${fmt(st.silAvg, 2)} で、${st.silAvg >= .5 ? 'クラスターがはっきり分かれた構造' : st.silAvg >= .25 ? '弱いながらもクラスター構造がある' : 'はっきりしたクラスター構造はない'}ことを示します（.50 以上で明確、.25〜.50 で弱い、.25 未満で構造なし）。`,
    Dd.desc.join('、') + 'です。この特徴から各クラスターに名前をつけます。',
    'k-means 法は初期値によって結果が変わることがあります。ここでは Ward 法の結果を初期値にしているので、同じデータなら毎回同じ結果になります。');
  h += apa('論文記載例', `${D.names.join('・')}の ${D.p} 変数${state.opt.clZ ? 'の標準得点' : ''}を用いてクラスター分析を行った。まず Ward 法による階層的クラスター分析と平均シルエット係数から ${k} クラスターが妥当と判断し、その重心を初期値として k-means 法による非階層的クラスター分析を行った（平均シルエット = ${fmt(st.silAvg, 2)}、群間平方和の割合 = ${fmt(st.B / st.T * 100, 1)}%）。各クラスターの人数は ${st.size.map((m, g) => `クラスター${g + 1}が ${m} 名`).join('、')}であった。`);
  return { title: `k-means クラスター分析（${k} クラスター）`, html: h };
};
