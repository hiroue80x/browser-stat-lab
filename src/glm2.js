// ===== 共分散分析と、最尤法（完全情報最尤法）による回帰分析 =====
(() => {
  const sum = a => a.reduce((s, v) => s + v, 0), mean = a => sum(a) / a.length;
  const inv = A => { const n = A.length, M = A.map((r, i) => [...r, ...r.map((_, j) => +(i === j))]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-14) throw new Error('singular'); [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; } } return M.map(r => r.slice(n)); };
  const logdet = A => { const n = A.length, L = A.map(r => r.map(() => 0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; if (i === j) { if (!(s > 0)) return NaN; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j]; } return 2 * sum(L.map((r, i) => Math.log(r[i]))); };
  const quad = (x, M, y = x) => { let s = 0; for (let i = 0; i < x.length; i++) for (let j = 0; j < y.length; j++) s += x[i] * M[i][j] * y[j]; return s; };

  // ---- 共分散分析（1要因、共変量は1つ以上）。タイプIII平方和（効果コーディング）、調整済み平均は共変量の全体平均で評価 ----
  S.ancova = function (y, g, covs, levels) {
    const n = y.length, k = levels.length, q = covs.length, gi = g.map(v => levels.indexOf(v)), cm = covs.map(mean), C = covs.map((c, j) => c.map(v => v - cm[j]));
    const eff = i => levels.slice(0, k - 1).map((_, l) => gi[i] === l ? 1 : gi[i] === k - 1 ? -1 : 0);
    const build = (useA, useC, inter) => y.map((_, i) => { const e = eff(i), r = [1]; if (useA) r.push(...e); useC.forEach(j => r.push(C[j][i])); if (inter) e.forEach(ev => C.forEach(c => r.push(ev * c[i]))); return r; });
    const all = covs.map((_, j) => j), full = S.ols(build(true, all), y), sseF = full.sse, dfE = full.df, mse = sseF / dfE;
    const term = (sse, df) => { const ss = sse - sseF, F = ss / df / mse; return { ss, df, ms: ss / df, F, p: S.pfU(F, df, dfE), peta2: ss / (ss + sseF) }; };
    const A = term(S.ols(build(false, all), y).sse, k - 1), covT = covs.map((_, j) => term(S.ols(build(true, all.filter(x => x !== j)), y).sse, 1));
    const sst = sum(y.map(v => (v - mean(y)) ** 2));
    let slopes = null; try { const I = S.ols(build(true, all, true), y), df1 = (k - 1) * q, F = (sseF - I.sse) / df1 / (I.sse / I.df); slopes = { F, df1, df2: I.df, p: S.pfU(F, df1, I.df) }; } catch (e) { }
    const b = full.b, V = full.inv.map(r => r.map(v => v * mse)), tc = S.qt(.025, dfE);
    const xg = l => { const r = [1, ...levels.slice(0, k - 1).map((_, m) => m === l ? 1 : l === k - 1 ? -1 : 0)]; covs.forEach(() => r.push(0)); return r; };
    const adj = levels.map((lv, l) => { const x = xg(l), m = sum(x.map((v, j) => v * b[j])), se = Math.sqrt(quad(x, V)), idx = gi.map((v, i) => v === l ? i : -1).filter(i => i >= 0);
      return { level: lv, n: idx.length, mean: mean(idx.map(i => y[i])), sd: Math.sqrt(sum(idx.map(i => (y[i] - mean(idx.map(j => y[j]))) ** 2)) / (idx.length - 1)), covMeans: covs.map(c => mean(idx.map(i => c[i]))), adj: m, se, L: m - tc * se, U: m + tc * se }; });
    const pairs = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { const d = xg(i).map((v, t) => v - xg(j)[t]), diff = adj[i].adj - adj[j].adj, se = Math.sqrt(quad(d, V)), t = diff / se, p = 2 * S.ptU(Math.abs(t), dfE); pairs.push({ i, j, diff, se, t, p, pb: Math.min(1, p * k * (k - 1) / 2), L: diff - tc * se, U: diff + tc * se, vec: d }); }
    const slope = covs.map((_, j) => { const idx = k + j, v = b[idx], se = Math.sqrt(V[idx][idx]); return { b: v, se, t: v / se, p: 2 * S.ptU(Math.abs(v / se), dfE) }; });
    const un = S.anova1(levels.map((_, l) => y.filter((_, i) => gi[i] === l)));
    return { n, k, q, A, cov: covT, error: { ss: sseF, df: dfE, ms: mse }, sst, slopes, adj, pairs, slope, cm, unadj: un, r2: 1 - sseF / sst, V, resid: full.resid };
  };

  // ---- 二要因の共分散分析（タイプIII平方和、調整済み平均は共変量の全体平均で評価、周辺平均はセルの等重み平均＝SPSS・emmeans と同じ） ----
  S.ancova2 = function (y, a, b, covs, la, lb) {
    const n = y.length, ka = la.length, kb = lb.length, q = covs.length, ai = a.map(v => la.indexOf(v)), bi = b.map(v => lb.indexOf(v)), cm = covs.map(mean), C = covs.map((c, j) => c.map(v => v - cm[j]));
    const eA = l => la.slice(0, ka - 1).map((_, m) => l === m ? 1 : l === ka - 1 ? -1 : 0), eB = l => lb.slice(0, kb - 1).map((_, m) => l === m ? 1 : l === kb - 1 ? -1 : 0);
    const cellX = (i, j, cov) => { const A = eA(i), B = eB(j), r = [1, ...A, ...B]; A.forEach(x => B.forEach(z => r.push(x * z))); return r.concat(cov); };
    const pA = ka - 1, pB = kb - 1, pAB = pA * pB, blocks = { A: [1, 1 + pA], B: [1 + pA, 1 + pA + pB], AB: [1 + pA + pB, 1 + pA + pB + pAB] };
    const Xfull = y.map((_, i) => cellX(ai[i], bi[i], C.map(c => c[i])));
    const drop = (X, from, to) => X.map(r => r.filter((_, t) => t < from || t >= to));
    const full = S.ols(Xfull, y), sseF = full.sse, dfE = full.df, mse = sseF / dfE, nc = 1 + pA + pB + pAB;
    const term = (sse, df) => { const ss = sse - sseF, F = ss / df / mse; return { ss, df, ms: ss / df, F, p: S.pfU(F, df, dfE), peta2: ss / (ss + sseF) }; };
    const T = { A: term(S.ols(drop(Xfull, ...blocks.A), y).sse, pA), B: term(S.ols(drop(Xfull, ...blocks.B), y).sse, pB), AB: term(S.ols(drop(Xfull, ...blocks.AB), y).sse, pAB) };
    const cov = covs.map((_, j) => term(S.ols(drop(Xfull, nc + j, nc + j + 1), y).sse, 1));
    let slopes = null; try { const XI = Xfull.map(r => { const f = r.slice(1, nc), out = [...r]; C.forEach((c, j) => f.forEach(v => out.push(v * r[nc + j]))); return out; }), I = S.ols(XI, y), df1 = (nc - 1) * q, F = (sseF - I.sse) / df1 / (I.sse / I.df); slopes = { F, df1, df2: I.df, p: S.pfU(F, df1, I.df) }; } catch (e) { }
    const bb = full.b, V = full.inv.map(r => r.map(v => v * mse)), tc = S.qt(.025, dfE), z0 = covs.map(() => 0);
    const est = x => { const m = sum(x.map((v, t) => v * bb[t])), se = Math.sqrt(quad(x, V)); return { adj: m, se, L: m - tc * se, U: m + tc * se }; };
    const avg = xs => xs[0].map((_, t) => mean(xs.map(x => x[t])));
    const cells = la.map((_, i) => lb.map((_, j) => { const idx = y.map((_, k) => ai[k] === i && bi[k] === j ? k : -1).filter(k => k >= 0), yv = idx.map(k => y[k]), m = mean(yv); return { n: idx.length, mean: m, sd: Math.sqrt(sum(yv.map(v => (v - m) ** 2)) / (yv.length - 1)), ...est(cellX(i, j, z0)) }; }));
    const margA = la.map((_, i) => est(avg(lb.map((_, j) => cellX(i, j, z0))))), margB = lb.map((_, j) => est(avg(la.map((_, i) => cellX(i, j, z0)))));
    const ftest = Ls => { // 線形仮説 L b = 0 の F 検定
      const Lb = Ls.map(l => sum(l.map((v, t) => v * bb[t]))), LVL = Ls.map(l1 => Ls.map(l2 => quad(l1, V, l2))), Wi = inv(LVL), r = Ls.length, F = quad(Lb, Wi) / r;
      return { F, df1: r, df2: dfE, p: S.pfU(F, r, dfE), peta2: F * r / (F * r + dfE) };
    };
    const pairsOf = (vecs, levels) => { const out = [], m = levels.length * (levels.length - 1) / 2; for (let i = 0; i < levels.length; i++) for (let j = i + 1; j < levels.length; j++) { const d = vecs[i].map((v, t) => v - vecs[j][t]), diff = sum(d.map((v, t) => v * bb[t])), se = Math.sqrt(quad(d, V)), t = diff / se, p = 2 * S.ptU(Math.abs(t), dfE); out.push({ i, j, diff, se, t, p, pb: Math.min(1, p * m), vec: d }); } return out; };
    const diffs = vecs => vecs.slice(0, -1).map(v => v.map((x, t) => x - vecs[vecs.length - 1][t]));
    const simpleA = lb.map((lv, j) => { const vecs = la.map((_, i) => cellX(i, j, z0)); return { level: lv, ...ftest(diffs(vecs)), pairs: pairsOf(vecs, la) }; });
    const simpleB = la.map((lv, i) => { const vecs = lb.map((_, j) => cellX(i, j, z0)); return { level: lv, ...ftest(diffs(vecs)), pairs: pairsOf(vecs, lb) }; });
    const pairsA = pairsOf(la.map((_, i) => avg(lb.map((_, j) => cellX(i, j, z0)))), la), pairsB = pairsOf(lb.map((_, j) => avg(la.map((_, i) => cellX(i, j, z0)))), lb);
    const slope = covs.map((_, j) => { const t = nc + j, v = bb[t], se = Math.sqrt(V[t][t]); return { b: v, se, t: v / se, p: 2 * S.ptU(Math.abs(v / se), dfE) }; });
    const sst = sum(y.map(v => (v - mean(y)) ** 2));
    return { n, T, cov, error: { ss: sseF, df: dfE, ms: mse }, sst, slopes, cells, margA, margB, simpleA, simpleB, pairsA, pairsB, slope, cm, r2: 1 - sseF / sst, V, resid: full.resid };
  };

  // ---- 最尤法による回帰（多変量正規、欠測値は完全情報最尤法＝EM で推定、標準誤差は観測情報行列） ----
  function fitMVN(Z) { // Z: 行 = ケース、NaN = 欠測
    const d = Z[0].length, rows = Z.filter(r => r.some(isFinite)), N = rows.length;
    const pats = {}; rows.forEach(r => { const key = r.map(v => isFinite(v) ? 1 : 0).join(''); (pats[key] = pats[key] || []).push(r); });
    const P = Object.entries(pats).map(([key, rs]) => ({ o: [...key].map((c, j) => c === '1' ? j : -1).filter(j => j >= 0), m: [...key].map((c, j) => c === '0' ? j : -1).filter(j => j >= 0), rs }));
    let mu = Array.from({ length: d }, (_, j) => mean(rows.map(r => r[j]).filter(isFinite)));
    let Sig = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => i === j ? (v => sum(v.map(x => (x - mu[i]) ** 2)) / v.length)(rows.map(r => r[i]).filter(isFinite)) : 0));
    const ll = (mu, Sig) => { let s = 0; for (const p of P) { const So = p.o.map(i => p.o.map(j => Sig[i][j])), Si = inv(So), ld = logdet(So); if (!isFinite(ld)) return -Infinity; p.rs.forEach(r => { const e = p.o.map(i => r[i] - mu[i]); s -= .5 * (p.o.length * Math.log(2 * Math.PI) + ld + quad(e, Si)); }); } return s; };
    let L0 = ll(mu, Sig), it = 0;
    for (it = 1; it <= 5000; it++) {
      const T1 = new Array(d).fill(0), T2 = Array.from({ length: d }, () => new Array(d).fill(0));
      for (const p of P) {
        const So = p.o.map(i => p.o.map(j => Sig[i][j])), Si = p.o.length ? inv(So) : [], B = p.m.map(i => p.o.map(j => sum(p.o.map((l, t) => Sig[i][l] * Si[t][p.o.indexOf(j)]))));
        const Cmm = p.m.map((i, a) => p.m.map((j, c) => Sig[i][j] - sum(p.o.map((l, t) => B[a][t] * Sig[l][j]))));
        p.rs.forEach(r => {
          const x = r.slice(); p.m.forEach((i, a) => { x[i] = mu[i] + sum(p.o.map((l, t) => B[a][t] * (r[l] - mu[l]))); });
          for (let i = 0; i < d; i++) { T1[i] += x[i]; for (let j = 0; j < d; j++) T2[i][j] += x[i] * x[j]; }
          p.m.forEach((i, a) => p.m.forEach((j, c) => T2[i][j] += Cmm[a][c]));
        });
      }
      const mu2 = T1.map(v => v / N), Sig2 = T2.map((r, i) => r.map((v, j) => v / N - mu2[i] * mu2[j]));
      const ch = Math.max(...mu2.map((v, i) => Math.abs(v - mu[i])), ...Sig2.flatMap((r, i) => r.map((v, j) => Math.abs(v - Sig[i][j])))); mu = mu2; Sig = Sig2;
      if (ch < 1e-11) break;
    }
    L0 = ll(mu, Sig);
    return { mu, Sig, ll: L0, N, P, it, d, llf: ll };
  }
  function gradMVN(P, d, th) { // θ = (μ, Σ の下三角) に関する対数尤度の勾配
    const { mu, Sig } = unpack(th, d), g = new Array(th.length).fill(0), vi = (i, j) => d + (i >= j ? i * (i + 1) / 2 + j : j * (j + 1) / 2 + i);
    for (const p of P) {
      const So = p.o.map(i => p.o.map(j => Sig[i][j])), Si = inv(So);
      p.rs.forEach(r => {
        const e = p.o.map(i => r[i] - mu[i]), a = Si.map(row => sum(row.map((v, j) => v * e[j])));
        p.o.forEach((i, t) => g[i] += a[t]);
        p.o.forEach((i, s) => p.o.forEach((j, t) => { if (j > i) return; const v = .5 * (a[s] * a[t] - Si[s][t]); g[vi(i, j)] += i === j ? v : 2 * v; }));
      });
    }
    return g;
  }
  function unpack(th, d) { const mu = th.slice(0, d), Sig = Array.from({ length: d }, () => new Array(d).fill(0)); let k = d; for (let i = 0; i < d; i++) for (let j = 0; j <= i; j++) { Sig[i][j] = Sig[j][i] = th[k++]; } return { mu, Sig }; }
  function pack(mu, Sig) { const th = [...mu]; for (let i = 0; i < Sig.length; i++) for (let j = 0; j <= i; j++) th.push(Sig[i][j]); return th; }
  S.mlReg = function (y, X, names) { // y: 目的変数（NaN 可）、X: 説明変数の列（NaN 可）
    const p = X.length, d = p + 1, Z = y.map((v, i) => [v, ...X.map(c => c[i])]);
    const M = fitMVN(Z), th = pack(M.mu, M.Sig), np = th.length;
    // 観測情報行列（解析的な勾配を数値微分）
    const H = th.map((_, a) => { const h = 1e-5 * Math.max(1, Math.abs(th[a])), tp = [...th], tm = [...th]; tp[a] += h; tm[a] -= h; const gp = gradMVN(M.P, d, tp), gm = gradMVN(M.P, d, tm); return gp.map((v, b) => -(v - gm[b]) / (2 * h)); });
    const Hs = H.map((r, a) => r.map((v, b) => (v + H[b][a]) / 2)), Vth = inv(Hs);
    const reg = t => { const { mu, Sig } = unpack(t, d), Sxx = Sig.slice(1).map(r => r.slice(1)), sxy = Sig.slice(1).map(r => r[0]), Si = inv(Sxx), beta = Si.map(r => sum(r.map((v, j) => v * sxy[j]))), a = mu[0] - sum(beta.map((b, j) => b * mu[j + 1])), s2 = Sig[0][0] - sum(beta.map((b, j) => b * sxy[j]));
      return [a, ...beta, s2, ...beta.map((b, j) => b * Math.sqrt(Sxx[j][j] / Sig[0][0])), 1 - s2 / Sig[0][0]]; };
    const f0 = reg(th), J = f0.map(() => new Array(np).fill(0));
    th.forEach((_, a) => { const h = 1e-6 * Math.max(1, Math.abs(th[a])), tp = [...th], tm = [...th]; tp[a] += h; tm[a] -= h; const fp = reg(tp), fm = reg(tm); fp.forEach((v, r) => J[r][a] = (v - fm[r]) / (2 * h)); });
    const se = f0.map((_, r) => Math.sqrt(Math.max(0, quad(J[r], Vth))));
    const coef = ['切片', ...names].map((nm, j) => { const b = f0[j], s = se[j], z = b / s; return { name: nm, b, se: s, z, p: 2 * S.pnU(Math.abs(z)), L: b - 1.959963984540054 * s, U: b + 1.959963984540054 * s, beta: j ? f0[p + 1 + j] : NaN, betaSE: j ? se[p + 1 + j] : NaN }; });
    // 帰無モデル（y と説明変数が無相関）：y だけ、説明変数だけを別々に推定して対数尤度を足す
    const My = fitMVN(Z.map(r => [r[0]]).filter(r => isFinite(r[0]))), Mx = fitMVN(Z.map(r => r.slice(1)).filter(r => r.some(isFinite)));
    const ll0 = My.ll + Mx.ll, LR = 2 * (M.ll - ll0), npar = np, N = M.N;
    const pats = M.P.map(q => ({ n: q.rs.length, miss: q.m })), nComplete = Z.filter(r => r.every(isFinite)).length;
    return { coef, sigma2: f0[p + 1], sigma2SE: se[p + 1], r2: f0[2 * p + 2], ll: M.ll, ll0, LR, df: p, pLR: S.pchiU(LR, p), aic: -2 * M.ll + 2 * npar, bic: -2 * M.ll + Math.log(N) * npar, npar, N, nComplete, nYobs: Z.filter(r => isFinite(r[0])).length, pats, iter: M.it, mu: M.mu, Sig: M.Sig };
  };
})();

