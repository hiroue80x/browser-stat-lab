// ===== 媒介分析（PROCESS モデル 4 に相当）と調整分析（モデル 1 に相当） =====
function makeMedModSample() { // 例として入っている架空データ（大学生 200 人：ストレス → 自尊感情 → 抑うつ、ソーシャルサポートの緩衝効果）
  const R = rng(31415), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [];
  for (let i = 0; i < 200; i++) {
    const st = nrm(), sup = nrm(), sex = R() < .55 ? '女性' : '男性', age = 18 + Math.floor(R() * 5);
    const se = -.45 * st + .25 * sup + .2 * st * sup + .8 * nrm(), rum = .25 * st - .45 * se + .8 * nrm(), dep = .25 * st - .3 * se + .3 * rum - .15 * sup - .25 * st * sup + .65 * nrm();
    rows.push([String(i + 1), sex, String(age), String(Math.round(25 + 6 * st)), String(Math.round(30 + 5 * sup)), String(Math.round(32 + 5 * se)), String(Math.round(18 + 6 * dep)), String(Math.round(20 + 5 * rum))]);
  }
  return { cols: ['ID', '性別', '年齢', 'ストレス', 'サポート', '自尊感情', '抑うつ', '反すう'].map(n => ({ name: n, on: true })), rows, roles: { y: 6, a: 1, b: -1, x: [], rep: [], fa: [], bin: -1, event: '', roc: [], cov: [], time: -1, st: -1, stev: '', mx: 3, mm: [5], mw: 4, mcov: [] } };
}
state.opt.medBoot = state.opt.medBoot || '5000'; state.opt.wvals = state.opt.wvals || 'sd';

function olsV(y, cols) { const X = y.map((_, i) => [1, ...cols.map(c => c[i])]), f = S.ols(X, y), mse = f.sse / f.df; const V = f.inv.map(r => r.map(v => v * mse)), se = V.map((r, i) => Math.sqrt(r[i])), sst = S.sum(y.map(v => (v - S.mean(y)) ** 2)); return { ...f, V, se, mse, r2: 1 - f.sse / sst, t: f.b.map((b, i) => b / se[i]), p: f.b.map((b, i) => S.pt2(Math.abs(b / se[i]), f.df)) }; }
function mmVar(j) { // 数値はそのまま、2 区分の文字列は 0/1 に
  const v = dbCol(j); if (colType(j) === 'num') return { name: vn(j), vals: v.map(toNum), cat: false };
  const lv = levelsOf(v); need(lv.length === 2, `${vn(j)}は数値か 2 区分の列にしてください（3 区分以上の要因は「調整変数」で使えます）。`);
  return { name: `${vn(j)}（${lv[1]} = 1, ${lv[0]} = 0）`, vals: v.map(u => u === '' ? NaN : +(u === lv[1])), cat: true, lv };
}
function covCols(js) { const out = []; js.forEach(j => { const v = dbCol(j); if (colType(j) === 'num') out.push({ name: vn(j), vals: v.map(toNum) }); else levelsOf(v).slice(1).forEach(l => out.push({ name: `${vn(j)}: ${l}`, vals: v.map(u => u === '' ? NaN : +(u === l)) })); }); return out; }

