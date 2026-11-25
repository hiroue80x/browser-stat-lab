// ===== 共通のデータ（データベース型と同じデータ）から、独立多群型・関連多群型・2変量型・分割表型のシートを作る =====
// 1 つのファイルを読み込めば、どのタブでも「使う列を選ぶ」だけで解析できるようにする。
const PICK_FMTS = ['indep', 'paired', 'bivar', 'table'];
function pickState() { state.opt.pick = state.opt.pick || {}; return state.opt.pick; }
function pickHasData() { return state.db && state.db.rows.some(r => r.some(v => String(v ?? '').trim() !== '')); }
function pickColsOf(type) { return state.db.cols.map((c, j) => ({ j, name: c.name || `列${j + 1}`, t: colType(j) })).filter(c => !type || c.t === type); }
function pickLevels(j) { return levelsOf(dbCol(j)); }
function pickIdx(name, fallback) { const j = state.db.cols.findIndex(c => c.name === name); return j >= 0 ? j : fallback; }
function pickGroupCols() { // 群の候補：文字の列（2〜20 水準）と、1・2 のように水準の少ない数値の列（2〜6 水準）
  return pickColsOf().filter(c => { if (c.t === 'empty' || pickIsId(c.j)) return false; const k = pickLevels(c.j).length; return k >= 2 && k <= (c.t === 'cat' ? 20 : 6); });
}
function pickIsId(j) { // ID・番号の列（測定値の初期値にしない）
  const c = state.db.cols[j]; if (/^(id|no\.?|番号|参加者|対象者|協力者)/i.test(String(c.name || '').trim())) return true;
  const v = rawCol(j).filter(x => x !== '').map(toNum); return v.length > 5 && v.every((x, i) => i === 0 || x === v[i - 1] + 1);
}
// 選択の初期値：データベース型で決めた役割 → それがなければ先頭から
function pickDefaults() {
  const P = pickState(), R = state.db.roles || {}, num = pickColsOf('num').filter(c => !pickIsId(c.j)), grp = pickGroupCols(), cat = grp.filter(c => c.t === 'cat');
  const nm = j => j >= 0 && state.db.cols[j] ? state.db.cols[j].name : '';
  const isNum = j => num.some(c => c.j === j), isGrp = j => grp.some(c => c.j === j);
  const g0 = isGrp(R.a) ? R.a : (cat[0] || grp[0] || { j: -1 }).j;
  const y0 = isNum(R.y) && R.y !== g0 ? R.y : (num.find(c => c.j !== g0) || { j: -1 }).j;
  const rep = (R.rep || []).filter(isNum), fa = (R.fa || []).filter(isNum);
  const D = {
    indep: { y: nm(y0), g: nm(g0) },
    paired: { cols: (rep.length >= 2 ? rep : fa.length >= 2 ? fa : num.slice(0, Math.min(3, num.length)).map(c => c.j)).map(nm) },
    bivar: { x: nm((num[0] || { j: -1 }).j), y: nm((num[1] || { j: -1 }).j), more: [] },
    table: { r: nm(isGrp(R.a) ? R.a : (cat[0] || grp[0] || { j: -1 }).j), c: nm(isGrp(R.b) && R.b !== R.a ? R.b : (cat[1] || grp.find(c => c.j !== (cat[0] || grp[0] || {}).j) || { j: -1 }).j) }
  };
  PICK_FMTS.forEach(f => { if (!P[f]) P[f] = D[f]; });
  // 列の名前が変わった・別のファイルを読み込んだときは初期値に戻す
  const ok = n => n === '' || state.db.cols.some(c => c.name === n);
  if (![P.indep.y, P.indep.g].every(ok)) P.indep = D.indep;
  if (!P.paired.cols.every(ok)) P.paired = D.paired;
  if (![P.bivar.x, P.bivar.y, ...(P.bivar.more || []), ...(P.bivar.list || [])].every(ok)) P.bivar = D.bivar;
  if (![P.table.r, P.table.c].every(ok)) P.table = D.table;
  return P;
}
function pickSel(id, cols, val, blank) {
  return `<select id="${id}" data-pk="${id}">${blank ? `<option value="">${blank}</option>` : ''}${cols.map(c => `<option value="${esc(c.name)}" ${c.name === val ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
}
function pickDual(id, cols, boxes, getters, setter) { // 左の一覧から右の箱へ入れる形（corr.js の DL2）
  return `<div style="flex-basis:100%">${DL2.html(id, { items: cols.map(c => ({ key: c.name, name: c.name })), leftTitle: '読み込んだデータの数値の列', leftHeight: 170, boxes, get: k => getters[k]().slice(), set: (k, v) => { setter(k, v); save(); }, rerender: () => renderSheet() })}</div>`;
}
function pickChecks(key, cols, vals) {
  return `<span class="pkchecks">${cols.map(c => `<label><input type="checkbox" data-pkc="${key}" value="${esc(c.name)}" ${vals.includes(c.name) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</span>`;
}
function pickBox() {
  if (!PICK_FMTS.includes(state.fmt) || typeof state.db === 'undefined') return '';
  const has = pickHasData(), d = state.db, open = state.opt.pickOpen !== false;
  const file = d.file ? `「${esc(d.file)}」` : 'データベース型タブのデータ';
  const head = `<summary><b>ファイルから読み込む</b><span class="hint">（Excel・CSV・SPSS。1 行 ＝ 1 人の形のまま読み込み、どのタブでも使えます）</span></summary>`;
  const openBtn = `<button class="btn primary" data-pact="open">ファイルを開く（Excel・CSV・SPSS）</button><input type="file" id="pickFile" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.sav,.zsav,.xls" multiple hidden>`;
  if (!has) return `<details class="pickbox" ${open ? 'open' : ''}>${head}<div class="sheettools">${openBtn}</div></details>`;
  const P = pickDefaults(), num = pickColsOf('num'), grp = pickGroupCols(), fm = typeof filterMask === 'function' ? filterMask() : null;
  let form = '', note = '';
  if (state.fmt === 'indep') {
    form = `<label>測定値 ${pickSel('pk-y', num, P.indep.y)}</label><label>群を表す列 ${pickSel('pk-g', grp, P.indep.g)}</label>`;
    note = '測定値の列を、群ごとの列に分けて並べます。';
  } else if (state.fmt === 'paired') {
    form = pickDual('pkpaired', num, [{ key: 'cols', title: '条件・時点の列（入れた順に並べます）', empty: '2 つ以上入れてください', height: 130 }], { cols: () => P.paired.cols }, (k, v) => { P.paired.cols = v; });
    note = '箱に入れた列を、入れた順に、1 行 ＝ 1 人のまま並べます。';
  } else if (state.fmt === 'bivar') {
    if (!P.bivar.list) P.bivar.list = [P.bivar.x, P.bivar.y, ...(P.bivar.more || [])].filter(Boolean);
    form = pickDual('pkbivar', num, [{ key: 'list', title: '並べる列（1 番目が X、2 番目が Y）', empty: '2 つ以上入れてください', height: 130 }], { list: () => P.bivar.list }, (k, v) => { P.bivar.list = v; });
    note = '入れた順に並べます（単回帰・散布図は 1 番目が X、2 番目が Y）。相関係数で使う変数は、並べたあと解析パネルの箱で選べます。';
  } else {
    form = `<label>行 ${pickSel('pk-r', grp, P.table.r)}</label><label>列 ${pickSel('pk-c', grp, P.table.c)}</label>`;
    note = '2 つのカテゴリの列から、人数のクロス表を作ります。';
  }
  const lack = state.fmt === 'table' ? grp.length < 2 : state.fmt === 'indep' ? !num.length || !grp.length : num.length < 2;
  return `<details class="pickbox" ${open ? 'open' : ''}>${head}
    <div class="pkinfo">読み込んだデータ：${file}　${d.rows.length} 行 × ${d.cols.length} 変数　<button class="btn" data-pact="seedb">データベース型タブで見る</button>${openBtn}</div>
    ${fm ? `<div class="hint" style="color:var(--sig)">データベース型タブで「ケースの選択」をしています。選ばれた人だけを使います。</div>` : ''}
    ${lack ? `<div class="hint">このデータには、このタブで使える列が足りません（${state.fmt === 'table' ? 'カテゴリの列が 2 つ' : state.fmt === 'indep' ? '数値の列と、群を表す列' : '数値の列が 2 つ'}必要です）。</div>`
      : `<div class="pkform">${form}</div><div class="sheettools"><button class="btn primary" data-pact="apply">データシートに並べる</button><span class="hint">${note}並べたあとシートを書き換えても、読み込んだデータは変わりません。</span></div>`}
  </details>`;
}
// 選んだ列から、今のタブのシートを作る
function pickApply() {
  const P = pickDefaults(), J = n => state.db.cols.findIndex(c => c.name === n); let done = '';
  const say = t => { const m = $('#msg'); if (m) m.textContent = t; }, ok = t => { done = t; };
  const src = state.db.file ? `「${state.db.file}」の` : '';
  if (state.fmt === 'indep') {
    const y = J(P.indep.y), g = J(P.indep.g); if (y < 0 || g < 0) return say('測定値と群の列を選んでください。');
    if (y === g) return say('測定値と群には、別の列を選んでください。');
    const yv = rawCol(y), gv = dbCol(g), lv = levelsOf(gv), by = lv.map(L => yv.filter((v, i) => gv[i] === L && v !== '' && isFinite(toNum(v))));
    const n = Math.max(...by.map(b => b.length), 1);
    state.indep = { cols: lv.map(L => ({ name: String(L), on: true })), rows: Array.from({ length: n }, (_, i) => by.map(b => b[i] ?? '')) };
    ok(`${src}「${P.indep.y}」を「${P.indep.g}」で分けて並べました（${lv.map((L, k) => `${L} ${by[k].length} 人`).join('、')}）。解析パネルのボタンで、そのまま解析できます。`);
  } else if (state.fmt === 'paired' || state.fmt === 'bivar') {
    const names = state.fmt === 'paired' ? P.paired.cols.slice() : (P.bivar.list || [P.bivar.x, P.bivar.y]).slice();
    const js = names.map(J);
    if (js.length < 2 || js.some(j => j < 0)) return say(state.fmt === 'paired' ? '条件・時点の列を、右の箱に 2 つ以上入れてください。' : '並べる列を、右の箱に 2 つ以上入れてください。');
    if (new Set(js).size !== js.length) return say('同じ列が 2 回入っています。');
    const cols = js.map(rawCol), rows = state.db.rows.map((_, i) => cols.map(c => c[i])).filter(r => r.some(v => v !== ''));
    const full = rows.filter(r => r.every(v => v !== '' && isFinite(toNum(v)))).length;
    state[state.fmt] = { cols: names.map(nm => ({ name: nm, on: true })), rows: rows.length ? rows : [names.map(() => '')] };
    if (state.fmt === 'bivar') state.opt.cor = null; // 相関の箱は、並べた列で決め直す
    ok(`${src}${names.map(nm => `「${nm}」`).join('・')}を並べました（${rows.length} 人、すべてそろっている人 ${full} 人）。${state.fmt === 'paired' ? '空欄のある人は、解析のときに除かれます。' : ''}解析パネルのボタンで、そのまま解析できます。`);
  } else {
    const r = J(P.table.r), c = J(P.table.c); if (r < 0 || c < 0) return say('行と列にする変数を選んでください。');
    if (r === c) return say('行と列には、別の変数を選んでください。');
    const rv = dbCol(r), cv = dbCol(c), rl = levelsOf(rv), cl = levelsOf(cv);
    const cells = rl.map(a => cl.map(b => String(rv.filter((v, i) => v === a && cv[i] === b).length)));
    state.table = { rowNames: rl.map(String), colNames: cl.map(String), cells };
    const n = cells.flat().reduce((s, v) => s + +v, 0);
    ok(`${src}「${P.table.r}」×「${P.table.c}」のクロス表を作りました（${n} 人。どちらかが空欄の人は除いています）。`);
  }
  save(); renderSheet(); renderPanel(); say(done);
}
$('#sheetBody').addEventListener('click', e => {
  if (!PICK_FMTS.includes(state.fmt)) return;
  const sm = e.target.closest('details.pickbox > summary'); if (sm) { state.opt.pickOpen = !sm.parentElement.open; save(); return; }
  const b = e.target.closest('[data-pact]'); if (!b) return; const a = b.dataset.pact;
  if (a === 'open') $('#pickFile').click();
  if (a === 'apply') pickApply();
  if (a === 'seedb') { state.fmt = 'db'; state.opt.dbView = 'data'; save(); renderAll(); }
});
$('#sheetBody').addEventListener('change', e => {
  if (!PICK_FMTS.includes(state.fmt)) return; const el = e.target, P = pickState();
  if (el.id === 'pickFile') { if (el.files.length) importFiles([...el.files]); el.value = ''; return; }
  const k = el.dataset.pk;
  if (k) {
    if (k === 'pk-y') P.indep.y = el.value; if (k === 'pk-g') P.indep.g = el.value;
    if (k === 'pk-x' || k === 'pk-yy') { P.bivar[k === 'pk-x' ? 'x' : 'y'] = el.value; P.bivar.more = (P.bivar.more || []).filter(n => n !== P.bivar.x && n !== P.bivar.y); save(); renderSheet(); return; }
    if (k === 'pk-r') P.table.r = el.value; if (k === 'pk-c') P.table.c = el.value;
    save(); return;
  }
  if (el.dataset.pkc) {
    const vals = [...document.querySelectorAll(`[data-pkc="${el.dataset.pkc}"]:checked`)].map(x => x.value);
    if (el.dataset.pkc === 'paired') P.paired.cols = vals; else P.bivar.more = vals;
    save();
  }
});
// ファイルをシートに落としても読み込めるようにする
$('#sheetBody').addEventListener('dragover', e => { if (PICK_FMTS.includes(state.fmt) && [...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
$('#sheetBody').addEventListener('drop', e => { if (!PICK_FMTS.includes(state.fmt)) return; const fs = [...e.dataTransfer.files].filter(f => /\.(z?sav|xlsx|xlsm|xls|csv|tsv|txt)$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); importFiles(fs); });
