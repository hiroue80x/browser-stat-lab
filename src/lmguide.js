// ===== 線形モデルで理解する：分散分析＝回帰分析（一般線形モデル）と一般化線形モデル =====
function makeGlmSample() { // 例として入っている架空データ（3 つの指導法、各 30 人）
  const R = rng(27182), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [], gs = ['講義', '討論', '自習'];
  const pois = lam => { let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; };
  for (let i = 0; i < 90; i++) {
    const g = gs[i % 3], sex = R() < .5 ? '女性' : '男性', pre = Math.round(50 + 9 * nrm()), eff = { 講義: 0, 討論: 6, 自習: -3 }[g];
    const score = Math.round(30 + .5 * pre + eff + (sex === '女性' && g === '討論' ? 3 : 0) + 6 * nrm());
    const pass = R() < 1 / (1 + Math.exp(-(-1.6 + .09 * (score - 50)))) ? '合格' : '不合格', q = pois(Math.exp(.6 + { 講義: 0, 討論: .7, 自習: -.3 }[g]));
    rows.push([String(i + 1), g, sex, String(pre), String(score), pass, String(q)]);
  }
  return { cols: [{ name: 'ID', on: true }, { name: '指導法', on: true, measure: 'nominal' }, { name: '性別', on: true }, { name: '事前得点', on: true }, { name: 'テスト得点', on: true }, { name: '合否', on: true }, { name: '質問回数', on: true, label: '授業中に質問した回数' }],
    rows, roles: { y: 4, a: 1, b: -1, x: [], rep: [], fa: [], bin: 5, event: '合格', roc: [], cov: [], time: -1, st: -1, stev: '' } };
}
state.opt.coding = state.opt.coding || 'dummy'; state.opt.family = state.opt.family || 'auto';
function invM(A) { const n = A.length, M = A.map((r, i) => [...r, ...r.map((_, j) => +(i === j))]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) throw new Error('計算できません（変数が重複している可能性）。'); [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; } } return M.map(r => r.slice(n)); }

