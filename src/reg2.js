// ===== 回帰の診断・階層的重回帰分析・回帰平面の 3D プロット =====

// ---- 汎用の散布図（参照線・傾向線・点のラベルつき） ----
function diagPlot(x, y, o = {}) {
  const W = 400, H = 312, M = { l: 50, r: 14, t: o.title ? 42 : 26, b: 42 }, xs = [...x, ...(o.xExtra || [])], ys = [...y, ...(o.yExtra || [])];
  const xt = niceTicks(Math.min(...xs), Math.max(...xs), 5), yt = niceTicks(Math.min(...ys), Math.max(...ys), 5);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, o.yn || '', fy); const cid = 'dp' + (++clipN);
  s = s.replace(/^<svg[^>]*>/, `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><defs><clipPath id="${cid}"><rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/></clipPath></defs>`);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(5)}</text>`);
  s += `<text x="${W - M.r}" y="${H - 6}" text-anchor="end" style="fill:var(--fg)">${esc(o.xn || '')}</text>`;
  if (o.title) s += `<text x="${M.l}" y="14" style="fill:var(--fg);font-weight:600">${esc(o.title)}</text>`;
  (o.hlines || []).forEach(l => { if (l.y >= yt[0] && l.y <= yt[yt.length - 1]) s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(l.y)}" y2="${fy(l.y)}" stroke="${l.col || 'var(--muted)'}" stroke-dasharray="${l.dash ? '4 3' : ''}"/>`; });
  (o.curves || []).forEach(c => s += `<polyline clip-path="url(#${cid})" points="${c.pts.map(([a, b]) => `${fx(a).toFixed(1)},${fy(b).toFixed(1)}`).join(' ')}" fill="none" stroke="${c.col || 'var(--sig)'}" stroke-width="1.3" stroke-dasharray="${c.dash ? '5 3' : ''}"/>`);
  x.forEach((v, i) => s += `<circle cx="${fx(v)}" cy="${fy(y[i])}" r="3.3" fill="${o.hi && o.hi.has(i) ? 'var(--sig)' : 'var(--accent)'}" fill-opacity=".7"/>`);
  if (o.trend && x.length >= 8) { // 移動平均の傾向線（曲がりの確認用）
    const idx = x.map((_, i) => i).sort((a, b) => x[a] - x[b]), w = Math.max(3, Math.round(x.length / 6)), pts = [];
    for (let k = 0; k < idx.length; k++) { const lo = Math.max(0, k - w), hi = Math.min(idx.length, k + w + 1), seg = idx.slice(lo, hi); pts.push([x[idx[k]], S.mean(seg.map(i => y[i]))]); }
    s += `<polyline clip-path="url(#${cid})" points="${pts.map(([a, b]) => `${fx(a).toFixed(1)},${fy(b).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--sig)" stroke-width="2"/>`;
  }
  Object.entries(o.labels || {}).forEach(([i, lab]) => s += `<text x="${fx(x[i]) + 5}" y="${fy(y[i]) - 5}" style="fill:var(--sig);font-size:10.5px">${esc(lab)}</text>`);
  return s + '</svg>';
}

