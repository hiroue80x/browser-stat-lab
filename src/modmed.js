// ===== 調整媒介分析（PROCESS モデル 7・8・14 に相当） =====
state.opt.mmModel = state.opt.mmModel || '7';
const MM_MODELS = { '7': 'モデル 7（W が X → M を調整）', '8': 'モデル 8（W が X → M と X → Y を調整）', '14': 'モデル 14（W が M → Y を調整）' };

function modMedDiagram(model, o) { // 概念図に係数を添えたもの
  const W = 620, H = 270, bw = 120, bh = 38, X = { x: 85, y: 215 }, M = { x: 310, y: 60 }, Y = { x: 535, y: 215 }, Wb = { x: model === '14' ? 500 : 120, y: 60 };
  const lab = (v, p) => `${c2(v)}${p < .05 ? star(p) : ''}`, col = p => p < .05 ? 'var(--accent)' : 'var(--muted)';
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:640px"><defs><marker id="mma" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--fg)"/></marker></defs>`;
  const box = (p, t, f) => `<rect x="${p.x - bw / 2}" y="${p.y - bh / 2}" width="${bw}" height="${bh}" rx="4" fill="${f || 'var(--sheet)'}" stroke="var(--fg)" stroke-width="1.4"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" style="fill:var(--fg);font-size:12.5px">${esc(t.length > 9 ? t.slice(0, 9) + '…' : t)}</text>`;
  const line = (x1, y1, x2, y2, c, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.8" ${dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#mma)"/>`;
  const tag = (x, y, t) => `<rect x="${x - tw(t) / 2 - 4}" y="${y - 13}" width="${tw(t) + 8}" height="17" rx="3" fill="var(--sheet)"/><text x="${x}" y="${y}" text-anchor="middle" style="fill:var(--fg);font-size:11.5px">${t}</text>`;
  // a パス・b パス・直接効果
  s += line(X.x + 20, X.y - bh / 2, M.x - bw / 2, M.y + 8, col(o.pa), o.pa >= .05) + line(M.x + bw / 2, M.y + 8, Y.x - 20, Y.y - bh / 2, col(o.pb), o.pb >= .05) + line(X.x + bw / 2, Y.y, Y.x - bw / 2, Y.y, col(o.pc), o.pc >= .05);
  const aMid = [(X.x + M.x) / 2 - 10, (X.y + M.y) / 2 + 10], bMid = [(M.x + Y.x) / 2 + 10, (M.y + Y.y) / 2 + 10], cMid = [(X.x + Y.x) / 2, Y.y];
  // W から調整されるパスへ
  if (model === '7' || model === '8') s += line(Wb.x, Wb.y + bh / 2, aMid[0] - 4, aMid[1] - 8, 'var(--sig)');
  if (model === '8') s += line(Wb.x - 30, Wb.y + bh / 2, cMid[0] - 60, cMid[1] - 6, 'var(--sig)');
  if (model === '14') s += line(Wb.x, Wb.y + bh / 2, bMid[0] + 4, bMid[1] - 8, 'var(--sig)');
  s += tag(aMid[0] - 34, aMid[1] + 14, o.aTxt) + tag(bMid[0] + 34, bMid[1] + 14, o.bTxt) + tag(cMid[0], cMid[1] + 22, o.cTxt);
  s += box(X, o.xn) + box(M, o.mn, 'var(--accent-soft)') + box(Y, o.yn) + box(Wb, o.wn, 'var(--sig-soft)');
  s += `<text x="10" y="${H - 6}" style="font-size:10.5px">橙の矢印＝調整（W が矢印の効果の強さを変える）。係数は非標準化。実線＝有意、点線＝有意でない。</text>`;
  return s + '</svg>';
}
function condIndPlot(grid, est, lo, hi, wn) { // W の値ごとの条件付き間接効果とブートストラップ 95%CI
  const Wd = 460, H = 280, M = { l: 56, r: 16, t: 34, b: 42 }, yt = niceTicks(Math.min(...lo, 0), Math.max(...hi, 0), 5), xt = niceTicks(grid[0], grid[grid.length - 1], 5);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (Wd - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(Wd, H, M, yt, '条件付き間接効果', fy); xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(5)}</text>`);
  grid.forEach((g, i) => { if (i && (lo[i] > 0 || hi[i] < 0)) s += `<rect x="${fx(grid[i - 1])}" y="${M.t}" width="${fx(g) - fx(grid[i - 1]) + .5}" height="${H - M.t - M.b}" fill="var(--accent-soft)" fill-opacity=".55"/>`; });
  s += `<path d="M${grid.map((g, i) => `${fx(g).toFixed(1)},${fy(hi[i]).toFixed(1)}`).join('L')}L${grid.slice().reverse().map((g, i) => `${fx(g).toFixed(1)},${fy(lo[grid.length - 1 - i]).toFixed(1)}`).join('L')}Z" fill="var(--accent)" fill-opacity=".15"/>`;
  s += `<polyline points="${grid.map((g, i) => `${fx(g).toFixed(1)},${fy(est[i]).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.2"/><line x1="${M.l}" x2="${Wd - M.r}" y1="${fy(0)}" y2="${fy(0)}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  s += `<text x="${Wd - M.r}" y="${H - 6}" text-anchor="end" style="fill:var(--fg)">${esc(wn)}</text><text x="${Wd - M.r}" y="16" text-anchor="end" style="font-size:10.5px">帯＝ブートストラップ 95%CI、色の範囲＝間接効果が有意</text>`;
  return s + '</svg>';
}

ANALYSES.db.modmed = function () {
  const R = state.db.roles, model = state.opt.mmModel || '7', yj = needRole('y', '目的変数（Y）');
  need(R.mx >= 0, '独立変数（X）を選んでください。'); need(R.mw >= 0, '調整変数（W）を選んでください。'); const ms = (R.mm || []).filter(j => j !== yj && j !== R.mx && j !== R.mw); need(ms.length >= 1, '媒介変数（M）を選んでください。');
  need(colType(ms[0]) === 'num' && colType(yj) === 'num', '媒介変数と目的変数は数値の列を選んでください。');
  const Xv = mmVar(R.mx), Wv = mmVar(R.mw), mj = ms[0], Yv = dbCol(yj).map(toNum), Mv = dbCol(mj).map(toNum), C = covCols((R.mcov || []).filter(j => ![yj, R.mx, R.mw, mj].includes(j)));
  const ok = Yv.map((y, i) => isFinite(y) && isFinite(Xv.vals[i]) && isFinite(Wv.vals[i]) && isFinite(Mv[i]) && C.every(c => isFinite(c.vals[i])));
  const f = a => a.filter((_, i) => ok[i]), y = f(Yv), x0 = f(Xv.vals), w0 = f(Wv.vals), m0 = f(Mv), Cs = C.map(c => f(c.vals)), n = y.length, center = state.opt.center !== false;
  need(n >= 10 + Cs.length, '人数が少なすぎます。');
  const xm = center && !Xv.cat ? S.mean(x0) : 0, wm = center && !Wv.cat ? S.mean(w0) : 0, mm = center && model === '14' ? S.mean(m0) : 0;
  const x = x0.map(v => v - xm), w = w0.map(v => v - wm), mc = m0.map(v => v - mm), xw = x.map((v, i) => v * w[i]), mw = mc.map((v, i) => v * w[i]);
  // 回帰式の列（M のモデル、Y のモデル）と、間接効果・直接効果を係数から作る関数
  const spec = { '7': { mCols: [x, w, xw], yCols: [x, m0] }, '8': { mCols: [x, w, xw], yCols: [x, w, xw, m0] }, '14': { mCols: [x], yCols: [x, mc, w, mw] } }[model];
  const ind = (bm, by, wc) => model === '14' ? bm[1] * (by[2] + by[4] * wc) : model === '8' ? (bm[1] + bm[3] * wc) * by[4] : (bm[1] + bm[3] * wc) * by[2];
  const index = (bm, by) => model === '14' ? bm[1] * by[4] : model === '8' ? bm[3] * by[4] : bm[3] * by[2];
  const FM = olsV(m0, [...spec.mCols, ...Cs]), FY = olsV(y, [...spec.yCols, ...Cs]), bm = FM.b, by = FY.b;
  // W の値
  const wsd = S.sd(w0), wVals = Wv.cat ? [[Wv.lv[0], 0], [Wv.lv[1], 1]] : state.opt.wvals === 'pct' ? [['16 パーセンタイル', S.quantile(w0, .16)], ['50 パーセンタイル', S.quantile(w0, .5)], ['84 パーセンタイル', S.quantile(w0, .84)]] : [['平均 − 1SD', S.mean(w0) - wsd], ['平均', S.mean(w0)], ['平均 + 1SD', S.mean(w0) + wsd]];
  const grid = Wv.cat ? [] : Array.from({ length: 41 }, (_, i) => Math.min(...w0) + (Math.max(...w0) - Math.min(...w0)) * i / 40);
  // ブートストラップ
  const B = +state.opt.medBoot || 5000, Rg = rng(20261119), bootIdx = [], bootCond = wVals.map(() => []), bootGrid = grid.map(() => []);
  const solve = (A, v) => { const q = A.length, Mx = A.map((r, i) => [...r, v[i]]); for (let c = 0; c < q; c++) { let p = c; for (let r = c + 1; r < q; r++) if (Math.abs(Mx[r][c]) > Math.abs(Mx[p][c])) p = r; if (Math.abs(Mx[p][c]) < 1e-12) return null; [Mx[c], Mx[p]] = [Mx[p], Mx[c]]; for (let r = 0; r < q; r++) if (r !== c) { const fct = Mx[r][c] / Mx[c][c]; for (let j = c; j <= q; j++) Mx[r][j] -= fct * Mx[c][j]; } } return Mx.map((r, i) => r[q] / r[i]); };
  const coefB = (yv, colsv, idx) => { const q = colsv.length + 1, A = Array.from({ length: q }, () => new Array(q).fill(0)), v = new Array(q).fill(0), row = new Array(q); for (const i of idx) { row[0] = 1; for (let c = 0; c < colsv.length; c++) row[c + 1] = colsv[c][i]; for (let a = 0; a < q; a++) { v[a] += row[a] * yv[i]; for (let b = a; b < q; b++) A[a][b] += row[a] * row[b]; } } for (let a = 0; a < q; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a]; return solve(A, v); };
  // 中心化の平均は元の標本で固定（PROCESS と同じく、ブートストラップ標本ごとに中心化し直さない）
  for (let r = 0; r < B; r++) {
    const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = Math.floor(Rg() * n);
    const b1 = coefB(m0, [...spec.mCols, ...Cs], idx), b2 = b1 && coefB(y, [...spec.yCols, ...Cs], idx); if (!b2) continue;
    bootIdx.push(index(b1, b2)); wVals.forEach(([, wv], q) => bootCond[q].push(ind(b1, b2, wv - wm))); grid.forEach((g, q) => bootGrid[q].push(ind(b1, b2, g - wm)));
  }
  const IX = index(bm, by), IXci = S.sem.bootCI(bootIdx, IX), ex0 = c => c[0] > 0 || c[1] < 0;
  const cond = wVals.map(([l, wv], q) => { const e = ind(bm, by, wv - wm), ci = S.sem.bootCI(bootCond[q], e); return { l, wv, e, ...ci }; });
  // 条件付き直接効果（モデル 8）または直接効果
  const tc = S.qt(.025, FY.df), V = FY.V;
  const direct = model === '8' ? wVals.map(([l, wv]) => { const wc = wv - wm, est = by[1] + by[3] * wc, se = Math.sqrt(V[1][1] + 2 * wc * V[1][3] + wc * wc * V[3][3]); return { l, wv, est, se, p: S.pt2(Math.abs(est / se), FY.df), L: est - tc * se, U: est + tc * se }; }) : [{ l: '（W によらない）', wv: NaN, est: by[1], se: FY.se[1], p: FY.p[1], L: by[1] - tc * FY.se[1], U: by[1] + tc * FY.se[1] }];
  const xn = Xv.name, mn = vn(mj), wn = Wv.name, yn = vn(yj);
  const mNames = model === '14' ? ['切片', xn + '（a）'] : ['切片', xn + '（a1）', wn + '（a2）', `${xn} × ${wn}（a3）`], yNames = { '7': ['切片', xn + '（c′）', mn + '（b）'], '8': ['切片', xn + '（c′1）', wn + '（c′2）', `${xn} × ${wn}（c′3）`, mn + '（b）'], '14': ['切片', xn + '（c′）', mn + '（b1）', wn + '（b2）', `${mn} × ${wn}（b3）`] }[model];
  const where = { '7': `${esc(xn)} → ${esc(mn)}（a パス）`, '8': `${esc(xn)} → ${esc(mn)}（a パス）と ${esc(xn)} → ${esc(yn)}（直接効果）`, '14': `${esc(mn)} → ${esc(yn)}（b パス）` }[model];
  let h = guideBox('調整媒介分析とは（はじめて使う人へ）', [
    ['何がわかるか：', `媒介（${esc(xn)} → ${esc(mn)} → ${esc(yn)}）の<b>強さが、${esc(wn)}によって変わるか</b>を調べます。媒介分析（しくみ）と調整分析（条件）を組み合わせたもので、「誰で・どんなときに、そのしくみが強く働くか」に答えます。`],
    ['このモデル：', `${MM_MODELS[model]}。${esc(wn)}が ${where} の強さを変えると考えます。${model === '7' ? '例：サポートが多い人では、ストレスがあっても自尊感情が下がりにくい（→ 抑うつへの間接効果が弱まる）。' : model === '14' ? '例：サポートが多い人では、自尊感情が低くても抑うつになりにくい（→ 間接効果が弱まる）。' : '例：サポートが、ストレスが自尊感情に与える影響と、ストレスが直接抑うつに与える影響の両方を弱める。'}`],
    ['判定のしかた：', '<b>調整媒介指標（Index of moderated mediation）</b>のブートストラップ 95%信頼区間が 0 を含まなければ、「間接効果の大きさが W によって変わる」＝調整媒介あり、と判断します（Hayes, 2015）。そのうえで、W が低い・平均・高いときの<b>条件付き間接効果</b>を見て、どの範囲で媒介が成り立つかを示します。'],
    ['注意：', '媒介分析と同じく、変数の順序は理論と研究デザインで決まります。まず単純な媒介分析と調整分析で、それぞれの関係を確かめてから使うと理解しやすくなります。']]);
  h += `<p class="note">${MM_MODELS[model]}。X = ${esc(xn)}、M = ${esc(mn)}${ms.length > 1 ? '（媒介変数は最初の 1 つだけを使います）' : ''}、W = ${esc(wn)}、Y = ${esc(yn)}${C.length ? `、共変量 = ${C.map(cv => esc(cv.name)).join('、')}` : ''}、n = ${n}${ok.filter(v => !v).length ? `（欠測のある ${ok.filter(v => !v).length} 行を除外）` : ''}。${center ? `積の項を作る変数（${model === '14' ? 'M と W' : 'X と W'}）は平均で中心化しました。` : ''}ブートストラップ ${bootIdx.length} 回。</p>`;
  const aTxt = model === '14' ? `a = ${c2(bm[1])}${FM.p[1] < .05 ? star(FM.p[1]) : ''}` : `a1 = ${c2(bm[1])}${FM.p[1] < .05 ? star(FM.p[1]) : ''}、a3 = ${c2(bm[3])}${FM.p[3] < .05 ? star(FM.p[3]) : ''}`;
  const bTxt = model === '14' ? `b1 = ${c2(by[2])}、b3 = ${c2(by[4])}${FY.p[4] < .05 ? star(FY.p[4]) : ''}` : `b = ${c2(by[model === '8' ? 4 : 2])}${FY.p[model === '8' ? 4 : 2] < .05 ? star(FY.p[model === '8' ? 4 : 2]) : ''}`;
  const cTxt = model === '8' ? `c′1 = ${c2(by[1])}、c′3 = ${c2(by[3])}${FY.p[3] < .05 ? star(FY.p[3]) : ''}` : `c′ = ${c2(by[1])}${FY.p[1] < .05 ? star(FY.p[1]) : ''}`;
  h += '<h4>モデルの図</h4>' + modMedDiagram(model, { xn, mn, wn, yn, pa: model === '14' ? FM.p[1] : FM.p[3], pb: model === '14' ? FY.p[4] : FY.p[model === '8' ? 4 : 2], pc: model === '8' ? FY.p[3] : FY.p[1], aTxt, bTxt, cTxt });
  const coefTbl = (F, nmz, title) => `<h4>${title}（R² = ${fmt(F.r2, 3)}）</h4>` + table(['', 'B', 'SE', 't', 'p 値', '95%CI'], [...nmz, ...C.map(cv => cv.name)].map((nm1, i) => [esc(nm1), fmt(F.b[i], 3), fmt(F.se[i], 3), fmt(F.t[i], 2), pcell(F.p[i]), `[${fmt(F.b[i] - S.qt(.025, F.df) * F.se[i], 3)}, ${fmt(F.b[i] + S.qt(.025, F.df) * F.se[i], 3)}]`]));
  h += coefTbl(FM, mNames, `媒介変数 ${esc(mn)} を目的変数とするモデル`) + coefTbl(FY, yNames, `目的変数 ${esc(yn)} のモデル`);
  h += '<h4>調整媒介指標（Index of moderated mediation）</h4>' + table(['指標', '推定値', 'Boot SE', '95%CI（パーセンタイル）', '95%CI（バイアス修正）', '判定'], [[`${model === '14' ? 'a × b3' : 'a3 × b'}`, fmt(IX, 4), fmt(IXci.se, 4), `[${fmt(IXci.perc[0], 4)}, ${fmt(IXci.perc[1], 4)}]`, `[${fmt(IXci.bc[0], 4)}, ${fmt(IXci.bc[1], 4)}]`, ex0(IXci.perc) ? '<b>調整媒介あり</b>' : '調整媒介とはいえない']])
    + `<p class="note">調整媒介指標は「W が 1 増えると、間接効果がどれだけ変わるか」を表します${Wv.cat ? `（W が 2 区分なので、「${esc(Wv.lv[1])}」と「${esc(Wv.lv[0])}」の間接効果の差）` : ''}。</p>`;
  h += `<h4>条件付き間接効果（${esc(wn)} の値ごと）</h4>` + table([`${wn} の値`, '', '間接効果', 'Boot SE', '95%CI（パーセンタイル）', '95%CI（バイアス修正）', '判定'], cond.map(c => [esc(c.l), Wv.cat ? '' : fmt(c.wv, 2), fmt(c.e, 3), fmt(c.se, 3), `[${fmt(c.perc[0], 3)}, ${fmt(c.perc[1], 3)}]`, `[${fmt(c.bc[0], 3)}, ${fmt(c.bc[1], 3)}]`, ex0(c.perc) ? '有意' : '有意でない']));
  h += `<h4>${model === '8' ? '条件付き直接効果' : '直接効果'}</h4>` + table([model === '8' ? `${wn} の値` : '', '直接効果 c′', 'SE', 'p 値', '95%CI'], direct.map(d => [esc(d.l), fmt(d.est, 3), fmt(d.se, 3), pcell(d.p), `[${fmt(d.L, 3)}, ${fmt(d.U, 3)}]`]));
  if (!Wv.cat) {
    const est = grid.map(g => ind(bm, by, g - wm)), lo = bootGrid.map(b => S.sem.normInter(b, [.025])[0]), hi = bootGrid.map(b => S.sem.normInter(b, [.975])[0]);
    h += `<div class="figrow">${condIndPlot(grid, est, lo, hi, wn)}</div><p class="note">${esc(wn)}の値ごとの条件付き間接効果。帯が 0 の点線にかからない範囲で、媒介効果が有意です。</p>`;
  }
  const sigC = cond.filter(c => ex0(c.perc));
  h += interp(ex0(IXci.perc) ? `調整媒介指標は ${fmt(IX, 3)}（95%CI [${fmt(IXci.perc[0], 3)}, ${fmt(IXci.perc[1], 3)}]）で、信頼区間が 0 を含まないので<b>調整媒介が認められます</b>。${esc(mn)}を通した間接効果の大きさは、${esc(wn)}によって変わります（${esc(wn)}が${Wv.cat ? `「${esc(Wv.lv[1])}」のほうが` : '高いほど'}間接効果が${Math.abs(cond[cond.length - 1].e) < Math.abs(cond[0].e) ? '弱く（0 に近く）' : '強く'}なります）。` : `調整媒介指標の信頼区間は 0 を含み（[${fmt(IXci.perc[0], 3)}, ${fmt(IXci.perc[1], 3)}]）、間接効果の大きさが${esc(wn)}によって変わるとはいえません。この場合は、W を含めない単純な媒介分析の結果を報告するのが一般的です。`,
    `条件付き間接効果：${cond.map(c => `${esc(wn)} が${Wv.cat ? `「${esc(c.l)}」` : c.l}のとき ${fmt(c.e, 3)}（${ex0(c.perc) ? '有意' : '有意でない'}）`).join('、')}。${sigC.length && sigC.length < cond.length ? `媒介効果が成り立つのは、${sigC.map(c => Wv.cat ? `「${esc(c.l)}」` : c.l).join('・')}のときに限られます。` : ''}`,
    model === '8' ? `直接効果も W によって変わるかは、${esc(xn)} × ${esc(wn)} の係数（c′3 = ${fmt(by[3], 3)}, ${pTxt(FY.p[3])}）で判断します。` : `直接効果 c′ = ${fmt(by[1], 3)}（${pTxt(FY.p[1])}）。`,
    '論文では、調整媒介指標とその信頼区間、W の代表値（−1SD・平均・+1SD など）での条件付き間接効果と信頼区間を報告します。');
  h += apa('論文記載例', `${esc(wn)}が${esc(xn)}から${esc(mn)}を介して${esc(yn)}に至る媒介効果を調整するかを検討するため、調整媒介分析（PROCESS ${MM_MODELS[model].split('（')[0].replace('モデル ', 'Model ')} に相当、ブートストラップ ${bootIdx.length} 回）を行った。調整媒介指標は${ex0(IXci.perc) ? '有意であった' : '有意ではなかった'}（<i>index</i> = ${fmt(IX, 3)}, 95% CI [${fmt(IXci.perc[0], 3)}, ${fmt(IXci.perc[1], 3)}]）。${cond.map(c => `${esc(wn)}が${Wv.cat ? `「${esc(c.l)}」` : `${c.l}`}の場合の条件付き間接効果は ${fmt(c.e, 2)}（95% CI [${fmt(c.perc[0], 2)}, ${fmt(c.perc[1], 2)}]）`).join('、')}であった。`);
  return { title: `調整媒介分析（${MM_MODELS[model].split('（')[0]}：${xn} → ${mn} → ${yn}、W = ${wn}）`, html: h };
};