// ---- デザイン行列 ----
function designFor(f, lv, coding) { // f: 水準の配列、lv: 水準
  const k = lv.length, cols = lv.slice(1).map((l, j) => f.map(v => coding === 'effect' ? (v === l ? 1 : v === lv[0] ? -1 : 0) : +(v === l)));
  return { cols, names: lv.slice(1).map(l => coding === 'effect' ? `${l}（効果）` : `${l}（ダミー）`) };
}
function designMatrixSvg(cols, names, yv, yName, grp, lv, maxPer = 3) { // 各群から数行ずつ表示
  const idx = []; lv.forEach(l => { let c = 0; grp.forEach((g, i) => { if (g === l && c < maxPer) { idx.push(i); c++; } }); });
  const allNames = ['人', yName, '切片', ...names], cw = allNames.map((n, j) => j === 0 ? 60 : Math.max(62, tw(n) + 14)), W = cw.reduce((a, b) => a + b, 0) + 20, rh = 22, H = 46 + idx.length * rh + 30;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:${W}px">`, x = 10;
  const xs = cw.map(w => { const v = x; x += w; return v; });
  allNames.forEach((n, j) => s += `<text x="${xs[j] + cw[j] / 2}" y="28" text-anchor="middle" style="fill:var(--fg);font-size:11.5px;font-weight:600">${esc(n)}</text>`);
  s += `<line x1="${xs[2] - 4}" x2="${xs[2] - 4}" y1="12" y2="${H - 26}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  idx.forEach((i, r) => {
    const y = 42 + r * rh, gc = GC[lv.indexOf(grp[i]) % 6];
    if (r && grp[idx[r - 1]] !== grp[i]) s += `<line x1="10" x2="${W - 10}" y1="${y - 3}" y2="${y - 3}" stroke="var(--line)"/>`;
    s += `<rect x="${xs[0]}" y="${y}" width="${cw[0] - 6}" height="${rh - 4}" rx="3" fill="${gc}" fill-opacity=".2"/><text x="${xs[0] + 6}" y="${y + 13}" style="fill:var(--fg);font-size:11px">${esc(grp[i])}</text>`;
    s += `<text x="${xs[1] + cw[1] / 2}" y="${y + 13}" text-anchor="middle" style="fill:var(--fg);font-size:11px">${+yv[i].toPrecision(4)}</text>`;
    [1, ...cols.map(c => c[i])].forEach((v, j) => { const cx = xs[j + 2], fill = v === 1 ? 'var(--accent)' : v === -1 ? 'var(--sig)' : v === 0 ? 'var(--panel)' : 'var(--accent-soft)'; s += `<rect x="${cx + 4}" y="${y}" width="${cw[j + 2] - 8}" height="${rh - 4}" rx="3" fill="${fill}" fill-opacity="${v === 1 || v === -1 ? .85 : 1}"/><text x="${cx + cw[j + 2] / 2}" y="${y + 13}" text-anchor="middle" style="fill:${v === 1 || v === -1 ? '#fff' : 'var(--fg)'};font-size:11px">${+(+v).toPrecision(4)}</text>`; });
  });
  s += `<text x="10" y="${H - 8}" style="font-size:10.5px">点線の右がデザイン行列 X（各群から ${maxPer} 人ずつ表示）。Y ＝ X × 係数 ＋ 誤差。</text>`;
  return s + '</svg>';
}
function ssPlot(y, g, lv, yName) { // 平方和の分解：点・群平均・全体平均
  const W = 520, H = 300, M = { l: 52, r: 20, t: 44, b: 44 }, yt = niceTicks(Math.min(...y), Math.max(...y)), k = lv.length, slot = (W - M.l - M.r) / k;
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), gm = S.mean(y), Rn = rng(5);
  let s = frame(W, H, M, yt, yName, fy);
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(gm)}" y2="${fy(gm)}" stroke="var(--fg)" stroke-dasharray="5 4"/><text x="${W - M.r}" y="${fy(gm) - 5}" text-anchor="end" style="fill:var(--fg);font-size:10.5px">全体の平均（切片だけのモデル）</text>`;
  lv.forEach((l, i) => {
    const vals = y.filter((_, q) => g[q] === l), m = S.mean(vals), cx = M.l + slot * (i + .5), c = GC[i % 6];
    vals.forEach(v => { const x = cx - slot * .3 + Rn() * slot * .6; s += `<line x1="${x}" x2="${x}" y1="${fy(v)}" y2="${fy(m)}" stroke="${c}" stroke-opacity=".25"/><circle cx="${x}" cy="${fy(v)}" r="2.6" fill="${c}" fill-opacity=".6"/>`; });
    s += `<line x1="${cx - slot * .36}" x2="${cx + slot * .36}" y1="${fy(m)}" y2="${fy(m)}" stroke="${c}" stroke-width="3"/><line x1="${cx + slot * .38}" x2="${cx + slot * .38}" y1="${fy(gm)}" y2="${fy(m)}" stroke="var(--sig)" stroke-width="2.2" marker-end=""/><text x="${cx}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(l)}</text>`;
  });
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">太線＝群の平均（予測値）　細線＝残差（群内）　橙の縦線＝群平均−全体平均（群間）</text>`;
  return s + '</svg>';
}
function ssBar(ssb, ssw, labB, labW) {
  const W = 520, H = 70, t = ssb + ssw, wb = (W - 20) * ssb / t;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><rect x="10" y="10" width="${wb}" height="26" fill="var(--sig)" fill-opacity=".75"/><rect x="${10 + wb}" y="10" width="${W - 20 - wb}" height="26" fill="var(--accent)" fill-opacity=".35"/><text x="${10 + wb / 2}" y="28" text-anchor="middle" style="fill:#fff;font-size:11.5px">${esc(labB)} ${fmt(ssb / t * 100, 1)}%</text><text x="${10 + wb + (W - 20 - wb) / 2}" y="28" text-anchor="middle" style="fill:var(--fg);font-size:11.5px">${esc(labW)} ${fmt(ssw / t * 100, 1)}%</text><text x="10" y="56" style="font-size:10.5px">全体の平方和（SST）＝ 群間（モデル）＋ 群内（残差）。群間の割合が η²、回帰分析でいう R² です。</text></svg>`;
}

// ---- 線形モデルの解説用の図 ----
function lmArrow(x1, y1, x2, y2, c, w = 2.4) { // 矢印（矢じりは三角形で描く）
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 2) return '';
  const ux = dx / L, uy = dy / L, hl = Math.min(9, L * .45), bx = x2 - ux * hl, by = y2 - uy * hl, px = -uy * hl * .5, py = ux * hl * .5;
  return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${c}" stroke-width="${w}"/><polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${c}"/>`;
}
const lmSgn = v => (v >= 0 ? '＋' : '−') + fmt(Math.abs(v), 2);
function lmSpread(ys, gap = 14) { const o = ys.map((y, i) => ({ y, i })).sort((p, q) => p.y - q.y); for (let r = 1; r < o.length; r++) if (o[r].y - o[r - 1].y < gap) o[r].y = o[r - 1].y + gap; const out = []; o.forEach(p => out[p.i] = p.y); return out; }
// ② 係数を矢印で：切片（基準線）から各群の平均へ
function coefArrowPlot(y, a, la, means, b, coding, yName) {
  const k = la.length, W = 560, H = 324, M = { l: 52, r: 34, t: 54, b: 44 }, yt = niceTicks(Math.min(...y), Math.max(...y)), slot = (W - M.l - M.r) / k;
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), Rn = rng(5);
  const base = coding === 'effect' ? S.mean(means) : means[0];
  let s = frame(W, H, M, yt, yName, fy);
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(base)}" y2="${fy(base)}" stroke="var(--fg)" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  s += `<text x="${W - M.r + 4}" y="${fy(base) + 4}" style="fill:var(--fg);font-size:12px;font-weight:700">b₀</text><text x="${M.l}" y="30" style="fill:var(--fg);font-size:11px;font-weight:600">切片 b₀ ＝ ${fmt(base, 2)}（${coding === 'effect' ? '群平均の平均' : `基準群「${esc(la[0])}」の平均`}）</text>`;
  la.forEach((l, i) => {
    const cx = M.l + slot * (i + .5), c = GC[i % 6], vals = y.filter((_, q) => a[q] === l);
    vals.forEach(v => s += `<circle cx="${cx - slot * .32 + Rn() * slot * .22}" cy="${fy(v)}" r="2.3" fill="${c}" fill-opacity=".28"/>`);
    s += `<line x1="${cx - slot * .1}" x2="${cx + slot * .3}" y1="${fy(means[i])}" y2="${fy(means[i])}" stroke="${c}" stroke-width="3"/>`;
    const ax = cx + slot * .1;
    let lab;
    if (coding !== 'effect' && i === 0) lab = '＝ b₀（基準群）';
    else { const bi = coding === 'effect' ? (i === 0 ? -S.sum(b.slice(1)) : b[i]) : b[i]; s += lmArrow(ax, fy(base), ax, fy(means[i]), c, 3); lab = coding === 'effect' && i === 0 ? `−(b₁＋…) ＝ ${lmSgn(bi)}` : `b${i} ＝ ${lmSgn(bi)}`; }
    const ly = (fy(base) + fy(means[i])) / 2;
    s += `<text x="${ax + 8}" y="${Math.abs(fy(base) - fy(means[i])) < 26 ? (means[i] < base ? fy(means[i]) + 17 : fy(means[i]) - 8) : ly + 4}" style="fill:${c};font-size:12px;font-weight:700">${lab}</text>`;
    s += `<text x="${cx}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg);font-weight:600">${esc(l)}</text><text x="${cx}" y="${H - M.b + 32}" text-anchor="middle" style="font-size:10.5px">平均 ${fmt(means[i], 2)}</text>`;
  });
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">点線＝切片（出発点）　矢印＝係数（切片に足す量）　太線＝群の平均（予測値）</text>`;
  return s + '</svg>';
}
// ② 2 群だけを取り出すと「ダミー変数での単回帰」＝ t 検定
function dummyLinePlot(y, a, la, b, yName) {
  const k = la.length, pw = 270, ph = 240, W = pw * Math.min(k - 1, 3), rows = Math.ceil((k - 1) / 3), H = ph * rows + 22, Rn = rng(9);
  const yt = niceTicks(Math.min(...y), Math.max(...y));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:${W}px">`;
  la.slice(1).forEach((l, j) => {
    const ox = (j % 3) * pw, oy = Math.floor(j / 3) * ph, M = { l: 44, r: 16, t: 34, b: 40 }, X0 = ox + M.l + 40, X1 = ox + pw - M.r - 40;
    const fy = v => oy + ph - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (ph - M.t - M.b);
    yt.forEach(v => s += `<line x1="${ox + M.l}" x2="${ox + pw - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${ox + M.l - 5}" y="${fy(v) + 4}" text-anchor="end" style="font-size:10px">${+v.toPrecision(6)}</text>`);
    const g0 = y.filter((_, q) => a[q] === la[0]), g1 = y.filter((_, q) => a[q] === l), m0 = S.mean(g0), m1 = S.mean(g1), c0 = GC[0], c1 = GC[(j + 1) % 6];
    g0.forEach(v => s += `<circle cx="${X0 + (Rn() - .5) * 26}" cy="${fy(v)}" r="2.3" fill="${c0}" fill-opacity=".45"/>`);
    g1.forEach(v => s += `<circle cx="${X1 + (Rn() - .5) * 26}" cy="${fy(v)}" r="2.3" fill="${c1}" fill-opacity=".45"/>`);
    const ext = 22, sl = (m1 - m0) / (X1 - X0);
    s += `<line x1="${X0 - ext}" y1="${fy(m0 - sl * ext)}" x2="${X1 + ext}" y2="${fy(m1 + sl * ext)}" stroke="var(--sig)" stroke-width="2.6"/>`;
    s += `<circle cx="${X0}" cy="${fy(m0)}" r="5" fill="${c0}" stroke="#fff" stroke-width="1.5"/><circle cx="${X1}" cy="${fy(m1)}" r="5" fill="${c1}" stroke="#fff" stroke-width="1.5"/>`;
    s += `<line x1="${X0}" x2="${X1}" y1="${fy(m0)}" y2="${fy(m0)}" stroke="var(--fg)" stroke-dasharray="3 3"/><line x1="${X1 + 10}" x2="${X1 + 10}" y1="${fy(m0)}" y2="${fy(m1)}" stroke="var(--fg)"/>`;
    s += `<text x="${X1 + 14}" y="${(fy(m0) + fy(m1)) / 2 + 4}" style="fill:var(--fg);font-size:10.5px">${lmSgn(m1 - m0)}</text>`;
    s += `<text x="${X0}" y="${oy + ph - M.b + 16}" text-anchor="middle" style="fill:var(--fg);font-size:11px">D${j + 1} ＝ 0</text><text x="${X0}" y="${oy + ph - M.b + 29}" text-anchor="middle" style="font-size:10px">${esc(la[0])}</text>`;
    s += `<text x="${X1}" y="${oy + ph - M.b + 16}" text-anchor="middle" style="fill:var(--fg);font-size:11px">D${j + 1} ＝ 1</text><text x="${X1}" y="${oy + ph - M.b + 29}" text-anchor="middle" style="font-size:10px">${esc(l)}</text>`;
    s += `<text x="${ox + pw / 2}" y="${oy + 18}" text-anchor="middle" style="fill:var(--fg);font-size:12px;font-weight:600">${esc(la[0])} と ${esc(l)}：傾き ＝ ${lmSgn(b[j + 1])}</text>`;
  });
  s += `<text x="8" y="${H - 6}" style="font-size:10.5px">赤い直線＝0/1 のダミー変数で回帰した直線。傾き＝2 群の平均の差。</text>`;
  return s + '</svg>';
}
// ③ モデル比較：切片だけ（左）と群を入れたモデル（右）の残差
function modelComparePlot(y, a, la, yName, sse0, sse1, df1, df2, termLab) {
  const k = la.length, pw = 300, ph = 250, W = pw * 2, H = ph + 166, yt = niceTicks(Math.min(...y), Math.max(...y)), gm = S.mean(y);
  const means = la.map(l => S.mean(y.filter((_, q) => a[q] === l)));
  const Rn = rng(5), jit = y.map(() => Rn());
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, 1].forEach(p => {
    const ox = p * pw, M = { l: 44, r: 14, t: 42, b: 30 }, slot = (pw - M.l - M.r) / k;
    const fy = v => ph - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (ph - M.t - M.b);
    yt.forEach(v => s += `<line x1="${ox + M.l}" x2="${ox + pw - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${ox + M.l - 5}" y="${fy(v) + 4}" text-anchor="end" style="font-size:10px">${+v.toPrecision(6)}</text>`);
    if (!p) s += `<line x1="${ox + M.l}" x2="${ox + pw - M.r}" y1="${fy(gm)}" y2="${fy(gm)}" stroke="var(--fg)" stroke-width="2"/>`;
    la.forEach((l, i) => {
      const cx = ox + M.l + slot * (i + .5), c = GC[i % 6], pred = p ? means[i] : gm;
      if (p) s += `<line x1="${cx - slot * .42}" x2="${cx + slot * .42}" y1="${fy(pred)}" y2="${fy(pred)}" stroke="${c}" stroke-width="2.6"/>`;
      y.forEach((v, q) => { if (a[q] !== l) return; const x = cx - slot * .36 + jit[q] * slot * .72; s += `<line x1="${x}" x2="${x}" y1="${fy(v)}" y2="${fy(pred)}" stroke="var(--sig)" stroke-opacity=".45"/><circle cx="${x}" cy="${fy(v)}" r="2.3" fill="${c}" fill-opacity=".75"/>`; });
      s += `<text x="${cx}" y="${ph - M.b + 16}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">${esc(l)}</text>`;
    });
    s += `<text x="${ox + pw / 2}" y="16" text-anchor="middle" style="fill:var(--fg);font-size:12px;font-weight:600">${p ? `モデル1：切片 ＋ ${esc(termLab)}` : 'モデル0：切片だけ（全員を全体平均で予測）'}</text>`;
    s += `<text x="${ox + pw / 2}" y="32" text-anchor="middle" style="fill:var(--sig);font-size:11px">残差平方和 ＝ ${fmt(p ? sse1 : sse0, 1)}</text>`;
  });
  // F のしくみ：棒の長さ＝平方和
  const bx = 150, bw = W - bx - 30, sc = bw / sse0, y0 = ph + 14, msM = (sse0 - sse1) / df1, msE = sse1 / df2, Fv = msM / msE;
  const bar = (yy, w, x0, col, op, lab, val) => `<rect x="${bx + x0}" y="${yy}" width="${Math.max(w, 1)}" height="18" fill="${col}" fill-opacity="${op}"/><text x="${bx - 8}" y="${yy + 13}" text-anchor="end" style="fill:var(--fg);font-size:11px">${lab}</text><text x="${bx + x0 + Math.max(w, 1) + 6 > W - 70 ? bx + x0 + 6 : bx + x0 + Math.max(w, 1) + 6}" y="${yy + 13}" style="fill:${bx + x0 + Math.max(w, 1) + 6 > W - 70 ? '#fff' : 'var(--fg)'};font-size:11px">${val}</text>`;
  s += bar(y0, sse0 * sc, 0, 'var(--muted)', .45, 'モデル0 の残差', fmt(sse0, 1));
  s += bar(y0 + 24, sse1 * sc, 0, 'var(--accent)', .55, 'モデル1 の残差', fmt(sse1, 1));
  s += bar(y0 + 48, (sse0 - sse1) * sc, sse1 * sc, 'var(--sig)', .8, '減った分（効果）', fmt(sse0 - sse1, 1));
  s += `<text x="12" y="${y0 + 92}" style="fill:var(--fg);font-size:12px">F ＝ <tspan style="fill:var(--sig);font-weight:700">減った分 ÷ ${df1}</tspan> ÷ <tspan style="fill:var(--accent);font-weight:700">モデル1 の残差 ÷ ${df2}</tspan> ＝ ${fmt(msM, 2)} ÷ ${fmt(msE, 2)} ＝ <tspan style="font-weight:700">${fmt(Fv, 2)}</tspan></text>`;
  s += `<text x="12" y="${y0 + 114}" style="font-size:10.5px">赤い縦線＝残差（予測と実際のずれ）。群を入れると予測が群の平均に変わり、残差が短くなります。</text><text x="12" y="${y0 + 130}" style="font-size:10.5px">その「減り方」が、偶然で期待される大きさ（1 自由度あたりの残差）の何倍かが F です。</text>`;
  return s + '</svg>';
}
// ③ F 分布：観測された F と 5% の境目
function fDensity(x, d1, d2) { if (x <= 0) return 0; return Math.exp(S.lgamma((d1 + d2) / 2) - S.lgamma(d1 / 2) - S.lgamma(d2 / 2) + d1 / 2 * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - (d1 + d2) / 2 * Math.log(1 + d1 * x / d2)); }
function fDistPlot(Fv, d1, d2, p, lab) {
  const W = 520, H = 180, M = { l: 40, r: 20, t: 34, b: 34 }, crit = S.qf(.05, d1, d2), xmax = Math.max(crit * 1.8, Math.min(Fv * 1.12, crit * 5.5), 4), off = Fv > xmax;
  const N = 200, xs = Array.from({ length: N + 1 }, (_, i) => xmax * (i + .001) / N), ds = xs.map(x => fDensity(x, d1, d2)), ymax = Math.min(Math.max(...ds) * 1.08, 1.6);
  const fx = x => M.l + x / xmax * (W - M.l - M.r), fy = v => H - M.b - Math.min(v, ymax) / ymax * (H - M.t - M.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<path d="M${fx(crit)},${fy(0)} ${xs.filter(x => x >= crit).map((x) => `L${fx(x)},${fy(fDensity(x, d1, d2))}`).join(' ')} L${fx(xmax)},${fy(0)} Z" fill="var(--sig)" fill-opacity=".4"/>`;
  s += `<path d="M${xs.map((x, i) => `${fx(x)},${fy(ds[i])}`).join(' L')}" fill="none" stroke="var(--fg)" stroke-width="1.8"/>`;
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(0)}" y2="${fy(0)}" stroke="var(--line)"/>`;
  niceTicks(0, xmax).filter(v => v <= xmax).forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle" style="font-size:10px">${+v.toPrecision(4)}</text>`);
  s += `<line x1="${fx(crit)}" x2="${fx(crit)}" y1="${fy(0)}" y2="${M.t}" stroke="var(--sig)" stroke-dasharray="4 3"/><text x="${fx(crit) + 4}" y="${M.t + 10}" style="fill:var(--sig);font-size:10.5px">5% の境目 ${fmt(crit, 2)}</text>`;
  if (off) s += lmArrow(W - M.r - 50, H - M.b - 30, W - M.r - 4, H - M.b - 30, 'var(--accent)', 2.6) + `<text x="${W - M.r - 4}" y="${H - M.b - 40}" text-anchor="end" style="fill:var(--accent);font-size:11.5px;font-weight:700">F ＝ ${fmt(Fv, 2)}（さらに右）</text>`;
  else s += `<line x1="${fx(Fv)}" x2="${fx(Fv)}" y1="${fy(0)}" y2="${M.t + 16}" stroke="var(--accent)" stroke-width="2.6"/><text x="${fx(Fv) + (fx(Fv) > W - 140 ? -4 : 4)}" y="${M.t + 28}" text-anchor="${fx(Fv) > W - 140 ? 'end' : 'start'}" style="fill:var(--accent);font-size:11.5px;font-weight:700">F ＝ ${fmt(Fv, 2)}</text>`;
  s += `<text x="${M.l}" y="16" style="fill:var(--fg);font-size:12px;font-weight:600">${esc(lab)}：F(${d1}, ${d2}) 分布　p ${p < .001 ? '< .001' : '= ' + fp(p)}</text>`;
  s += `<text x="${W - M.r}" y="${H - 4}" text-anchor="end" style="font-size:10px">曲線＝効果がまったくないとき（帰無仮説）に出る F の分布。赤い部分（上側 5%）に入れば有意。</text>`;
  return s + '</svg>';
}
// 2 要因：セル平均のプロット（交互作用＝線が平行でない）
function cellMeansPlot(y, a, b, la, lb, yName, aName, bName) {
  const W = 520, H = 310, M = { l: 52, r: 120, t: 54, b: 40 }, cm = lb.map(m => la.map(l => { const v = y.filter((_, i) => a[i] === l && b[i] === m); return v.length ? S.mean(v) : NaN; }));
  const all = cm.flat().filter(isFinite), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * .25 || 1, yt = niceTicks(lo - pad, hi + pad), slot = (W - M.l - M.r) / la.length;
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), fx = i => M.l + slot * (i + .5);
  let s = frame(W, H, M, yt, `${yName}（セルの平均）`, fy);
  const lys = lmSpread(lb.map((_, r) => fy(cm[r][la.length - 1])));
  lb.forEach((m, r) => { const c = GC[(r + 3) % 6]; s += `<polyline points="${cm[r].map((v, i) => `${fx(i)},${fy(v)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.4"/>` + cm[r].map((v, i) => `<circle cx="${fx(i)}" cy="${fy(v)}" r="4.5" fill="${c}"/>`).join('') + `<text x="${W - M.r + 10}" y="${lys[r] + 4}" style="fill:${c};font-size:11.5px;font-weight:600">${esc(m)}</text>`; });
  la.forEach((l, i) => s += `<text x="${fx(i)}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(l)}</text>`);
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">線の色＝${esc(bName)}。線が平行なら交互作用なし（A の列と B の列を足すだけで説明できる）。</text><text x="${M.l}" y="30" style="font-size:10.5px">平行でなければ交互作用（A×B の積の列）が必要です。</text>`;
  return s + '</svg>';
}
// 共変量：群ごとに平行な回帰直線（共分散分析）
function ancovaLinePlot(y, a, la, x, xName, yName, ints, slope) {
  const W = 520, H = 320, M = { l: 52, r: 100, t: 54, b: 42 }, yt = niceTicks(Math.min(...y), Math.max(...y)), xt = niceTicks(Math.min(...x), Math.max(...x));
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r);
  let s = frame(W, H, M, yt, yName, fy);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(5)}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--fg)">${esc(xName)}（共変量）</text>`;
  la.forEach((l, i) => { const c = GC[i % 6]; y.forEach((v, q) => { if (a[q] === l) s += `<circle cx="${fx(x[q])}" cy="${fy(v)}" r="2.6" fill="${c}" fill-opacity=".5"/>`; }); });
  const x0 = xt[0], x1 = xt[xt.length - 1], clip = v => Math.max(yt[0], Math.min(yt[yt.length - 1], v));
  const lys = lmSpread(la.map((_, i) => fy(clip(ints[i] + slope * x1))));
  la.forEach((l, i) => { const c = GC[i % 6], v0 = ints[i] + slope * x0, v1 = ints[i] + slope * x1; s += `<line x1="${fx(x0)}" y1="${fy(clip(v0))}" x2="${fx(x1)}" y2="${fy(clip(v1))}" stroke="${c}" stroke-width="2.6"/><text x="${W - M.r + 8}" y="${lys[i] + 4}" style="fill:${c};font-size:11.5px;font-weight:600">${esc(l)}</text>`; });
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">共分散分析＝傾きが共通（平行）な回帰直線を群ごとに引くモデル。</text><text x="${M.l}" y="30" style="font-size:10.5px">直線どうしの上下のずれが「共変量をそろえたときの群の差」です。</text>`;
  return s + '</svg>';
}

