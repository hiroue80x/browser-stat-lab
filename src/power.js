// ===== 検定力分析（R の pwr パッケージと同じ計算） =====
FORMATS.push({ id: 'power', label: '検定力分析', sub: '必要な人数を計算', desc: '' });
state.pow = Object.assign({ test: 'tind', mode: 'n', es: 0.5, alpha: 0.05, power: 0.8, n: 50, tail: 'two', k: 3, u: 3, p: 5, df: 1, ratio: 1 }, state.pow || {});

// ---- 非心分布 ----
function pntCDF(t, df, ncp) { // 非心 t 分布の下側確率（AS 243、R の pnt と同じ手順）
  if (!ncp) return 1 - S.ptU(t, df);
  let tt = t, del = ncp, neg = false; if (t < 0) { neg = true; tt = -t; del = -ncp; }
  if (df > 4e5 || del * del > 2 * Math.LN2 * 1021) { const s = 1 / (4 * df), p = S.pnorm((tt * (1 - s) - del) / Math.sqrt(1 + tt * tt * 2 * s)); return neg ? 1 - p : p; }
  const x = tt * tt / (tt * tt + df); let tnc = 0;
  if (x > 0) {
    const lam = del * del; let p = .5 * Math.exp(-.5 * lam), q = Math.sqrt(2 / Math.PI) * p * del, s = .5 - p; if (s < 1e-7) s = -.5 * (Math.exp(-.5 * lam) - 1) - p;
    let a = .5; const b = .5 * df, rxb = Math.pow(1 - x, b), albeta = .5 * Math.log(Math.PI) + S.lgamma(b) - S.lgamma(.5 + b);
    let xodd = S.ibeta(x, a, b), godd = 2 * rxb * Math.exp(a * Math.log(x) - albeta), xeven = b * x < 1e-300 ? b * x : 1 - rxb, geven = b * x * rxb;
    tnc = p * xodd + q * xeven;
    for (let it = 1; it <= 5000; it++) { a += 1; xodd -= godd; xeven -= geven; godd *= x * (a + b - 1) / a; geven *= x * (a + b - .5) / (a + .5); p *= lam / (2 * it); q *= lam / (2 * it + 1); tnc += p * xodd + q * xeven; s -= p; if (s < -1e-10 || Math.abs(2 * s * (xodd - godd)) < 1e-14) break; }
  }
  tnc += S.pnorm(-del); const r = Math.min(1, Math.max(0, tnc)); return neg ? 1 - r : r;
}
function pnfCDF(x, d1, d2, lam) { if (x <= 0) return 0; if (!(lam > 0)) return 1 - S.pfU(x, d1, d2); const y = d1 * x / (d1 * x + d2), h = lam / 2, J = Math.ceil(h + 12 * Math.sqrt(h) + 60); let s = 0; for (let j = 0; j <= J; j++) s += Math.exp(-h + j * Math.log(h) - S.lgamma(j + 1)) * S.ibeta(y, d1 / 2 + j, d2 / 2); return Math.min(1, s); }
const pncCDF = (x, df, lam) => x <= 0 ? 0 : S.sem.pnchisq(x, df, lam || 0);
const qnU = p => S.qn(p);