// ===== 多変量 t 分布の確率（Genz の方法：Cholesky 分解 + 準モンテカルロ、外側は自由度の積分）と Dunnett 法 =====
(() => {
  function ninv(p) { // 標準正規分布の逆関数（Acklam の近似 + Newton 補正）
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-7.784894002430293e-03, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [7.784695709041462e-03, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    let q, r, x; if (p < .02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else if (p > 1 - .02425) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    else { q = p - .5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    const e = S.pnorm(x) - p; return x - e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  }
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];
  function chol(R) { const n = R.length, L = R.map(r => r.map(() => 0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = R[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-14)) : s / L[j][j]; } return L; }
  function mvnBox(L, h, W) { // P(|Z_i| < h) for Z ~ N(0, LL')
    const m = L.length; if (m === 1) return 2 * S.pnorm(h / L[0][0]) - 1;
    let tot = 0; const y = new Array(m);
    for (const w of W) {
      let f = 1;
      for (let i = 0; i < m; i++) {
        let t = 0; for (let j = 0; j < i; j++) t += L[i][j] * y[j];
        const lo = S.pnorm((-h - t) / L[i][i]), hi = S.pnorm((h - t) / L[i][i]), e = hi - lo; f *= e; if (f < 1e-300) break;
        if (i < m - 1) y[i] = ninv(Math.min(1 - 1e-16, Math.max(1e-16, lo + w[i] * e)));
      }
      tot += f;
    }
    return tot / W.length;
  }
  function qmcPoints(dim, n = 1500, shifts = 8) { // Richtmyer 格子 + 固定のずらし（毎回同じ結果）+ tent 変換
    const W = []; let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let r = 0; r < shifts; r++) { const sh = Array.from({ length: dim }, rnd); for (let k = 1; k <= n; k++) W.push(sh.map((v, i) => { const u = (k * Math.sqrt(PRIMES[i % PRIMES.length]) + v) % 1; return Math.abs(2 * u - 1); })); }
    return W;
  }
  const WC = {}, getW = dim => WC[dim] || (WC[dim] = qmcPoints(dim, 500, 6));
  const GL = (() => { const n = 40, x = [], w = []; for (let i = 1; i <= n; i++) { let z = Math.cos(Math.PI * (i - .25) / (n + .5)), pp; for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = n * (z * p1 - p2) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break; } x.push(z); w.push(2 / ((1 - z * z) * pp * pp)); } return { x, w }; })();
  S.pmvtBox = function (c, R, df) { // P(max |T_i| < c)、T は相関 R・自由度 df の多変量 t
    const L = chol(R), W = getW(Math.max(1, R.length - 1));
    if (!isFinite(df) || df > 5000) return mvnBox(L, c, W);
    // s = sqrt(χ²/df) の密度で積分（ガウス・ルジャンドル 64 点、区間は分布のほぼ全域）
    const wh = z => Math.max(0, df * Math.pow(1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df)), 3)), lo = Math.sqrt(wh(-8) / df), hi = Math.sqrt(wh(8) / df) * (df < 4 ? 2 : 1);
    const lg = Math.log(2) + (df / 2) * Math.log(df / 2) - S.lgamma(df / 2), dens = s => s <= 0 ? 0 : Math.exp(lg + (df - 1) * Math.log(s) - df * s * s / 2);
    let acc = 0; GL.x.forEach((x, k) => { const sv = lo + (hi - lo) * (x + 1) / 2; acc += GL.w[k] * dens(sv) * mvnBox(L, c * sv, W); });
    return Math.min(1, acc * (hi - lo) / 2);
  };
  S.dunnettP = function (ts, R, df) { return ts.map(t => Math.max(0, Math.min(1, 1 - S.pmvtBox(Math.abs(t), R, df)))); };
})();