// ---- 分散分析＝回帰分析 ----
ANALYSES.db.lmAnova = function () {
  const R = state.db.roles, yj = needRole('y', '目的変数'); need(colType(yj) === 'num', '「分散分析を回帰分析として見る」には数値の目的変数を選んでください（2 値の目的変数は「一般化線形モデル」で）。'); const aj = needRole('a', '要因A（群）'), bj = R.b >= 0 && R.b !== aj ? R.b : -1, cv = (R.cov || []).filter(j => j !== yj && j !== aj && j !== bj && colType(j) === 'num'), coding = state.opt.coding;
  const Y = dbCol(yj).map(toNum), A = dbCol(aj), B = bj >= 0 ? dbCol(bj) : null, C = cv.map(j => dbCol(j).map(toNum));
  const ok = Y.map((v, i) => isFinite(v) && A[i] !== '' && (!B || B[i] !== '') && C.every(c => isFinite(c[i]))), f = a => a.filter((_, i) => ok[i]);
  const y = f(Y), a = f(A), b = B ? f(B) : null, cs = C.map(f), n = y.length, la = levelsOf(a), lb = b ? levelsOf(b) : null;
  need(la.length >= 2 && la.length <= 8, '要因Aは 2〜8 区分の列を選んでください。'); if (b) need(lb.length >= 2 && lb.length <= 6, '要因Bは 2〜6 区分の列を選んでください。');
  const DA = designFor(a, la, coding), DB = b ? designFor(b, lb, coding) : null, ab = b ? DA.cols.flatMap((ca, p) => DB.cols.map(cb => ca.map((v, i) => v * cb[i]))) : [], abN = b ? DA.names.flatMap(na => DB.names.map(nb => `${na} × ${nb}`)) : [];
  const cols = [...DA.cols, ...(DB ? DB.cols : []), ...ab, ...cs], names = [...DA.names, ...(DB ? DB.names : []), ...abN, ...cv.map(j => vn(j))];
  const F = olsV(y, cols), nm = (vn), yn = nm(yj), an = nm(aj), bn = bj >= 0 ? nm(bj) : '';
  // タイプIII の平方和は効果コーディングで（コーディングによらず同じ値）
  const E = designFor(a, la, 'effect'), EB = b ? designFor(b, lb, 'effect') : null, eab = b ? E.cols.flatMap(ca => EB.cols.map(cb => ca.map((v, i) => v * cb[i]))) : [];
  const blocks = [{ name: an, cols: E.cols }, ...(b ? [{ name: bn, cols: EB.cols }, { name: `${an} × ${bn}`, cols: eab }] : []), ...cs.map((c, q) => ({ name: nm(cv[q]) + '（共変量）', cols: [c] }))];
  const allE = blocks.flatMap(bk => bk.cols), FE = olsV(y, allE), sse = FE.sse, dfE = FE.df, mse = sse / dfE, sst = S.sum(y.map(v => (v - S.mean(y)) ** 2));
  const terms = blocks.map((bk, q) => { const rest = blocks.filter((_, r) => r !== q).flatMap(x => x.cols), s0 = rest.length ? olsV(y, rest).sse : sst, ss = s0 - sse, df = bk.cols.length, Fv = ss / df / mse; return { name: bk.name, ss, df, F: Fv, p: S.pfU(Fv, df, dfE), peta2: ss / (ss + sse) }; });
  const r2 = 1 - F.sse / sst, Fm = (sst - F.sse) / cols.length / (F.sse / F.df), pm = S.pfU(Fm, cols.length, F.df);
  const means = la.map(l => S.mean(y.filter((_, i) => a[i] === l))), ns = la.map(l => a.filter(v => v === l).length);
  let h = guideBox('分散分析は「回帰分析」の一種です（一般線形モデル）', [
    ['考え方：', `群の違いは、<b>0 と 1 の変数（ダミー変数）</b>で表せます。たとえば「${esc(la[1])}なら 1、それ以外は 0」という列を作り、${esc(yn)}をその列で回帰すると、係数が「${esc(la[0])}との平均の差」になります。分散分析は、この回帰分析で「群を表す変数をまとめて入れると、予測がどれだけ良くなるか」を F 検定しているのと同じです。`],
    ['式で書くと：', `<b>Y ＝ b₀ ＋ b₁·D₁ ＋ b₂·D₂ ＋ … ＋ 誤差</b>（D はダミー変数）。分散分析・t 検定・共分散分析・重回帰分析はすべてこの形で、まとめて<b>一般線形モデル</b>と呼びます。`],
    ['このページで確かめること：', '① デザイン行列（ダミー変数の表）、② 回帰係数と群の平均の対応、③ 分散分析表と回帰分析の F が一致すること、④ 平方和の分解と η² ＝ R²。下の「コーディング」をダミーと効果で切り替えて、係数がどう変わるか（F は変わらない）も試してみてください。']]);
  h += `<p class="note">Y = ${esc(yn)}、要因A = ${esc(an)}（${la.map(esc).join('・')}）${b ? `、要因B = ${esc(bn)}（${lb.map(esc).join('・')}）` : ''}${cv.length ? `、共変量 = ${cv.map(j => esc(nm(j))).join('・')}` : ''}、n = ${n}。コーディング：${coding === 'effect' ? '効果コーディング（1・0・−1、切片＝群平均の平均）' : `ダミーコーディング（0/1、基準＝「${esc(la[0])}」）`}。</p>`;
  h += '<h4>① デザイン行列：群を数字の列で表す</h4>' + designMatrixSvg(cols, names, y, yn, a, la);
  h += `<p class="note">${coding === 'effect' ? `効果コーディングでは、基準の群（${esc(la[0])}）の人はすべての列が −1 になります（橙）。` : `ダミーコーディングでは、基準の群（${esc(la[0])}）の人はすべての列が 0 で、ほかの群の人は自分の群の列だけが 1 です。`}${b ? '交互作用の列は、A の列と B の列の積です。' : ''}${cv.length ? '共変量は数値をそのまま列に入れます（これが共分散分析です）。' : ''}</p>`;
  if (b) h += '<h4>図：セルの平均（2 要因）</h4>' + cellMeansPlot(y, a, b, la, lb, yn, an, bn);
  h += '<h4>② 回帰係数（一般線形モデルとして推定）</h4>' + table(['', 'B', 'SE', 't', 'p 値'], ['切片', ...names].map((nm1, i) => [esc(nm1), fmt(F.b[i], 3), fmt(F.se[i], 3), fmt(F.t[i], 2), pcell(F.p[i])]));
  if (!b && !cv.length) {
    const rows = coding === 'effect' ? [['切片 b₀', fmt(F.b[0], 3), `群の平均の平均 ＝ (${means.map(m => fmt(m, 2)).join(' ＋ ')}) ÷ ${la.length} ＝ ${fmt(S.mean(means), 3)}`], ...la.slice(1).map((l, j) => [`${l}（効果）b${j + 1}`, fmt(F.b[j + 1], 3), `${l} の平均 − 群平均の平均 ＝ ${fmt(means[j + 1], 2)} − ${fmt(S.mean(means), 2)} ＝ ${fmt(means[j + 1] - S.mean(means), 3)}`])]
      : [['切片 b₀', fmt(F.b[0], 3), `基準群「${la[0]}」の平均 ＝ ${fmt(means[0], 3)}`], ...la.slice(1).map((l, j) => [`${l}（ダミー）b${j + 1}`, fmt(F.b[j + 1], 3), `「${l}」の平均 − 「${la[0]}」の平均 ＝ ${fmt(means[j + 1], 2)} − ${fmt(means[0], 2)} ＝ ${fmt(means[j + 1] - means[0], 3)}`])];
    h += '<h4>係数を群の平均で読むと</h4>' + table(['係数', '値', '群の平均で言うと'], rows.map(r => r.map(esc)));
    h += `<p class="note">予測式：${esc(yn)} ＝ ${fmt(F.b[0], 2)}${F.b.slice(1).map((v, j) => ` ${v >= 0 ? '＋' : '−'} ${fmt(Math.abs(v), 2)}×D${j + 1}`).join('')}。各群の人を式に入れると、予測値はちょうどその群の平均（${la.map((l, i) => `${esc(l)} ${fmt(means[i], 2)}`).join('、')}）になります。</p>`;
    h += '<h4>図：係数は「切片からの矢印」</h4>' + coefArrowPlot(y, a, la, means, F.b, coding, yn);
    if (coding !== 'effect') h += '<h4>図：2 群だけ見ると、t 検定も「傾き」の検定</h4>' + dummyLinePlot(y, a, la, F.b, yn) + `<p class="note">ダミー変数は 0 と 1 しかとらないので、回帰直線は「0 の群の平均」と「1 の群の平均」を結ぶ線になります。傾きが 0 かどうかの t 検定は、2 群の平均の差の t 検定（等分散を仮定）と同じです。</p>`;
  }
  h += '<h4>③ 分散分析表（モデル比較で求めた F）と、回帰分析の F</h4>' + table(['変動要因', '平方和', '自由度', 'F', 'p 値', '偏 η²'], [...terms.map(t => [esc(t.name), fmt(t.ss, 3), t.df, fmt(t.F, 3), pcell(t.p), fmt(t.peta2, 3)]), ['残差', fmt(sse, 3), dfE, '', '', ''], ['全体（修正済み）', fmt(sst, 3), n - 1, '', '', '']])
    + table(['回帰分析としての検定', 'R²', 'F', '自由度', 'p 値'], [['モデル全体（すべての列）', fmt(r2, 3), fmt(Fm, 3), `${cols.length}, ${F.df}`, pcell(pm)]]);
  let check = '';
  if (!b && !cv.length) { const A1 = S.anova1(la.map(l => y.filter((_, i) => a[i] === l))); check = `<p class="note"><b>一致の確認：</b>一元配置分散分析（いつもの計算）の F(${A1.dfb}, ${A1.dfw}) = ${fmt(A1.F, 4)}、p = ${fp(A1.p)}。回帰分析の F(${cols.length}, ${F.df}) = ${fmt(Fm, 4)} と完全に一致し、η²（${fmt(A1.eta2, 4)}）は R²（${fmt(r2, 4)}）と同じです。</p>`; }
  h += check + '<p class="note">各要因の F は「その要因の列を除いたモデル」と「すべて入ったモデル」の残差平方和の差から求めています（モデル比較）。これがタイプIII平方和で、SPSS の分散分析と同じです。</p>';
  if (!b && cv.length) { const k = la.length, xq = cs[0], sl = F.b[k], other = cs.slice(1).reduce((acc, c, q) => acc + F.b[k + 1 + q] * S.mean(c), 0), eff = la.map((_, i) => coding === 'effect' ? (i ? F.b[i] : -S.sum(F.b.slice(1, k))) : (i ? F.b[i] : 0));
    h += '<h4>図：共分散分析は「平行な回帰直線」</h4>' + ancovaLinePlot(y, a, la, xq, nm(cv[0]), yn, eff.map(e => F.b[0] + e + other), sl); }
  if (!b && !cv.length) h += `<h4>図：モデルを比べて F を作る</h4>` + modelComparePlot(y, a, la, yn, sst, F.sse, cols.length, F.df, an);
  h += '<h4>図：F 分布のどこにあるか</h4>' + terms.map(t => fDistPlot(t.F, t.df, dfE, t.p, t.name)).join('');
  if (!b) h += '<h4>④ 平方和の分解</h4>' + ssPlot(y, a, la, yn) + ssBar(sst - F.sse, F.sse, cv.length ? 'モデル' : '群間', '残差（群内）');
  h += interp(`この分析は、${esc(an)}${b ? `・${esc(bn)}・交互作用` : ''}${cv.length ? '・共変量' : ''}を表す ${cols.length} 個の列を使った重回帰分析と同じです。分散分析表の F と、回帰分析で列をまとめて検定した F は同じ考え方（モデル比較）で求められています。`,
    `R² = ${fmt(r2, 3)} は「${esc(yn)}のばらつきのうち、モデル（群の違いなど）で説明できる割合」で、一元配置分散分析では η² と同じ値です。`,
    coding === 'dummy' ? `ダミーコーディングでは、係数は「基準群（${esc(la[0])}）との差」です。基準群を変えると係数は変わりますが、F 検定の結果は変わりません。${b ? '交互作用がある場合、ダミーコーディングの主効果の係数は「もう一方の要因が基準の水準のときの差」になる点に注意しましょう（そのため、分散分析表は効果コーディングで計算しています）。' : ''}` : '効果コーディングでは、係数は「その群の平均が、群平均の平均からどれだけずれているか」を表します。2 要因の分散分析（タイプIII）は、この効果コーディングで計算されています。',
    'この考え方がわかると、分散分析・共分散分析・重回帰分析・t 検定を一つの枠組みで理解でき、目的変数が 2 値や回数のときの「一般化線形モデル」へも自然に進めます。');
  return { title: `分散分析を回帰分析として見る（${yn} × ${an}${b ? ' × ' + bn : ''}）`, html: h };
};

