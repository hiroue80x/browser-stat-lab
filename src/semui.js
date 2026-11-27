// ===== 構造方程式モデリング：AMOS 風のパス図エディタ =====
function makeSemSample() { // 例として入っている架空データ（ストレス → 自尊感情 → 抑うつ、n = 300）
  const R = rng(9753), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [];
  const cl = v => Math.max(1, Math.min(7, Math.round(v)));
  for (let i = 0; i < 300; i++) {
    const st = nrm(), se = -.5 * st + Math.sqrt(.75) * nrm(), dep = .35 * st - .45 * se + .75 * nrm();
    const it = (f, l) => cl(4 + 1.3 * (l * f + Math.sqrt(1 - l * l) * nrm()));
    rows.push([i % 2 ? '女性' : '男性', it(st, .8), it(st, .75), it(st, .7), it(se, .82), it(se, .76), it(se, .68), it(dep, .8), it(dep, .78), it(dep, .7)].map(String));
  }
  const names = ['性別', 'ストレス1', 'ストレス2', 'ストレス3', '自尊1', '自尊2', '自尊3', '抑うつ1', '抑うつ2', '抑うつ3'];
  const d = { cols: names.map(n => ({ name: n, on: true })), rows, roles: { y: 7, a: 0, b: -1, x: [], rep: [], fa: [1, 2, 3, 4, 5, 6, 7, 8, 9], bin: -1, event: '', roc: [], time: -1, st: -1, stev: '' } };
  d.semModel = semFromSpec(S.sem.parse('ストレス =~ ストレス1 + ストレス2 + ストレス3\n自尊感情 =~ 自尊1 + 自尊2 + 自尊3\n抑うつ =~ 抑うつ1 + 抑うつ2 + 抑うつ3\n自尊感情 ~ ストレス\n抑うつ ~ ストレス + 自尊感情'));
  return d;
}
function emptySemModel() { return { nodes: [], edges: [], autoCov: true, nid: 1 }; }
if (!state.db.semModel) state.db.semModel = emptySemModel();
state.opt.semStd = state.opt.semStd ?? true; state.opt.semBoot = state.opt.semBoot ?? '1000'; state.opt.semMi = state.opt.semMi ?? true;

// ----- 文字の幅・図形 -----
const tw = s => [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 13 : 7.2), 0);
// 図形の大きさ：全体の倍率（モデルの latK / obsK）と、変数ごとに手で変えた大きさ（n.rx, n.ry / n.w, n.h）
// 文字：全体の倍率 fontK。fontFollow（既定 true）のときは、図形の高さに合わせて変数名の文字も大きくする
let semK = { lat: 1, obs: 1, font: 1, follow: true };
const semSetK = m => { semK = { lat: +(m && m.latK) || 1, obs: +(m && m.obsK) || 1, font: +(m && m.fontK) || 1, follow: !(m && m.fontFollow === false) }; };
const semFs = n => n.kind === 'lat' ? semK.font * (semK.follow ? (n.ry ? n.ry / 25 : semK.lat) : 1) : semK.font * (semK.follow ? (n.h ? n.h / 30 : semK.obs) : 1); // 変数名の文字の倍率
const nodeSize = n => {
  const f = semFs(n);
  if (n.kind === 'lat') return n.rx ? { rx: n.rx, ry: n.ry } : { rx: Math.round(Math.max(40 * semK.lat, tw(n.name) * f / 2 + 18 * semK.lat)), ry: Math.round(Math.max(25 * semK.lat, 12.5 * f / 2 + 9)) };
  return n.w ? { w: n.w, h: n.h } : { w: Math.round(Math.max(62 * semK.obs, tw(n.name) * f + 20 * semK.obs)), h: Math.round(Math.max(30 * semK.obs, 12.5 * f + 12)) };
};
const semKeepLook = (from, to) => { ['latK', 'obsK', 'fontK', 'fontFollow'].forEach(k => { if (from[k] != null) to[k] = from[k]; }); return to; };
function boundary(n, dx, dy) { // 中心から (dx, dy) 方向に進んだときの縁の点
  const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, z = nodeSize(n);
  if (n.kind === 'lat') { const t = 1 / Math.sqrt((ux / z.rx) ** 2 + (uy / z.ry) ** 2); return [n.x + ux * t, n.y + uy * t]; }
  if (n.kind === 'err') { const r = 12 * Math.max(1, semK.font * .9); return [n.x + ux * r, n.y + uy * r]; }
  const t = Math.min(Math.abs(ux) > 1e-9 ? z.w / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? z.h / 2 / Math.abs(uy) : Infinity); return [n.x + ux * t, n.y + uy * t];
}

// ----- モデル ⇄ 指定 -----
function semSpec(m) {
  const nm = id => m.nodes.find(n => n.id === id).name;
  return { obs: m.nodes.filter(n => n.kind === 'obs').map(n => n.name), lat: m.nodes.filter(n => n.kind === 'lat').map(n => n.name),
    paths: m.edges.filter(e => e.type === 'path').map(e => ({ from: nm(e.from), to: nm(e.to), fix: e.fix ?? null })),
    covs: m.edges.filter(e => e.type === 'cov').map(e => ({ a: nm(e.from), b: nm(e.to), fix: e.fix ?? null })), autoCov: m.autoCov ? 'all' : 'none' };
}
function semMarkers(m) { // 1 に固定される矢印（各潜在変数の最初の指標）
  const set = new Set();
  m.nodes.filter(n => n.kind === 'lat').forEach(l => {
    const out = m.edges.filter(e => e.type === 'path' && e.from === l.id); if (out.some(e => e.fix != null)) return;
    const ob = out.find(e => (m.nodes.find(n => n.id === e.to) || {}).kind === 'obs') || out[0]; if (ob) set.add(ob.id);
  });
  return set;
}
function semSyntax(m) {
  const nm = id => m.nodes.find(n => n.id === id).name, t = (e, s) => (e.fix != null ? e.fix + '*' : '') + s, lines = [];
  m.nodes.filter(n => n.kind === 'lat').forEach(l => { const ind = m.edges.filter(e => e.type === 'path' && e.from === l.id && m.nodes.find(n => n.id === e.to).kind === 'obs'); if (ind.length) lines.push(`${l.name} =~ ${ind.map(e => t(e, nm(e.to))).join(' + ')}`); });
  const reg = m.edges.filter(e => e.type === 'path' && !(m.nodes.find(n => n.id === e.from).kind === 'lat' && m.nodes.find(n => n.id === e.to).kind === 'obs'));
  [...new Set(reg.map(e => e.to))].forEach(to => lines.push(`${nm(to)} ~ ${reg.filter(e => e.to === to).map(e => t(e, nm(e.from))).join(' + ')}`));
  m.edges.filter(e => e.type === 'cov').forEach(e => lines.push(`${nm(e.from)} ~~ ${t(e, nm(e.to))}`));
  return lines.join('\n');
}
function semFromSpec(spec) { // 自動配置
  const m = emptySemModel(), add = (name, kind) => { const n = { id: 'n' + m.nid++, name, kind, x: 0, y: 0 }; m.nodes.push(n); return n; };
  spec.lat.forEach(v => add(v, 'lat')); spec.obs.forEach(v => add(v, 'obs'));
  const N = v => m.nodes.find(n => n.name === v);
  spec.paths.forEach(p => m.edges.push({ id: 'e' + m.nid++, type: 'path', from: N(p.from).id, to: N(p.to).id, fix: p.fix ?? null }));
  spec.covs.filter(c => c.a !== c.b).forEach(c => m.edges.push({ id: 'e' + m.nid++, type: 'cov', from: N(c.a).id, to: N(c.b).id, fix: c.fix ?? null }));
  semAutoLayout(m); return m;
}
function semAutoLayout(m) {
  semSetK(m); const fsO = semK.font * (semK.follow ? semK.obs : 1), vs = Math.max(52, 30 * semK.obs + 12 + 12 * semK.font), hs = 112 * Math.max(1, semK.obs, fsO), gx = Math.max(1, semK.lat, (semK.obs + fsO) / 2), gO = vs / 52, gL = Math.max(1, semK.lat); // 図形・文字が大きいときは間隔を広げる
  const isInd = n => n.kind === 'obs' && m.edges.some(e => e.type === 'path' && e.to === n.id && m.nodes.find(x => x.id === e.from).kind === 'lat') && !m.edges.some(e => e.type === 'path' && e.from === n.id);
  const struct = m.nodes.filter(n => !isInd(n)), depth = {}; struct.forEach(n => depth[n.id] = 0);
  for (let k = 0; k < struct.length; k++) m.edges.filter(e => e.type === 'path' && depth[e.from] != null && depth[e.to] != null).forEach(e => depth[e.to] = Math.max(depth[e.to], Math.min(depth[e.from] + 1, struct.length)));
  const maxD = Math.max(0, ...Object.values(depth)), ind = l => m.nodes.filter(n => isInd(n) && m.edges.find(e => e.type === 'path' && e.to === n.id).from === l.id);
  const side = n => depth[n.id] === 0 ? 'L' : depth[n.id] === maxD ? 'R' : 'B', colX = d => 260 * gx + d * 300 * gx, cols = [];
  for (let d = 0; d <= maxD; d++) {
    const ns = struct.filter(n => depth[n.id] === d); let y = 0;
    ns.forEach(n => { const k = ind(n).length, sd = side(n), h = sd === 'B' ? 190 * gO : Math.max(70 * gL, k * 52 * gO); n.x = colX(d); n.y = y + (sd === 'B' ? 30 : h / 2) - (sd === 'B' && d > 0 && d < maxD ? 150 * gO : 0); n._h = h; y += h + 36; });
    cols.push({ ns, h: y - 36 });
  }
  const H = Math.max(...cols.map(c => c.h), 0), sd0 = side;
  cols.forEach(c => c.ns.forEach(n => {
    n.y += (H - c.h) / 2 + 60 + (sd0(n) === 'B' ? 40 : 0); const k = ind(n), sd = side(n);
    k.forEach((o, i) => { if (sd === 'B') { o.x = n.x + (i - (k.length - 1) / 2) * hs; o.y = n.y - 105 * Math.max(gO, gL); } else { o.x = n.x + (sd === 'L' ? -160 : 160) * gx; o.y = n.y + (i - (k.length - 1) / 2) * vs; } });
    delete n._h;
  }));
  const minX = Math.min(...m.nodes.map(n => n.x - (nodeSize(n).w || nodeSize(n).rx * 2) / 2)), minY = Math.min(...m.nodes.map(n => n.y));
  m.nodes.forEach(n => { n.x = Math.round((n.x - minX + 70) / 2) * 2; n.y = Math.round((n.y - minY + 50) / 2) * 2; });
}