// ===== Shapiro-Wilk 検定（Royston 1995、R の shapiro.test と同じ） =====
S.shapiro = function (x) {
  x = x.filter(isFinite).slice().sort((a, b) => a - b); const n = x.length;
  if (n < 3 || n > 5000) return { W: NaN, p: NaN, n };
  const range = x[n - 1] - x[0]; if (range < 1e-19) return { W: NaN, p: NaN, n };
  const poly = (cc, x0) => { let r = cc[0]; if (cc.length > 1) { let p = x0 * cc[cc.length - 1]; for (let j = cc.length - 2; j >= 1; j--) p = (p + cc[j]) * x0; r += p; } return r; };
  const c1 = [0, .221157, -.147981, -2.07119, 4.434685, -2.706056], c2 = [0, .042981, -.293762, -1.752461, 5.682633, -3.582633];
  const nn2 = Math.floor(n / 2), a = new Array(nn2 + 1).fill(0), an = n;
  if (n === 3) a[1] = Math.SQRT1_2;
  else {
    const an25 = an + .25, m = [0]; let summ2 = 0;
    for (let i = 1; i <= nn2; i++) { m[i] = -S.qn((i - .375) / an25); summ2 += m[i] * m[i]; }
    summ2 *= 2; const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(an), a1 = poly(c1, rsn) - m[1] / ssumm2; let i1, fac;
    if (n > 5) { i1 = 3; const a2 = -m[2] / ssumm2 + poly(c2, rsn); fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2)); a[2] = a2; }
    else { i1 = 2; fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1)); }
    a[1] = a1; for (let i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
  }
  const mean = x.reduce((s, v) => s + v, 0) / n, ssq = x.reduce((s, v) => s + (v - mean) ** 2, 0);
  let num = 0; for (let i = 1; i <= nn2; i++) num += a[i] * (x[n - i] - x[i - 1]);
  let W = Math.min(1, num * num / ssq);
  if (n === 3) { const pw = 6 / Math.PI * (Math.asin(Math.sqrt(W)) - Math.PI / 3); return { W, p: Math.max(0, pw), n }; }
  let w1 = Math.log(1 - W), m, s; const xx = Math.log(an);
  if (W >= 1 - 1e-12) return { W, p: 1, n };
  if (n <= 11) { const gamma = poly([-2.273, .459], an); if (w1 >= gamma) return { W, p: 1e-99, n }; w1 = -Math.log(gamma - w1); m = poly([.544, -.39978, .025054, -6.714e-4], an); s = Math.exp(poly([1.3822, -.77857, .062767, -.0020322], an)); }
  else { m = poly([-1.5861, -.31082, -.083751, .0038915], xx); s = Math.exp(poly([-.4803, -.082676, .0030302], xx)); }
  return { W, p: S.pnU((w1 - m) / s), n };
};
