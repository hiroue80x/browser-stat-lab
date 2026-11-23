// ===== データの加工：尺度得点・逆転項目・リコード・計算式・ケースの選択（加工の手順は R コードとして記録） =====
const PREP = { sec: 'score', filter: '', use: new Set(), rev: new Set(), rcJ: -1, rcMode: 'map', rcRows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']], conds: [{ j: -1, op: '=', v: '' }], msg: '' };
(() => { const st = document.createElement('style'); st.textContent = `
.pp-sec { display:flex; flex-wrap:wrap; gap:4px; margin:8px 0; } .pp-sec button[aria-selected="true"] { background:var(--accent); color:#fff; border-color:var(--accent); }
.pp-box { border:1px solid var(--line); border-radius:6px; padding:10px; background:var(--panel); margin-bottom:10px; }
.pp-items { max-height:300px; overflow:auto; border:1px solid var(--line); border-radius:4px; background:var(--sheet); margin:6px 0; }
.pp-items table { width:100%; border-collapse:collapse; font-size:12.5px; } .pp-items th, .pp-items td { padding:3px 6px; border-bottom:1px solid var(--grid); text-align:left; vertical-align:top; }
.pp-items th { position:sticky; top:0; background:var(--panel); font-weight:600; } .pp-items td.c { text-align:center; width:3.2em; } .pp-items td small { color:var(--muted); }
.pp-row { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; margin:6px 0; font-size:12.5px; }
.pp-row input[type=text], .pp-row input:not([type]), .pp-row input[type=number] { font:inherit; padding:2px 6px; border:1px solid var(--line); border-radius:4px; background:var(--bg); color:var(--fg); }
.pp-msg { margin:6px 0; font-size:12.5px; } .pp-msg.ok { color:var(--accent); } .pp-msg.err { color:var(--sig); }
.pp-expr { width:100%; min-height:54px; font-family:var(--f-num); font-size:12.5px; padding:6px; border:1px solid var(--line); border-radius:4px; background:var(--bg); color:var(--fg); box-sizing:border-box; }
.pp-recipe pre { margin:4px 0 8px; padding:6px 8px; background:var(--sheet); border:1px solid var(--line); border-radius:4px; font-size:11.5px; white-space:pre-wrap; }
.fbanner { margin:0 0 8px; padding:6px 10px; border-left:4px solid var(--sig); background:var(--sig-soft); font-size:12.5px; border-radius:4px; display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center; }
tr.fout td { opacity:.38; }`; document.head.appendChild(st); })();

// ---- ケースの選択（選ばれていない人の値は、すべての分析で欠損として扱う） ----
let FMASK = null;
{ const _save0 = save; save = function () { FMASK = null; return _save0.apply(this, arguments); }; }
function condMatch(c, raw, col) {
  if (c.op === 'na') return raw === ''; if (c.op === 'notna') return raw !== ''; if (raw === '') return false;
  const v = String(c.v ?? '').trim(), lab = codeToLabel(col, raw), nr = toNum(raw), nv = toNum(v);
  if (c.op === '=' || c.op === '!=') { const eq = raw === v || lab === v || (isFinite(nr) && isFinite(nv) && nr === nv); return c.op === '=' ? eq : !eq; }
  if (!isFinite(nr) || !isFinite(nv)) return false;
  return { '>': nr > nv, '>=': nr >= nv, '<': nr < nv, '<=': nr <= nv }[c.op];
}
function filterMask() {
  const db = state.db, F = db && db.filter; if (!F || !F.conds || !F.conds.length) return null;
  if (FMASK && FMASK.ref === db && FMASK.n === db.rows.length) return FMASK.m;
  const cs = F.conds.filter(c => c.j >= 0 && c.j < db.cols.length); if (!cs.length) return null;
  const cols = cs.map(c => rawColBase(c.j)), m = db.rows.map((_, i) => { const r = cs.map((c, q) => condMatch(c, cols[q][i], db.cols[c.j])); return F.join === 'or' ? r.some(Boolean) : r.every(Boolean); });
  FMASK = { ref: db, n: db.rows.length, m }; return m;
}
const OPL = { '=': '＝', '!=': '≠', '>': '＞', '>=': '≧', '<': '＜', '<=': '≦', notna: 'が欠損でない', na: 'が欠損' };
function condText(c) { const nm = state.db.cols[c.j] ? state.db.cols[c.j].name : '?'; return c.op === 'na' || c.op === 'notna' ? `${nm}${OPL[c.op]}` : `${nm} ${OPL[c.op]} ${c.v}`; }
function filterText() { const F = state.db.filter; return F && F.conds ? F.conds.map(condText).join(F.join === 'or' ? ' または ' : ' かつ ') : ''; }
function filterBanner() {
  const m = filterMask(); if (!m) return ''; const k = m.filter(Boolean).length;
  return `<div class="fbanner"><b>ケースの選択中</b><span>${esc(filterText())}　→ ${k} / ${m.length} 人を分析に使います（選ばれていない人の値は欠損として扱います）</span><button class="btn" data-pp="unfilter" style="padding:1px 8px">選択を解除</button></div>`;
}

// ---- 列を追加する（元の列は変えない） ----
function ppAddCol(def, vals, recipe) {
  const d = state.db; let name = String(def.name || '新しい変数').trim() || '新しい変数', q = 2; const base = name; while (d.cols.some(c => c.name === name)) name = `${base}_${q++}`;
  const fmtV = v => v === '' || v == null || (typeof v === 'number' && !isFinite(v)) ? '' : typeof v === 'number' ? String(+v.toFixed(6)) : String(v);
  d.cols.push({ name, on: true, label: def.label || '', measure: def.measure || '', values: def.values || [], missing: '' });
  d.rows.forEach((r, i) => { while (r.length < d.cols.length - 1) r.push(''); r.push(fmtV(vals[i])); });
  if (recipe) { d.recipe = d.recipe || []; d.recipe.push({ t: recipe.t.replace(/\{NAME\}/g, name), r: recipe.r.replace(/\{NAME\}/g, name) }); }
  return name;
}
function ppRefresh(msg, ok = true) { PREP.msg = msg ? `<div class="pp-msg ${ok ? 'ok' : 'err'}">${msg}</div>` : ''; save(); renderSheet(); renderPanel(); }
const numBase = j => rawColBase(j).map(toNum);
const fz = v => Math.abs(v) < 1e-9 ? 0 : v; // ほぼ 0 の平均（z 得点など）は 0 と表示
const rN = j => `d$${RQ(state.db.cols[j].name)}`;

// ---- 尺度得点・逆転 ----
function ppRange(js) { // 逆転に使う最小値・最大値（値ラベルがあればそのコード、なければデータの範囲）
  let lo = Infinity, hi = -Infinity;
  js.forEach(j => { const c = state.db.cols[j], codes = (c.values || []).map(v => toNum(v[0])).filter(isFinite); const v = codes.length ? codes : numBase(j).filter(isFinite); v.forEach(x => { lo = Math.min(lo, x); hi = Math.max(hi, x); }); });
  return isFinite(lo) ? [lo, hi] : [1, 5];
}
function ppScoreVals(js, rev, lo, hi, agg, miss) {
  const k = js.length, cols = js.map(j => { const v = numBase(j); return rev.includes(j) ? v.map(x => isFinite(x) ? lo + hi - x : NaN) : v; });
  const need = miss === 'none' ? k : miss === 'any' ? 1 : k - Math.floor(k * .2);
  return state.db.rows.map((_, i) => { const xs = cols.map(c => c[i]).filter(isFinite); if (xs.length < need || !xs.length) return NaN; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return agg === 'sum' ? m * k : m; });
}
function ppScoreR(name, js, rev, lo, hi, agg, miss) {
  const k = js.length, need = miss === 'none' ? k : miss === 'any' ? 1 : k - Math.floor(k * .2);
  return `items <- data.frame(${js.map(j => rev.includes(j) ? `${lo + hi} - ${rN(j)}` : rN(j)).join(', ')})   # ${rev.length ? `逆転項目は ${lo} ＋ ${hi} − 得点` : '逆転項目なし'}\n`
    + `d$${RQ('{NAME}')} <- ifelse(rowSums(!is.na(items)) >= ${need}, rowMeans(items, na.rm = TRUE)${agg === 'sum' ? ` * ${k}` : ''}, NA)   # ${agg === 'sum' ? '合計（欠損があるときは項目数に換算）' : '平均'}`;
}
function ppAlpha(js, rev, lo, hi) { const cols = js.map(j => { const v = numBase(j); return rev.includes(j) ? v.map(x => isFinite(x) ? lo + hi - x : NaN) : v; }), ok = state.db.rows.map((_, i) => cols.every(c => isFinite(c[i]))), cc = cols.map(c => c.filter((_, i) => ok[i])); return cc[0] && cc[0].length > 2 && js.length >= 2 ? { a: S.cronbach(cc).alpha, n: cc[0].length } : null; }
const MISS_L = { none: '欠損が 1 つでもあれば計算しない', p20: '欠損が 20% 以下なら残りの項目で計算', any: '1 項目でも回答があれば計算' };

// ---- 計算式（列名は [ ] で囲むか、そのまま書く） ----
function exprParse(src) {
  const toks = [], s = src; let i = 0; const nameCh = ch => !/[\s+\-*/^(),\[\]]/.test(ch);
  while (i < s.length) { const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('+-*/^(),'.includes(ch)) { toks.push({ k: ch }); i++; continue; }
    if (ch === '[') { const e = s.indexOf(']', i); if (e < 0) throw new Error('「[」に対応する「]」がありません。'); toks.push({ k: 'name', v: s.slice(i + 1, e) }); i = e + 1; continue; }
    let e = i; while (e < s.length && nameCh(s[e])) e++; const w = s.slice(i, e);
    if (/^\d+(\.\d+)?$/.test(w) || /^\.\d+$/.test(w)) toks.push({ k: 'num', v: +w }); else toks.push({ k: 'name', v: w }); i = e; }
  let p = 0; const peek = () => toks[p], eat = k => { const t = toks[p]; if (!t || t.k !== k) throw new Error(`「${k}」が必要な所があります。`); p++; return t; };
  const FN = ['mean', 'sum', 'min', 'max', 'log', 'log10', 'exp', 'sqrt', 'abs', 'round', 'z', 'center'];
  const expr = () => { let a = term(); while (peek() && (peek().k === '+' || peek().k === '-')) { const op = toks[p++].k; a = { t: 'bin', op, a, b: term() }; } return a; };
  const term = () => { let a = power(); while (peek() && (peek().k === '*' || peek().k === '/')) { const op = toks[p++].k; a = { t: 'bin', op, a, b: power() }; } return a; };
  const power = () => { const a = unary(); if (peek() && peek().k === '^') { p++; return { t: 'bin', op: '^', a, b: power() }; } return a; };
  const unary = () => { if (peek() && peek().k === '-') { p++; return { t: 'neg', a: unary() }; } if (peek() && peek().k === '+') { p++; return unary(); } return prim(); };
  const prim = () => { const t = peek(); if (!t) throw new Error('式が途中で終わっています。');
    if (t.k === 'num') { p++; return { t: 'num', v: t.v }; }
    if (t.k === '(') { p++; const a = expr(); eat(')'); return a; }
    if (t.k === 'name') { p++;
      if (peek() && peek().k === '(' && FN.includes(t.v.toLowerCase())) { p++; const args = []; if (peek() && peek().k !== ')') { args.push(expr()); while (peek() && peek().k === ',') { p++; args.push(expr()); } } eat(')'); return { t: 'fn', f: t.v.toLowerCase(), args }; }
      const j = state.db.cols.findIndex(c => c.name === t.v); if (j < 0) throw new Error(`「${t.v}」という列はありません（列名に記号や空白があるときは [列名] と書きます）。`); return { t: 'col', j }; }
    throw new Error(`「${t.k}」の位置がおかしいようです。`); };
  const ast = expr(); if (p < toks.length) throw new Error(`「${toks[p].k === 'name' ? toks[p].v : toks[p].k}」の前で式を区切れません。`); return ast;
}
const roundHalfEven = (x, k = 0) => { const f = 10 ** k, y = x * f, r = Math.round(y); return (Math.abs(y % 1) === .5 ? 2 * Math.round(y / 2) : r) / f; };
function exprEval(ast, n) {
  const rep = v => new Array(n).fill(v), fin = v => isFinite(v) ? v : NaN;
  const ev = a => {
    if (a.t === 'num') return rep(a.v); if (a.t === 'col') return numBase(a.j); if (a.t === 'neg') return ev(a.a).map(v => -v);
    if (a.t === 'bin') { const x = ev(a.a), y = ev(a.b); return x.map((v, i) => fin({ '+': v + y[i], '-': v - y[i], '*': v * y[i], '/': v / y[i], '^': v ** y[i] }[a.op])); }
    const A = a.args.map(ev), f = a.f; if (!A.length) throw new Error(`${f}() の中に列や数を入れてください。`);
    if (['mean', 'sum', 'min', 'max'].includes(f)) return rep(0).map((_, i) => { const xs = A.map(c => c[i]).filter(isFinite); if (!xs.length) return NaN; return f === 'mean' ? xs.reduce((s, v) => s + v, 0) / xs.length : f === 'sum' ? xs.reduce((s, v) => s + v, 0) : f === 'min' ? Math.min(...xs) : Math.max(...xs); });
    const x = A[0];
    if (f === 'z' || f === 'center') { const ok = x.filter(isFinite), m = ok.reduce((s, v) => s + v, 0) / ok.length, sd = Math.sqrt(ok.reduce((s, v) => s + (v - m) ** 2, 0) / (ok.length - 1)); return x.map(v => isFinite(v) ? (f === 'z' ? (v - m) / sd : v - m) : NaN); }
    if (f === 'round') { const k = A[1] ? A[1][0] : 0; return x.map(v => isFinite(v) ? roundHalfEven(v, k) : NaN); }
    return x.map(v => fin({ log: Math.log(v), log10: Math.log10(v), exp: Math.exp(v), sqrt: Math.sqrt(v), abs: Math.abs(v) }[f]));
  };
  return ev(ast);
}
function exprR(a) {
  if (a.t === 'num') return String(a.v); if (a.t === 'col') return rN(a.j); if (a.t === 'neg') return `-${exprR(a.a)}`;
  if (a.t === 'bin') return `(${exprR(a.a)} ${a.op} ${exprR(a.b)})`;
  const A = a.args.map(exprR), f = a.f;
  if (f === 'mean') return `rowMeans(cbind(${A.join(', ')}), na.rm = TRUE)`;
  if (f === 'sum') return `ifelse(rowSums(!is.na(cbind(${A.join(', ')}))) > 0, rowSums(cbind(${A.join(', ')}), na.rm = TRUE), NA)`;
  if (f === 'min' || f === 'max') return A.length > 1 ? `p${f}(${A.join(', ')}, na.rm = TRUE)` : A[0];
  if (f === 'z') return `as.numeric(scale(${A[0]}))`; if (f === 'center') return `(${A[0]} - mean(${A[0]}, na.rm = TRUE))`;
  return `${f}(${A.join(', ')})`;
}

// ---- リコード ----
function quant7(sorted, p) { const h = (sorted.length - 1) * p, lo = Math.floor(h); return sorted[lo] + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)]) - sorted[lo]); }
function ppRecode() {
  const j = PREP.rcJ; need(j >= 0, 'リコードする変数を選んでください。'); const c = state.db.cols[j], raw = rawColBase(j), x = raw.map(toNum), nm = c.name, mode = PREP.rcMode;
  const name = (document.getElementById('ppRcName')?.value || '').trim() || `${nm}_r`, meas = document.getElementById('ppRcMeas')?.value || 'nominal', els = document.getElementById('ppRcElse')?.value || 'keep';
  let vals, values = [], r = '', t = '';
  if (mode === 'median') { const ok = x.filter(isFinite).sort((a, b) => a - b); need(ok.length, '数値の値がありません。'); const md = quant7(ok, .5); vals = x.map(v => isFinite(v) ? (v <= md ? 1 : 2) : ''); values = [['1', '低群'], ['2', '高群']];
    t = `${nm} を中央値（${+md.toFixed(4)}）で 2 群に分けた（中央値以下 = 1 低群、より大きい = 2 高群）`; r = `d$${RQ('{NAME}')} <- ifelse(${rN(j)} <= median(${rN(j)}, na.rm = TRUE), 1, 2)   # 中央値以下 = 1（低群）、より大きい = 2（高群）`; }
  else if (mode === 'mean1sd') { const ok = x.filter(isFinite), m = S.mean(ok), sd = S.sd(ok); vals = x.map(v => isFinite(v) ? (v < m - sd ? 1 : v > m + sd ? 3 : 2) : ''); values = [['1', '低群'], ['2', '中群'], ['3', '高群']];
    t = `${nm} を平均 ± 1SD（${+(m - sd).toFixed(3)}・${+(m + sd).toFixed(3)}）で 3 群に分けた`; r = `m <- mean(${rN(j)}, na.rm = TRUE); s <- sd(${rN(j)}, na.rm = TRUE)\nd$${RQ('{NAME}')} <- ifelse(${rN(j)} < m - s, 1, ifelse(${rN(j)} > m + s, 3, 2))   # 1 低群・2 中群・3 高群`; }
  else if (mode === 'quant') { const q = +(document.getElementById('ppRcQ')?.value || 3), ok = x.filter(isFinite).sort((a, b) => a - b), br = Array.from({ length: q + 1 }, (_, i) => quant7(ok, i / q));
    need(new Set(br).size === br.length, `同じ値が多いため、${q} 等分の区切りが重なってしまいます。分ける数を減らしてください。`);
    vals = x.map(v => { if (!isFinite(v)) return ''; for (let g = 1; g <= q; g++) if (v <= br[g]) return g; return q; }); values = Array.from({ length: q }, (_, g) => [String(g + 1), `第${g + 1}群`]);
    t = `${nm} を人数がほぼ等しい ${q} 群に分けた（区切り：${br.slice(1, -1).map(v => +v.toFixed(4)).join('・')}）`; r = `d$${RQ('{NAME}')} <- cut(${rN(j)}, quantile(${rN(j)}, probs = seq(0, 1, length.out = ${q + 1}), na.rm = TRUE), include.lowest = TRUE, labels = FALSE)   # ${q} 等分`; }
  else if (mode === 'map') { const lv = levelsOf(raw), mp = {}, ml = {};
    lv.forEach((v, k) => { const nv = (document.querySelector(`[data-pp-map="${k}"]`)?.value || '').trim(), nl = (document.querySelector(`[data-pp-mapl="${k}"]`)?.value || '').trim(); if (nv !== '') { mp[v] = nv; if (nl && !values.some(x => x[0] === nv)) values.push([nv, nl]); } });
    need(Object.keys(mp).length, '「新しい値」を 1 つ以上入れてください。');
    vals = raw.map(v => v === '' ? '' : mp[v] != null ? mp[v] : els === 'keep' ? (colType(j) === 'cat' ? codeToLabel(c, v) : v) : '');
    t = `${nm} の値を置き換えた（${Object.entries(mp).map(([a, b]) => `${a}→${b}`).join('、')}${els === 'keep' ? '、ほかはそのまま' : '、ほかは欠損'}）`;
    const allNum = Object.values(mp).every(v => isFinite(toNum(v))) && (els !== 'keep' || lv.every(v => isFinite(toNum(v))));
    r = `map <- c(${Object.entries(mp).map(([a, b]) => `${RS(codeToLabel(c, a) !== a && colType(j) === 'cat' ? codeToLabel(c, a) : a)} = ${RS(b)}`).join(', ')})\nnew <- unname(map[as.character(${rN(j)})])\n${els === 'keep' ? `new <- ifelse(is.na(new) & !is.na(${rN(j)}), as.character(${rN(j)}), new)\n` : ''}d$${RQ('{NAME}')} <- ${allNum ? 'as.numeric(new)' : 'new'}`; }
  else { const rows = PREP.rcRows.map((rw, k) => [0, 1, 2, 3].map(q => (document.querySelector(`[data-pp-rg="${k}-${q}"]`)?.value ?? rw[q]).trim())).filter(rw => rw[2] !== '');
    need(rows.length, '範囲と「新しい値」を 1 行以上入れてください。'); const L = rows.map(rw => [rw[0] === '' ? -Infinity : toNum(rw[0]), rw[1] === '' ? Infinity : toNum(rw[1]), rw[2], rw[3]]);
    need(L.every(l => !isNaN(l[0]) && !isNaN(l[1])), '下限・上限には数を入れてください（空欄は「下限なし」「上限なし」）。');
    vals = x.map((v, i) => { if (!isFinite(v)) return raw[i] === '' ? '' : (els === 'keep' ? raw[i] : ''); const h = L.find(l => v >= l[0] && v <= l[1]); return h ? h[2] : els === 'keep' ? raw[i] : ''; });
    L.forEach(l => { if (l[3] && !values.some(x => x[0] === l[2])) values.push([l[2], l[3]]); });
    t = `${nm} を範囲で区切った（${L.map(l => `${isFinite(l[0]) ? l[0] : ''}〜${isFinite(l[1]) ? l[1] : ''}→${l[2]}`).join('、')}${els === 'keep' ? '、ほかはそのまま' : '、ほかは欠損'}）`;
    const cond = l => [isFinite(l[0]) ? `x >= ${l[0]}` : '', isFinite(l[1]) ? `x <= ${l[1]}` : ''].filter(Boolean).join(' & ') || 'TRUE';
    r = `x <- ${rN(j)}\nd$${RQ('{NAME}')} <- ${L.map(l => `ifelse(${cond(l)}, ${isFinite(toNum(l[2])) ? l[2] : RS(l[2])}, `).join('')}${els === 'keep' ? 'x' : 'NA'}${')'.repeat(L.length)}   # 上から順に当てはめる`; }
  const nn = ppAddCol({ name, label: `${c.label || nm}（${{ map: '値の置き換え', range: '範囲で区切る', median: '中央値で 2 群', mean1sd: '平均±1SD で 3 群', quant: '等分' }[mode]}）`, measure: meas, values }, vals, { t: `リコード：{NAME} ← ` + t, r });
  const cnt = {}; vals.forEach(v => { if (v !== '') cnt[v] = (cnt[v] || 0) + 1; });
  ppRefresh(`列「${esc(nn)}」を作りました：${Object.entries(cnt).sort((a, b) => toNum(a[0]) - toNum(b[0])).map(([v, n]) => `${esc(v)}${values.find(x => x[0] === v) ? `（${esc(values.find(x => x[0] === v)[1])}）` : ''} = ${n} 人`).join('、')}${vals.filter(v => v === '').length ? `、欠損 ${vals.filter(v => v === '').length} 人` : ''}。`);
}

// ---- 画面 ----
function renderPrepView() {
  const d = state.db, cols = d.cols.map((c, j) => ({ c, j, t: colType(j) })), nums = cols.filter(x => x.t === 'num'), sec = PREP.sec;
  const secBtn = (k, l) => `<button class="btn" data-pp-sec="${k}" aria-selected="${sec === k}">${l}</button>`;
  let h = `<p class="hint" style="margin:0 0 4px">加工した結果は、データシートの<b>右端に新しい列</b>として追加されます（元の列は変わりません）。不要な列は「右端の列を削除」で消せます。手順は下の「加工の記録」に R コードとして残ります。</p>
    <div class="pp-sec">${secBtn('score', '尺度得点・逆転項目')}${secBtn('recode', 'リコード（値の置き換え・群分け）')}${secBtn('calc', '計算式（z 得点・中心化など）')}${secBtn('filter', 'ケースの選択')}</div>${PREP.msg}`;
  if (sec === 'score') {
    const f = PREP.filter.trim().toLowerCase(), show = c => !f || ((c.c.name || '') + ' ' + (c.c.label || '')).toLowerCase().includes(f);
    const use = [...PREP.use].filter(j => j < d.cols.length), rev = [...PREP.rev].filter(j => use.includes(j)), [lo, hi] = ppRange(rev.length ? rev : use);
    const A = use.length >= 2 ? ppAlpha(use, rev, +(PREP.lo ?? lo), +(PREP.hi ?? hi)) : null;
    const fa = typeof FA_LAST_REL !== 'undefined' && FA_LAST_REL && FA_LAST_REL.items.every(j => j < d.cols.length) ? FA_LAST_REL : null;
    h += `<div class="pp-box"><b>尺度得点を作る</b>（項目の平均または合計）
      <div class="pp-row"><input id="ppFilter" placeholder="名前・内容で絞り込み" value="${esc(PREP.filter)}" style="width:14em"><button class="btn" data-pp="selall" style="padding:1px 8px">表示中をすべて使う</button><button class="btn" data-pp="selnone" style="padding:1px 8px">選択を解除</button><span class="hint">使う ${use.length} 項目（逆転 ${rev.length}）${A ? `　α = ${fmt(A.a, 3)}（n = ${A.n}、逆転後）` : ''}</span></div>
      <div class="pp-items"><table><thead><tr><th>変数名</th><th>内容（ラベル）</th><th class="c">使う</th><th class="c">逆転</th></tr></thead><tbody>${nums.map(x => `<tr${show(x) ? '' : ' style="display:none"'} data-pp-tr="${x.j}"><td>${esc(x.c.name)}</td><td><small>${esc(x.c.label || '')}</small></td><td class="c"><input type="checkbox" data-pp-use="${x.j}" ${PREP.use.has(x.j) ? 'checked' : ''}></td><td class="c"><input type="checkbox" data-pp-rev="${x.j}" ${PREP.rev.has(x.j) ? 'checked' : ''}></td></tr>`).join('')}</tbody></table></div>
      <div class="pp-row"><label>計算 <select id="ppAgg"><option value="mean" ${PREP.agg !== 'sum' ? 'selected' : ''}>平均</option><option value="sum" ${PREP.agg === 'sum' ? 'selected' : ''}>合計</option></select></label>
        <label>欠損の扱い <select id="ppMiss">${Object.entries(MISS_L).map(([v, l]) => `<option value="${v}" ${(PREP.miss || 'p20') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>逆転：<input id="ppLo" type="number" value="${PREP.lo ?? lo}" style="width:4em"> ＋ <input id="ppHi" type="number" value="${PREP.hi ?? hi}" style="width:4em"> − 得点</label></div>
      <div class="pp-row"><label>新しい列の名前 <input id="ppName" value="${esc(PREP.name || '尺度得点')}" style="width:10em"></label><label>ラベル <input id="ppLabel" value="${esc(PREP.label || '')}" placeholder="例：対人不安（4 項目の平均）" style="width:16em"></label></div>
      <div class="pp-row"><button class="btn primary" data-pp="score">尺度得点の列を作る</button><button class="btn" data-pp="revcols" title="「逆転」に印をつけた項目を、反転した新しい列（名前_r）として作ります">逆転した列だけを作る（名前_r）</button></div>
      <p class="hint" style="margin:2px 0 0">逆転項目は「最小値 ＋ 最大値 − 得点」で反転します（1〜5 件法なら 6 − 得点）。値ラベルがあればそのコードから、なければデータの範囲から最小・最大を入れています。</p></div>`;
    if (fa) h += `<div class="pp-box"><b>因子分析の結果から下位尺度得点を作る</b><div class="hint" style="margin:4px 0">最後に実行した因子分析で、|負荷量| ≥ .40 だった項目（負の負荷の項目は自動で逆転：${fa.lo} ＋ ${fa.hi} − 得点）の平均を、因子ごとに作ります。</div>
      ${fa.rel.map((r, q) => r.its.length >= 2 ? `<div class="hint">第${q + 1}因子：${r.its.map(j => esc(d.cols[j].name) + (r.rev.includes(j) ? '（逆転）' : '')).join('・')}</div>` : '').join('')}
      <div class="pp-row"><button class="btn primary" data-pp="fascore">下位尺度得点の列を作る（第1因子得点 …）</button><span class="hint">計算と欠損の扱いは上の設定を使います</span></div></div>`;
  }
  if (sec === 'recode') {
    const j = PREP.rcJ, c = j >= 0 ? d.cols[j] : null, mode = PREP.rcMode, raw = c ? rawColBase(j) : [], lv = c ? levelsOf(raw) : [], isNum = c && colType(j) === 'num';
    h += `<div class="pp-box"><b>リコード</b>（値を置き換えた新しい列を作る）
      <div class="pp-row"><label>変数 <select id="ppRcVar"><option value="-1">選んでください</option>${cols.map(x => `<option value="${x.j}" ${x.j === j ? 'selected' : ''}>${esc(x.c.name)}${x.c.label ? '：' + esc(x.c.label.slice(0, 14)) : ''}</option>`).join('')}</select></label>
        <label>方法 <select id="ppRcMode">${[['map', '値ごとに置き換える'], ['range', '範囲で区切る'], ['median', '中央値で 2 群に分ける'], ['mean1sd', '平均 ± 1SD で 3 群に分ける'], ['quant', '人数がほぼ等しい群に分ける']].map(([v, l]) => `<option value="${v}" ${mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${mode === 'quant' ? `<label>群の数 <select id="ppRcQ">${[2, 3, 4, 5].map(q => `<option ${q === 3 ? 'selected' : ''}>${q}</option>`).join('')}</select></label>` : ''}</div>`;
    if (c && mode === 'map') h += lv.length > 60 ? '<p class="hint">値の種類が多すぎます（60 種類まで）。「範囲で区切る」を使ってください。</p>' : `<div class="pp-items"><table><thead><tr><th>元の値</th><th>人数</th><th>新しい値</th><th>新しいラベル</th></tr></thead><tbody>${lv.map((v, k) => `<tr><td>${esc(v)}${codeToLabel(c, v) !== v ? ` <small>（${esc(codeToLabel(c, v))}）</small>` : ''}</td><td>${raw.filter(x => x === v).length}</td><td><input data-pp-map="${k}" style="width:5em"></td><td><input data-pp-mapl="${k}" style="width:10em"></td></tr>`).join('')}</tbody></table></div>`;
    if (c && mode === 'range') h += `${isNum ? '' : '<p class="pp-msg err">この変数は数値ではないので、範囲では区切れません。</p>'}<div class="pp-items"><table><thead><tr><th>下限（以上）</th><th>上限（以下）</th><th>新しい値</th><th>新しいラベル</th></tr></thead><tbody>${PREP.rcRows.map((rw, k) => `<tr>${[0, 1, 2, 3].map(q => `<td><input data-pp-rg="${k}-${q}" value="${esc(rw[q])}" style="width:${q === 3 ? 9 : 5}em"></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="pp-row"><button class="btn" data-pp="rgadd" style="padding:1px 8px">行を追加</button><span class="hint">上の行から順に当てはめます。下限・上限の空欄は「下限なし」「上限なし」です。${isNum ? `（データの範囲：${Math.min(...raw.map(toNum).filter(isFinite))}〜${Math.max(...raw.map(toNum).filter(isFinite))}）` : ''}</span></div>`;
    if (c && (mode === 'median' || mode === 'mean1sd' || mode === 'quant') && !isNum) h += '<p class="pp-msg err">この変数は数値ではないので、この方法は使えません。</p>';
    if (c) h += `<div class="pp-row">${mode === 'map' || mode === 'range' ? `<label>当てはまらない値 <select id="ppRcElse"><option value="keep">そのまま</option><option value="na">欠損にする</option></select></label>` : ''}
      <label>新しい列の名前 <input id="ppRcName" value="${esc(c.name + '_r')}" style="width:10em"></label><label>尺度 <select id="ppRcMeas"><option value="nominal" ${mode === 'map' || mode === 'median' ? 'selected' : ''}>名義</option><option value="ordinal" ${mode !== 'map' && mode !== 'median' ? 'selected' : ''}>順序</option><option value="scale">スケール</option></select></label></div>
      <div class="pp-row"><button class="btn primary" data-pp="recode">リコードした列を作る</button></div>`;
    h += `<p class="hint" style="margin:4px 0 0">例：年齢を年代に（範囲で区切る）、5 件法を「あてはまる／あてはまらない」の 2 値に（値ごとに置き換える）、得点の高群・低群（中央値で 2 群）。中央値で分けるときは、中央値ちょうどの人は低群に入ります。</p></div>`;
  }
  if (sec === 'calc') {
    h += `<div class="pp-box"><b>計算式で新しい列を作る</b>
      <div class="pp-row"><label>新しい列の名前 <input id="ppExName" value="${esc(PREP.exName || '新しい変数')}" style="width:10em"></label><label>ラベル <input id="ppExLabel" value="${esc(PREP.exLabel || '')}" style="width:16em"></label></div>
      <textarea class="pp-expr" id="ppExpr" placeholder="例：([対人1] + [対人2] + [対人3]) / 3　　mean(対人1, 対人2, 対人3)　　z(年齢)">${esc(PREP.expr || '')}</textarea>
      <div class="pp-row"><label>列名を入れる <select id="ppExIns"><option value="">選ぶと式に入ります</option>${cols.map(x => `<option value="${x.j}">${esc(x.c.name)}</option>`).join('')}</select></label>
        <label>よく使う計算 <select id="ppQVar"><option value="-1">変数を選ぶ</option>${nums.map(x => `<option value="${x.j}">${esc(x.c.name)}</option>`).join('')}</select></label><button class="btn" data-pp="qz" style="padding:1px 8px">z 得点</button><button class="btn" data-pp="qc" style="padding:1px 8px">中心化</button><button class="btn" data-pp="qlog" style="padding:1px 8px">対数</button></div>
      <div class="pp-row"><button class="btn primary" data-pp="calc">計算した列を作る</button></div>
      <details class="mcguide"><summary>使える記号と関数</summary>${table(['書き方', '意味', '例'], [['+ − * / ^', '足す・引く・掛ける・割る・べき乗（^ は 2 乗など）', '[身長] / ([体重] ^ 2)'], ['[列名]', '列の値。記号や空白を含む列名は [ ] で囲む（含まなければそのままでも可）', '[Q1-a] + 対人1'], ['mean(…)', '人ごとの平均（欠損は除いて計算）', 'mean(対人1, 対人2, 対人3)'], ['sum(…)', '人ごとの合計（欠損は除いて計算）', 'sum(対人1, 対人2)'], ['min(…) / max(…)', '人ごとの最小・最大', 'max(得点1, 得点2)'], ['z(x)', '標準化（平均 0・標準偏差 1 の z 得点）', 'z(年齢)'], ['center(x)', '中心化（平均を引く。交互作用の分析の前などに）', 'center(ストレス)'], ['log(x) / log10(x) / exp(x)', '自然対数・常用対数・指数（0 以下の対数は欠損）', 'log(反応時間)'], ['sqrt(x) / abs(x) / round(x, k)', '平方根・絶対値・四捨五入（k 桁。R と同じく 0.5 は偶数側へ）', 'round(平均, 2)']])}<p class="note">どれかの値が欠損の人は、結果も欠損になります（mean と sum は除いて計算）。z と center は、データ全体の平均・標準偏差を使います。</p></details></div>`;
  }
  if (sec === 'filter') {
    const F = d.filter, m = filterMask();
    h += `<div class="pp-box"><b>ケースの選択</b>（条件に合う人だけで分析する）
      <div class="pp-row"><label>条件のつなぎ方 <select id="ppFjoin"><option value="and" ${PREP.join !== 'or' ? 'selected' : ''}>すべてに当てはまる（かつ）</option><option value="or" ${PREP.join === 'or' ? 'selected' : ''}>どれかに当てはまる（または）</option></select></label></div>
      ${PREP.conds.map((c, k) => { const col = c.j >= 0 ? d.cols[c.j] : null, lv = col ? levelsOf(rawColBase(c.j)).slice(0, 80) : [];
        return `<div class="pp-row"><select data-pp-fv="${k}"><option value="-1">変数</option>${cols.map(x => `<option value="${x.j}" ${x.j === c.j ? 'selected' : ''}>${esc(x.c.name)}</option>`).join('')}</select>
        <select data-pp-fo="${k}">${Object.entries(OPL).map(([v, l]) => `<option value="${v}" ${c.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${c.op === 'na' || c.op === 'notna' ? '' : `<input data-pp-fval="${k}" list="ppfl${k}" value="${esc(c.v)}" style="width:9em" placeholder="値"><datalist id="ppfl${k}">${lv.map(v => `<option value="${esc(codeToLabel(col, v) !== v ? codeToLabel(col, v) : v)}">`).join('')}</datalist>`}
        <button class="btn" data-pp="fdel" data-k="${k}" style="padding:1px 8px">×</button></div>`; }).join('')}
      <div class="pp-row"><button class="btn" data-pp="fadd" style="padding:1px 8px">条件を追加</button></div>
      <div class="pp-row"><button class="btn primary" data-pp="filter">この条件で選ぶ</button>${m ? '<button class="btn" data-pp="unfilter">選択を解除</button>' : ''}<span class="hint">${m ? `いま：${esc(filterText())}（${m.filter(Boolean).length} / ${m.length} 人）` : 'いまは全員を分析に使っています'}</span></div>
      <p class="hint" style="margin:4px 0 0">選ばれていない人のデータは消えません。すべての分析で、その人の値を欠損として扱います（データシートでは薄く表示されます）。「選択を解除」でいつでも全員に戻せます。値ラベルのある変数は、ラベル（例：女性）でもコード（例：2）でも指定できます。</p></div>`;
  }
  const rc = d.recipe || [];
  h += `<details class="mcguide pp-recipe" ${rc.length ? 'open' : ''}><summary>加工の記録（R コード：${rc.length} 件）</summary>${rc.length ? rc.map((x, k) => `<div class="hint" style="margin-top:6px">${k + 1}. ${esc(x.t)}</div><pre>${esc(x.r)}</pre>`).join('') + `<div class="sheettools"><button class="btn" data-pp="rcopy">R コードをコピー</button><button class="btn" data-pp="rclear">記録を消す（データはそのまま）</button></div>` : '<p class="hint">まだ加工していません。</p>'}</details>`;
  return h;
}
function recipeR() { const rc = state.db.recipe || []; return `# 加工の記録 ── ブラウザ統計ラボで行ったデータの加工を、R で同じように行うコードです\n# （data.csv にはすでに加工後の列が入っているので、実行する必要はありません。手順の記録・再現用です）\n# d は加工前のデータ（例：d <- read.csv("元のデータ.csv")）\n\n` + rc.map((x, k) => `# ${k + 1}. ${x.t}\n${x.r}\n`).join('\n'); }

// ---- 操作 ----
$('#sheetBody').addEventListener('click', e => {
  if (state.fmt !== 'db') return; const sb = e.target.closest('[data-pp-sec]'); if (sb) { PREP.sec = sb.dataset.ppSec; PREP.msg = ''; renderSheet(); return; }
  const b = e.target.closest('[data-pp]'); if (!b) return; const a = b.dataset.pp, d = state.db;
  try {
    if (a === 'selall') { document.querySelectorAll('[data-pp-tr]').forEach(tr => { if (tr.style.display !== 'none') PREP.use.add(+tr.dataset.ppTr); }); renderSheet(); return; }
    if (a === 'selnone') { PREP.use.clear(); PREP.rev.clear(); renderSheet(); return; }
    if (a === 'score' || a === 'revcols' || a === 'fascore') {
      const agg = $('#ppAgg').value, miss = $('#ppMiss').value, lo = toNum($('#ppLo').value), hi = toNum($('#ppHi').value); PREP.agg = agg; PREP.miss = miss;
      if (a === 'fascore') { const L = FA_LAST_REL, made = [];
        L.rel.forEach((r, q) => { if (r.its.length < 2) return; const v = ppScoreVals(r.its, r.rev, L.lo, L.hi, agg, miss), nm = `第${q + 1}因子得点`; made.push(ppAddCol({ name: nm, label: `第${q + 1}因子（${r.its.map(j => d.cols[j].name).join('・')}）の${agg === 'sum' ? '合計' : '平均'}`, measure: 'scale' }, v, { t: `尺度得点：{NAME} ← 第${q + 1}因子の項目（${r.its.map(j => d.cols[j].name + (r.rev.includes(j) ? '［逆転］' : '')).join('・')}）の${agg === 'sum' ? '合計' : '平均'}（${MISS_L[miss]}）`, r: ppScoreR('{NAME}', r.its, r.rev, L.lo, L.hi, agg, miss) })); });
        ppRefresh(`下位尺度得点の列を作りました：${made.map(esc).join('・')}（データシートの右端）。`); return; }
      const use = [...PREP.use].filter(j => j < d.cols.length).sort((x, y) => x - y), rev = [...PREP.rev].filter(j => use.includes(j));
      need(isFinite(lo) && isFinite(hi), '逆転の最小値・最大値に数を入れてください。');
      if (a === 'revcols') { const rv = [...PREP.rev].filter(j => j < d.cols.length); need(rv.length, '「逆転」に印をつけた項目がありません。'); const made = rv.map(j => ppAddCol({ name: d.cols[j].name + '_r', label: `${d.cols[j].label || d.cols[j].name}（逆転）`, measure: d.cols[j].measure || '' }, numBase(j).map(x => isFinite(x) ? lo + hi - x : ''), { t: `逆転：{NAME} ← ${lo} ＋ ${hi} − ${d.cols[j].name}`, r: `d$${RQ('{NAME}')} <- ${lo + hi} - ${rN(j)}` }));
        ppRefresh(`逆転した列を作りました：${made.map(esc).join('・')}。`); return; }
      need(use.length >= 2, '「使う」に印をつけた項目が 2 つ以上必要です。');
      const name = ($('#ppName').value || '').trim() || '尺度得点', label = ($('#ppLabel').value || '').trim() || `${use.map(j => d.cols[j].name).join('・')}の${agg === 'sum' ? '合計' : '平均'}`;
      PREP.name = name; PREP.label = '';
      const v = ppScoreVals(use, rev, lo, hi, agg, miss), A = ppAlpha(use, rev, lo, hi);
      const nn = ppAddCol({ name, label, measure: 'scale' }, v, { t: `尺度得点：{NAME} ← ${use.map(j => d.cols[j].name + (rev.includes(j) ? '［逆転］' : '')).join('・')} の${agg === 'sum' ? '合計' : '平均'}（${MISS_L[miss]}）`, r: ppScoreR('{NAME}', use, rev, lo, hi, agg, miss) });
      const ok = v.filter(isFinite); ppRefresh(`列「${esc(nn)}」を作りました：${use.length} 項目（逆転 ${rev.length}）の${agg === 'sum' ? '合計' : '平均'}、計算できた人 ${ok.length} 人（平均 ${fmt(S.mean(ok), 2)}、SD ${fmt(S.sd(ok), 2)}）${A ? `、α = ${fmt(A.a, 3)}` : ''}。`); return; }
    if (a === 'rgadd') { PREP.rcRows = PREP.rcRows.map((rw, k) => [0, 1, 2, 3].map(q => document.querySelector(`[data-pp-rg="${k}-${q}"]`)?.value ?? rw[q])); PREP.rcRows.push(['', '', '', '']); renderSheet(); return; }
    if (a === 'recode') { ppRecode(); return; }
    if (a === 'qz' || a === 'qc' || a === 'qlog') { const j = +$('#ppQVar').value; need(j >= 0, '変数を選んでください。'); const nm = d.cols[j].name, ref = /[\s+\-*/^(),\[\]]/.test(nm) || /^\d/.test(nm) ? `[${nm}]` : nm;
      PREP.expr = { qz: `z(${ref})`, qc: `center(${ref})`, qlog: `log(${ref})` }[a]; PREP.exName = nm + { qz: '_z', qc: '_c', qlog: '_log' }[a]; PREP.exLabel = `${d.cols[j].label || nm}（${{ qz: 'z 得点', qc: '中心化', qlog: '自然対数' }[a]}）`; renderSheet(); return; }
    if (a === 'calc') { const src = $('#ppExpr').value.trim(); need(src, '計算式を入れてください。'); PREP.expr = src; PREP.exName = $('#ppExName').value; PREP.exLabel = $('#ppExLabel').value;
      const ast = exprParse(src), v = exprEval(ast, d.rows.length), name = (PREP.exName || '').trim() || '新しい変数';
      const nn = ppAddCol({ name, label: (PREP.exLabel || '').trim() || src, measure: 'scale' }, v, { t: `計算：{NAME} ← ${src}`, r: `d$${RQ('{NAME}')} <- ${exprR(ast)}` });
      const ok = v.filter(isFinite); ppRefresh(`列「${esc(nn)}」を作りました：計算できた人 ${ok.length} 人${ok.length ? `（平均 ${fmt(fz(S.mean(ok)), 3)}、SD ${fmt(ok.length > 1 ? S.sd(ok) : 0, 3)}）` : ''}${ok.length < v.length ? `、欠損 ${v.length - ok.length} 人` : ''}。`); return; }
    if (a === 'fadd') { PREP.conds.push({ j: -1, op: '=', v: '' }); renderSheet(); return; }
    if (a === 'fdel') { PREP.conds.splice(+b.dataset.k, 1); if (!PREP.conds.length) PREP.conds.push({ j: -1, op: '=', v: '' }); renderSheet(); return; }
    if (a === 'filter') { const cs = PREP.conds.filter(c => c.j >= 0 && (c.op === 'na' || c.op === 'notna' || String(c.v).trim() !== '')); need(cs.length, '変数と値を入れた条件が 1 つ以上必要です。');
      d.filter = { join: PREP.join === 'or' ? 'or' : 'and', conds: cs.map(c => ({ ...c })) }; FMASK = null; const m = filterMask(), k = m.filter(Boolean).length; need(k > 0, '条件に当てはまる人がいません。条件を見直してください。');
      const rc = c => { const col = d.cols[c.j], nm = rN(c.j), isCat = colType(c.j) === 'cat', val = String(c.v).trim(), lab = isCat ? (codeToLabel(col, val) !== val ? codeToLabel(col, val) : val) : val, vv = isCat || !isFinite(toNum(val)) ? RS(lab) : val;
        return c.op === 'na' ? `is.na(${nm})` : c.op === 'notna' ? `!is.na(${nm})` : `${nm} ${c.op === '=' ? '==' : c.op} ${vv}`; };
      d.recipe = d.recipe || []; d.recipe.push({ t: `ケースの選択：${filterText()}（${k} / ${m.length} 人）`, r: `d <- subset(d, ${d.filter.conds.map(rc).join(d.filter.join === 'or' ? ' | ' : ' & ')})` });
      ppRefresh(`ケースを選びました：${esc(filterText())} → ${k} / ${m.length} 人。これからの分析は、この ${k} 人で行います。`); return; }
    if (a === 'unfilter') { d.filter = null; FMASK = null; d.recipe = d.recipe || []; d.recipe.push({ t: 'ケースの選択を解除（全員に戻す）', r: '# d を選択前のデータに戻す' }); ppRefresh('ケースの選択を解除しました。全員を分析に使います。'); return; }
    if (a === 'rcopy') { const t = recipeR(); navigator.clipboard.writeText(t).then(() => { b.textContent = 'コピーしました'; }, () => { b.textContent = 'コピーできませんでした'; }); return; }
    if (a === 'rclear') { d.recipe = []; ppRefresh('加工の記録を消しました（データはそのままです）。'); return; }
  } catch (err) { PREP.msg = `<div class="pp-msg err">${esc(err.message)}</div>`; renderSheet(); }
});
$('#sheetBody').addEventListener('change', e => {
  if (state.fmt !== 'db') return; const el = e.target;
  if (el.dataset.ppUse != null) { const j = +el.dataset.ppUse; el.checked ? PREP.use.add(j) : (PREP.use.delete(j), PREP.rev.delete(j)); PREP.lo = PREP.hi = undefined; renderSheet(); return; }
  if (el.dataset.ppRev != null) { const j = +el.dataset.ppRev; if (el.checked) { PREP.rev.add(j); PREP.use.add(j); } else PREP.rev.delete(j); PREP.lo = PREP.hi = undefined; renderSheet(); return; }
  if (el.id === 'ppLo' || el.id === 'ppHi') { PREP[el.id === 'ppLo' ? 'lo' : 'hi'] = toNum(el.value); renderSheet(); return; }
  if (el.id === 'ppAgg') PREP.agg = el.value; if (el.id === 'ppMiss') PREP.miss = el.value; if (el.id === 'ppName') PREP.name = el.value; if (el.id === 'ppLabel') PREP.label = el.value;
  if (el.id === 'ppRcVar') { PREP.rcJ = +el.value; renderSheet(); return; }
  if (el.id === 'ppRcMode') { PREP.rcMode = el.value; renderSheet(); return; }
  if (el.id === 'ppExIns' && el.value !== '') { const nm = state.db.cols[+el.value].name, ref = /[\s+\-*/^(),\[\]]/.test(nm) || /^\d/.test(nm) ? `[${nm}]` : nm, ta = $('#ppExpr'), p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + ref + ta.value.slice(p); PREP.expr = ta.value; el.value = ''; ta.focus(); return; }
  if (el.id === 'ppFjoin') PREP.join = el.value;
  if (el.dataset.ppFv != null) { PREP.conds[+el.dataset.ppFv].j = +el.value; PREP.conds[+el.dataset.ppFv].v = ''; renderSheet(); return; }
  if (el.dataset.ppFo != null) { PREP.conds[+el.dataset.ppFo].op = el.value; renderSheet(); return; }
});
$('#sheetBody').addEventListener('input', e => {
  if (state.fmt !== 'db') return; const el = e.target;
  if (el.id === 'ppFilter') { PREP.filter = el.value; const f = el.value.trim().toLowerCase(); document.querySelectorAll('[data-pp-tr]').forEach(tr => { const c = state.db.cols[+tr.dataset.ppTr]; tr.style.display = !f || ((c.name || '') + ' ' + (c.label || '')).toLowerCase().includes(f) ? '' : 'none'; }); }
  if (el.dataset.ppFval != null) PREP.conds[+el.dataset.ppFval].v = el.value;
  if (el.id === 'ppExpr') PREP.expr = el.value; if (el.id === 'ppExName') PREP.exName = el.value; if (el.id === 'ppExLabel') PREP.exLabel = el.value;
});