// ----- パス図の描画（エディタと結果で共用） -----
function semAutoCov(m) { // 自動で仮定される外生変数どうしの共分散（図に描くため）
  if (!m.autoCov) return [];
  const exo = m.nodes.filter(n => !m.edges.some(e => e.type === 'path' && e.to === n.id) && (n.kind === 'lat' || m.edges.some(e => e.type === 'path' && e.from === n.id))), out = [];
  exo.forEach((a, i) => exo.slice(i + 1).forEach(b => { if (!m.edges.some(e => e.type === 'cov' && ((e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id)))) out.push({ id: 'auto-' + a.id + '-' + b.id, type: 'cov', from: a.id, to: b.id, fix: null, auto: true }); }));
  return out;
}
let semUid = 0;
function semErrNodes(m) { // 内生変数につける誤差 e（つながっている矢印から最も離れた向きに置く）
  const endo = m.nodes.filter(n => m.edges.some(e => e.type === 'path' && e.to === n.id));
  return endo.map((n, k) => {
    const nb = [...m.edges, ...semAutoCov(m)].filter(e => e.from === n.id || e.to === n.id).map(e => m.nodes.find(x => x.id === (e.from === n.id ? e.to : e.from))).filter(x => x && x.id !== n.id);
    const dirs = nb.map(o => { const L = Math.hypot(o.x - n.x, o.y - n.y) || 1; return [(o.x - n.x) / L, (o.y - n.y) / L]; });
    const z = nodeSize(n), cands = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
    let best = cands[12], bs = Infinity; cands.forEach((c, i) => { const sc = Math.max(-1, ...dirs.map(d => d[0] * c[0] + d[1] * c[1])) + (i % 4 === 0 ? 0 : i % 2 === 0 ? .06 : .12); if (sc < bs - 1e-9) { bs = sc; best = c; } });
    const [ux, uy] = best, hw = n.kind === 'lat' ? z.rx : z.w / 2, hh = n.kind === 'lat' ? z.ry : z.h / 2;
    const t = n.kind === 'lat' ? 1 / Math.sqrt((ux / hw) ** 2 + (uy / hh) ** 2) : Math.min(Math.abs(ux) > 1e-9 ? hw / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-9 ? hh / Math.abs(uy) : Infinity);
    return { id: 'err-' + n.id, of: n.id, name: (n.kind === 'lat' ? 'd' : 'e') + (k + 1), kind: 'err', x: n.x + ux * (t + 26), y: n.y + uy * (t + 26) };
  });
}
function semEdgeGeom(m, e, nodes, cent) {
  const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
  if (e.type === 'path') { const p = boundary(a, b.x - a.x, b.y - a.y), q = boundary(b, a.x - b.x, a.y - b.y); return { d: `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${q[0].toFixed(1)},${q[1].toFixed(1)}`, lx: p[0] + (q[0] - p[0]) * .5, ly: p[1] + (q[1] - p[1]) * .5 }; }
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L; if ((mx - cent[0]) * nx + (my - cent[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const bul = Math.max(36, L * .28), c = [mx + nx * bul, my + ny * bul], p = boundary(a, c[0] - a.x, c[1] - a.y), q = boundary(b, c[0] - b.x, c[1] - b.y);
  return { d: `M${p[0].toFixed(1)},${p[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`, lx: (p[0] + 2 * c[0] + q[0]) / 4, ly: (p[1] + 2 * c[1] + q[1]) / 4 };
}
const c2 = v => isFinite(v) ? v.toFixed(2).replace(/^(-?)0\./, '$1.').replace('-', '−') : '—';
function semFitLines(F) {
  if (F.df === 0) return [['N', F.N], ['χ²', '0.00（df = 0）'], ['', '飽和モデルのため'], ['', '適合度は評価できません'], ['AIC', fmt(F.aic, 1)], ['BIC', fmt(F.bic, 1)]];
  return [['N', F.N], ['χ²', `${fmt(F.chi, 2)}（df = ${F.df}）`], ['p', fp(F.pv)], ['CFI', c2(F.cfi)], ['TLI', c2(F.tli)], ['RMSEA', `${c2(F.rmsea)} [${c2(F.rL)}, ${c2(F.rU)}]`], ['SRMR', c2(F.srmr)], ['GFI', c2(F.gfi)], ['AGFI', c2(F.agfi)], ['AIC', fmt(F.aic, 1)], ['BIC', fmt(F.bic, 1)]];
}
function semFitVerdict(F) { if (F.df === 0) return {}; const ok = (v, g, b, hi) => hi ? (v >= g ? 'good' : v >= b ? 'fair' : 'poor') : (v <= g ? 'good' : v <= b ? 'fair' : 'poor'); return { CFI: ok(F.cfi, .95, .90, 1), TLI: ok(F.tli, .95, .90, 1), RMSEA: ok(F.rmsea, .06, .08), SRMR: ok(F.srmr, .08, .10), GFI: ok(F.gfi, .95, .90, 1), AGFI: ok(F.agfi, .90, .85, 1) }; }
function semSvg(m, o = {}) { // o: { fit, std, interactive, sel, pending, fitBox }
  semSetK(m); const u = ++semUid, F = o.fit, errs = semErrNodes(m), nodes = [...m.nodes, ...errs], markers = semMarkers(m);
  const cent = [S.mean(m.nodes.map(n => n.x)) || 0, S.mean(m.nodes.map(n => n.y)) || 0];
  const estOf = (type, a, b) => F && F.est.find(e => type === 'A' ? e.type === 'A' && e.from === a && e.to === b : e.type === 'S' && ((e.from === a && e.to === b) || (e.from === b && e.to === a)));
  const nameOf = id => (nodes.find(n => n.id === id) || {}).name;
  let body = '';
  // 誤差
  errs.forEach(er => {
    const n = m.nodes.find(x => x.id === er.of), p = boundary(er, n.x - er.x, n.y - er.y), q = boundary(n, er.x - n.x, er.y - n.y);
    body += `<path d="M${p[0].toFixed(1)},${p[1].toFixed(1)} L${q[0].toFixed(1)},${q[1].toFixed(1)}" stroke="var(--muted)" stroke-width="1.2" marker-end="url(#am${u})"/><circle cx="${er.x}" cy="${er.y}" r="${12 * Math.max(1, semK.font * .9)}" fill="var(--sheet)" stroke="var(--muted)"/><text x="${er.x}" y="${er.y + 3.6 * semK.font}" text-anchor="middle" style="font-size:${10 * semK.font}px">${er.name}</text>`;
  });
  // 矢印・共分散
  [...semAutoCov(m), ...m.edges].forEach(e => {
    const g = semEdgeGeom(m, e, nodes, cent), A = nameOf(e.from), B = nameOf(e.to), es = F ? estOf(e.type === 'path' ? 'A' : 'S', A, B) : null;
    const sig = !es || !isFinite(es.p) || es.p < .05, sel = o.sel === e.id, col = sel ? 'var(--sig)' : F ? (sig ? 'var(--accent)' : 'var(--muted)') : 'var(--fg)', mk = sel ? 'as' : F ? (sig ? 'aa' : 'am') : 'af';
    if (e.auto && !F) { body += `<path d="${g.d}" fill="none" stroke="var(--muted)" stroke-opacity=".55" stroke-width="1.1" stroke-dasharray="3 3" marker-end="url(#am${u})" marker-start="url(#am${u})"/><text x="${g.lx.toFixed(1)}" y="${(g.ly + 3.6 * semK.font).toFixed(1)}" text-anchor="middle" style="font-size:${10 * semK.font}px;fill:var(--muted)">自動</text>`; return; }
    if (o.interactive && !e.auto) body += `<path d="${g.d}" stroke="transparent" stroke-width="14" fill="none" data-edge="${e.id}" style="cursor:pointer"/>`;
    body += `<path d="${g.d}" fill="none" stroke="${col}" stroke-width="${sel ? 2.6 : F && sig ? 1.9 : 1.4}" ${F && !sig ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#${mk}${u})" ${e.type === 'cov' ? `marker-start="url(#${mk}${u})"` : ''} ${o.interactive && !e.auto ? `data-edge="${e.id}" style="cursor:pointer"` : ''}/>`;
    let lab = '';
    if (es) lab = o.std ? c2(es.std) : (es.free ? c2(es.est) : String(+es.est.toFixed(3)));
    else if (e.fix != null) lab = String(e.fix); else if (markers.has(e.id)) lab = '1';
    const fk = semK.font, lw = (tw(lab) + (es && isFinite(es.p) && es.p < .05 ? tw(star(es.p)) : 0)) * .92 * fk;
    if (lab) body += `<rect x="${(g.lx - lw / 2 - 4).toFixed(1)}" y="${(g.ly - 9 * fk).toFixed(1)}" width="${(lw + 8).toFixed(1)}" height="${(16 * fk).toFixed(1)}" rx="3" fill="var(--sheet)" fill-opacity=".92"/><text x="${g.lx.toFixed(1)}" y="${(g.ly + 4 * fk).toFixed(1)}" text-anchor="middle" style="fill:${F && !sig ? 'var(--muted)' : 'var(--fg)'};font-size:${(11.5 * fk).toFixed(2)}px">${lab}${es && isFinite(es.p) && es.p < .05 ? `<tspan style="fill:var(--sig)">${star(es.p)}</tspan>` : ''}</text>`;
  });
  // 変数
  m.nodes.forEach(n => {
    const z = nodeSize(n), sel = o.sel === n.id || o.pending === n.id, st = sel ? 'var(--sig)' : 'var(--fg)', at = o.interactive ? `data-node="${n.id}" style="cursor:${o.tool === 'select' ? 'move' : 'pointer'}"` : '';
    body += n.kind === 'lat' ? `<ellipse cx="${n.x}" cy="${n.y}" rx="${z.rx}" ry="${z.ry}" fill="var(--accent-soft)" stroke="${st}" stroke-width="${sel ? 2.6 : 1.5}" ${at}/>` : `<rect x="${n.x - z.w / 2}" y="${n.y - z.h / 2}" width="${z.w}" height="${z.h}" rx="2" fill="var(--sheet)" stroke="${st}" stroke-width="${sel ? 2.6 : 1.4}" ${at}/>`;
    const fs = 12.5 * semFs(n); body += `<text x="${n.x}" y="${(n.y + fs * .36).toFixed(1)}" text-anchor="middle" style="fill:var(--fg);font-size:${fs.toFixed(2)}px;pointer-events:none">${esc(n.name)}</text>`;
    if (o.interactive && o.tool === 'select' && o.sel === n.id) { const hx = n.x + (n.kind === 'lat' ? z.rx * .7071 : z.w / 2), hy = n.y + (n.kind === 'lat' ? z.ry * .7071 : z.h / 2); body += `<rect x="${(hx - 5).toFixed(1)}" y="${(hy - 5).toFixed(1)}" width="10" height="10" rx="1.5" fill="var(--sheet)" stroke="var(--sig)" stroke-width="1.6" data-resize="${n.id}" style="cursor:nwse-resize"><title>ドラッグで大きさを変える（ダブルクリックで元に戻す）</title></rect>`; }
    const r2 = F && F.r2.find(r => r.name === n.name);
    if (r2) {
      const dirs = [...m.edges.filter(e => e.from === n.id || e.to === n.id).map(e => nodes.find(x => x.id === (e.from === n.id ? e.to : e.from))), errs.find(er => er.of === n.id)].filter(Boolean).map(o => { const L = Math.hypot(o.x - n.x, o.y - n.y) || 1; return [(o.x - n.x) / L, (o.y - n.y) / L]; });
      const fk = semK.font, hw = n.kind === 'lat' ? z.rx : z.w / 2, hh = n.kind === 'lat' ? z.ry : z.h / 2, cand = [[0, -1, 0, -hh - 5, 'middle'], [0, 1, 0, hh + 13 * fk, 'middle'], [1, 0, hw + 4, 4 * fk, 'start'], [-1, 0, -hw - 4, 4 * fk, 'end'], [.7, -.7, hw * .75, -hh - 4, 'middle'], [-.7, -.7, -hw * .75, -hh - 4, 'middle']];
      const best = cand.map((c, i) => [c, Math.round(Math.max(-1, ...dirs.map(d => d[0] * c[0] + d[1] * c[1])) * 3) / 3, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2])[0][0];
      body += `<text x="${n.x + best[2]}" y="${n.y + best[3]}" text-anchor="${best[4]}" style="fill:var(--sig);font-size:${(10.5 * fk).toFixed(2)}px">R²=${c2(r2.r2)}</text>`;
    }
  });
  // 範囲
  const xs = nodes.flatMap(n => { const z = nodeSize(n); return n.kind === 'err' ? [n.x - 14, n.x + 14] : n.kind === 'lat' ? [n.x - z.rx, n.x + z.rx] : [n.x - z.w / 2, n.x + z.w / 2]; }), ys = nodes.flatMap(n => { const z = nodeSize(n), hh = n.kind === 'err' ? 14 : n.kind === 'lat' ? z.ry : z.h / 2; return [n.y - Math.max(34, hh + 18 * semK.font), n.y + Math.max(34, hh + 18 * semK.font)]; });
  [...semAutoCov(m), ...m.edges].filter(e => e.type === 'cov').forEach(e => { const g = semEdgeGeom(m, e, nodes, cent); xs.push(g.lx - 20, g.lx + 20); ys.push(g.ly - 14, g.ly + 14); });
  let x0 = Math.min(...xs, 0) - 20, x1 = Math.max(...xs, 300) + 20, y0 = Math.min(...ys, 0) - 10, y1 = Math.max(...ys, 200) + 10;
  if (o.canvas) { x0 = Math.min(x0, 0); y0 = Math.min(y0, 0); x1 = Math.max(x1, o.canvas[0]); y1 = Math.max(y1, o.canvas[1]); }
  if (F && o.fitBox) { // 適合度をパス図の右に
    const lines = semFitLines(F), v = semFitVerdict(F), bx = x1 + 16, by = y0 + 12, W = 214, Hh = 34 + lines.length * 19;
    body += `<rect x="${bx}" y="${by}" width="${W}" height="${Hh}" rx="4" fill="var(--panel)" stroke="var(--line)"/><text x="${bx + 12}" y="${by + 22}" style="fill:var(--fg);font-size:12.5px;font-weight:600">適合度指標</text>`;
    lines.forEach(([k, val], i) => { const c = v[k] === 'good' ? 'var(--accent)' : v[k] === 'poor' ? 'var(--sig)' : 'var(--fg)'; body += `<text x="${bx + 12}" y="${by + 44 + i * 19}" style="font-size:11.5px">${k}</text><text x="${bx + W - 12}" y="${by + 44 + i * 19}" text-anchor="end" style="fill:${c};font-size:11.5px;font-family:var(--f-num)">${esc(String(val))}${v[k] === 'good' ? ' ○' : v[k] === 'poor' ? ' ×' : v[k] ? ' △' : ''}</text>`; });
    body += `<text x="${bx + 12}" y="${by + Hh + 16}" style="font-size:10px">${o.std ? '係数は標準化推定値' : '係数は非標準化推定値'}・点線＝有意でない</text><text x="${bx + 12}" y="${by + Hh + 30}" style="font-size:10px">* p<.05, ** p<.01, *** p<.001</text>`;
    x1 = bx + W + 10; y1 = Math.max(y1, by + Hh + 40);
  }
  const mkd = (id, c) => `<marker id="${id}${u}" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${c}"/></marker>`;
  return `<svg class="chart${o.interactive ? ' semcanvas' : ''}" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}" role="img" ${o.interactive ? `width="${Math.round(x1 - x0)}" height="${Math.round(y1 - y0)}"` : `style="max-width:${Math.round(x1 - x0)}px"`}><defs>${mkd('af', 'var(--fg)')}${mkd('aa', 'var(--accent)')}${mkd('am', 'var(--muted)')}${mkd('as', 'var(--sig)')}</defs>${o.interactive ? `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="transparent" data-bg="1"/>` : ''}${body}</svg>`;
}

// ----- 推定とレポート -----
function semRun(m) {
  m = m || state.db.semModel; need(m.nodes.length, 'パス図エディタで変数を置いてください（「例：SEM データ」でサンプルのモデルが入ります）。');
  const lat = m.nodes.filter(n => n.kind === 'lat'); lat.forEach(l => need(m.edges.some(e => e.from === l.id || e.to === l.id), `潜在変数「${l.name}」に矢印がつながっていません。`));
  m.nodes.filter(n => n.kind === 'obs').forEach(n => need(m.edges.some(e => e.from === n.id || e.to === n.id), `観測変数「${n.name}」に矢印がつながっていません（使わないなら削除してください）。`));
  const spec = semSpec(m), colIx = spec.obs.map(v => state.db.cols.findIndex(c => c.name === v));
  colIx.forEach((j, k) => need(j >= 0, `観測変数「${spec.obs[k]}」がデータシートの列にありません。`));
  colIx.forEach((j, k) => need(colType(j) === 'num', `「${spec.obs[k]}」は数値の列ではありません。`));
  const raw = colIx.map(j => dbCol(j).map(toNum)), ok = raw[0].map((_, i) => raw.every(c => isFinite(c[i]))), data = raw.map(c => c.filter((_, i) => ok[i]));
  need(data[0].length > spec.obs.length + 2, 'データの人数が少なすぎます。');
  const F = S.sem.fit(spec, data); F.data = data; F.dropped = state.db.rows.filter(r => colIx.some(j => String(r[j] ?? '').trim() !== '')).length - data[0].length; return F;
}
function semReport(m, F, BT) {
  const std = state.opt.semStd, v = semFitVerdict(F), J = { good: '○ 良好', fair: '△ 許容', poor: '× 不十分' };
  let h = `<p class="note">最尤法・N = ${F.N}${F.dropped > 0 ? `（欠測のある ${F.dropped}人を除外）` : ''}・推定するパラメータ ${F.nparRep}個・自由度 ${F.df}。${F.conv ? '' : '<b>推定が収束しませんでした。</b>'}${F.heywood.length ? `<b>${F.heywood.map(esc).join('・')}の分散が負です（不適解）。</b>` : ''}</p>`;
  if (m.parcels && Object.keys(m.parcels).length) h += `<p class="note">指標にパーセル（項目の平均）を使っています：${Object.entries(m.parcels).map(([l, P]) => `${esc(l)}（${P.groups.map((g, p) => `${esc(parName(l, p))} = ${g.map(esc).join('・')}`).join('、')}）`).join('；')}。</p>`;
  h += '<h4>パス図</h4>' + `<div class="semfig">${semSvg(m, { fit: F, std, fitBox: true })}</div><p class="note">図が小さいときは横にスクロールするか、「画像で表示」で拡大できます。</p>`;
  if (F.df === 0) h += '<h4>適合度指標</h4><p class="note">自由度が 0 の飽和モデル（すべての共分散を説明しきるモデル）のため、χ² は 0 で、適合度指標は意味をもちません。係数の推定値と検定だけを解釈してください。</p>';
  else h += '<h4>適合度指標</h4>' + table(['指標', '値', '判定', '目安'], [
    ['χ²（df）', `${fmt(F.chi, 3)}（${F.df}）, p ${F.pv < .001 ? '< .001' : '= ' + fp(F.pv)}`, '', 'p > .05 で適合（N が大きいと有意になりやすい）'],
    ['CFI', c2(F.cfi), J[v.CFI], '.95 以上で良好、.90 以上で許容'], ['TLI', c2(F.tli), J[v.TLI], '.95 以上で良好、.90 以上で許容'],
    ['RMSEA [90%CI]', `${c2(F.rmsea)} [${c2(F.rL)}, ${c2(F.rU)}]`, J[v.RMSEA], '.06 以下で良好、.08 以下で許容'], ['RMSEA ≤ .05 の検定', 'p = ' + fp(F.pclose), '', ''],
    ['SRMR', c2(F.srmr), J[v.SRMR], '.08 以下で良好'], ['GFI', c2(F.gfi), J[v.GFI], '.95 以上で良好、.90 以上で許容'], ['AGFI', c2(F.agfi), J[v.AGFI], '.90 以上で良好'],
    ['AIC', fmt(F.aic, 2), '', 'モデルどうしの比較用（小さいほうがよい）'], ['BIC', fmt(F.bic, 2), '', '同上']]);
  h += '<p class="note">目安は Hu & Bentler (1999) などによる慣例です。独立モデルの χ² = ' + fmt(F.chiB, 2) + '（df = ' + F.dfB + '）。</p>';
  const row = e => [`${esc(e.type === 'A' ? e.from + ' → ' + e.to : e.i === e.j ? e.to : e.from + ' ↔ ' + e.to)}`, fmt(e.est, 3), e.free && isFinite(e.se) ? fmt(e.se, 3) : '固定', isFinite(e.z) ? fmt(e.z, 2) : '', isFinite(e.p) ? fp(e.p) + star(e.p) : '', c2(e.std)];
  const hd = ['パラメータ', '推定値', '標準誤差', 'z', 'p', '標準化'];
  const grp = [['因子負荷（潜在変数 → 観測変数）', e => e.role === 'load'], ['パス係数（回帰）', e => e.type === 'A' && e.role !== 'load'], ['共分散（標準化列は相関）', e => e.type === 'S' && e.i !== e.j], ['分散・誤差分散', e => e.type === 'S' && e.i === e.j]];
  grp.forEach(([t, f]) => { const r = F.est.filter(f); if (r.length) h += `<h4>${t}</h4>` + table(hd, r.map(row)); });
  if (F.r2.length) h += '<h4>決定係数 R²（内生変数の分散のうち説明された割合）</h4>' + table(['変数', 'R²'], F.r2.map(r => [esc(r.name), c2(r.r2)]));
  const ci = (c, d = 3) => `[${fmt(c[0], d)}, ${fmt(c[1], d)}]`, ex0 = c => c[0] > 0 || c[1] < 0;
  if (BT) {
    h += `<h4>ブートストラップ法（${BT.B}回）</h4><p class="note">データから同じ人数を復元抽出して ${BT.B}回推定し直しました（収束 ${BT.ok}回${BT.fail ? `、収束しなかった ${BT.fail}回は除外` : ''}）。信頼区間に 0 を含まなければ 5% 水準で有意です。間接効果の検定には、検出力の高いバイアス修正法（BC; MacKinnon, Lockwood, & Williams, 2004）がよく使われます。</p>`;
    if (BT.ind.length) h += '<h4>間接効果（ブートストラップ信頼区間）</h4>' + table(['経路', '間接効果', 'ブートストラップ SE', '95%CI パーセンタイル', '95%CI バイアス修正', '判定', '標準化', '標準化の 95%CI（BC）'], BT.ind.map(b => [`${esc(b.e.from)} → ${esc(b.e.to)}`, fmt(b.e.est, 3), fmt(b.raw.se, 3), ci(b.raw.perc), ci(b.raw.bc), ex0(b.raw.bc) ? '<b>有意</b>' : '有意でない', c2(b.e.std), `[${c2(b.std.bc[0])}, ${c2(b.std.bc[1])}]`])) +
      table(['経路', '総合効果', 'ブートストラップ SE', '95%CI パーセンタイル', '95%CI バイアス修正', '標準化', '標準化の 95%CI（BC）'], BT.ind.map(b => [`${esc(b.e.from)} → ${esc(b.e.to)}`, fmt(b.e.total, 3), fmt(b.tot.se, 3), ci(b.tot.perc), ci(b.tot.bc), c2(b.e.totalStd), `[${c2(b.totStd.bc[0])}, ${c2(b.totStd.bc[1])}]`]));
    const lab = e => esc(e.type === 'A' ? e.from + ' → ' + e.to : e.i === e.j ? e.to + '（分散）' : e.from + ' ↔ ' + e.to);
    h += '<h4>すべてのパラメータのブートストラップ信頼区間</h4>' + table(['パラメータ', '推定値', 'ブートストラップ SE', '95%CI パーセンタイル', '95%CI バイアス修正', '標準化', '標準化の 95%CI（BC）'], BT.par.map(b => [lab(b.e), fmt(b.e.est, 3), fmt(b.raw.se, 3), ci(b.raw.perc), ci(b.raw.bc) + (ex0(b.raw.bc) ? ' *' : ''), c2(b.e.std), `[${c2(b.std.bc[0])}, ${c2(b.std.bc[1])}]`]));
  }
  if (F.indirect.length) h += '<h4>間接効果と総合効果（デルタ法）</h4>' + table(['経路', '直接効果', '間接効果', '95%信頼区間', 'p', '総合効果', '間接効果（標準化）', '総合効果（標準化）'], F.indirect.map(e => [`${esc(e.from)} → ${esc(e.to)}`, fmt(e.direct, 3), fmt(e.est, 3), `[${fmt(e.L, 3)}, ${fmt(e.U, 3)}]`, fp(e.p) + star(e.p), fmt(e.total, 3), c2(e.std), c2(e.totalStd)])) + '<p class="note">間接効果の標準誤差はデルタ法（Sobel 型、lavaan の := と同じ）。</p>';
  if (state.opt.semMi) { const top = F.mi.filter(x => x.mi >= 3.84).slice(0, 10); h += '<h4>修正指標（MI ≥ 3.84 の上位10個）</h4>' + (top.length ? table(['追加の候補', 'MI', '予想される変化（EPC）', '標準化 EPC'], top.map(x => [x.kind === 'load' ? `${esc(x.a)} → ${esc(x.b)}（交差負荷）` : `${esc(x.a)} ↔ ${esc(x.b)}（誤差共分散）`, fmt(x.mi, 2), fmt(x.epc, 3), c2(x.sepc)])) + '<p class="note">MI はその矢印を追加したときに χ² が下がる見込みの量です。理論的に説明できるものだけを追加してください。</p>' : '<p class="note">3.84 以上の修正指標はありません。</p>'); }
  const regs = F.est.filter(e => e.type === 'A' && e.role !== 'load' && isFinite(e.p));
  { const good = F.df > 0 ? ['CFI', 'TLI', 'RMSEA', 'SRMR'].filter(k => v[k] === 'good').length : 0, poor = F.df > 0 ? ['CFI', 'TLI', 'RMSEA', 'SRMR'].filter(k => v[k] === 'poor') : [], lowL = F.est.filter(e => e.role === 'load' && Math.abs(e.std) < .4);
    const topMi = state.opt.semMi ? F.mi.filter(x => x.mi >= 10)[0] : null;
    h += interp(F.df === 0 ? '飽和モデルなので、適合度ではなく、個々のパス係数の大きさと有意性を読みます。'
      : `適合度は、モデルが描く共分散のパターンが実際のデータとどれだけ一致しているかを表します。主な 4 指標（CFI・TLI・RMSEA・SRMR）のうち ${good} つが良好の基準を満たし、${poor.length ? `${poor.join('・')} は不十分です。モデルの修正を検討してください。` : good >= 3 ? 'モデルはデータによく当てはまっていると判断できます。' : 'おおむね許容できる当てはまりです。'}χ² 検定は ${pTxt(F.pv)} で、${F.pv >= .05 ? '「モデルとデータに差がない」という仮説は棄却されません。' : '有意ですが、χ² は人数が多いとほぼ必ず有意になるので、ほかの指標を重視するのが一般的です。'}`,
      regs.length ? `パス係数（標準化）は、ほかの変数の影響を除いた直接の影響の強さです。${regs.filter(e => e.p < .05).length ? `有意だったのは ${regs.filter(e => e.p < .05).map(e => `${esc(e.from)} → ${esc(e.to)}（β = ${c2(e.std)}）`).join('、')} です。` : '有意なパスはありませんでした。'}` : '',
      lowL.length ? `標準化負荷量が .40 未満の観測変数（${lowL.map(e => esc(e.to)).join('、')}）は、潜在変数との結びつきが弱い項目です。` : (F.est.some(e => e.role === 'load') ? 'すべての観測変数が潜在変数に .40 以上の標準化負荷をもち、測定はしっかりしています。' : ''),
      BT && BT.ind.length ? `間接効果は、ある変数が別の変数を経由して与える影響です。ブートストラップ法の 95%信頼区間が 0 を含まなければ、その間接効果（媒介効果）は有意と判断します。${BT.ind.filter(b => ex0(b.raw.bc)).length ? `有意だったのは ${BT.ind.filter(b => ex0(b.raw.bc)).map(b => `${esc(b.e.from)} → ${esc(b.e.to)}`).join('、')} です。` : '有意な間接効果はありませんでした。'}` : (F.indirect.length ? '間接効果の検定は、ブートストラップ法（オプション）を使うのが現在の標準です。' : ''),
      topMi ? `修正指標の最大は ${esc(topMi.a)} ${topMi.kind === 'load' ? '→' : '↔'} ${esc(topMi.b)}（MI = ${fmt(topMi.mi, 1)}）です。理論的に説明がつく場合に限り、この矢印を加えると適合度が改善する見込みがあります。` : '');
  }
  h += apa('論文記載例', `構造方程式モデリング（最尤法）による分析の結果、${F.df === 0 ? 'モデルは飽和モデル（df = 0）であった。' : `モデルの適合度は χ²(${F.df}) = ${fmt(F.chi, 2)}, ${apaP(F.pv)}, CFI = ${c2(F.cfi)}, TLI = ${c2(F.tli)}, RMSEA = ${c2(F.rmsea)}（90% CI [${c2(F.rL)}, ${c2(F.rU)}]）, SRMR = ${c2(F.srmr)} であった。`}${regs.length ? regs.map(e => `${esc(e.from)}から${esc(e.to)}へのパスは${e.p < .05 ? '有意であった' : '有意ではなかった'}（β = ${c2(e.std)}, ${apaP(e.p)}）`).join('。') + '。' : ''}${BT ? BT.ind.map(b => `${esc(b.e.from)}から${esc(b.e.to)}への間接効果は${ex0(b.raw.bc) ? '有意であった' : '有意ではなかった'}（β = ${c2(b.e.std)}, 95% CI [${c2(b.std.bc[0])}, ${c2(b.std.bc[1])}]、ブートストラップ法 ${BT.B}回・バイアス修正法）。`).join('') : F.indirect.filter(e => e.p < .05).map(e => `${esc(e.from)}から${esc(e.to)}への間接効果は有意であった（β = ${c2(e.std)}, ${apaP(e.p)}）。`).join('')}`);
  return h;
}
const semTitle = m => `構造方程式モデリング（${m.nodes.filter(n => n.kind === 'lat').map(n => n.name).join('・') || 'パス解析'}）`;
let bootJob = null;
function semBootstrap(F, B) { // 少しずつ進めて画面を止めない
  return new Promise((res, rej) => {
    if (bootJob) bootJob.cancel = true;
    const ctx = S.sem.bootSetup(F, F.data, B), job = bootJob = { cancel: false };
    let t = $('#semToast'); if (!t) { t = document.createElement('div'); t.id = 'semToast'; t.className = 'semtoast'; document.body.appendChild(t); t.addEventListener('click', e => { if (e.target.dataset.cancel != null && bootJob) bootJob.cancel = true; }); }
    t.hidden = false; const t0 = performance.now();
    const tick = () => {
      if (job.cancel) { t.hidden = true; bootJob = null; rej(new Error('ブートストラップを中止しました。')); return; }
      const st = performance.now(); while (ctx.done < B && performance.now() - st < 45) S.sem.bootStep(ctx, ctx.nextIdx());
      const el = (performance.now() - t0) / 1000, rest = ctx.done ? el / ctx.done * (B - ctx.done) : 0;
      t.innerHTML = `<b>ブートストラップ中</b> ${ctx.done} / ${B} 回<progress max="${B}" value="${ctx.done}"></progress><span>残り約 ${Math.ceil(rest)} 秒</span><button class="btn" data-cancel>中止</button>`;
      if (ctx.done < B) setTimeout(tick, 0); else { t.hidden = true; bootJob = null; if (ctx.out.length < Math.min(100, B / 2)) rej(new Error('ブートストラップの多くの回で推定が収束しませんでした。モデルを見直してください。')); else res(S.sem.bootSummary(ctx, F)); }
    };
    setTimeout(tick, 0);
  });
}
function semRunAll(m, F, onDone) {
  const B = +state.opt.semBoot, mm = JSON.parse(JSON.stringify(m));
  if (!(B > 0)) { addResult({ title: semTitle(mm), html: semReport(mm, F), r: (() => { try { return rScript('db', 'sem'); } catch (e) { return null; } })() }, SE.open); onDone && onDone(null); return; }
  semBootstrap(F, B).then(BT => { addResult({ title: semTitle(mm) + `・ブートストラップ ${B}回`, html: semReport(mm, F, BT), r: (() => { try { return rScript('db', 'sem'); } catch (e) { return null; } })() }, SE.open); onDone && onDone(BT); })
    .catch(err => { const msg = $('#msg'); if (msg) msg.textContent = err.message; if (SE.open) alert(err.message); });
}
ANALYSES.db.sem = function () { const m = state.db.semModel, F = semRun(m); semRunAll(m, F); return null; };

// ----- エディタ -----
const SE = { tool: 'select', sel: null, pending: null, fit: null, hist: [], drag: null, open: false };
function semPanelHtml() {
  const m = state.db.semModel, c = k => m.nodes.filter(n => n.kind === k).length;
  return `<div class="semsum"><button class="btn primary" data-act="semopen">パス図エディタを開く</button><span>観測変数 ${c('obs')}・潜在変数 ${c('lat')}・矢印 ${m.edges.filter(e => e.type === 'path').length}・共分散 ${m.edges.filter(e => e.type === 'cov').length}</span></div>
    ${m.nodes.length ? `<div class="semthumb" data-act="semopen" title="クリックで編集">${semSvg(m, {})}</div>` : '<p class="hint">エディタで変数を置き、矢印を引いてモデルを作ります。「例：SEM データ」を押すとサンプルのモデルが入ります。</p>'}
    <div class="sheettools" style="margin-top:6px"><button class="btn" data-act="semcfa">因子分析の項目から CFA のモデルを作る</button></div>`;
}
function semOpen() {
  SE.open = true; SE.sel = SE.pending = null; SE.hist = []; let ov = $('#semEd');
  if (!ov) { ov = document.createElement('div'); ov.id = 'semEd'; ov.className = 'semed'; document.body.appendChild(ov); bindSemEditor(ov); }
  ov.hidden = false; document.body.style.overflow = 'hidden'; renderSemEditor(true);
}
function semClose() { SE.open = false; $('#semEd').hidden = true; document.body.style.overflow = ''; save(); renderDbPanel(true); }
const TOOLS = [['select', '選択・移動', 'M4 3 L4 17 L8 13 L11 19 L13 18 L10 12 L15 12 Z'], ['lat', '潜在変数を置く', 'ellipse'], ['path', '矢印（パス）', 'M3 15 L15 5 M15 5 L9 6 M15 5 L14 11'], ['cov', '共分散（双方向）', 'M3 14 Q10 2 17 14 M3 14 L3 9 M3 14 L8 13 M17 14 L12 13 M17 14 L17 9'], ['del', '削除', 'M5 5 L15 15 M15 5 L5 15']];
function renderSemEditor(full) {
  const ov = $('#semEd'), m = state.db.semModel;
  if (full) {
    const used = new Set(m.nodes.filter(n => n.kind === 'obs').map(n => n.name));
    ov.innerHTML = `<div class="semhd"><b>パス図エディタ</b><span class="hint" id="semHint"></span><span style="flex:1"></span>
      <label class="hint"><input type="checkbox" id="seStd" ${state.opt.semStd ? 'checked' : ''}> 標準化推定値</label>
      <label class="hint"><input type="checkbox" id="seAuto" ${m.autoCov ? 'checked' : ''}> 外生変数どうしの共分散を自動で仮定</label>
      <label class="hint">ブートストラップ <select id="seBoot">${['0', '500', '1000', '2000', '5000'].map(v => `<option value="${v}" ${state.opt.semBoot === v ? 'selected' : ''}>${v === '0' ? 'なし' : v + ' 回'}</option>`).join('')}</select></label>
      <button class="btn" data-se="undo">元に戻す</button><button class="btn" data-se="layout">自動で並べる</button><button class="btn" data-se="text">テキストで書く</button><button class="btn" data-se="parcel">アイテム・パーセリング</button><button class="btn" data-se="clear">全消去</button>
      <button class="btn primary" data-se="run">推定する</button><button class="btn" data-se="close">閉じる</button></div>
      <div class="sembody"><div class="semtools">${TOOLS.map(([id, l, d]) => `<button class="btn" data-tool="${id}" title="${l}" aria-pressed="${SE.tool === id}"><svg viewBox="0 0 20 20" width="20" height="20">${d === 'ellipse' ? '<ellipse cx="10" cy="10" rx="8" ry="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' : `<path d="${d}" fill="${id === 'select' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"/>`}</svg><span>${l}</span></button>`).join('')}</div>
      <div class="semcv" id="semCv"></div>
      <aside class="semside"><h5>データの変数</h5><p class="hint">クリックで図に置きます。潜在変数を選んでいるときは、その指標として矢印つきで置きます。ドラッグして置くこともできます。</p>
      <div class="semvars">${state.db.cols.map((c, j) => colType(j) === 'num' ? `<button class="chip" draggable="true" data-addvar="${esc(c.name)}" ${used.has(c.name) ? 'disabled' : ''}>${esc(c.name)}</button>` : '').join('')}</div>
      <h5>図形の大きさ</h5><div class="semsize">
        <label>潜在変数（楕円）<input type="range" id="seLatK" min="0.6" max="2" step="0.05" value="${m.latK || 1}"><output id="seLatKv">${Math.round((m.latK || 1) * 100)}%</output></label>
        <label>観測変数（四角）<input type="range" id="seObsK" min="0.6" max="2" step="0.05" value="${m.obsK || 1}"><output id="seObsKv">${Math.round((m.obsK || 1) * 100)}%</output></label>
        <label>文字<input type="range" id="seFontK" min="0.6" max="2.5" step="0.05" value="${m.fontK || 1}"><output id="seFontKv">${Math.round((m.fontK || 1) * 100)}%</output></label>
        <label class="semchk"><input type="checkbox" id="seFontF" ${m.fontFollow === false ? '' : 'checked'}> 図形の大きさに合わせて文字も大きくする</label>
        <p class="hint">1 つだけ変えるときは、その変数を選んで右下の □ をドラッグします（□ をダブルクリックで元に戻す）。「文字」は係数・R²・誤差の文字にも効きます。</p>
        <button class="btn" data-se="sizereset">大きさ・文字をすべて元に戻す</button></div>
      <div id="semFit"></div><div id="semText" hidden><h5>モデルの書式（lavaan と同じ）</h5><textarea id="semTa" rows="9" spellcheck="false"></textarea><button class="btn" data-se="fromtext">テキストから図を作る</button><p class="hint">=~ 潜在変数の測定、~ 回帰（パス）、~~ 共分散。例：「抑うつ ~ ストレス」</p></div></aside></div>`;
  }
  $('#semCv').innerHTML = semSvg(m, { interactive: true, sel: SE.sel, pending: SE.pending, fit: SE.fit, std: state.opt.semStd, tool: SE.tool, canvas: [Math.max(700, ($('#semCv').clientWidth || 900) - 4), Math.max(460, ($('#semCv').clientHeight || 560) - 4)] });
  ov.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === SE.tool));
  { const f = $('#seFontF'); if (f) f.checked = m.fontFollow !== false; }
  [['seLatK', m.latK], ['seObsK', m.obsK], ['seFontK', m.fontK]].forEach(([id, v]) => { const el = $('#' + id); if (el && document.activeElement !== el) { el.value = v || 1; $('#' + id + 'v').textContent = Math.round((v || 1) * 100) + '%'; } });
  const hint = { select: '変数をドラッグして動かす。選んだ変数の右下の □ で大きさを変える。ダブルクリックで名前（潜在変数）や固定値（矢印）を変更。Delete キーで削除。', lat: '図の空いているところをクリックすると潜在変数を置きます。', path: SE.pending ? '矢印の行き先をクリック' : '矢印の出発点（原因）をクリック', cov: SE.pending ? 'もう一方の変数をクリック' : '共分散を引く1つめの変数をクリック', del: '削除する変数・矢印をクリック' }[SE.tool];
  $('#semHint').textContent = hint;
  $('#semFit').innerHTML = SE.fit ? `<h5>適合度指標</h5><table class="out semfit">${semFitLines(SE.fit).map(([k, v]) => { const j = semFitVerdict(SE.fit)[k]; return `<tr><td>${k}</td><td style="color:${j === 'good' ? 'var(--accent)' : j === 'poor' ? 'var(--sig)' : 'var(--fg)'}">${esc(String(v))}${j === 'good' ? ' ○' : j === 'poor' ? ' ×' : j ? ' △' : ''}</td></tr>`; }).join('')}</table><p class="hint">○ 良好 △ 許容 × 不十分。${+state.opt.semBoot > 0 && !SE.boot ? 'ブートストラップが終わると結果ツリーに詳しい表が出ます。' : '結果ツリーにも詳しい表を出しました。'}</p>${SE.boot && SE.boot.ind.length ? `<h5>間接効果（ブートストラップ ${SE.boot.B}回）</h5><table class="out semfit">${SE.boot.ind.map(b => `<tr><td>${esc(b.e.from)} → ${esc(b.e.to)}</td><td>β = ${c2(b.e.std)}<br><small>BC 95%CI [${c2(b.std.bc[0])}, ${c2(b.std.bc[1])}]${b.raw.bc[0] > 0 || b.raw.bc[1] < 0 ? ' *' : ''}</small></td></tr>`).join('')}</table>` : ''}` : '';
  if (!$('#semText').hidden) $('#semTa').value = semSyntax(m);
  ov.querySelectorAll('[data-addvar]').forEach(b => b.disabled = m.nodes.some(n => n.kind === 'obs' && n.name === b.dataset.addvar));
}
function semPush() { SE.hist.push(JSON.stringify(state.db.semModel)); if (SE.hist.length > 60) SE.hist.shift(); }
function semChanged(structural) { if (structural) SE.fit = null; save(); renderSemEditor(); }
function svgPt(ev) { const svg = $('#semCv svg'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const r = pt.matrixTransform(svg.getScreenCTM().inverse()); return [r.x, r.y]; }
function semFreeSpot(m) { const xs = m.nodes.map(n => n.x), ys = m.nodes.map(n => n.y); return m.nodes.length ? [Math.max(...xs) + 120, Math.min(...ys)] : [200, 120]; }
function semAddVar(name, at) {
  const m = state.db.semModel; if (m.nodes.some(n => n.name === name)) return; semPush();
  const L = !at && SE.sel && m.nodes.find(n => n.id === SE.sel && n.kind === 'lat');
  let x, y;
  if (L) {
    const inds = m.edges.filter(e => e.type === 'path' && e.from === L.id).map(e => m.nodes.find(n => n.id === e.to)).filter(n => n.kind === 'obs'), others = m.nodes.filter(n => n.id !== L.id && !inds.includes(n));
    const sd = inds.length ? Math.sign(S.mean(inds.map(n => n.x - L.x))) || -1 : others.length && L.x > S.mean(others.map(n => n.x)) ? 1 : -1;
    x = L.x + sd * 160; y = inds.length ? Math.max(...inds.map(n => n.y)) + 52 : L.y;
  }
  else [x, y] = at || semFreeSpot(m);
  const n = { id: 'n' + m.nid++, name, kind: 'obs', x: Math.round(x), y: Math.round(y) }; m.nodes.push(n);
  if (L) m.edges.push({ id: 'e' + m.nid++, type: 'path', from: L.id, to: n.id, fix: null });
  semChanged(true);
}
function semUniqueName(base) { const m = state.db.semModel, taken = new Set([...m.nodes.map(n => n.name), ...state.db.cols.map(c => c.name)]); let k = 1; while (taken.has(base + k)) k++; return base + k; }
function bindSemEditor(ov) {
  ov.addEventListener('click', e => {
    const t = e.target.closest('[data-tool]'); if (t) { SE.tool = t.dataset.tool; SE.pending = null; renderSemEditor(); return; }
    const v = e.target.closest('[data-addvar]'); if (v) { semAddVar(v.dataset.addvar); return; }
    const b = e.target.closest('[data-se]'); if (!b) return; const a = b.dataset.se, m = state.db.semModel;
    if (a === 'close') semClose();
    if (a === 'undo' && SE.hist.length) { state.db.semModel = JSON.parse(SE.hist.pop()); SE.sel = null; semChanged(true); }
    if (a === 'layout' && m.nodes.length) { semPush(); semAutoLayout(m); semChanged(false); }
    if (a === 'clear' && m.nodes.length && confirm('パス図をすべて消しますか？（「元に戻す」で戻せます）')) { semPush(); state.db.semModel = semKeepLook(m, { ...emptySemModel(), autoCov: m.autoCov }); SE.sel = null; semChanged(true); renderSemEditor(true); }
    if (a === 'sizereset') { semPush(); delete m.latK; delete m.obsK; delete m.fontK; delete m.fontFollow; m.nodes.forEach(n => { delete n.rx; delete n.ry; delete n.w; delete n.h; }); semChanged(false); renderSemEditor(true); }
    if (a === 'parcel') { try { parOpen(); } catch (err) { alert(err.message); } }
    if (a === 'text') { $('#semText').hidden = !$('#semText').hidden; renderSemEditor(); }
    if (a === 'fromtext') { try { const sp = S.sem.parse($('#semTa').value); semPush(); semSetK(m); const nm = semKeepLook(m, semFromSpec(sp)); nm.autoCov = m.autoCov; state.db.semModel = nm; SE.sel = null; semChanged(true); renderSemEditor(true); $('#semText').hidden = false; renderSemEditor(); } catch (err) { alert(err.message); } }
    if (a === 'run') { try { SE.fit = semRun(m); SE.boot = null; renderSemEditor(); semRunAll(m, SE.fit, BT => { SE.boot = BT; if (SE.open) renderSemEditor(); }); } catch (err) { alert(err.message); } }
  });
  ov.addEventListener('input', e => {
    const id = e.target.id; if (id !== 'seLatK' && id !== 'seObsK' && id !== 'seFontK') return; const m = state.db.semModel, k = { seLatK: 'latK', seObsK: 'obsK', seFontK: 'fontK' }[id];
    if (!SE.sliding) { semPush(); SE.sliding = true; }
    m[k] = +e.target.value; $('#' + id + 'v').textContent = Math.round(m[k] * 100) + '%'; renderSemEditor();
  });
  ov.addEventListener('change', e => {
    if (e.target.id === 'seLatK' || e.target.id === 'seObsK' || e.target.id === 'seFontK') { SE.sliding = false; save(); return; }
    if (e.target.id === 'seFontF') { semPush(); state.db.semModel.fontFollow = e.target.checked; semChanged(false); return; }
    if (e.target.id === 'seStd') { state.opt.semStd = e.target.checked; save(); renderSemEditor(); }
    if (e.target.id === 'seBoot') { state.opt.semBoot = e.target.value; save(); }
    if (e.target.id === 'seAuto') { state.db.semModel.autoCov = e.target.checked; semChanged(true); }
  });
  ov.addEventListener('pointerdown', e => {
    const cv = e.target.closest('#semCv svg'); if (!cv) return; const m = state.db.semModel, nid = e.target.dataset.node, eid = e.target.dataset.edge, [x, y] = svgPt(e);
    if (e.target.dataset.resize) { // ダブルクリック（2 回目の押し下げ）で元の大きさに戻す
      const rid = e.target.dataset.resize, now = Date.now();
      if (SE.rszLast && SE.rszLast.id === rid && now - SE.rszLast.t < 450) { SE.rszLast = null; const n = m.nodes.find(q => q.id === rid); semPush(); delete n.rx; delete n.ry; delete n.w; delete n.h; semChanged(false); return; }
      SE.rszLast = { id: rid, t: now }; SE.rsz = { id: rid, moved: false }; cv.setPointerCapture(e.pointerId); return;
    }
    if (SE.tool === 'select') {
      if (nid) { const n = m.nodes.find(q => q.id === nid); SE.sel = nid; SE.drag = { id: nid, dx: n.x - x, dy: n.y - y, moved: false }; cv.setPointerCapture(e.pointerId); }
      else SE.sel = eid || null; renderSemEditor(); return;
    }
    if (SE.tool === 'lat' && !nid && !eid) { semPush(); const n = { id: 'n' + m.nid++, name: semUniqueName('因子'), kind: 'lat', x: Math.round(x), y: Math.round(y) }; m.nodes.push(n); SE.sel = n.id; SE.tool = 'select'; semChanged(true); return; }
    if ((SE.tool === 'path' || SE.tool === 'cov') && nid) {
      if (!SE.pending) { SE.pending = nid; renderSemEditor(); return; }
      if (SE.pending !== nid) {
        const a = SE.pending, b = nid, dup = m.edges.some(q => q.type === SE.tool && ((q.from === a && q.to === b) || (SE.tool === 'cov' && q.from === b && q.to === a)));
        if (!dup) { semPush(); m.edges.push({ id: 'e' + m.nid++, type: SE.tool, from: a, to: b, fix: null }); }
      }
      SE.pending = null; semChanged(true); return;
    }
    if (SE.tool === 'del' && (nid || eid)) { semPush(); if (nid) { m.nodes = m.nodes.filter(n => n.id !== nid); m.edges = m.edges.filter(q => q.from !== nid && q.to !== nid); } else m.edges = m.edges.filter(q => q.id !== eid); semChanged(true); renderSemEditor(true); return; }
    if (!nid && !eid) { SE.pending = null; renderSemEditor(); }
  });
  ov.addEventListener('pointermove', e => {
    if (SE.rsz) {
      const n = state.db.semModel.nodes.find(q => q.id === SE.rsz.id), [x, y] = svgPt(e), dx = Math.abs(x - n.x), dy = Math.abs(y - n.y);
      if (!SE.rsz.moved) { semPush(); SE.rsz.moved = true; SE.rszLast = null; }
      if (n.kind === 'lat') { n.rx = Math.round(Math.max(20, dx / .7071)); n.ry = Math.round(Math.max(12, dy / .7071)); } else { n.w = Math.round(Math.max(30, dx * 2)); n.h = Math.round(Math.max(18, dy * 2)); }
      renderSemEditor(); return;
    }
    if (!SE.drag) return; const n = state.db.semModel.nodes.find(q => q.id === SE.drag.id), [x, y] = svgPt(e);
    if (!SE.drag.moved) { semPush(); SE.drag.moved = true; }
    n.x = Math.round((x + SE.drag.dx) / 5) * 5; n.y = Math.round((y + SE.drag.dy) / 5) * 5; renderSemEditor();
  });
  ov.addEventListener('pointerup', () => { if (SE.drag) { SE.drag = null; save(); } if (SE.rsz) { SE.rsz = null; save(); } });
  ov.addEventListener('dblclick', e => {
    const m = state.db.semModel, nid = e.target.dataset.node, eid = e.target.dataset.edge;
    if (nid) { const n = m.nodes.find(q => q.id === nid); if (n.kind !== 'lat') return; const v = prompt('潜在変数の名前', n.name); if (v && v.trim() && v.trim() !== n.name) { const s = v.trim(); if (m.nodes.some(q => q.name === s) || state.db.cols.some(c => c.name === s)) { alert('その名前はすでに使われています。'); return; } if (/[~=+*#;]/.test(s)) { alert('名前に ~ = + * # ; は使えません。'); return; } semPush(); n.name = s; semChanged(true); } }
    if (eid) { const q = m.edges.find(x => x.id === eid), v = prompt('この矢印の値を固定する場合は数値を入力（空欄なら自由に推定）', q.fix ?? ''); if (v === null) return; const s = v.trim(); if (s !== '' && !isFinite(Number(s))) { alert('数値を入力してください。'); return; } semPush(); q.fix = s === '' ? null : Number(s); semChanged(true); }
  });
  ov.addEventListener('dragstart', e => { const v = e.target.closest('[data-addvar]'); if (v) e.dataTransfer.setData('text/plain', v.dataset.addvar); });
  ov.addEventListener('dragover', e => { if (e.target.closest('#semCv')) e.preventDefault(); });
  ov.addEventListener('drop', e => { if (!e.target.closest('#semCv')) return; e.preventDefault(); const name = e.dataTransfer.getData('text/plain'); if (name) semAddVar(name, svgPt(e)); });
  document.addEventListener('keydown', e => {
    if (!SE.open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || ($('#parDlg') && !$('#parDlg').hidden)) return; const m = state.db.semModel;
    if ((e.key === 'Delete' || e.key === 'Backspace') && SE.sel) { e.preventDefault(); semPush(); m.nodes = m.nodes.filter(n => n.id !== SE.sel); m.edges = m.edges.filter(q => q.id !== SE.sel && q.from !== SE.sel && q.to !== SE.sel); SE.sel = null; semChanged(true); renderSemEditor(true); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && SE.hist.length) { e.preventDefault(); state.db.semModel = JSON.parse(SE.hist.pop()); SE.sel = null; semChanged(true); renderSemEditor(true); }
    if (e.key === 'Escape') { if (SE.pending) { SE.pending = null; renderSemEditor(); } else semClose(); }
  });
}
function semCfaFromFa() {
  const R = state.db.roles; need(R.fa.length >= 3, '因子分析タブで項目を3つ以上選んでください。');
  const raw = R.fa.map(j => dbCol(j).map(toNum)), ok = raw[0].map((_, i) => raw.every(c => isFinite(c[i]))), cols = raw.map(c => c.filter((_, i) => ok[i])), n = cols[0].length, p = cols.length;
  let k = +state.opt.nf; if (!(k > 0)) { const Rm = S.corMatrix(cols), ev = S.eigSym(Rm).values, PA = S.parallel(n, p, 100); k = 0; while (k < p && ev[k] > PA.q95[k]) k++; k = Math.max(1, k); }
  k = Math.min(k, Math.max(1, Math.floor((2 * p + 1 - Math.sqrt(8 * p + 1)) / 2)), p - 1);
  const fa = S.factorAnalysis(cols, k, 'ml', k > 1 ? 'promax' : 'none'), P = fa.P, names = R.fa.map(j => state.db.cols[j].name);
  const lines = []; for (let f = 0; f < k; f++) { const its = names.filter((_, i) => P[i].reduce((b, v, q) => Math.abs(v) > Math.abs(P[i][b]) ? q : b, 0) === f); if (its.length) lines.push(`因子${f + 1} =~ ${its.join(' + ')}`); }
  semSetK(state.db.semModel); const m = semKeepLook(state.db.semModel || {}, semFromSpec(S.sem.parse(lines.join('\n')))); m.autoCov = true; state.db.semModel = m; save(); renderDbPanel(true);
  $('#msg').textContent = `因子分析（最尤法・プロマックス回転、${k}因子）で各項目を最も負荷の大きい因子に割り当てました。エディタで確認・修正できます。`;
}
$('#panelBody').addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act; if (state.fmt !== 'db') return;
  if (a === 'semopen') semOpen();
  if (a === 'semcfa') { try { semCfaFromFa(); } catch (err) { $('#msg').textContent = err.message; } }
});
