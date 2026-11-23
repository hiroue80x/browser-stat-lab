// ===== 統計計算エンジン（依存なし） =====
const S = (() => {
  const LN2PI = Math.log(2 * Math.PI);
  function lgamma(x) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * LN2PI + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function erfc(x) { // 高精度 (Numerical Recipes erfcc 改良: W. J. Cody 近似の代わりにChebyshev)
    const z = Math.abs(x), t = 2 / (2 + z);
    const ty = 4 * t - 2;
    const cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3,
      -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
      1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
      -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13,
      3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17];
    let d = 0, dd = 0;
    for (let j = cof.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + cof[j]; dd = tmp; }
    const r = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd);
    return x >= 0 ? r : 2 - r;
  }
  const pnorm = z => 0.5 * erfc(-z / Math.SQRT2);          // P(Z<=z)
  const dnorm = z => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(x, a, b) { // 正則化不完全ベータ I_x(a,b)
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function igammaP(a, x) { // 正則化下側不完全ガンマ
    if (x <= 0) return 0;
    if (x < a + 1) {
      let ap = a, sum = 1 / a, del = sum;
      for (let n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
      return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
    }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  // 上側確率
  const pt2 = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);              // 両側 P(|T|>=|t|)
  const ptU = (t, df) => t >= 0 ? pt2(t, df) / 2 : 1 - pt2(t, df) / 2;       // P(T>=t)
  const pfU = (f, d1, d2) => f <= 0 ? 1 : ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
  const pchiU = (x, df) => x <= 0 ? 1 : 1 - igammaP(df / 2, x / 2);
  const pnU = z => pnorm(-z);
  function invert(fU, p, lo, hi) { // 上側確率 fU(x)=p となる x（fU は単調減少）
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (fU(m) > p) lo = m; else hi = m; if (hi - lo < 1e-12 * Math.max(1, Math.abs(m))) break; }
    return (lo + hi) / 2;
  }
  const qt = (p, df) => invert(t => ptU(t, df), p, -1e3, 1e3);   // 上側 p 点
  const qn = p => invert(pnU, p, -40, 40);
  const qf = (p, a, b) => invert(f => pfU(f, a, b), p, 0, 1e6);
  const qchi = (p, df) => invert(x => pchiU(x, df), p, 0, 1e5);

  // ステューデント化範囲分布（数値積分）
  function simpson(f, a, b, n) { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; }
  function wprob(w, k) {
    if (w <= 0) return 0;
    return k * simpson(z => dnorm(z) * Math.pow(Math.max(0, pnorm(z) - pnorm(z - w)), k - 1), -8, 8 + w, 400);
  }
  function ptukey(q, k, df) { // P(Q<=q)
    if (q <= 0) return 0;
    if (!isFinite(df) || df > 20000) return Math.min(1, wprob(q, k));
    const lc = (df / 2) * Math.log(df) - lgamma(df / 2) - (df / 2 - 1) * Math.LN2;
    const dens = s => s <= 0 ? 0 : Math.exp(lc + (df - 1) * Math.log(s) - df * s * s / 2);
    const smax = 1 + 9 / Math.sqrt(2 * df) + (df < 6 ? 4 : 0);
    const r = simpson(s => dens(s) * wprob(q * s, k), 0, smax, 400);
    return Math.min(1, Math.max(0, r));
  }
  const ptukeyU = (q, k, df) => Math.max(0, 1 - ptukey(q, k, df));

  // ===== 基本ツール =====
  const num = a => a.filter(v => typeof v === 'number' && isFinite(v));
  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => sum(a) / a.length;
  const ss = a => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0); };
  const vari = a => ss(a) / (a.length - 1);
  const sd = a => Math.sqrt(vari(a));
  function quantile(a, p) { const s = [...a].sort((x, y) => x - y); const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); }
  function ranks(a) { // 平均順位
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); const ties = [];
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let t = i; t <= j; t++) r[idx[t][1]] = rk; if (j > i) ties.push(j - i + 1); i = j + 1; }
    return { r, ties };
  }
  const tieSum = ties => ties.reduce((s, t) => s + t ** 3 - t, 0);

  function describe(a) {
    const n = a.length, m = mean(a), s = n > 1 ? sd(a) : NaN, se = s / Math.sqrt(n);
    const tc = n > 1 ? qt(0.025, n - 1) : NaN;
    let g1 = NaN, g2 = NaN;
    if (n > 2) { const m2 = ss(a) / n, m3 = a.reduce((q, v) => q + (v - m) ** 3, 0) / n; g1 = m3 / m2 ** 1.5 * Math.sqrt(n * (n - 1)) / (n - 2); }
    if (n > 3) { const s4 = a.reduce((q, v) => q + ((v - m) / s) ** 4, 0); g2 = n * (n + 1) / ((n - 1) * (n - 2) * (n - 3)) * s4 - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3)); }
    return { n, mean: m, sd: s, se, ciL: m - tc * se, ciU: m + tc * se, min: Math.min(...a), q1: quantile(a, 0.25), median: quantile(a, 0.5), q3: quantile(a, 0.75), max: Math.max(...a), skew: g1, kurt: g2 };
  }

  // ===== 2群 =====
  function tTest(a, b) {
    const n1 = a.length, n2 = b.length, m1 = mean(a), m2 = mean(b), v1 = vari(a), v2 = vari(b);
    const df = n1 + n2 - 2, sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / df, se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    const t = (m1 - m2) / se, tcrit = qt(0.025, df);
    const sew = Math.sqrt(v1 / n1 + v2 / n2), tw = (m1 - m2) / sew;
    const dfw = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
    const F = v1 / v2, pF = 2 * Math.min(pfU(F, n1 - 1, n2 - 1), 1 - pfU(F, n1 - 1, n2 - 1));
    const d = (m1 - m2) / Math.sqrt(sp2), g = d * (1 - 3 / (4 * df - 1));
    return { diff: m1 - m2, student: { t, df, p: pt2(t, df), ciL: m1 - m2 - tcrit * se, ciU: m1 - m2 + tcrit * se },
      welch: { t: tw, df: dfw, p: pt2(tw, dfw), ciL: m1 - m2 - qt(0.025, dfw) * sew, ciU: m1 - m2 + qt(0.025, dfw) * sew },
      F: { F, df1: n1 - 1, df2: n2 - 1, p: Math.min(1, pF) }, d, g };
  }
  function exactUDist(n1, n2) { // U の分布（同順位なし）
    let dp = [[1]]; // dp[i][j] 配列: 係数
    const memo = new Map();
    function f(m, n) { const key = m + ',' + n; if (memo.has(key)) return memo.get(key);
      let res; if (m === 0 || n === 0) res = [1]; else { const A = f(m - 1, n), B = f(m, n - 1); res = new Array(m * n + 1).fill(0); for (let i = 0; i < A.length; i++) res[i + n] += A[i]; for (let i = 0; i < B.length; i++) res[i] += B[i]; }
      memo.set(key, res); return res; }
    return f(n1, n2);
  }
  function mannWhitney(a, b) {
    const n1 = a.length, n2 = b.length, N = n1 + n2, { r, ties } = ranks([...a, ...b]);
    const R1 = sum(r.slice(0, n1)), U1 = R1 - n1 * (n1 + 1) / 2, U = Math.min(U1, n1 * n2 - U1);
    const mu = n1 * n2 / 2, sig = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tieSum(ties) / (N * (N - 1))));
    const z = (Math.abs(U1 - mu) - 0.5) / sig, p = Math.min(1, 2 * pnU(Math.max(0, z)));
    let pExact = null;
    if (!ties.length && n1 + n2 <= 60) { const dist = exactUDist(n1, n2), tot = dist.reduce((s, v) => s + v, 0); let c = 0; for (let i = 0; i <= U; i++) c += dist[i]; pExact = Math.min(1, 2 * c / tot); }
    return { U1, U, R1, R2: sum(r.slice(n1)), z: (U1 - mu) / sig, zcc: z * Math.sign(U1 - mu || 1), p, pExact, r: Math.abs(U1 - mu) / sig / Math.sqrt(N) };
  }
  function pairedT(a, b) {
    const d = a.map((v, i) => v - b[i]), n = d.length, md = mean(d), s = sd(d), se = s / Math.sqrt(n), t = md / se, tc = qt(0.025, n - 1);
    return { n, md, sd: s, t, df: n - 1, p: pt2(t, n - 1), ciL: md - tc * se, ciU: md + tc * se, dz: md / s };
  }
  function signedRankDist(n) { const max = n * (n + 1) / 2; let c = new Array(max + 1).fill(0); c[0] = 1; for (let k = 1; k <= n; k++) for (let s = max; s >= k; s--) c[s] += c[s - k]; return c; }
  function wilcoxon(a, b) {
    const d = a.map((v, i) => v - b[i]).filter(v => v !== 0), n = d.length;
    if (n === 0) return { n: 0, Wp: 0, Wm: 0, z: 0, p: 1, pExact: 1 };
    const { r, ties } = ranks(d.map(Math.abs));
    const Wp = sum(r.filter((_, i) => d[i] > 0)), Wm = n * (n + 1) / 2 - Wp, W = Math.min(Wp, Wm);
    const mu = n * (n + 1) / 4, sig = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieSum(ties) / 48);
    const z = (Math.abs(Wp - mu) - 0.5) / sig, p = Math.min(1, 2 * pnU(Math.max(0, z)));
    let pExact = null;
    if (!ties.length && n <= 50) { const c = signedRankDist(n), tot = 2 ** n; let cum = 0; for (let i = 0; i <= W; i++) cum += c[i]; pExact = Math.min(1, 2 * cum / tot); }
    return { n, Wp, Wm, z: (Wp - mu) / sig, p, pExact, r: Math.abs(Wp - mu) / sig / Math.sqrt(n), zeros: a.length - n };
  }
  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
  function signTest(a, b) {
    const d = a.map((v, i) => v - b[i]).filter(v => v !== 0), n = d.length, pos = d.filter(v => v > 0).length, k = Math.min(pos, n - pos);
    let c = 0; for (let i = 0; i <= k; i++) c += Math.exp(lchoose(n, i) - n * Math.LN2);
    return { n, pos, neg: n - pos, p: Math.min(1, 2 * c) };
  }

  // ===== 多群（独立） =====
  function anova1(groups) {
    const k = groups.length, all = groups.flat(), N = all.length, gm = mean(all);
    const ssb = groups.reduce((s, g) => s + g.length * (mean(g) - gm) ** 2, 0), ssw = groups.reduce((s, g) => s + ss(g), 0);
    const dfb = k - 1, dfw = N - k, msb = ssb / dfb, msw = ssw / dfw, F = msb / msw;
    const eta2 = ssb / (ssb + ssw), omega2 = (ssb - dfb * msw) / (ssb + ssw + msw);
    // Welch の分散分析
    const w = groups.map(g => g.length / vari(g)), sw = sum(w), mw = sum(groups.map((g, i) => w[i] * mean(g))) / sw;
    const A = sum(groups.map((g, i) => w[i] * (mean(g) - mw) ** 2)) / (k - 1);
    const lam = sum(groups.map((g, i) => (1 - w[i] / sw) ** 2 / (g.length - 1)));
    const Fw = A / (1 + 2 * (k - 2) / (k * k - 1) * lam), dfw2 = (k * k - 1) / (3 * lam);
    return { k, N, ssb, ssw, sst: ssb + ssw, dfb, dfw, msb, msw, F, p: pfU(F, dfb, dfw), eta2, omega2, welch: { F: Fw, df1: k - 1, df2: dfw2, p: pfU(Fw, k - 1, dfw2) } };
  }
  function bartlett(groups) {
    const k = groups.length, N = sum(groups.map(g => g.length)), sp2 = sum(groups.map(g => (g.length - 1) * vari(g))) / (N - k);
    const num_ = (N - k) * Math.log(sp2) - sum(groups.map(g => (g.length - 1) * Math.log(vari(g))));
    const C = 1 + (sum(groups.map(g => 1 / (g.length - 1))) - 1 / (N - k)) / (3 * (k - 1));
    const chi = num_ / C; return { chi, df: k - 1, p: pchiU(chi, k - 1) };
  }
  function levene(groups) { // Brown-Forsythe（中央値）
    const z = groups.map(g => { const md = quantile(g, 0.5); return g.map(v => Math.abs(v - md)); });
    const r = anova1(z); return { F: r.F, df1: r.dfb, df2: r.dfw, p: r.p };
  }
  function kruskal(groups) {
    const all = groups.flat(), N = all.length, { r, ties } = ranks(all); let off = 0, H = 0; const R = [];
    groups.forEach(g => { const Ri = sum(r.slice(off, off + g.length)); R.push(Ri / g.length); H += Ri * Ri / g.length; off += g.length; });
    H = 12 / (N * (N + 1)) * H - 3 * (N + 1); const C = 1 - tieSum(ties) / (N ** 3 - N); H /= C;
    return { H, df: groups.length - 1, p: pchiU(H, groups.length - 1), meanRanks: R, eps2: H / (N - 1) };
  }
  function pairs(k) { const p = []; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) p.push([i, j]); return p; }
  function postHoc(groups) {
    const k = groups.length, A = anova1(groups), mse = A.msw, df = A.dfw, P = pairs(k), m = P.length;
    const all = groups.flat(), N = all.length, { r: rAll, ties: tAll } = ranks(all), mr = []; let off = 0;
    groups.forEach(g => { mr.push(mean(rAll.slice(off, off + g.length))); off += g.length; });
    const Cdunn = tieSum(tAll) / (12 * (N - 1));
    return P.map(([i, j]) => {
      const a = groups[i], b = groups[j], diff = mean(a) - mean(b), h = 1 / a.length + 1 / b.length;
      const q = Math.abs(diff) / Math.sqrt(mse / 2 * h);
      const tB = Math.abs(diff) / Math.sqrt(mse * h);
      const Fs = diff * diff / (mse * h) / (k - 1);
      // Steel-Dwass
      const n1 = a.length, n2 = b.length, n = n1 + n2, { r, ties } = ranks([...a, ...b]);
      const R1 = sum(r.slice(0, n1)), E = n1 * (n + 1) / 2;
      const V = n1 * n2 / (n * (n - 1)) * (sum(r.map(x => x * x)) - n * (n + 1) ** 2 / 4);
      const tsd = Math.abs(R1 - E) / Math.sqrt(V);
      // Dunn
      const zd = Math.abs(mr[i] - mr[j]) / Math.sqrt((N * (N + 1) / 12 - Cdunn) * h);
      return { i, j, diff,
        tukey: { q, p: ptukeyU(q, k, df) },
        bonf: { t: tB, p: Math.min(1, pt2(tB, df) * m) },
        scheffe: { F: Fs, p: pfU(Fs, k - 1, df) },
        steelDwass: { t: tsd, p: ptukeyU(tsd * Math.SQRT2, k, Infinity) },
        dunn: { z: zd, p: Math.min(1, 2 * pnU(zd) * m) } };
    });
  }
  function padjust(ps, method) { // R の p.adjust と同じ（sidak は 1 − (1 − p)^m）
    const m = ps.length, idx = ps.map((p, i) => i);
    if (method === 'none') return ps.slice();
    if (method === 'bonferroni') return ps.map(p => Math.min(1, p * m));
    if (method === 'sidak') return ps.map(p => 1 - Math.pow(1 - p, m));
    if (method === 'holm') { const o = idx.sort((a, b) => ps[a] - ps[b]), out = new Array(m); let mx = 0; o.forEach((i, r) => { mx = Math.max(mx, Math.min(1, (m - r) * ps[i])); out[i] = mx; }); return out; }
    const o = idx.sort((a, b) => ps[b] - ps[a]), out = new Array(m); let mn = 1; // 降順
    o.forEach((i, r) => { const rank = m - r, v = method === 'bh' ? m / rank * ps[i] : (m - rank + 1) * ps[i]; mn = Math.min(mn, v); out[i] = Math.min(1, mn); });
    return out;
  }
  function gamesHowell(groups) { // 等分散を仮定しない対比較（Welch の自由度 + スチューデント化された範囲）
    const k = groups.length, P = pairs(k);
    return P.map(([i, j]) => { const a = groups[i], b = groups[j], va = vari(a) / a.length, vb = vari(b) / b.length, diff = mean(a) - mean(b), se = Math.sqrt(va + vb), t = diff / se, df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
      return { i, j, diff, se, t, df, p: ptukeyU(Math.abs(t) * Math.SQRT2, k, df) }; });
  }
  function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const out = new Array(ps.length); let mx = 0; o.forEach(([p, i], r) => { mx = Math.max(mx, Math.min(1, p * (ps.length - r))); out[i] = mx; }); return out; }

  // ===== 多群（関連） =====
  function rmAnova(cols) { // cols: k 条件 × n 被験者（欠測なし）
    const k = cols.length, n = cols[0].length, all = cols.flat(), gm = mean(all);
    const subj = Array.from({ length: n }, (_, s) => mean(cols.map(c => c[s])));
    const ssc = n * sum(cols.map(c => (mean(c) - gm) ** 2)), sss = k * sum(subj.map(v => (v - gm) ** 2)), sst = ss(all), sse = sst - ssc - sss;
    const dfc = k - 1, dfs = n - 1, dfe = dfc * dfs, F = (ssc / dfc) / (sse / dfe);
    // Greenhouse-Geisser
    const cm = cols.map(mean), Sm = cols.map((a, i) => cols.map((b, j) => sum(a.map((v, s) => (v - cm[i]) * (b[s] - cm[j]))) / (n - 1)));
    const md = mean(Sm.map((r, i) => r[i])), mAll = mean(Sm.flat()), mr = Sm.map(mean);
    const gg = k * k * (md - mAll) ** 2 / ((k - 1) * (sum(Sm.flat().map(v => v * v)) - 2 * k * sum(mr.map(v => v * v)) + k * k * mAll * mAll));
    const eps = Math.min(1, gg);
    const hf = Math.min(1, (n * (k - 1) * eps - 2) / ((k - 1) * (n - 1 - (k - 1) * eps)));
    return { k, n, ssc, sss, sse, sst, dfc, dfs, dfe, msc: ssc / dfc, mss: sss / dfs, mse: sse / dfe, F, p: pfU(F, dfc, dfe),
      eps, pGG: pfU(F, dfc * eps, dfe * eps), hf, pHF: pfU(F, dfc * hf, dfe * hf), peta2: ssc / (ssc + sse), eta2: ssc / sst };
  }
  function friedman(cols) {
    const k = cols.length, n = cols[0].length; const R = new Array(k).fill(0); let T = 0;
    for (let s = 0; s < n; s++) { const { r, ties } = ranks(cols.map(c => c[s])); r.forEach((v, i) => R[i] += v); T += tieSum(ties); }
    let chi = 12 / (n * k * (k + 1)) * sum(R.map(v => v * v)) - 3 * n * (k + 1);
    chi /= 1 - T / (n * (k ** 3 - k));
    return { chi, df: k - 1, p: pchiU(chi, k - 1), meanRanks: R.map(v => v / n), W: chi / (n * (k - 1)) };
  }
  function cronbach(cols) {
    const k = cols.length, n = cols[0].length, tot = Array.from({ length: n }, (_, s) => sum(cols.map(c => c[s])));
    const a = k / (k - 1) * (1 - sum(cols.map(vari)) / vari(tot));
    const items = cols.map((c, i) => {
      const rest = tot.map((t, s) => t - c[s]);
      const others = cols.filter((_, j) => j !== i), totO = Array.from({ length: n }, (_, s) => sum(others.map(o => o[s])));
      const aDel = k > 2 ? (k - 1) / (k - 2) * (1 - sum(others.map(vari)) / vari(totO)) : NaN;
      return { mean: mean(c), sd: sd(c), rit: pearson(c, rest).r, aDel };
    });
    return { alpha: a, k, n, items };
  }

  // ===== 2変量 =====
  function pearson(x, y) {
    const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    const r = sxy / Math.sqrt(sxx * syy), t = r * Math.sqrt((n - 2) / (1 - r * r)), z = Math.atanh(r), se = 1 / Math.sqrt(n - 3), zc = qn(0.025);
    return { n, r, t, df: n - 2, p: pt2(t, n - 2), ciL: Math.tanh(z - zc * se), ciU: Math.tanh(z + zc * se), sxy, sxx, syy, mx, my };
  }
  function spearman(x, y) { const r = pearson(ranks(x).r, ranks(y).r).r, n = x.length, t = r * Math.sqrt((n - 2) / (1 - r * r)); return { rho: r, t, p: pt2(t, n - 2) }; }
  function kendall(x, y) {
    const n = x.length; let C = 0, D = 0, tx = 0, ty = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = Math.sign(x[i] - x[j]), b = Math.sign(y[i] - y[j]); if (a && b) { if (a === b) C++; else D++; } else if (!a && b) tx++; else if (a && !b) ty++; }
    const n0 = n * (n - 1) / 2, tau = (C - D) / Math.sqrt((n0 - countTies(x)) * (n0 - countTies(y)));
    const t1 = ranks(x).ties, t2 = ranks(y).ties;
    const v0 = n * (n - 1) * (2 * n + 5), vt = sum(t1.map(t => t * (t - 1) * (2 * t + 5))), vu = sum(t2.map(t => t * (t - 1) * (2 * t + 5)));
    const v1 = sum(t1.map(t => t * (t - 1))) * sum(t2.map(t => t * (t - 1))) / (2 * n * (n - 1));
    const v2 = sum(t1.map(t => t * (t - 1) * (t - 2))) * sum(t2.map(t => t * (t - 1) * (t - 2))) / (9 * n * (n - 1) * (n - 2));
    const z = (C - D) / Math.sqrt((v0 - vt - vu) / 18 + v1 + v2);
    return { tau, z, p: Math.min(1, 2 * pnU(Math.abs(z))) };
    function countTies(a) { return sum(ranks(a).ties.map(t => t * (t - 1) / 2)); }
  }
  function regression(x, y) {
    const P = pearson(x, y), n = P.n, b = P.sxy / P.sxx, a = P.my - b * P.mx;
    const sse = P.syy - b * P.sxy, s2 = sse / (n - 2), seb = Math.sqrt(s2 / P.sxx), sea = Math.sqrt(s2 * (1 / n + P.mx ** 2 / P.sxx)), tc = qt(0.025, n - 2);
    const F = (P.syy - sse) / s2;
    return { a, b, sea, seb, ta: a / sea, tb: b / seb, pa: pt2(a / sea, n - 2), pb: pt2(b / seb, n - 2), aL: a - tc * sea, aU: a + tc * sea, bL: b - tc * seb, bU: b + tc * seb,
      r2: 1 - sse / P.syy, adjr2: 1 - (sse / (n - 2)) / (P.syy / (n - 1)), F, df1: 1, df2: n - 2, pF: pfU(F, 1, n - 2), se: Math.sqrt(s2), beta: P.r };
  }

  // ===== 分割表 =====
  function chiTable(t) {
    const R = t.length, C = t[0].length, rs = t.map(sum), cs = t[0].map((_, j) => sum(t.map(r => r[j]))), N = sum(rs);
    const E = t.map((r, i) => r.map((_, j) => rs[i] * cs[j] / N)); let chi = 0;
    t.forEach((r, i) => r.forEach((o, j) => chi += (o - E[i][j]) ** 2 / E[i][j]));
    const df = (R - 1) * (C - 1), V = Math.sqrt(chi / (N * Math.min(R - 1, C - 1)));
    const adj = t.map((r, i) => r.map((o, j) => (o - E[i][j]) / Math.sqrt(E[i][j] * (1 - rs[i] / N) * (1 - cs[j] / N))));
    const small = E.flat().filter(e => e < 5).length;
    let G = 0; t.forEach((r, i) => r.forEach((o, j) => { if (o > 0) G += 2 * o * Math.log(o / E[i][j]); }));
    const res = { R, C, N, rs, cs, E, chi, df, p: pchiU(chi, df), V, adj, small, G, pG: pchiU(G, df) };
    if (R === 2 && C === 2) {
      const [[a, b], [c, d]] = t;
      const y = N * Math.max(0, Math.abs(a * d - b * c) - N / 2) ** 2 / (rs[0] * rs[1] * cs[0] * cs[1]);
      res.yates = { chi: y, p: pchiU(y, 1) };
      res.phi = (a * d - b * c) / Math.sqrt(rs[0] * rs[1] * cs[0] * cs[1]);
      res.fisher = fisher2x2(a, b, c, d);
      const hasZero = [a, b, c, d].some(v => v === 0), [A, B, Cc, D] = hasZero ? [a + .5, b + .5, c + .5, d + .5] : [a, b, c, d];
      const or = A * D / (B * Cc), se = Math.sqrt(1 / A + 1 / B + 1 / Cc + 1 / D), zc = qn(0.025);
      res.or = { or, L: Math.exp(Math.log(or) - zc * se), U: Math.exp(Math.log(or) + zc * se), corrected: hasZero };
      res.yuleQ = (a * d - b * c) / (a * d + b * c);
      const mc = b + c > 0 ? (Math.abs(b - c) - 1) ** 2 / (b + c) : 0; res.mcnemar = { chi: mc, p: b + c > 0 ? pchiU(mc, 1) : 1 };
    }
    if (R === C) { const po = sum(t.map((r, i) => r[i])) / N, pe = sum(rs.map((r, i) => r * cs[i])) / N / N; res.kappa = (po - pe) / (1 - pe); }
    return res;
  }
  function fisher2x2(a, b, c, d) {
    const r1 = a + b, r2 = c + d, c1 = a + c, N = r1 + r2;
    const lp = x => lchoose(r1, x) + lchoose(r2, c1 - x) - lchoose(N, c1);
    const lo = Math.max(0, c1 - r2), hi = Math.min(r1, c1), p0 = lp(a); let p = 0;
    for (let x = lo; x <= hi; x++) { const l = lp(x); if (l <= p0 + 1e-7) p += Math.exp(l); }
    return { p: Math.min(1, p) };
  }

  // ===== 一般線形モデル =====
  function inverse(A) { // Gauss-Jordan（部分ピボット）
    const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => +(i === j))]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-11) throw new Error('説明変数どうしが完全に重なっています（多重共線性）。変数を減らしてください。');
      [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }
  function ols(X, y) { // X: n×p（行ごと）
    const n = X.length, p = X[0].length, XtX = Array.from({ length: p }, () => new Array(p).fill(0)), Xty = new Array(p).fill(0);
    for (let i = 0; i < n; i++) for (let a = 0; a < p; a++) { Xty[a] += X[i][a] * y[i]; for (let b = a; b < p; b++) XtX[a][b] += X[i][a] * X[i][b]; }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const inv = inverse(XtX), b = inv.map(r => sum(r.map((v, j) => v * Xty[j])));
    const fitted = X.map(r => sum(r.map((v, j) => v * b[j]))), resid = y.map((v, i) => v - fitted[i]);
    return { b, inv, fitted, resid, sse: sum(resid.map(r => r * r)), df: n - p };
  }
  const uniq = a => [...new Set(a)];
  const effCols = (lab, levels) => levels.slice(0, -1).map(l => lab.map(v => v === l ? 1 : v === levels[levels.length - 1] ? -1 : 0));
  const sseOf = (cols, y) => cols.length ? ols(y.map((_, i) => cols.map(c => c[i])), y).sse : ss(y);

  // 二元配置分散分析（対応なし、タイプIII平方和）
  function anova2(y, A, B) {
    const la = uniq(A), lb = uniq(B), N = y.length;
    const cell = la.map(a => lb.map(b => y.filter((_, i) => A[i] === a && B[i] === b)));
    if (cell.flat().some(c => c.length === 0)) throw new Error('データのない組み合わせ（セル）があります。すべての組み合わせに1人以上必要です。');
    const one = y.map(() => 1), cA = effCols(A, la), cB = effCols(B, lb), cAB = [];
    cA.forEach(u => cB.forEach(v => cAB.push(u.map((x, i) => x * v[i]))));
    const full = [one, ...cA, ...cB, ...cAB], fit = ols(y.map((_, i) => full.map(c => c[i])), y), dfe = fit.df;
    if (dfe < 1) throw new Error('誤差の自由度がありません。各セルに2人以上必要です。');
    const mse = fit.sse / dfe;
    const term = (name, drop, df) => { const ssv = sseOf(full.filter(c => !drop.includes(c)), y) - fit.sse; const F = ssv / df / mse; return { name, ss: ssv, df, ms: ssv / df, F, p: pfU(F, df, dfe), peta2: ssv / (ssv + fit.sse) }; };
    const terms = [term('A', cA, la.length - 1), term('B', cB, lb.length - 1), term('A×B', cAB, (la.length - 1) * (lb.length - 1))];
    const cells = la.map((a, i) => lb.map((b, j) => { const c = cell[i][j]; return { n: c.length, mean: mean(c), sd: c.length > 1 ? sd(c) : NaN }; }));
    // 単純主効果（プールした誤差を使用）
    const simple = (fixLevels, varyLevels, get) => fixLevels.map((f, fi) => {
      const groups = varyLevels.map((_, vi) => get(fi, vi)), all = groups.flat(), gm = mean(all);
      const ssv = sum(groups.map(g => g.length * (mean(g) - gm) ** 2)), df = groups.length - 1, F = ssv / df / mse;
      const P = pairs(groups.length).map(([i, j]) => { const d = mean(groups[i]) - mean(groups[j]), t = d / Math.sqrt(mse * (1 / groups[i].length + 1 / groups[j].length)); return { i, j, diff: d, t, p: Math.min(1, pt2(t, dfe) * pairs(groups.length).length) }; });
      return { level: f, ss: ssv, df, F, p: pfU(F, df, dfe), peta2: ssv / (ssv + fit.sse), pairs: P };
    });
    return { la, lb, N, terms, error: { ss: fit.sse, df: dfe, ms: mse }, cells, cellData: cell,
      simpleA: simple(lb, la, (fi, vi) => cell[vi][fi]), simpleB: simple(la, lb, (fi, vi) => cell[fi][vi]) };
  }

  // 混合計画（群：参加者間 × 条件：参加者内）
  function helmert(k) { // 正規直交対比 k×(k−1)
    return Array.from({ length: k - 1 }, (_, c) => { const v = Array.from({ length: k }, (_, t) => t <= c ? 1 : t === c + 1 ? -(c + 1) : 0); const nr = Math.sqrt(sum(v.map(x => x * x))); return v.map(x => x / nr); });
  }
  function mixedAnova(G, cols) { // G: 被験者ごとの群ラベル、cols: k 条件 × n 被験者
    const k = cols.length, N = G.length, lg = uniq(G), g = lg.length;
    if (lg.some(l => G.filter(v => v === l).length < 2)) throw new Error('各群に2人以上必要です。');
    const one = G.map(() => 1), cG = effCols(G, lg);
    // 参加者間（被験者平均の一元配置 × k）
    const sm = G.map((_, s) => mean(cols.map(c => c[s]))), groupsM = lg.map(l => sm.filter((_, s) => G[s] === l));
    const A1 = anova1(groupsM), ssA = k * A1.ssb, ssSA = k * A1.ssw, dfSA = N - g;
    // 参加者内（正規直交対比）
    const C = helmert(k), Z = C.map(c => G.map((_, s) => sum(c.map((w, t) => w * cols[t][s]))));
    let ssB = 0, ssAB = 0; const R = [];
    Z.forEach(z => {
      const full = [one, ...cG], fit = ols(z.map((_, i) => full.map(c => c[i])), z);
      ssB += sseOf(cG, z) - fit.sse; ssAB += sseOf([one], z) - fit.sse; R.push(fit.resid);
    });
    const E = R.map(a => R.map(b => sum(a.map((v, i) => v * b[i])))), ssE = sum(E.map((r, i) => r[i]));
    const trE2 = sum(E.flat().map(v => v * v)), eps = Math.min(1, ssE * ssE / ((k - 1) * trE2));
    const hf = Math.min(1, ((N - g + 1) * (k - 1) * eps - 2) / ((k - 1) * (N - g - (k - 1) * eps)));
    const dfB = k - 1, dfAB = (g - 1) * (k - 1), dfE = (N - g) * (k - 1), mse = ssE / dfE;
    const mk = (name, ssv, df, err, dfErr, within) => { const F = ssv / df / (err / dfErr); const r = { name, ss: ssv, df, ms: ssv / df, F, p: pfU(F, df, dfErr), peta2: ssv / (ssv + err) };
      if (within) { r.pGG = pfU(F, df * eps, dfErr * eps); r.pHF = pfU(F, df * hf, dfErr * hf); } return r; };
    const cells = lg.map(l => cols.map(c => { const v = c.filter((_, s) => G[s] === l); return { n: v.length, mean: mean(v), sd: sd(v) }; }));
    const simpleG = cols.map(c => { const r = anova1(lg.map(l => c.filter((_, s) => G[s] === l))); return { F: r.F, df1: r.dfb, df2: r.dfw, p: r.p, peta2: r.eta2 }; });
    const simpleT = lg.map(l => { const sub = cols.map(c => c.filter((_, s) => G[s] === l)); const r = rmAnova(sub);
      const P = pairs(k).map(([i, j]) => { const t = pairedT(sub[i], sub[j]); return { i, j, diff: t.md, t: t.t, df: t.df, pRaw: t.p, p: Math.min(1, t.p * pairs(k).length) }; });
      return { F: r.F, df1: r.dfc, df2: r.dfe, p: r.p, pGG: r.pGG, eps: r.eps, peta2: r.peta2, pairs: P }; });
    return { k, N, lg, between: mk('群', ssA, g - 1, ssSA, dfSA), errS: { ss: ssSA, df: dfSA, ms: ssSA / dfSA },
      within: [mk('条件', ssB, dfB, ssE, dfE, true), mk('群×条件', ssAB, dfAB, ssE, dfE, true)], errW: { ss: ssE, df: dfE, ms: mse }, eps, hf, cells, simpleG, simpleT };
  }

  // 重回帰分析
  function multiReg(y, X, names) { // X: 説明変数の列配列
    const n = y.length, p = X.length, Xm = y.map((_, i) => [1, ...X.map(c => c[i])]), fit = ols(Xm, y);
    if (fit.df < 1) throw new Error('人数が説明変数の数より多くないと計算できません。');
    const mse = fit.sse / fit.df, sst = ss(y), sy = sd(y), tc = qt(0.025, fit.df);
    const coef = fit.b.map((b, j) => { const se = Math.sqrt(mse * fit.inv[j][j]), t = b / se, sx = j ? sd(X[j - 1]) : NaN;
      return { name: j ? names[j - 1] : '切片', b, se, t, p: pt2(t, fit.df), L: b - tc * se, U: b + tc * se, beta: j ? b * sx / sy : NaN, betaL: j ? (b - tc * se) * sx / sy : NaN, betaU: j ? (b + tc * se) * sx / sy : NaN }; });
    coef.slice(1).forEach((c, j) => { if (p < 2) { c.vif = 1; return; } const others = X.filter((_, q) => q !== j); const r = ols(y.map((_, i) => [1, ...others.map(o => o[i])]), X[j]); c.vif = ss(X[j]) / r.sse; });
    const r2 = 1 - fit.sse / sst, F = (sst - fit.sse) / p / mse;
    let dw = 0; for (let i = 1; i < n; i++) dw += (fit.resid[i] - fit.resid[i - 1]) ** 2; dw /= fit.sse;
    return { n, p, coef, r2, adjr2: 1 - (1 - r2) * (n - 1) / fit.df, R: Math.sqrt(r2), F, df1: p, df2: fit.df, pF: pfU(F, p, fit.df), se: Math.sqrt(mse), fitted: fit.fitted, resid: fit.resid, stdResid: fit.resid.map(r => r / Math.sqrt(mse)), dw };
  }

  // ===== 因子分析 =====
  const matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const tr = A => A[0].map((_, j) => A.map(r => r[j]));
  function eigSym(M) { // Jacobi 法。固有値の降順
    const n = M.length, a = M.map(r => [...r]), V = a.map((_, i) => a.map((_, j) => +(i === j)));
    for (let sw = 0; sw < 100; sw++) {
      let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
      if (off < 1e-24) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p][q]; if (Math.abs(apq) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * apq), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(1 + t * t), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = a.map((_, i) => i).sort((x, y) => a[y][y] - a[x][x]);
    return { values: idx.map(i => a[i][i]), vectors: idx.map(i => V.map(r => r[i])) }; // vectors[j] = j 番目の固有ベクトル
  }
  function corMatrix(cols) { const p = cols.length; const z = cols.map(c => { const m = mean(c), s = sd(c); return c.map(v => (v - m) / s); }), n = cols[0].length; return z.map(a => z.map(b => a.reduce((s, v, i) => s + v * b[i], 0) / (n - 1))); }
  function logDet(R) { return sum(eigSym(R).values.map(v => Math.log(Math.max(v, 1e-300)))); }
  function kmo(R) {
    const p = R.length, inv = inverse(R); let r2 = 0, q2 = 0; const msa = [];
    for (let i = 0; i < p; i++) { let ri = 0, qi = 0; for (let j = 0; j < p; j++) if (i !== j) { const q = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]); ri += R[i][j] ** 2; qi += q * q; } msa.push(ri / (ri + qi)); r2 += ri; q2 += qi; }
    return { kmo: r2 / (r2 + q2), msa, smc: inv.map((r, i) => 1 - 1 / r[i]) };
  }
  function bartlettSph(R, n) { const p = R.length, chi = -(n - 1 - (2 * p + 5) / 6) * logDet(R), df = p * (p - 1) / 2; return { chi, df, p: pchiU(chi, df) }; }
  function parallel(n, p, iter = 100, seed = 12345) {
    let s = seed >>> 0; const u = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 || 1e-12;
    const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    const ev = Array.from({ length: p }, () => []);
    for (let it = 0; it < iter; it++) { const cols = Array.from({ length: p }, () => Array.from({ length: n }, g)); eigSym(corMatrix(cols)).values.forEach((v, j) => ev[j].push(v)); }
    return { mean: ev.map(mean), q95: ev.map(e => quantile(e, .95)) };
  }
  // ----- 因子抽出 -----
  const EXTRACTIONS = { ml: '最尤法', gls: '一般化最小二乗法', uls: '最小残差法（重み付けのない最小二乗法）', pa: '主因子法（反復あり）', pa1: '主因子法（反復なし）', alpha: 'α 因子法', pca: '主成分分析' };
  function topLoad(M, k, scale) { const E = eigSym(M); return M.map((_, i) => Array.from({ length: k }, (_, j) => scale(i, E.values[j]) * E.vectors[j][i])); }
  const mlLoad = (R, psi, k) => { const sq = psi.map(Math.sqrt); return topLoad(R.map((r, i) => r.map((v, j) => v / (sq[i] * sq[j]))), k, (i, lam) => sq[i] * Math.sqrt(Math.max(lam - 1, 0))); };
  const ulsLoad = (R, psi, k) => topLoad(R.map((r, i) => r.map((v, j) => i === j ? 1 - psi[i] : v)), k, (i, lam) => Math.sqrt(Math.max(lam, 0)));
  const implied = (L, psi) => L.map((a, i) => L.map((b, j) => sum(a.map((v, q) => v * b[q])) + (i === j ? psi[i] : 0)));
  function minimizePsi(F, psi0, lo = .005, hi = 1) { // 境界つき射影勾配法（数値微分、Barzilai-Borwein 歩幅）
    const p = psi0.length, clip = v => Math.min(hi, Math.max(lo, v)); let x = psi0.map(clip), fx = F(x), it, conv = false;
    const grad = x => x.map((_, i) => { const h = 1e-6, a = [...x], b = [...x]; a[i] = x[i] + h; b[i] = x[i] - h; return (F(a) - F(b)) / (2 * h); });
    let g = grad(x), step = 0.1, xPrev = null, gPrev = null;
    for (it = 1; it <= 3000; it++) {
      if (xPrev) { let sy = 0, ss2 = 0; for (let i = 0; i < p; i++) { const s = x[i] - xPrev[i], y = g[i] - gPrev[i]; sy += s * y; ss2 += s * s; } step = sy > 1e-20 ? Math.min(1, Math.max(1e-6, ss2 / sy)) : 0.1; }
      let xn, fn, t = step;
      for (let ls = 0; ls < 40; ls++) { xn = x.map((v, i) => clip(v - t * g[i])); fn = F(xn); if (fn <= fx - 1e-4 * sum(xn.map((v, i) => g[i] * (x[i] - v)))) break; t /= 2; }
      const move = Math.max(...xn.map((v, i) => Math.abs(v - x[i])));
      xPrev = x; gPrev = g; x = xn; const fOld = fx; fx = fn; g = grad(x);
      if (move < 1e-10 || Math.abs(fOld - fx) < 1e-15 * Math.max(1, Math.abs(fx))) { conv = true; break; }
    }
    return { psi: x, f: fx, iter: it, conv };
  }
  function extract(R, k, method, n) {
    const p = R.length; let L, iter = 0, conv = true, psiOpt = null; const smc = kmo(R).smc;
    if (method === 'pca') { L = topLoad(R, k, (i, lam) => Math.sqrt(Math.max(lam, 0))); iter = 1; }
    else if (method === 'pa' || method === 'pa1') {
      let h = smc; const maxIt = method === 'pa1' ? 1 : 5000;
      for (iter = 1; iter <= maxIt; iter++) {
        L = topLoad(R.map((r, i) => r.map((v, j) => i === j ? h[i] : v)), k, (i, lam) => Math.sqrt(Math.max(lam, 0)));
        const hn = L.map(r => sum(r.map(v => v * v))), d = Math.max(...hn.map((v, i) => Math.abs(v - h[i]))); h = hn; if (d < 1e-9) break;
      }
      if (method === 'pa' && iter > maxIt) conv = false; iter = Math.min(iter, maxIt);
    } else if (method === 'alpha') { // Kaiser & Caffrey（psych の fm = "alpha" と同じ手順）
      let H2 = smc;
      for (iter = 1; iter <= 5000; iter++) {
        const sq = H2.map(Math.sqrt), Rm = R.map((r, i) => r.map((v, j) => i === j ? 1 : v / (sq[i] * sq[j])));
        const E = eigSym(Rm), Ls = Rm.map((_, i) => Array.from({ length: k }, (_, j) => Math.sqrt(Math.max(E.values[j], 0)) * E.vectors[j][i]));
        const nh = H2.map((h, i) => h * sum(Ls[i].map(v => v * v))), d = sum(nh.map((v, i) => Math.abs(v - H2[i])));
        L = Ls.map((r, i) => r.map(v => v * Math.sqrt(nh[i]))); H2 = nh; if (d < 1e-10) break;
      }
      if (iter > 5000) conv = false;
    } else if (method === 'ml') {
      let psi = smc.map(v => Math.min(.995, Math.max(.005, 1 - v)));
      for (iter = 1; iter <= 20000; iter++) {
        L = mlLoad(R, psi, k);
        const pn = L.map(r => Math.min(1, Math.max(.005, 1 - sum(r.map(v => v * v))))), d = Math.max(...pn.map((v, i) => Math.abs(v - psi[i]))); psi = pn; if (d < 1e-9) break;
      }
      if (iter > 20000) conv = false;
    } else if (method === 'uls') { // 非対角の残差平方和を最小化（psych の minres と同じ目的関数）
      const F = psi => { const Lp = ulsLoad(R, psi, k); let s = 0; for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) s += (R[i][j] - sum(Lp[i].map((v, q) => v * Lp[j][q]))) ** 2; return s; };
      const o = minimizePsi(F, smc.map(v => 1 - v)); L = ulsLoad(R, o.psi, k); iter = o.iter; conv = o.conv;
    } else if (method === 'gls') { // Jöreskog & Goldberger の GLS：½ tr[(I − R⁻¹Σ)²]
      const Ri = inverse(R), F = psi => { const Sg = implied(mlLoad(R, psi, k), psi), M = matMul(Ri, Sg); let s = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) s += ((i === j ? 1 : 0) - M[i][j]) * ((i === j ? 1 : 0) - M[j][i]); return s / 2; };
      const o = minimizePsi(F, smc.map(v => 1 - v)); L = mlLoad(R, o.psi, k); iter = o.iter; conv = o.conv; psiOpt = o.psi;
    }
    for (let j = 0; j < k; j++) if (sum(L.map(r => r[j])) < 0) L.forEach(r => r[j] = -r[j]);
    const h2 = L.map(r => sum(r.map(v => v * v)));
    const out = { L, h2, iter, conv, heywood: method !== 'pca' && h2.some(v => v >= .995) };
    // 適合度：残差（RMSR）はすべての方法で、χ² は最尤法と GLS で
    let rs = 0, cnt = 0; for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) { rs += (R[i][j] - sum(L[i].map((v, q) => v * L[j][q]))) ** 2; cnt++; }
    out.rmsr = Math.sqrt(rs / cnt);
    const df = ((p - k) ** 2 - p - k) / 2;
    if (method === 'ml' || method === 'gls') {
      const psi = psiOpt || h2.map(v => Math.max(1 - v, 1e-6)), Sg = implied(L, psi); let Fv, chi;
      if (method === 'ml') { Fv = logDet(Sg) - logDet(R) + sum(matMul(R, inverse(Sg)).map((r, i) => r[i])) - p; chi = (n - 1 - (2 * p + 5) / 6 - 2 * k / 3) * Fv; }
      else { const M = matMul(inverse(R), Sg); Fv = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) Fv += ((i === j) - M[i][j]) * ((i === j) - M[j][i]); Fv /= 2; chi = (n - 1) * Fv; }
      out.fit = { chi, df, p: df > 0 ? pchiU(chi, df) : NaN, rmsea: df > 0 ? Math.sqrt(Math.max(chi - df, 0) / (df * (n - 1))) : NaN, label: method === 'ml' ? '最尤法' : 'GLS' };
    }
    return out;
  }
  function invSqrtSym(M) { const E = eigSym(M); return M.map((_, i) => M.map((_, j) => sum(E.values.map((v, q) => E.vectors[q][i] * E.vectors[q][j] / Math.sqrt(v))))); }
  function varimax(L) { // R の stats::varimax（Kaiser の正規化あり）と同じ
    const p = L.length, k = L[0].length; if (k < 2) return { L, T: [[1]] };
    const sc = L.map(r => Math.sqrt(sum(r.map(v => v * v)))), x = L.map((r, i) => r.map(v => v / sc[i]));
    let T = x[0].map((_, i) => x[0].map((_, j) => +(i === j))), d = 0;
    for (let it = 0; it < 1000; it++) {
      const z = matMul(x, T), cs = z[0].map((_, j) => sum(z.map(r => r[j] ** 2)));
      const B = matMul(tr(x), z.map(r => r.map((v, j) => v ** 3 - v * cs[j] / p)));
      const BtB = matMul(tr(B), B), dn = sum(eigSym(BtB).values.map(v => Math.sqrt(Math.max(v, 0))));
      T = matMul(B, invSqrtSym(BtB)); if (dn < d * (1 + 1e-5)) break; d = dn;
    }
    return { L: matMul(x, T).map((r, i) => r.map(v => v * sc[i])), T };
  }
  function promax(L, m = 4) { // R の stats::promax と同じ
    const k = L[0].length; if (k < 2) return { L, T: [[1]], Phi: [[1]] };
    const V = varimax(L), X = V.L, Q = X.map(r => r.map(v => v * Math.abs(v) ** (m - 1)));
    let U = matMul(inverse(matMul(tr(X), X)), matMul(tr(X), Q));
    const dd = inverse(matMul(tr(U), U)).map((r, i) => r[i]); U = U.map(r => r.map((v, j) => v * Math.sqrt(dd[j])));
    const P = matMul(X, U), T = matMul(V.T, U), Phi = inverse(matMul(tr(T), T));
    return { L: P, T, Phi };
  }
  // ----- 勾配射影法による回転（GPArotation と同じアルゴリズム） -----
  const elem = (A, B, f) => A.map((r, i) => r.map((v, j) => f(v, B ? B[i][j] : 0, i, j)));
  const colSums = A => A[0].map((_, j) => sum(A.map(r => r[j])));
  const CRIT = {
    quartimax: L => ({ f: -sum(L.flat().map(v => v ** 4)) / 4, Gq: elem(L, null, v => -(v ** 3)) }),
    varimax: L => { const p = L.length, cm = colSums(elem(L, null, v => v * v)).map(v => v / p), QL = elem(L, null, (v, _, i, j) => v * v - cm[j]); return { f: -sum(QL.flat().map(v => v * v)) / 4, Gq: elem(L, QL, (a, b) => -a * b) }; },
    oblimin: (L, gam = 0) => { const p = L.length, k = L[0].length, L2 = elem(L, null, v => v * v); let X = L2.map(r => r.map((_, j) => sum(r) - r[j]));
      if (gam) { const cs = colSums(X); X = X.map(r => r.map((v, j) => v - gam / p * cs[j])); } return { f: sum(elem(L2, X, (a, b) => a * b).flat()) / 4, Gq: elem(L, X, (a, b) => a * b) }; },
    geomin: (L, delta = .01) => { const k = L[0].length, L2 = elem(L, null, v => v * v + delta), pro = L2.map(r => Math.exp(sum(r.map(Math.log)) / k)); return { f: sum(pro), Gq: elem(L, L2, (a, b, i) => 2 / k * a / b * pro[i]) }; },
    cf: (L, kappa = 0) => { const p = L.length, L2 = elem(L, null, v => v * v), rs = L2.map(r => sum(r)), cs = colSums(L2);
      const A1 = L2.map((r, i) => r.map(v => rs[i] - v)), A2 = L2.map(r => r.map((v, j) => cs[j] - v));
      return { f: (1 - kappa) * sum(elem(L2, A1, (a, b) => a * b).flat()) / 4 + kappa * sum(elem(L2, A2, (a, b) => a * b).flat()) / 4, Gq: L.map((r, i) => r.map((v, j) => (1 - kappa) * v * A1[i][j] + kappa * v * A2[i][j])) }; },
    bentler: L => { const L2 = elem(L, null, v => v * v), M = matMul(tr(L2), L2), Mi = inverse(M), D = M.map((r, i) => r.map((_, j) => i === j ? 1 / M[i][i] : 0)), W = elem(Mi, D, (a, b) => a - b);
      return { f: -(logDet(M) - sum(M.map((r, i) => Math.log(r[i])))) / 4, Gq: elem(L, matMul(L2, W), (a, b) => -a * b) }; },
    infomax: L => { const p = L.length, k = L[0].length, Sm = elem(L, null, v => v * v), s = sum(Sm.flat()), s1 = Sm.map(r => sum(r)), s2 = colSums(Sm);
      const E = elem(Sm, null, v => v / s), e1 = s1.map(v => v / s), e2 = s2.map(v => v / s), xl = v => v > 0 ? v * Math.log(v) : 0;
      const f = Math.log(k) - sum(E.flat().map(xl)) + sum(e1.map(xl)) + sum(e2.map(xl));
      const H = elem(E, null, v => -(Math.log(v) + 1)), alpha = sum(elem(Sm, H, (a, b) => a * b).flat()) / s ** 2;
      const h1 = e1.map(v => -(Math.log(v) + 1)), a1 = sum(s1.map((v, i) => v * h1[i])) / s ** 2, h2 = e2.map(v => -(Math.log(v) + 1)), a2 = sum(s2.map((v, j) => v * h2[j])) / s ** 2;
      return { f, Gq: L.map((r, i) => r.map((v, j) => 2 * v * ((H[i][j] / s - alpha) - (h1[i] / s - a1) - (h2[j] / s - a2)))) }; },
    simplimax: L => { const p = L.length, L2 = elem(L, null, v => v * v), th = [...L2.flat()].sort((a, b) => a - b)[p - 1], I = elem(L2, null, v => +(v <= th)); return { f: sum(elem(I, L2, (a, b) => a * b).flat()), Gq: elem(L, I, (a, b) => 2 * a * b) }; },
    oblimax: L => { const s4 = sum(L.flat().map(v => v ** 4)), s2 = sum(L.flat().map(v => v * v)); return { f: -(Math.log(s4) - 2 * Math.log(s2)), Gq: elem(L, null, v => -(4 * v ** 3 / s4 - 4 * v / s2)) }; },
    varimin: L => { const p = L.length, cm = colSums(elem(L, null, v => v * v)).map(v => v / p), QL = elem(L, null, (v, _, i, j) => v * v - cm[j]); return { f: sum(QL.flat().map(v => v * v)) / 4, Gq: elem(L, QL, (a, b) => a * b) }; },
    entropy: L => { const lg = v => Math.log(v * v + (v === 0 ? 1 : 0)); return { f: -sum(L.flat().map(v => v * v * lg(v))) / 2, Gq: elem(L, null, v => -(v * lg(v) + v)) }; },
    mccammon: L => { const p = L.length, k = L[0].length, Sm = elem(L, null, v => v * v), s2 = colSums(Sm), P = elem(Sm, null, (v, _, i, j) => v / s2[j]);
      const Q1 = -sum(P.flat().map(v => v > 0 ? v * Math.log(v) : 0)), H = elem(P, null, v => -(Math.log(v) + 1)), Rr = Sm.map(() => s2), SH = elem(Sm, H, (a, b) => a * b), SHR = colSums(SH.map((r, i) => r.map((v, j) => v / Rr[i][j] ** 2)));
      const G1 = H.map((r, i) => r.map((v, j) => v / Rr[i][j] - SHR[j])), s = sum(s2), p2 = s2.map(v => v / s), Q2 = -sum(p2.map(v => v * Math.log(v))), h = p2.map(v => -(Math.log(v) + 1)), al = sum(h.map((v, j) => v * p2[j]));
      const G2 = Sm.map(r => r.map((_, j) => h[j] / s - al)); return { f: Math.log(Q1) - Math.log(Q2), Gq: L.map((r, i) => r.map((v, j) => 2 * v * (G1[i][j] / Q1 - G2[i][j] / Q2))) }; },
    tandemI: L => { const LL = matMul(L, tr(L)), LL2 = elem(LL, null, v => v * v), L2 = elem(L, null, v => v * v), A = matMul(LL2, L2), B = matMul(elem(LL, matMul(L2, tr(L2)), (a, b) => a * b), L);
      return { f: -sum(elem(L2, A, (a, b) => a * b).flat()), Gq: L.map((r, i) => r.map((v, j) => -4 * v * A[i][j] - 4 * B[i][j])) }; },
    tandemII: L => { const LL = matMul(L, tr(L)), W = elem(LL, null, v => 1 - v * v), L2 = elem(L, null, v => v * v), A = matMul(W, L2), B = matMul(elem(LL, matMul(L2, tr(L2)), (a, b) => a * b), L);
      return { f: sum(elem(L2, A, (a, b) => a * b).flat()), Gq: L.map((r, i) => r.map((v, j) => 4 * v * A[i][j] - 4 * B[i][j])) }; },
    bifactor: L => { const Lt = L.map(r => r.slice(1)), L2 = elem(Lt, null, v => v * v), X = L2.map(r => r.map((_, j) => sum(r) - r[j]));
      return { f: sum(elem(L2, X, (a, b) => a * b).flat()), Gq: L.map((r, i) => [0, ...Lt[i].map((v, j) => 4 * v * X[i][j])]) }; },
    bigeomin: (L, delta = .01) => { const o = CRIT.geomin(L.map(r => r.slice(1)), delta); return { f: o.f, Gq: o.Gq.map(r => [0, ...r]) }; }
  };
  function gpRotate(A0, crit, oblique, normalize, maxit = 1000, eps = 1e-5) {
    const p = A0.length, k = A0[0].length, W = A0.map(r => normalize ? Math.sqrt(sum(r.map(v => v * v))) || 1e-12 : 1), A = A0.map((r, i) => r.map(v => v / W[i]));
    const Lof = T => oblique ? matMul(A, tr(inverse(T))) : matMul(A, T);
    const Gof = (T, L, Gq) => oblique ? tr(matMul(matMul(tr(L), Gq), inverse(T))).map(r => r.map(v => -v)) : matMul(tr(A), Gq);
    let T = A[0].map((_, i) => A[0].map((_, j) => +(i === j))), L = Lof(T), vg = crit(L), f = vg.f, G = Gof(T, L, vg.Gq), al = 1, s = Infinity, it;
    for (it = 0; it <= maxit; it++) {
      let Gp;
      if (!oblique) { const M = matMul(tr(T), G), Sy = M.map((r, i) => r.map((v, j) => (v + M[j][i]) / 2)), TS = matMul(T, Sy); Gp = elem(G, TS, (a, b) => a - b); }
      else { const cs = colSums(elem(T, G, (a, b) => a * b)); Gp = G.map((r, i) => r.map((v, j) => v - T[i][j] * cs[j])); }
      s = Math.sqrt(sum(Gp.flat().map(v => v * v))); if (s < eps) break;
      al *= 2; let Tt, Lt, vt;
      for (let ls = 0; ls <= 10; ls++) {
        const X = elem(T, Gp, (a, b) => a - al * b);
        if (oblique) { const v = colSums(elem(X, null, x => x * x)).map(x => 1 / Math.sqrt(x)); Tt = X.map(r => r.map((x, j) => x * v[j])); } else Tt = matMul(X, invSqrtSym(matMul(tr(X), X)));
        try { Lt = Lof(Tt); vt = crit(Lt); if (!isFinite(vt.f)) throw 0; } catch (e) { vt = { f: Infinity }; }
        if (vt.f < f - 0.5 * s * s * al) break; al /= 2;
      }
      if (!isFinite(vt.f)) break;
      T = Tt; L = Lt; f = vt.f; G = Gof(T, L, vt.Gq);
    }
    return { L: L.map((r, i) => r.map(v => v * W[i])), Phi: oblique ? matMul(tr(T), T) : null, conv: s < eps, iter: it };
  }
  // 回転法の一覧：[名前, 直交か斜交か, 実行関数]
  const ROTATIONS = {
    none: ['回転なし', 'none'],
    varimax: ['バリマックス', 'orth'], quartimax: ['クォーティマックス', 'orth'], equamax: ['エカマックス', 'orth'], parsimax: ['パーシマックス', 'orth'], fparsT: ['因子パーシモニー（直交）', 'orth'],
    bentlerT: ['ベントラー（直交）', 'orth'], geominT: ['ジオミン（直交）', 'orth'], infomaxT: ['インフォマックス（直交）', 'orth'], entropy: ['最小エントロピー', 'orth'], mccammon: ['マッカモン', 'orth'],
    tandemI: ['タンデムI', 'orth'], tandemII: ['タンデムII', 'orth'], varimin: ['バリミン', 'orth'], bifactorT: ['バイファクター（直交）', 'orth'], bigeominT: ['バイジオミン（直交）', 'orth'],
    promax: ['プロマックス（κ=4）', 'obl'], promax3: ['プロマックス（κ=3）', 'obl'], promax2: ['プロマックス（κ=2）', 'obl'],
    oblimin: ['直接オブリミン（δ=0, クォーティミン）', 'obl'], biquartimin: ['バイクォーティミン（δ=0.5）', 'obl'],
    geominQ: ['ジオミン（斜交）', 'obl'], bentlerQ: ['ベントラー（斜交）', 'obl'], infomaxQ: ['インフォマックス（斜交）', 'obl'], oblimax: ['オブリマックス', 'obl'], simplimax: ['シンプリマックス', 'obl'],
    cfvarimaxQ: ['CF-バリマックス（斜交）', 'obl'], cfequamaxQ: ['CF-エカマックス（斜交）', 'obl'], cfparsimaxQ: ['CF-パーシマックス（斜交）', 'obl'], fparsQ: ['因子パーシモニー（斜交）', 'obl'],
    bifactorQ: ['バイファクター（斜交）', 'obl'], bigeominQ: ['バイジオミン（斜交）', 'obl']
  };
  function rotate(L, method, normalize) {
    const p = L.length, k = L[0].length;
    if (method === 'none' || k < 2) return { L, Phi: null, conv: true };
    if (method === 'varimax' && normalize) return { L: varimax(L).L, Phi: null, conv: true };
    if (method.startsWith('promax')) { const r = promax(L, { promax: 4, promax3: 3, promax2: 2 }[method]); return { L: r.L, Phi: r.Phi, conv: true }; }
    const cf = kap => M => CRIT.cf(M, kap);
    const map = {
      varimax: [CRIT.varimax, 0], quartimax: [CRIT.quartimax, 0], equamax: [cf(k / (2 * p)), 0], parsimax: [cf((k - 1) / (p + k - 2)), 0], fparsT: [cf(1), 0],
      bentlerT: [CRIT.bentler, 0], geominT: [CRIT.geomin, 0], infomaxT: [CRIT.infomax, 0], entropy: [CRIT.entropy, 0], mccammon: [CRIT.mccammon, 0], tandemI: [CRIT.tandemI, 0], tandemII: [CRIT.tandemII, 0],
      varimin: [CRIT.varimin, 0], bifactorT: [CRIT.bifactor, 0], bigeominT: [CRIT.bigeomin, 0],
      oblimin: [M => CRIT.oblimin(M, 0), 1], biquartimin: [M => CRIT.oblimin(M, .5), 1], geominQ: [CRIT.geomin, 1], bentlerQ: [CRIT.bentler, 1], infomaxQ: [CRIT.infomax, 1],
      oblimax: [CRIT.oblimax, 1], simplimax: [CRIT.simplimax, 1], cfvarimaxQ: [cf(1 / p), 1], cfequamaxQ: [cf(k / (2 * p)), 1], cfparsimaxQ: [cf((k - 1) / (p + k - 2)), 1], fparsQ: [cf(1), 1],
      bifactorQ: [CRIT.bifactor, 1], bigeominQ: [CRIT.bigeomin, 1]
    }[method];
    if (!map) throw new Error('この回転法は使えません。');
    return gpRotate(L, map[0], !!map[1], normalize);
  }
  function factorAnalysis(cols, k, method, rotation, normalize = true) {
    const R = corMatrix(cols), n = cols[0].length, E = extract(R, k, method, n);
    const rr = rotate(E.L.map(r => [...r]), rotation, normalize); let P = rr.L, Phi = rr.Phi;
    for (let j = 0; j < k; j++) if (sum(P.map(r => r[j])) < 0) { P.forEach(r => r[j] = -r[j]); if (Phi) { Phi.forEach((r, q) => { if (q !== j) { r[j] = -r[j]; Phi[j][q] = -Phi[j][q]; } }); } }
    const S = Phi ? matMul(P, Phi) : null, ssl = P[0].map((_, j) => sum(P.map(r => r[j] ** 2)));
    const ssu = E.L[0].map((_, j) => sum(E.L.map(r => r[j] ** 2)));
    return { R, n, k, unrot: E.L, P, S, Phi, h2: E.h2, ssl, ssu, iter: E.iter, conv: E.conv, rotConv: rr.conv, heywood: E.heywood, fit: E.fit, rmsr: E.rmsr };
  }

  // ===== ロジスティック回帰 =====
  function logistic(y, X, names) { // y: 0/1、X: 説明変数の列配列
    const n = y.length, p = X.length, Xm = y.map((_, i) => [1, ...X.map(c => c[i])]), q = p + 1;
    let b = new Array(q).fill(0), ll = -Infinity, it, conv = false, inv;
    const llOf = mu => sum(y.map((v, i) => v ? Math.log(Math.max(mu[i], 1e-300)) : Math.log(Math.max(1 - mu[i], 1e-300))));
    let mu = y.map(() => .5);
    for (it = 1; it <= 100; it++) {
      const w = mu.map(m => Math.max(m * (1 - m), 1e-12)), H = Array.from({ length: q }, () => new Array(q).fill(0)), g = new Array(q).fill(0);
      for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) { g[a] += Xm[i][a] * (y[i] - mu[i]); for (let c = a; c < q; c++) H[a][c] += Xm[i][a] * Xm[i][c] * w[i]; }
      for (let a = 0; a < q; a++) for (let c = 0; c < a; c++) H[a][c] = H[c][a];
      inv = inverse(H); const step = inv.map(r => sum(r.map((v, j) => v * g[j])));
      let t = 1, bn, mun, lln;
      for (let ls = 0; ls < 30; ls++) { bn = b.map((v, j) => v + t * step[j]); mun = Xm.map(r => 1 / (1 + Math.exp(-sum(r.map((v, j) => v * bn[j]))))); lln = llOf(mun); if (lln >= ll - 1e-12) break; t /= 2; }
      const d = Math.abs(lln - ll); b = bn; mu = mun; ll = lln;
      if (d < 1e-11 && Math.max(...step.map(Math.abs)) * t < 1e-8) { conv = true; break; }
    }
    { const w = mu.map(m => Math.max(m * (1 - m), 1e-300)), H = Array.from({ length: q }, () => new Array(q).fill(0));
      for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) for (let c = 0; c < q; c++) H[a][c] += Xm[i][a] * Xm[i][c] * w[i];
      try { inv = inverse(H); } catch (e) { inv = null; } }
    const n1 = sum(y), pbar = n1 / n, ll0 = n1 * Math.log(pbar) + (n - n1) * Math.log(1 - pbar), zc = qn(0.025);
    const separation = !conv || !inv || b.some(v => Math.abs(v) > 25) || mu.some(m => m < 1e-8 || m > 1 - 1e-8);
    const coef = b.map((v, j) => { const se = inv ? Math.sqrt(Math.max(inv[j][j], 0)) : NaN, z = v / se;
      return { name: j ? names[j - 1] : '切片', b: v, se, z, wald: z * z, p: 2 * pnU(Math.abs(z)), or: Math.exp(v), orL: Math.exp(v - zc * se), orU: Math.exp(v + zc * se), sd: j ? sd(X[j - 1]) : NaN }; });
    const LR = 2 * (ll - ll0), cs = 1 - Math.exp(2 * (ll0 - ll) / n), nag = cs / (1 - Math.exp(2 * ll0 / n));
    // Hosmer-Lemeshow（予測確率の十分位でグループ化）
    const qs = Array.from({ length: 11 }, (_, i) => quantile(mu, i / 10)), brk = [...new Set(qs)], grp = mu.map(m => { let g = brk.findIndex((v, i) => i > 0 && m <= v); return g < 1 ? 1 : g; });
    let hl = 0; const G = brk.length - 1;
    for (let g = 1; g <= G; g++) { const idx = mu.map((_, i) => i).filter(i => grp[i] === g); if (!idx.length) continue; const o1 = sum(idx.map(i => y[i])), e1 = sum(idx.map(i => mu[i])), ng = idx.length; hl += (o1 - e1) ** 2 / e1 + ((ng - o1) - (ng - e1)) ** 2 / (ng - e1); }
    const hlDf = G - 2;
    const pred = mu.map(m => +(m >= .5)), tab = [[0, 0], [0, 0]]; y.forEach((v, i) => tab[v][pred[i]]++);
    return { n, n1, p, coef, ll, ll0, dev: -2 * ll, dev0: -2 * ll0, LR, df: p, pLR: pchiU(LR, p), coxSnell: cs, nagelkerke: nag, mcfadden: 1 - ll / ll0, aic: -2 * ll + 2 * q,
      hl: { chi: hl, df: hlDf, p: hlDf > 0 ? pchiU(hl, hlDf) : NaN }, tab, acc: (tab[0][0] + tab[1][1]) / n, fitted: mu, iter: it, conv, separation, inv };
  }
  function roc(score, lab) { // lab: 1 = 事象あり。DeLong 法で AUC の信頼区間
    const pos = score.filter((_, i) => lab[i] === 1), neg = score.filter((_, i) => lab[i] === 0), m = pos.length, nn = neg.length;
    const psi = (x, y) => x > y ? 1 : x === y ? .5 : 0;
    const V10 = pos.map(x => mean(neg.map(y => psi(x, y)))), V01 = neg.map(y => mean(pos.map(x => psi(x, y)))), auc = mean(V10);
    const se = Math.sqrt(vari(V10) / m + vari(V01) / nn), zc = qn(0.025);
    const th = [Infinity, ...[...new Set(score)].sort((a, b) => b - a)], pts = th.map(t => ({ t, tpr: pos.filter(x => x >= t).length / m, fpr: neg.filter(x => x >= t).length / nn }));
    let best = pts[0]; pts.forEach(p => { if (p.tpr - p.fpr > best.tpr - best.fpr) best = p; });
    let best0 = pts[0]; pts.forEach(p => { if (Math.hypot(p.fpr, 1 - p.tpr) < Math.hypot(best0.fpr, 1 - best0.tpr)) best0 = p; });
    return { auc, se, L: Math.max(0, auc - zc * se), U: Math.min(1, auc + zc * se), z: (auc - .5) / se, p: 2 * pnU(Math.abs((auc - .5) / se)), pts, best, best0, m, n: nn, V10, V01 };
  }
  function qbeta(p, a, b) { let lo = 0, hi = 1; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (ibeta(m, a, b) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function binomCI(x, n) { // Clopper-Pearson の正確な 95%信頼区間（R の binom.test と同じ）
    return [x === 0 ? 0 : qbeta(.025, x, n - x + 1), x === n ? 1 : qbeta(.975, x + 1, n - x)];
  }
  function rocCompare(A, B) { // 同じ対象者で測った2つの AUC の差（DeLong 法、pROC の roc.test と同じ）
    const cv = (u, v) => { const mu = mean(u), mv = mean(v); return sum(u.map((x, i) => (x - mu) * (v[i] - mv))) / (u.length - 1); };
    const vd = (vari(A.V10) + vari(B.V10) - 2 * cv(A.V10, B.V10)) / A.m + (vari(A.V01) + vari(B.V01) - 2 * cv(A.V01, B.V01)) / A.n;
    const d = A.auc - B.auc, se = Math.sqrt(vd), z = d / se, zc = qn(0.025);
    return { d, se, z, p: 2 * pnU(Math.abs(z)), L: d - zc * se, U: d + zc * se, r: (cv(A.V10, B.V10) / A.m + cv(A.V01, B.V01) / A.n) / (A.se * B.se) };
  }

  // ===== 生存時間分析 =====
  function kaplanMeier(time, ev) { // ev: 1 = イベント、0 = 打ち切り。R の survfit（conf.type = "log"）と同じ
    const idx = time.map((_, i) => i).sort((a, b) => time[a] - time[b]), ut = [...new Set(idx.map(i => time[i]))], zc = qn(0.025);
    let S = 1, gw = 0, nr = time.length; const steps = [], cens = [];
    ut.forEach(t => {
      const at = idx.filter(i => time[i] === t), d = at.filter(i => ev[i]).length, c = at.length - d;
      if (d > 0) { S *= 1 - d / nr; if (nr > d) gw += d / (nr * (nr - d)); else gw = Infinity; const se = Math.sqrt(gw);
        steps.push({ t, n: nr, d, c, S, seLog: se, L: isFinite(se) && S > 0 ? Math.exp(Math.log(S) - zc * se) : 0, U: isFinite(se) && S > 0 ? Math.min(1, Math.exp(Math.log(S) + zc * se)) : NaN }); }
      if (c > 0) cens.push({ t, S, c });
      nr -= at.length;
    });
    const qtime = (arr, key, q = .5) => { for (let k = 0; k < arr.length; k++) { const v = arr[k][key]; if (v < q - 1e-12) return arr[k].t; if (Math.abs(v - q) < 1e-12) return k + 1 < arr.length ? (arr[k].t + arr[k + 1].t) / 2 : arr[k].t; } return NaN; };
    return { steps, cens, n: time.length, events: sum(ev), median: qtime(steps, 'S'), medL: qtime(steps, 'L'), medU: qtime(steps.filter(s => isFinite(s.U)), 'U'),
      at: t => { let s = 1; for (const st of steps) { if (st.t <= t) s = st.S; else break; } return s; },
      atRisk: t => time.filter(v => v >= t).length };
  }
  function survDiff(time, ev, grp, weight) { // weight: 'logrank' | 'gehan' | 'tarone' | 'peto'
    const lv = uniq(grp), g = lv.length, gi = grp.map(v => lv.indexOf(v)), ut = [...new Set(time.filter((_, i) => ev[i]))].sort((a, b) => a - b);
    const O = new Array(g).fill(0), E = new Array(g).fill(0), V = Array.from({ length: g }, () => new Array(g).fill(0)); let Spool = 1;
    ut.forEach(t => {
      const nrg = lv.map((_, k) => time.filter((v, i) => v >= t && gi[i] === k).length), drg = lv.map((_, k) => time.filter((v, i) => v === t && ev[i] && gi[i] === k).length);
      const n = sum(nrg), d = sum(drg), w = weight === 'gehan' ? n : weight === 'tarone' ? Math.sqrt(n) : weight === 'peto' ? Spool : 1;
      for (let k = 0; k < g; k++) { O[k] += w * drg[k]; E[k] += w * d * nrg[k] / n; if (n > 1) for (let h = 0; h < g; h++) V[k][h] += w * w * d * (n - d) / (n - 1) * nrg[k] / n * ((k === h ? 1 : 0) - nrg[h] / n); }
      Spool *= 1 - d / n;
    });
    const dif = O.map((o, k) => o - E[k]).slice(0, g - 1), Vi = inverse(V.slice(0, g - 1).map(r => r.slice(0, g - 1)));
    const chi = sum(dif.map((a, i) => sum(dif.map((b, j) => a * Vi[i][j] * b)))), df = g - 1;
    const obs = lv.map((_, k) => time.filter((v, i) => ev[i] && gi[i] === k).length);
    return { levels: lv, chi, df, p: pchiU(chi, df), O: obs, E: weight === 'logrank' ? E : null };
  }
  function cox(time, ev, X, names) { // Efron 法（R の coxph の既定）
    const n = time.length, p = X.length, order = time.map((_, i) => i).sort((a, b) => time[b] - time[a]);
    const mu = X.map(c => mean(c)), Z = time.map((_, i) => X.map((c, j) => c[i] - mu[j]));
    const evTimes = [...new Set(time.filter((_, i) => ev[i]))].sort((a, b) => a - b);
    function stats(b) {
      let ll = 0; const U = new Array(p).fill(0), I = Array.from({ length: p }, () => new Array(p).fill(0)), r = Z.map(z => Math.exp(sum(z.map((v, j) => v * b[j]))));
      evTimes.forEach(t => {
        let S0 = 0; const S1 = new Array(p).fill(0), S2 = Array.from({ length: p }, () => new Array(p).fill(0)); let D0 = 0; const D1 = new Array(p).fill(0), D2 = Array.from({ length: p }, () => new Array(p).fill(0)); let d = 0;
        for (let i = 0; i < n; i++) { if (time[i] < t) continue; const ri = r[i], z = Z[i]; S0 += ri; for (let a = 0; a < p; a++) { S1[a] += ri * z[a]; for (let c = 0; c < p; c++) S2[a][c] += ri * z[a] * z[c]; }
          if (time[i] === t && ev[i]) { d++; D0 += ri; ll += Math.log(ri); for (let a = 0; a < p; a++) { D1[a] += ri * z[a]; U[a] += z[a]; for (let c = 0; c < p; c++) D2[a][c] += ri * z[a] * z[c]; } } }
        for (let l = 0; l < d; l++) { const c = l / d, s0 = S0 - c * D0, s1 = S1.map((v, a) => v - c * D1[a]); ll -= Math.log(s0);
          for (let a = 0; a < p; a++) { U[a] -= s1[a] / s0; for (let q = 0; q < p; q++) I[a][q] += (S2[a][q] - c * D2[a][q]) / s0 - s1[a] * s1[q] / (s0 * s0); } }
      });
      return { ll, U, I };
    }
    let b = new Array(p).fill(0), st = stats(b); const ll0 = st.ll, score0 = (() => { const Ii = inverse(st.I); return sum(st.U.map((u, i) => sum(st.U.map((v, j) => u * Ii[i][j] * v)))); })();
    let it, conv = false;
    for (it = 1; it <= 50; it++) {
      const Ii = inverse(st.I), step = Ii.map(r => sum(r.map((v, j) => v * st.U[j]))); let t = 1, bn, sn;
      for (let ls = 0; ls < 30; ls++) { bn = b.map((v, j) => v + t * step[j]); sn = stats(bn); if (sn.ll >= st.ll - 1e-10) break; t /= 2; }
      const d = Math.abs(sn.ll - st.ll); b = bn; st = sn; if (d < 1e-11) { conv = true; break; }
    }
    const V = inverse(st.I), zc = qn(0.025);
    const coef = b.map((v, j) => { const se = Math.sqrt(V[j][j]), z = v / se; return { name: names[j], b: v, se, z, p: 2 * pnU(Math.abs(z)), hr: Math.exp(v), hrL: Math.exp(v - zc * se), hrU: Math.exp(v + zc * se), sd: sd(X[j]) }; });
    const LR = 2 * (st.ll - ll0), wald = sum(b.map((u, i) => sum(b.map((w, j) => u * inverse(V)[i][j] * w))));
    // Harrell の C（R の concordance と同じ数え方）
    const lp = Z.map(z => sum(z.map((v, j) => v * b[j]))); let conc = 0, disc = 0, tie = 0;
    for (let i = 0; i < n; i++) { if (!ev[i]) continue; for (let j = 0; j < n; j++) { if (j === i) continue; if (time[j] > time[i] || (time[j] === time[i] && !ev[j])) { if (lp[i] > lp[j]) conc++; else if (lp[i] < lp[j]) disc++; else tie++; } } }
    // 基準累積ハザード（Breslow、共変量は平均）
    const H0 = []; let H = 0; evTimes.forEach(t => { const d = time.filter((v, i) => v === t && ev[i]).length, den = sum(time.map((v, i) => v >= t ? Math.exp(lp[i]) : 0)); H += d / den; H0.push({ t, H }); });
    return { n, events: sum(ev), coef, ll: st.ll, ll0, LR, df: p, pLR: pchiU(LR, p), wald, pWald: pchiU(wald, p), score: score0, pScore: pchiU(score0, p), C: (conc + tie / 2) / (conc + disc + tie), iter: it, conv, mu, b, H0, V };
  }

  return { kaplanMeier, survDiff, cox, logistic, roc, rocCompare, binomCI, qbeta, EXTRACTIONS, ROTATIONS, rotate, gpRotate, extract, eigSym, corMatrix, kmo, bartlettSph, parallel, factorAnalysis, varimax, promax, ols, anova2, mixedAnova, multiReg, uniq, lgamma, pnorm, dnorm, pt2, ptU, pfU, pchiU, pnU, qt, qn, qf, qchi, ptukey, ptukeyU, ibeta,
    num, sum, mean, sd, vari, quantile, ranks, describe, tTest, mannWhitney, pairedT, wilcoxon, signTest,
    anova1, bartlett, levene, kruskal, postHoc, holm, padjust, gamesHowell, rmAnova, friedman, cronbach, pearson, spearman, kendall, regression, chiTable, fisher2x2, pairs };
})();
if (typeof module !== 'undefined') module.exports = S;