// ---- 回帰の診断 ----
function regDiag(y, cols, rowNo) {
  const n = y.length, p = cols.length, X = y.map((_, i) => [1, ...cols.map(c => c[i])]), fit = S.ols(X, y), mse = fit.sse / fit.df;
  const h = X.map(r => { let s = 0; for (let a = 0; a < r.length; a++) for (let b = 0; b < r.length; b++) s += r[a] * fit.inv[a][b] * r[b]; return s; });
  const sr = fit.resid.map((e, i) => e / Math.sqrt(mse * (1 - h[i]))), rs = sr.map(r => r * Math.sqrt((n - p - 2) / Math.max(1e-12, n - p - 1 - r * r)));
  const cook = sr.map((r, i) => r * r * h[i] / ((p + 1) * (1 - h[i]))), fitted = fit.fitted;
  // Breusch-Pagan 検定（Koenker の studentized 版。R の lmtest::bptest の既定と同じ）
  const u = fit.resid.map(e => e * e), bfit = S.ols(X, u), um = S.mean(u), r2u = 1 - bfit.sse / S.sum(u.map(v => (v - um) ** 2)), BP = n * r2u, pBP = S.pchiU(BP, p);
  let dw = 0; for (let i = 1; i < n; i++) dw += (fit.resid[i] - fit.resid[i - 1]) ** 2; dw /= fit.sse;
  const lab = i => rowNo ? `${rowNo[i]}行` : `${i + 1}`, cutC = 4 / n, cutH = 2 * (p + 1) / n;
  const flag = cook.map((c, i) => c > cutC || Math.abs(rs[i]) > 3 || h[i] > cutH);
  const top = cook.map((c, i) => i).sort((a, b) => cook[b] - cook[a]).slice(0, 3), labels = Object.fromEntries(top.map(i => [i, lab(i)]));
  const hiSet = new Set(cook.map((c, i) => c > cutC ? i : -1).filter(i => i >= 0));
  const hmax = Math.max(...h) * 1.05, curve = D => Array.from({ length: 40 }, (_, k) => { const hh = .001 + (hmax - .001) * k / 39; return [hh, Math.sqrt(D * (p + 1) * (1 - hh) / hh)]; });
  let out = '<h4>回帰の診断（残差の確認）</h4><div class="figrow">'
    + diagPlot(fitted, sr, { xn: '予測値', yn: '標準化残差', title: '① 残差 対 予測値', hlines: [{ y: 0 }, { y: 2, dash: 1, col: 'var(--sig)' }, { y: -2, dash: 1, col: 'var(--sig)' }], trend: true, labels, hi: hiSet })
    + diagPlot(fitted, sr.map(r => Math.sqrt(Math.abs(r))), { xn: '予測値', yn: '√|標準化残差|', title: '② Scale-Location（等分散性）', trend: true, labels, hi: hiSet })
    + diagPlot(h, sr, { xn: 'てこ比（leverage）', yn: '標準化残差', title: '③ てこ比 対 残差（Cook の距離）', hlines: [{ y: 0 }], curves: [...[.5, 1].flatMap(D => [{ pts: curve(D), dash: 1 }, { pts: curve(D).map(([a, b]) => [a, -b]), dash: 1 }])], yExtra: [Math.min(...sr), Math.max(...sr)], labels, hi: hiSet })
    + '</div><p class="note">①：点が 0 の線の上下に偏りなく散らばり、赤い傾向線がほぼ水平なら「線形性」の前提は満たされています。曲がっていれば、2 乗の項や変数の変換を検討します。②：傾向線が水平なら残差のばらつきが一定（等分散性）、右上がり・右下がりなら不均一です。③：点線は Cook の距離 .5 と 1 の境界で、外側の点は結果に強い影響を与えるケースです。橙の点は Cook の距離 > 4/n、ラベルは影響の大きい上位 3 ケースです。</p>';
  out += table(['確認すること', '指標', '値', '判定'], [
    ['残差の独立性', 'Durbin-Watson 比', fmt(dw, 2), dw > 1.5 && dw < 2.5 ? '問題なし' : '注意（1.5〜2.5 の外）'],
    ['等分散性', 'Breusch-Pagan 検定（studentized）', `χ²(${p}) = ${fmt(BP, 2)}, p ${pBP < .001 ? '< .001' : '= ' + fp(pBP)}`, pBP < .05 ? '<b>不均一の疑い</b>' : '問題なし'],
    ['外れ値', '|スチューデント化残差| > 3', `${rs.filter(v => Math.abs(v) > 3).length} ケース`, rs.some(v => Math.abs(v) > 3) ? '<b>確認が必要</b>' : 'なし'],
    ['影響の大きいケース', `Cook の距離 > 4/n（= ${fmt(cutC, 3)}）`, `${cook.filter(c => c > cutC).length} ケース`, cook.some(c => c > 1) ? '<b>Cook > 1 のケースあり</b>' : cook.some(c => c > cutC) ? '確認を推奨' : 'なし'],
    ['てこ比の大きいケース', `てこ比 > 2(p+1)/n（= ${fmt(cutH, 3)}）`, `${h.filter(v => v > cutH).length} ケース`, h.some(v => v > cutH) ? '確認を推奨' : 'なし']]);
  const fl = cook.map((c, i) => i).filter(i => flag[i]).sort((a, b) => cook[b] - cook[a]).slice(0, 10);
  if (fl.length) out += '<h4>確認したいケース（影響の大きい順、上位 10）</h4>' + table(['ケース', '実測値', '予測値', '標準化残差', 'スチューデント化残差', 'てこ比', 'Cook の距離'], fl.map(i => [lab(i), fmt(y[i], 2), fmt(fitted[i], 2), fmt(sr[i], 2), { v: fmt(rs[i], 2), cls: Math.abs(rs[i]) > 3 ? 'sig' : '' }, { v: fmt(h[i], 3), cls: h[i] > cutH ? 'sig' : '' }, { v: fmt(cook[i], 3), cls: cook[i] > cutC ? 'sig' : '' }]));
  out += normCheck([{ label: '残差', x: sr }], { qqLabel: '標準化残差', title: '残差の正規性', need: '回帰分析の t 検定・F 検定・信頼区間は、残差が正規分布に従うことを前提にしています（説明変数や目的変数そのものが正規分布である必要はありません）。' });
  out += interp('回帰分析の結果を信頼するには、①線形性、②等分散性、③残差の独立性、④残差の正規性、⑤極端に影響の大きいケースがないこと、を確かめます。',
    pBP < .05 ? `Breusch-Pagan 検定が有意（${pTxt(pBP)}）で、残差のばらつきが予測値によって違う（不均一分散）可能性があります。係数の推定値そのものは偏りませんが、標準誤差と p 値が不正確になるので、頑健な標準誤差（HC3。R スクリプトに例があります）を使うか、目的変数の変換を検討してください。` : `Breusch-Pagan 検定は有意ではなく（${pTxt(pBP)}）、等分散性に大きな問題はありません。`,
    cook.some(c => c > 1) ? `Cook の距離が 1 を超えるケース（${cook.map((c, i) => c > 1 ? lab(i) : null).filter(Boolean).join('、')}）があり、そのケースだけで結果が大きく変わる可能性があります。入力ミスでないかを確認し、除いた場合の結果も比べてください（理由なく除外してはいけません）。` : fl.length ? `影響のやや大きいケースが ${cook.filter(c => c > cutC).length} 件ありますが、Cook の距離はすべて 1 未満で、結果を大きく左右するほどではありません。念のため表のケースを確認してください。` : '影響の大きいケースは見当たりません。',
    dw > 1.5 && dw < 2.5 ? '' : `Durbin-Watson 比が ${fmt(dw, 2)} で、データの並び順に沿った残差の相関（自己相関）があるかもしれません。時系列データでなければ通常は問題になりません。`);
  return { html: out, h, cook, sr, BP, pBP, dw };
}