// ---- 一般化線形モデル ----
function glmFit(y, cols, family) {
  const n = y.length, X = y.map((_, i) => [1, ...cols.map(c => c[i])]), p = X[0].length;
  const link = family === 'binomial' ? { f: m => Math.log(m / (1 - m)), inv: e => 1 / (1 + Math.exp(-e)), d: m => 1 / (m * (1 - m)), v: m => m * (1 - m) } : family === 'poisson' ? { f: m => Math.log(m), inv: e => Math.exp(e), d: m => 1 / m, v: m => m } : { f: m => m, inv: e => e, d: () => 1, v: () => 1 };
  let mu = y.map(v => family === 'binomial' ? (v + .5) / 2 : family === 'poisson' ? v + .1 : v), eta = mu.map(link.f), b = new Array(p).fill(0), inv;
  for (let it = 0; it < 100; it++) {
    const w = mu.map(m => 1 / (link.d(m) ** 2 * link.v(m))), z = eta.map((e, i) => e + (y[i] - mu[i]) * link.d(mu[i]));
    const XtWX = Array.from({ length: p }, () => new Array(p).fill(0)), XtWz = new Array(p).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < p; a++) { XtWz[a] += X[i][a] * w[i] * z[i]; for (let c = 0; c < p; c++) XtWX[a][c] += X[i][a] * w[i] * X[i][c]; }
    inv = invM(XtWX); const nb = inv.map(r => S.sum(r.map((v, j) => v * XtWz[j]))), ch = Math.max(...nb.map((v, j) => Math.abs(v - b[j]))); b = nb;
    eta = X.map(r => S.sum(r.map((v, j) => v * b[j]))); mu = eta.map(link.inv).map(m => family === 'binomial' ? Math.min(1 - 1e-12, Math.max(1e-12, m)) : m);
    if (ch < 1e-10) break;
  }
  const dev = family === 'binomial' ? -2 * S.sum(y.map((v, i) => v * Math.log(mu[i]) + (1 - v) * Math.log(1 - mu[i]))) : family === 'poisson' ? 2 * S.sum(y.map((v, i) => (v > 0 ? v * Math.log(v / mu[i]) : 0) - (v - mu[i]))) : S.sum(y.map((v, i) => (v - mu[i]) ** 2));
  const phi = family === 'gaussian' ? dev / (n - p) : 1, se = inv.map((r, i) => Math.sqrt(r[i] * phi));
  return { b, se, z: b.map((v, i) => v / se[i]), p: b.map((v, i) => family === 'gaussian' ? S.pt2(Math.abs(v / se[i]), n - p) : 2 * S.pnU(Math.abs(v / se[i]))), dev, df: n - p, mu, phi, link };
}
function linkPlot(lv, etas, mus, obs, family, yName) { // 線形予測子（左）と応答の尺度（右）
  const W = 620, H = 280, half = 290, M = { t: 34, b: 44 };
  const panel = (x0, vals, lab, obsv) => { const all = [...vals, ...(obsv || [])], yt = niceTicks(Math.min(...all), Math.max(...all), 5), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), slot = (half - 60) / lv.length;
    let s = `<text x="${x0 + 50}" y="18" style="fill:var(--fg);font-weight:600;font-size:12px">${lab}</text>`; yt.forEach(v => s += `<line x1="${x0 + 50}" x2="${x0 + half - 10}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${x0 + 44}" y="${fy(v) + 4}" text-anchor="end">${+v.toPrecision(3)}</text>`);
    lv.forEach((l, i) => { const cx = x0 + 50 + slot * (i + .5); s += `<circle cx="${cx}" cy="${fy(vals[i])}" r="6" fill="${GC[i % 6]}"/>${obsv ? `<line x1="${cx - 12}" x2="${cx + 12}" y1="${fy(obsv[i])}" y2="${fy(obsv[i])}" stroke="var(--fg)" stroke-width="2"/>` : ''}<text x="${cx}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(l)}</text>`; });
    return s; };
  const lname = family === 'binomial' ? 'ロジット log(p/(1−p))' : family === 'poisson' ? 'log(平均回数)' : '恒等（そのまま）';
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">` + panel(0, etas, `線形予測子 η ＝ ${lname}`) + panel(half + 20, mus, family === 'binomial' ? `確率（${yName}）に戻す` : family === 'poisson' ? '平均回数に戻す' : '平均', obs);
  s += `<text x="${half + 4}" y="${H / 2}" text-anchor="middle" style="fill:var(--sig);font-size:22px">→</text><text x="${half + 4}" y="${H / 2 + 18}" text-anchor="middle" style="fill:var(--sig);font-size:10px">${family === 'binomial' ? '1/(1+e^−η)' : family === 'poisson' ? 'e^η' : ''}</text>`;
  s += `<text x="10" y="${H - 6}" style="font-size:10.5px">左：直線のモデル（回帰式）が働く尺度。右：元の尺度に戻した予測値（点）と、実際の値（黒線）。一般化線形モデルでは、両者を「リンク関数」でつなぎます。</text>`;
  return s + '</svg>';
}
ANALYSES.db.glmFam = function () {
  const R = state.db.roles, yj = needRole('y', '目的変数'), aj = needRole('a', '要因A（群）'), cv = (R.cov || []).filter(j => j !== yj && j !== aj && colType(j) === 'num');
  const raw = dbCol(yj), lvY = levelsOf(raw.filter(v => v !== '')), nums = raw.map(toNum);
  let fam = state.opt.family; if (fam === 'auto') fam = lvY.length === 2 ? 'binomial' : nums.filter(isFinite).length && nums.filter(isFinite).every(v => v >= 0 && Number.isInteger(v)) && Math.max(...nums.filter(isFinite)) <= 100 ? 'poisson' : 'gaussian';
  const ev = fam === 'binomial' ? (lvY.includes(R.event) ? R.event : lvY[1]) : null;
  if (fam === 'binomial') need(lvY.length === 2, '二項分布（2 値）には、値が 2 種類の目的変数を選んでください。');
  const Yv = fam === 'binomial' ? raw.map(v => v === '' ? NaN : +(v === ev)) : nums, A = dbCol(aj), C = cv.map(j => dbCol(j).map(toNum));
  const ok = Yv.map((v, i) => isFinite(v) && A[i] !== '' && C.every(c => isFinite(c[i]))), f = a => a.filter((_, i) => ok[i]), y = f(Yv), a = f(A), cs = C.map(f), n = y.length, la = levelsOf(a);
  need(la.length >= 2 && la.length <= 8, '要因Aは 2〜8 区分の列を選んでください。'); if (fam === 'poisson') need(y.every(v => v >= 0 && Number.isInteger(v)), 'ポアソン分布（回数）には、0 以上の整数の目的変数を選んでください。');
  const D = designFor(a, la, 'dummy'), full = glmFit(y, [...D.cols, ...cs], fam), red = glmFit(y, cs, fam), nul = glmFit(y, [], fam);
  const yn = vn(yj), an = vn(aj), famLab = { gaussian: '正規分布（一般線形モデル）', binomial: '二項分布（2 値）', poisson: 'ポアソン分布（回数）' }[fam], linkLab = { gaussian: '恒等リンク（そのまま）', binomial: 'ロジットリンク', poisson: '対数リンク' }[fam];
  const LR = red.dev - full.dev, dfA = la.length - 1, pLR = fam === 'gaussian' ? S.pfU(LR / dfA / full.phi, dfA, full.df) : S.pchiU(LR, dfA);
  const obs = la.map(l => S.mean(y.filter((_, i) => a[i] === l))), etas = la.map((l, g) => full.b[0] + (g ? full.b[g] : 0) + cs.reduce((s2, c, q) => s2 + full.b[la.length + q] * S.mean(c), 0)), mus = etas.map(full.link.inv);
  let h = guideBox('一般化線形モデルとは（はじめて使う人へ）', [
    ['なぜ必要か：', `分散分析や回帰分析（一般線形モデル）は、目的変数が「正規分布する連続量」であることを前提にしています。でも、心理学では<b>合格・不合格のような 2 値</b>や、<b>質問した回数のような 0, 1, 2… の回数</b>もよく扱います。こうしたデータに合わせて模型を広げたのが<b>一般化線形モデル</b>です。`],
    ['3 つの部品：', '① <b>確率分布</b>（正規・二項・ポアソンなど）、② <b>線形予測子</b>（b₀ ＋ b₁X₁ ＋ … という回帰式）、③ <b>リンク関数</b>（予測値の範囲を合わせる変換。確率なら 0〜1、回数なら 0 以上に収まるようにする）。分散分析は「正規分布＋恒等リンク」という特別な場合です。'],
    ['分散分析表にあたるもの：', '一般化線形モデルでは、平方和の代わりに<b>逸脱度</b>（当てはまりの悪さ）を使い、「要因を入れると逸脱度がどれだけ減るか」を χ² 検定します（逸脱度分析、尤度比検定）。']]);
  h += `<p class="note">Y = ${esc(yn)}${fam === 'binomial' ? `（「${esc(ev)}」= 1）` : ''}、要因 = ${esc(an)}（基準 = ${esc(la[0])}）${cv.length ? `、共変量 = ${cv.map(j => esc(vn(j))).join('・')}` : ''}、n = ${n}。</p>`;
  h += '<h4>このモデルの 3 つの部品</h4>' + table(['部品', '分散分析（一般線形モデル）', 'このデータのモデル'], [['① 確率分布', '正規分布', famLab], ['② 線形予測子', `b₀ ＋ b·（${esc(an)}のダミー）`, `b₀ ＋ b·（${esc(an)}のダミー）${cv.length ? '＋ 共変量' : ''}`], ['③ リンク関数', '恒等（予測値＝平均）', linkLab + (fam === 'binomial' ? '：log(p/(1−p)) ＝ 線形予測子' : fam === 'poisson' ? '：log(平均) ＝ 線形予測子' : '')]]);
  h += '<h4>リンク関数のはたらき</h4>' + linkPlot(la, etas, mus, cv.length ? null : obs, fam, fam === 'binomial' ? ev : yn);
  const expLab = fam === 'binomial' ? 'オッズ比 exp(B)' : fam === 'poisson' ? '率比 exp(B)' : '';
  h += '<h4>係数</h4>' + table(['', 'B', 'SE', fam === 'gaussian' ? 't' : 'z', 'p 値', ...(expLab ? [expLab, '95%CI'] : [])], ['切片', ...D.names.map(x => x.replace('（ダミー）', `（vs ${la[0]}）`)), ...cv.map(j => vn(j))].map((nm1, i) => [esc(nm1), fmt(full.b[i], 3), fmt(full.se[i], 3), fmt(full.z[i], 2), pcell(full.p[i]), ...(expLab ? (i ? [fmt(Math.exp(full.b[i]), 3), `[${fmt(Math.exp(full.b[i] - 1.96 * full.se[i]), 3)}, ${fmt(Math.exp(full.b[i] + 1.96 * full.se[i]), 3)}]`] : ['', '']) : [])]));
  h += '<h4>逸脱度分析表（分散分析表にあたるもの）</h4>' + table(['モデル', '逸脱度', '自由度', '逸脱度の減少', fam === 'gaussian' ? 'F' : 'χ²', 'p 値'], [
    ['切片のみ', fmt(nul.dev, 3), nul.df, '', '', ''], ...(cv.length ? [['＋ 共変量', fmt(red.dev, 3), red.df, fmt(nul.dev - red.dev, 3), '', '']] : []),
    [`＋ ${esc(an)}`, fmt(full.dev, 3), full.df, fmt(LR, 3), fmt(fam === 'gaussian' ? LR / dfA / full.phi : LR, 3), pcell(pLR)]]);
  let cmp = '';
  if (fam === 'binomial' && !cv.length) { const tab = la.map(l => [0, 1].map(v => y.filter((u, i) => a[i] === l && u === v).length)), T = S.chiTable(tab), G = 2 * S.sum(tab.flatMap((r, i) => r.map((o, j) => o > 0 ? o * Math.log(o / T.E[i][j]) : 0))); cmp = `<h4>いつもの分析との比較：分割表の検定</h4>` + table(['検定', '統計量', '自由度', 'p 値'], [['ロジスティック回帰の尤度比検定', `χ² = ${fmt(LR, 4)}`, dfA, pcell(pLR)], ['分割表の尤度比検定（G 検定）', `G = ${fmt(G, 4)}`, T.df, pcell(T.pG)], ['分割表の Pearson の χ² 検定', `χ² = ${fmt(T.chi, 4)}`, T.df, pcell(T.p)]]) + `<p class="note">ロジスティック回帰の尤度比検定と分割表の G 検定は<b>完全に一致</b>します（χ² 検定ともほぼ同じ）。「群 × 合否の χ² 検定」は、二項分布の一般化線形モデルの特別な場合なのです。各群の予測確率（${la.map((l, i) => `${esc(l)} ${fmt(mus[i], 3)}`).join('、')}）は、実際の割合と一致します。</p>`; }
  if (fam === 'poisson') { const A1 = S.anova1(la.map(l => y.filter((_, i) => a[i] === l))), disp = full.dev / full.df; cmp = '<h4>いつもの分析との比較：回数をそのまま分散分析すると</h4>' + table(['分析', '統計量', 'p 値', '前提'], [['ポアソン回帰（尤度比検定）', `χ²(${dfA}) = ${fmt(LR, 3)}`, pcell(pLR), '回数の分布（ポアソン分布）'], ['一元配置分散分析', `F(${A1.dfb}, ${A1.dfw}) = ${fmt(A1.F, 3)}`, pcell(A1.p), '正規分布・等分散']]) + `<p class="note">回数は 0 未満にならず、平均が大きい群ほどばらつきも大きくなるため、正規分布を前提にする分散分析より、ポアソン回帰が適しています。過分散の目安：逸脱度 ÷ 自由度 ＝ ${fmt(disp, 2)}（${disp > 1.5 ? '1.5 を超えているので、ばらつきがポアソン分布より大きい「過分散」の可能性があります。R の quasipoisson や負の二項回帰（MASS::glm.nb）も検討してください。' : '1 に近いので、ポアソン分布の仮定に大きな問題はありません。'}）</p>`; }
  if (fam === 'gaussian') cmp = '<p class="note">正規分布・恒等リンクの一般化線形モデルは、ふつうの回帰分析・分散分析とまったく同じ結果になります（逸脱度＝残差平方和）。</p>';
  h += cmp;
  const sig = full.b.slice(1, la.length).map((v, j) => ({ l: la[j + 1], v, p: full.p[j + 1] })).filter(x => x.p < .05);
  h += interp(`${esc(an)}を入れると逸脱度が ${fmt(LR, 2)} 減り、${pLR < .05 ? `この減少は有意です（${pTxt(pLR)}）。${esc(an)}によって${fam === 'binomial' ? `「${esc(ev)}」になる確率` : fam === 'poisson' ? '平均回数' : '平均'}が違うといえます。` : `有意ではありません（${pTxt(pLR)}）。`}`,
    fam === 'binomial' ? `係数はロジット（対数オッズ）の差です。exp(B) はオッズ比で、${sig.length ? sig.map(x => `「${esc(x.l)}」は「${esc(la[0])}」に比べて「${esc(ev)}」のオッズが ${fmt(Math.exp(x.v), 2)} 倍`).join('、') + 'です。' : '有意なオッズ比はありませんでした。'}` : fam === 'poisson' ? `係数は log(平均回数) の差です。exp(B) は率比（平均回数の比）で、${sig.length ? sig.map(x => `「${esc(x.l)}」は「${esc(la[0])}」の ${fmt(Math.exp(x.v), 2)} 倍`).join('、') + 'の回数です。' : '有意な率比はありませんでした。'}` : '係数はそのまま平均の差です。',
    '一般化線形モデルを使えば、目的変数の種類に合わせて分布とリンク関数を選ぶだけで、分散分析と同じ考え方（要因を入れて当てはまりがどれだけ良くなるか）で分析できます。');
  return { title: `一般化線形モデル（${famLab}：${yn} ← ${an}）`, html: h };
};