// ---- 検定ごとの定義 ----
const PW_TESTS = {
  tind: { label: '独立な 2 群の平均の差（t 検定）', es: 'd', esName: 'Cohen の d', bm: [.2, .5, .8], nLabel: '1 群あたりの人数', tail: true, rfun: 'pwr.t.test', esMax: 10, nMin: 2,
    power(es, n, o) { const n1 = n, n2 = Math.max(2, n * o.ratio), nu = n1 + n2 - 2, ncp = es / Math.sqrt(1 / n1 + 1 / n2); return o.tail === 'two' ? (() => { const qu = S.qt(o.alpha / 2, nu); return 1 - pntCDF(qu, nu, ncp) + pntCDF(-qu, nu, ncp); })() : 1 - pntCDF(S.qt(o.alpha, nu), nu, ncp); },
    stat(es, n, o) { const n2 = Math.max(2, n * o.ratio), nu = n + n2 - 2; return { kind: 't', df: nu, ncp: es / Math.sqrt(1 / n + 1 / n2) }; } },
  tpair: { label: '対応のある 2 条件の平均の差（対応のある t 検定）', es: 'dz', esName: 'Cohen の d_z（差得点の平均 ÷ 差得点の SD）', bm: [.2, .5, .8], nLabel: '人数（ペアの数）', tail: true, rfun: 'pwr.t.test', esMax: 10, nMin: 2,
    power(es, n, o) { const nu = n - 1, ncp = es * Math.sqrt(n); return o.tail === 'two' ? (() => { const qu = S.qt(o.alpha / 2, nu); return 1 - pntCDF(qu, nu, ncp) + pntCDF(-qu, nu, ncp); })() : 1 - pntCDF(S.qt(o.alpha, nu), nu, ncp); },
    stat(es, n) { return { kind: 't', df: n - 1, ncp: es * Math.sqrt(n) }; } },
  tone: { label: '1 つの平均と基準値の差（1 標本の t 検定）', es: 'd', esName: 'Cohen の d（（平均 − 基準値）÷ SD）', bm: [.2, .5, .8], nLabel: '人数', tail: true, rfun: 'pwr.t.test', esMax: 10, nMin: 2,
    power(es, n, o) { return PW_TESTS.tpair.power(es, n, o); }, stat(es, n) { return { kind: 't', df: n - 1, ncp: es * Math.sqrt(n) }; } },
  anova1: { label: '3 群以上の平均の差（一元配置分散分析）', es: 'f', esName: 'Cohen の f', bm: [.1, .25, .4], nLabel: '1 群あたりの人数', rfun: 'pwr.anova.test', esMax: 5, nMin: 2,
    power(es, n, o) { const d1 = o.k - 1, d2 = (n - 1) * o.k, lam = o.k * n * es * es; return 1 - pnfCDF(S.qf(o.alpha, d1, d2), d1, d2, lam); },
    stat(es, n, o) { return { kind: 'F', d1: o.k - 1, d2: (n - 1) * o.k, ncp: o.k * n * es * es }; } },
  r: { label: '相関係数（無相関の検定）', es: 'r', esName: '相関係数 r', bm: [.1, .3, .5], nLabel: '人数', tail: true, rfun: 'pwr.r.test', esMax: .9999, nMin: 4,
    power(es, n, o) { const two = o.tail === 'two', ttt = S.qt(two ? o.alpha / 2 : o.alpha, n - 2), rc = Math.sqrt(ttt * ttt / (ttt * ttt + n - 2)), zr = Math.atanh(es) + es / (2 * (n - 1)), zrc = Math.atanh(rc), s = Math.sqrt(n - 3); return S.pnorm((zr - zrc) * s) + (two ? S.pnorm((-zr - zrc) * s) : 0); },
    stat(es, n, o) { const two = o.tail === 'two', ttt = S.qt(two ? o.alpha / 2 : o.alpha, n - 2), rc = Math.sqrt(ttt * ttt / (ttt * ttt + n - 2)), s = Math.sqrt(n - 3); return { kind: 'z', mean: (Math.atanh(es) + es / (2 * (n - 1))) * s, crit: Math.atanh(rc) * s, two }; } },
  reg: { label: '重回帰分析（R² の検定）', es: 'f2', esName: 'Cohen の f²（＝ R² ÷ (1 − R²)）', bm: [.02, .15, .35], nLabel: '全体の人数', rfun: 'pwr.f2.test', esMax: 20, nMin: o => o.u + 2,
    power(es, n, o) { const u = o.u, v = n - u - 1, lam = es * (u + v + 1); return 1 - pnfCDF(S.qf(o.alpha, u, v), u, v, lam); },
    stat(es, n, o) { const v = n - o.u - 1; return { kind: 'F', d1: o.u, d2: v, ncp: es * (o.u + v + 1) }; } },
  regd: { label: '階層的重回帰分析（ΔR² の検定）', es: 'f2', esName: 'Cohen の f²（＝ ΔR² ÷ (1 − 全体の R²)）', bm: [.02, .15, .35], nLabel: '全体の人数', rfun: 'pwr.f2.test', esMax: 20, nMin: o => o.p + 2,
    power(es, n, o) { const u = o.u, v = n - o.p - 1, lam = es * (u + v + 1); return 1 - pnfCDF(S.qf(o.alpha, u, v), u, v, lam); },
    stat(es, n, o) { const v = n - o.p - 1; return { kind: 'F', d1: o.u, d2: v, ncp: es * (o.u + v + 1) }; } },
  chisq: { label: 'クロス集計・適合度（χ² 検定）', es: 'w', esName: 'Cohen の w', bm: [.1, .3, .5], nLabel: '全体の人数', rfun: 'pwr.chisq.test', esMax: 5, nMin: 2,
    power(es, n, o) { return 1 - pncCDF(S.qchi(o.alpha, o.df), o.df, n * es * es); }, stat(es, n, o) { return { kind: 'chi', df: o.df, ncp: n * es * es }; } },
  prop2: { label: '2 群の比率の差', es: 'h', esName: 'Cohen の h（＝ 2·asin√p₁ − 2·asin√p₂）', bm: [.2, .5, .8], nLabel: '1 群あたりの人数', tail: true, rfun: 'pwr.2p.test', esMax: Math.PI, nMin: 2,
    power(es, n, o) { const s = es * Math.sqrt(n / 2); return o.tail === 'two' ? 1 - S.pnorm(qnU(o.alpha / 2) - s) + S.pnorm(-qnU(o.alpha / 2) - s) : 1 - S.pnorm(qnU(o.alpha) - s); },
    stat(es, n, o) { return { kind: 'z', mean: es * Math.sqrt(n / 2), crit: qnU(o.tail === 'two' ? o.alpha / 2 : o.alpha), two: o.tail === 'two' }; } }
};
const PW_SYM = { d: '<i>d</i>', dz: '<i>d<sub>z</sub></i>', f: '<i>f</i>', r: '<i>r</i>', f2: '<i>f</i>²', w: '<i>w</i>', h: '<i>h</i>' };
const PW_SYM_T = { d: 'd', dz: 'dz', f: 'f', r: 'r', f2: 'f²', w: 'w', h: 'h' };
function pwOpts() { const P = state.pow; return { alpha: +P.alpha, tail: P.tail, k: Math.max(2, Math.round(+P.k)), u: Math.max(1, Math.round(+P.u)), p: Math.max(Math.round(+P.u), Math.round(+P.p)), df: Math.max(1, Math.round(+P.df)), ratio: Math.max(.05, +P.ratio || 1) }; }
const pwNMin = (T, o) => typeof T.nMin === 'function' ? T.nMin(o) : T.nMin;
function pwSolveN(T, es, target, o) { // 検定力が目標に届く人数（連続値）
  const f = n => T.power(es, n, o) - target; let lo = pwNMin(T, o) + 1e-6, hi = lo * 2 + 10;
  if (f(lo) >= 0) return lo; let g = 0; while (f(hi) < 0 && g++ < 60) hi *= 2; if (f(hi) < 0) return NaN;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; if (hi - lo < 1e-9 * hi) break; } return hi;
}
function pwSolveEs(T, n, target, o) { const f = e => T.power(e, n, o) - target; let lo = 1e-7, hi = T.esMax; if (f(hi) < 0) return NaN; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; } return hi; }
function pwCompute() {
  const P = state.pow, T = PW_TESTS[P.test], o = pwOpts(), es = +P.es, R = { T, o, mode: P.mode };
  if (P.mode === 'n') { need(es > 0 && es < T.esMax, '効果量に正の値を入れてください。'); R.es = es; R.target = +P.power; need(R.target > o.alpha && R.target < 1, '検定力は α より大きく 1 より小さい値にしてください。'); R.nCont = pwSolveN(T, es, R.target, o); need(isFinite(R.nCont), '人数が多すぎて計算できません（効果量が小さすぎます）。'); R.n = Math.ceil(R.nCont - 1e-9); R.pow = T.power(es, R.n, o); }
  else if (P.mode === 'power') { R.es = es; R.n = +P.n; need(es >= 0 && es < T.esMax, '効果量を確かめてください。'); need(R.n > pwNMin(T, o), `人数は ${pwNMin(T, o)} より大きくしてください。`); R.pow = T.power(es, R.n, o); }
  else { R.n = +P.n; R.target = +P.power; need(R.n > pwNMin(T, o), `人数は ${pwNMin(T, o)} より大きくしてください。`); R.es = pwSolveEs(T, R.n, R.target, o); need(isFinite(R.es), 'この人数では、目標の検定力に届く効果量がありません。'); R.pow = R.target; }
  R.total = P.test === 'tind' ? R.n + Math.ceil(R.n * o.ratio - 1e-9) : P.test === 'anova1' ? R.n * o.k : P.test === 'prop2' ? 2 * R.n : R.n;
  R.n2 = P.test === 'tind' ? Math.ceil(R.n * o.ratio - 1e-9) : null;
  return R;
}
function pwNText(R) { const t = state.pow.test; if (t === 'tind') return R.o.ratio === 1 ? `各群 ${R.n} 人（合計 ${R.total} 人）` : `群1 ${R.n} 人・群2 ${R.n2} 人（合計 ${R.total} 人）`; if (t === 'anova1') return `各群 ${R.n} 人 × ${R.o.k} 群（合計 ${R.total} 人）`; if (t === 'prop2') return `各群 ${R.n} 人（合計 ${R.total} 人）`; if (t === 'tpair') return `${R.n} 人（ペア）`; return `${R.n} 人`; }
function pwEsLabel(T, es) { const b = T.bm; return es < b[0] ? '小さい効果よりさらに小さい' : es < b[1] ? '小〜中程度' : es < b[2] ? '中〜大程度' : '大きい'; }

