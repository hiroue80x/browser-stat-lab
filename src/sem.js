// ===== 構造方程式モデリング（最尤法、RAM 表現。R の lavaan の既定値に合わせる） =====
S.sem = (() => {
  const { pchiU, pnU, qn, lgamma } = S;
  const sum = a => a.reduce((s, v) => s + v, 0);
  const zeros = (r, c) => Array.from({ length: r }, () => new Array(c).fill(0));
  const mul = (A, B) => { const n = A.length, m = B[0].length, k = B.length, C = zeros(n, m); for (let i = 0; i < n; i++) for (let q = 0; q < k; q++) { const a = A[i][q]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[q][j]; } return C; };
  const T = A => A[0].map((_, j) => A.map(r => r[j]));
  function inv(A) {
    const n = A.length, M = A.map((r, i) => [...r, ...r.map((_, j) => +(i === j))]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-13) throw new Error('singular'); [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }
  function chol(A) {
    const n = A.length, L = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (!(s > 1e-12)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    return L;
  }
  const logdet = L => 2 * sum(L.map((r, i) => Math.log(r[i])));

  // ---- lavaan 風の書式を読む ----
  function parse(text) {
    const spec = { obs: [], lat: [], paths: [], covs: [], notes: [] }, lines = text.replace(/#[^\n]*/g, '').split(/[\n;]/).map(l => l.trim()).filter(Boolean);
    const term = t => { t = t.trim(); const k = t.lastIndexOf('*'); if (k < 0) return { name: t, fix: null }; const m = t.slice(0, k).trim(), name = t.slice(k + 1).trim(); if (m === 'NA') return { name, fix: null, free: true }; const v = Number(m); return isFinite(v) && m !== '' ? { name, fix: v } : { name, fix: null, label: m }; };
    lines.forEach(l => {
      if (l.includes(':=')) { spec.notes.push('「:=」の定義は使いません（間接効果は自動で計算します）。'); return; }
      const op = l.includes('=~') ? '=~' : l.includes('~~') ? '~~' : l.includes('~') ? '~' : null;
      if (!op) throw new Error(`この行を読めません：「${l}」（=~、~、~~ のどれかが必要です）`);
      const [L, R] = l.split(op), lhs = L.split('+').map(s => s.trim()).filter(Boolean), rhs = R.split('+').map(term).filter(t => t.name && t.name !== '1');
      if (!lhs.length || !rhs.length) throw new Error(`この行を読めません：「${l}」`);
      lhs.forEach(a => rhs.forEach(t => {
        if (op === '=~') { if (!spec.lat.includes(a)) spec.lat.push(a); spec.paths.push({ from: a, to: t.name, fix: t.fix, free: t.free, load: true }); }
        else if (op === '~') spec.paths.push({ from: t.name, to: a, fix: t.fix });
        else spec.covs.push({ a, b: t.name, fix: t.fix });
      }));
    });
    const all = [...spec.paths.flatMap(p => [p.from, p.to]), ...spec.covs.flatMap(c => [c.a, c.b])];
    all.forEach(v => { if (!spec.lat.includes(v) && !spec.obs.includes(v)) spec.obs.push(v); });
    spec.autoCov = 'lavaan'; return spec;
  }

  // ---- モデルを組み立てる ----
  function build(spec, Smat) {
    const ov = spec.obs, lv = spec.lat, names = [...ov, ...lv], p = ov.length, n = names.length, ix = v => names.indexOf(v);
    const par = [], key = new Set(), add = (type, i, j, free, value, role) => { const k = type + (type === 'S' ? Math.min(i, j) + ',' + Math.max(i, j) : i + ',' + j); if (key.has(k)) return; key.add(k); par.push({ type, i: type === 'S' ? Math.max(i, j) : i, j: type === 'S' ? Math.min(i, j) : j, free, value, role }); };
    const incoming = new Set(spec.paths.map(p => ix(p.to)));
    // 潜在変数の尺度：最初の観測変数への矢印を 1 に固定
    const marker = {};
    lv.forEach(l => {
      const out = spec.paths.filter(q => q.from === l), fixedVar = (spec.covs || []).some(c => c.a === l && c.b === l && c.fix != null);
      if (out.some(q => q.fix != null) || fixedVar) return;
      const m = out.find(q => !q.free && ix(q.to) < p) || out.find(q => !q.free); if (m) marker[l + '>' + m.to] = 1;
    });
    spec.paths.forEach(q => { const i = ix(q.to), j = ix(q.from), mk = marker[q.from + '>' + q.to]; add('A', i, j, q.fix == null && !mk, q.fix != null ? q.fix : mk ? 1 : 0, lv.includes(q.from) && i < p ? 'load' : 'reg'); });
    (spec.covs || []).forEach(c => add('S', ix(c.a), ix(c.b), c.fix == null, c.fix ?? 0, c.a === c.b ? 'var' : 'cov'));
    const exoLat = lv.map(ix).filter(i => !incoming.has(i)), indicators = new Set(spec.paths.filter(q => lv.includes(q.from) && ix(q.to) < p).map(q => ix(q.to)));
    const exoObs = ov.map(ix).filter(i => !incoming.has(i) && !indicators.has(i) && spec.paths.some(q => ix(q.from) === i));
    for (let i = 0; i < n; i++) add('S', i, i, true, 0, 'var');
    const pairs = (arr, role) => arr.forEach((a, k) => arr.slice(k + 1).forEach(b => add('S', a, b, true, 0, role)));
    if (spec.autoCov !== 'none') { pairs(exoLat, 'cov'); pairs(exoObs, 'cov'); if (spec.autoCov === 'all') exoLat.forEach(a => exoObs.forEach(b => add('S', a, b, true, 0, 'cov'))); }
    // 初期値
    const varOf = i => i < p ? Smat[i][i] : null, mk = {}; Object.keys(marker).forEach(k => { const [l, o] = k.split('>'); mk[l] = ix(o); });
    const lvScale = l => { const m = mk[lv[l - p]]; return m != null && m < p ? Smat[m][m] * .6 : .05; };
    par.forEach(q => {
      if (!q.free) return;
      if (q.type === 'A' && q.role === 'load') { const m = mk[names[q.j]]; q.value = m != null && m < p ? Smat[q.i][m] / lvScale(q.j) : Math.sqrt(.5 * Smat[q.i][q.i]); }
      else if (q.type === 'S' && q.i === q.j) q.value = q.i < p ? (exoObs.includes(q.i) ? Smat[q.i][q.i] : .5 * Smat[q.i][q.i]) : lvScale(q.i) * (incoming.has(q.i) ? .5 : 1);
      else if (q.type === 'S' && q.i < p && q.j < p && exoObs.includes(q.i) && exoObs.includes(q.j)) q.value = Smat[q.i][q.j];
    });
    return { names, ov, lv, p, n, par, exoObs, exoLat, incoming, indicators };
  }
  function matrices(M, theta) {
    const A = zeros(M.n, M.n), Sm = zeros(M.n, M.n); let k = 0;
    M.par.forEach(q => { const v = q.free ? theta[k++] : q.value; if (q.type === 'A') A[q.i][q.j] = v; else { Sm[q.i][q.j] = v; Sm[q.j][q.i] = v; } });
    const IA = A.map((r, i) => r.map((v, j) => (i === j ? 1 : 0) - v)), B = inv(IA), E = mul(mul(B, Sm), T(B));
    return { A, Sm, B, E, Sig: E.slice(0, M.p).map(r => r.slice(0, M.p)) };
  }
  function dSigma(M, mt, q) { // ∂Σ / ∂θ（観測変数部分）
    const p = M.p, B = mt.B, E = mt.E, D = zeros(p, p);
    if (q.type === 'A') { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) D[a][b] = B[a][q.i] * E[q.j][b] + E[a][q.j] * B[b][q.i]; }
    else if (q.i === q.j) { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) D[a][b] = B[a][q.i] * B[b][q.i]; }
    else { for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) D[a][b] = B[a][q.i] * B[b][q.j] + B[a][q.j] * B[b][q.i]; }
    return D;
  }
  const trProd = (X, Y) => { let s = 0; for (let i = 0; i < X.length; i++) for (let j = 0; j < X.length; j++) s += X[i][j] * Y[j][i]; return s; };
  function fml(Sig, Smat, ldS) { const L = chol(Sig); if (!L) return Infinity; const Si = inv(Sig); return logdet(L) + trProd(Smat, Si) - ldS - Sig.length; }

  // 非心カイ二乗分布の下側確率
  function pnchisq(x, df, ncp) {
    if (ncp <= 0) return 1 - pchiU(x, df); const h = ncp / 2; let s = 0;
    const jmax = Math.ceil(h + 12 * Math.sqrt(h) + 60);
    for (let j = 0; j <= jmax; j++) { const w = Math.exp(-h + j * Math.log(h) - lgamma(j + 1)); s += w * (1 - pchiU(x, df + 2 * j)); }
    return s;
  }

  function optimize(M, Smat, ldS, theta, strict) { // フィッシャー・スコアリング（失敗時は strict なら例外、そうでなければ null）
    const free = M.par.filter(q => q.free), evalF = th => { try { const m = matrices(M, th); return fml(m.Sig, Smat, ldS); } catch (e) { return Infinity; } };
    let F = evalF(theta), it = 0, conv = false;
    if (!isFinite(F)) { theta = free.map(q => q.type === 'S' && q.i === q.j ? Math.abs(q.value) || .1 : 0); F = evalF(theta); }
    if (!isFinite(F)) { if (strict) throw new Error('初期値でモデルの共分散行列が計算できません。モデルの指定を確認してください。'); return null; }
    for (it = 1; it <= (strict ? 500 : 100); it++) {
      const mt = matrices(M, theta), Si = inv(mt.Sig), Om = mul(mul(Si, mt.Sig.map((r, i) => r.map((v, j) => v - Smat[i][j]))), Si);
      const D = free.map(q => dSigma(M, mt, q)), MS = D.map(d => mul(Si, d)), g = D.map(d => trProd(Om, d)), H = MS.map(a => MS.map(b => trProd(a, b)));
      let Hinv; try { Hinv = inv(H); } catch (e) { if (strict) throw new Error('モデルが識別されていません（情報行列が特異）。潜在変数の尺度（1 に固定する矢印）や、推定するパラメータの数を確認してください。'); return null; }
      const step = Hinv.map(r => sum(r.map((v, j) => v * g[j])));
      let a = 1, Fn, tn; for (let h = 0; h < 30; h++) { tn = theta.map((v, k) => v - a * step[k]); Fn = evalF(tn); if (Fn <= F + 1e-12) break; a /= 2; }
      if (!(Fn <= F + 1e-12)) { conv = Math.max(...g.map(Math.abs)) < 1e-5; break; }
      const dF = F - Fn; theta = tn; F = Fn;
      if (dF < 1e-13 && Math.max(...step.map(Math.abs)) < 1e-7) { conv = true; break; }
    }
    return { theta, F, it, conv };
  }
  function derived(M, theta, pairs) { // 自由パラメータ（推定値・標準化）と間接効果・総合効果
    const m = matrices(M, theta), E = m.E, T = m.B.map((r, i) => r.map((v, j) => v - (i === j))); let k = 0; const par = [];
    M.par.forEach(q => { if (!q.free) return; const v = theta[k++]; par.push([v, q.type === 'A' ? v * Math.sqrt(E[q.j][q.j] / E[q.i][q.i]) : v / Math.sqrt(E[q.i][q.i] * E[q.j][q.j])]); });
    const ind = pairs.map(([i, j]) => { const sc = Math.sqrt(E[j][j] / E[i][i]), v = T[i][j] - m.A[i][j]; return [v, v * sc, T[i][j], T[i][j] * sc]; });
    return { par, ind };
  }
  function normInter(t, alpha) { // R の boot パッケージ norm.inter（lavaan のブートストラップ信頼区間と同じ補間）
    t = t.filter(isFinite).sort((a, b) => a - b); const R = t.length;
    return alpha.map(al => { const rk = (R + 1) * al, k = Math.trunc(rk); if (Math.abs(rk - Math.round(rk)) < 1e-10) return t[Math.min(R, Math.max(1, Math.round(rk))) - 1]; if (k <= 0) return t[0]; if (k >= R) return t[R - 1];
      const q1 = qn(1 - al), q2 = qn(1 - k / (R + 1)), q3 = qn(1 - (k + 1) / (R + 1)); return t[k - 1] + (q1 - q2) / (q3 - q2) * (t[k] - t[k - 1]); });
  }
  function bootCI(t, t0) {
    const v = t.filter(isFinite), n = v.length, m = sum(v) / n, se = Math.sqrt(sum(v.map(x => (x - m) ** 2)) / (n - 1)), perc = normInter(v, [.025, .975]);
    const w = qn(1 - v.filter(x => x < t0).length / n), za = [qn(.975), qn(.025)], adj = za.map(z => pnU(-(w + (w + z)))), bc = isFinite(w) ? normInter(v, adj) : [NaN, NaN];
    return { se, perc, bc };
  }
  function lcg(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function bootSetup(F, data, B, seed = 20261117) {
    const M = F.M, theta0 = F.est.filter(e => e.free).map(e => e.est), N = data[0].length, R = lcg(seed);
    const pairs = F.indirect.map(e => [M.names.indexOf(e.to), M.names.indexOf(e.from)]);
    return { M, theta0, data, N, B, pairs, done: 0, fail: 0, nextIdx: () => Array.from({ length: N }, () => Math.floor(R() * N)), out: [] };
  }
  function bootStep(ctx, idx) {
    const d = ctx.data.map(c => idx.map(i => c[i])), N = ctx.N, mu = d.map(c => sum(c) / N), Sm = d.map((a, i) => d.map((b, j) => { let s = 0; for (let k = 0; k < N; k++) s += (a[k] - mu[i]) * (b[k] - mu[j]); return s / N; }));
    const L = chol(Sm); ctx.done++; if (!L) { ctx.fail++; return; }
    const o = optimize(ctx.M, Sm, logdet(L), [...ctx.theta0], false); if (!o || !o.conv) { ctx.fail++; return; }
    ctx.out.push(derived(ctx.M, o.theta, ctx.pairs));
  }
  function bootSummary(ctx, F) {
    const fr = F.est.filter(e => e.free), O = ctx.out;
    const par = fr.map((e, k) => e.fixedX ? null : { e, raw: bootCI(O.map(o => o.par[k][0]), e.est), std: bootCI(O.map(o => o.par[k][1]), e.std) });
    const ind = F.indirect.map((e, k) => ({ e, raw: bootCI(O.map(o => o.ind[k][0]), e.est), std: bootCI(O.map(o => o.ind[k][1]), e.std), tot: bootCI(O.map(o => o.ind[k][2]), e.total), totStd: bootCI(O.map(o => o.ind[k][3]), e.totalStd) }));
    return { B: ctx.B, ok: O.length, fail: ctx.fail, par: par.filter(Boolean), ind };
  }
  function fit(spec, data) { // data: 観測変数ごとの値の配列（リストワイズ済み）
    const N = data[0].length, p = spec.obs.length, mean = v => sum(v) / v.length;
    const mu = data.map(mean), Smat = data.map((a, i) => data.map((b, j) => sum(a.map((v, k) => (v - mu[i]) * (b[k] - mu[j]))) / N));
    const LS = chol(Smat); if (!LS) throw new Error('観測変数の共分散行列が正定値ではありません（同じ情報をもつ変数が重なっていないか確認してください）。');
    const ldS = logdet(LS), M = build(spec, Smat), free = M.par.filter(q => q.free), npar = free.length, pstar = p * (p + 1) / 2, df = pstar - npar;
    if (df < 0) throw new Error(`自由度が負です（推定するパラメータ ${npar} 個 ＞ 情報の数 ${pstar} 個）。モデルが識別されません。矢印や共分散を減らしてください。`);
    let theta = free.map(q => q.value), H, Hinv, mt;
    const opt = optimize(M, Smat, ldS, theta, true); theta = opt.theta; const F = opt.F, it = opt.it, conv = opt.conv;
    mt = matrices(M, theta);
    { const Si = inv(mt.Sig), D = free.map(q => dSigma(M, mt, q)), MS = D.map(d => mul(Si, d)); H = MS.map(a => MS.map(b => trProd(a, b))); Hinv = inv(H); }
    const V = Hinv.map(r => r.map(v => v * 2 / N)), zc = qn(0.025), E = mt.E;
    let k = 0;
    const est = M.par.map(q => {
      const fx = q.type === 'S' && M.exoObs.includes(q.i) && M.exoObs.includes(q.j), v = q.free ? theta[k] : q.value, se = q.free && !fx ? Math.sqrt(V[k][k]) : NaN; if (q.free) k++;
      const std = q.type === 'A' ? v * Math.sqrt(E[q.j][q.j] / E[q.i][q.i]) : v / Math.sqrt(E[q.i][q.i] * E[q.j][q.j]);
      return { ...q, from: M.names[q.j], to: M.names[q.i], est: v, se, z: v / se, p: isFinite(se) ? 2 * pnU(Math.abs(v / se)) : NaN, L: v - zc * se, U: v + zc * se, std, fixedX: fx };
    });
    const endo = [...M.incoming], r2 = endo.map(i => ({ name: M.names[i], i, r2: 1 - mt.Sm[i][i] / E[i][i] }));
    // 適合度
    const chi = df === 0 || N * F < 1e-9 ? Math.max(0, N * F < 1e-9 ? 0 : N * F) : N * F, pv = df > 0 ? pchiU(chi, df) : NaN;
    const xs = M.exoObs, Sb = Smat.map((r, i) => r.map((v, j) => i === j || (xs.includes(i) && xs.includes(j)) ? v : 0));
    const chiB = N * fml(Sb, Smat, ldS), dfB = pstar - p - xs.length * (xs.length - 1) / 2;
    const cfi = 1 - Math.max(chi - df, 0) / Math.max(chiB - dfB, chi - df, 0), tli = df > 0 ? (chiB / dfB - chi / df) / (chiB / dfB - 1) : NaN;
    const rmsea = df > 0 ? Math.sqrt(Math.max(chi - df, 0) / (df * N)) : 0;
    const solveL = target => { if (pnchisq(chi, df, 0) < target) return 0; let lo = 0, hi = Math.max(10, chi * 4); while (pnchisq(chi, df, hi) > target) hi *= 2; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (pnchisq(chi, df, m) > target) lo = m; else hi = m; } return (lo + hi) / 2; };
    const rL = df > 0 ? Math.sqrt(solveL(.95) / (df * N)) : NaN, rU = df > 0 ? Math.sqrt(solveL(.05) / (df * N)) : NaN, pclose = df > 0 ? 1 - pnchisq(chi, df, N * df * .0025) : NaN;
    const Sig = mt.Sig; let sr = 0; for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) sr += ((Smat[i][j] - Sig[i][j]) / Math.sqrt(Smat[i][i] * Smat[j][j])) ** 2;
    const srmr = Math.sqrt(sr / pstar);
    const SiS = mul(inv(Sig), Smat), Rm = SiS.map((r, i) => r.map((v, j) => v - (i === j))), gfi = 1 - trProd(Rm, Rm) / trProd(SiS, SiS), agfi = df > 0 ? 1 - pstar / df * (1 - gfi) : NaN;
    const nx = xs.length * (xs.length + 1) / 2, nparRep = npar - nx;
    const LSig = chol(Sig), logl = -N / 2 * (logdet(LSig) + trProd(Smat, inv(Sig)) + p * Math.log(2 * Math.PI));
    const xS = xs.map(i => xs.map(j => Smat[i][j])), loglX = xs.length ? -N / 2 * (logdet(chol(xS)) + xs.length + xs.length * Math.log(2 * Math.PI)) : 0;
    const ll = logl - loglX, aic = -2 * ll + 2 * nparRep, bic = -2 * ll + Math.log(N) * nparRep;
    // 間接効果（デルタ法）
    const struct = M.names.map((_, i) => i).filter(i => !(i < M.p && M.indicators.has(i)));
    const indOf = th => { const m = matrices(M, th), Tt = m.B.map((r, i) => r.map((v, j) => v - (i === j))); return { ind: Tt.map((r, i) => r.map((v, j) => v - m.A[i][j])), tot: Tt, E: m.E }; };
    const base = indOf(theta), indirect = [];
    struct.forEach(i => struct.forEach(j => {
      if (i === j || Math.abs(base.ind[i][j]) < 1e-10) return;
      const gr = theta.map((_, q) => { const h = 1e-6 * Math.max(1, Math.abs(theta[q])), tp = [...theta], tm = [...theta]; tp[q] += h; tm[q] -= h; return (indOf(tp).ind[i][j] - indOf(tm).ind[i][j]) / (2 * h); });
      let vv = 0; gr.forEach((a, q) => gr.forEach((b, r) => vv += a * V[q][r] * b)); const se = Math.sqrt(vv), v = base.ind[i][j], sc = Math.sqrt(E[j][j] / E[i][i]);
      indirect.push({ from: M.names[j], to: M.names[i], est: v, se, z: v / se, p: 2 * pnU(Math.abs(v / se)), L: v - zc * se, U: v + zc * se, std: v * sc, total: base.tot[i][j], totalStd: base.tot[i][j] * sc, direct: mt.A[i][j] });
    }));
    // 修正指標
    const mi = [], cands = [], has = new Set(M.par.map(q => q.type + (q.type === 'S' ? Math.max(q.i, q.j) + ',' + Math.min(q.i, q.j) : q.i + ',' + q.j)));
    const loadOf = new Set(est.filter(e => e.role === 'load').map(e => e.j));
    loadOf.forEach(l => [...M.indicators].forEach(o => { if (!has.has('A' + o + ',' + l)) cands.push({ type: 'A', i: o, j: l, kind: 'load' }); }));
    const ind = [...M.indicators].sort((a, b) => a - b); ind.forEach((a, x) => ind.slice(x + 1).forEach(b => { if (!has.has('S' + b + ',' + a)) cands.push({ type: 'S', i: b, j: a, kind: 'cov' }); }));
    if (cands.length) {
      const Si = inv(Sig), Om = mul(mul(Si, Sig.map((r, i) => r.map((v, j) => v - Smat[i][j]))), Si), Df = free.map(q => dSigma(M, mt, q)).map(d => mul(Si, d));
      cands.forEach(c => {
        const d = dSigma(M, mt, c), Md = mul(Si, d), g = trProd(Om, d), s = -N / 2 * g, Jcc = N / 2 * trProd(Md, Md), Jcf = Df.map(x => N / 2 * trProd(Md, x));
        let q = 0; Jcf.forEach((a, x) => Jcf.forEach((b, y) => q += a * (Hinv[x][y] * 2 / N) * b)); const den = Jcc - q; if (!(den > 1e-10)) return;
        const MI = s * s / den, epc = s / den; mi.push({ kind: c.kind, a: M.names[c.kind === 'load' ? c.j : c.j], b: M.names[c.i], mi: MI, epc, sepc: c.type === 'A' ? epc * Math.sqrt(E[c.j][c.j] / E[c.i][c.i]) : epc / Math.sqrt(mt.Sm[c.i][c.i] * mt.Sm[c.j][c.j]) });
      });
      mi.sort((a, b) => b.mi - a.mi);
    }
    const heywood = est.filter(e => e.type === 'S' && e.i === e.j && e.est < 0).map(e => e.to);
    return { N, p, npar, nparRep, df, chi, pv, chiB, dfB, cfi, tli, rmsea, rL, rU, pclose, srmr, gfi, agfi, aic, bic, ll, est, r2, indirect, mi, M, conv, iter: it, heywood, S: Smat, Sig };
  }
  return { parse, fit, build, pnchisq, bootSetup, bootStep, bootSummary, normInter, bootCI };
})();
if (typeof module !== 'undefined') module.exports = S;