function lmGuideHelp() {
  const rows = [['2 群の平均の比較（t 検定）', 'Y ＝ b₀ ＋ b₁·群（0/1）', '正規', '恒等'], ['3 群以上の比較（一元配置分散分析）', 'Y ＝ b₀ ＋ b₁·D₁ ＋ b₂·D₂ …', '正規', '恒等'], ['2 要因の分散分析', 'A の列 ＋ B の列 ＋ A×B の列', '正規', '恒等'], ['共分散分析', '群の列 ＋ 共変量', '正規', '恒等'], ['相関・単回帰', 'Y ＝ b₀ ＋ b₁·X', '正規', '恒等'], ['重回帰分析', 'Y ＝ b₀ ＋ b₁X₁ ＋ b₂X₂ …', '正規', '恒等'], ['群 × 2 値の χ² 検定 ／ ロジスティック回帰', 'logit(p) ＝ b₀ ＋ b₁·D₁ …', '二項', 'ロジット'], ['回数の比較 ／ ポアソン回帰', 'log(平均) ＝ b₀ ＋ b₁·D₁ …', 'ポアソン', '対数']];
  return `<details class="guide mmhelp" open><summary>検定の地図：いろいろな検定はみんな「線形モデル」の仲間です</summary>
    <svg viewBox="0 0 560 150" style="max-width:560px;width:100%"><rect x="10" y="10" width="540" height="130" rx="10" fill="var(--sig-soft)" stroke="var(--sig)"/><text x="24" y="32" style="fill:var(--sig);font-weight:600;font-size:13px">一般化線形モデル（分布とリンク関数を選べる）</text><text x="24" y="50" style="font-size:11px">ロジスティック回帰・ポアソン回帰・χ² 検定 など</text>
      <rect x="40" y="62" width="490" height="68" rx="8" fill="var(--accent-soft)" stroke="var(--accent)"/><text x="54" y="84" style="fill:var(--accent);font-weight:600;font-size:13px">一般線形モデル（正規分布＋恒等リンク）</text><text x="54" y="104" style="font-size:11px">t 検定・分散分析・共分散分析・相関・回帰分析・重回帰分析</text><text x="54" y="121" style="font-size:10.5px">→ すべて Y ＝ X × 係数 ＋ 誤差 の形</text></svg>
    ${table(['よく使う分析', '線形モデルで書くと', '分布', 'リンク'], rows)}
    <p><b>使い方：</b>① 目的変数と要因A（必要なら要因B・共変量）を選び、「分散分析を回帰分析として見る」を押すと、ダミー変数・回帰係数・分散分析表の対応がわかります。② 目的変数が 2 値や回数なら「一般化線形モデル」を押します（分布は自動で選びますが、下の欄で変えられます）。③ 「例：線形モデルの解説用データ」で、テスト得点（連続）・合否（2 値）・質問回数（回数）を目的変数に切り替えながら比べてみてください。</p>
    <p class="note">さらにその先には、同じ人の繰り返し測定や学級のまとまりを扱う「線形混合モデル（マルチレベルモデル）」があります。</p></details>`;
}