// ---- 図 ----
function pwDensity(st, x) { // H0（中心）と H1（非心）の密度（非心は CDF の数値微分）
  const h = 1e-4;
  if (st.kind === 't') { const c = Math.exp(S.lgamma((st.df + 1) / 2) - S.lgamma(st.df / 2)) / Math.sqrt(st.df * Math.PI) * Math.pow(1 + x * x / st.df, -(st.df + 1) / 2); return [c, (pntCDF(x + h, st.df, st.ncp) - pntCDF(x - h, st.df, st.ncp)) / (2 * h)]; }
  if (st.kind === 'F') { if (x <= h) return [0, 0]; return [(pnfCDF(x + h, st.d1, st.d2, 0) - pnfCDF(x - h, st.d1, st.d2, 0)) / (2 * h), (pnfCDF(x + h, st.d1, st.d2, st.ncp) - pnfCDF(x - h, st.d1, st.d2, st.ncp)) / (2 * h)]; }
  if (st.kind === 'chi') { if (x <= h) return [0, 0]; return [(pncCDF(x + h, st.df, 0) - pncCDF(x - h, st.df, 0)) / (2 * h), (pncCDF(x + h, st.df, st.ncp) - pncCDF(x - h, st.df, st.ncp)) / (2 * h)]; }
  const dn = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); return [dn(x), dn(x - st.mean)];
}
function pwDistPlot(R) {
  const st = R.T.stat(R.es, R.n, R.o), a = R.o.alpha, two = st.kind === 't' || st.kind === 'z' ? (st.two ?? R.o.tail === 'two') : false;
  let crit, lo, hi;
  if (st.kind === 't') { crit = S.qt(two ? a / 2 : a, st.df); lo = Math.min(-4.5, st.ncp - 4); hi = Math.max(4.5, st.ncp + 4.5); }
  else if (st.kind === 'z') { crit = st.crit; lo = Math.min(-4.5, st.mean - 4); hi = Math.max(4.5, st.mean + 4.5); }
  else if (st.kind === 'F') { crit = S.qf(a, st.d1, st.d2); const m1 = (st.d2 > 2 ? st.d2 / (st.d2 - 2) : 1.5) * (st.d1 + st.ncp) / st.d1; lo = 0; hi = Math.max(crit * 2.2, m1 * 2.2, 4); }
  else { crit = S.qchi(a, st.df); lo = 0; hi = Math.max(crit * 1.8, st.df + st.ncp + 4 * Math.sqrt(2 * (st.df + 2 * st.ncp))); }
  const W = 560, H = 250, M = { l: 20, r: 20, t: 46, b: 40 }, N = 240, xs = Array.from({ length: N + 1 }, (_, i) => lo + (hi - lo) * i / N), ds = xs.map(x => pwDensity(st, x).map(v => isFinite(v) && v > 0 ? v : 0));
  const ymax = Math.max(...ds.map(d => Math.max(d[0], d[1]))) * 1.08 || 1, fx = x => M.l + (x - lo) / (hi - lo) * (W - M.l - M.r), fy = v => H - M.b - Math.min(v, ymax) / ymax * (H - M.t - M.b);
  const area = (k, inside) => { const segs = []; let cur = null; xs.forEach((x, i) => { if (inside(x)) { if (!cur) segs.push(cur = []); cur.push([x, ds[i][k]]); } else cur = null; }); return segs.map(pts => `M${fx(pts[0][0])},${fy(0)} ${pts.map(([x, v]) => `L${fx(x)},${fy(v)}`).join(' ')} L${fx(pts[pts.length - 1][0])},${fy(0)} Z`).join(' '); }; // 両側のときは左右の裾を別々に塗る
  const rej = x => x >= crit || (two && x <= -crit);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<path d="${area(1, rej)}" fill="var(--accent)" fill-opacity=".35"/><path d="${area(1, x => !rej(x))}" fill="var(--muted)" fill-opacity=".22"/><path d="${area(0, rej)}" fill="var(--sig)" fill-opacity=".55"/>`;
  s += `<path d="M${xs.map((x, i) => `${fx(x)},${fy(ds[i][0])}`).join(' L')}" fill="none" stroke="var(--fg)" stroke-width="1.6"/><path d="M${xs.map((x, i) => `${fx(x)},${fy(ds[i][1])}`).join(' L')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(0)}" y2="${fy(0)}" stroke="var(--line)"/>`;
  [crit, ...(two ? [-crit] : [])].forEach(c => { if (c >= lo && c <= hi) s += `<line x1="${fx(c)}" x2="${fx(c)}" y1="${M.t - 6}" y2="${fy(0)}" stroke="var(--sig)" stroke-dasharray="4 3"/>`; });
  niceTicks(lo, hi).filter(v => v >= lo && v <= hi).forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 14}" text-anchor="middle" style="font-size:10px">${+v.toPrecision(4)}</text>`);
  const lab = { t: 't 値', z: 'z 値（正規近似）', F: 'F 値', chi: 'χ² 値' }[st.kind];
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">${lab}</text>`;
  s += `<text x="${fx(crit) + 4}" y="${M.t + 4}" style="fill:var(--sig);font-size:10.5px">臨界値 ${fmt(crit, 2)}</text>`;
  const lg = [['var(--fg)', '効果がないとき（帰無仮説 H₀）の分布'], ['var(--accent)', `効果があるとき（${PW_SYM_T[R.T.es]} = ${fmt(R.es, 3)}、${R.T.nLabel.replace('の人数', '')} ${R.n}）の分布`]];
  lg.forEach(([c, t], i) => s += `<line x1="${M.l + 4}" x2="${M.l + 24}" y1="${12 + i * 15}" y2="${12 + i * 15}" stroke="${c}" stroke-width="2"/><text x="${M.l + 30}" y="${16 + i * 15}" style="font-size:10.5px">${t}</text>`);
  s += `<text x="${W - M.r}" y="16" text-anchor="end" style="font-size:10.5px"><tspan style="fill:var(--sig)">■ α（第 1 種の誤り）</tspan>　<tspan style="fill:var(--accent)">■ 検定力 ${fmt(R.pow, 3)}</tspan>　<tspan style="fill:var(--muted)">■ β ${fmt(1 - R.pow, 3)}</tspan></text>`;
  return s + '</svg>';
}
function pwCurve(R) {
  const T = R.T, o = R.o, nmin = pwNMin(T, o) + 1, target = R.target ?? .8, nreq = R.n;
  const nmax = Math.max(nmin + 10, Math.ceil(nreq * 2.2), Math.ceil(pwSolveN(T, T.bm[1], .95, o) * 1.1) || 50);
  const W = 560, H = 270, M = { l: 48, r: 110, t: 30, b: 42 }, fx = n => M.l + (n - nmin) / (nmax - nmin) * (W - M.l - M.r), fy = p => H - M.b - p * (H - M.t - M.b), N = 120;
  const line = es => Array.from({ length: N + 1 }, (_, i) => { const n = nmin + (nmax - nmin) * i / N; return `${fx(n)},${fy(Math.min(1, Math.max(0, T.power(es, n, o))))}`; }).join(' ');
  let s = frame(W, H, M, [0, .2, .4, .6, .8, 1], '検定力', fy);
  niceTicks(nmin, nmax).filter(v => v >= nmin && v <= nmax).forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${v}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" style="fill:var(--fg);font-size:10.5px">${T.nLabel}</text>`;
  const labs = [...T.bm.map((e, i) => ({ y: fy(Math.min(1, T.power(e, nmax, o))), t: `${['小', '中', '大'][i]} ${PW_SYM_T[T.es]} = ${e}`, st: 'font-size:10px;fill:var(--muted)' })), { y: fy(Math.min(1, T.power(R.es, nmax, o))), t: `${PW_SYM_T[T.es]} = ${fmt(R.es, 3)}`, st: 'font-size:11px;font-weight:700;fill:var(--accent)' }], ly = lmSpread(labs.map(l => l.y), 13);
  T.bm.forEach(e => s += `<polyline points="${line(e)}" fill="none" stroke="var(--muted)" stroke-dasharray="4 3" stroke-width="1.2"/>`);
  s += `<polyline points="${line(R.es)}" fill="none" stroke="var(--accent)" stroke-width="2.6"/>` + labs.map((l, i) => `<text x="${W - M.r + 6}" y="${ly[i] + 4}" style="${l.st}">${l.t}</text>`).join('');
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(target)}" y2="${fy(target)}" stroke="var(--sig)" stroke-dasharray="5 4"/><text x="${M.l + 4}" y="${fy(target) - 4}" style="fill:var(--sig);font-size:10.5px">目標の検定力 ${target}</text>`;
  if (nreq >= nmin && nreq <= nmax) s += `<line x1="${fx(nreq)}" x2="${fx(nreq)}" y1="${fy(0)}" y2="${fy(R.pow)}" stroke="var(--accent)" stroke-dasharray="3 3"/><circle cx="${fx(nreq)}" cy="${fy(R.pow)}" r="5" fill="var(--accent)"/><text x="${fx(nreq) + 6}" y="${fy(R.pow) + 16}" style="font-size:11px;font-weight:600;fill:var(--accent)">${nreq}</text>`;
  s += `<text x="${M.l}" y="16" style="font-size:10.5px">人数を増やすと検定力は上がります。点線は、効果量が小・中・大（Cohen の目安）のとき。</text>`;
  return s + '</svg>';
}
function pwQuickTable(T, o) { // 早見表：小・中・大 × 検定力 .80/.90/.95
  return table(['効果量', '.80', '.90', '.95'], T.bm.map((e, i) => [`${['小', '中', '大'][i]}（${PW_SYM_T[T.es]} = ${e}）`, ...[.8, .9, .95].map(p => { const n = Math.ceil(pwSolveN(T, e, p, o) - 1e-9); return isFinite(n) ? String(n) : '—'; })]));
}
function pwR(R) {
  const P = state.pow, o = R.o, T = R.T, alt = T.tail ? `, alternative = ${RS(o.tail === 'two' ? 'two.sided' : 'greater')}` : '', a = `sig.level = ${o.alpha}`;
  const pw = P.mode === 'n' ? `power = ${R.target}` : P.mode === 'power' ? '' : `power = ${R.target}`, es = P.mode === 'es' ? '' : String(+R.es), n = P.mode === 'n' ? '' : String(R.n);
  const arg = (k, v) => v === '' ? '' : `${k} = ${v}, `; let call;
  if (P.test === 'tind' && o.ratio !== 1) call = `pwr::pwr.t2n.test(${arg('d', es)}n1 = ${P.mode === 'n' ? '<<n1>>' : R.n}, n2 = ${P.mode === 'n' ? '<<n2>>' : Math.ceil(R.n * o.ratio - 1e-9)}, ${a}${alt})   # 2 群の人数が違うとき（n1 と n2 を入れて検定力を確かめる）`;
  else if (P.test === 'tind' || P.test === 'tpair' || P.test === 'tone') call = `pwr::pwr.t.test(${arg('d', es)}${arg('n', n)}${a}, ${pw ? pw + ', ' : ''}type = ${RS({ tind: 'two.sample', tpair: 'paired', tone: 'one.sample' }[P.test])}${alt})`;
  else if (P.test === 'anova1') call = `pwr::pwr.anova.test(k = ${o.k}, ${arg('f', es)}${arg('n', n)}${a}${pw ? ', ' + pw : ''})`;
  else if (P.test === 'r') call = `pwr::pwr.r.test(${arg('r', es)}${arg('n', n)}${a}${pw ? ', ' + pw : ''}${alt})`;
  else if (P.test === 'reg' || P.test === 'regd') call = `pwr::pwr.f2.test(u = ${o.u}, ${P.mode === 'n' ? '' : `v = ${R.n - (P.test === 'reg' ? o.u : o.p) - 1}, `}${arg('f2', es)}${a}${pw ? ', ' + pw : ''})   # v = 人数 − ${P.test === 'reg' ? '説明変数の数' : '全体の説明変数の数'} − 1${P.mode === 'n' ? `。必要な人数 = v + ${P.test === 'reg' ? o.u : o.p} + 1（v は切り上げ）` : ''}`;
  else if (P.test === 'chisq') call = `pwr::pwr.chisq.test(${arg('w', es)}${arg('N', n)}df = ${o.df}, ${a}${pw ? ', ' + pw : ''})`;
  else call = `pwr::pwr.2p.test(${arg('h', es)}${arg('n', n)}${a}${pw ? ', ' + pw : ''}${alt})`;
  if (P.test === 'tind' && o.ratio !== 1 && P.mode === 'n') call = call.replace('<<n1>>', R.n).replace('<<n2>>', R.n2).replace(arg('d', es), `d = ${+R.es}, `);
  return rHeader(`検定力分析（${T.label}）`, ['pwr']) + call + '\n' + (P.test === 'tind' && o.ratio === 1 && P.mode === 'n' ? '# 結果の n は 1 群あたりの人数（小数は切り上げる）\n' : '') + (P.test === 'anova1' && P.mode === 'n' ? '# 結果の n は 1 群あたりの人数（小数は切り上げる）\n' : '');
}
function pwResult() {
  const R = pwCompute(), P = state.pow, T = R.T, o = R.o, sym = PW_SYM[T.es], tailT = T.tail ? (o.tail === 'two' ? '両側' : '片側') : '';
  const modeT = { n: '必要なサンプルサイズ', power: '検定力', es: '検出できる効果量' }[P.mode];
  const extra = [P.test === 'anova1' ? ['群の数 k', o.k] : null, P.test === 'reg' ? ['説明変数の数', o.u] : null, P.test === 'regd' ? ['追加する説明変数の数 u', o.u] : null, P.test === 'regd' ? ['全体の説明変数の数', o.p] : null, P.test === 'chisq' ? ['自由度', o.df] : null, P.test === 'tind' && o.ratio !== 1 ? ['人数の比（群2 ÷ 群1）', o.ratio] : null].filter(Boolean);
  const rows = [['分析', esc(T.label)], ['計算したもの', modeT], ...extra.map(x => [x[0], String(x[1])]), [`効果量 ${sym}`, P.mode === 'es' ? `<b>${fmt(R.es, 3)}</b>` : fmt(R.es, 3)], ['有意水準 α', `${o.alpha}${tailT ? `（${tailT}）` : ''}`], ['検定力 1 − β', P.mode === 'power' ? `<b>${fmt(R.pow, 3)}</b>` : `${R.target}${P.mode === 'n' ? `（実際の人数での検定力 ${fmt(R.pow, 3)}）` : ''}`], [T.nLabel, P.mode === 'n' ? `<b>${pwNText(R)}</b>${R.nCont ? `<br><small>計算値 ${fmt(R.nCont, 2)} を切り上げ</small>` : ''}` : pwNText(R)]];
  let h = guideBox('検定力分析とは', [
    ['検定力', '本当に効果があるときに、それを「有意」として正しく見つけられる確率（1 − β）です。.80 以上がよく目安にされます。'],
    ['4 つの関係', '<b>効果量・有意水準 α・検定力・人数</b>は、3 つを決めると残りの 1 つが決まります。研究を始める前に「どのくらいの効果を見つけたいか」から必要な人数を求めるのが<b>事前の検定力分析</b>です。'],
    ['効果量の決め方', '先行研究やメタ分析の値を使うのが最善です。手がかりがないときは Cohen の目安（小・中・大）を使いますが、「中」を何となく選ぶのではなく、理由を説明できるようにしましょう。']]);
  h += '<h4>結果</h4>' + table(['', ''], rows);
  h += '<h4>図：2 つの分布と検定力</h4>' + pwDistPlot(R) + `<p class="note">黒い線は効果がないときの分布、青い線は想定した効果があるときの分布です。臨界値（赤い点線）より外側に出れば「有意」になります。赤い部分が α（効果がないのに有意になる誤り）、青い部分が検定力、灰色が β（効果があるのに見逃す誤り）です。</p>`;
  h += '<h4>図：人数と検定力</h4>' + pwCurve(R);
  h += `<h4>早見表：必要な人数（α = ${o.alpha}${tailT ? `・${tailT}` : ''}）</h4>` + pwQuickTable(T, o) + `<p class="note">表の値は「${T.nLabel}」です。</p>`;
  const note = { r: 'R の pwr パッケージは相関の検定力を Fisher の z 変換による近似で計算します。G*Power（正確な計算）とは人数が 1〜2 人違うことがあります。', regd: 'ΔR² の検定は R の pwr パッケージと同じく λ = f²（u ＋ v ＋ 1）で計算しています。G*Power は λ = f² × 人数を使うため、人数が少し違うことがあります。', anova1: 'G*Power の「ANOVA: Fixed effects, omnibus, one-way」と同じ計算です（G*Power は全体の人数で表示します）。', chisq: '自由度は、クロス集計なら（行の数 − 1）×（列の数 − 1）、適合度の検定ならカテゴリーの数 − 1 です。' }[P.test] || '';
  if (note) h += `<p class="note">${note}</p>`;
  const nT = pwNText(R), esT = `${PW_SYM_T[T.es]} = ${fmt(R.es, 2)}`;
  h += interp(P.mode === 'n' ? `効果量 ${esT}（${pwEsLabel(T, R.es)}）の効果を、有意水準 ${o.alpha}${tailT ? `（${tailT}検定）` : ''}・検定力 ${R.target} で見つけるには、${nT}が必要です。` : P.mode === 'power' ? `${nT}で効果量 ${esT} の効果を調べたときの検定力は ${fmt(R.pow, 3)} です。${R.pow < .8 ? '.80 に届いていないので、効果があっても見逃す可能性が高めです（β = ' + fmt(1 - R.pow, 2) + '）。' : '.80 以上あり、十分な検定力です。'}` : `${nT}・有意水準 ${o.alpha}・検定力 ${R.target} で見つけられる最小の効果量は ${esT}（${pwEsLabel(T, R.es)}）です。これより小さい効果は、あっても見逃しやすくなります（感度分析）。`,
    '欠損や途中の脱落が見込まれるときは、その分（例：10〜20%）を上乗せして募集人数を決めます。',
    '研究が終わったあとに、得られた効果量から検定力を計算する「事後の検定力分析」は、p 値と同じ情報しか持たないため勧められていません。事前に計画するか、得られた人数で検出できた効果量（感度分析）を報告しましょう。');
  h += apa('論文記載例', P.mode === 'n' ? `事前に検定力分析を行った（R の pwr パッケージ、ブラウザ統計ラボ）。効果量を ${esT}、有意水準を α = ${o.alpha}${tailT ? `（${tailT}）` : ''}、検定力を ${R.target} としたとき、必要なサンプルサイズは${nT}であった。` : P.mode === 'power' ? `${nT}、有意水準 α = ${o.alpha}${tailT ? `（${tailT}）` : ''}のとき、効果量 ${esT} を検出する検定力は ${fmt(R.pow, 2)} であった。` : `感度分析の結果、${nT}、有意水準 α = ${o.alpha}${tailT ? `（${tailT}）` : ''}、検定力 ${R.target} で検出できる最小の効果量は ${esT} であった。`);
  return { title: `検定力分析（${T.label.replace(/（.*）/, '')}・${modeT}）`, html: h, r: pwR(R) };
}