// ---- 3D プロット（ドラッグで回転） ----
const P3D = {};
function plot3d(o) { // o: { x, z, y, f(x, z), xn, zn, yn }
  const id = 'p3d' + (++clipN); P3D[id] = { ...o, th: -.75, ph: .45 };
  return `<figure class="p3dwrap"><svg class="chart p3d" data-p3d="${id}" viewBox="0 0 520 430" role="img">${render3d(P3D[id])}</svg><figcaption class="note">ドラッグで回転できます。<button class="btn" data-p3dreset="${id}" style="padding:1px 8px">向きを戻す</button></figcaption></figure>`;
}
function render3d(P) {
  const rng = a => { const lo = Math.min(...a), hi = Math.max(...a); return [lo, hi === lo ? lo + 1 : hi]; };
  const [x0, x1] = rng(P.x), [z0, z1] = rng(P.z), G = 14;
  const grid = Array.from({ length: G + 1 }, (_, i) => Array.from({ length: G + 1 }, (_, j) => { const xv = x0 + (x1 - x0) * i / G, zv = z0 + (z1 - z0) * j / G; return [xv, zv, P.f(xv, zv)]; }));
  const ys = [...P.y, ...grid.flat().map(g => g[2])], [y0, y1] = rng(ys);
  const nx = v => (v - x0) / (x1 - x0) * 2 - 1, nz = v => (v - z0) / (z1 - z0) * 2 - 1, ny = v => (v - y0) / (y1 - y0) * 1.6 - .8;
  const ct = Math.cos(P.th), st = Math.sin(P.th), cp = Math.cos(P.ph), sp = Math.sin(P.ph), Sc = 140, cx = 260, cy = 225;
  const proj = (a, b, c) => { const X = nx(a), Y = ny(c), Z = nz(b), x1r = X * ct + Z * st, z1r = -X * st + Z * ct, y2 = Y * cp - z1r * sp, z2 = Y * sp + z1r * cp; return [cx + Sc * x1r, cy - Sc * y2, z2]; };
  let s = '';
  // 箱の枠
  const C = [[x0, z0, y0], [x1, z0, y0], [x1, z1, y0], [x0, z1, y0], [x0, z0, y1], [x1, z0, y1], [x1, z1, y1], [x0, z1, y1]].map(c => proj(...c));
  [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => s += `<line x1="${C[a][0].toFixed(1)}" y1="${C[a][1].toFixed(1)}" x2="${C[b][0].toFixed(1)}" y2="${C[b][1].toFixed(1)}" stroke="var(--grid)"/>`);
  // 面（奥から描く）
  const quads = []; for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]].map(g => proj(g[0], g[1], g[2])), hgt = (grid[i][j][2] + grid[i + 1][j + 1][2]) / 2; quads.push({ q, d: S.mean(q.map(v => v[2])), t: (hgt - y0) / (y1 - y0) }); }
  quads.sort((a, b) => a.d - b.d).forEach(({ q, t }) => { const r = Math.round(23 + t * (192 - 23)), g = Math.round(96 + t * (97 - 96)), b = Math.round(122 + t * (43 - 122)); s += `<polygon points="${q.map(v => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' ')}" fill="rgb(${r},${g},${b})" fill-opacity=".42" stroke="rgb(${r},${g},${b})" stroke-opacity=".55" stroke-width=".6"/>`; });
  // データ点と面までの線（残差）
  P.x.map((xv, i) => { const a = proj(xv, P.z[i], P.y[i]), b = proj(xv, P.z[i], P.f(xv, P.z[i])); return { a, b, up: P.y[i] >= P.f(xv, P.z[i]) }; }).sort((u, v) => u.a[2] - v.a[2])
    .forEach(({ a, b, up }) => s += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="var(--muted)" stroke-opacity=".45"/><circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="3.2" fill="${up ? 'var(--sig)' : 'var(--accent)'}" fill-opacity=".85"/>`);
  // 軸ラベル
  const lb = (p, t, anc = 'middle') => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="${anc}" style="fill:var(--fg);font-size:12px">${esc(t)}</text>`, sm = (p, t) => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="middle" style="font-size:10px">${t}</text>`;
  s += lb(proj((x0 + x1) / 2, z0 - (z1 - z0) * .18, y0), P.xn) + sm(proj(x0, z0 - (z1 - z0) * .07, y0), +x0.toPrecision(3)) + sm(proj(x1, z0 - (z1 - z0) * .07, y0), +x1.toPrecision(3));
  s += lb(proj(x1 + (x1 - x0) * .2, (z0 + z1) / 2, y0), P.zn) + sm(proj(x1 + (x1 - x0) * .07, z0, y0), +z0.toPrecision(3)) + sm(proj(x1 + (x1 - x0) * .07, z1, y0), +z1.toPrecision(3));
  s += lb(proj(x0, z1, y1 + (y1 - y0) * .1), P.yn) + sm(proj(x0 - (x1 - x0) * .06, z1, y0), +y0.toPrecision(3)) + sm(proj(x0 - (x1 - x0) * .06, z1, y1), +y1.toPrecision(3));
  s += `<text x="10" y="18" style="font-size:10.5px">面＝回帰式による予測値、点＝実測値（橙＝面より上、青＝下）、線＝残差</text>`;
  return s;
}
(() => {
  let drag = null;
  document.addEventListener('pointerdown', e => { const svg = e.target.closest && e.target.closest('svg[data-p3d]'); if (!svg) return; drag = { svg, P: P3D[svg.dataset.p3d], x: e.clientX, y: e.clientY }; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
  document.addEventListener('pointermove', e => { if (!drag || !drag.P) return; drag.P.th += (e.clientX - drag.x) * .01; drag.P.ph = Math.max(-1.45, Math.min(1.45, drag.P.ph + (e.clientY - drag.y) * .01)); drag.x = e.clientX; drag.y = e.clientY; drag.svg.innerHTML = render3d(drag.P); });
  document.addEventListener('pointerup', () => drag = null);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-p3dreset]'); if (!b) return; const P = P3D[b.dataset.p3dreset]; P.th = -.75; P.ph = .45; document.querySelector(`svg[data-p3d="${b.dataset.p3dreset}"]`).innerHTML = render3d(P); });
})();
function plane3dFor(yy, cols, names, coefB, j1, j2, yName, inter) { // 2つの説明変数（ほかは平均値）での回帰平面
  const means = cols.map(c => S.mean(c)), f = (a, b) => { let v = coefB[0]; cols.forEach((_, k) => { v += coefB[k + 1] * (k === j1 ? a : k === j2 ? b : inter && k === inter.k ? a * b : means[k]); }); return v; };
  return plot3d({ x: cols[j1], z: cols[j2], y: yy, f, xn: names[j1], zn: names[j2], yn: yName });
}

// ---- 階層的重回帰分析 ----
ANALYSES.db.hreg = function () {
  const R = state.db.roles, P = mregPrep(), { y, yy, vars, ok } = P, step = R.step || {}, xs = R.x.filter(j => j !== y);
  const vj = vars.map((v, k) => xs[k]); // vars は xs の順（空の列は除かれている可能性があるので名前で対応）
  const jOf = k => xs.find(j => vn(j) === vars[k].name), stepOf = k => +(step[jOf(k)] || 1); void vj;
  const ia = (R.inter || []).filter(j => xs.includes(j) && colType(j) === 'num'), useInt = ia.length === 2 && ia[0] !== ia[1];
  const center = state.opt.center !== false, kOfJ = j => vars.findIndex(v => v.name === vn(j));
  const cols0 = vars.map(v => v.cols.map(c => c.slice())), nm0 = vars.map(v => v.names.slice());
  if (useInt && center) ia.forEach(j => { const k = kOfJ(j), m = S.mean(cols0[k][0]); cols0[k][0] = cols0[k][0].map(v => v - m); nm0[k][0] = vars[k].names[0] + '（中心化）'; });
  const steps = [...new Set(vars.map((_, k) => stepOf(k)))].sort((a, b) => a - b);
  const blocks = steps.map(sn => vars.map((_, k) => k).filter(k => stepOf(k) === sn));
  let intCol = null, intName = '';
  if (useInt) { const a = cols0[kOfJ(ia[0])][0], b = cols0[kOfJ(ia[1])][0]; intCol = a.map((v, i) => v * b[i]); intName = `${vn(ia[0])} × ${vn(ia[1])}`; }
  const models = []; let cum = [];
  blocks.forEach((bk, s) => { cum = [...cum, ...bk]; models.push({ label: `ステップ ${s + 1}`, added: bk.map(k => vars[k].name), cols: cum.flatMap(k => cols0[k]), names: cum.flatMap(k => nm0[k]) }); });
  if (useInt) { const last = models[models.length - 1]; models.push({ label: `ステップ ${models.length + 1}`, added: [intName + '（交互作用）'], cols: [...last.cols, intCol], names: [...last.names, intName] }); }
  need(models.length >= 2, '説明変数を 2 つ以上のステップに分けるか、交互作用項を指定してください（説明変数の横の「ステップ」で 1・2・3 を選びます）。');
  const fits = models.map(m => S.multiReg(yy, m.cols, m.names)), n = yy.length;
  const rows = fits.map((F, s) => { const prev = s ? fits[s - 1] : null, dR2 = F.r2 - (prev ? prev.r2 : 0), df1 = F.p - (prev ? prev.p : 0), dF = dR2 / df1 / ((1 - F.r2) / F.df2); return { F, dR2, df1, df2: F.df2, dF, p: S.pfU(dF, df1, F.df2) }; });
  let h = `<p class="note">目的変数 = ${nm(y)}、n = ${n}${ok.filter(v => !v).length ? `（欠測などで ${ok.filter(v => !v).length} 行を除外）` : ''}。${useInt ? (center ? `交互作用項は、${vn(ia[0])} と ${vn(ia[1])} をそれぞれ平均で中心化してから積を作りました（多重共線性を抑え、主効果の係数を「もう一方が平均のときの効果」として解釈できるようにするため）。` : '交互作用項は中心化せずに作りました。') : ''}</p>`;
  h += '<h4>各ステップで投入した変数</h4>' + table(['ステップ', '投入した変数'], models.map(m => [m.label, m.added.map(esc).join('、')]));
  h += '<h4>モデルの要約（R² の変化）</h4>' + table(['ステップ', 'R', 'R²', '調整済み R²', 'ΔR²', 'ΔF', '自由度', 'p 値（ΔR²）', 'モデル全体の F 検定'], rows.map((r, s) => [models[s].label, fmt(r.F.R, 3), fmt(r.F.r2, 3), fmt(r.F.adjr2, 3), { v: fmt(r.dR2, 3), cls: r.p < .05 ? 'sig' : '' }, fmt(r.dF, 2), `${r.df1}, ${r.df2}`, pcell(r.p), `F(${r.F.df1}, ${r.F.df2}) = ${fmt(r.F.F, 2)}, p ${r.F.pF < .001 ? '< .001' : '= ' + fp(r.F.pF)}`]));
  h += '<p class="note">ΔR² は、そのステップで加えた変数が、前のステップまでの変数を統制したうえで「新たに」説明した分散の割合です。ΔF 検定はその増分が 0 より大きいかを検定します（R の anova(m1, m2) と同じ）。</p>';
  fits.forEach((F, s) => { h += `<h4>${models[s].label} の係数</h4>` + table(['', 'B', 'SE', 'β', 't', 'p 値', 'VIF'], F.coef.map(c => [esc(c.name), fmt(c.b), fmt(c.se), isFinite(c.beta) ? fmt(c.beta) : '', fmt(c.t), pcell(c.p), c.vif ? { v: fmt(c.vif, 2), cls: c.vif > 10 ? 'sig' : '' } : ''])); });
  const FF = fits[fits.length - 1], last = models[models.length - 1];
  h += `<h4>最終モデルの標準偏回帰係数</h4>` + coefPlot(FF.coef.slice(1));
  // 交互作用：単純傾斜と Johnson-Neyman
  let simp = null;
  if (useInt) {
    const kx = last.names.indexOf(nm0[kOfJ(ia[0])][0]) + 1, kz = last.names.indexOf(nm0[kOfJ(ia[1])][0]) + 1, ki = last.cols.length;
    const X = yy.map((_, i) => [1, ...last.cols.map(c => c[i])]), fit = S.ols(X, yy), mse = fit.sse / fit.df, V = fit.inv.map(r => r.map(v => v * mse)), b = fit.b;
    const zc = last.cols[kz - 1], zm = S.mean(zc), zs = S.sd(zc), zRaw = center ? S.mean(vars[kOfJ(ia[1])].cols[0]) : 0, tc = S.qt(.025, fit.df);
    const at = zv => { const sl = b[kx] + b[ki] * zv, se = Math.sqrt(V[kx][kx] + 2 * zv * V[kx][ki] + zv * zv * V[ki][ki]), t = sl / se; return { sl, se, t, p: S.pt2(t, fit.df), L: sl - tc * se, U: sl + tc * se }; };
    simp = [['平均 − 1SD', zm - zs], ['平均', zm], ['平均 + 1SD', zm + zs]].map(([l, zv]) => ({ l, zv, raw: zv + zRaw, ...at(zv) }));
    // Johnson-Neyman：傾きがちょうど有意になる Z の値
    const A = b[ki] ** 2 - tc * tc * V[ki][ki], B2 = 2 * (b[kx] * b[ki] - tc * tc * V[kx][ki]), Cc = b[kx] ** 2 - tc * tc * V[kx][kx], disc = B2 * B2 - 4 * A * Cc;
    const jn = disc >= 0 && Math.abs(A) > 1e-12 ? [(-B2 - Math.sqrt(disc)) / (2 * A), (-B2 + Math.sqrt(disc)) / (2 * A)].sort((u, v) => u - v).map(v => v + zRaw) : [];
    const zMin = Math.min(...zc) + zRaw, zMax = Math.max(...zc) + zRaw;
    h += `<h4>単純傾斜の分析（${esc(vn(ia[1]))} の値ごとの ${esc(vn(ia[0]))} の傾き）</h4>` + table([`${vn(ia[1])} の値`, '', '傾き B', 'SE', 't', 'p 値', '95%CI'], simp.map(r => [r.l, fmt(r.raw, 2), fmt(r.sl, 3), fmt(r.se, 3), fmt(r.t, 2), pcell(r.p), `[${fmt(r.L, 3)}, ${fmt(r.U, 3)}]`]));
    const sigAt = zv => at(zv - zRaw).p < .05;
    const jnTxt = jn.length ? `${vn(ia[0])} の傾きが 5% 水準で有意になるのは、${vn(ia[1])} が ${A > 0 ? `${fmt(jn[0], 2)} 未満、または ${fmt(jn[1], 2)} より大きいとき` : `${fmt(jn[0], 2)} から ${fmt(jn[1], 2)} の範囲`}です（観測範囲 ${fmt(zMin, 2)}〜${fmt(zMax, 2)}）。` : `${vn(ia[1])} の値によらず、傾きの有意性は${sigAt((zMin + zMax) / 2) ? '常に有意' : '常に有意ではない'}です。`;
    h += `<p class="note"><b>Johnson-Neyman 法：</b>${jnTxt}</p>`;
    // 単純傾斜の図
    const xr = vars[kOfJ(ia[0])].cols[0], xm = center ? S.mean(xr) : 0, xlo = Math.min(...xr), xhi = Math.max(...xr);
    const pred = (xv, zv) => { const xx = new Array(last.cols.length).fill(0).map((_, k) => S.mean(last.cols[k])); xx[kx - 1] = xv - xm; xx[kz - 1] = zv; xx[ki - 1] = (xv - xm) * zv; return b[0] + xx.reduce((s2, v, k) => s2 + v * b[k + 1], 0); };
    const lines = simp.map((r, li) => ({ pts: [[xlo, pred(xlo, r.zv)], [xhi, pred(xhi, r.zv)]], col: GC[li % 6] }));
    h += `<div class="figrow">${diagPlot(xr, yy, { xn: vn(ia[0]), yn: vn(y), title: '単純傾斜（' + vn(ia[1]) + ' の高さ別）', curves: lines })}</div><p class="note">線：${simp.map((r, li) => `<span style="color:${GC[li % 6]}">■</span> ${vn(ia[1])} = ${r.l}`).join('　')}（ほかの変数は平均値）。</p>`;
    h += '<h4>回帰平面の 3D プロット（交互作用によるねじれ）</h4>' + plot3d({ x: xr, z: vars[kOfJ(ia[1])].cols[0], y: yy, f: (a, c) => pred(a, c - zRaw), xn: vn(ia[0]), zn: vn(ia[1]), yn: vn(y) });
  } else {
    const num = last.names.map((nmx, k) => ({ nmx, k })).filter(o => !vars.some(v => v.cat && v.names.includes(o.nmx)));
    if (num.length >= 2) h += '<h4>回帰平面の 3D プロット（最終モデル）</h4>' + plane3dFor(yy, last.cols, last.names, FF.coef.map(c => c.b), num[0].k, num[1].k, vn(y)) + `<p class="note">${esc(num[0].nmx)} と ${esc(num[1].nmx)} の 2 つで描いています（ほかの説明変数は平均値に固定）。交互作用項を加えると、面がねじれるかどうかで交互作用を確かめられます。</p>`;
  }
  const D = regDiag(yy, last.cols, ok.map((v, i) => v ? i + 1 : 0).filter(Boolean)); h += D.html;
  const sigLast = FF.coef.slice(1).filter(c => c.p < .05);
  h += interp(rows.map((r, s) => s === 0 ? `ステップ 1（${models[0].added.map(esc).join('・')}）で、${nm(y)}の分散の ${fmt(r.F.r2 * 100, 1)}% が説明されました（${pTxt(r.F.pF)}）。` : `ステップ ${s + 1} で${models[s].added.map(esc).join('・')}を加えると、R² が ${fmt(r.dR2 * 100, 1)} ポイント${r.p < .05 ? `増え、この増加は有意でした（ΔF(${r.df1}, ${r.df2}) = ${fmt(r.dF, 2)}, ${pTxt(r.p)}）。前のステップの変数の影響を統制しても、新たに加えた変数が${nm(y)}を説明するといえます。` : `増えましたが、有意ではありませんでした（${pTxt(r.p)}）。前のステップの変数を超える説明力があるとはいえません。`}`).join(''),
    sigLast.length ? `最終モデルで有意だった変数：${sigLast.map(c => `${esc(c.name)}（β = ${fmt(c.beta, 2)}）`).join('、')}。` : '最終モデルで有意な変数はありませんでした。',
    useInt && simp ? (rows[rows.length - 1].p < .05 ? `交互作用が有意です。${esc(vn(ia[0]))}が${nm(y)}に与える影響は、${esc(vn(ia[1]))}の高さによって変わります（調整効果）。単純傾斜を見ると、${esc(vn(ia[1]))}が低い（−1SD）とき傾きは ${fmt(simp[0].sl, 2)}（${pTxt(simp[0].p)}）、高い（+1SD）ときは ${fmt(simp[2].sl, 2)}（${pTxt(simp[2].p)}）です。3D プロットで面のねじれを確かめてください。` : `交互作用は有意ではなく（${pTxt(rows[rows.length - 1].p)}）、${esc(vn(ia[0]))}の効果が${esc(vn(ia[1]))}の高さによって変わるとはいえません。`) : '',
    '階層的重回帰分析では、投入の順番は理論や研究の目的（例：統制変数 → 主要な説明変数 → 交互作用）で事前に決めます。データを見てから順番を変えると、結果の意味が変わってしまいます。');
  h += apa('論文記載例', `${nm(y)}を目的変数とする階層的重回帰分析を行った。` + rows.map((r, s) => s === 0 ? `ステップ 1 では${models[0].added.map(esc).join('・')}を投入し、<i>R</i>² = ${fmt(r.F.r2, 2)}（<i>F</i>(${r.F.df1}, ${r.F.df2}) = ${fmt(r.F.F, 2)}, ${apaP(r.F.pF)}）であった。` : `ステップ ${s + 1} で${models[s].added.map(esc).join('・')}を加えたところ、Δ<i>R</i>² = ${fmt(r.dR2, 2)}（Δ<i>F</i>(${r.df1}, ${r.df2}) = ${fmt(r.dF, 2)}, ${apaP(r.p)}）であった。`).join(''));
  return { title: `階層的重回帰分析（${vn(y)}）`, html: h };
};