// ---- 図 ----
function medDiagram(o) { // o: { xn, yn, ms: [{name, a, pa, b, pb}], c, pc, cp, pcp }
  const k = o.ms.length, W = 620, H = 166 + k * 70, bw = 130, bh = 40, X = { x: 90, y: H - 66 }, Y = { x: W - 90, y: H - 66 };
  const col = p => p < .05 ? 'var(--accent)' : 'var(--muted)', lab = (v, p) => `${c2(v)}${p < .05 ? star(p) : ''}`;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:640px"><defs><marker id="mda" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--fg)"/></marker></defs>`;
  const box = (p, t, fill) => `<rect x="${p.x - bw / 2}" y="${p.y - bh / 2}" width="${bw}" height="${bh}" rx="4" fill="${fill || 'var(--sheet)'}" stroke="var(--fg)" stroke-width="1.4"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" style="fill:var(--fg);font-size:13px">${esc(t.length > 10 ? t.slice(0, 10) + '…' : t)}</text>`;
  const arrow = (x1, y1, x2, y2, txt, c, dash, off = -8) => { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.8" ${dash ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#mda)"/><rect x="${mx - tw(txt) / 2 - 4}" y="${my + off - 13}" width="${tw(txt) + 8}" height="17" rx="3" fill="var(--sheet)"/><text x="${mx}" y="${my + off}" text-anchor="middle" style="fill:var(--fg);font-size:12px">${txt}</text>`; };
  o.ms.forEach((m, i) => { const M = { x: W / 2, y: 40 + i * 70 };
    s += arrow(X.x + 20, X.y - bh / 2, M.x - bw / 2, M.y + 6, `a${k > 1 ? i + 1 : ''} = ${lab(m.a, m.pa)}`, col(m.pa), m.pa >= .05);
    s += arrow(M.x + bw / 2, M.y + 6, Y.x - 20, Y.y - bh / 2, `b${k > 1 ? i + 1 : ''} = ${lab(m.b, m.pb)}`, col(m.pb), m.pb >= .05);
    s += box(M, m.name, 'var(--accent-soft)'); });
  s += arrow(X.x + bw / 2, X.y, Y.x - bw / 2, Y.y, `c′ = ${lab(o.cp, o.pcp)}（c = ${lab(o.c, o.pc)}）`, col(o.pcp), o.pcp >= .05, 18);
  s += box(X, o.xn) + box(Y, o.yn);
  s += `<text x="10" y="${H - 22}" style="font-size:10.5px">数値は非標準化係数。実線＝有意（p < .05）、点線＝有意でない。* p < .05、** p < .01、*** p < .001。</text><text x="10" y="${H - 7}" style="font-size:10.5px">c は直接＋間接を合わせた総合効果、c′ は媒介変数を統制した直接効果。</text>`;
  return s + '</svg>';
}
function conceptDiagrams() { // タブの説明用：媒介と調整の考え方の図
  const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--fg)" stroke-width="1.6" marker-end="url(#cda)"/>`, bx = (x, y, t, f) => `<rect x="${x - 46}" y="${y - 16}" width="92" height="32" rx="4" fill="${f || 'var(--sheet)'}" stroke="var(--fg)"/><text x="${x}" y="${y + 5}" text-anchor="middle" style="fill:var(--fg);font-size:12px">${t}</text>`;
  const defs = '<defs><marker id="cda" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--fg)"/></marker></defs>';
  return `<div class="figrow concept"><svg viewBox="0 0 300 150" style="max-width:300px">${defs}<text x="150" y="16" text-anchor="middle" style="fill:var(--fg);font-weight:600;font-size:13px">媒介：X が M を通して Y に影響する</text>${bx(150, 50, 'M（媒介）', 'var(--accent-soft)')}${bx(55, 120, 'X（原因）')}${bx(245, 120, 'Y（結果）')}${ar(80, 104, 120, 66)}${ar(180, 66, 220, 104)}${ar(101, 120, 199, 120)}<text x="150" y="142" text-anchor="middle" style="font-size:10.5px">例：ストレス → 自尊感情の低下 → 抑うつ</text></svg>
    <svg viewBox="0 0 300 150" style="max-width:300px">${defs}<text x="150" y="16" text-anchor="middle" style="fill:var(--fg);font-weight:600;font-size:13px">調整：W によって X → Y の強さが変わる</text>${bx(150, 50, 'W（調整）', 'var(--sig-soft)')}${bx(55, 112, 'X（原因）')}${bx(245, 112, 'Y（結果）')}${ar(101, 112, 199, 112)}${ar(150, 66, 150, 109)}<text x="150" y="142" text-anchor="middle" style="font-size:10.5px">例：サポートが多い人ほど ストレス → 抑うつ が弱い</text></svg></div>`;
}
function jnPlot(zs, eff, zn, xn, jn) { // 調整変数の値ごとの X の効果（条件付き効果）と 95%CI
  const W = 460, H = 280, M = { l: 54, r: 16, t: 34, b: 42 }, lo = Math.min(...eff.map(e => e.L), 0), hi = Math.max(...eff.map(e => e.U), 0), yt = niceTicks(lo, hi, 5), xt = niceTicks(zs[0], zs[zs.length - 1], 5);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, `${xn} の効果（傾き）`, fy);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(5)}</text>`);
  zs.forEach((z, i) => { if (i && (eff[i].L > 0 || eff[i].U < 0)) s += `<rect x="${fx(zs[i - 1])}" y="${M.t}" width="${fx(z) - fx(zs[i - 1]) + .5}" height="${H - M.t - M.b}" fill="var(--accent-soft)" fill-opacity=".55"/>`; });
  s += `<path d="M${zs.map((z, i) => `${fx(z).toFixed(1)},${fy(eff[i].U).toFixed(1)}`).join('L')}L${zs.slice().reverse().map((z, i) => `${fx(z).toFixed(1)},${fy(eff[zs.length - 1 - i].L).toFixed(1)}`).join('L')}Z" fill="var(--accent)" fill-opacity=".15"/>`;
  s += `<polyline points="${zs.map((z, i) => `${fx(z).toFixed(1)},${fy(eff[i].est).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.2"/><line x1="${M.l}" x2="${W - M.r}" y1="${fy(0)}" y2="${fy(0)}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  (jn || []).forEach(v => { if (v >= xt[0] && v <= xt[xt.length - 1]) s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--sig)" stroke-dasharray="4 3"/><text x="${fx(v) + 3}" y="${M.t + 11}" style="fill:var(--sig);font-size:10.5px">${fmt(v, 2)}</text>`; });
  s += `<text x="${W - M.r}" y="${H - 6}" text-anchor="end" style="fill:var(--fg)">${esc(zn)}</text><text x="${W - M.r}" y="16" text-anchor="end" style="font-size:10.5px">帯＝95%CI、色の範囲＝傾きが有意</text>`;
  return s + '</svg>';
}
const guideBox = (title, items) => `<details class="guide" open><summary>${title}</summary>${items.map(([h, t]) => `<p><b>${h}</b>${t}</p>`).join('')}</details>`;

// ---- 媒介分析 ----
ANALYSES.db.med = function () {
  const R = state.db.roles, yj = needRole('y', '目的変数（Y）'); need(R.mx >= 0, '独立変数（X）を選んでください。'); const ms = (R.mm || []).filter(j => j !== yj && j !== R.mx); need(ms.length >= 1, '媒介変数（M）を 1 つ以上選んでください。'); need(ms.length <= 3, '媒介変数は 3 つまでにしてください。');
  need(ms.every(j => colType(j) === 'num'), '媒介変数は数値の列を選んでください。'); need(colType(yj) === 'num', '目的変数は数値の列を選んでください。');
  const Xv = mmVar(R.mx), Yv = dbCol(yj).map(toNum), Mv = ms.map(j => dbCol(j).map(toNum)), C = covCols((R.mcov || []).filter(j => ![yj, R.mx, ...ms].includes(j)));
  const ok = Yv.map((y, i) => isFinite(y) && isFinite(Xv.vals[i]) && Mv.every(m => isFinite(m[i])) && C.every(c => isFinite(c.vals[i])));
  const f = a => a.filter((_, i) => ok[i]), y = f(Yv), x = f(Xv.vals), Ms = Mv.map(f), Cs = C.map(c => f(c.vals)), n = y.length, k = ms.length; need(n >= k + C.length + 5, '人数が少なすぎます。');
  const fitAll = (idx) => { const pick = a => idx ? idx.map(i => a[i]) : a, yy = pick(y), xx = pick(x), mm = Ms.map(pick), cc = Cs.map(pick);
    const am = mm.map(m => olsV(m, [xx, ...cc])), ym = olsV(yy, [xx, ...mm, ...cc]), tm = olsV(yy, [xx, ...cc]); return { am, ym, tm, sx: S.sd(xx), sy: S.sd(yy) }; };
  const F = fitAll(null), a = F.am.map(m => m.b[1]), b = F.ym.b.slice(2, 2 + k), ind = a.map((v, j) => v * b[j]), tot = S.sum(ind), cp = F.ym.b[1], c = F.tm.b[1];
  const B = +state.opt.medBoot || 5000, Rg = rng(20261118), boots = [];
  // ブートストラップは係数だけを高速に計算（正規方程式を直接解く）
  const solve = (A, v) => { const m = A.length, M = A.map((r, i) => [...r, v[i]]); for (let c = 0; c < m; c++) { let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < m; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= m; j++) M[r][j] -= f * M[c][j]; } } return M.map((r, i) => r[m] / r[i]); };
  const coefB = (yv, colsv, idx) => { const q = colsv.length + 1, A = Array.from({ length: q }, () => new Array(q).fill(0)), v = new Array(q).fill(0), row = new Array(q); for (const i of idx) { row[0] = 1; for (let c = 0; c < colsv.length; c++) row[c + 1] = colsv[c][i]; for (let a2 = 0; a2 < q; a2++) { v[a2] += row[a2] * yv[i]; for (let b2 = a2; b2 < q; b2++) A[a2][b2] += row[a2] * row[b2]; } } for (let a2 = 0; a2 < q; a2++) for (let b2 = 0; b2 < a2; b2++) A[a2][b2] = A[b2][a2]; return solve(A, v); };
  const sdIdx = (v, idx) => { let m = 0; for (const i of idx) m += v[i]; m /= idx.length; let ss = 0; for (const i of idx) ss += (v[i] - m) ** 2; return Math.sqrt(ss / (idx.length - 1)); };
  for (let r = 0; r < B; r++) {
    const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = Math.floor(Rg() * n);
    const bY = coefB(y, [x, ...Ms, ...Cs], idx); if (!bY) continue; const ia = []; let bad = false;
    for (let j = 0; j < k; j++) { const bM = coefB(Ms[j], [x, ...Cs], idx); if (!bM) { bad = true; break; } ia.push(bM[1] * bY[2 + j]); }
    if (bad) continue; const sx = sdIdx(x, idx), sy = sdIdx(y, idx), st = S.sum(ia);
    boots.push([...ia, st, ...ia.map(v => v * sx / sy), st * sx / sy]);
  }
  const ci = q => S.sem.bootCI(boots.map(r => r[q]), q < k ? ind[q] : q === k ? tot : q < 2 * k + 1 ? ind[q - k - 1] * F.sx / F.sy : tot * F.sx / F.sy);
  const indCI = ind.map((_, j) => ci(j)), totCI = ci(k), stdCI = ind.map((_, j) => ci(k + 1 + j)), stdTot = ci(2 * k + 1), ex0 = cc => cc[0] > 0 || cc[1] < 0;
  const sobel = a.map((av, j) => { const sa = F.am[j].se[1], sb = F.ym.se[2 + j], se = Math.sqrt(b[j] ** 2 * sa ** 2 + av ** 2 * sb ** 2), z = av * b[j] / se; return { z, p: 2 * S.pnU(Math.abs(z)) }; });
  const mn = ms.map(j => vn(j)), xn = Xv.name, yn = vn(yj), pct = v => fmt(v * 100, 1) + '%';
  let h = guideBox('媒介分析とは（はじめて使う人へ）', [
    ['何がわかるか：', `「${esc(xn)}が${esc(yn)}に影響するのは、${esc(mn.join('・'))}を通してなのか」という<b>しくみ（プロセス）</b>を調べます。X が M を変え、その M が Y を変える、という道筋の強さが「間接効果」です。`],
    ['3 つの効果：', '<b>総合効果 c</b>＝X が Y に与える全体の影響。<b>直接効果 c′</b>＝M を経由しない分。<b>間接効果 a×b</b>＝M を経由する分。c ＝ c′ ＋ a×b が成り立ちます。'],
    ['判定のしかた：', '間接効果のブートストラップ 95%信頼区間が <b>0 を含まなければ</b>、媒介効果は有意です。昔の「Baron & Kenny の 4 ステップ」や Sobel 検定より、現在はこの方法が標準です（総合効果 c が有意でなくても、間接効果が有意なことがあります）。'],
    ['注意：', '媒介分析は「X が先、M が次、Y が最後」という<b>時間の順序や理論</b>が前提です。同時に測った調査データだけでは因果の向きは決められないので、「媒介モデルと整合的」と控えめに書きます。']]);
  h += `<p class="note">X = ${esc(xn)}、M = ${esc(mn.join('、'))}、Y = ${esc(yn)}${C.length ? `、共変量 = ${C.map(cv => esc(cv.name)).join('、')}` : ''}、n = ${n}${ok.filter(v => !v).length ? `（欠測のある ${ok.filter(v => !v).length} 行を除外）` : ''}。ブートストラップ ${boots.length} 回（パーセンタイル法とバイアス修正法）。</p>`;
  h += '<h4>パス図</h4>' + medDiagram({ xn, yn, ms: mn.map((name, j) => ({ name, a: a[j], pa: F.am[j].p[1], b: b[j], pb: F.ym.p[2 + j] })), c, pc: F.tm.p[1], cp, pcp: F.ym.p[1] });
  const rowsOf = (lab, m, idx) => idx.map(([i, nm0]) => [lab, nm0, fmt(m.b[i], 3), fmt(m.se[i], 3), fmt(m.t[i], 2), pcell(m.p[i])]);
  h += '<h4>回帰分析の結果（各パス）</h4>' + table(['目的変数', '説明変数', 'B', 'SE', 't', 'p 値'], [
    ...F.am.flatMap((m, j) => rowsOf(`${esc(mn[j])}（a パス、R² = ${fmt(m.r2, 3)}）`, m, [[1, esc(xn)], ...C.map((cv, q) => [2 + q, esc(cv.name)])])),
    ...rowsOf(`${esc(yn)}（b・c′ パス、R² = ${fmt(F.ym.r2, 3)}）`, F.ym, [[1, esc(xn) + '（c′）'], ...mn.map((m0, j) => [2 + j, esc(m0) + `（b${k > 1 ? j + 1 : ''}）`]), ...C.map((cv, q) => [2 + k + q, esc(cv.name)])]),
    ...rowsOf(`${esc(yn)}（総合効果 c、R² = ${fmt(F.tm.r2, 3)}）`, F.tm, [[1, esc(xn) + '（c）']])]);
  h += '<h4>総合効果・直接効果・間接効果</h4>' + table(['効果', '推定値', 'SE', '95%CI', 'p 値', '判定'], [
    ['総合効果 c', fmt(c, 3), fmt(F.tm.se[1], 3), `[${fmt(c - S.qt(.025, F.tm.df) * F.tm.se[1], 3)}, ${fmt(c + S.qt(.025, F.tm.df) * F.tm.se[1], 3)}]`, pcell(F.tm.p[1]), F.tm.p[1] < .05 ? '有意' : '有意でない'],
    ['直接効果 c′', fmt(cp, 3), fmt(F.ym.se[1], 3), `[${fmt(cp - S.qt(.025, F.ym.df) * F.ym.se[1], 3)}, ${fmt(cp + S.qt(.025, F.ym.df) * F.ym.se[1], 3)}]`, pcell(F.ym.p[1]), F.ym.p[1] < .05 ? '有意' : '有意でない'],
    ...ind.map((v, j) => [`間接効果（${esc(mn[j])} 経由）a×b`, fmt(v, 3), fmt(indCI[j].se, 3) + '（Boot）', `[${fmt(indCI[j].perc[0], 3)}, ${fmt(indCI[j].perc[1], 3)}]`, '—', ex0(indCI[j].perc) ? '<b>有意</b>' : '有意でない']),
    ...(k > 1 ? [['間接効果の合計', fmt(tot, 3), fmt(totCI.se, 3) + '（Boot）', `[${fmt(totCI.perc[0], 3)}, ${fmt(totCI.perc[1], 3)}]`, '—', ex0(totCI.perc) ? '<b>有意</b>' : '有意でない']] : [])]);
  h += table(['間接効果', 'バイアス修正法 95%CI', '完全標準化 a×b（Boot 95%CI）', 'Sobel 検定（参考）', '媒介の割合（間接 ÷ 総合）'], ind.map((v, j) => [esc(mn[j]), `[${fmt(indCI[j].bc[0], 3)}, ${fmt(indCI[j].bc[1], 3)}]`, `${fmt(v * F.sx / F.sy, 3)} [${fmt(stdCI[j].perc[0], 3)}, ${fmt(stdCI[j].perc[1], 3)}]`, `z = ${fmt(sobel[j].z, 2)}, p ${sobel[j].p < .001 ? '< .001' : '= ' + fp(sobel[j].p)}`, Math.sign(v) === Math.sign(c) && Math.abs(c) > 1e-9 ? pct(v / c) : '—（符号が逆など）']));
  h += `<p class="note">c（${fmt(c, 4)}）＝ c′（${fmt(cp, 4)}）＋ 間接効果の合計（${fmt(tot, 4)}）が成り立っています。完全標準化間接効果は、X と Y を標準化したときの間接効果で、効果の大きさの目安になります。</p>`;
  const sigInd = ind.map((v, j) => j).filter(j => ex0(indCI[j].perc));
  h += interp(sigInd.length ? `${sigInd.map(j => `${esc(mn[j])}を経由する間接効果は ${fmt(ind[j], 3)} で、ブートストラップ 95%信頼区間 [${fmt(indCI[j].perc[0], 3)}, ${fmt(indCI[j].perc[1], 3)}] が 0 を含まないので有意です。つまり、${esc(xn)}が${a[j] > 0 ? '高い' : '低い'}ほど${esc(mn[j])}が${a[j] > 0 ? '高く' : '低く'}なり（a = ${fmt(a[j], 2)}）、その${esc(mn[j])}が${b[j] > 0 ? '高い' : '低い'}ほど${esc(yn)}が高くなる（b = ${fmt(b[j], 2)}）、という道筋が支持されます。`).join('')}` : `間接効果のブートストラップ信頼区間はどれも 0 を含み、${esc(mn.join('・'))}による媒介効果は有意ではありません。`,
    sigInd.length ? (F.ym.p[1] < .05 ? `直接効果 c′ も有意（${pTxt(F.ym.p[1])}）なので、${esc(xn)}の影響の一部は媒介変数を通り、残りは直接（またはモデルにない別の経路で）伝わっている「部分媒介」の形です。` : `直接効果 c′ は有意ではない（${pTxt(F.ym.p[1])}）ので、${esc(xn)}の影響は主に媒介変数を通して伝わっている「完全媒介」に近い形です（ただし「完全」という言葉は、検出力や他の媒介変数の可能性があるので慎重に使います）。`) : (F.tm.p[1] < .05 ? `総合効果 c は有意（${pTxt(F.tm.p[1])}）で、${esc(xn)}は${esc(yn)}に影響していますが、その影響は${esc(mn.join('・'))}を通したものではありません。` : ''),
    k > 1 ? '媒介変数を複数入れた（並列媒介）場合、それぞれの間接効果は「ほかの媒介変数を統制したうえでの」効果です。' : '',
    '論文では、間接効果の推定値とブートストラップ信頼区間、ブートストラップの回数を報告するのが一般的です。');
  h += apa('論文記載例', `${esc(xn)}が${esc(mn.join('・'))}を介して${esc(yn)}に影響するかを検討するため、媒介分析（ブートストラップ法、${boots.length} 回）を行った。${sigInd.length ? sigInd.map(j => `${esc(mn[j])}を介した間接効果は有意であった（<i>ab</i> = ${fmt(ind[j], 2)}, 95% CI [${fmt(indCI[j].perc[0], 2)}, ${fmt(indCI[j].perc[1], 2)}]）`).join('。') + '。' : '有意な間接効果は認められなかった。'}直接効果は${F.ym.p[1] < .05 ? '有意であった' : '有意ではなかった'}（<i>c′</i> = ${fmt(cp, 2)}, ${apaP(F.ym.p[1])}）。`);
  return { title: `媒介分析（${xn} → ${mn.join('・')} → ${yn}）`, html: h };
};

// ---- 調整分析 ----
ANALYSES.db.mod = function () {
  const R = state.db.roles, yj = needRole('y', '目的変数（Y）'); need(R.mx >= 0, '独立変数（X）を選んでください。'); need(R.mw >= 0, '調整変数（W）を選んでください。'); need(R.mw !== R.mx, 'X と W には別の列を選んでください。'); need(colType(yj) === 'num', '目的変数は数値の列を選んでください。');
  const Xv = mmVar(R.mx), Yv = dbCol(yj).map(toNum), wCat = colType(R.mw) === 'cat', Wraw = dbCol(R.mw), wl = wCat ? levelsOf(Wraw) : null; if (wCat) need(wl.length >= 2 && wl.length <= 6, '調整変数（カテゴリ）は 2〜6 区分にしてください。');
  const C = covCols((R.mcov || []).filter(j => ![yj, R.mx, R.mw].includes(j))), Wn = wCat ? Wraw : Wraw.map(toNum);
  const ok = Yv.map((y, i) => isFinite(y) && isFinite(Xv.vals[i]) && (wCat ? Wraw[i] !== '' : isFinite(Wn[i])) && C.every(c => isFinite(c.vals[i])));
  const f = a => a.filter((_, i) => ok[i]), y = f(Yv), x0 = f(Xv.vals), w0 = f(Wn), Cs = C.map(c => f(c.vals)), n = y.length, center = state.opt.center !== false;
  const xm = center && !Xv.cat ? S.mean(x0) : 0, x = x0.map(v => v - xm), xn = Xv.name, yn = vn(yj), wn = vn(R.mw);
  let wc, wnames, wm = 0; if (wCat) { wc = wl.slice(1).map(l => w0.map(v => +(v === l))); wnames = wl.slice(1).map(l => `${wn}: ${l}`); } else { wm = center ? S.mean(w0) : 0; wc = [w0.map(v => v - wm)]; wnames = [wn + (center ? '（中心化）' : '')]; }
  const inter = wc.map(c => x.map((v, i) => v * c[i])), base = olsV(y, [x, ...wc, ...Cs]), full = olsV(y, [x, ...wc, ...inter, ...Cs]);
  const q = wc.length, dR2 = full.r2 - base.r2, dF = dR2 / q / ((1 - full.r2) / full.df), pInt = S.pfU(dF, q, full.df), b = full.b, V = full.V, tc = S.qt(.025, full.df);
  const names = ['切片', xn + (center && !Xv.cat ? '（中心化）' : ''), ...wnames, ...wnames.map(w => `${xn} × ${w}`), ...C.map(cv => cv.name)];
  const condAt = vec => { const est = vec.reduce((s, v, i) => s + v * b[i], 0); let vv = 0; vec.forEach((p, i) => vec.forEach((r, j) => vv += p * V[i][j] * r)); const se = Math.sqrt(vv), t = est / se; return { est, se, t, p: S.pt2(Math.abs(t), full.df), L: est - tc * se, U: est + tc * se }; };
  const P = 1 + 1 + 2 * q + Cs.length, vecFor = wvals => { const v = new Array(P).fill(0); v[1] = 1; wvals.forEach((wv, j) => v[2 + q + j] = wv); return v; };
  let h = guideBox('調整分析とは（はじめて使う人へ）', [
    ['何がわかるか：', `「${esc(xn)}が${esc(yn)}に与える影響の強さは、${esc(wn)}によって変わるか」を調べます。たとえば「ストレスは抑うつを高めるが、サポートが多い人ではその影響が弱い（緩衝効果）」のような<b>条件つきの効果</b>です。`],
    ['しくみ：', `重回帰分析に <b>X × W の交互作用項</b>を加え、その係数が有意なら「調整効果あり」とします。X と W を平均で<b>中心化</b>しておくと、X の係数を「W が平均の人での X の効果」と読めます。`],
    ['調整効果があったら：', `<b>単純傾斜</b>（W が低い・平均・高いときの X の傾き）と <b>Johnson-Neyman 法</b>（X の効果が有意になる W の範囲）で、どんな人で効果が強いかを具体的に示します。`],
    ['媒介との違い：', '媒介は「なぜ（どんな道筋で）効くか」、調整は「いつ・誰に効くか」を問います。W は X の結果として変わる変数ではなく、X とは別に人がもともと持つ特徴（性格・性別・環境など）であることが多いです。']]);
  h += `<p class="note">X = ${esc(xn)}、W = ${esc(wn)}${wCat ? `（${wl.map(esc).join('・')}、基準 = ${esc(wl[0])}）` : ''}、Y = ${esc(yn)}${C.length ? `、共変量 = ${C.map(cv => esc(cv.name)).join('、')}` : ''}、n = ${n}${ok.filter(v => !v).length ? `（欠測のある ${ok.filter(v => !v).length} 行を除外）` : ''}。${center ? '数値の X と W は平均で中心化してから積を作りました。' : '中心化していません。'}</p>`;
  h += '<h4>回帰分析の結果（交互作用モデル）</h4>' + table(['', 'B', 'SE', 't', 'p 値', '95%CI'], names.map((nm0, i) => [esc(nm0), fmt(b[i], 3), fmt(full.se[i], 3), fmt(full.t[i], 2), pcell(full.p[i]), `[${fmt(b[i] - tc * full.se[i], 3)}, ${fmt(b[i] + tc * full.se[i], 3)}]`]))
    + table(['モデル', 'R²', 'ΔR²（交互作用）', 'F', '自由度', 'p 値'], [['交互作用なし', fmt(base.r2, 3), '', '', '', ''], ['交互作用あり', fmt(full.r2, 3), { v: fmt(dR2, 3), cls: pInt < .05 ? 'sig' : '' }, fmt(dF, 2), `${q}, ${full.df}`, pcell(pInt)]]);
  let simp, jn = [], figs = '';
  if (!wCat) {
    const wsd = S.sd(wc[0]), wsrc = w0, pts = state.opt.wvals === 'pct' ? [['16 パーセンタイル', S.quantile(wsrc, .16)], ['50 パーセンタイル', S.quantile(wsrc, .5)], ['84 パーセンタイル', S.quantile(wsrc, .84)]] : [['平均 − 1SD', S.mean(wsrc) - wsd], ['平均', S.mean(wsrc)], ['平均 + 1SD', S.mean(wsrc) + wsd]];
    simp = pts.map(([l, raw]) => ({ l, raw, ...condAt(vecFor([raw - wm])) }));
    const b1 = b[1], b3 = b[2 + q], A = b3 * b3 - tc * tc * V[2 + q][2 + q], Bq = 2 * (b1 * b3 - tc * tc * V[1][2 + q]), Cq = b1 * b1 - tc * tc * V[1][1], disc = Bq * Bq - 4 * A * Cq;
    jn = disc >= 0 && Math.abs(A) > 1e-12 ? [(-Bq - Math.sqrt(disc)) / (2 * A), (-Bq + Math.sqrt(disc)) / (2 * A)].sort((u, v) => u - v).map(v => v + wm) : [];
    const wmin = Math.min(...wsrc), wmax = Math.max(...wsrc), grid = Array.from({ length: 61 }, (_, i) => wmin + (wmax - wmin) * i / 60), eff = grid.map(g => condAt(vecFor([g - wm])));
    const inRange = jn.filter(v => v >= wmin && v <= wmax), sigMid = condAt(vecFor([(wmin + wmax) / 2 - wm])).p < .05;
    h += `<h4>単純傾斜の分析（${esc(wn)} の値ごとの ${esc(xn)} の効果）</h4>` + table([`${wn} の値`, '', `${xn} の傾き`, 'SE', 't', 'p 値', '95%CI'], simp.map(r => [r.l, fmt(r.raw, 2), fmt(r.est, 3), fmt(r.se, 3), fmt(r.t, 2), pcell(r.p), `[${fmt(r.L, 3)}, ${fmt(r.U, 3)}]`]));
    const jnTxt = inRange.length ? `${esc(xn)}の効果が有意になるのは、${esc(wn)}が ${A > 0 ? (inRange.length === 2 ? `${fmt(inRange[0], 2)} 未満、または ${fmt(inRange[1], 2)} より大きいとき` : (condAt(vecFor([wmin - wm])).p < .05 ? `${fmt(inRange[0], 2)} 未満のとき` : `${fmt(inRange[0], 2)} より大きいとき`)) : `${fmt(inRange[0], 2)} から ${fmt(inRange[inRange.length - 1], 2)} の範囲`}です（観測範囲 ${fmt(wmin, 2)}〜${fmt(wmax, 2)}、全体の ${fmt(eff.filter(e => e.p < .05).length / eff.length * 100, 0)}%）。` : `観測された${esc(wn)}の範囲（${fmt(wmin, 2)}〜${fmt(wmax, 2)}）では、${esc(xn)}の効果は${sigMid ? 'どこでも有意' : 'どこでも有意ではありません'}。`;
    h += `<p class="note"><b>Johnson-Neyman 法：</b>${jnTxt}</p>`;
    const xr = x0, xlo = Math.min(...xr), xhi = Math.max(...xr), cm = Cs.map(cc => S.mean(cc)), pred = (xv, wv) => { const vec = [1, xv - xm, wv - wm, (xv - xm) * (wv - wm), ...cm]; return vec.reduce((s, v, i) => s + v * b[i], 0); };
    figs = `<div class="figrow">${diagPlot(xr, y, { xn, yn, title: `単純傾斜（${wn} の高さ別）`, curves: simp.map((r, i) => ({ pts: [[xlo, pred(xlo, r.raw)], [xhi, pred(xhi, r.raw)]], col: GC[i % 6] })) })}${jnPlot(grid, eff, wn, xn, inRange)}</div><p class="note">左：${simp.map((r, i) => `<span style="color:${GC[i % 6]}">■</span> ${esc(wn)} = ${r.l}（${fmt(r.raw, 1)}）`).join('　')}。右：${esc(wn)}の値ごとの${esc(xn)}の傾きと 95%信頼区間（Johnson-Neyman の図）。帯が 0 の点線にかからない範囲で、効果が有意です。</p>`;
    figs += '<h4>回帰平面の 3D プロット</h4>' + plot3d({ x: xr, z: wsrc, y, f: (xv, wv) => pred(xv, wv), xn, zn: wn, yn }) + '<p class="note">交互作用があると面がねじれ、W の位置によって X 方向の傾きが変わります。</p>';
  } else {
    simp = wl.map((l, g) => ({ l, raw: NaN, ...condAt(vecFor(wl.slice(1).map((_, j) => +(j === g - 1)))) }));
    h += `<h4>群ごとの ${esc(xn)} の効果（単純傾斜）</h4>` + table([wn, `${xn} の傾き`, 'SE', 't', 'p 値', '95%CI'], simp.map(r => [esc(r.l), fmt(r.est, 3), fmt(r.se, 3), fmt(r.t, 2), pcell(r.p), `[${fmt(r.L, 3)}, ${fmt(r.U, 3)}]`]));
    const xlo = Math.min(...x0), xhi = Math.max(...x0), cm = Cs.map(cc => S.mean(cc)), gid = w0.map(v => wl.indexOf(v));
    const pred = (xv, g) => { const vec = [1, xv - xm, ...wl.slice(1).map((_, j) => +(j === g - 1)), ...wl.slice(1).map((_, j) => (xv - xm) * +(j === g - 1)), ...cm]; return vec.reduce((s, v, i) => s + v * b[i], 0); };
    figs = `<div class="figrow">${xyPlot(x0, y, xn, yn, { groups: gid, groupNames: wl, lines: wl.map((_, g) => ({ a: pred(0, g), b: (pred(1, g) - pred(0, g)), color: GC[g % 6] })) })}</div><p class="note">群ごとの回帰直線。線の傾きの違いが調整効果です。</p>`;
  }
  h += figs;
  const sigS = simp.filter(r => r.p < .05);
  h += interp(pInt < .05 ? `交互作用（${esc(xn)} × ${esc(wn)}）が有意です（ΔR² = ${fmt(dR2, 3)}, F(${q}, ${full.df}) = ${fmt(dF, 2)}, ${pTxt(pInt)}）。${esc(xn)}が${esc(yn)}に与える影響の強さは、${esc(wn)}によって変わる（${esc(wn)}が調整している）といえます。` : `交互作用は有意ではありません（${pTxt(pInt)}）。${esc(xn)}の効果が${esc(wn)}によって変わるとはいえません。この場合、単純傾斜は参考として見るにとどめ、交互作用項を除いたモデル（主効果のみ）で解釈するのが一般的です。`,
    `単純傾斜：${simp.map(r => `${esc(wn)} が${wCat ? `「${esc(r.l)}」` : r.l}のとき、${esc(xn)}の傾きは ${fmt(r.est, 2)}（${pTxt(r.p)}）`).join('、')}。${pInt < .05 && simp.length >= 2 ? `${Math.abs(simp[simp.length - 1].est) < Math.abs(simp[0].est) ? `${esc(wn)}が${wCat ? '後の群' : '高い'}ほど${esc(xn)}の影響は弱まります${!wCat && (b[1] * b[2 + q] < 0) ? '（緩衝効果）' : ''}。` : `${esc(wn)}が${wCat ? '後の群' : '高い'}ほど${esc(xn)}の影響は強まります（増幅効果）。`}` : ''}`,
    center && !wCat ? `中心化しているので、${esc(xn)}の係数（${fmt(b[1], 2)}）は「${esc(wn)}が平均の人での${esc(xn)}の効果」、${esc(wn)}の係数は「${esc(xn)}が平均の人での${esc(wn)}の効果」と読みます。` : '',
    '調整分析は重回帰分析の一種なので、残差の正規性や等分散性などの前提も確認してください（重回帰分析の診断が使えます）。');
  h += apa('論文記載例', `${esc(xn)}が${esc(yn)}に及ぼす影響に対する${esc(wn)}の調整効果を検討するため、${center ? '中心化した変数による' : ''}交互作用項を含む重回帰分析を行った。その結果、交互作用は${pInt < .05 ? '有意であった' : '有意ではなかった'}（<i>B</i> = ${fmt(b[2 + q], 2)}, Δ<i>R</i>² = ${fmt(dR2, 3)}, ${apaP(pInt)}）。${pInt < .05 && !wCat ? `単純傾斜分析の結果、${esc(wn)}が低い場合（${simp[0].l}）の${esc(xn)}の効果は <i>B</i> = ${fmt(simp[0].est, 2)}（${apaP(simp[0].p)}）、高い場合（${simp[2].l}）は <i>B</i> = ${fmt(simp[2].est, 2)}（${apaP(simp[2].p)}）であった。` : ''}`);
  return { title: `調整分析（${xn} × ${wn} → ${yn}）`, html: h };
};

function medModHelp() {
  return `<details class="guide mmhelp"><summary>媒介分析と調整分析の違い・使い方（はじめての人はここから）</summary>${conceptDiagrams()}
    <table class="out mmtab"><thead><tr><th></th><th>媒介分析</th><th>調整分析</th></tr></thead><tbody>
      <tr><td>問い</td><td>X は<b>なぜ・どのような道筋で</b> Y に影響するのか</td><td>X の影響は<b>いつ・誰で</b>強く（弱く）なるのか</td></tr>
      <tr><td>第3の変数</td><td>M（媒介変数）：X によって変わり、Y を変える</td><td>W（調整変数）：X とは別に人が持つ特徴や状況</td></tr>
      <tr><td>心理学の例</td><td>ストレス → 自尊感情の低下 → 抑うつ</td><td>ストレス → 抑うつ の影響が、サポートの多い人では弱い</td></tr>
      <tr><td>見る結果</td><td>間接効果 a×b とブートストラップ信頼区間</td><td>交互作用項 X×W、単純傾斜、Johnson-Neyman 法</td></tr>
      <tr><td>モデル（PROCESS）</td><td>モデル 4</td><td>モデル 1</td></tr></tbody></table>
    <p><b>調整媒介分析</b>は、2 つを組み合わせて「媒介の道筋（間接効果）の強さが W によって変わるか」を調べます。W がどの矢印を調整するかで、モデルを選びます。</p>
    <p>・<b>モデル 7</b>：W が X → M を調整（例：サポートが多い人では、ストレスがあっても自尊感情が下がりにくい）<br>・<b>モデル 14</b>：W が M → Y を調整（例：サポートが多い人では、自尊感情が低くても抑うつになりにくい）<br>・<b>モデル 8</b>：W が X → M と X → Y の直接効果の両方を調整</p>
    <p><b>系列媒介分析</b>は、媒介変数が<b>順番につながる</b>場合（X → M1 → M2 → Y）に使います。例：ストレス → 自尊感情の低下 → 反すう（くよくよ考える）の増加 → 抑うつ。M を 2〜3 個、影響が伝わる順にチェックして「系列媒介分析」を押します。並列媒介（媒介分析で M を複数選ぶ）とは、M どうしの影響（M1 → M2）を考えるかどうかが違います。例のデータでは、M に「自尊感情」→「反すう」の順でチェックすると体験できます。</p>
    <p>判定には<b>調整媒介指標</b>（ブートストラップ信頼区間が 0 を含まなければ調整媒介あり）と、W の値ごとの<b>条件付き間接効果</b>を使います。調整媒介分析は X・M・W・Y の 4 つを選び、上の「調整媒介のモデル」でモデルを選んでから実行します。</p>
    <p><b>使い方の手順</b></p>
    <p>① 研究の問いが「しくみ」なら媒介分析、「条件・個人差」なら調整分析を選びます。両方を組み合わせた「調整媒介」は、まず両方を別々に確かめてから考えます。</p>
    <p>② 上の欄で <b>X（原因）</b> と <b>Y（結果）</b> を選び、媒介分析なら <b>M</b>、調整分析なら <b>W</b> を選びます（性別や年齢など、統制したい変数は「共変量」に）。</p>
    <p>③ ボタンを押すと、結果の最初に「何がわかるか」の説明、パス図や単純傾斜の図、表、「読み方」、論文記載例が出ます。</p>
    <p>④ 試しに「例：媒介・調整データ」を押すと、X = ストレス、M = 自尊感情、W = サポート、Y = 抑うつ が入った状態で両方を体験できます。</p>
    <p class="note">どちらの分析も、変数の順序（何が原因で何が結果か）は統計ではなく<b>理論と研究デザイン</b>で決まります。1 回の調査データでの結果は「モデルと整合的」と控えめに解釈しましょう。</p></details>`;
}