// ---- 効果量を求める補助 ----
function pwHelper(t) {
  const inp = (id, l, v, w = 5) => `<label>${l} <input id="${id}" type="number" step="any" value="${v}" style="width:${w}em"></label>`;
  if (t === 'tind') return `<div class="pp-row">${inp('hM1', '平均1', '')}${inp('hM2', '平均2', '')}${inp('hS1', 'SD1', '')}${inp('hS2', 'SD2', '')}<button class="btn" data-pw="hd" style="padding:1px 8px">d を計算</button></div><p class="hint">先行研究の 2 群の平均と標準偏差から d を求めます（d ＝ 平均の差 ÷ 2 群をまとめた SD）。</p>`;
  if (t === 'tpair') return `<div class="pp-row">${inp('hD', 'd（2 条件の平均の差 ÷ SD）', '')}${inp('hR', '2 条件の相関 r', '.5')}<button class="btn" data-pw="hdz" style="padding:1px 8px">d_z を計算</button></div><p class="hint">d_z ＝ d ÷ √(2(1 − r))。同じ d でも、条件間の相関が高いほど d_z は大きく、必要な人数は少なくなります。</p>`;
  if (t === 'anova1') return `<div class="pp-row">${inp('hEta', 'η²（偏 η²）', '')}<button class="btn" data-pw="hf" style="padding:1px 8px">f を計算</button></div><p class="hint">f ＝ √(η² ÷ (1 − η²))。η² = .01・.06・.14 がそれぞれ f = .10・.25・.40 にあたります。</p>`;
  if (t === 'reg') return `<div class="pp-row">${inp('hR2', 'R²', '')}<button class="btn" data-pw="hf2" style="padding:1px 8px">f² を計算</button></div><p class="hint">f² ＝ R² ÷ (1 − R²)。</p>`;
  if (t === 'regd') return `<div class="pp-row">${inp('hdR2', 'ΔR²（増えた分）', '')}${inp('hR2f', '全体の R²', '')}<button class="btn" data-pw="hf2d" style="padding:1px 8px">f² を計算</button></div><p class="hint">f² ＝ ΔR² ÷ (1 − 全体の R²)。</p>`;
  if (t === 'chisq') return `<div class="pp-row">${inp('hV', 'Cramér の V（φ）', '')}${inp('hMin', 'min(行数, 列数)', '2')}<button class="btn" data-pw="hw" style="padding:1px 8px">w を計算</button></div><p class="hint">w ＝ V × √(min(行数, 列数) − 1)。2 × 2 表なら w ＝ φ です。</p>`;
  if (t === 'prop2') return `<div class="pp-row">${inp('hP1', '比率 p₁', '')}${inp('hP2', '比率 p₂', '')}<button class="btn" data-pw="hh" style="padding:1px 8px">h を計算</button></div><p class="hint">例：p₁ = .60、p₂ = .40 なら h ≒ 0.40。</p>`;
  return '<p class="hint">効果量をそのまま入れてください。</p>';
}
function renderPower() {
  const P = state.pow, T = PW_TESTS[P.test]; let live = '';
  try { const R = pwCompute(); live = P.mode === 'n' ? `必要な人数：<b>${pwNText(R)}</b>（検定力 ${fmt(R.pow, 3)}）` : P.mode === 'power' ? `検定力：<b>${fmt(R.pow, 3)}</b>（β = ${fmt(1 - R.pow, 3)}）` : `検出できる最小の効果量：<b>${PW_SYM_T[T.es]} = ${fmt(R.es, 3)}</b>（${pwEsLabel(T, R.es)}）`; live += `<div style="margin-top:6px">${pwCurve(R)}</div>`; } catch (e) { live = `<span class="pp-msg err">${esc(e.message)}</span>`; }
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const num = (id, l, v, w = 5, step = 'any') => `<label>${l} <input id="${id}" type="number" step="${step}" value="${v}" style="width:${w}em"></label>`;
  $('#sheetBody').innerHTML = `<div class="pp-box">
    <div class="pp-row"><label>分析 ${sel('pwTest', Object.entries(PW_TESTS).map(([k, t]) => [k, t.label]), P.test)}</label></div>
    <div class="pp-row"><label>計算すること ${sel('pwMode', [['n', '必要なサンプルサイズ（研究の計画）'], ['power', '検定力（人数が決まっているとき）'], ['es', '検出できる効果量（感度分析）']], P.mode)}</label></div>
    <div class="pp-row">${P.mode !== 'es' ? `${num('pwEs', `効果量 ${PW_SYM[T.es]}`, P.es, 5)}${T.bm.map((b, i) => `<button class="btn" data-pw-bm="${b}" style="padding:1px 8px">${['小', '中', '大'][i]} ${b}</button>`).join('')}` : ''}</div>
    <div class="pp-row">${num('pwA', '有意水準 α', P.alpha, 5)}${T.tail ? `<label>検定 ${sel('pwTail', [['two', '両側'], ['one', '片側']], P.tail)}</label>` : ''}${P.mode !== 'power' ? num('pwP', '検定力 1 − β', P.power, 5) : ''}${P.mode !== 'n' ? num('pwN', T.nLabel, P.n, 5, 1) : ''}</div>
    <div class="pp-row">${P.test === 'anova1' ? num('pwK', '群の数 k', P.k, 3, 1) : ''}${P.test === 'reg' ? num('pwU', '説明変数の数', P.u, 3, 1) : ''}${P.test === 'regd' ? num('pwU', '追加する説明変数の数 u', P.u, 3, 1) + num('pwPp', '全体の説明変数の数', P.p, 3, 1) : ''}${P.test === 'chisq' ? num('pwDf', '自由度', P.df, 3, 1) : ''}${P.test === 'tind' ? num('pwRatio', '人数の比（群2 ÷ 群1）', P.ratio, 3) : ''}</div>
    <details class="mcguide"><summary>効果量を先行研究の値から求める（${esc(T.esName)}）</summary>${pwHelper(P.test)}</details>
    <div class="pp-msg" style="font-size:13.5px">${live}</div>
    <div class="pp-row"><button class="btn primary" data-pw="run">結果ツリーに出す（図・早見表・R スクリプトつき）</button></div></div>`;
}
function renderPowerPanel() {
  const P = state.pow, T = PW_TESTS[P.test], o = pwOpts();
  $('#panelBody').innerHTML = `<p class="hint">左で分析の種類と条件を選ぶと、その場で答えが出ます。「結果ツリーに出す」で、図・早見表・論文記載例・R スクリプトつきの結果になります。データは必要ありません。</p>
    <h4 style="margin:10px 0 4px">早見表：${esc(T.label)}</h4><p class="hint">α = ${o.alpha}${T.tail ? `（${o.tail === 'two' ? '両側' : '片側'}）` : ''}${P.test === 'anova1' ? `、k = ${o.k}` : ''}${P.test === 'reg' || P.test === 'regd' ? `、説明変数 ${o.u}` : ''}${P.test === 'chisq' ? `、自由度 ${o.df}` : ''} のときの「${T.nLabel}」</p>${pwQuickTable(T, o)}
    <h4 style="margin:12px 0 4px">効果量の目安（Cohen, 1988）</h4>${table(['効果量', '小', '中', '大', '使う分析'], [['d・d_z', '.20', '.50', '.80', 't 検定'], ['f', '.10', '.25', '.40', '分散分析'], ['r', '.10', '.30', '.50', '相関'], ['f²', '.02', '.15', '.35', '重回帰'], ['w', '.10', '.30', '.50', 'χ² 検定'], ['h', '.20', '.50', '.80', '比率の差']])}
    <p class="hint" style="margin-top:6px">目安はあくまで最後の手段です。分野によって「普通の大きさ」は違うので、できるだけ先行研究の効果量を使ってください。</p><div class="msg" id="msg"></div>`;
}
{ const rs0 = renderSheet; renderSheet = function () { if (state.fmt === 'power') { $('#sheetTitle').textContent = '検定力分析の設定'; renderPower(); return; } return rs0.apply(this, arguments); }; }
{ const rp0 = renderPanel; renderPanel = function () { if (state.fmt === 'power') { renderPowerPanel(); return; } return rp0.apply(this, arguments); }; }
$('#sheetBody').addEventListener('change', e => {
  if (state.fmt !== 'power') return; const el = e.target, P = state.pow, map = { pwTest: 'test', pwMode: 'mode', pwEs: 'es', pwA: 'alpha', pwTail: 'tail', pwP: 'power', pwN: 'n', pwK: 'k', pwU: 'u', pwPp: 'p', pwDf: 'df', pwRatio: 'ratio' };
  if (!map[el.id]) return; P[map[el.id]] = ['test', 'mode', 'tail'].includes(map[el.id]) ? el.value : +el.value;
  if (el.id === 'pwTest') { const T = PW_TESTS[P.test]; P.es = T.bm[1]; P.n = Math.max(P.n, pwNMin(T, pwOpts()) + 10); }
  save(); renderPower(); renderPowerPanel();
});
$('#sheetBody').addEventListener('click', e => {
  if (state.fmt !== 'power') return; const P = state.pow, bm = e.target.closest('[data-pw-bm]'); if (bm) { P.es = +bm.dataset.pwBm; save(); renderPower(); return; }
  const b = e.target.closest('[data-pw]'); if (!b) return; const a = b.dataset.pw, v = id => toNum(document.getElementById(id)?.value);
  try {
    if (a === 'run') { addResult(pwResult()); return; }
    let es = NaN;
    if (a === 'hd') { const m1 = v('hM1'), m2 = v('hM2'), s1 = v('hS1'), s2 = v('hS2'); es = Math.abs(m1 - m2) / Math.sqrt((s1 * s1 + s2 * s2) / 2); }
    if (a === 'hdz') { const d = v('hD'), r = v('hR'); need(r < 1, '相関は 1 より小さくしてください。'); es = Math.abs(d) / Math.sqrt(2 * (1 - r)); }
    if (a === 'hf') { const e2 = v('hEta'); need(e2 > 0 && e2 < 1, 'η² は 0 と 1 の間です。'); es = Math.sqrt(e2 / (1 - e2)); }
    if (a === 'hf2') { const r2 = v('hR2'); need(r2 > 0 && r2 < 1, 'R² は 0 と 1 の間です。'); es = r2 / (1 - r2); }
    if (a === 'hf2d') { const d = v('hdR2'), r2 = v('hR2f'); need(d > 0 && r2 < 1 && d <= r2, 'ΔR² は全体の R² 以下の正の値です。'); es = d / (1 - r2); }
    if (a === 'hw') { const V = v('hV'), m = v('hMin'); es = V * Math.sqrt(m - 1); }
    if (a === 'hh') { const p1 = v('hP1'), p2 = v('hP2'); need(p1 >= 0 && p1 <= 1 && p2 >= 0 && p2 <= 1, '比率は 0〜1 で入れてください。'); es = Math.abs(2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2))); }
    need(isFinite(es) && es > 0, '数値を確かめてください。'); P.es = +es.toFixed(4); save(); renderPower(); renderPowerPanel();
  } catch (err) { const m = document.querySelector('#sheetBody .pp-msg'); if (m) m.innerHTML = `<span class="pp-msg err">${esc(err.message)}</span>`; }
});
