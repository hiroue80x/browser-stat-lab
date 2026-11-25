// ===== データベース型（1行＝1人、文字の列も可） =====
function makeDbSample() { // 例として入っている架空データ（介入研究の不安得点）
  const R = rng(20261117), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const rows = [];
  for (let i = 0; i < 32; i++) {
    const g = i < 16 ? '統制' : '介入', sex = i % 2 ? '女性' : '男性';
    const sleep = Math.round((6.4 + nrm() * 0.8) * 10) / 10, ex = Math.max(0, Math.round(2 + nrm() * 1.4));
    const pre = Math.round(50 + nrm() * 6 - (sleep - 6.4) * 2);
    const post = Math.round(pre - (g === '介入' ? 7 : 1.5) - (g === '介入' && sex === '女性' ? 4 : 0) - ex * 0.8 + nrm() * 3);
    const fu = Math.round(post + (g === '介入' ? 1 : 0.5) + nrm() * 2.5);
    rows.push([g, sex, pre, post, fu, sleep, ex].map(String));
  }
  return { cols: ['群', '性別', '事前', '事後', '追跡', '睡眠時間', '運動回数'].map(n => ({ name: n, on: true })), rows, roles: { y: 3, a: 0, b: 1, x: [2, 5, 6, 1], rep: [2, 3, 4], cov: [2] } };
}
function makeScaleSample() { // 例として入っている架空データ（12項目の心理尺度、n = 200）
  const R = rng(4242), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const names = ['対人1', '対人2', '対人3', '対人4', '評価1', '評価2', '評価3', '評価4', '身体1', '身体2', '身体3', '身体4'], cut = [-1.3, -0.45, 0.4, 1.25], rows = [];
  for (let i = 0; i < 200; i++) {
    const f1 = nrm(), f2 = 0.35 * f1 + Math.sqrt(1 - 0.35 ** 2) * nrm(), f3 = 0.2 * f1 + Math.sqrt(1 - 0.04) * nrm(), F = [f1, f2, f3];
    const lam = [.78, .74, .7, .6, .76, .72, .66, .55, .75, .7, .64, .5];
    const items = names.map((_, j) => { let z = lam[j] * F[Math.floor(j / 4)] + (j === 3 ? .3 * f2 : 0) + Math.sqrt(1 - lam[j] ** 2) * nrm(); if (j === 7) z = -z; /* 評価4 は逆転項目 */ return 1 + cut.filter(c => z > c).length; });
    if (i % 67 === 5) items[1] = 9; // 無回答（欠損値 9）の例
    rows.push([i % 2 ? '2' : '1', ...items].map(String));
  }
  const labs = ['初対面の人と話すのは苦手だ', '大勢の集まりでは落ち着かない', '知らない人に話しかけるのをためらう', '人と目を合わせるのがつらい', '人からどう思われているか気になる', '失敗して笑われるのが怖い', '人前で意見を言うと批判されそうだ', '人からの評価はあまり気にならない', '人前に出ると顔が赤くなる', '緊張すると手や声がふるえる', '人前で話すと心臓がどきどきする', '緊張すると汗をかく'];
  const lk = [['1', '全くあてはまらない'], ['2', 'あまりあてはまらない'], ['3', 'どちらともいえない'], ['4', 'ややあてはまる'], ['5', 'とてもあてはまる']];
  return { cols: [{ name: '性別', on: true, measure: 'nominal', values: [['1', '男性'], ['2', '女性']], missing: '9' }, ...names.map((n, j) => ({ name: n, on: true, label: labs[j], measure: 'ordinal', values: lk.map(v => [...v]), missing: '9' }))], rows, roles: { y: 1, a: 0, b: -1, x: [], rep: [], fa: names.map((_, j) => j + 1) } };
}
function makeBinSample() { // 例として入っている架空データ（大学生の抑うつ傾向、n = 300）
  const R = rng(777), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [];
  for (let i = 0; i < 300; i++) {
    const age = 18 + Math.floor(R() * 5), sex = R() < .55 ? '女性' : '男性', sleep = Math.round((6.3 + nrm() * .9) * 10) / 10, stress = Math.round(20 + nrm() * 6), ex = Math.max(0, Math.round(2 + nrm() * 1.5)), sup = R() < .7 ? 'いる' : 'いない';
    const eta = -1.2 + 0.16 * (stress - 20) - 0.55 * (sleep - 6.3) - 0.25 * (ex - 2) + (sup === 'いない' ? 1.0 : 0) + (sex === '女性' ? .3 : 0);
    rows.push([R() < 1 / (1 + Math.exp(-eta)) ? 'あり' : 'なし', age, sex, sleep, stress, ex, sup].map(String));
  }
  return { cols: ['抑うつ', '年齢', '性別', '睡眠時間', 'ストレス', '運動回数', '相談相手'].map(n => ({ name: n, on: true })), rows, roles: { y: 4, a: 2, b: -1, x: [1, 2, 3, 4, 5, 6], rep: [], fa: [], bin: 0, event: 'あり' } };
}
function makeSurvSample() { // 例として入っている架空データ（うつ病治療後の再発までの週数、n = 120）
  const R = rng(2468), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [], tx = ['認知行動療法', '薬物療法', '併用療法'];
  for (let i = 0; i < 120; i++) {
    const g = tx[i % 3], age = Math.round(35 + nrm() * 10), sex = R() < .6 ? '女性' : '男性', sev = Math.round(20 + nrm() * 5);
    const rate = 0.018 * { 認知行動療法: 1, 薬物療法: 1.5, 併用療法: .55 }[g] * Math.exp(0.06 * (sev - 20));
    const t = Math.max(1, Math.ceil(-Math.log(R() || 1e-9) / rate)), c = R() < .2 ? Math.max(1, Math.ceil(R() * 52)) : 52, ev = t <= c;
    rows.push([g, age, sex, sev, Math.min(t, c), ev ? 'あり' : 'なし'].map(String));
  }
  return { cols: ['治療法', '年齢', '性別', '重症度', '週', '再発'].map(n => ({ name: n, on: true })), rows, roles: { y: 3, a: 0, b: -1, x: [0, 1, 2, 3], rep: [], fa: [], bin: -1, event: '', time: 4, st: 5, stev: 'あり' } };
}
function makeMissSample() { // 例として入っている架空データ（欠測のある調査、n = 200。ストレスが高い人ほど抑うつ尺度に無回答が多い＝MAR）
  const R = rng(8642), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [];
  for (let i = 0; i < 200; i++) {
    const sex = R() < .55 ? '女性' : '男性', st = nrm(), sl = -.3 * st + Math.sqrt(.91) * nrm(), se = -.35 * st + Math.sqrt(.88) * nrm();
    const dep = .45 * st - .2 * sl - .3 * se + (sex === '女性' ? .2 : 0) + .75 * nrm();
    const r1 = v => Math.round(v * 10) / 10;
    let D = String(r1(20 + 6 * dep)), SL = String(r1(6.5 + .9 * sl)), SE = String(Math.round(30 + 5 * se));
    if (R() < 1 / (1 + Math.exp(-(-1.6 + 1.4 * st)))) D = '';
    if (R() < .12) SL = ''; if (R() < .08) SE = '';
    rows.push([String(i + 1), sex, String(r1(20 + 5 * st)), SL, SE, D]);
  }
  return { cols: ['ID', '性別', 'ストレス', '睡眠時間', '自尊感情', '抑うつ'].map(n => ({ name: n, on: true })), rows, roles: { y: 5, a: 1, b: -1, x: [2, 3, 4, 1], rep: [], fa: [], bin: -1, event: '', roc: [], cov: [], time: -1, st: -1, stev: '' } };
}
function makeRocSample() { // 例として入っている架空データ（うつ病スクリーニング検査、n = 160）
  const R = rng(1357), nrm = () => { const u = R() || 1e-9, v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }, rows = [];
  for (let i = 0; i < 160; i++) {
    const dx = R() < .3, sex = R() < .6 ? '女性' : '男性', age = Math.round(30 + nrm() * 9);
    const a = Math.max(0, Math.min(27, Math.round(dx ? 13 + nrm() * 5 : 5.5 + nrm() * 4))), b = Math.max(0, Math.min(12, Math.round(dx ? 6 + nrm() * 2.6 : 3.6 + nrm() * 2.4))), se = Math.max(10, Math.min(40, Math.round(dx ? 22 + nrm() * 5 : 28 + nrm() * 5)));
    rows.push([dx ? 'うつ病' : '非うつ病', sex, age, a, b, se].map(String));
  }
  return { cols: ['診断', '性別', '年齢', '抑うつ尺度', '短縮版', '自尊感情'].map(n => ({ name: n, on: true })), rows, roles: { y: 3, a: 1, b: -1, x: [3, 4, 5], rep: [], fa: [], bin: 0, event: 'うつ病', roc: [3, 4, 5], time: -1, st: -1, stev: '' } };
}
if (!state.db) state.db = makeDbSample();
if (state.db.roles.time == null) { state.db.roles.time = -1; state.db.roles.st = -1; state.db.roles.stev = ''; }
if (state.opt.survCI == null) state.opt.survCI = true; state.opt.survY = state.opt.survY || 'surv';
if (state.db.roles.bin == null) state.db.roles.bin = -1;
state.opt.orUnit = state.opt.orUnit || 'unit'; state.opt.crit = state.opt.crit || 'aic';
state.db.roles.fa = state.db.roles.fa || []; state.db.roles.roc = state.db.roles.roc || []; state.db.roles.cov = state.db.roles.cov || [];
state.opt.dbTab = state.opt.dbTab || 'basic'; state.opt.rocDir = state.opt.rocDir || 'auto'; state.opt.rocCut = state.opt.rocCut || 'youden';
state.opt.nf = state.opt.nf || 'auto'; if (state.opt.knorm == null) state.opt.knorm = true; state.opt.ext = state.opt.ext || 'ml'; state.opt.rot = state.opt.rot || 'promax';
state.opt.err = state.opt.err || 'ci'; if (state.opt.raw == null) state.opt.raw = true; state.opt.method = state.opt.method || 'enter'; state.opt.param = state.opt.param || 'param';

// ----- 変数の定義（SPSS の変数ビューと同じ：名前・ラベル・値ラベル・尺度・欠損値） -----
function missSet(c) { return String(c.missing || '').replace(/\s*~\s*/g, '~').split(/[,、，\s]+/).map(x => x.trim()).filter(Boolean); }
function isMiss(c, v, ms) { // 「9, 99」のような個別の値と「90~99」「LO~0」のような範囲
  if (v === '' || !ms.length) return false; const n = toNum(v);
  return ms.some(m => { const r = m.split('~'); if (r.length === 2 && isFinite(n)) { const lo = /^lo/i.test(r[0].trim()) ? -Infinity : toNum(r[0]), hi = /^hi/i.test(r[1].trim()) ? Infinity : toNum(r[1]); return n >= lo && n <= hi; } return m === v || (isFinite(n) && toNum(m) === n); });
}
function rawCol(j) { const v = rawColBase(j), m = typeof filterMask === 'function' ? filterMask() : null; return m ? v.map((x, i) => m[i] ? x : '') : v; } // ケースの選択中は、選ばれていない人を欠損に
function rawColBase(j) { const c = state.db.cols[j], ms = missSet(c); return state.db.rows.map(r => { const v = String(r[j] ?? '').trim(); return isMiss(c, v, ms) ? '' : v; }); }
function autoType(v) { v = v.filter(x => x !== ''); if (!v.length) return 'empty'; return v.every(x => !isNaN(toNum(x))) ? 'num' : 'cat'; }
function colType(j) { const t = autoType(rawCol(j)), m = state.db.cols[j].measure; if (t === 'empty') return t; return m === 'nominal' ? 'cat' : t; }
const LABEL_RANK = {};
function vlMap(c) { const mp = {}; (c.values || []).forEach(([k, l], i) => { if (String(k).trim() !== '' && String(l).trim() !== '') { const key = String(k).trim(); mp[key] = String(l).trim(); LABEL_RANK[mp[key]] = isFinite(toNum(key)) ? toNum(key) : 1e6 + i; } }); return mp; }
function codeToLabel(c, v) { if (v === '') return v; const mp = vlMap(c); if (mp[v] != null) return mp[v]; const n = toNum(v); if (isFinite(n)) { const k = Object.keys(mp).find(x => toNum(x) === n); if (k != null) return mp[k]; } return v; }
function dbCol(j) { // 解析が読むのはここだけ：欠損値は空欄に、名義（カテゴリ）の列は値ラベルに置き換える
  const raw = rawCol(j), c = state.db.cols[j]; if (!(c.values || []).length || colType(j) !== 'cat') return raw; return raw.map(v => codeToLabel(c, v));
}
function levelsOf(vals) { const u = S.uniq(vals.filter(v => v !== '')); if (u.every(v => LABEL_RANK[v] != null)) return u.sort((a, b) => LABEL_RANK[a] - LABEL_RANK[b]); return u.every(v => !isNaN(toNum(v))) ? u.sort((a, b) => toNum(a) - toNum(b)) : u; }
function vn(j) { // 出力に出す変数名
  const c = state.db.cols[j], name = c.name || `列${j + 1}`, lab = (c.label || '').trim(), mode = state.opt.vlab || 'label';
  return !lab || mode === 'name' ? name : mode === 'label' ? lab : `${name}（${lab}）`;
}


function cleanRoles() {
  const d = state.db, n = d.cols.length, R = d.roles;
  ['y', 'a', 'b', 'bin', 'time', 'st'].forEach(k => { if (R[k] >= n) R[k] = -1; });
  R.x = R.x.filter(j => j < n); R.rep = R.rep.filter(j => j < n); R.fa = (R.fa || []).filter(j => j < n); R.cl = (R.cl || []).filter(j => j < n); R.ag = (R.ag || []).filter(j => j < n); R.roc = (R.roc || []).filter(j => j < n); R.cov = (R.cov || []).filter(j => j < n);
}

// ----- データシートと自動グラフ -----
let vvOpen = -1;
function renderDbSheet(f) {
  const d = state.db, view = state.opt.dbView || 'data', showVL = !!state.opt.showVL;
  const tabs = `<div class="viewtabs" role="tablist"><button role="tab" data-view="data" aria-selected="${view === 'data'}">データビュー</button><button role="tab" data-view="var" aria-selected="${view === 'var'}">変数ビュー</button><button role="tab" data-view="prep" aria-selected="${view === 'prep'}">データの加工</button>
    <span style="flex:1"></span><label class="hint">出力の変数名 <select id="oVlab"><option value="label">ラベル（なければ名前）</option><option value="name">名前</option><option value="both">名前（ラベル）</option></select></label></div>`;
  const tools = `<div class="sheettools">
      <button class="btn primary" data-vact="opensav">ファイルを開く（Excel・CSV・SPSS）</button><input type="file" id="savFile" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.sav,.zsav,.xls" multiple hidden>
      <button class="btn" data-vact="opencb" title="今のデータに、別のファイルのラベル表（変数ラベル・値ラベル・尺度・欠損値）を設定します">ラベル表を読み込む</button><input type="file" id="cbFile" accept=".xlsx,.xlsm,.csv,.tsv,.txt" multiple hidden>
      <button class="btn" data-vact="cbxlsx" title="データ（1 枚目）とラベル表（2 枚目）を Excel に書き出します">ラベル表のひな形を書き出す（Excel）</button><button class="btn" data-vact="cbcsv" title="ラベル表だけを CSV に書き出します">（CSV）</button>
      <button class="btn" data-act="addrow">行を追加</button><button class="btn" data-act="addcol">列を追加</button>
      <button class="btn" data-act="delcol">右端の列を削除</button><button class="btn" data-act="clear">空にする</button>
      <button class="btn" data-act="sample">例のデータに戻す</button><button class="btn" data-act="scale">例：尺度データ（因子分析用）</button><button class="btn" data-act="binsample">例：2値データ（ロジスティック用）</button><button class="btn" data-act="rocsample">例：検査データ（ROC分析用）</button><button class="btn" data-act="survsample">例：生存時間データ</button><button class="btn" data-act="semsample">例：SEM データ</button><button class="btn" data-act="misssample">例：欠測のあるデータ（最尤法用）</button><button class="btn" data-act="medsample">例：媒介・調整データ</button><button class="btn" data-act="glmsample">例：線形モデルの解説用データ</button><button class="btn" data-act="clsample">例：クラスター分析用データ</button><button class="btn" data-act="agsample">例：評定者間一致のデータ</button>
    </div>${rlinkBox()}${cbHelp()}`;
  if (view === 'prep') { $('#sheetBody').innerHTML = tabs + filterBanner() + renderPrepView() + tools; $('#oVlab').value = state.opt.vlab || 'label'; return; }
  if (view === 'var') { $('#sheetBody').innerHTML = tabs + filterBanner() + renderVarView() + tools; $('#oVlab').value = state.opt.vlab || 'label'; return; }
  const head = '<tr><th class="rn">#</th>' + d.cols.map((c, j) => `<th title="${esc(c.label || '')}"><div class="colhd"><span class="tbadge ${colType(j)}">${{ num: '数', cat: '類', empty: '−' }[colType(j)]}</span><input class="name" id="nm-${j}" data-nm="${j}" value="${esc(c.name)}"></div></th>`).join('') + '</tr>';
  const disp = d.cols.map((c, j) => showVL && (c.values || []).length ? v => codeToLabel(c, String(v ?? '').trim()) : null), ms = d.cols.map(c => missSet(c));
  const fm = filterMask(), body = d.rows.map((r, i) => `<tr${fm && !fm[i] ? ' class="fout"' : ''}><td class="rn">${i + 1}</td>` + d.cols.map((c, j) => { const v = r[j] ?? '', miss = isMiss(c, String(v).trim(), ms[j]); return `<td><input class="cell${miss ? ' miss' : ''}" id="c-${i}-${j}" data-r="${i}" data-c="${j}" value="${esc(disp[j] ? disp[j](v) : v)}" ${disp[j] ? `readonly title="値 ${esc(v)}"` : ''}></td>`; }).join('') + '</tr>').join('');
  $('#sheetBody').innerHTML = tabs + filterBanner() + `<p class="hint" style="margin-bottom:8px">${f.desc} 変数ビューで、ラベル（項目内容）・値ラベル（1＝男性 など）・欠損値を決められます。</p>
    <div class="sheetwrap" style="max-height:44vh"><table class="sheet" id="grid"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    <div class="sheettools"><label class="hint"><input type="checkbox" id="oShowVL" ${showVL ? 'checked' : ''}> 値ラベルを表示（表示中はセルを編集できません）</label></div>` + tools + `
    <h4 class="autoh">自動グラフ <span>入力するとその場で描き直します（数＝数値の列、類＝カテゴリの列）</span></h4>
    <div class="auto" id="autoG"></div>`;
  $('#oVlab').value = state.opt.vlab || 'label';
  renderAutoGraphs();
}
function importNotice(html, kind) { // 画面内のお知らせ（アーティファクト内では alert/confirm が出ないことがあるため）
  document.getElementById('importAsk')?.remove();
  $('#sheetBody').insertAdjacentHTML('afterbegin', `<div class="vvbox" id="importAsk" style="border-left:4px solid var(${kind === 'err' ? '--sig' : '--accent'});margin-bottom:10px">${html}</div>`);
  const box = document.getElementById('importAsk'); box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return box;
}
function importError(msg) { const box = importNotice(`<b>読み込めませんでした</b><div style="margin-top:4px">${esc(msg)}</div><div class="sheettools" style="margin-top:8px"><button class="btn" data-ia="close">閉じる</button></div>`, 'err'); box.addEventListener('click', e => { if (e.target.closest('[data-ia]')) box.remove(); }); $('#msg').textContent = '読み込めませんでした：' + msg; }
function confirmReplace(file) {
  const has = state.db.rows.some(r => r.some(v => String(v ?? '').trim() !== ''));
  if (!has) return Promise.resolve(true);
  return new Promise(res => {
    const box = importNotice(`<b>「${esc(file.name)}」を読み込みますか？</b><div style="margin-top:4px">${state.fmt === 'db' ? '今のデータシートの内容' : 'データベース型タブのデータ（どのタブでも使う、読み込んだデータ）'}は、このファイルの内容に置き換わります（元のデータが必要なら、先に Excel などにコピーしておいてください）。</div><div class="sheettools" style="margin-top:8px"><button class="btn primary" data-ia="ok">読み込む</button><button class="btn" data-ia="no">やめる</button></div>`);
    box.addEventListener('click', e => { const b = e.target.closest('[data-ia]'); if (!b) return; box.remove(); if (b.dataset.ia === 'no') $('#msg').textContent = '読み込みをやめました。'; res(b.dataset.ia === 'ok'); });
    $('#msg').textContent = `「${file.name}」：データシートの上の「読み込む」を押すと読み込みます。`;
  });
}
async function importFile(file) {
  const ext = (file.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  if (ext === 'sav' || ext === 'zsav') return importSav(file);
  if (ext === 'xls') { importError('古い Excel 形式（.xls）は読めません。Excel で開いて「名前を付けて保存」から「Excel ブック（.xlsx）」で保存し直してください。'); return; }
  if (!(await confirmReplace(file))) return;
  try {
    const buf = await file.arrayBuffer(), sheets = (ext === 'csv' || ext === 'tsv' || ext === 'txt' ? readCsv(buf) : await readXlsx(buf)).filter(s => s.rows.length);
    if (!sheets.length) throw new Error('データの入ったシートがありません。');
    if (sheets.length === 1) return loadTable(sheets[0], file.name);
    $('#sheetBody').innerHTML = `<div class="vvbox"><b>「${esc(file.name)}」にはデータの入ったシートが ${sheets.length} 枚あります。読み込むシートを選んでください。</b><div class="sheettools" style="margin-top:8px">${sheets.map((s, i) => `<button class="btn" data-pick="${i}">${esc(s.name)}（${s.rows.length} 行 × ${s.rows[0].length} 列）</button>`).join('')}<button class="btn" data-pick="-1">やめる</button></div></div>`;
    pendingSheets = { sheets, name: file.name };
  } catch (err) { importError(err.message); }
}
let pendingSheets = null;
$('#sheetBody').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b || !pendingSheets) return; const k = +b.dataset.pick, P = pendingSheets; pendingSheets = null; if (k < 0) { renderSheet(); return; } loadTable(P.sheets[k], P.sheets[k].file || P.name); if (P.cb && P.cb.length) cbApplyAndReport(P.cb, P.src, true); });
function setDb(cols, rows) {
  const firstNum = cols.findIndex((c, j) => c.measure !== 'nominal' && rows.some(row => row[j] !== '' && isFinite(toNum(row[j]))));
  state.db = { cols, rows: rows.length ? rows : [cols.map(() => '')], roles: { y: Math.max(0, firstNum), a: -1, b: -1, x: [], rep: [], fa: [], bin: -1, event: '', roc: [], cov: [], time: -1, st: -1, stev: '' }, semModel: emptySemModel() };
  if (state.opt.pick) delete state.opt.pick; // 列の選び方（他のタブ）は、新しいデータで決め直す
  vvOpen = -1; save(); let stored = true; try { localStorage.setItem('statlab-v1', JSON.stringify(state)); } catch (e) { stored = false; } return stored;
}
function loadTable(sheet, fname) {
  const T = rowsToDb(sheet.rows); state.opt.dbView = 'data'; const stored = setDb(T.cols, T.rows); state.db.file = fname; save(); renderSheet(); renderPanel();
  const nCat = T.cols.filter((_, j) => colType(j) === 'cat').length;
  $('#msg').textContent = `「${fname}」${sheet.name !== 'CSV' ? `の「${sheet.name}」シート` : ''}を読み込みました：${T.rows.length}行 × ${T.cols.length}変数${T.header ? '（1行目を変数名として使いました）' : '（1行目が数値だったので、変数名は「変数1…」としました）'}。数値の列 ${T.cols.length - nCat}・文字の列 ${nCat}。${state.fmt === 'db' ? '変数ビューでラベルや値ラベルを付けられます。' : 'データシートの上で使う列を選び、「データシートに並べる」を押してください。'}${stored ? '' : 'データが大きいため、ブラウザを閉じると消えます。元のファイルは残しておいてください。'}`;
}
async function importSav(file) {
  if (!(await confirmReplace(file))) return;
  try {
    const r = await readSav(await file.arrayBuffer()); if (!r.cols.length) throw new Error('変数が1つもありません。');
    state.opt.dbView = state.fmt === 'db' ? 'var' : state.opt.dbView; const stored = setDb(r.cols, r.rows); state.db.file = file.name; save(); renderSheet(); renderPanel();
    const nl = r.cols.filter(c => c.label).length, nv = r.cols.filter(c => c.values.length).length, nm = r.cols.filter(c => c.missing).length;
    $('#msg').textContent = `「${file.name}」を読み込みました：${r.nCases}人 × ${r.cols.length}変数（ラベル ${nl}・値ラベル ${nv}・欠損値の指定 ${nm} 変数、文字コード ${r.encoding}、${r.compression}）。${stored ? '' : 'データが大きいため、ブラウザを閉じると消えます。元の .sav ファイルは残しておいてください。'}`;
  } catch (err) { importError(err.message); }
}
$('#sheetBody').addEventListener('dragover', e => { if (state.fmt === 'db' && [...(e.dataTransfer.items || [])].some(i => i.kind === 'file')) e.preventDefault(); });
$('#sheetBody').addEventListener('drop', e => { if (state.fmt !== 'db') return; const fs = [...e.dataTransfer.files].filter(f => /\.(z?sav|xlsx|xlsm|xls|csv|tsv|txt)$/i.test(f.name)); if (!fs.length) return; e.preventDefault(); importFiles(fs); });
const MEASURES = [['', '自動'], ['scale', 'スケール'], ['ordinal', '順序'], ['nominal', '名義']];
function renderVarView() {
  const d = state.db;
  const rows = d.cols.map((c, j) => {
    const vals = c.values || [], sum = vals.filter(v => String(v[0]).trim() !== '').map(v => `${esc(v[0])}＝${esc(v[1])}`).join('、'), raw = rawCol(j), nValid = raw.filter(v => v !== '').length, t = colType(j);
    let h = `<tr><td class="rn">${j + 1}</td><td><input class="name" data-vn="${j}" value="${esc(c.name)}"></td>
      <td><input class="vlab" data-vl="${j}" value="${esc(c.label || '')}" placeholder="例：人前で話すと緊張する"></td>
      <td><select data-vm="${j}">${MEASURES.map(([v, l]) => `<option value="${v}" ${(c.measure || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td class="vsum"><button class="btn" data-vact="edit" data-j="${j}">${vals.length ? '編集' : '設定'}</button> <span>${sum || '<span class="hint">なし</span>'}</span></td>
      <td><input class="vmiss" data-vmiss="${j}" value="${esc(c.missing || '')}" placeholder="例：99"></td>
      <td><span class="tbadge ${t}">${{ num: '数', cat: '類', empty: '−' }[t]}</span></td><td class="total">${nValid}</td></tr>`;
    if (vvOpen === j) {
      const lv = levelsOf(raw).slice(0, 40);
      h += `<tr class="vvedit"><td></td><td colspan="7"><div class="vvbox"><b>値ラベル：${esc(c.name)}</b>
        <table class="out"><thead><tr><th>値</th><th>ラベル</th><th></th></tr></thead><tbody>${(vals.length ? vals : [['', '']]).map((v, k) => `<tr><td><input class="vcode" data-vcode="${k}" value="${esc(v[0])}"></td><td><input class="vlab" data-vlab="${k}" value="${esc(v[1])}" placeholder="例：男性"></td><td><button class="btn" data-vact="delrow" data-k="${k}">削除</button></td></tr>`).join('')}</tbody></table>
        <div class="sheettools"><button class="btn" data-vact="addrow">行を追加</button><button class="btn" data-vact="fromdata" ${lv.length ? '' : 'disabled'}>データにある値（${lv.length}種類）を並べる</button>
        <button class="btn" data-vact="likert5">5件法のラベルを入れる</button><button class="btn" data-vact="close">閉じる</button></div>
        <p class="hint">値ラベルは、尺度が「名義」の変数では群の名前として結果やグラフに出ます。「スケール」「順序」の変数は数値のまま計算します（5件法の項目など）。</p></div></td></tr>`;
    }
    return h;
  }).join('');
  return `<p class="hint" style="margin:6px 0 8px">1行が1つの変数です。<b>名前</b>は短い項目名、<b>ラベル</b>は項目内容、<b>値ラベル</b>は数値の意味（1＝男性、2＝女性 など）、<b>欠損値</b>は「無回答」として除外する値です（複数あれば「9, 99」のように区切ります）。</p>
    <div class="sheetwrap" style="max-height:52vh"><table class="sheet vview"><thead><tr><th class="rn">#</th><th>名前</th><th>ラベル（項目内容）</th><th>尺度</th><th>値ラベル</th><th>欠損値</th><th>型</th><th>有効 N</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint" style="margin-top:6px">尺度「自動」は、文字が入っていれば名義、数値だけならスケールとして扱います。1・2 で入力した性別などは「名義」にすると群として扱えます。</p>`;
}
function varViewRefresh(full) { save(); if (full) renderSheet(); renderDbPanel(true); }
$('#sheetBody').addEventListener('click', e => {
  if (state.fmt !== 'db') return;
  const vt = e.target.closest('[data-view]'); if (vt) { state.opt.dbView = vt.dataset.view; vvOpen = -1; save(); renderSheet(); return; }
  const b = e.target.closest('[data-vact]'); if (!b) return; const act = b.dataset.vact;
  if (act === 'opensav') { $('#savFile').click(); return; }
  if (act === 'opencb') { $('#cbFile').click(); return; }
  if (act === 'rlink') { rlinkExport(e.target.closest('button')); return; }
  if (act === 'rdir') { rlinkPick(); return; }
  if (act === 'cbxlsx' || act === 'cbcsv') { exportCodebook(act === 'cbxlsx' ? 'xlsx' : 'csv', e.target.closest('button')); return; }
  if (act === 'edit') { const j = +b.dataset.j; vvOpen = vvOpen === j ? -1 : j; renderSheet(); return; }
  const c = state.db.cols[vvOpen]; if (!c) return; c.values = c.values || [];
  if (act === 'addrow') c.values.push(['', '']);
  if (act === 'delrow') c.values.splice(+b.dataset.k, 1);
  if (act === 'fromdata') { const have = new Set(c.values.map(v => String(v[0]).trim())); levelsOf(rawCol(vvOpen)).slice(0, 40).forEach(v => { if (!have.has(v)) c.values.push([v, '']); }); c.values = c.values.filter(v => String(v[0]).trim() !== '' || String(v[1]).trim() !== ''); }
  if (act === 'likert5') { c.values = [['1', '全くあてはまらない'], ['2', 'あまりあてはまらない'], ['3', 'どちらともいえない'], ['4', 'ややあてはまる'], ['5', 'とてもあてはまる']]; if (!c.measure) c.measure = 'ordinal'; }
  if (act === 'close') { c.values = c.values.filter(v => String(v[0]).trim() !== ''); vvOpen = -1; }
  varViewRefresh(true);
});
$('#sheetBody').addEventListener('input', e => {
  if (state.fmt !== 'db') return; const el = e.target, d = state.db;
  if (el.dataset.vn != null) { d.cols[+el.dataset.vn].name = el.value; save(); }
  if (el.dataset.vl != null) { d.cols[+el.dataset.vl].label = el.value; save(); }
  if (el.dataset.vmiss != null) { d.cols[+el.dataset.vmiss].missing = el.value; save(); }
  if (el.dataset.vcode != null || el.dataset.vlab != null) { const c = d.cols[vvOpen], k = +(el.dataset.vcode ?? el.dataset.vlab); c.values = c.values || []; while (c.values.length <= k) c.values.push(['', '']); c.values[k][el.dataset.vcode != null ? 0 : 1] = el.value; save(); }
});
$('#sheetBody').addEventListener('change', e => {
  if (state.fmt !== 'db') return; const el = e.target;
  if (el.id === 'savFile') { if (el.files.length) importFiles([...el.files]); el.value = ''; return; }
  if (el.id === 'cbFile') { if (el.files.length) importCodebookFiles([...el.files]); el.value = ''; return; }
  if (el.id === 'oVlab') { state.opt.vlab = el.value; save(); return; }
  if (el.id === 'oShowVL') { state.opt.showVL = el.checked; save(); renderSheet(); return; }
  if (el.dataset.vm != null) { state.db.cols[+el.dataset.vm].measure = el.value; varViewRefresh(true); return; }
  if (el.dataset.vmiss != null || el.dataset.vn != null || el.dataset.vl != null) { varViewRefresh(true); return; }
  if (el.dataset.vcode != null || el.dataset.vlab != null) varViewRefresh(false);
});
let autoTimer = 0;
function dbChanged() { clearTimeout(autoTimer); autoTimer = setTimeout(() => { renderAutoGraphs(); document.querySelectorAll('#grid .tbadge').forEach((b, j) => { const t = colType(j); b.className = 'tbadge ' + t; b.textContent = { num: '数', cat: '類', empty: '−' }[t]; }); renderDbPanel(true); }, 350); }
function renderAutoGraphs() {
  const box = $('#autoG'); if (!box) return;
  box.innerHTML = state.db.cols.map((c, j) => {
    const t = colType(j), W = 170, H = 74;
    let s = `<svg class="mini" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.name)}">`;
    if (t === 'num') {
      const v = dbCol(j).map(toNum).filter(isFinite), xt = niceTicks(Math.min(...v), Math.max(...v), 6), k = xt.length - 1;
      const bins = Array.from({ length: k }, (_, i) => v.filter(x => x >= xt[i] && (i === k - 1 ? x <= xt[i + 1] : x < xt[i + 1])).length), mx = Math.max(...bins, 1);
      const bw = (W - 8) / k; bins.forEach((b, i) => s += `<rect x="${4 + i * bw + .5}" y="${H - 16 - b / mx * (H - 30)}" width="${bw - 1}" height="${b / mx * (H - 30)}" fill="var(--g1)" fill-opacity=".6"/>`);
      s += `<line x1="4" x2="${W - 4}" y1="${H - 16}" y2="${H - 16}" stroke="var(--line)"/><text x="4" y="${H - 4}">${+xt[0].toPrecision(5)}</text><text x="${W - 4}" y="${H - 4}" text-anchor="end">${+xt[k].toPrecision(5)}</text>`;
      s += `<text x="${W - 4}" y="10" text-anchor="end">n=${v.length} M=${fmt(S.mean(v), 1)}</text>`;
    } else if (t === 'cat') {
      const v = dbCol(j).filter(x => x !== ''), lv = levelsOf(v); let x = 4;
      lv.forEach((l, i) => { const w = v.filter(y => y === l).length / v.length * (W - 8); s += `<rect x="${x}" y="22" width="${Math.max(0, w - 1)}" height="22" fill="${GC[i % 6]}" fill-opacity=".75"/>`; if (w > 26) s += `<text x="${x + w / 2}" y="37" text-anchor="middle" style="fill:var(--sheet);font-size:10px">${Math.round(w / (W - 8) * 100)}%</text>`; x += w; });
      s += `<text x="4" y="62">${lv.slice(0, 4).map((l, i) => esc(l)).join(' / ')}${lv.length > 4 ? ' …' : ''}</text><text x="${W - 4}" y="10" text-anchor="end">n=${v.length}・${lv.length}区分</text>`;
    } else s += `<text x="4" y="40">（空の列）</text>`;
    return `<figure class="minifig"><figcaption>${esc(c.name)}</figcaption>${s}</svg></figure>`;
  }).join('');
}

// ----- 解析パネル（タブで分ける） -----
const DBTABS = [
  { id: 'basic', label: 'グラフ・集計', note: '目的変数を群で分けて描く・群ごとに全変数をまとめて集計します。', roles: ['y', 'a', 'b'], chips: [], opts: ['err', 'raw', 'param'],
    runs: [['graph', 'かんたんグラフ', '目的変数を要因A・Bで分けて描く'], ['cross', '一括クロス集計', '要因Aで群分けし全変数を集計・検定']] },
  { id: 'anova', label: '分散分析', note: '対応なし（別々の人の群）は「目的変数」と「要因A・B」、対応あり（同じ人を条件・時点ごとに測定）は「反復測定の列」を使います。', roles: ['y', 'a', 'b'], chips: ['rr', 'rv'], opts: ['kw', 'mc', 'err', 'raw'],
    runs: [['anova1', '一元配置分散分析（対応なし）', '目的変数 × 要因A（多重比較・Welch・Kruskal-Wallis つき）'], ['rm1', '一元配置分散分析（対応あり）', '反復測定の列（球面性の補正・Friedman つき）'], ['anova2', '二元配置分散分析', '目的変数 × 要因A × 要因B（対応なし）'], ['mixed', '混合計画の分散分析', '要因A（参加者間）× 反復測定の列'], ['ancova', '共分散分析（1要因）', '目的変数 × 要因A、共変量で調整（調整済み平均）'], ['ancova2', '二要因の共分散分析', '目的変数 × 要因A × 要因B、共変量で調整']] },
  { id: 'reg', label: '回帰分析', note: '重回帰は「目的変数」、ロジスティック回帰は「2値の目的変数」を使います。説明変数は共通です。', roles: ['y', 'bin', 'ev'], chips: ['rx', 'rstep'], opts: ['method', 'crit', 'or'],
    runs: [['mreg', '重回帰分析', '目的変数 ← 説明変数（文字の列はダミー化）'], ['hreg', '階層的重回帰分析', 'ステップごとに投入して ΔR² を検定（交互作用・単純傾斜・3D）'], ['mregcmp', '重回帰：方法の比較', '強制投入・ステップワイズ・総当たりを並べる'], ['mlreg', '最尤法による回帰分析', '欠測値があっても全員を使う（完全情報最尤法 FIML）'], ['logit', 'ロジスティック回帰', '2値の目的変数 ← 説明変数（ROC曲線つき）']] },
  { id: 'medmod', label: '媒介・調整分析', note: '「X が Y に影響するしくみ（媒介）」や「X の効果が W によって変わるか（調整）」を調べます。下の説明を読んでから変数を選んでください。', roles: ['y', 'mx', 'mw'], chips: ['mm', 'mcov'], opts: ['mmModel', 'medBoot', 'wvals', 'center'], extra: () => medModHelp(),
    runs: [['med', '媒介分析', 'X → M → Y の間接効果（ブートストラップ）'], ['mod', '調整分析（交互作用）', 'X の効果が W によって変わるか（単純傾斜・J-N 法）'], ['serial', '系列媒介分析', 'X → M1 → M2 → Y（PROCESS モデル 6、M は 2〜3 個）'], ['modmed', '調整媒介分析', '媒介の強さが W によって変わるか（PROCESS モデル 7・8・14）']] },
  { id: 'lmguide', label: '線形モデルで理解する', note: '分散分析・t 検定・共分散分析が「回帰分析（一般線形モデル）」の一種であること、目的変数が 2 値や回数のときの「一般化線形モデル」を、実際のデータで確かめながら学ぶタブです。', roles: ['y', 'a', 'b'], chips: ['rv'], opts: ['coding', 'family'], extra: () => lmGuideHelp(),
    runs: [['lmAnova', '分散分析を回帰分析として見る', 'ダミー変数・デザイン行列・F の一致・平方和の分解'], ['glmFam', '一般化線形モデル', '2 値（ロジスティック）・回数（ポアソン）と分散分析の比較']] },
  { id: 'fa', label: '因子分析', note: '項目の背後にある共通因子を探ります。因子数は平行分析で自動的に決めることもできます。', roles: [], chips: ['rf'], opts: ['nf', 'ext', 'rot', 'kn'],
    runs: [['fa', '因子分析', '項目の背後にある因子を探る（平行分析つき）']] },
  { id: 'cluster', label: 'クラスター分析', note: '回答のパターンが似ている人どうしをグループ（クラスター）に分けます。左のリストから分類に使う変数を右へ移してください。', roles: [], chips: ['rf'], opts: ['clMethod', 'clWard', 'clDist', 'clP', 'clK', 'clZ'], extra: () => clMethodGuide(false),
    runs: [['hclust', '階層的クラスター分析', 'デンドログラム・クラスター数の目安・プロフィール'], ['kmeans', '非階層的（k-means 法）', 'Ward 法の結果を初期値に・シルエット図']] },
  { id: 'agree', label: '評定者間一致', note: '複数の評定者（コーダー）の判断がどれだけ一致しているかを調べます。1 行 ＝ 評定される対象（発言・作文・患者など）、1 列 ＝ 評定者のデータで、評定者の列を右のリストに入れてください。', roles: [], chips: ['rf'], opts: ['kappaW', 'iccModel', 'iccType', 'iccUnit'], extra: () => agreeGuide(false),
    runs: [['kappa', 'κ 係数（カテゴリの一致）', 'Cohen・重みつき・Fleiss の κ、クロス表'], ['icc', 'ICC（数値の一致）', '6 種類の ICC・Bland-Altman プロット']] },
  { id: 'roc', label: 'ROC分析', note: '検査や尺度の得点で、2つの状態（例：診断あり／なし）をどれだけ見分けられるかを調べます。', roles: ['bin', 'ev'], chips: ['rc'], opts: ['dir', 'cut', 'mc'],
    runs: [['roc', 'ROC分析', 'AUC・最適カットオフ・感度と特異度・AUC の比較']] },
  { id: 'surv', label: '生存時間分析', note: 'イベント（再発・離職など）が起こるまでの時間を、打ち切りを考慮して分析します。', roles: ['time', 'st', 'stev', 'a'], chips: ['rx'], opts: ['sy', 'sci', 'method', 'or', 'mc'],
    runs: [['km', '生存曲線（Kaplan-Meier）', '要因Aの群ごとに生存率を描いて比べる'], ['cox', 'Cox 比例ハザード回帰', '生存時間 ← 説明変数（ハザード比）']] },
  { id: 'sem', label: '構造方程式モデリング', note: 'AMOS のようにパス図を描いてモデルを作り、最尤法で推定します（確認的因子分析・パス解析・潜在変数を含むモデル）。', roles: [], chips: [], opts: ['semStd', 'semMi', 'semBoot'], extra: () => semPanelHtml(),
    runs: [['sem', '構造方程式モデリング', 'パス図のモデルを推定（適合度・間接効果・修正指標）']] }
];
const FAUI = { L: new Set(), R: new Set(), filter: '', last: null, key: 'fa' }; // 因子分析の項目リスト（左右）の選択状態
function faMatch(j) { const f = FAUI.filter.trim().toLowerCase(); if (!f) return true; const c = state.db.cols[j]; return ((c.name || '') + ' ' + (c.label || '')).toLowerCase().includes(f); }
function faRerender() { const sc = [...document.querySelectorAll('.dlist')].map(e => e.scrollTop); save(); renderDbPanel(true); document.querySelectorAll('.dlist').forEach((e, i) => e.scrollTop = sc[i] || 0); }
function faMove(js, toRight) { const R = state.db.roles, K = FAUI.key; R[K] = R[K] || []; if (toRight) R[K] = [...new Set([...R[K], ...js])]; else R[K] = R[K].filter(j => !js.includes(j)); FAUI.L.clear(); FAUI.R.clear(); FAUI.last = null; faRerender(); }
$('#panelBody').addEventListener('click', e => {
  const it = e.target.closest('[data-fai]'); if (!it || state.fmt !== 'db') return;
  const side = it.closest('.dlist').dataset.side, set = FAUI[side], j = +it.dataset.fai, other = FAUI[side === 'L' ? 'R' : 'L'];
  other.clear(); document.querySelectorAll(`.dlist[data-side="${side === 'L' ? 'R' : 'L'}"] .dli.on`).forEach(x => x.classList.remove('on'));
  const rows = [...it.parentElement.querySelectorAll('.dli')].filter(x => x.style.display !== 'none');
  if (e.shiftKey && FAUI.last && FAUI.last.side === side) { const a = rows.findIndex(x => +x.dataset.fai === FAUI.last.j), b = rows.indexOf(it); if (a >= 0) { if (!(e.metaKey || e.ctrlKey)) set.clear(); rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => set.add(+x.dataset.fai)); } }
  else if (e.metaKey || e.ctrlKey) { set.has(j) ? set.delete(j) : set.add(j); FAUI.last = { side, j }; }
  else { set.clear(); set.add(j); FAUI.last = { side, j }; }
  rows.forEach(x => x.classList.toggle('on', set.has(+x.dataset.fai)));
});
$('#panelBody').addEventListener('dblclick', e => { const it = e.target.closest('[data-fai]'); if (!it || state.fmt !== 'db') return; faMove([+it.dataset.fai], it.closest('.dlist').dataset.side === 'L'); });
$('#panelBody').addEventListener('input', e => { if (e.target.id !== 'faFilter') return; FAUI.filter = e.target.value; document.querySelectorAll('.dlist[data-side="L"] .dli').forEach(x => { const show = faMatch(+x.dataset.fai); x.style.display = show ? '' : 'none'; if (!show) { FAUI.L.delete(+x.dataset.fai); x.classList.remove('on'); } }); });
function renderDbPanel(keep) {
  if (state.fmt !== 'db') return; cleanRoles();
  const d = state.db, R = d.roles, cols = d.cols.map((c, j) => { const lab = (c.label || '').trim(); return { name: (c.name || `列${j + 1}`) + (lab ? '：' + (lab.length > 12 ? lab.slice(0, 12) + '…' : lab) : ''), j, t: colType(j), lab }; });
  const T = DBTABS.find(t => t.id === state.opt.dbTab) || DBTABS[0], tid = T.id;
  const opt = (sel, none, filt) => (none ? `<option value="-1">なし</option>` : '') + cols.filter(filt || (() => true)).map(c => `<option value="${c.j}" ${c.j === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const chips = (key, arr, filt) => cols.filter(filt).map(c => `<label class="chip" title="${esc(c.lab)}"><input type="checkbox" data-${key}="${c.j}" ${arr.includes(c.j) ? 'checked' : ''}> ${esc(c.name)}<small>${c.t === 'cat' ? '類' : ''}</small></label>`).join('');
  const two = c => levelsOf(dbCol(c.j)).length === 2;
  const msg = keep && $('#msg') ? $('#msg').textContent : '';
  const ROLE = {
    y: () => `<label>${tid === 'medmod' ? '目的変数 Y（結果）' : '目的変数（従属変数）'}<select id="rY">${opt(R.y, false, c => c.t === 'num' || (tid === 'lmguide' && levelsOf(dbCol(c.j)).length === 2))}</select></label>`,
    mx: () => `<label>独立変数 X（原因）<select id="rMx">${opt(R.mx ?? -1, true, c => c.j !== R.y && (c.t === 'num' || levelsOf(dbCol(c.j)).length === 2))}</select></label>`,
    mw: () => `<label>調整変数 W（調整分析で使う）<select id="rMw">${opt(R.mw ?? -1, true, c => c.j !== R.y && c.j !== R.mx)}</select></label>`,
    a: () => `<label>${tid === 'surv' ? '群（要因A）' : '要因A（群）'}<select id="rA">${opt(R.a, true)}</select></label>`,
    b: () => `<label>要因B<select id="rB">${opt(R.b, true)}</select></label>`,
    bin: () => `<label>${tid === 'roc' ? '状態の列（値が2種類）' : '2値の目的変数（ロジスティック）'}<select id="rBin">${opt(R.bin, true, two)}</select></label>`,
    ev: () => `<label>${tid === 'roc' ? '陽性とする値' : '事象（1 とする値）'}<select id="rEv">${R.bin >= 0 ? levelsOf(dbCol(R.bin)).map(l => `<option ${l === R.event ? 'selected' : ''}>${esc(l)}</option>`).join('') : '<option>—</option>'}</select></label>`,
    time: () => `<label>生存時間の列<select id="rTime">${opt(R.time, true, c => c.t === 'num')}</select></label>`,
    st: () => `<label>イベントの列<select id="rSt">${opt(R.st, true, two)}</select></label>`,
    stev: () => `<label>イベントとする値<select id="rStev">${R.st >= 0 ? levelsOf(dbCol(R.st)).map(l => `<option ${l === R.stev ? 'selected' : ''}>${esc(l)}</option>`).join('') : '<option>—</option>'}</select></label>`
  };
  const CHIP = {
    rx: () => `<div class="chipset"><span>${tid === 'surv' ? '説明変数（Cox 回帰）' : '説明変数'}</span>${chips('rx', R.x, c => c.j !== R.y && c.t !== 'empty')}</div>`,
    rstep: () => { const xs = R.x.filter(j => j !== R.y), numx = xs.filter(j => colType(j) === 'num'), st = R.step || {}, it = R.inter || [];
      const sel = (id, v) => `<select id="${id}"><option value="-1">なし</option>${numx.map(j => `<option value="${j}" ${v === j ? 'selected' : ''}>${esc(d.cols[j].name)}</option>`).join('')}</select>`;
      return xs.length ? `<div class="chipset"><span>階層的重回帰のステップ</span>${xs.map(j => `<label class="chip">${esc(d.cols[j].name)} <select data-step="${j}">${[1, 2, 3, 4].map(k => `<option ${+(st[j] || 1) === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`).join('')}</div>
        <div class="chipset"><span>交互作用項（最後のステップに追加）</span>${sel('rInt1', it[0])} × ${sel('rInt2', it[1])}<label class="chip"><input type="checkbox" id="oCenter" ${state.opt.center !== false ? 'checked' : ''}> 中心化する</label></div>` : ''; },
    mm: () => { const mmv = (R.mm || []).filter(j => j < d.cols.length); return `<div class="chipset"><span>媒介変数 M（3 つまで。系列媒介ではチェックした順が順序）</span>${chips('mm', mmv, c => c.t === 'num' && c.j !== R.y && c.j !== R.mx)}</div>${mmv.length >= 2 ? `<div class="chipset"><span>系列媒介の順序</span><b style="font-size:12.5px">${['X', ...mmv.map(j => esc(d.cols[j].name)), 'Y'].join(' → ')}</b><button class="btn" data-act="mmrev" style="padding:1px 8px">逆順にする</button></div>` : ''}`; },
    mcov: () => `<div class="chipset"><span>共変量（統制したい変数、任意）</span>${chips('mcov', R.mcov || [], c => c.t !== 'empty' && c.j !== R.y && c.j !== R.mx && c.j !== R.mw && !(R.mm || []).includes(c.j))}</div>`,
    rv: () => `<div class="chipset"><span>共変量（共分散分析）</span>${chips('rv', R.cov, c => c.t === 'num' && c.j !== R.y && c.j !== R.a)}</div>`,
    rr: () => `<div class="chipset"><span>反復測定の列（対応あり・混合計画）</span>${chips('rr', R.rep, c => c.t === 'num')}</div>`,
    rf: () => { const key = tid === 'cluster' ? 'cl' : tid === 'agree' ? 'ag' : 'fa'; if (FAUI.key !== key) { FAUI.key = key; FAUI.L.clear(); FAUI.R.clear(); } R[key] = R[key] || []; const nums = cols.filter(c => key === 'ag' ? c.t !== 'empty' : c.t === 'num'), inR = new Set(R[key]), left = nums.filter(c => !inR.has(c.j)), right = nums.filter(c => inR.has(c.j)), nStr = cols.filter(c => c.t === 'cat').length;
      const item = (c, side) => { const lab = (d.cols[c.j].label || '').trim(), hid = side === 'L' && !faMatch(c.j); return `<div class="dli${FAUI[side].has(c.j) ? ' on' : ''}" data-fai="${c.j}" title="ダブルクリックで${side === 'L' ? '右へ入れる' : '左へ戻す'}"${hid ? ' style="display:none"' : ''}><b>${esc(d.cols[c.j].name || `列${c.j + 1}`)}</b>${lab ? `<span>${esc(lab)}</span>` : ''}</div>`; };
      return `<div class="dual">
        <div class="dlcol"><div class="dlhead">データの項目 <small>（${left.length}）</small><input class="dlfilter" id="faFilter" placeholder="名前・内容で絞り込み" value="${esc(FAUI.filter)}"></div><div class="dlist" data-side="L">${left.map(c => item(c, 'L')).join('') || '<div class="dlempty">すべて右に入っています</div>'}</div></div>
        <div class="dlbtns"><button class="btn primary" data-act="faadd" title="左で選んだ項目を右へ">入れる →</button><button class="btn" data-act="farem" title="右で選んだ項目を左へ">← 外す</button><button class="btn" data-act="faall" title="左に見えている項目をすべて右へ">すべて →</button><button class="btn" data-act="fanone">← すべて</button></div>
        <div class="dlcol"><div class="dlhead">${key === 'cl' ? 'クラスター分析に使う変数' : key === 'ag' ? '評定者（列）' : '因子分析に入れる項目'} <small>（${right.length} ${key === 'cl' ? '変数' : key === 'ag' ? '人' : '項目'}）</small></div><div class="dlist" data-side="R">${right.map(c => item(c, 'R')).join('') || `<div class="dlempty">左から${key === 'cl' ? '変数を入れてください（2 変数以上）' : key === 'ag' ? '評定者の列を入れてください（2 人以上）' : '項目を入れてください（3 項目以上）'}</div>`}</div></div>
      </div><p class="hint" style="margin:4px 0 0">クリックで選択（Shift で範囲、⌘ / Ctrl で追加選択）、ダブルクリックですぐ移動します。${nStr && key !== 'ag' ? `文字の列（${nStr}）は表示していません。` : ''}</p>`; },
    rc: () => `<div class="chipset"><span>検査値の列（複数選ぶと比べます）</span>${chips('rc', R.roc, c => c.t === 'num' && c.j !== R.bin)}</div>`
  };
  const OPT = {
    mc: mcSelect(),
    kw: kwSelect(),
    kappaW: `<label>重みつき κ（2 人のとき） <select id="oKappaW">${[['none', '重みなしのみ'], ['linear', '線形の重み'], ['quadratic', '2 次の重み']].map(([v, l]) => `<option value="${v}" ${state.opt.kappaW === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    iccModel: `<label>ICC のモデル <select id="oIccModel">${Object.entries(ICC_MODEL_L).map(([v, l]) => `<option value="${v}" ${state.opt.iccModel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    iccType: `<label>タイプ <select id="oIccType"><option value="agreement" ${state.opt.iccType === 'agreement' ? 'selected' : ''}>絶対一致（値そのもの）</option><option value="consistency" ${state.opt.iccType === 'consistency' ? 'selected' : ''}>一貫性（高低の順序）</option></select></label>`,
    iccUnit: `<label>単位 <select id="oIccUnit"><option value="single" ${state.opt.iccUnit === 'single' ? 'selected' : ''}>単一の評定者</option><option value="average" ${state.opt.iccUnit === 'average' ? 'selected' : ''}>評定者の平均</option></select></label>`,
    clMethod: `<label>結合方法 <select id="oClMethod">${Object.entries(CL_HM).map(([v, l]) => `<option value="${v}" ${state.opt.clMethod === v ? 'selected' : ''}>${l[0]}</option>`).join('')}</select></label>`,
    clDist: `<label>距離 <select id="oClDist">${Object.entries(CL_DIST).map(([v, l]) => `<option value="${v}" ${state.opt.clDist === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    clWard: state.opt.clMethod === 'ward' ? `<label>Ward 法の計算方式 <select id="oClWard">${[['auto', '自動（距離に合わせる）'], ['D2', 'ward.D2（距離を 2 乗して計算）'], ['D', 'ward.D（距離をそのまま使う）']].map(([v, l]) => `<option value="${v}" ${(state.opt.clWard || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : '',
    clP: state.opt.clDist === 'minkowski' ? `<label>Minkowski のべき数 p <input id="oClP" type="number" min="1" max="20" step="0.5" value="${esc(state.opt.clP)}" style="width:60px"></label>` : '',
    clK: `<label>クラスター数 <select id="oClK"><option value="auto" ${state.opt.clK === 'auto' ? 'selected' : ''}>自動（平均シルエットが最大）</option>${[2, 3, 4, 5, 6, 7, 8].map(k => `<option value="${k}" ${state.opt.clK === String(k) ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`,
    clZ: `<label><input type="checkbox" id="oClZ" ${state.opt.clZ ? 'checked' : ''}> 変数を標準化する（z 得点）</label>`,
    coding: `<label>コーディング <select id="oCoding"><option value="dummy" ${state.opt.coding !== 'effect' ? 'selected' : ''}>ダミー（0/1、基準＝最初の水準）</option><option value="effect" ${state.opt.coding === 'effect' ? 'selected' : ''}>効果（1・0・−1）</option></select></label>`,
    family: `<label>一般化線形モデルの分布 <select id="oFamily">${[['auto', '自動（目的変数から判断）'], ['gaussian', '正規分布（恒等リンク）'], ['binomial', '二項分布（ロジット）'], ['poisson', 'ポアソン分布（対数）']].map(([v, l]) => `<option value="${v}" ${state.opt.family === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    mmModel: `<label>調整媒介のモデル <select id="oMmModel">${Object.entries(MM_MODELS).map(([k, l]) => `<option value="${k}" ${state.opt.mmModel === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`,
    medBoot: `<label>ブートストラップ（媒介） <select id="oMedBoot">${['1000', '2000', '5000', '10000'].map(v => `<option ${state.opt.medBoot === v ? 'selected' : ''}>${v}</option>`).join('')}</select> 回</label>`,
    wvals: `<label>単純傾斜の W の値 <select id="oWvals"><option value="sd" ${state.opt.wvals !== 'pct' ? 'selected' : ''}>平均 ± 1SD</option><option value="pct" ${state.opt.wvals === 'pct' ? 'selected' : ''}>16・50・84 パーセンタイル（PROCESS の既定）</option></select></label>`,
    center: `<label><input type="checkbox" id="oCenter2" ${state.opt.center !== false ? 'checked' : ''}> X と W を中心化（調整分析）</label>`,
    err: '<label>エラーバー <select id="oErr"><option value="ci">95%信頼区間</option><option value="se">標準誤差 SE</option><option value="sd">標準偏差 SD</option></select></label>',
    raw: `<label><input type="checkbox" id="oRaw" ${state.opt.raw ? 'checked' : ''}> 生データの点を重ねる</label>`,
    param: '<label>クロス集計の検定 <select id="oParam"><option value="param">パラメトリック</option><option value="np">ノンパラメトリック</option></select></label>',
    method: '<label>変数選択 <select id="oMethod"><option value="enter">強制投入法</option><option value="step">ステップワイズ法（限界 p = .15）</option><option value="all">総当たり法（重回帰のみ）</option></select></label>',
    crit: '<label>総当たり法の基準 <select id="oCrit"><option value="aic">AIC</option><option value="bic">BIC</option><option value="adjr2">調整済み R²</option><option value="cp">Mallows の Cp</option></select></label>',
    or: `<label>${tid === 'surv' ? 'ハザード比' : 'オッズ比'}の単位 <select id="oOr"><option value="unit">1 単位あたり</option><option value="sd">1 SD あたり</option></select></label>`,
    nf: `<label>因子数 <select id="oNf"><option value="auto">自動（平行分析）</option>${[1, 2, 3, 4, 5, 6, 7, 8].map(k => `<option value="${k}">${k}</option>`).join('')}</select></label>`,
    ext: `<label>因子抽出 <select id="oExt">${Object.entries(S.EXTRACTIONS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`,
    rot: `<label>回転 <select id="oRot"><option value="none">回転なし</option>${[['obl', '斜交回転（因子間の相関を認める）'], ['orth', '直交回転（因子は無相関）']].map(([t, g]) => `<optgroup label="${g}">${Object.entries(S.ROTATIONS).filter(([, r]) => r[1] === t).map(([v, r]) => `<option value="${v}">${r[0]}</option>`).join('')}</optgroup>`).join('')}</select></label>`,
    kn: `<label><input type="checkbox" id="oKn" ${state.opt.knorm ? 'checked' : ''}> Kaiser の正規化</label>`,
    sy: '<label>生存曲線の縦軸 <select id="oSy"><option value="surv">生存率</option><option value="cum">累積イベント率</option></select></label>',
    sci: `<label><input type="checkbox" id="oSci" ${state.opt.survCI ? 'checked' : ''}> 生存曲線に信頼区間</label>`,
    dir: '<label>陽性の向き <select id="oDir"><option value="auto">自動（中央値で判断）</option><option value="high">値が高いほど陽性</option><option value="low">値が低いほど陽性</option></select></label>',
    semStd: `<label><input type="checkbox" id="oSemStd" ${state.opt.semStd ? 'checked' : ''}> パス図に標準化推定値を表示</label>`,
    semBoot: `<label>ブートストラップ <select id="oSemBoot">${['0', '500', '1000', '2000', '5000'].map(v => `<option value="${v}" ${state.opt.semBoot === v ? 'selected' : ''}>${v === '0' ? 'なし' : v + ' 回'}</option>`).join('')}</select></label>`,
    semMi: `<label><input type="checkbox" id="oSemMi" ${state.opt.semMi ? 'checked' : ''}> 修正指標を表示</label>`,
    cut: '<label>カットオフ <select id="oCut"><option value="youden">Youden 指数が最大</option><option value="closest">(0, 1) に最も近い点</option></select></label>'
  };
  $('#panelBody').innerHTML = filterBanner() + `<div class="subtabs" role="tablist">${DBTABS.map(t => `<button role="tab" data-tab="${t.id}" aria-selected="${t.id === tid}">${t.label}</button>`).join('')}</div>
    <p class="hint" style="margin:8px 0">${T.note}</p>
    ${T.roles.length ? `<div class="roles">${T.roles.map(k => ROLE[k]()).join('')}</div>` : ''}
    ${T.chips.map(k => CHIP[k]()).join('')}${T.extra ? T.extra() : ''}
    <div class="runs" style="margin-top:10px">${T.runs.map(r => `<button class="btn run" data-run="${r[0]}"><b>${r[1]}</b><span>${r[2]}</span></button>`).join('')}</div>
    <div class="opts">${T.opts.map(k => OPT[k]).join('')}</div><div class="msg" id="msg">${esc(msg)}</div>`;
  const setV = (id, v) => { const el = $('#' + id); if (el) el.value = v; };
  setV('oErr', state.opt.err); setV('oSy', state.opt.survY); setV('oCrit', state.opt.crit); setV('oOr', state.opt.orUnit); setV('oNf', state.opt.nf); setV('oExt', state.opt.ext); setV('oRot', state.opt.rot); setV('oMethod', state.opt.method); setV('oParam', state.opt.param); setV('oDir', state.opt.rocDir); setV('oCut', state.opt.rocCut);
}
$('#panelBody').addEventListener('change', e => {
  if (state.fmt !== 'db') return; const el = e.target, R = state.db.roles;
  if (el.id === 'rY') R.y = +el.value; if (el.id === 'rA') R.a = +el.value; if (el.id === 'rB') R.b = +el.value;
  if (el.dataset.rx != null) { const j = +el.dataset.rx; R.x = el.checked ? [...R.x, j] : R.x.filter(v => v !== j); save(); if (state.opt.dbTab === 'reg') { renderDbPanel(true); return; } }
  if (el.dataset.rf != null) { const j = +el.dataset.rf; R.fa = el.checked ? [...R.fa, j] : R.fa.filter(v => v !== j); }
  if (el.id === 'oKn') state.opt.knorm = el.checked; if (el.id === 'oSy') state.opt.survY = el.value; if (el.id === 'oSci') state.opt.survCI = el.checked;
  if (el.id === 'rTime') R.time = +el.value; if (el.id === 'rStev') R.stev = el.value;
  if (el.id === 'rSt') { R.st = +el.value; const l = R.st >= 0 ? levelsOf(dbCol(R.st)) : []; R.stev = l.includes('あり') ? 'あり' : l.includes('1') ? '1' : l.slice(-1)[0] || ''; save(); renderDbPanel(true); return; } if (el.id === 'oCrit') state.opt.crit = el.value; if (el.id === 'oOr') state.opt.orUnit = el.value;
  if (el.id === 'rBin') { R.bin = +el.value; R.event = R.bin >= 0 ? levelsOf(dbCol(R.bin)).slice(-1)[0] : ''; save(); renderDbPanel(true); return; }
  if (el.id === 'rEv') R.event = el.value;
  if (el.dataset.rc != null) { const j = +el.dataset.rc; R.roc = el.checked ? [...R.roc, j] : R.roc.filter(v => v !== j); }
  if (el.id === 'oMc') { state.opt.mc = el.value; save(); renderDbPanel(true); return; } if (el.id === 'oKwMc') { state.opt.kwmc = el.value; save(); renderDbPanel(true); return; } if (el.id === 'oDunCtl') state.opt.dunCtl = el.value;
  if (el.id === 'oSemStd') state.opt.semStd = el.checked; if (el.id === 'oSemMi') state.opt.semMi = el.checked; if (el.id === 'oSemBoot') state.opt.semBoot = el.value;
  if (el.id === 'oDir') state.opt.rocDir = el.value; if (el.id === 'oCut') state.opt.rocCut = el.value;
  if (el.id === 'oNf') state.opt.nf = el.value; if (el.id === 'oExt') state.opt.ext = el.value; if (el.id === 'oRot') state.opt.rot = el.value;
  if (el.id === 'rMx') { R.mx = +el.value; save(); renderDbPanel(true); return; } if (el.id === 'rMw') R.mw = +el.value;
  if (el.dataset.mm != null) { const j = +el.dataset.mm; R.mm = el.checked ? [...(R.mm || []), j] : (R.mm || []).filter(v => v !== j); save(); renderDbPanel(true); return; }
  if (el.dataset.mcov != null) { const j = +el.dataset.mcov; R.mcov = el.checked ? [...(R.mcov || []), j] : (R.mcov || []).filter(v => v !== j); }
  if (el.id === 'oKappaW') state.opt.kappaW = el.value; if (el.id === 'oIccModel') state.opt.iccModel = el.value; if (el.id === 'oIccType') state.opt.iccType = el.value; if (el.id === 'oIccUnit') state.opt.iccUnit = el.value;
  if (el.id === 'oClMethod') { state.opt.clMethod = el.value; save(); renderDbPanel(true); return; } if (el.id === 'oClWard') state.opt.clWard = el.value; if (el.id === 'oClDist') { state.opt.clDist = el.value; save(); renderDbPanel(true); return; } if (el.id === 'oClP') state.opt.clP = el.value; if (el.id === 'oClK') state.opt.clK = el.value; if (el.id === 'oClZ') state.opt.clZ = el.checked;
  if (el.id === 'oCoding') state.opt.coding = el.value; if (el.id === 'oFamily') state.opt.family = el.value;
  if (el.id === 'oMmModel') state.opt.mmModel = el.value; if (el.id === 'oMedBoot') state.opt.medBoot = el.value; if (el.id === 'oWvals') state.opt.wvals = el.value; if (el.id === 'oCenter2') state.opt.center = el.checked;
  if (el.dataset.step != null) { R.step = R.step || {}; R.step[+el.dataset.step] = +el.value; }
  if (el.id === 'rInt1' || el.id === 'rInt2') { R.inter = R.inter || [-1, -1]; R.inter[el.id === 'rInt1' ? 0 : 1] = +el.value; }
  if (el.id === 'oCenter') state.opt.center = el.checked;
  if (el.dataset.rv != null) { const j = +el.dataset.rv; R.cov = el.checked ? [...R.cov, j] : R.cov.filter(v => v !== j); }
  if (el.dataset.rr != null) { const j = +el.dataset.rr; R.rep = el.checked ? [...R.rep, j] : R.rep.filter(v => v !== j); }
  if (el.id === 'oErr') state.opt.err = el.value; if (el.id === 'oRaw') state.opt.raw = el.checked; if (el.id === 'oMethod') state.opt.method = el.value; if (el.id === 'oParam') state.opt.param = el.value;
  save(); if (el.id === 'rY') renderDbPanel(true);
});

// ----- グラフ部品 -----
const labW = (names, base) => Math.max(base, Math.min(320, Math.max(0, ...names.map(n => [...String(n)].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 12 : 6.8), 0))) + 18));
function errOf(v) { const n = v.length, s = n > 1 ? S.sd(v) : 0; return state.opt.err === 'sd' ? s : state.opt.err === 'se' ? s / Math.sqrt(n) : (n > 1 ? S.qt(0.025, n - 1) * s / Math.sqrt(n) : 0); }
const ERRLAB = { ci: '95%信頼区間', se: '標準誤差', sd: '標準偏差' };
function interPlot({ xl, ll, get, subj, xTitle, yTitle, lTitle }) {
  const L = ll.length, X = xl.length, raw = state.opt.raw;
  const cells = ll.map((_, li) => xl.map((_, xi) => { const v = get(li, xi); return { v, m: v.length ? S.mean(v) : NaN, e: v.length ? errOf(v) : 0 }; }));
  let lo = Infinity, hi = -Infinity; cells.flat().forEach(c => { if (!c.v.length) return; lo = Math.min(lo, c.m - c.e, ...(raw ? c.v : [])); hi = Math.max(hi, c.m + c.e, ...(raw ? c.v : [])); });
  const yt = niceTicks(lo, hi), W = Math.max(440, 140 + X * 130), legendH = L > 1 ? 22 : 0, H = 310 + legendH, M = { l: 52, r: 18, t: 24 + legendH, b: 46 };
  const slot = (W - M.l - M.r) / X, fx = (xi, li) => M.l + slot * (xi + .5) + (L > 1 ? (li - (L - 1) / 2) * Math.min(18, slot * .14) : 0);
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, yTitle, fy); const Rn = rng(11);
  if (subj) subj.forEach(sb => s += `<polyline points="${sb.ys.map((y, xi) => fx(xi, sb.li) + ',' + fy(y)).join(' ')}" fill="none" stroke="${GC[sb.li % 6]}" stroke-opacity=".16"/>`);
  if (raw && !subj) cells.forEach((row, li) => row.forEach((c, xi) => c.v.forEach(v => s += `<circle cx="${fx(xi, li) + (Rn() - .5) * Math.min(22, slot * .16)}" cy="${fy(v)}" r="2.4" fill="${GC[li % 6]}" fill-opacity=".32"/>`)));
  cells.forEach((row, li) => {
    const c = GC[li % 6], pts = row.map((cc, xi) => cc.v.length ? `${fx(xi, li)},${fy(cc.m)}` : null).filter(Boolean);
    if (X > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
    row.forEach((cc, xi) => { if (!cc.v.length) return; const x = fx(xi, li); s += `<line x1="${x}" x2="${x}" y1="${fy(cc.m - cc.e)}" y2="${fy(cc.m + cc.e)}" stroke="${c}" stroke-width="1.4"/><line x1="${x - 5}" x2="${x + 5}" y1="${fy(cc.m - cc.e)}" y2="${fy(cc.m - cc.e)}" stroke="${c}" stroke-width="1.4"/><line x1="${x - 5}" x2="${x + 5}" y1="${fy(cc.m + cc.e)}" y2="${fy(cc.m + cc.e)}" stroke="${c}" stroke-width="1.4"/><circle cx="${x}" cy="${fy(cc.m)}" r="4.6" fill="${c}" stroke="var(--sheet)" stroke-width="1.2"/>`; });
  });
  xl.forEach((l, xi) => s += `<text x="${M.l + slot * (xi + .5)}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(l)}</text>`);
  if (xTitle) s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle">${esc(xTitle)}</text>`;
  if (L > 1) { let lx = M.l; s += `<text x="${lx}" y="16">${esc(lTitle || '')}</text>`; lx += (lTitle ? lTitle.length * 11 + 10 : 0); ll.forEach((l, li) => { s += `<rect x="${lx}" y="7" width="14" height="10" rx="2" fill="${GC[li % 6]}"/><text x="${lx + 18}" y="16" style="fill:var(--fg)">${esc(l)}</text>`; lx += 30 + String(l).length * 11; }); }
  s += `<text x="${W - M.r}" y="${L > 1 ? 16 : 14}" text-anchor="end">点＝平均、ひげ＝${ERRLAB[state.opt.err]}</text>`;
  return s + '</svg>';
}
function coefPlot(coefs) { // 標準偏回帰係数の比較図
  const L = labW(coefs.map(c => c.name), 150), W = 410 + L, rowH = 30, H = 64 + coefs.length * rowH, M = { l: L, r: 92, t: 26, b: 34 };
  const lo = Math.min(0, ...coefs.map(c => c.betaL)), hi = Math.max(0, ...coefs.map(c => c.betaU)), xt = niceTicks(lo, hi, 6);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  xt.forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t - 6}" y2="${H - M.b}" stroke="var(--grid)"/><text x="${fx(v)}" y="${H - M.b + 16}" text-anchor="middle">${+v.toPrecision(4)}</text>`);
  s += `<line x1="${fx(0)}" x2="${fx(0)}" y1="${M.t - 6}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">標準偏回帰係数 β（横線は 95%信頼区間）</text><text x="${W - 6}" y="16" text-anchor="end">p 値</text>`;
  coefs.forEach((c, i) => {
    const y = M.t + 8 + i * rowH, sig = c.p < .05, col = sig ? 'var(--sig)' : 'var(--accent)';
    if (i % 2 === 0) s += `<rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="var(--panel)"/>`;
    s += `<text x="${M.l - 10}" y="${y + 4}" text-anchor="end" style="fill:var(--fg)">${esc(c.name)}</text>`;
    s += `<line x1="${fx(c.betaL)}" x2="${fx(c.betaU)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="1.6"/><circle cx="${fx(c.beta)}" cy="${y}" r="5" fill="${sig ? col : 'var(--sheet)'}" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${W - 6}" y="${y + 4}" text-anchor="end" style="fill:${sig ? 'var(--sig)' : 'var(--muted)'}">${fp(c.p)}${star(c.p)}</text>`;
  });
  return s + '</svg>';
}
function xyPlot(x, y, xn, yn, o = {}) {
  const W = 420, H = 310, M = { l: 52, r: 16, t: o.groups ? 40 : 22, b: 42 };
  const xt = niceTicks(Math.min(...x), Math.max(...x)), yt = niceTicks(Math.min(...y), Math.max(...y));
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, yn, fy);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(6)}</text>`);
  s += `<text x="${W - M.r}" y="${H - 6}" text-anchor="end" style="fill:var(--fg)">${esc(xn)}</text>`;
  const clipLine = (a, b, col, dash) => { const x0 = xt[0], x1 = xt[xt.length - 1]; s += `<line x1="${fx(x0)}" y1="${fy(a + b * x0)}" x2="${fx(x1)}" y2="${fy(a + b * x1)}" stroke="${col}" stroke-width="1.6" ${dash ? 'stroke-dasharray="4 3"' : ''}/>`; };
  if (o.ref === 'identity') clipLine(0, 1, 'var(--muted)', true);
  if (o.ref === 'zero') { [0, 2, -2].forEach(v => { if (v >= yt[0] && v <= yt[yt.length - 1]) s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="${v ? 'var(--sig)' : 'var(--fg)'}" stroke-dasharray="${v ? '4 3' : ''}" stroke-opacity="${v ? .6 : .8}"/>`; }); }
  (o.lines || []).forEach(l => clipLine(l.a, l.b, l.color));
  x.forEach((v, i) => s += `<circle cx="${fx(v)}" cy="${fy(y[i])}" r="3.6" fill="${o.groups ? GC[o.groups[i] % 6] : 'var(--accent)'}" fill-opacity=".78"/>`);
  if (o.groups) { let lx = M.l; o.groupNames.forEach((g, i) => { s += `<circle cx="${lx + 5}" cy="13" r="5" fill="${GC[i % 6]}"/><text x="${lx + 14}" y="17" style="fill:var(--fg)">${esc(g)}</text>`; lx += 28 + String(g).length * 11; }); }
  const outer = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><defs><clipPath id="cp${++clipN}"><rect x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}"/></clipPath></defs>`;
  return outer + s.replace(/^<svg[^>]*>/, '').replace(/<line x1="([^"]*)" y1/g, '<line clip-path="url(#cp' + clipN + ')" x1="$1" y1') + '</svg>';
}
let clipN = 0;

// ----- 解析 -----
const nm = j => esc(vn(j));
function needRole(k, label) { need(state.db.roles[k] >= 0, `${label}を選んでください。`); return state.db.roles[k]; }
ANALYSES.db = {
  graph() {
    const R = state.db.roles, y = needRole('y', '目的変数'), Y = dbCol(y).map(toNum);
    if (R.a < 0) { const v = Y.filter(isFinite); need(v.length >= 3, '数値が3つ以上必要です。'); return { title: `かんたんグラフ（${vn(y)}）`, html: histogram(v, vn(y), 0) + '<p class="note">要因Aを選ぶと群ごとに分けて描きます。</p>' }; }
    const A = dbCol(R.a), B = R.b >= 0 ? dbCol(R.b) : null, ok = Y.map((v, i) => isFinite(v) && A[i] !== '' && (!B || B[i] !== ''));
    const la = levelsOf(A.filter((_, i) => ok[i])), lb = B ? levelsOf(B.filter((_, i) => ok[i])) : ['全体'];
    const get = (li, xi) => Y.filter((v, i) => ok[i] && A[i] === la[xi] && (!B || B[i] === lb[li]));
    let h = interPlot({ xl: la, ll: lb, get, xTitle: vn(R.a), yTitle: vn(y), lTitle: B ? vn(R.b) : '' });
    const groups = [], names = []; lb.forEach((b, li) => la.forEach((a, xi) => { const v = get(li, xi); if (v.length) { groups.push(v); names.push(B ? `${a}・${b}` : a); } }));
    h += boxDot(groups, names);
    h += table(['群', 'n', '平均', 'SD', '中央値'], groups.map((g, i) => [esc(names[i]), g.length, fmt(S.mean(g), 2), g.length > 1 ? fmt(S.sd(g), 2) : '—', fmt(S.quantile(g, .5), 2)]));
    return { title: `かんたんグラフ（${vn(y)}）`, html: h };
  },
  cross() {
    const R = state.db.roles, a = needRole('a', '群分けに使う要因A'), A = dbCol(a), la = levelsOf(A); need(la.length >= 2 && la.length <= 8, '要因Aは2〜8区分の列を選んでください。');
    const np = state.opt.param === 'np'; let rows = []; const sigV = [], allV = [];
    state.db.cols.forEach((c, j) => {
      if (j === a) return; const t = colType(j); if (t === 'empty') return; const V = dbCol(j);
      if (t === 'num') {
        const gs = la.map(l => V.filter((v, i) => A[i] === l && v !== '').map(toNum)); if (gs.some(g => g.length < 2)) return;
        const all = gs.flat(); let test = '', p;
        if (np) { if (la.length === 2) { const m = S.mannWhitney(gs[0], gs[1]); test = 'U 検定'; p = m.p; } else { const k = S.kruskal(gs); test = 'Kruskal-Wallis'; p = k.p; } }
        else { if (la.length === 2) { const t2 = S.tTest(gs[0], gs[1]); test = 'Welch の t'; p = t2.welch.p; } else { const an = S.anova1(gs); test = '分散分析'; p = an.p; } }
        const cell = g => np ? `${fmt(S.quantile(g, .5), 1)} [${fmt(S.quantile(g, .25), 1)}, ${fmt(S.quantile(g, .75), 1)}]` : `${fmt(S.mean(g), 1)} (${fmt(S.sd(g), 1)})`;
        allV.push(c.name); if (p < .05) sigV.push(c.name);
        rows.push([`<b>${esc(c.name)}</b>`, np ? '中央値 [Q1, Q3]' : '平均 (SD)', ...gs.map(cell), cell(all), test, pcell(p)]);
      } else {
        const lv = levelsOf(V); if (lv.length > 12) return;
        const tab = lv.map(l => la.map(g => V.filter((v, i) => v === l && A[i] === g).length)), ns = la.map((_, gi) => tab.reduce((s, r) => s + r[gi], 0)), N = ns.reduce((x, y) => x + y, 0);
        let test = 'χ² 検定', p = NaN;
        if (lv.length >= 2) { const T = S.chiTable(tab); p = T.p; if (T.fisher && T.small) { test = 'Fisher'; p = T.fisher.p; } }
        allV.push(c.name); if (p < .05) sigV.push(c.name);
        lv.forEach((l, li) => rows.push([li === 0 ? `<b>${esc(c.name)}</b>` : '', `${esc(l)}　n (%)`, ...tab[li].map((v, gi) => `${v} (${fmt(v / ns[gi] * 100, 1)})`), `${tab[li].reduce((x, y) => x + y, 0)} (${fmt(tab[li].reduce((x, y) => x + y, 0) / N * 100, 1)})`, li === 0 ? test : '', li === 0 ? pcell(p) : '']));
      }
    });
    need(rows.length, '集計できる列がありません。');
    const h = table(['変数', '統計量', ...la.map(l => `${esc(l)}<br>(n = ${A.filter(v => v === l).length})`), '全体', '検定', 'p 値'], rows)
      + `<p class="note">${np ? '数値の列は中央値 [第1四分位, 第3四分位]、2群は Mann-Whitney の U 検定、3群以上は Kruskal-Wallis 検定。' : '数値の列は平均 (SD)、2群は Welch の t 検定、3群以上は一元配置分散分析。'}カテゴリの列は群ごとの列 % と χ² 検定（2×2 で期待度数 5 未満があれば Fisher の直接確率法）。論文の「表1（対象者の特徴）」にそのまま使えます。</p>`;
    return { title: `一括クロス集計（${vn(a)}別）`, html: h + interp(sigV.length ? `${nm(a)}（${la.map(esc).join('・')}）の間で有意に異なっていた変数は、${sigV.map(esc).join('、')}です（${allV.length} 変数中 ${sigV.length} 変数）。それ以外の変数では、群の間に差があるとはいえません。` : `どの変数にも、${nm(a)}（${la.map(esc).join('・')}）の間で有意な差はありませんでした。`, '群の背景（年齢や性別など）がそろっているかを確かめる「表1」としてよく使います。ただし多くの変数を一度に検定しているので、20 回に 1 回程度は偶然でも有意になることに注意してください。') };
  },
  anova1() {
    const y = needRole('y', '目的変数'), a = needRole('a', '要因A（群）'); need(a !== y, '目的変数と要因Aには別の列を選んでください。');
    const Y = dbCol(y).map(toNum), A = dbCol(a), ok = Y.map((v, i) => isFinite(v) && A[i] !== ''), la = levelsOf(A.filter((_, i) => ok[i]));
    need(la.length >= 2, '要因Aには2区分以上が必要です。'); need(la.length <= 12, '要因Aの区分が多すぎます（12 まで）。数値の列なら、変数ビューで尺度を確認してください。');
    const g = la.map(l => Y.filter((v, i) => ok[i] && A[i] === l)); need(g.every(v => v.length >= 2), 'どの群にも2人以上が必要です。');
    const drop = ok.filter(v => !v).length;
    return { title: `一元配置分散分析（${vn(y)} × ${vn(a)}）`, html: `<p class="note">目的変数 = ${nm(y)}、要因 = ${nm(a)}（${la.map(esc).join('・')}）、n = ${g.flat().length}${drop ? `（欠測などで ${drop} 行を除外）` : ''}。${la.length === 2 ? '2群なので、結果は t 検定（等分散）と同じです。' : ''}</p>` + oneWayHtml(g, la) };
  },
  rm1() {
    const R = state.db.roles; need(R.rep.length >= 2, '「反復測定の列」を2つ以上選んでください（例：事前・事後・追跡）。');
    const rep = [...R.rep].sort((x, y) => x - y), C = rep.map(j => dbCol(j).map(toNum)), ok = C[0].map((_, i) => C.every(c => isFinite(c[i])));
    const any = C[0].map((_, i) => C.some(c => isFinite(c[i]))), cols = C.map(c => c.filter((_, i) => ok[i])); need(cols[0].length >= 3, '空欄のない行が3行以上必要です。');
    return { title: `一元配置分散分析・対応あり（${rep.map(j => vn(j)).join('・')}）`, html: rmHtml({ cols, n: cols[0].length, dropped: any.filter(Boolean).length - cols[0].length }, rep.map(j => vn(j))) };
  },
  anova2() {
    const R = state.db.roles, y = needRole('y', '目的変数'), a = needRole('a', '要因A'), b = needRole('b', '要因B'); need(a !== b, '要因Aと要因Bには別の列を選んでください。');
    const Y = dbCol(y).map(toNum), A = dbCol(a), B = dbCol(b), ok = Y.map((v, i) => isFinite(v) && A[i] !== '' && B[i] !== '');
    const yy = Y.filter((_, i) => ok[i]), aa = A.filter((_, i) => ok[i]), bb = B.filter((_, i) => ok[i]);
    const la = levelsOf(aa), lb = levelsOf(bb); need(la.length >= 2 && lb.length >= 2, '要因A・Bはそれぞれ2区分以上必要です。'); need(la.length * lb.length <= 40, '区分が多すぎます。');
    const order = (arr, lv) => arr.map(v => lv.indexOf(v));
    const X = S.anova2(yy, order(aa, la).map(i => la[i]), order(bb, lb).map(i => lb[i]));
    // anova2 は出現順で水準を作るので、表示は la/lb の順に並べ替える
    const ia = la.map(l => X.la.indexOf(l)), ib = lb.map(l => X.lb.indexOf(l));
    const nA = nm(a), nB = nm(b), name = { 'A': nA, 'B': nB, 'A×B': `${nA} × ${nB}` };
    let h = `<p class="note">目的変数 = ${nm(y)}、n = ${yy.length}${ok.filter(v => !v).length ? `（欠測などで ${ok.filter(v => !v).length} 行を除外）` : ''}。</p>`;
    h += '<h4>セルごとの平均 (SD) と人数</h4>' + table([`${nA} ＼ ${nB}`, ...lb.map(esc)], la.map((l, i) => [esc(l), ...lb.map((_, j) => { const c = X.cells[ia[i]][ib[j]]; return `${fmt(c.mean, 2)} (${fmt(c.sd, 2)}) n=${c.n}`; })]));
    h += '<h4>分散分析表（タイプIII平方和）</h4>' + table(['変動要因', '平方和', '自由度', '平均平方', 'F', 'p 値', '偏 η²'],
      [...X.terms.map(t => [name[t.name], fmt(t.ss), t.df, fmt(t.ms), fmt(t.F), pcell(t.p), fmt(t.peta2)]), ['誤差', fmt(X.error.ss), X.error.df, fmt(X.error.ms), '', '', '']]);
    h += '<p class="note">人数が群ごとに違っても SPSS の既定（タイプIII）と同じ結果になります。</p>';
    const inter = X.terms[2];
    const simpleTbl = (list, fixName, varyName, fixLv, varyLv, fixIdx, varyIdx) => {
      let t = table([`${fixName} の水準`, `${varyName} の効果 F`, '自由度', 'p 値', '偏 η²'], fixIdx.map(k => { const s = list[k]; return [esc(s.level), fmt(s.F), `${s.df}, ${X.error.df}`, pcell(s.p), fmt(s.peta2)]; }));
      if (varyLv.length > 2) { let lab = '', nt = ''; const adj = {}, kp = {}, varyA = varyName === nA, order = varyA ? ia : ib;
        fixIdx.forEach(k => { const nOf = v => (varyA ? X.cells[v][k] : X.cells[k][v]).n, V = varyLv.map((_, a) => varyLv.map((_, b) => a === b ? X.error.ms / nOf(a) : 0));
          const M = mcAdjust(list[k].pairs.map(p => ({ i: p.i, j: p.j, t: p.t, df: X.error.df, p: S.pt2(Math.abs(p.t), X.error.df), vec: varyLv.map((_, z) => (z === p.i) - (z === p.j)) })), varyLv.length, { pooled: true, V, order }); adj[k] = M.p; kp[k] = M.keep; lab = M.label; nt = M.note; });
        t += table(['水準', '組', '平均の差', 't', `調整済み p（${lab}）`], fixIdx.flatMap(k => list[k].pairs.map((p, q) => [p, q]).filter(([, q]) => kp[k][q]).map(([p, q]) => [esc(list[k].level), `${esc(X[varyA ? 'la' : 'lb'][p.i])} − ${esc(X[varyA ? 'la' : 'lb'][p.j])}`, fmt(p.diff), fmt(p.t), pcell(adj[k][q])]))) + (nt ? `<p class="note">${nt}</p>` : ''); }
      return t;
    };
    h += `<h4>単純主効果の検定 ${inter.p < .05 ? '（交互作用が有意なので、こちらを解釈します）' : '（交互作用は有意ではありません。参考として表示）'}</h4>`;
    h += simpleTbl(X.simpleA, nB, nA, lb, la, ib, ia) + simpleTbl(X.simpleB, nA, nB, la, lb, ia, ib);
    h += `<p class="note">単純主効果は全体の誤差平均平方を使った F 検定、水準が3つ以上のときの対比較は、解析パネルで選んだ多重比較の方法（${MC[state.opt.mc]}）で調整。</p>`;
    const T = X.terms, sA = X.simpleA.filter(x => x.p < .05).map(x => esc(x.level)), sB = X.simpleB.filter(x => x.p < .05).map(x => esc(x.level));
    h += interp(inter.p < .05 ? [`交互作用が有意（${pTxt(inter.p)}）です。これは「${nA}の効果が${nB}の水準によって違う」（逆もまた同じ）ことを意味します。この場合、主効果だけで結論を出さず、単純主効果で「どの条件のときに差があるか」を読みます。`,
        `${nA}の効果が有意だったのは、${nB}が ${sA.length ? sA.join('・') : '（なし）'} のとき、${nB}の効果が有意だったのは、${nA}が ${sB.length ? sB.join('・') : '（なし）'} のときです。交互作用図で線の開き方を確かめてください。`]
      : [`交互作用は有意ではありません（${pTxt(inter.p)}）。${nA}と${nB}の効果は互いに独立していると考え、主効果を読みます。`,
        `${nA}の主効果は${T[0].p < .05 ? `有意（${pTxt(T[0].p)}）で、${nB}に関係なく${nA}の水準によって平均が異なります` : `有意ではありません（${pTxt(T[0].p)}）`}。${nB}の主効果は${T[1].p < .05 ? `有意（${pTxt(T[1].p)}）です` : `有意ではありません（${pTxt(T[1].p)}）`}。`],
      `偏 η² は、ほかの要因の影響を除いたときにその要因で説明される割合で、.01 小・.06 中・.14 大が目安です（${nA} ${fmt(T[0].peta2, 2)}、${nB} ${fmt(T[1].peta2, 2)}、交互作用 ${fmt(inter.peta2, 2)}）。`);
    h += apa('論文記載例', `${nA}の主効果 <i>F</i>(${T[0].df}, ${X.error.df}) = ${fmt(T[0].F, 2)}, ${apaP(T[0].p)}, 偏 η² = ${fmt(T[0].peta2, 2)}；${nB}の主効果 <i>F</i>(${T[1].df}, ${X.error.df}) = ${fmt(T[1].F, 2)}, ${apaP(T[1].p)}, 偏 η² = ${fmt(T[1].peta2, 2)}；交互作用 <i>F</i>(${T[2].df}, ${X.error.df}) = ${fmt(T[2].F, 2)}, ${apaP(T[2].p)}, 偏 η² = ${fmt(T[2].peta2, 2)}。`);
    h += interPlot({ xl: la, ll: lb, get: (li, xi) => X.cellData[ia[xi]][ib[li]], xTitle: vn(a), yTitle: vn(y), lTitle: vn(b) });
    h += interPlot({ xl: lb, ll: la, get: (li, xi) => X.cellData[ia[li]][ib[xi]], xTitle: vn(b), yTitle: vn(y), lTitle: vn(a) });
    h += '<p class="note">交互作用図。線が平行なら交互作用なし、交差したり開いたりしていれば交互作用ありの目安です（2枚目は横軸と線を入れ替えたもの）。</p>';
    { const cm = {}; yy.forEach((v, i) => { const k = aa[i] + '\u0000' + bb[i]; (cm[k] = cm[k] || []).push(v); }); const mm = Object.fromEntries(Object.entries(cm).map(([k, v]) => [k, S.mean(v)])); h += normCheck([{ label: '残差（全体）', x: yy.map((v, i) => v - mm[aa[i] + '\u0000' + bb[i]]) }], { qqLabel: '標準化残差', title: '残差の正規性', need: '二元配置分散分析は、残差（各人の値 − そのセルの平均）が正規分布に従うことを前提にしています。' }); }
    return { title: `二元配置分散分析（${vn(a)} × ${vn(b)}）`, html: h };
  },
  mixed() {
    const R = state.db.roles, a = needRole('a', '要因A（参加者間の群）'); need(R.rep.length >= 2, '反復測定の列を2つ以上選んでください。');
    const rep = [...R.rep].sort((x, y) => x - y), A = dbCol(a), C = rep.map(j => dbCol(j).map(toNum)), ok = A.map((g, i) => g !== '' && C.every(c => isFinite(c[i])));
    const G = A.filter((_, i) => ok[i]), cols = C.map(c => c.filter((_, i) => ok[i])), lg = levelsOf(G); need(lg.length >= 2, '要因Aには2区分以上が必要です。');
    const X = S.mixedAnova(G, cols), gi = lg.map(l => X.lg.indexOf(l)), cn = rep.map(nm), nA = nm(a);
    let h = `<p class="note">参加者間要因 = ${nA}（${lg.map(esc).join('・')}）、参加者内要因 = 条件（${cn.join('・')}）、n = ${G.length}${ok.filter(v => !v).length ? `（欠測などで ${ok.filter(v => !v).length} 行を除外）` : ''}。</p>`;
    h += '<h4>平均 (SD)</h4>' + table([nA, 'n', ...cn], lg.map((l, i) => [esc(l), X.cells[gi[i]][0].n, ...X.cells[gi[i]].map(c => `${fmt(c.mean, 2)} (${fmt(c.sd, 2)})`)]));
    const w = X.within;
    h += '<h4>分散分析表</h4>' + table(['変動要因', '平方和', '自由度', '平均平方', 'F', 'p 値', 'GG 補正 p', 'HF 補正 p', '偏 η²'], [
      [`${nA}（参加者間）`, fmt(X.between.ss), X.between.df, fmt(X.between.ms), fmt(X.between.F), pcell(X.between.p), '', '', fmt(X.between.peta2)],
      ['誤差（参加者間）', fmt(X.errS.ss), X.errS.df, fmt(X.errS.ms), '', '', '', '', ''],
      ['条件', fmt(w[0].ss), w[0].df, fmt(w[0].ms), fmt(w[0].F), pcell(w[0].p), pcell(w[0].pGG), pcell(w[0].pHF), fmt(w[0].peta2)],
      [`${nA} × 条件`, fmt(w[1].ss), w[1].df, fmt(w[1].ms), fmt(w[1].F), pcell(w[1].p), pcell(w[1].pGG), pcell(w[1].pHF), fmt(w[1].peta2)],
      ['誤差（参加者内）', fmt(X.errW.ss), X.errW.df, fmt(X.errW.ms), '', '', '', '', '']]);
    h += `<p class="note">球面性の補正係数: Greenhouse-Geisser ε = ${fmt(X.eps)}、Huynh-Feldt ε = ${fmt(X.hf)}（Lecoutre の修正式。R・JASP と同じ）。群の人数が違う場合も SPSS のタイプIIIと同じ計算です。</p>`;
    h += `<h4>単純主効果の検定 ${w[1].p < .05 ? '（交互作用が有意なので、こちらを解釈します）' : '（交互作用は有意ではありません。参考として表示）'}</h4>`;
    h += table(['条件', `${nA}の効果 F`, '自由度', 'p 値', 'η²'], X.simpleG.map((s, k) => [cn[k], fmt(s.F), `${s.df1}, ${s.df2}`, pcell(s.p), fmt(s.peta2)]));
    h += table([nA, '条件の効果 F', '自由度', 'p 値', 'GG 補正 p', '偏 η²'], gi.map((k, i) => { const s = X.simpleT[k]; return [esc(lg[i]), fmt(s.F), `${s.df1}, ${s.df2}`, pcell(s.p), pcell(s.pGG), fmt(s.peta2)]; }));
    { let lab = '', nt = ''; const adj = gi.map(k => { const M = mcAdjust(X.simpleT[k].pairs.map(p => ({ i: p.i, j: p.j, t: p.t, df: p.df, p: p.pRaw })), cn.length, { what: '反復測定の条件の比較' }); lab = M.label; nt = M.note; return M; });
      h += table([nA, '組', '差の平均', 't', `調整済み p（${lab}）`], gi.flatMap((k, i) => X.simpleT[k].pairs.map((p, q) => [p, q]).filter(([, q]) => adj[i].keep[q]).map(([p, q]) => [esc(lg[i]), `${cn[p.i]} − ${cn[p.j]}`, fmt(p.diff), fmt(p.t), pcell(adj[i].p[q])]))) + (nt ? `<p class="note">${nt}</p>` : ''); }
    h += '<p class="note">各条件での群の効果は条件ごとの一元配置分散分析、各群での条件の効果はその群だけの反復測定分散分析、対比較は対応のある t 検定（解析パネルで選んだ方法で調整）。</p>';
    const sG = X.simpleG.map((x, k) => x.p < .05 ? cn[k] : null).filter(Boolean);
    h += interp(`条件（反復測定）の効果を読むときは、球面性の補正をした p 値を使います（GG ε = ${fmt(X.eps, 2)}。1 に近いほど補正の影響は小さい）。`,
      w[1].pGG < .05 ? `${nA} × 条件の交互作用が有意（GG 補正 ${pTxt(w[1].pGG)}）です。条件による変化のしかたが群によって違う、つまり「群によって変化の大きさや向きが異なる」ことを意味します。介入研究なら、介入の効果があったことを示す中心的な結果です。単純主効果では、群の差が有意だったのは ${sG.length ? sG.join('・') : '（なし）'} の時点でした。`
        : `${nA} × 条件の交互作用は有意ではありません（GG 補正 ${pTxt(w[1].pGG)}）。条件による変化のしかたは、群によって違うとはいえません。${w[0].pGG < .05 ? `条件の主効果は有意（${pTxt(w[0].pGG)}）で、群に関係なく得点が変化しています。` : ''}${X.between.p < .05 ? `${nA}の主効果は有意（${pTxt(X.between.p)}）で、全時点を平均すると群の間に差があります。` : ''}`);
    h += apa('論文記載例', `${nA}×条件の交互作用は${w[1].pGG < .05 ? '有意でした' : '有意ではありませんでした'}（Greenhouse-Geisser 補正, <i>F</i>(${fmt(w[1].df * X.eps, 2)}, ${fmt(X.errW.df * X.eps, 2)}) = ${fmt(w[1].F, 2)}, ${apaP(w[1].pGG)}, 偏 η² = ${fmt(w[1].peta2, 2)}）。`);
    const subj = state.opt.raw ? G.map((g, s) => ({ li: lg.indexOf(g), ys: cols.map(c => c[s]) })) : null;
    h += interPlot({ xl: rep.map(j => vn(j)), ll: lg, get: (li, xi) => cols[xi].filter((_, s) => G[s] === lg[li]), subj, yTitle: '', lTitle: vn(a) });
    h += `<p class="note">${state.opt.raw ? '薄い線は一人ひとりの変化。' : ''}太線が群ごとの平均の推移です。</p>`;
    { const res = cols.flatMap((c, j) => c.map((v, s) => v - S.mean(c.filter((_, q) => G[q] === G[s])))); h += normCheck([{ label: '残差（全体）', x: res }], { qqLabel: '標準化残差', title: '残差の正規性', need: '混合計画の分散分析は、残差（各値 − その群・条件の平均）が正規分布に従うことを前提にしています。' }); }
    return { title: `混合計画の分散分析（${vn(a)} × 条件）`, html: h };
  },
  mreg() {
    const P = mregPrep(), { y, yy, vars, ok } = P, SEL = selectVars(P, state.opt.method), sel = SEL.sel, steps = SEL.steps;
    const cols = sel.flatMap(k => vars[k].cols), names = sel.flatMap(k => vars[k].names), M = S.multiReg(yy, cols, names);
    let h = `<p class="note">目的変数 = ${nm(y)}、n = ${M.n}${ok.filter(v => !v).length ? `（欠測などで ${ok.filter(v => !v).length} 行を除外）` : ''}、方法 = ${METHOD_LABEL[state.opt.method]()}。</p>`;
    if (SEL.all) h += allSubsetsBlock(SEL.all, vars);
    if (steps.length) h += '<h4>変数選択の経過</h4>' + table(['手順', '操作', '変数', 'p 値'], steps.map((s, i) => [i + 1, ...s]));
    h += '<h4>偏回帰係数</h4>' + table(['', 'B', 'SE', 'β', 't', 'p 値', 'B の 95%CI', 'VIF'], M.coef.map(c => [esc(c.name), fmt(c.b), fmt(c.se), isFinite(c.beta) ? fmt(c.beta) : '', fmt(c.t), pcell(c.p), `[${fmt(c.L)}, ${fmt(c.U)}]`, c.vif ? { v: fmt(c.vif, 2), cls: c.vif > 10 ? 'sig' : '' } : '']));
    h += table(['R', 'R²', '調整済み R²', '推定の標準誤差', 'F', '自由度', 'p 値', 'Durbin-Watson'], [[fmt(M.R), fmt(M.r2), fmt(M.adjr2), fmt(M.se), fmt(M.F), `${M.df1}, ${M.df2}`, pcell(M.pF), fmt(M.dw, 2)]]);
    h += '<p class="note">β は標準偏回帰係数。VIF が 10 を超える（橙）と多重共線性の疑いがあります。カテゴリの列は最初の区分を基準にしたダミー変数（0/1）に自動で変換しています。</p>';
    const sc = M.coef.slice(1).filter(c => c.p < .05).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta)), hv = M.coef.filter(c => c.vif > 10);
    h += interp(sigW(M.pF, `モデル全体は有意（${pTxt(M.pF)}）で、説明変数のセットで${nm(y)}をある程度予測できます。R² = ${fmt(M.r2, 2)} は、${nm(y)}のばらつきの ${fmt(M.r2 * 100, 1)}% を説明できることを意味します（説明変数の数で補正した調整済み R² は ${fmt(M.adjr2, 2)}）。`, `モデル全体は有意ではありません（${pTxt(M.pF)}）。説明変数のセットで${nm(y)}を予測できるとはいえません。`),
      sc.length ? `ほかの変数の影響を一定にしたうえで有意だった説明変数は、${sc.map(c => `${esc(c.name)}（β = ${fmt(c.beta, 2)}、${c.beta > 0 ? '高いほど' : '低いほど'}${nm(y)}が高い）`).join('、')}です。β（標準偏回帰係数）の絶対値が大きいほど、相対的に影響が強いと読みます。` : '個々の説明変数には、有意なものはありませんでした。',
      hv.length ? `${hv.map(c => esc(c.name)).join('、')}は VIF が 10 を超えており、ほかの説明変数と強く相関しています（多重共線性）。係数が不安定なので、似た変数のどちらかを外すことを検討してください。` : 'VIF はすべて 10 未満で、多重共線性の心配はありません。',
      `Durbin-Watson 比 ${fmt(M.dw, 2)} は 2 に近いほど残差どうしが独立していることを示します（${M.dw > 1.5 && M.dw < 2.5 ? '問題ありません' : '1.5〜2.5 の範囲外なので、データの並び順に意味がある場合は注意が必要です'}）。`);
    h += apa('論文記載例', `重回帰分析の結果、モデルは${M.pF < .05 ? '有意でした' : '有意ではありませんでした'}（<i>F</i>(${M.df1}, ${M.df2}) = ${fmt(M.F, 2)}, ${apaP(M.pF)}, <i>R</i>² = ${fmt(M.r2, 2)}, 調整済み <i>R</i>² = ${fmt(M.adjr2, 2)}）。${M.coef.slice(1).filter(c => c.p < .05).map(c => `${esc(c.name)}（β = ${fmt(c.beta, 2)}, ${apaP(c.p)}）`).join('、') || '有意な説明変数はありませんでした'}${M.coef.slice(1).some(c => c.p < .05) ? 'が有意な予測因子でした' : ''}。`);
    h += '<h4>標準偏回帰係数の比較図</h4>' + coefPlot(M.coef.slice(1));
    h += `<div class="figrow">${xyPlot(M.fitted, yy, '予測値', '実測値', { ref: 'identity' })}</div><p class="note">予測値と実測値（点線上に並ぶほど当てはまりが良い）。</p>`;
    { const numK = names.map((nmx, k) => ({ nmx, k })).filter(o => !sel.some(q => vars[q].cat && vars[q].names.includes(o.nmx))); if (numK.length >= 2) h += '<h4>回帰平面の 3D プロット</h4>' + plane3dFor(yy, cols, names, M.coef.map(c => c.b), numK[0].k, numK[1].k, vn(y)) + `<p class="note">${esc(numK[0].nmx)} と ${esc(numK[1].nmx)} で描いた回帰平面です（ほかの説明変数は平均値に固定）。面の傾きが、それぞれの変数の偏回帰係数にあたります。</p>`; }
    h += regDiag(yy, cols, ok.map((v, i) => v ? i + 1 : 0).filter(Boolean)).html;

    const ci = sel.find(k => vars[k].cat), ni = sel.find(k => !vars[k].cat);
    if (ci != null && ni != null) {
      const g = vars[ci], xv = vars[ni].cols[0], gid = g.raw.map(v => g.lv.indexOf(v));
      const lines = g.lv.map((_, li) => { const xx = xv.filter((_, i) => gid[i] === li), yv = yy.filter((_, i) => gid[i] === li); if (xx.length < 3) return null; const r = S.regression(xx, yv); return { a: r.a, b: r.b, color: GC[li % 6] }; }).filter(Boolean);
      h += `<h4>群別の散布図（${esc(g.name)}ごとの回帰直線）</h4>` + xyPlot(xv, yy, vars[ni].name, vn(y), { groups: gid, groupNames: g.lv, lines });
      h += '<p class="note">線が平行なら傾きは群で同じ（交互作用なし）、平行でなければ交互作用を検討します。</p>';
    }
    return { title: `重回帰分析（${vn(y)}）`, html: h };
  }
};

// ----- 図を画像としてコピー -----
const LIGHT = { '--bg': '#eef1f0', '--sheet': '#ffffff', '--panel': '#f7f9f8', '--line': '#cfd8d5', '--grid': '#e3e9e7', '--fg': '#1b2624', '--muted': '#5b6b67', '--accent': '#17607a', '--accent-soft': '#dcecf1', '--sig': '#a3480f', '--sig-soft': '#fbe9dc', '--g1': '#17607a', '--g2': '#c0612b', '--g3': '#5d7f2a', '--g4': '#7b4f9e', '--g5': '#b23a56', '--g6': '#3e7d78' };
function svgToPng(svg) {
  return new Promise((res, rej) => {
    const vb = svg.viewBox.baseVal, W = vb.width, H = vb.height, sc = 3;
    let s = new XMLSerializer().serializeToString(svg).replace(/var\((--[\w-]+)\)/g, (m, v) => LIGHT[v] || '#000');
    if (!/xmlns=/.test(s.slice(0, 300))) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace(/^<svg([^>]*)>/, (m, at) => `<svg${at.replace(/class="[^"]*"/, '')} width="${W}" height="${H}"><style>text{font-family:"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;font-size:11px;fill:${LIGHT['--muted']}}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * sc; c.height = H * sc; const x = c.getContext('2d'); x.scale(sc, sc); x.drawImage(img, 0, 0, W, H); c.toBlob(b => b ? res(b) : rej(new Error('変換できませんでした')), 'image/png'); };
    img.onerror = () => rej(new Error('変換できませんでした'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
}
function decorateFigures(root) {
  root.querySelectorAll('svg.chart').forEach(svg => {
    if (svg.parentElement.classList.contains('fig')) return;
    const w = document.createElement('div'); w.className = 'fig'; svg.replaceWith(w); w.append(svg);
    w.insertAdjacentHTML('beforeend', '<div class="figbar"><button class="btn" data-fig="copy">図をコピー</button><button class="btn" data-fig="img">画像で表示</button></div>');
  });
}
async function figAction(btn) {
  const fig = btn.closest('.fig'), svg = fig.querySelector('svg.chart'), label = btn.textContent;
  const showImg = blob => { fig.querySelector('.figimg')?.remove(); const url = URL.createObjectURL(blob); fig.insertAdjacentHTML('beforeend', `<div class="figimg"><img src="${url}" alt="図の画像"><p class="note">画像を右クリック（スマホは長押し）すると、コピーや保存ができます。</p></div>`); };
  const p = svgToPng(svg);
  if (btn.dataset.fig === 'img') { try { showImg(await p); } catch (e) { btn.textContent = e.message; } return; }
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': p })]); btn.textContent = 'コピーしました（Word・PowerPoint に貼れます）'; }
  catch (e) { try { showImg(await p); btn.textContent = 'コピーできないため画像を表示しました'; } catch (e2) { btn.textContent = e2.message; } }
  setTimeout(() => btn.textContent = label, 2600);
}

$('#panelBody').addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]'); if (tb && state.fmt === 'db') { state.opt.dbTab = tb.dataset.tab; save(); renderDbPanel(); return; }
  const act = e.target.dataset.act; if (state.fmt !== 'db' || !act) return; const R = state.db.roles;
  if (act === 'faadd') return faMove([...FAUI.L], true);
  if (act === 'farem') return faMove([...FAUI.R], false);
  if (act === 'faall') return faMove([...document.querySelectorAll('.dlist[data-side="L"] .dli')].filter(x => x.style.display !== 'none').map(x => +x.dataset.fai), true);
  if (act === 'fanone') return faMove([...(R[FAUI.key] || [])], false);
  if (act === 'mmrev') R.mm = (R.mm || []).slice().reverse();
  save(); renderDbPanel(true);
});
$('#sheetBody').addEventListener('click', e => {
  const a = e.target.dataset.act, mk = { sample: [makeDbSample, 'basic'], scale: [makeScaleSample, 'fa'], binsample: [makeBinSample, 'reg'], rocsample: [makeRocSample, 'roc'], misssample: [makeMissSample, 'reg'], medsample: [makeMedModSample, 'medmod'], glmsample: [makeGlmSample, 'lmguide'], clsample: [makeClusterSample, 'cluster'], agsample: [makeAgreeSample, 'agree'], survsample: [makeSurvSample, 'surv'], semsample: [makeSemSample, 'sem'] }[a];
  if (!mk || state.fmt !== 'db') return; state.db = mk[0](); if (!state.db.semModel) state.db.semModel = emptySemModel(); state.opt.dbTab = mk[1]; save(); renderSheet(); renderPanel();
});

// ----- 因子分析の図 -----
const f2 = v => (v <= -0.005 ? '−' : '') + Math.abs(v).toFixed(2).replace(/^0/, '');
function screePlot(ev, pa, k) {
  const p = ev.length, W = 460, H = 270, M = { l: 44, r: 16, t: 30, b: 40 }, yt = niceTicks(0, Math.max(ev[0], pa[0]) * 1.05, 5);
  const fx = i => M.l + 14 + i * (W - M.l - M.r - 28) / Math.max(1, p - 1), fy = v => H - M.b - v / yt[yt.length - 1] * (H - M.t - M.b);
  let s = frame(W, H, M, yt, '固有値', fy);
  s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(1)}" y2="${fy(1)}" stroke="var(--muted)" stroke-dasharray="2 3"/>`;
  s += `<polyline points="${pa.map((v, i) => fx(i) + ',' + fy(v)).join(' ')}" fill="none" stroke="var(--sig)" stroke-width="1.6" stroke-dasharray="5 3"/>`;
  s += `<polyline points="${ev.map((v, i) => fx(i) + ',' + fy(v)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  ev.forEach((v, i) => s += `<circle cx="${fx(i)}" cy="${fy(v)}" r="${i < k ? 5 : 3.5}" fill="${i < k ? 'var(--accent)' : 'var(--sheet)'}" stroke="var(--accent)" stroke-width="1.5"/><text x="${fx(i)}" y="${H - M.b + 15}" text-anchor="middle">${i + 1}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">因子の番号</text>`;
  s += `<line x1="${W - 250}" x2="${W - 230}" y1="14" y2="14" stroke="var(--accent)" stroke-width="2"/><text x="${W - 226}" y="18">実データ</text><line x1="${W - 168}" x2="${W - 148}" y1="14" y2="14" stroke="var(--sig)" stroke-width="1.6" stroke-dasharray="5 3"/><text x="${W - 144}" y="18">平行分析（乱数の95%点）</text>`;
  return s + '</svg>';
}
function loadingHeat(names, P, h2, order, k) {
  const cw = 64, lw = labW(names, 120), rh = 24, W = lw + k * cw + 70, H = 34 + order.length * rh + 8;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:${Math.min(820, W * 1.25)}px">`;
  for (let j = 0; j < k; j++) s += `<text x="${lw + j * cw + cw / 2}" y="22" text-anchor="middle" style="fill:var(--fg)">第${j + 1}因子</text>`;
  s += `<text x="${lw + k * cw + 35}" y="22" text-anchor="middle">共通性</text>`;
  order.forEach((i, r) => {
    const y = 32 + r * rh;
    s += `<text x="${lw - 8}" y="${y + 16}" text-anchor="end" style="fill:var(--fg)">${esc(names[i])}</text>`;
    P[i].forEach((v, j) => { const a = Math.min(1, Math.abs(v)); s += `<rect x="${lw + j * cw + 1}" y="${y + 1}" width="${cw - 2}" height="${rh - 2}" rx="2" fill="${v >= 0 ? 'var(--accent)' : 'var(--g2)'}" fill-opacity="${(0.08 + a * 0.85).toFixed(2)}"/><text x="${lw + j * cw + cw / 2}" y="${y + 16}" text-anchor="middle" style="fill:${a > .5 ? 'var(--sheet)' : 'var(--fg)'};font-weight:${a >= .4 ? 600 : 400}">${f2(v)}</text>`; });
    s += `<rect x="${lw + k * cw + 8}" y="${y + 6}" width="${h2[i] * 54}" height="${rh - 12}" fill="var(--muted)" fill-opacity=".35"/><text x="${lw + k * cw + 64}" y="${y + 16}" text-anchor="end">${f2(h2[i])}</text>`;
  });
  return s + '</svg>';
}
function factorPlot(names, P, assign, a, b) {
  const W = 380, H = 380, M = 40, fx = v => M + (v + 1) / 2 * (W - 2 * M), fy = v => H - M - (v + 1) / 2 * (H - 2 * M);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:420px">`;
  [-1, -.5, 0, .5, 1].forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${fy(-1)}" y2="${fy(1)}" stroke="${v ? 'var(--grid)' : 'var(--line)'}"/><line x1="${fx(-1)}" x2="${fx(1)}" y1="${fy(v)}" y2="${fy(v)}" stroke="${v ? 'var(--grid)' : 'var(--line)'}"/><text x="${fx(v)}" y="${H - M + 14}" text-anchor="middle">${v}</text><text x="${M - 6}" y="${fy(v) + 4}" text-anchor="end">${v}</text>`);
  s += `<text x="${W - M}" y="${H - 8}" text-anchor="end" style="fill:var(--fg)">第${a + 1}因子</text><text x="${M}" y="${M - 12}" style="fill:var(--fg)">第${b + 1}因子</text>`;
  P.forEach((r, i) => s += `<circle cx="${fx(r[a])}" cy="${fy(r[b])}" r="4" fill="${GC[assign[i] % 6]}"/><text x="${fx(r[a]) + 6}" y="${fy(r[b]) - 5}" style="fill:var(--fg);font-size:10px">${esc(names[i])}</text>`);
  return s + '</svg>';
}
let FA_LAST_REL = null;
ANALYSES.db.fa = function () {
  const interpParts = [];
  const R = state.db.roles, items = [...R.fa].sort((a, b) => a - b); need(items.length >= 3, '因子分析の項目を3つ以上選んでください。');
  const C = items.map(j => dbCol(j).map(toNum)), ok = C[0].map((_, i) => C.every(c => isFinite(c[i]))), cols = C.map(c => c.filter((_, i) => ok[i])), n = cols[0].length, p = items.length;
  need(n > p + 2, `回答者の数（${n}）が項目数より十分多くないと計算できません。`);
  const zeroVar = items.filter((_, q) => S.sd(cols[q]) === 0); need(!zeroVar.length, `全員が同じ値の項目があります: ${zeroVar.map(nm).join('、')}`);
  const names = items.map(j => vn(j)), Rm = S.corMatrix(cols);
  let K; try { K = S.kmo(Rm); } catch (e) { throw new Error('相関行列の逆行列が計算できません。まったく同じ内容の項目がないか確認してください。'); }
  const B = S.bartlettSph(Rm, n), ev = S.eigSym(Rm).values, PA = S.parallel(n, p, 100);
  let nPA = 0; while (nPA < p && ev[nPA] > PA.q95[nPA]) nPA++; const nK = ev.filter(v => v > 1).length;
  const maxK = Math.floor((2 * p + 1 - Math.sqrt(8 * p + 1)) / 2);
  let k = state.opt.nf === 'auto' ? Math.max(1, nPA) : +state.opt.nf; if (state.opt.ext === 'ml' || state.opt.ext === 'gls') k = Math.min(k, Math.max(1, maxK)); k = Math.min(k, p - 1);
  if (!S.EXTRACTIONS[state.opt.ext]) state.opt.ext = 'ml'; if (!S.ROTATIONS[state.opt.rot]) state.opt.rot = 'promax';
  const F = S.factorAnalysis(cols, k, state.opt.ext, k > 1 ? state.opt.rot : 'none', state.opt.knorm), P = F.P;
  const assign = P.map(r => r.reduce((b, v, j) => Math.abs(v) > Math.abs(r[b]) ? j : b, 0));
  const order = P.map((_, i) => i).sort((a, b) => assign[a] - assign[b] || Math.abs(P[b][assign[b]]) - Math.abs(P[a][assign[a]]));
  const extName = S.EXTRACTIONS[state.opt.ext], rotName = k > 1 && state.opt.rot !== 'none' ? S.ROTATIONS[state.opt.rot][0] + '回転' + (state.opt.rot.startsWith('promax') || state.opt.rot === 'varimax' ? '' : state.opt.knorm ? '（Kaiser の正規化あり）' : '（正規化なし）') : '回転なし', oblique = !!F.Phi;
  const kmoLab = v => v >= .9 ? '非常に良い' : v >= .8 ? '良い' : v >= .7 ? '普通' : v >= .6 ? 'やや低い' : v >= .5 ? '低い' : '不適';
  let h = `<p class="note">項目数 = ${p}、n = ${n}${ok.filter(v => !v).length ? `（欠測のある ${ok.filter(v => !v).length} 行を除外）` : ''}、${extName}・${rotName}、因子数 = ${k}${state.opt.nf === 'auto' ? '（平行分析で自動決定）' : ''}。</p>`;
  h += '<h4>因子分析に向いたデータか</h4>' + table(['指標', '値', '目安'], [
    ['KMO（標本妥当性）', fmt(K.kmo), `${kmoLab(K.kmo)}（.6 以上が望ましい）`],
    ['Bartlett の球面性検定', `χ²(${B.df}) = ${fmt(B.chi, 2)}`, { v: fp(B.p), cls: B.p < .05 ? 'sig' : '' }]]);
  const lowMsa = names.filter((_, i) => K.msa[i] < .5); if (lowMsa.length) h += `<p class="warn">MSA が .50 未満の項目: ${lowMsa.map(esc).join('、')}（除くことを検討）</p>`;
  h += interp(`KMO = ${fmt(K.kmo, 2)} は「${kmoLab(K.kmo)}」です。KMO は、項目どうしの相関のうち共通の因子で説明できそうな部分の大きさを表し、1 に近いほど因子分析に向いています（.5 未満は不適、.6 以上が望ましい）。`,
    B.p < .05 ? `Bartlett の球面性検定が有意（χ²(${B.df}) = ${fmt(B.chi, 2)}, ${pTxt(B.p)}）であることは、「項目どうしの相関がすべて 0 である（相関行列が単位行列である）」という仮説が棄却されたことを意味します。つまり、項目の間には相関があり、背後に共通の因子を想定して分析する意味がある、ということです。ただし、この検定は人数が多いとほぼ必ず有意になるので、因子分析に向いているかどうかは KMO とあわせて判断します。`
      : `Bartlett の球面性検定が有意ではない（${pTxt(B.p)}）ので、項目どうしの相関がすべて 0 という可能性を否定できません。共通の因子を想定する根拠が弱く、因子分析には向かないデータです。`);
  h += '<h4>因子数の決め方</h4>' + screePlot(ev, PA.q95, k);
  h += `<p class="note">平行分析（実データの固有値が乱数データの 95%点を上回る数）では <b>${nPA}</b> 因子、カイザー基準（固有値 > 1）では <b>${nK}</b> 因子が示されます。スクリープロットで固有値の落ち込みが止まる手前の数も参考にしてください。</p>`;
  h += table(['因子', '固有値', '寄与率 %', '累積 %', '平行分析 95%点'], ev.slice(0, Math.min(p, Math.max(k + 2, 5))).map((v, i) => [i + 1, fmt(v), fmt(v / p * 100, 1), fmt(ev.slice(0, i + 1).reduce((a, b) => a + b, 0) / p * 100, 1), { v: fmt(PA.q95[i]), cls: v > PA.q95[i] ? 'sig' : '' }]));
  h += `<h4>${oblique ? 'パターン行列（因子負荷量）' : '因子負荷量'}</h4>` + table(['項目', ...Array.from({ length: k }, (_, j) => `第${j + 1}因子`), '共通性'],
    order.map(i => [esc(names[i]), ...P[i].map(v => ({ v: f2(v), cls: Math.abs(v) >= .4 ? 'sig hi' : '' })), f2(F.h2[i])]));
  h += '<p class="note">各項目を最も負荷の大きい因子ごとにまとめ、負荷量の大きい順に並べています。|負荷量| ≥ .40 を橙で示しています。</p>';
  h += loadingHeat(names, P, F.h2, order, k);
  const ssRows = [['回転前の負荷量平方和', ...F.ssu.map(v => fmt(v)), ''], ['　寄与率 %', ...F.ssu.map(v => fmt(v / p * 100, 1)), fmt(F.ssu.reduce((a, b) => a + b, 0) / p * 100, 1)]];
  if (k > 1 && state.opt.rot !== 'none' && F.ssl) ssRows.push(['回転後の負荷量平方和', ...F.ssl.map(v => fmt(v)), oblique ? '—' : fmt(F.ssl.reduce((a, b) => a + b, 0) / p * 100, 1) + ' %']);
  h += table(['', ...Array.from({ length: k }, (_, j) => `第${j + 1}因子`), '合計'], ssRows) + (oblique ? '<p class="note">斜交回転では因子どうしが相関するため、回転後の負荷量平方和は合計しません。</p>' : '');
  if (oblique) {
    h += '<h4>因子間相関</h4>' + table(['', ...Array.from({ length: k }, (_, j) => `第${j + 1}因子`)], F.Phi.map((r, i) => [`第${i + 1}因子`, ...r.map((v, j) => j <= i ? f2(v) : '')]));
    h += '<details><summary class="note" style="cursor:pointer">構造行列（項目と因子の相関）を表示</summary>' + table(['項目', ...Array.from({ length: k }, (_, j) => `第${j + 1}因子`)], order.map(i => [esc(names[i]), ...F.S[i].map(f2)])) + '</details>';
  }
  h += `<h4>モデルの適合度（${F.fit ? F.fit.label : extName}）</h4>` + table(F.fit ? ['χ²', '自由度', 'p 値', 'RMSEA', 'RMSR'] : ['RMSR（残差の二乗平均平方根）'], [F.fit ? [fmt(F.fit.chi, 2), F.fit.df, isFinite(F.fit.p) ? fp(F.fit.p) : '—', fmt(F.fit.rmsea), fmt(F.rmsr)] : [fmt(F.rmsr)]]) + '<p class="note">RMSR は相関行列の非対角要素について「実測の相関 − モデルが再現した相関」を二乗平均したもので、.05 以下が目安です。</p>';
  if (F.fit) h += '<p class="note">χ² 検定は「このモデルでデータを説明できる」という帰無仮説の検定で、p が大きいほど当てはまりが良いことを示します（標本が大きいと有意になりやすい）。RMSEA は .05 以下で良好、.08 以下で許容の目安です。</p>';
  { // 下位尺度の信頼性：負の負荷の項目は自動で反転して α と ω を求める（psych::alpha / psych::omega(nfactors = 1) と同じ定義）
    const allV = cols.flat(), lo = Math.min(...allV), hi = Math.max(...allV), rel = [];
    for (let j = 0; j < k; j++) {
      let its = order.filter(i => assign[i] === j && Math.abs(P[i][j]) >= .4);
      const neg = its.filter(i => P[i][j] < 0).length, flipAll = neg > its.length - neg; // 因子の向きは任意なので、多数派を正とみなす
      const rev = its.filter(i => (P[i][j] < 0) !== flipAll);
      const kc = its.map(i => rev.includes(i) ? cols[i].map(v => lo + hi - v) : cols[i]);
      let A = null, A0 = null, om = NaN;
      if (its.length >= 2) { A = S.cronbach(kc); if (rev.length) A0 = S.cronbach(its.map(i => cols[i])); }
      if (its.length >= 3) { const Rs = S.corMatrix(kc), L = S.extract(Rs, 1, 'uls', n).L, sR = S.sum(Rs.flat()); om = 1 - S.sum(L.map(r => 1 - Math.min(r[0] ** 2, 1))) / sR; }
      rel.push({ j, its, rev, A, A0, om });
    }
    FA_LAST_REL = { items: items.slice(), lo, hi, rel: rel.map(r => ({ its: r.its.map(i => items[i]), rev: r.rev.map(i => items[i]) })) };
    const anyRev = rel.some(r => r.rev.length);
    h += '<h4>下位尺度の信頼性（α 係数・ω 係数）</h4>' + table(['因子', '項目（|負荷量| ≥ .40）', '項目数', 'α', 'ω'], rel.map(r => [`第${r.j + 1}因子`, r.its.map(i => `<span title="${esc(state.db.cols[items[i]].label || '')}">${esc(state.db.cols[items[i]].name || names[i])}</span>` + (r.rev.includes(i) ? '<b style="color:var(--sig)">（逆転）</b>' : '')).join('・') || '—', r.its.length, r.A ? fmt(r.A.alpha) + (r.A0 ? `<br><small>反転しないと ${fmt(r.A0.alpha)}</small>` : '') : '—', isFinite(r.om) ? fmt(r.om) : '—']));
    h += `<p class="note">${anyRev ? `<b>負の負荷をもつ項目は、自動で得点を反転（${lo}＋${hi}−得点）してから計算しました</b>（psych::alpha の check.keys = TRUE と同じ考え方）。` : '負の負荷をもつ項目はありませんでした。'}α は Cronbach の α 係数、ω は McDonald の ω 係数です。ω は、その因子の項目だけで 1 因子モデル（最小残差法）を当てはめて求めた ω（total）で、psych::omega(nfactors = 1) と同じ値です。ω は 3 項目以上で計算します。</p>`;
    const det = rel.filter(r => r.A && r.its.length >= 3);
    if (det.length) h += '<details><summary class="note" style="cursor:pointer">項目ごとの詳しい情報（I-T 相関・項目を除いたときの α）を表示</summary>' + det.map(r => `<p class="note" style="margin-top:8px"><b>第${r.j + 1}因子</b></p>` + table(['項目', '内容', '反転', '平均', 'SD', 'I-T 相関（修正済み）', 'この項目を除いた α'], r.its.map((i, q) => { const c = state.db.cols[items[i]], it = r.A.items[q]; return [esc(c.name || names[i]), esc(c.label || ''), r.rev.includes(i) ? '逆転' : '', fmt(it.mean, 2), fmt(it.sd, 2), fmt(it.rit), `${fmt(it.aDel)}${it.aDel > r.A.alpha ? ' ↑' : ''}`]; }))).join('') + '<p class="note">I-T 相関は、その項目と「残りの項目の合計」との相関です（.30 未満は要注意）。「この項目を除いた α」に ↑ がある項目は、除くと α が上がります。項目を選び直すときの参考にしてください（ただし内容の妥当性も考えて判断します）。</p></details>';
    interpParts.push(`信頼性（内的一貫性）は、α と ω がおおむね .70 以上あれば十分とされます。` + rel.filter(r => r.A).map(r => `第${r.j + 1}因子は α = ${fmt(r.A.alpha, 2)}${isFinite(r.om) ? `、ω = ${fmt(r.om, 2)}` : ''}`).join('、') + `です。` + (anyRev ? `負の負荷をもつ逆転項目（${rel.flatMap(r => r.rev.map(i => esc(state.db.cols[items[i]].name || names[i]))).join('、')}）は、反転してから計算しています。反転しないまま α を求めると、値が不当に低くなります。` : '') + 'α はすべての項目の負荷量が等しいことを前提にしますが、ω はその前提がいらないため、近年は ω もあわせて報告することが勧められています。');
  }
  if (k >= 2) h += '<h4>因子負荷プロット</h4>' + `<div class="figrow">${factorPlot(names, P, assign, 0, 1)}${k >= 3 ? factorPlot(names, P, assign, 0, 2) : ''}</div>`;
  if (!F.conv) h += '<p class="warn">因子抽出の計算が収束しませんでした。因子数を減らすか、別の抽出法を試してください。</p>';
  if (F.rotConv === false) h += '<p class="warn">回転の計算が収束しませんでした（R の GPArotation でも同じ結果になります）。結果は参考程度にして、別の回転法を試してください。</p>';
  if (state.opt.ext === 'pca') h += '<p class="note">主成分分析は共通因子モデルではありません。ここでの「因子」は主成分、「共通性」は主成分で説明される分散の割合です。</p>';
  if (F.heywood) h += '<p class="warn">共通性が 1 に近い項目があります（ヘイウッドケース）。因子数や項目を見直してください。</p>';
  { const cross = order.filter(i => P[i].filter(v => Math.abs(v) >= .4).length >= 2).map(i => esc(names[i])), low = order.filter(i => Math.max(...P[i].map(Math.abs)) < .4).map(i => esc(names[i]));
    const phiMax = oblique && k > 1 ? Math.max(...F.Phi.flatMap((r, i) => r.filter((_, j) => j < i).map(Math.abs))) : 0;
    h += interp(`因子数は、平行分析で ${nPA}、固有値 1 以上の基準で ${nK} が示され、${k} 因子で分析しました。平行分析は、乱数データより大きい固有値の数を数える方法で、固有値 1 以上の基準より正確とされています。最終的には、因子の内容が解釈しやすいかどうかもあわせて決めます。`,
      `因子負荷量は、項目と因子の結びつきの強さです。|負荷量| が .40 以上の項目をその因子の項目とみなし、共通する内容から因子に名前をつけます。` + (low.length ? `どの因子にも .40 以上の負荷をもたない項目（${low.join('、')}）は、除いて分析し直すことを検討してください。` : '') + (cross.length ? `2 つ以上の因子に .40 以上の負荷をもつ項目（${cross.join('、')}）は、内容があいまいな可能性があります。` : '') + (!low.length && !cross.length ? 'すべての項目が 1 つの因子にだけ .40 以上の負荷をもつ、すっきりした構造（単純構造）です。' : ''),
      oblique && k > 1 ? `因子間相関の最大は ${fmt(phiMax, 2)} です。${phiMax >= .3 ? '因子どうしにある程度の相関があるので、斜交回転を選んだのは適切です。' : '因子どうしの相関は小さいので、直交回転（バリマックスなど）でもほぼ同じ解になります。'}${phiMax >= .8 ? ' ただし .80 を超える相関は、2 つの因子がほぼ同じものを測っている可能性を示します。' : ''}` : '',
      F.fit && isFinite(F.fit.rmsea) ? `RMSEA = ${fmt(F.fit.rmsea, 3)} は、モデルの当てはまりが${F.fit.rmsea <= .05 ? '良い' : F.fit.rmsea <= .08 ? 'まずまずの' : F.fit.rmsea <= .10 ? 'やや悪い' : '悪い'}ことを示します（.05 以下で良い、.08 以下で許容）。` : '', ...interpParts);
  }
  h += apa('論文記載例', `${p} 項目について${extName}・${rotName}による因子分析を行った。平行分析の結果から ${k} 因子解を採用した（KMO = ${fmt(K.kmo, 2)}, Bartlett の球面性検定 χ²(${B.df}) = ${fmt(B.chi, 2)}, ${apaP(B.p)}）。${k > 1 && state.opt.rot !== 'none' ? `回転後の${oblique ? '因子間相関は ' + F.Phi.flatMap((r, i) => r.slice(0, i)).map(v => f2(v)).join('、') + ' であった' : '負荷量平方和は ' + F.ssl.map(v => fmt(v, 2)).join('、') + ' であった'}。` : ''}`);
  return { title: `因子分析（${k} 因子・${extName}・${rotName}）`, html: h };
};

// ----- ロジスティック回帰の図 -----
function orPlot(coefs, what = 'オッズ比') {
  const L = labW(coefs.map(c => c.label || c.name), 170), W = 430 + L, rowH = 30, H = 64 + coefs.length * rowH, M = { l: L, r: 150, t: 26, b: 34 };
  const lo = Math.min(1, ...coefs.map(c => c.orL)), hi = Math.max(1, ...coefs.map(c => c.orU)), l0 = Math.log10(Math.max(lo, 1e-3)) - .05, l1 = Math.log10(Math.min(hi, 1e3)) + .05;
  const fx = v => M.l + (Math.log10(Math.min(Math.max(v, 1e-3), 1e3)) - l0) / (l1 - l0) * (W - M.l - M.r);
  const ticks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].filter(v => Math.log10(v) >= l0 && Math.log10(v) <= l1);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  ticks.forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t - 6}" y2="${H - M.b}" stroke="var(--grid)"/><text x="${fx(v)}" y="${H - M.b + 16}" text-anchor="middle">${v}</text>`);
  s += `<line x1="${fx(1)}" x2="${fx(1)}" y1="${M.t - 6}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${what}（対数目盛、横線は 95%信頼区間）</text><text x="${W - 70}" y="16" text-anchor="end">${what === 'オッズ比' ? 'OR' : 'HR'} [95%CI]</text><text x="${W - 6}" y="16" text-anchor="end">p 値</text>`;
  coefs.forEach((c, i) => {
    const y = M.t + 8 + i * rowH, sig = c.p < .05, col = sig ? 'var(--sig)' : 'var(--accent)';
    if (i % 2 === 0) s += `<rect x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="var(--panel)"/>`;
    s += `<text x="${M.l - 10}" y="${y + 4}" text-anchor="end" style="fill:var(--fg)">${esc(c.label || c.name)}</text>`;
    s += `<line x1="${fx(c.orL)}" x2="${fx(c.orU)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="1.6"/><rect x="${fx(c.or) - 5}" y="${y - 5}" width="10" height="10" fill="${sig ? col : 'var(--sheet)'}" stroke="${col}" stroke-width="1.6"/>`;
    s += `<text x="${W - 70}" y="${y + 4}" text-anchor="end" style="fill:var(--fg)">${fmt(c.or, 2)} [${fmt(c.orL, 2)}, ${fmt(c.orU, 2)}]</text><text x="${W - 6}" y="${y + 4}" text-anchor="end" style="fill:${sig ? 'var(--sig)' : 'var(--muted)'}">${fp(c.p)}${star(c.p)}</text>`;
  });
  return s + '</svg>';
}
function rocPlot(R) {
  const W = 360, H = 360, M = 44, f = v => M + v * (W - 2 * M), fy = v => H - M - v * (H - 2 * M);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:420px">`;
  [0, .2, .4, .6, .8, 1].forEach(v => s += `<line x1="${f(v)}" x2="${f(v)}" y1="${fy(0)}" y2="${fy(1)}" stroke="var(--grid)"/><line x1="${f(0)}" x2="${f(1)}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${f(v)}" y="${H - M + 14}" text-anchor="middle">${v}</text><text x="${M - 6}" y="${fy(v) + 4}" text-anchor="end">${v}</text>`);
  s += `<line x1="${f(0)}" y1="${fy(0)}" x2="${f(1)}" y2="${fy(1)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  s += `<path d="M${f(0)},${fy(0)} ${R.pts.map(p => `L${f(p.fpr).toFixed(1)},${fy(p.tpr).toFixed(1)}`).join(' ')} L${f(1)},${fy(1)} L${f(1)},${fy(0)} Z" fill="var(--accent)" fill-opacity=".12"/>`;
  s += `<polyline points="${R.pts.map(p => `${f(p.fpr).toFixed(1)},${fy(p.tpr).toFixed(1)}`).join(' ')} ${f(1)},${fy(1)}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
  const b = R.best; s += `<circle cx="${f(b.fpr)}" cy="${fy(b.tpr)}" r="5.5" fill="var(--sig)"/><text x="${f(b.fpr) + 9}" y="${fy(b.tpr) + 14}" style="fill:var(--sig)">最適点 p ≥ ${fmt(b.t, 3)}</text>`;
  s += `<text x="${f(.98)}" y="${fy(.08)}" text-anchor="end" style="fill:var(--fg);font-size:13px">AUC = ${fmt(R.auc, 3)}</text>`;
  s += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle">1 − 特異度（偽陽性率）</text><text x="${M}" y="${M - 14}" style="fill:var(--fg)">感度</text>`;
  return s + '</svg>';
}
function probStrip(prob, y, evName, nonName, cut) {
  const W = 520, H = 170, M = { l: 90, r: 16, t: 16, b: 34 }, fx = v => M.l + v * (W - M.l - M.r), R = rng(5);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, .25, .5, .75, 1].forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--grid)"/><text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${v}</text>`);
  [[1, evName, 'var(--sig)', 50], [0, nonName, 'var(--accent)', 105]].forEach(([g, nm, col, yc]) => {
    s += `<text x="${M.l - 10}" y="${yc + 4}" text-anchor="end" style="fill:var(--fg)">${esc(nm)}</text>`;
    prob.forEach((p, i) => { if (y[i] === g) s += `<circle cx="${fx(p)}" cy="${yc + (R() - .5) * 30}" r="2.8" fill="${col}" fill-opacity=".55"/>`; });
  });
  s += `<line x1="${fx(cut)}" x2="${fx(cut)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="4 3"/><text x="${fx(cut) + 4}" y="${M.t + 10}">最適カットオフ</text>`;
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">予測確率（${esc(evName)}になる確率）</text>`;
  return s + '</svg>';
}
function effectCurve(xv, yv, b, V, j, design, xn, evName) {
  const W = 320, H = 230, M = { l: 44, r: 12, t: 22, b: 38 }, x0 = Math.min(...xv), x1 = Math.max(...xv), xt = niceTicks(x0, x1, 5);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - v * (H - M.t - M.b);
  const pts = Array.from({ length: 61 }, (_, i) => { const x = x0 + (x1 - x0) * i / 60, g = [...design]; g[j] = x; const eta = S.sum(g.map((v, q) => v * b[q])); let ve = 0; for (let a = 0; a < g.length; a++) for (let c = 0; c < g.length; c++) ve += g[a] * V[a][c] * g[c]; const se = Math.sqrt(Math.max(ve, 0)), ex = t => 1 / (1 + Math.exp(-t)); return { x, p: ex(eta), lo: ex(eta - 1.96 * se), hi: ex(eta + 1.96 * se) }; });
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, .25, .5, .75, 1].forEach(v => s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${M.l - 6}" y="${fy(v) + 4}" text-anchor="end">${v}</text>`);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 14}" text-anchor="middle">${+v.toPrecision(6)}</text>`);
  s += `<path d="M${pts.map(p => `${fx(p.x).toFixed(1)},${fy(p.hi).toFixed(1)}`).join('L')}L${pts.slice().reverse().map(p => `${fx(p.x).toFixed(1)},${fy(p.lo).toFixed(1)}`).join('L')}Z" fill="var(--accent)" fill-opacity=".15"/>`;
  s += `<polyline points="${pts.map(p => `${fx(p.x).toFixed(1)},${fy(p.p).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
  const R = rng(9); xv.forEach((x, i) => s += `<line x1="${fx(x) + (R() - .5) * 2}" x2="${fx(x)}" y1="${fy(yv[i]) + (yv[i] ? 6 : -6)}" y2="${fy(yv[i])}" stroke="${yv[i] ? 'var(--sig)' : 'var(--muted)'}" stroke-opacity=".5"/>`);
  s += `<text x="${M.l}" y="14" style="fill:var(--fg)">${esc(xn)}</text><text x="${W - M.r}" y="14" text-anchor="end">${esc(evName)}の確率</text><text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(xn)}</text>`;
  return s + '</svg>';
}
ANALYSES.db.logit = function () {
  const R = state.db.roles; need(R.bin >= 0, '2値の目的変数を選んでください（値が2種類の列）。');
  const xs = R.x.filter(j => j !== R.bin); need(xs.length >= 1, '説明変数を1つ以上選んでください。');
  const Yraw = dbCol(R.bin), lv = levelsOf(Yraw); need(lv.length === 2, '目的変数の値はちょうど2種類である必要があります。');
  const ev = lv.includes(R.event) ? R.event : lv[1], non = lv.find(l => l !== ev);
  const V = xs.map(j => ({ j, t: colType(j), v: dbCol(j) }));
  const ok = Yraw.map((v, i) => v !== '' && V.every(x => x.v[i] !== '' && (x.t !== 'num' || isFinite(toNum(x.v[i])))));
  const yy = Yraw.filter((_, i) => ok[i]).map(v => +(v === ev));
  const vars = V.map(x => { const v = x.v.filter((_, i) => ok[i]);
    if (x.t === 'num') return { name: vn(x.j), cols: [v.map(toNum)], names: [vn(x.j)], cat: false };
    const l = levelsOf(v); return { name: vn(x.j), cols: l.slice(1).map(u => v.map(w => +(w === u))), names: l.slice(1).map(u => `${vn(x.j)}: ${u}（基準 ${l[0]}）`), cat: true }; }).filter(v => v.cols.length);
  const nPar = vars.reduce((s, v) => s + v.cols.length, 0), n1 = S.sum(yy); need(Math.min(n1, yy.length - n1) >= 5, `「${ev}」と「${non}」がそれぞれ5人以上必要です。`);
  const fitSel = sel => S.logistic(yy, sel.flatMap(k => vars[k].cols), sel.flatMap(k => vars[k].names));
  let sel = vars.map((_, k) => k), steps = [];
  if (state.opt.method === 'step') {
    sel = []; const LIM = .15, devOf = s2 => s2.length ? fitSel(s2).dev : -2 * (n1 * Math.log(n1 / yy.length) + (yy.length - n1) * Math.log(1 - n1 / yy.length));
    const pLR = (big, small, k) => S.pchiU(devOf(small) - devOf(big), vars[k].cols.length);
    for (let it = 0; it < 40; it++) {
      const cand = vars.map((_, k) => k).filter(k => !sel.includes(k)).map(k => ({ k, p: pLR([...sel, k], sel, k) })).sort((a, b) => a.p - b.p);
      if (!cand.length || cand[0].p >= LIM) break; sel.push(cand[0].k); steps.push(['追加', esc(vars[cand[0].k].name), fp(cand[0].p)]);
      const out = sel.map(k => ({ k, p: pLR(sel, sel.filter(q => q !== k), k) })).sort((a, b) => b.p - a.p);
      if (out.length > 1 && out[0].p >= LIM && out[0].k !== cand[0].k) { sel = sel.filter(k => k !== out[0].k); steps.push(['除去', esc(vars[out[0].k].name), fp(out[0].p)]); }
    }
    need(sel.length, '限界 p = .15 を下回る説明変数がありませんでした。');
  }
  const cols = sel.flatMap(k => vars[k].cols), names = sel.flatMap(k => vars[k].names), catFlags = sel.flatMap(k => vars[k].cols.map(() => vars[k].cat));
  const L = S.logistic(yy, cols, names), Rc = S.roc(L.fitted, yy), sdUnit = state.opt.orUnit === 'sd';
  const z = S.qn(0.025);
  const disp = L.coef.slice(1).map((c, j) => { const sc = sdUnit && !catFlags[j] ? c.sd : 1; return { ...c, label: c.name + (sdUnit && !catFlags[j] ? '（1 SD）' : ''), or: Math.exp(c.b * sc), orL: Math.exp((c.b - z * c.se) * sc), orU: Math.exp((c.b + z * c.se) * sc) }; });
  let h = `<p class="note">目的変数 = ${nm(R.bin)}（「${esc(ev)}」を 1、「${esc(non)}」を 0）、n = ${L.n}（${esc(ev)} ${L.n1} 人・${esc(non)} ${L.n - L.n1} 人）${ok.filter(v => !v).length ? `、欠測などで ${ok.filter(v => !v).length} 行を除外` : ''}、方法 = ${state.opt.method === 'step' ? 'ステップワイズ法（尤度比検定、投入・除去とも p < .15）' : state.opt.method === 'all' ? '強制投入法（総当たり法は重回帰分析だけで使えます）' : '強制投入法'}。</p>`;
  if (L.separation) h += '<p class="warn">計算が不安定です（完全分離または準完全分離の疑い）。ある説明変数で結果がほぼ完全に分かれていると、係数と標準誤差が非常に大きくなります。その変数を除くか、区分をまとめてください。</p>';
  if (Math.min(L.n1, L.n - L.n1) / Math.max(1, cols.length) < 10) h += `<p class="warn">少ないほうの群の人数が説明変数1つあたり10人未満です（EPV < 10）。推定が不安定になりやすいので、説明変数を絞ることを検討してください。</p>`;
  if (steps.length) h += '<h4>変数選択の経過</h4>' + table(['手順', '操作', '変数', 'p 値（尤度比）'], steps.map((s, i) => [i + 1, ...s]));
  h += '<h4>回帰係数とオッズ比</h4>' + table(['', 'B', 'SE', 'Wald χ²', 'p 値', `オッズ比${sdUnit ? '' : ''}`, '95%CI'], [
    ['切片', fmt(L.coef[0].b), fmt(L.coef[0].se), fmt(L.coef[0].wald, 2), pcell(L.coef[0].p), '', ''],
    ...disp.map(c => [esc(c.label), fmt(c.b), fmt(c.se), fmt(c.wald, 2), pcell(c.p), { v: fmt(c.or, 3), cls: c.p < .05 ? 'sig' : '' }, `[${fmt(c.orL, 3)}, ${fmt(c.orU, 3)}]`])]);
  h += `<p class="note">オッズ比は${sdUnit ? '数値の説明変数が 1 標準偏差増えたとき' : '説明変数が 1 単位増えたとき（カテゴリは基準に比べたとき）'}に「${esc(ev)}」のオッズが何倍になるか。1 より大きければ起こりやすく、小さければ起こりにくくなります。信頼区間は Wald 法（SPSS と同じ）。</p>`;
  h += '<h4>オッズ比の比較図</h4>' + orPlot(disp);
  h += '<h4>モデルの評価</h4>' + table(['指標', '値'], [
    ['モデルの尤度比検定', `χ²(${L.df}) = ${fmt(L.LR, 2)}, p ${L.pLR < .001 ? '< .001' : '= ' + fp(L.pLR)}`],
    ['−2 対数尤度（モデル／切片のみ）', `${fmt(L.dev, 2)} ／ ${fmt(L.dev0, 2)}`],
    ['Cox-Snell R² ／ Nagelkerke R² ／ McFadden R²', `${fmt(L.coxSnell)} ／ ${fmt(L.nagelkerke)} ／ ${fmt(L.mcfadden)}`],
    ['AIC', fmt(L.aic, 2)],
    ['Hosmer-Lemeshow 検定', isFinite(L.hl.p) ? `χ²(${L.hl.df}) = ${fmt(L.hl.chi, 2)}, p = ${fp(L.hl.p)}` : '—'],
    ['判別的中率（カットオフ .5）', `${fmt(L.acc * 100, 1)} %`]]);
  h += '<p class="note">Hosmer-Lemeshow 検定は p が .05 より大きければ「当てはまりが悪いとはいえない」と読みます。</p>';
  h += table([`実際 ＼ 予測（p ≥ .5）`, esc(non), esc(ev), '正解率'], [[esc(non), L.tab[0][0], L.tab[0][1], fmt(L.tab[0][0] / (L.tab[0][0] + L.tab[0][1]) * 100, 1) + ' %'], [esc(ev), L.tab[1][0], L.tab[1][1], fmt(L.tab[1][1] / (L.tab[1][0] + L.tab[1][1]) * 100, 1) + ' %']]);
  const b = Rc.best;
  h += '<h4>ROC 曲線（予測確率による判別）</h4>' + `<div class="figrow">${rocPlot(Rc)}<div>${table(['指標', '値'], [['AUC [95%CI]', `${fmt(Rc.auc, 3)} [${fmt(Rc.L, 3)}, ${fmt(Rc.U, 3)}]`], ['AUC = .5 の検定', `z = ${fmt(Rc.z, 2)}, p ${Rc.p < .001 ? '< .001' : '= ' + fp(Rc.p)}`], ['最適カットオフ（Youden 指数）', `予測確率 ≥ ${fmt(b.t, 3)}`], ['そのときの感度', fmt(b.tpr, 3)], ['そのときの特異度', fmt(1 - b.fpr, 3)]])}<p class="note">AUC の信頼区間は DeLong 法。AUC は .7 以上で許容、.8 以上で良好、.9 以上で優秀が目安です。</p></div></div>`;
  h += '<h4>予測確率の分布</h4>' + probStrip(L.fitted, yy, ev, non, b.t);
  const numIdx = catFlags.map((c, j) => c ? -1 : j).filter(j => j >= 0).slice(0, 6);
  if (numIdx.length) {
    const design = [1, ...cols.map(c => S.mean(c))];
    h += '<h4>説明変数ごとの予測確率（ほかの変数は平均値に固定）</h4>' + `<div class="figrow">${numIdx.map(j => effectCurve(cols[j], yy, L.coef.map(c => c.b), L.inv || design.map(() => design.map(() => 0)), j + 1, design, names[j], ev)).join('')}</div>`;
    h += '<p class="note">帯は 95%信頼区間。上下の短い線は実際のデータ（上＝事象あり、下＝なし）です。</p>';
  }
  const sigs = disp.filter(c => c.p < .05);
  h += interp(sigW(L.pLR, `モデルは有意（${pTxt(L.pLR)}）で、説明変数を入れると「${esc(ev)}」になるかどうかの予測が、何も使わない場合より良くなります。Nagelkerke R² = ${fmt(L.nagelkerke, 2)} は説明力の目安です（重回帰の R² ほど厳密な意味はありません）。`, `モデルは有意ではありません（${pTxt(L.pLR)}）。説明変数で「${esc(ev)}」を予測できるとはいえません。`),
    sigs.length ? `有意だった説明変数：${sigs.map(c => { const u = catFlags[disp.indexOf(c)] ? '基準の群に比べて' : sdUnit ? '1 SD 増えると' : '1 増えると'; return `${esc(c.label)}（オッズ比 ${fmt(c.or, 2)}：${c.or > 1 ? `${u}「${esc(ev)}」のオッズが ${fmt(c.or, 2)} 倍になる` : `${u}「${esc(ev)}」のオッズが ${fmt((1 - c.or) * 100, 0)}% 低い`}）`; }).join('、')}。オッズ比の 95%信頼区間が 1 をまたがなければ有意です。` : '個々の説明変数には、有意なものはありませんでした。',
    isFinite(L.hl.p) ? `Hosmer-Lemeshow 検定は ${pTxt(L.hl.p)} で、${L.hl.p >= .05 ? '予測確率と実際の割合のずれは大きくない（当てはまりに問題はない）と読みます。' : '予測確率と実際の割合にずれがあり、当てはまりが良くない可能性があります。'}` : '',
    `AUC = ${fmt(Rc.auc, 2)} は、「${esc(ev)}」の人と「${esc(non)}」の人を 1 人ずつ選んだとき、前者のほうが高い予測確率になる確率です。${Rc.auc >= .9 ? '判別力は優秀です。' : Rc.auc >= .8 ? '判別力は良好です。' : Rc.auc >= .7 ? '判別力は許容範囲です。' : '判別力は低めです。'}`);
  h += apa('論文記載例', `${esc(vn(R.bin))}（${esc(ev)}／${esc(non)}）を目的変数とするロジスティック回帰分析の結果、モデルは${L.pLR < .05 ? '有意であった' : '有意ではなかった'}（χ²(${L.df}) = ${fmt(L.LR, 2)}, ${apaP(L.pLR)}, Nagelkerke <i>R</i>² = ${fmt(L.nagelkerke, 2)}）。${sigs.length ? sigs.map(c => `${esc(c.label)}（<i>OR</i> = ${fmt(c.or, 2)}, 95% CI [${fmt(c.orL, 2)}, ${fmt(c.orU, 2)}], ${apaP(c.p)}）`).join('、') + 'が有意な予測因子であった。' : '有意な予測因子はなかった。'}`);
  return { title: `ロジスティック回帰（${vn(R.bin)}）`, html: h };
};

// ----- 重回帰：変数選択（強制投入・ステップワイズ・総当たり） -----
const CRIT_LABEL = { aic: 'AIC', bic: 'BIC', adjr2: '調整済み R²', cp: 'Mallows の Cp' };
const METHOD_LABEL = { enter: () => '強制投入法', step: () => 'ステップワイズ法（変数増減法、投入・除去とも p < .15）', all: () => `総当たり法（${CRIT_LABEL[state.opt.crit]}が最良のモデル）` };
function mregPrep() {
  const R = state.db.roles, y = needRole('y', '目的変数'), xs = R.x.filter(j => j !== y); need(xs.length >= 1, '説明変数を1つ以上選んでください。');
  const Y = dbCol(y).map(toNum), V = xs.map(j => ({ j, t: colType(j), v: dbCol(j) }));
  const ok = Y.map((v, i) => isFinite(v) && V.every(x => x.v[i] !== '' && (x.t !== 'num' || isFinite(toNum(x.v[i])))));
  const yy = Y.filter((_, i) => ok[i]);
  const vars = V.map(x => {
    const v = x.v.filter((_, i) => ok[i]);
    if (x.t === 'num') return { name: vn(x.j), cols: [v.map(toNum)], names: [vn(x.j)], cat: false, raw: v };
    const lv = levelsOf(v); return { name: vn(x.j), cols: lv.slice(1).map(l => v.map(u => +(u === l))), names: lv.slice(1).map(l => `${vn(x.j)}: ${l}（基準 ${lv[0]}）`), cat: true, raw: v, lv };
  }).filter(v => v.cols.length);
  need(yy.length > vars.reduce((s, v) => s + v.cols.length, 0) + 1, '人数が説明変数の数より多くないと計算できません。');
  const sst = S.sum(yy.map(v => (v - S.mean(yy)) ** 2));
  const sseOf = sel => { const cols = sel.flatMap(k => vars[k].cols); return cols.length ? S.ols(yy.map((_, i) => [1, ...cols.map(c => c[i])]), yy).sse : sst; };
  return { y, yy, vars, ok, sst, sseOf, kOf: sel => sel.reduce((s, k) => s + vars[k].cols.length, 0) };
}
function modelIndex(P, sel, mseFull) {
  const n = P.yy.length, k = P.kOf(sel), sse = P.sseOf(sel), r2 = 1 - sse / P.sst, ll = -n / 2 * (Math.log(2 * Math.PI) + Math.log(sse / n) + 1);
  return { sel, k, sse, r2, adjr2: 1 - (1 - r2) * (n - 1) / (n - k - 1), aic: -2 * ll + 2 * (k + 2), bic: -2 * ll + Math.log(n) * (k + 2), cp: mseFull ? sse / mseFull - n + 2 * (k + 1) : NaN };
}
function selectVars(P, method) {
  const { vars } = P, all = vars.map((_, k) => k);
  if (method === 'enter') return { sel: all, steps: [] };
  if (method === 'step') {
    const dfOf = sel => P.yy.length - 1 - P.kOf(sel);
    const pPartial = (base, k, adding) => { const big = adding ? [...base, k] : base, small = adding ? base : base.filter(q => q !== k); const q = vars[k].cols.length, df = dfOf(big); const F = (P.sseOf(small) - P.sseOf(big)) / q / (P.sseOf(big) / df); return S.pfU(F, q, df); };
    let sel = [], steps = []; const LIM = 0.15;
    for (let it = 0; it < 40; it++) {
      const cand = all.filter(k => !sel.includes(k)).map(k => ({ k, p: pPartial(sel, k, true) })).sort((a, b) => a.p - b.p);
      if (!cand.length || cand[0].p >= LIM) break;
      sel.push(cand[0].k); steps.push(['追加', esc(vars[cand[0].k].name), fp(cand[0].p)]);
      const out = sel.map(k => ({ k, p: pPartial(sel, k, false) })).sort((a, b) => b.p - a.p);
      if (out.length > 1 && out[0].p >= LIM && out[0].k !== cand[0].k) { sel = sel.filter(k => k !== out[0].k); steps.push(['除去', esc(vars[out[0].k].name), fp(out[0].p)]); }
    }
    need(sel.length, '限界 p = .15 を下回る説明変数がありませんでした。');
    return { sel, steps };
  }
  need(vars.length <= 15, `総当たり法は説明変数 15 個まで（${2 ** 15 - 1} 通り）にしてください。いまは ${vars.length} 個です。`);
  const full = modelIndex(P, all), mseFull = full.sse / (P.yy.length - full.k - 1), models = [];
  for (let m = 1; m < 2 ** vars.length; m++) { const sel = all.filter(k => m & (1 << k)); if (P.kOf(sel) >= P.yy.length - 2) continue; models.push(modelIndex(P, sel, mseFull)); }
  const c = state.opt.crit, key = m => c === 'adjr2' ? -m.adjr2 : m[c];
  models.sort((a, b) => key(a) - key(b));
  return { sel: models[0].sel, steps: [], all: { models, crit: c } };
}
function allSubsetsBlock(A, vars) {
  const c = A.crit, top = A.models.slice(0, 10);
  let h = `<h4>総当たり法：${A.models.length} 通りのモデルのうち${CRIT_LABEL[c]}の良い順に上位 10</h4>` + table(['順位', '説明変数', '数', 'R²', '調整済み R²', 'AIC', 'BIC', 'Cp'], top.map((m, i) => [i + 1, m.sel.map(k => esc(vars[k].name)).join('・'), m.k, fmt(m.r2), fmt(m.adjr2), fmt(m.aic, 2), fmt(m.bic, 2), fmt(m.cp, 2)]));
  h += `<p class="note">AIC・BIC・Cp は小さいほど、調整済み R² は大きいほど良いモデルです。BIC は AIC より変数の少ないモデルを選びやすい傾向があります。Cp は変数の数 + 1 に近く小さいものが良いとされます。下では 1 位のモデルを詳しく示します。</p>`;
  h += subsetMap(A.models, c);
  return h;
}
function subsetMap(models, c) { // 変数の数ごとに全モデルの基準値を打点
  const val = m => m[c], W = 460, H = 280, M = { l: 56, r: 16, t: 24, b: 40 }, ks = models.map(m => m.k), kmax = Math.max(...ks), kmin = Math.min(...ks);
  const vs = models.map(val), yt = niceTicks(Math.min(...vs), Math.max(...vs));
  const fx = k => M.l + 20 + (k - kmin) / Math.max(1, kmax - kmin) * (W - M.l - M.r - 40), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), R = rng(3);
  let s = frame(W, H, M, yt, CRIT_LABEL[c], fy);
  models.forEach(m => s += `<circle cx="${fx(m.k) + (R() - .5) * 14}" cy="${fy(val(m))}" r="2.6" fill="var(--muted)" fill-opacity=".45"/>`);
  const better = (a, b) => c === 'adjr2' ? a > b : a < b, best = {};
  models.forEach(m => { if (best[m.k] == null || better(val(m), best[m.k])) best[m.k] = val(m); });
  const bk = Object.keys(best).map(Number).sort((a, b) => a - b);
  s += `<polyline points="${bk.map(k => `${fx(k)},${fy(best[k])}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  bk.forEach(k => s += `<circle cx="${fx(k)}" cy="${fy(best[k])}" r="4" fill="var(--accent)"/><text x="${fx(k)}" y="${H - M.b + 15}" text-anchor="middle">${k}</text>`);
  s += `<circle cx="${fx(models[0].k)}" cy="${fy(val(models[0]))}" r="7" fill="none" stroke="var(--sig)" stroke-width="2"/><text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">説明変数の数（ダミー変数は個別に数える）</text><text x="${W - M.r}" y="16" text-anchor="end">灰色＝全モデル　青＝各数での最良　赤丸＝選ばれたモデル</text>`;
  return s + '</svg>';
}
function coefCompare(rows, methods) { // 方法ごとの β を並べた図
  const L = labW(rows.map(r => r.name), 170), W = 430 + L, rowH = 18 + methods.length * 10, H = 60 + rows.length * rowH, M = { l: L, r: 20, t: 34, b: 34 };
  const vals = rows.flatMap(r => r.vals.filter(v => v)).flatMap(v => [v.betaL, v.betaU]);
  const xt = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 6), fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  xt.forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t - 4}" y2="${H - M.b}" stroke="var(--grid)"/><text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(4)}</text>`);
  s += `<line x1="${fx(0)}" x2="${fx(0)}" y1="${M.t - 4}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="3 3"/>`;
  let lx = M.l; methods.forEach((m, i) => { s += `<rect x="${lx}" y="8" width="12" height="10" rx="2" fill="${GC[i]}"/><text x="${lx + 16}" y="17" style="fill:var(--fg)">${esc(m)}</text>`; lx += 30 + m.length * 12; });
  rows.forEach((r, i) => {
    const y0 = M.t + i * rowH; if (i % 2 === 0) s += `<rect x="0" y="${y0}" width="${W}" height="${rowH}" fill="var(--panel)"/>`;
    s += `<text x="${M.l - 10}" y="${y0 + rowH / 2 + 4}" text-anchor="end" style="fill:var(--fg)">${esc(r.name)}</text>`;
    r.vals.forEach((v, j) => { const y = y0 + 9 + j * 10; if (!v) { s += `<text x="${fx(0) + 6}" y="${y + 3}" style="font-size:9px">（含まれない）</text>`; return; }
      s += `<line x1="${fx(v.betaL)}" x2="${fx(v.betaU)}" y1="${y}" y2="${y}" stroke="${GC[j]}" stroke-width="1.4"/><circle cx="${fx(v.beta)}" cy="${y}" r="3.6" fill="${v.p < .05 ? GC[j] : 'var(--sheet)'}" stroke="${GC[j]}" stroke-width="1.4"/>`; });
  });
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">標準偏回帰係数 β と 95%信頼区間（塗りつぶし＝p < .05）</text>`;
  return s + '</svg>';
}
ANALYSES.db.mregcmp = function () {
  const P = mregPrep(), methods = [['enter', '強制投入法'], ['step', 'ステップワイズ法'], ['all', `総当たり法（${CRIT_LABEL[state.opt.crit]}）`]];
  const fits = methods.map(([m]) => { let S2; try { S2 = selectVars(P, m); } catch (e) { return { err: e.message }; } const cols = S2.sel.flatMap(k => P.vars[k].cols), names = S2.sel.flatMap(k => P.vars[k].names); return { S2, M: S2.sel.length ? S.multiReg(P.yy, cols, names) : null, idx: modelIndex(P, S2.sel) }; });
  const allNames = P.vars.flatMap(v => v.names);
  const rows = allNames.map(nmv => ({ name: nmv, vals: fits.map(f => f.M ? f.M.coef.slice(1).find(c => c.name === nmv) || null : null) }));
  const cell = c => c ? { v: `${fmt(c.beta)}${star(c.p)}`, cls: c.p < .05 ? 'sig' : '' } : '—';
  let h = `<p class="note">目的変数 = ${nm(P.y)}、n = ${P.yy.length}。3 つの方法で選ばれた変数と標準偏回帰係数 β を並べています（— はその方法で選ばれなかった変数）。</p>`;
  h += table(['説明変数', ...methods.map(m => m[1])], [
    ...rows.map(r => [esc(r.name), ...r.vals.map(cell)]),
    ['<b>変数の数</b>', ...fits.map(f => f.M ? f.idx.k : '—')],
    ['<b>R²</b>', ...fits.map(f => f.M ? fmt(f.idx.r2) : '—')],
    ['<b>調整済み R²</b>', ...fits.map(f => f.M ? fmt(f.idx.adjr2) : '—')],
    ['<b>AIC</b>', ...fits.map(f => f.M ? fmt(f.idx.aic, 2) : '—')],
    ['<b>BIC</b>', ...fits.map(f => f.M ? fmt(f.idx.bic, 2) : '—')],
    ['<b>モデルの F 検定</b>', ...fits.map(f => f.M ? `F(${f.M.df1}, ${f.M.df2}) = ${fmt(f.M.F, 2)}<br>p ${f.M.pF < .001 ? '< .001' : '= ' + fp(f.M.pF)}` : (f.err || '—'))]]);
  h += '<p class="note">数値は β（* p < .05、** p < .01、*** p < .001）。強制投入法は仮説に基づいて全変数を入れる方法、ステップワイズ法と総当たり法はデータから変数を選ぶ方法です。データから選んだモデルの p 値は楽観的になりやすいので、論文では選び方を明記してください。</p>';
  h += coefCompare(rows, methods.map(m => m[1]));
  const st = fits[1].S2; if (st && st.steps.length) h += '<h4>ステップワイズ法の経過</h4>' + table(['手順', '操作', '変数', 'p 値'], st.steps.map((s, i) => [i + 1, ...s]));
  const al = fits[2].S2; if (al && al.all) h += allSubsetsBlock(al.all, P.vars);
  return { title: `重回帰：方法の比較（${vn(P.y)}）`, html: h };
};

// ----- 生存時間分析 -----
function survData(extraCols) {
  const R = state.db.roles; need(R.time >= 0, '生存時間の列を選んでください。'); need(R.st >= 0, 'イベントの列を選んでください（値が2種類の列）。');
  const T = dbCol(R.time).map(toNum), Sraw = dbCol(R.st), lv = levelsOf(Sraw); need(lv.length === 2, 'イベントの列の値はちょうど2種類である必要があります。');
  const ev = lv.includes(R.stev) ? R.stev : lv[1], cen = lv.find(l => l !== ev);
  const ok = T.map((t, i) => isFinite(t) && t >= 0 && Sraw[i] !== '' && extraCols.every(c => c.ok(i)));
  return { T: T.filter((_, i) => ok[i]), E: Sraw.filter((_, i) => ok[i]).map(v => +(v === ev)), ok, ev, cen, tName: vn(R.time) };
}
function kmPlot(groups, tName) {
  const cum = state.opt.survY === 'cum', ci = state.opt.survCI, tmax = Math.max(...groups.map(g => g.tmax)), xt = niceTicks(0, tmax, 6).filter(v => v <= tmax * 1.001 || v === 0);
  const L = groups.length, W = 600, M = { l: 100, r: 22, t: 26, b: 44 }, plotH = 250, tabH = 20 + L * 16, H = M.t + plotH + M.b + tabH;
  const x1 = xt[xt.length - 1] >= tmax ? xt[xt.length - 1] : tmax, fx = t => M.l + t / x1 * (W - M.l - M.r), fy = v => M.t + plotH - (cum ? 1 - v : v) * plotH;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, .25, .5, .75, 1].forEach(v => s += `<line x1="${M.l}" x2="${W - M.r}" y1="${M.t + plotH - v * plotH}" y2="${M.t + plotH - v * plotH}" stroke="var(--grid)"/><text x="${M.l - 6}" y="${M.t + plotH - v * plotH + 4}" text-anchor="end">${v}</text>`);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${M.t + plotH + 15}" text-anchor="middle">${+v.toPrecision(6)}</text>`);
  s += `<text x="${M.l - 40}" y="${M.t - 10}" style="fill:var(--fg)">${cum ? '累積イベント率' : '生存率'}</text><text x="${(M.l + W - M.r) / 2}" y="${M.t + plotH + 32}" text-anchor="middle">${esc(tName)}</text>`;
  groups.forEach((g, gi) => {
    const col = GC[gi % 6], st = g.km.steps; let path = `M${fx(0)},${fy(1)}`, prev = 1;
    st.forEach(p => { path += `L${fx(p.t).toFixed(1)},${fy(prev).toFixed(1)}L${fx(p.t).toFixed(1)},${fy(p.S).toFixed(1)}`; prev = p.S; });
    path += `L${fx(g.tmax).toFixed(1)},${fy(prev).toFixed(1)}`;
    if (ci && st.length) { let up = `M${fx(0)},${fy(1)}`, lo = '', pu = 1, pl = 1; const segs = [];
      st.forEach(p => { const U = isFinite(p.U) ? p.U : pu, Lw = p.L; segs.push([p.t, pu, pl, U, Lw]); pu = U; pl = Lw; });
      let top = `M${fx(0)},${fy(1)}`, bot = []; let cu = 1, cl = 1;
      segs.forEach(([t, , , U, Lw]) => { top += `L${fx(t)},${fy(cu)}L${fx(t)},${fy(U)}`; bot.push([t, cl, Lw]); cu = U; cl = Lw; });
      top += `L${fx(g.tmax)},${fy(cu)}L${fx(g.tmax)},${fy(cl)}`;
      for (let k = bot.length - 1; k >= 0; k--) { const [t, before, after] = bot[k]; top += `L${fx(t)},${fy(after)}L${fx(t)},${fy(before)}`; }
      s += `<path d="${top}L${fx(0)},${fy(1)}Z" fill="${col}" fill-opacity=".12"/>`; }
    s += `<path d="${path}" fill="none" stroke="${col}" stroke-width="2.2"/>`;
    g.km.cens.forEach(c => s += `<line x1="${fx(c.t)}" x2="${fx(c.t)}" y1="${fy(c.S) - 5}" y2="${fy(c.S) + 5}" stroke="${col}" stroke-width="1.5"/>`);
    if (isFinite(g.km.median) && !cum) s += `<line x1="${M.l}" x2="${fx(g.km.median)}" y1="${fy(.5)}" y2="${fy(.5)}" stroke="${col}" stroke-dasharray="3 3" stroke-opacity=".7"/><line x1="${fx(g.km.median)}" x2="${fx(g.km.median)}" y1="${fy(.5)}" y2="${M.t + plotH}" stroke="${col}" stroke-dasharray="3 3" stroke-opacity=".7"/>`;
  });
  let lx = M.l; if (L > 1) groups.forEach((g, gi) => { s += `<rect x="${lx}" y="7" width="14" height="10" rx="2" fill="${GC[gi % 6]}"/><text x="${lx + 18}" y="16" style="fill:var(--fg)">${esc(g.name)}</text>`; lx += 30 + g.name.length * 12; });
  s += `<text x="${W - M.r}" y="16" text-anchor="end">縦の短い線＝打ち切り${!cum ? '、点線＝中央値' : ''}</text>`;
  const ty = M.t + plotH + M.b + 6; s += `<text x="${M.l - 12}" y="${ty + 6}" text-anchor="end" style="fill:var(--fg)">リスク集合</text>`;
  groups.forEach((g, gi) => { const y = ty + 22 + gi * 16; s += `<text x="${M.l - 12}" y="${y}" text-anchor="end" style="fill:${GC[gi % 6]}">${esc(g.name.length > 7 ? g.name.slice(0, 7) + '…' : g.name)}</text>`; xt.forEach(v => s += `<text x="${fx(v)}" y="${y}" text-anchor="middle" style="fill:var(--fg)">${g.km.atRisk(v)}</text>`); });
  return s + '</svg>';
}
function logLogPlot(groups, tName) {
  const W = 420, H = 260, M = { l: 52, r: 16, t: 22, b: 40 }, pts = groups.map(g => g.km.steps.filter(p => p.S > 0 && p.S < 1 && p.t > 0).map(p => ({ x: Math.log(p.t), y: Math.log(-Math.log(p.S)) })));
  const all = pts.flat(); if (all.length < 2) return '';
  const xt = niceTicks(Math.min(...all.map(p => p.x)), Math.max(...all.map(p => p.x))), yt = niceTicks(Math.min(...all.map(p => p.y)), Math.max(...all.map(p => p.y)));
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, 'log(−log 生存率)', fy);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(3)}</text>`);
  pts.forEach((ps, gi) => { if (!ps.length) return; let d = `M${fx(ps[0].x)},${fy(ps[0].y)}`; for (let k = 1; k < ps.length; k++) d += `L${fx(ps[k].x)},${fy(ps[k - 1].y)}L${fx(ps[k].x)},${fy(ps[k].y)}`; s += `<path d="${d}" fill="none" stroke="${GC[gi % 6]}" stroke-width="2"/>`; });
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">log(${esc(tName)})</text>`;
  return s + '</svg>';
}
ANALYSES.db.km = function () {
  const R = state.db.roles, A = R.a >= 0 ? dbCol(R.a) : null;
  const D = survData(A ? [{ ok: i => A[i] !== '' }] : []), G = A ? A.filter((_, i) => D.ok[i]) : D.T.map(() => '全体');
  const lv = levelsOf(G); need(lv.length <= 8, '要因Aの区分が多すぎます（8 まで）。'); need(D.T.length >= 3, 'データが少なすぎます。');
  const groups = lv.map(l => { const t = D.T.filter((_, i) => G[i] === l), e = D.E.filter((_, i) => G[i] === l); return { name: l, km: S.kaplanMeier(t, e), tmax: Math.max(...t), n: t.length, e: S.sum(e) }; });
  const tName = D.tName, ticks = niceTicks(0, Math.max(...D.T), 4).filter(v => v > 0 && v < Math.max(...D.T)).slice(0, 3);
  let h = `<p class="note">生存時間 = ${esc(tName)}、イベント = ${nm(R.st)} が「${esc(D.ev)}」（「${esc(D.cen)}」は打ち切り）、n = ${D.T.length}${D.ok.filter(v => !v).length ? `（欠測などで ${D.ok.filter(v => !v).length} 行を除外）` : ''}${A ? `、群 = ${nm(R.a)}` : '（要因Aを選ぶと群ごとに比べます）'}。</p>`;
  h += table(['群', 'n', 'イベント', '打ち切り', '生存期間中央値 [95%CI]', ...ticks.map(t => `${+t.toPrecision(6)} 時点の生存率 [95%CI]`)], groups.map(g => {
    const atT = t => { let st = null; for (const p of g.km.steps) { if (p.t <= t) st = p; else break; } return st ? `${fmt(st.S, 3)} [${fmt(st.L, 3)}, ${fmt(st.U, 3)}]` : '1.000'; };
    const md = v => isFinite(v) ? fmt(v, 1) : '未到達'; return [esc(g.name), g.n, g.e, g.n - g.e, `${md(g.km.median)} [${md(g.km.medL)}, ${md(g.km.medU)}]`, ...ticks.map(atT)]; }));
  h += '<p class="note">中央値は生存率が 0.5 を下回る最初の時点。「未到達」は観察期間内に生存率が 0.5 を下回らなかったことを示します。信頼区間は log 変換（R の survfit と同じ）。</p>';
  h += kmPlot(groups, tName);
  if (lv.length >= 2) {
    const tests = [['ログランク検定（Mantel-Haenszel）', 'logrank', '後半の差に敏感'], ['一般化 Wilcoxon 検定（Gehan-Breslow）', 'gehan', '前半の差に敏感'], ['Tarone-Ware 検定', 'tarone', '中間'], ['Peto-Peto 検定', 'peto', '前半の差に敏感']].map(([nmT, w, note]) => { const r = S.survDiff(D.T, D.E, G, w); return [nmT, `χ²(${r.df}) = ${fmt(r.chi, 3)}`, pcell(r.p), note]; });
    h += '<h4>群間の差の検定</h4>' + table(['検定', '統計量', 'p 値', '特徴'], tests);
    const LR = S.survDiff(D.T, D.E, G, 'logrank');
    h += table(['群', '観測イベント数 O', '期待イベント数 E', 'O / E'], LR.levels.map((l, k) => [esc(l), LR.O[k], fmt(LR.E[k], 2), fmt(LR.O[k] / LR.E[k], 2)]));
    if (lv.length >= 3) {
      const P = S.pairs(lv.length).map(([i, j]) => { const idx = G.map((g, k) => g === lv[i] || g === lv[j] ? k : -1).filter(k => k >= 0), r = S.survDiff(idx.map(k => D.T[k]), idx.map(k => D.E[k]), idx.map(k => G[k]), 'logrank'); return { i, j, chi: r.chi, p: r.p }; });
      const MK = mcAdjust(P.map(r => ({ i: r.i, j: r.j, p: r.p })), lv.length, { what: 'ログランク検定' }), hp = MK.p; h += `<h4>群の対比較（ログランク検定、${MK.label}）</h4>` + table(['組', 'χ²', 'p 値', `調整済み p（${MK.label}）`], P.map((r, k) => [r, k]).filter(([, k]) => MK.keep[k]).map(([r, k]) => [`${esc(lv[r.i])} vs ${esc(lv[r.j])}`, fmt(r.chi, 3), fp(r.p), pcell(hp[k])])) + mcNote(MK);
    }
    const ll = logLogPlot(groups, tName); if (ll) h += '<h4>二重対数プロット（比例ハザード性の確認）</h4>' + ll + '<p class="note">線がほぼ平行なら比例ハザード性が成り立っていると考えられ、ログランク検定や Cox 回帰が適しています。線が交差する場合は一般化 Wilcoxon 検定も参考にしてください。</p>';
    const GB = S.survDiff(D.T, D.E, G, 'gehan'), oe = LR.levels.map((l, k) => [l, LR.O[k] / LR.E[k]]).sort((a, b) => b[1] - a[1]);
    h += interp(sigW(LR.p, `ログランク検定は有意（${pTxt(LR.p)}）で、群によってイベントの起こりやすさ（生存曲線）が違うといえます。O/E（実際のイベント数 ÷ 群に差がない場合の期待数）が最も大きい「${esc(oe[0][0])}」（${fmt(oe[0][1], 2)}）が最もイベントが起きやすく、最も小さい「${esc(oe[oe.length - 1][0])}」（${fmt(oe[oe.length - 1][1], 2)}）が最も起きにくい群です。`, `ログランク検定は有意ではありません（${pTxt(LR.p)}）。群によって生存曲線が違うとはいえません。${NS_NOTE}`),
      (GB.p < .05) !== (LR.p < .05) ? `一般化 Wilcoxon 検定（${pTxt(GB.p)}）とは結論が分かれました。ログランク検定は観察期間の後半、一般化 Wilcoxon 検定は前半の差に敏感なので、差が生じている時期が違う可能性があります。生存曲線の形を確かめてください。` : `一般化 Wilcoxon 検定（${pTxt(GB.p)}）も同じ結論です。`,
      '生存期間中央値は、半数の人にイベントが起きるまでの時間です。打ち切り（途中で追跡できなくなった人）を考慮して推定しています。');
    h += apa('論文記載例', `Kaplan-Meier 法で推定した${esc(tName)}の生存曲線を${esc(vn(R.a))}で比較したところ、ログランク検定で${LR.p < .05 ? '有意な差が認められた' : '有意な差は認められなかった'}（χ²(${LR.df}) = ${fmt(LR.chi, 2)}, ${apaP(LR.p)}）。`);
  }
  h += '<details><summary class="note" style="cursor:pointer">生存率の表（イベント時点ごと）を表示</summary>' + groups.map(g => `<h4>${esc(g.name)}</h4>` + table(['時点', 'リスク集合', 'イベント', '打ち切り', '生存率', '95%CI'], g.km.steps.map(p => [fmt(p.t, 2), p.n, p.d, p.c, fmt(p.S, 4), `[${fmt(p.L, 4)}, ${fmt(p.U, 4)}]`]))).join('') + '</details>';
  return { title: `生存曲線（${tName}${A ? '・' + vn(R.a) + '別' : ''}）`, html: h };
};
ANALYSES.db.cox = function () {
  const R = state.db.roles, xs = R.x.filter(j => j !== R.time && j !== R.st); need(xs.length >= 1, '説明変数を1つ以上選んでください。');
  const V = xs.map(j => ({ j, t: colType(j), v: dbCol(j) }));
  const D = survData(V.map(x => ({ ok: i => x.v[i] !== '' && (x.t !== 'num' || isFinite(toNum(x.v[i]))) })));
  const vars = V.map(x => { const v = x.v.filter((_, i) => D.ok[i]);
    if (x.t === 'num') return { name: vn(x.j), cols: [v.map(toNum)], names: [vn(x.j)], cat: false, j: x.j };
    const l = levelsOf(v); return { name: vn(x.j), cols: l.slice(1).map(u => v.map(w => +(w === u))), names: l.slice(1).map(u => `${vn(x.j)}: ${u}（基準 ${l[0]}）`), cat: true, lv: l, raw: v, j: x.j }; }).filter(v => v.cols.length);
  const nEv = S.sum(D.E); need(nEv >= 5, 'イベントが5件以上必要です。');
  const fitSel = sel => S.cox(D.T, D.E, sel.flatMap(k => vars[k].cols), sel.flatMap(k => vars[k].names));
  let sel = vars.map((_, k) => k), steps = [];
  if (state.opt.method === 'step') {
    sel = []; const LIM = .15, llOf = s2 => s2.length ? fitSel(s2).ll : fitSel([0]).ll0;
    const pLR = (big, small, k) => S.pchiU(2 * (llOf(big) - llOf(small)), vars[k].cols.length);
    for (let it = 0; it < 40; it++) {
      const cand = vars.map((_, k) => k).filter(k => !sel.includes(k)).map(k => ({ k, p: pLR([...sel, k], sel, k) })).sort((a, b) => a.p - b.p);
      if (!cand.length || cand[0].p >= LIM) break; sel.push(cand[0].k); steps.push(['追加', esc(vars[cand[0].k].name), fp(cand[0].p)]);
      const out = sel.map(k => ({ k, p: pLR(sel, sel.filter(q => q !== k), k) })).sort((a, b) => b.p - a.p);
      if (out.length > 1 && out[0].p >= LIM && out[0].k !== cand[0].k) { sel = sel.filter(k => k !== out[0].k); steps.push(['除去', esc(vars[out[0].k].name), fp(out[0].p)]); }
    }
    need(sel.length, '限界 p = .15 を下回る説明変数がありませんでした。');
  }
  const C = fitSel(sel), catFlags = sel.flatMap(k => vars[k].cols.map(() => vars[k].cat)), sdUnit = state.opt.orUnit === 'sd', z = S.qn(0.025);
  const disp = C.coef.map((c, j) => { const sc = sdUnit && !catFlags[j] ? c.sd : 1; return { ...c, label: c.name + (sdUnit && !catFlags[j] ? '（1 SD）' : ''), or: Math.exp(c.b * sc), orL: Math.exp((c.b - z * c.se) * sc), orU: Math.exp((c.b + z * c.se) * sc) }; });
  let h = `<p class="note">生存時間 = ${esc(D.tName)}、イベント = 「${esc(D.ev)}」、n = ${C.n}（イベント ${C.events} 件）${D.ok.filter(v => !v).length ? `、欠測などで ${D.ok.filter(v => !v).length} 行を除外` : ''}、方法 = ${state.opt.method === 'step' ? 'ステップワイズ法（尤度比検定、投入・除去とも p < .15）' : state.opt.method === 'all' ? '強制投入法（総当たり法は重回帰分析だけで使えます）' : '強制投入法'}、同時イベントの扱い = Efron 法（R の coxph と同じ）。</p>`;
  if (!C.conv || C.coef.some(c => Math.abs(c.b) > 15)) h += '<p class="warn">計算が不安定です。ある群でイベントがまったく起きていないなどの理由で、係数が非常に大きくなっている可能性があります。</p>';
  if (C.events / Math.max(1, C.coef.length) < 10) h += '<p class="warn">イベント数が説明変数1つあたり10件未満です（EPV < 10）。推定が不安定になりやすいので、説明変数を絞ることを検討してください。</p>';
  if (steps.length) h += '<h4>変数選択の経過</h4>' + table(['手順', '操作', '変数', 'p 値（尤度比）'], steps.map((s, i) => [i + 1, ...s]));
  h += '<h4>回帰係数とハザード比</h4>' + table(['', 'B', 'SE', 'z', 'p 値', 'ハザード比', '95%CI'], disp.map(c => [esc(c.label), fmt(c.b), fmt(c.se), fmt(c.z, 2), pcell(c.p), { v: fmt(c.or, 3), cls: c.p < .05 ? 'sig' : '' }, `[${fmt(c.orL, 3)}, ${fmt(c.orU, 3)}]`]));
  h += `<p class="note">ハザード比は${sdUnit ? '数値の説明変数が 1 標準偏差増えたとき' : '説明変数が 1 単位増えたとき（カテゴリは基準に比べたとき）'}に、その時点でイベントが起こる速さが何倍になるか。1 より大きければ起こりやすく（生存時間が短く）、小さければ起こりにくくなります。</p>`;
  h += '<h4>ハザード比の比較図</h4>' + orPlot(disp, 'ハザード比');
  h += '<h4>モデルの評価</h4>' + table(['検定・指標', '値'], [['尤度比検定', `χ²(${C.df}) = ${fmt(C.LR, 2)}, p ${C.pLR < .001 ? '< .001' : '= ' + fp(C.pLR)}`], ['Wald 検定', `χ²(${C.df}) = ${fmt(C.wald, 2)}, p ${C.pWald < .001 ? '< .001' : '= ' + fp(C.pWald)}`], ['スコア検定（ログランク）', `χ²(${C.df}) = ${fmt(C.score, 2)}, p ${C.pScore < .001 ? '< .001' : '= ' + fp(C.pScore)}`], ['C 統計量（Harrell の一致度）', fmt(C.C, 3)], ['−2 対数部分尤度（モデル／帰無）', `${fmt(-2 * C.ll, 2)} ／ ${fmt(-2 * C.ll0, 2)}`]]);
  h += '<p class="note">C 統計量は生存時間の長短をモデルがどれだけ正しく順位づけできるかで、.5 が偶然、1 が完全です。</p>';
  // 推定生存曲線：要因Aがカテゴリの説明変数として入っていればその水準ごと、なければ平均的な人
  const gk = sel.find(k => vars[k].cat && vars[k].j === R.a) ?? sel.find(k => vars[k].cat);
  const allCols = sel.flatMap(k => vars[k].cols), offs = []; let o = 0; sel.forEach(k => { offs[k] = o; o += vars[k].cols.length; });
  const curves = (gk != null ? vars[gk].lv : ['平均的な対象者']).map((lvName, li) => { const x = allCols.map(c => S.mean(c)); if (gk != null) vars[gk].cols.forEach((_, q) => x[offs[gk] + q] = +(q === li - 1)); const lpv = S.sum(x.map((v, q) => (v - C.mu[q]) * C.b[q]));
    const steps2 = C.H0.map(p => ({ t: p.t, S: Math.exp(-p.H * Math.exp(lpv)), L: NaN, U: NaN, n: 0, d: 1 })); return { name: lvName, km: { steps: steps2, cens: [], median: (() => { const f = steps2.find(p => p.S < .5); return f ? f.t : NaN; })(), atRisk: () => '' }, tmax: Math.max(...D.T) }; });
  const ciSave = state.opt.survCI; state.opt.survCI = false;
  h += `<h4>Cox モデルによる推定生存曲線${gk != null ? `（${esc(vars[gk].name)}別、ほかの変数は平均値）` : '（説明変数がすべて平均値の人）'}</h4>` + kmPlot(curves, D.tName).replace(/<text[^>]*>リスク集合<\/text>[\s\S]*?(?=<\/svg>)/, '');
  state.opt.survCI = ciSave;
  const sigs = disp.filter(c => c.p < .05);
  h += interp(sigW(C.pLR, `モデルは有意（尤度比検定 ${pTxt(C.pLR)}）です。`, `モデルは有意ではありません（${pTxt(C.pLR)}）。`) + ` C 統計量 ${fmt(C.C, 2)} は、モデルが「先にイベントが起きる人」を正しく見分けられる確率です（.5 は偶然、.7 以上で良好）。`,
    sigs.length ? `有意だった説明変数：${sigs.map(c => { const u = catFlags[disp.indexOf(c)] ? '基準の群に比べて' : sdUnit ? '1 SD 増えると' : '1 増えると'; return `${esc(c.label)}（ハザード比 ${fmt(c.or, 2)}：${u}イベントの起こりやすさが ${c.or > 1 ? fmt(c.or, 2) + ' 倍' : fmt((1 - c.or) * 100, 0) + '% 低い'}）`; }).join('、')}。ハザード比は「ある時点でまだイベントが起きていない人が、次の瞬間にイベントを起こす危険の比」で、1 より大きいと危険が高く、1 より小さいと低いことを意味します。` : '個々の説明変数には、有意なものはありませんでした。',
    'Cox 回帰は、ハザード比が観察期間を通じて一定（比例ハザード性）であることを前提にしています。Kaplan-Meier の二重対数プロットで線がほぼ平行かを確かめてください。');
  h += apa('論文記載例', `Cox 比例ハザード回帰分析の結果、${sigs.length ? sigs.map(c => `${esc(c.label)}（<i>HR</i> = ${fmt(c.or, 2)}, 95% CI [${fmt(c.orL, 2)}, ${fmt(c.orU, 2)}], ${apaP(c.p)}）`).join('、') + 'が有意な予測因子であった' : '有意な予測因子は認められなかった'}（尤度比検定 χ²(${C.df}) = ${fmt(C.LR, 2)}, ${apaP(C.pLR)}）。`);
  return { title: `Cox 比例ハザード回帰（${D.tName}）`, html: h };
};

// ----- ROC分析（単独） -----
function rocMultiPlot(list) { // list: [{ name, r, col }]
  const W = 400, H = 400, M = 46, f = v => M + v * (W - 2 * M), fy = v => H - M - v * (H - 2 * M), legH = list.length * 18;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:460px">`;
  [0, .2, .4, .6, .8, 1].forEach(v => s += `<line x1="${f(v)}" x2="${f(v)}" y1="${fy(0)}" y2="${fy(1)}" stroke="var(--grid)"/><line x1="${f(0)}" x2="${f(1)}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${f(v)}" y="${H - M + 14}" text-anchor="middle">${v}</text><text x="${M - 6}" y="${fy(v) + 4}" text-anchor="end">${v}</text>`);
  s += `<line x1="${f(0)}" y1="${fy(0)}" x2="${f(1)}" y2="${fy(1)}" stroke="var(--muted)" stroke-dasharray="4 3"/>`;
  if (list.length === 1) { const R = list[0].r; s += `<path d="M${f(0)},${fy(0)} ${R.pts.map(p => `L${f(p.fpr).toFixed(1)},${fy(p.tpr).toFixed(1)}`).join(' ')} L${f(1)},${fy(1)} L${f(1)},${fy(0)} Z" fill="${list[0].col}" fill-opacity=".12"/>`; }
  list.forEach(({ r, col }) => s += `<polyline points="${r.pts.map(p => `${f(p.fpr).toFixed(1)},${fy(p.tpr).toFixed(1)}`).join(' ')} ${f(1)},${fy(1)}" fill="none" stroke="${col}" stroke-width="2.2"/>`);
  list.forEach(({ b, col }) => s += `<circle cx="${f(b.fpr)}" cy="${fy(b.tpr)}" r="5" fill="${col}" stroke="var(--sheet)" stroke-width="1.4"/>`);
  const lx = f(.36), ly = fy(0) - 10 - legH; s += `<rect x="${lx - 8}" y="${ly - 4}" width="${f(1) - lx + 4}" height="${legH + 6}" fill="var(--sheet)" fill-opacity=".85"/>`;
  list.forEach(({ name, r, col }, i) => s += `<line x1="${lx}" x2="${lx + 18}" y1="${ly + 9 + i * 18}" y2="${ly + 9 + i * 18}" stroke="${col}" stroke-width="2.6"/><text x="${lx + 24}" y="${ly + 13 + i * 18}" style="fill:var(--fg)">${esc(name)}  AUC = ${fmt(r.auc, 3)}</text>`);
  s += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle">1 − 特異度（偽陽性率）</text><text x="${M}" y="${M - 14}" style="fill:var(--fg)">感度（真陽性率）</text><text x="${f(1)}" y="${M - 14}" text-anchor="end">点＝最適カットオフ</text>`;
  return s + '</svg>';
}
function rocStrip(x, lab, posName, negName, cut, high, xn) { // 群ごとの得点の分布とカットオフ
  const W = 440, H = 190, M = { l: 86, r: 16, t: 22, b: 38 }, xt = niceTicks(Math.min(...x), Math.max(...x), 6), Rn = rng(3);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  xt.forEach(v => s += `<line x1="${fx(v)}" x2="${fx(v)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--grid)"/><text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(6)}</text>`);
  const x0 = high ? fx(cut) : M.l, x1 = high ? W - M.r : fx(cut);
  s += `<rect x="${x0}" y="${M.t}" width="${Math.max(0, x1 - x0)}" height="${H - M.t - M.b}" fill="var(--sig-soft)" fill-opacity=".6"/><text x="${high ? W - M.r - 4 : M.l + 4}" y="${M.t + 12}" text-anchor="${high ? 'end' : 'start'}" style="fill:var(--sig)">陽性と判定</text>`;
  [[1, posName, 'var(--sig)', 62], [0, negName, 'var(--accent)', 118]].forEach(([g, nmv, col, yc]) => {
    s += `<text x="${M.l - 10}" y="${yc + 4}" text-anchor="end" style="fill:var(--fg)">${esc(nmv)}</text>`;
    x.forEach((v, i) => { if (lab[i] === g) s += `<circle cx="${fx(v) + (Rn() - .5) * 3}" cy="${yc + (Rn() - .5) * 34}" r="2.8" fill="${col}" fill-opacity=".55"/>`; });
  });
  s += `<line x1="${fx(cut)}" x2="${fx(cut)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="4 3"/><text x="${fx(cut)}" y="${M.t - 6}" text-anchor="middle" style="fill:var(--fg)">カットオフ ${+cut.toPrecision(6)}</text>`;
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(xn)}</text>`;
  return s + '</svg>';
}
function sensSpecPlot(rows, cut, xn) { // カットオフ値ごとの感度・特異度
  const W = 380, H = 230, M = { l: 44, r: 14, t: 26, b: 38 }, xs = rows.map(r => r.x), xt = niceTicks(Math.min(...xs), Math.max(...xs), 6);
  const fx = v => M.l + (v - xt[0]) / (xt[xt.length - 1] - xt[0]) * (W - M.l - M.r), fy = v => H - M.b - v * (H - M.t - M.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  [0, .25, .5, .75, 1].forEach(v => s += `<line x1="${M.l}" x2="${W - M.r}" y1="${fy(v)}" y2="${fy(v)}" stroke="var(--grid)"/><text x="${M.l - 6}" y="${fy(v) + 4}" text-anchor="end">${v}</text>`);
  xt.forEach(v => s += `<text x="${fx(v)}" y="${H - M.b + 15}" text-anchor="middle">${+v.toPrecision(6)}</text>`);
  const srt = rows.slice().sort((a, b) => a.x - b.x), line = (k, col) => s += `<polyline points="${srt.map(r => `${fx(r.x).toFixed(1)},${fy(r[k]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>`;
  line('sens', 'var(--sig)'); line('spec', 'var(--accent)');
  s += `<line x1="${fx(cut)}" x2="${fx(cut)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--fg)" stroke-dasharray="4 3"/>`;
  s += `<line x1="${M.l}" x2="${M.l + 16}" y1="12" y2="12" stroke="var(--sig)" stroke-width="2.4"/><text x="${M.l + 20}" y="16" style="fill:var(--fg)">感度</text><line x1="${M.l + 60}" x2="${M.l + 76}" y1="12" y2="12" stroke="var(--accent)" stroke-width="2.4"/><text x="${M.l + 80}" y="16" style="fill:var(--fg)">特異度</text>`;
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">カットオフ値（${esc(xn)}）</text>`;
  return s + '</svg>';
}
ANALYSES.db.roc = function () {
  const R = state.db.roles; need(R.bin >= 0, '状態の列（値が2種類の列。例：診断あり／なし）を選んでください。');
  const vars = R.roc.filter(j => j !== R.bin && colType(j) === 'num'); need(vars.length >= 1, '検査値の列を1つ以上選んでください。'); need(vars.length <= 6, '検査値の列は6つまでにしてください。');
  const st = dbCol(R.bin), lv = levelsOf(st), pos = R.event && lv.includes(R.event) ? R.event : lv[lv.length - 1], neg = lv.find(l => l !== pos);
  const X = vars.map(j => dbCol(j).map(toNum)), ok = st.map((v, i) => v !== '' && X.every(c => isFinite(c[i])));
  const lab = st.filter((_, i) => ok[i]).map(v => +(v === pos)), cols = X.map(c => c.filter((_, i) => ok[i])), n = lab.length, n1 = S.sum(lab), n0 = n - n1;
  need(n1 >= 3 && n0 >= 3, `「${pos}」と「${neg}」がそれぞれ3人以上必要です。`);
  const dropped = st.filter(v => v !== '').length - n, useClosest = state.opt.rocCut === 'closest', P = 3, cl = (x, d) => fmt(x, d).replace(/^(−?)0\./, '$1.');
  const res = vars.map((j, k) => {
    const x = cols[k], med = g => S.quantile(x.filter((_, i) => lab[i] === g), .5);
    const high = state.opt.rocDir === 'high' ? true : state.opt.rocDir === 'low' ? false : med(1) >= med(0);
    const r = S.roc(x.map(v => high ? v : -v), lab), b = useClosest ? r.best0 : r.best, cut = high ? b.t : -b.t;
    const tp = Math.round(b.tpr * n1), fp_ = Math.round(b.fpr * n0), fn = n1 - tp, tn = n0 - fp_;
    const sens = tp / n1, spec = tn / n0, ppv = tp / (tp + fp_), npv = tn / (tn + fn);
    const rows = r.pts.filter(p => isFinite(p.t)).map(p => ({ x: high ? p.t : -p.t, sens: p.tpr, spec: 1 - p.fpr, j: p.tpr - p.fpr }));
    return { j, name: vn(j), x, high, r, b, cut, tp, fp: fp_, fn, tn, sens, spec, ppv, npv, lrp: sens / (1 - spec), lrn: (1 - sens) / spec, acc: (tp + tn) / n, rows, col: GC[k % 6] };
  });
  const rule = q => `${q.high ? '≥' : '≤'} ${+q.cut.toPrecision(6)}`;
  let h = `<p class="note">状態：${nm(R.bin)}（陽性＝「${esc(pos)}」${n1}人、陰性＝「${esc(neg)}」${n0}人、計 ${n}人）。${dropped > 0 ? `欠測のある ${dropped}人を除きました（すべての検査値がそろった人だけで計算し、AUC を同じ人どうしで比べます）。` : ''}</p>`;
  h += '<h4>ROC 曲線</h4>' + `<div class="figrow">${rocMultiPlot(res.map(q => ({ name: q.name, r: q.r, b: q.b, col: q.col })))}</div>`;
  h += '<h4>AUC と最適カットオフ</h4>' + table(['検査値', '向き', 'AUC', '95%信頼区間', 'AUC = .5 の検定', `カットオフ（${useClosest ? '(0,1) 最近接' : 'Youden'}）`, '感度', '特異度', 'Youden 指数'],
    res.map(q => [esc(q.name), q.high ? '高いほど陽性' : '低いほど陽性', cl(q.r.auc, P), `[${cl(q.r.L, P)}, ${cl(q.r.U, P)}]`, `z = ${fmt(q.r.z, 2)}, p ${q.r.p < .001 ? '< .001' : '= ' + fp(q.r.p)}${star(q.r.p)}`, rule(q), cl(q.sens, P), cl(q.spec, P), cl(q.sens + q.spec - 1, P)]));
  h += '<p class="note">AUC の信頼区間と検定は DeLong 法。AUC の目安は .7 以上で許容、.8 以上で良好、.9 以上で優秀です（Hosmer & Lemeshow）。カットオフは「この値以上（以下）を陽性と判定する」境目です。</p>';
  const rev = res.filter(q => q.r.auc < .5); if (rev.length) h += `<p class="msg">${rev.map(q => esc(q.name)).join('・')}は AUC が .5 を下回っています。陽性と判定する向きが逆の可能性があります（「陽性の向き」を「自動」か逆向きにしてください）。</p>`;
  if (res.length >= 2) {
    const pr = []; for (let a = 0; a < res.length; a++) for (let c = a + 1; c < res.length; c++) pr.push([a, c, S.rocCompare(res[a].r, res[c].r)]);
    const MR = mcAdjust(pr.map(x => ({ i: x[0], j: x[1], p: x[2].p })), res.length, { what: 'AUC の比較' }), adj = MR.p;
    h += '<h4>AUC の比較（同じ対象者での DeLong 検定）</h4>' + table(['比較', 'AUC の差', '95%信頼区間', 'z', 'p', `調整済み p（${MR.label}）`], pr.map((x, i) => [x, i]).filter(([, i]) => MR.keep[i]).map(([[a, c, t], i]) => [`${esc(res[a].name)} − ${esc(res[c].name)}`, fmt(t.d, 3), `[${fmt(t.L, 3)}, ${fmt(t.U, 3)}]`, fmt(t.z, 2), fp(t.p), fp(adj[i]) + star(adj[i])])) + mcNote(MR);
  }
  res.forEach(q => {
    h += `<h4>${esc(q.name)}：カットオフ ${rule(q)} で判定したとき</h4>`;
    h += `<div class="figrow">${rocStrip(q.x, lab, pos, neg, q.cut, q.high, q.name)}${sensSpecPlot(q.rows, q.cut, q.name)}</div>`;
    const ci = (x, m) => { const [l, u] = S.binomCI(x, m); return `[${cl(l, P)}, ${cl(u, P)}]`; };
    h += `<div class="figrow"><div>${table(['実際 ＼ 判定', '陽性', '陰性', '計'], [[esc(pos), q.tp, q.fn, n1], [esc(neg), q.fp, q.tn, n0], ['計', q.tp + q.fp, q.fn + q.tn, n]])}</div><div>${table(['指標', '値', '95%信頼区間'], [
      ['感度（陽性の人を陽性と判定）', cl(q.sens, P), ci(q.tp, n1)], ['特異度（陰性の人を陰性と判定）', cl(q.spec, P), ci(q.tn, n0)],
      ['陽性的中率 PPV', cl(q.ppv, P), q.tp + q.fp ? ci(q.tp, q.tp + q.fp) : '—'], ['陰性的中率 NPV', cl(q.npv, P), q.fn + q.tn ? ci(q.tn, q.fn + q.tn) : '—'],
      ['陽性尤度比 LR+', fmt(q.lrp, 2), ''], ['陰性尤度比 LR−', fmt(q.lrn, 2), ''], ['正診率', cl(q.acc, P), ci(q.tp + q.tn, n)]])}</div></div>`;
    const near = q.rows.slice().sort((a, b) => q.high ? a.x - b.x : b.x - a.x);
    h += `<details class="cutlist"><summary>すべてのカットオフ値の感度・特異度（${near.length}通り）</summary>${table([`カットオフ（${q.high ? '以上' : '以下'}を陽性）`, '感度', '特異度', '1 − 特異度', 'Youden 指数'], near.map(r => [(Math.abs(r.x - q.cut) < 1e-12 ? '▶ ' : '') + (+r.x.toPrecision(6)), cl(r.sens, P), cl(r.spec, P), cl(1 - r.spec, P), cl(r.j, P)]))}</details>`;
  });
  h += '<p class="note">信頼区間は Clopper-Pearson の正確法。陽性的中率・陰性的中率はこのデータの有病率（' + fmt(n1 / n * 100, 1) + ' %）に左右されるので、有病率の違う集団にはそのまま当てはまりません。</p>';
  const q0 = res[0];
  let apaTxt = `${esc(vn(R.bin))}（${esc(pos)} ${n1}名、${esc(neg)} ${n0}名）を判別する精度を ROC 分析で検討した。` + res.map(q => `${esc(q.name)}の AUC は ${cl(q.r.auc, 2)}（95% CI [${cl(q.r.L, 2)}, ${cl(q.r.U, 2)}]）であり、${useClosest ? '(0, 1) に最も近い点' : 'Youden 指数'}による最適カットオフ値 ${+q.cut.toPrecision(6)}${q.high ? '以上' : '以下'}を陽性とすると、感度 ${cl(q.sens, 2)}、特異度 ${cl(q.spec, 2)} であった`).join('。') + '。';
  if (res.length >= 2) { const best = res.slice().sort((a, b) => b.r.auc - a.r.auc); const t = S.rocCompare(best[0].r, best[1].r); apaTxt += `AUC が最も大きかった${esc(best[0].name)}と次に大きかった${esc(best[1].name)}の差は${t.p < .05 ? '有意であった' : '有意ではなかった'}（DeLong 検定、<i>z</i> = ${fmt(t.z, 2)}, ${apaP(t.p)}）。`; }
  { const best = res.slice().sort((a, b) => b.r.auc - a.r.auc)[0];
    h += interp(`AUC は「${esc(pos)}」の人と「${esc(neg)}」の人を 1 人ずつ選んだとき、${esc(pos)}の人のほうが陽性側の値になる確率です。.5 は偶然と同じ、1 は完全に見分けられることを意味します。最も AUC が大きかったのは ${esc(best.name)}（${cl(best.r.auc, 2)}）で、判別力は${best.r.auc >= .9 ? '優秀' : best.r.auc >= .8 ? '良好' : best.r.auc >= .7 ? '許容範囲' : '低め'}です。`,
      `${esc(best.name)}をカットオフ ${rule(best)} で使うと、${esc(pos)}の人の ${fmt(best.sens * 100, 0)}% を陽性と判定でき（感度）、${esc(neg)}の人の ${fmt(best.spec * 100, 0)}% を正しく陰性と判定できます（特異度）。見逃しを減らしたいスクリーニングでは感度を、誤って陽性とする人を減らしたい場面では特異度を重視して、カットオフを一覧から選び直すこともできます。`,
      res.length >= 2 ? 'AUC の比較（DeLong 検定）が有意なら、その 2 つの検査の判別力に差があるといえます。' : '');
  }
  h += apa('論文記載例', apaTxt);
  return { title: `ROC分析（${vn(R.bin)}：${res.map(q => q.name).join('・')}）`, html: h };
};

// ----- 共分散分析（ANCOVA） -----
function adjMeanPlot(A, yName) { // 素の平均と調整済み平均（95%CI）を並べる
  const k = A.adj.length, vals = A.adj.flatMap(a => [a.L, a.U, a.mean]), yt = niceTicks(Math.min(...vals), Math.max(...vals)), W = Math.max(380, 120 + k * 120), H = 290, M = { l: 52, r: 16, t: 34, b: 40 };
  const fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b), slot = (W - M.l - M.r) / k;
  let s = frame(W, H, M, yt, yName, fy);
  A.adj.forEach((a, i) => {
    const x = M.l + slot * (i + .5);
    s += `<circle cx="${x - 14}" cy="${fy(a.mean)}" r="4.5" fill="var(--sheet)" stroke="var(--muted)" stroke-width="1.6"/>`;
    s += `<line x1="${x + 14}" x2="${x + 14}" y1="${fy(a.L)}" y2="${fy(a.U)}" stroke="${GC[i % 6]}" stroke-width="1.6"/><line x1="${x + 9}" x2="${x + 19}" y1="${fy(a.L)}" y2="${fy(a.L)}" stroke="${GC[i % 6]}" stroke-width="1.6"/><line x1="${x + 9}" x2="${x + 19}" y1="${fy(a.U)}" y2="${fy(a.U)}" stroke="${GC[i % 6]}" stroke-width="1.6"/><circle cx="${x + 14}" cy="${fy(a.adj)}" r="5.5" fill="${GC[i % 6]}"/>`;
    s += `<line x1="${x - 14}" x2="${x + 14}" y1="${fy(a.mean)}" y2="${fy(a.adj)}" stroke="var(--muted)" stroke-dasharray="2 3"/><text x="${x}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(a.level)}</text>`;
  });
  s += `<circle cx="${M.l + 6}" cy="14" r="4.5" fill="var(--sheet)" stroke="var(--muted)" stroke-width="1.6"/><text x="${M.l + 14}" y="18">調整前の平均</text><circle cx="${M.l + 110}" cy="14" r="5" fill="var(--accent)"/><text x="${M.l + 118}" y="18">調整済み平均（ひげ＝95%CI）</text>`;
  return s + '</svg>';
}
ANALYSES.db.ancova = function () {
  const R = state.db.roles, y = needRole('y', '目的変数'), a = needRole('a', '要因A（群）'), cv = (R.cov || []).filter(j => j !== y && j !== a);
  need(cv.length >= 1, '共変量を1つ以上選んでください（例：事前得点）。'); need(cv.every(j => colType(j) === 'num'), '共変量は数値の列を選んでください。');
  const Y = dbCol(y).map(toNum), Ag = dbCol(a), Cs = cv.map(j => dbCol(j).map(toNum)), ok = Y.map((v, i) => isFinite(v) && Ag[i] !== '' && Cs.every(c => isFinite(c[i])));
  const yy = Y.filter((_, i) => ok[i]), gg = Ag.filter((_, i) => ok[i]), cc = Cs.map(c => c.filter((_, i) => ok[i])), la = levelsOf(gg);
  need(la.length >= 2 && la.length <= 12, '要因Aは2〜12区分の列を選んでください。'); need(la.every(l => gg.filter(v => v === l).length >= 2), 'どの群にも2人以上が必要です。');
  const A = S.ancova(yy, gg, cc, la), cn = cv.map(nm), nA = nm(a), drop = ok.filter(v => !v).length;
  let h = `<p class="note">目的変数 = ${nm(y)}、要因 = ${nA}（${la.map(esc).join('・')}）、共変量 = ${cn.join('・')}、n = ${A.n}${drop ? `（欠測などで ${drop} 行を除外）` : ''}。</p>`;
  h += '<h4>群ごとの平均 (SD)</h4>' + table([nA, 'n', `${nm(y)}`, ...cn.map(c => `${c}（共変量）`)], A.adj.map(r => [esc(r.level), r.n, `${fmt(r.mean, 2)} (${fmt(r.sd, 2)})`, ...r.covMeans.map(v => fmt(v, 2))]));
  if (A.slopes) h += '<h4>回帰の傾きの等質性の検定（前提の確認）</h4>' + table(['検定', 'F', '自由度', 'p 値'], [[`${nA} × 共変量 の交互作用`, fmt(A.slopes.F), `${A.slopes.df1}, ${A.slopes.df2}`, pcell(A.slopes.p)]]);
  h += '<h4>共分散分析表（タイプIII平方和）</h4>' + table(['変動要因', '平方和', '自由度', '平均平方', 'F', 'p 値', '偏 η²'], [
    ...A.cov.map((t, j) => [`${cn[j]}（共変量）`, fmt(t.ss), t.df, fmt(t.ms), fmt(t.F), pcell(t.p), fmt(t.peta2)]),
    [nA, fmt(A.A.ss), A.A.df, fmt(A.A.ms), fmt(A.A.F), pcell(A.A.p), fmt(A.A.peta2)], ['誤差', fmt(A.error.ss), A.error.df, fmt(A.error.ms), '', '', ''], ['全体（修正済み）', fmt(A.sst), A.n - 1, '', '', '', '']]);
  h += `<p class="note">参考：共変量で調整しない一元配置分散分析では F(${A.unadj.dfb}, ${A.unadj.dfw}) = ${fmt(A.unadj.F, 2)}, p ${A.unadj.p < .001 ? '< .001' : '= ' + fp(A.unadj.p)}。R² = ${fmt(A.r2, 3)}。SPSS の「一変量」（タイプIII）と同じ計算です。</p>`;
  h += '<h4>共変量の回帰係数（群内で共通の傾き）</h4>' + table(['共変量', 'B', 'SE', 't', 'p 値'], A.slope.map((b, j) => [cn[j], fmt(b.b), fmt(b.se), fmt(b.t), pcell(b.p)]));
  h += '<h4>調整済み平均（共変量を全体平均にそろえたときの推定平均）</h4>' + table([nA, '調整前の平均', '調整済み平均', 'SE', '95%CI'], A.adj.map(r => [esc(r.level), fmt(r.mean, 2), fmt(r.adj, 2), fmt(r.se, 3), `[${fmt(r.L, 2)}, ${fmt(r.U, 2)}]`]))
    + `<p class="note">共変量の全体平均：${cv.map((_, j) => `${cn[j]} = ${fmt(A.cm[j], 2)}`).join('、')}。</p>`;
  const MCA = mcAdjust(A.pairs.map(q => ({ i: q.i, j: q.j, t: q.t, df: A.error.df, p: q.p, vec: q.vec })), la.length, { pooled: true, V: A.V, what: '調整済み平均の比較' }); A.pairs.forEach((q, i) => { q.pb = MCA.p[i]; q.keep = MCA.keep[i]; });
  h += `<h4>調整済み平均の対比較（${MCA.label}）</h4>` + mcNote(MCA) + table(['組', '差', 'SE', 't', '調整前の p', `調整済み p（${MCA.label}）`, '差の 95%CI'], A.pairs.filter(q => q.keep).map(q => [`${esc(la[q.i])} − ${esc(la[q.j])}`, fmt(q.diff, 2), fmt(q.se, 3), fmt(q.t), pcell(q.p), pcell(q.pb), `[${fmt(q.L, 2)}, ${fmt(q.U, 2)}]`]));
  const gid = gg.map(v => la.indexOf(v)), b1 = A.slope[0].b, other = A.slope.slice(1).reduce((s, b, j) => s, 0); void other;
  const lines = A.adj.map((r, li) => ({ a: r.adj - b1 * A.cm[0], b: b1, color: GC[li % 6] }));
  h += `<div class="figrow">${xyPlot(cc[0], yy, vn(cv[0]), vn(y), { groups: gid, groupNames: la, lines })}${adjMeanPlot(A, vn(y))}</div>`;
  h += `<p class="note">左：${esc(vn(cv[0]))}と${esc(vn(y))}の散布図に、共分散分析の共通の傾きで群ごとの回帰直線を引いたもの（直線の上下の差が、調整後の群の差です${cv.length > 1 ? '。ほかの共変量は平均値に固定' : ''}）。右：調整前の平均（白丸）と調整済み平均（色の点）。</p>`;
  h += normCheck([{ label: '残差', x: A.resid }], { qqLabel: '標準化残差', title: '残差の正規性', need: '共分散分析は、残差（実測値 − モデルによる予測値）が正規分布に従うことを前提にしています（回帰の傾きの等質性・等分散とあわせて確認します）。' });
  const sigP = A.pairs.filter(q => q.keep && q.pb < .05);
  h += interp(
    A.slopes ? (A.slopes.p >= .05 ? `回帰の傾きの等質性の検定は有意ではありません（${pTxt(A.slopes.p)}）。共変量と目的変数の関係（傾き）は群によって違うとはいえず、共分散分析の前提は満たされています。` : `回帰の傾きの等質性の検定が有意です（${pTxt(A.slopes.p)}）。共変量の効果が群によって違うので、共分散分析の前提が満たされていません。調整済み平均は共変量の値によって変わるため、結果の解釈には注意が必要です（交互作用を含めた回帰分析を検討してください）。`) : '',
    A.cov.map((t, j) => `共変量の${cn[j]}は${t.p < .05 ? `有意で（${pTxt(t.p)}）、${nm(y)}と関連しています（B = ${fmt(A.slope[j].b, 2)}）` : `有意ではありません（${pTxt(t.p)}）`}。`).join(''),
    sigW(A.A.p, `共変量の影響を取り除いても、${nA}の効果は有意です（${pTxt(A.A.p)}、偏 η² = ${fmt(A.A.peta2, 2)}：${etaMag(A.A.peta2)}効果）。共変量の値が同じ人どうしで比べても、群によって${nm(y)}が違うといえます。`, `共変量の影響を取り除くと、${nA}の効果は有意ではありません（${pTxt(A.A.p)}）。${NS_NOTE}`)
      + ((A.unadj.p < .05) !== (A.A.p < .05) ? ` なお、調整しない分散分析（${pTxt(A.unadj.p)}）とは結論が変わりました。もともとの群の差が共変量（例：事前の得点）の違いによるものだったか、逆に共変量のばらつきが群の差を隠していた可能性があります。` : ''),
    sigP.length ? `調整済み平均の対比較（${MCA.label}）で有意だった組：${sigP.map(q => `${esc(la[q.i])} と ${esc(la[q.j])}（${esc(q.diff > 0 ? la[q.i] : la[q.j])}が ${fmt(Math.abs(q.diff), 2)} 高い）`).join('、')}。` : '調整済み平均の対比較で有意な組はありませんでした。',
    '共分散分析は、事前得点などの共変量を統計的に一定にそろえて群を比べる方法です。介入研究では、事前得点を共変量にして事後得点を比べるのが代表的な使い方です。');
  h += apa('論文記載例', `${cn.join('・')}を共変量とする共分散分析の結果、${nA}の効果は${A.A.p < .05 ? '有意であった' : '有意ではなかった'}（<i>F</i>(${A.A.df}, ${A.error.df}) = ${fmt(A.A.F, 2)}, ${apaP(A.A.p)}, 偏 η² = ${fmt(A.A.peta2, 2)}）。調整済み平均は ${A.adj.map(r => `${esc(r.level)} ${fmt(r.adj, 2)}（<i>SE</i> = ${fmt(r.se, 2)}）`).join('、')} であった。${A.slopes ? `回帰の傾きの等質性は${A.slopes.p >= .05 ? '確認された' : '確認されなかった'}（<i>F</i>(${A.slopes.df1}, ${A.slopes.df2}) = ${fmt(A.slopes.F, 2)}, ${apaP(A.slopes.p)}）。` : ''}`);
  return { title: `共分散分析（${vn(y)} × ${vn(a)}、共変量：${cv.map(j => vn(j)).join('・')}）`, html: h };
};

// ----- 最尤法による回帰分析（完全情報最尤法） -----
ANALYSES.db.mlreg = function () {
  const R = state.db.roles, y = needRole('y', '目的変数'), xs = R.x.filter(j => j !== y); need(xs.length >= 1, '説明変数を1つ以上選んでください。');
  const Y = dbCol(y).map(toNum), cols = [], names = [], cat = [];
  xs.forEach(j => { const v = dbCol(j);
    if (colType(j) === 'num') { cols.push(v.map(toNum)); names.push(vn(j)); cat.push(false); }
    else { const l = levelsOf(v); need(l.length <= 10, `${vn(j)}の区分が多すぎます。`); l.slice(1).forEach(u => { cols.push(v.map(w => w === '' ? NaN : +(w === u))); names.push(`${vn(j)}: ${u}（基準 ${l[0]}）`); cat.push(true); }); } });
  const keep = Y.map((v, i) => isFinite(v) || cols.some(c => isFinite(c[i]))), yy = Y.filter((_, i) => keep[i]), XX = cols.map(c => c.filter((_, i) => keep[i]));
  need(yy.filter(isFinite).length >= names.length + 3, '目的変数の値がある人が少なすぎます。');
  let M; try { M = S.mlReg(yy, XX, names); } catch (e) { throw new Error('推定できませんでした。説明変数どうしが完全に重なっていないか（同じ情報の列）を確認してください。'); }
  const cc = yy.map((v, i) => isFinite(v) && XX.every(c => isFinite(c[i]))), nMiss = M.N - M.nComplete;
  let h = `<p class="note">目的変数 = ${nm(y)}、推定に使った人数 N = ${M.N}（すべてそろっている人 ${M.nComplete}人、どこかに欠測がある人 ${nMiss}人）。推定法：最尤法（欠測値は完全情報最尤法 FIML。lavaan の missing = "ml"・fixed.x = FALSE と同じ）。</p>`;
  if (nMiss) { const vnames = [nm(y), ...names.map(esc)]; h += '<h4>欠測のパターン</h4>' + table(['欠測している変数', '人数'], M.pats.sort((a, b) => b.n - a.n).map(q => [q.miss.length ? q.miss.map(i => vnames[i]).join('・') : '（欠測なし）', q.n])); }
  const z = 1.959963984540054;
  h += '<h4>回帰係数（最尤推定）</h4>' + table(['', 'B', 'SE', 'z', 'p 値', 'B の 95%CI', 'β（標準化）'], M.coef.map(c => [esc(c.name), fmt(c.b), fmt(c.se), fmt(c.z, 2), pcell(c.p), `[${fmt(c.L)}, ${fmt(c.U)}]`, isFinite(c.beta) ? fmt(c.beta) : '']));
  h += '<h4>モデルの評価</h4>' + table(['指標', '値'], [
    ['尤度比検定（すべての係数 = 0 との比較）', `χ²(${M.df}) = ${fmt(M.LR, 2)}, p ${M.pLR < .001 ? '< .001' : '= ' + fp(M.pLR)}`],
    ['R²', fmt(M.r2, 3)], ['残差分散', `${fmt(M.sigma2, 3)}（SE ${fmt(M.sigma2SE, 3)}）`],
    ['対数尤度', fmt(M.ll, 3)], ['AIC ／ BIC', `${fmt(M.aic, 2)} ／ ${fmt(M.bic, 2)}`], ['推定したパラメータ数', `${M.npar}（平均・分散・共分散をすべて推定）`]]);
  // 比較：リストワイズ削除の通常の回帰
  let cmp = null; if (M.nComplete >= names.length + 3) { try { cmp = S.multiReg(yy.filter((_, i) => cc[i]), XX.map(c => c.filter((_, i) => cc[i])), names); } catch (e) { } }
  if (cmp) h += `<h4>参考：欠測のある人を除いた通常の回帰（n = ${M.nComplete}）との比較</h4>` + table(['', 'B（最尤法・FIML）', 'SE', 'B（最小二乗法・除外）', 'SE'], M.coef.map((c, j) => [esc(c.name), fmt(c.b), fmt(c.se), fmt(cmp.coef[j].b), fmt(cmp.coef[j].se)]));
  h += '<h4>標準化係数の比較図</h4>' + coefPlot(M.coef.slice(1).map(c => ({ name: c.name, beta: c.beta, betaL: c.beta - z * c.betaSE, betaU: c.beta + z * c.betaSE, p: c.p })));
  const sig = M.coef.slice(1).filter(c => c.p < .05);
  h += interp(nMiss ? `完全情報最尤法（FIML）は、欠測値を埋めたり人を除いたりせず、一人ひとりが「持っている値」をすべて使って推定する方法です。欠測のある ${nMiss}人も分析に含まれるので、欠測者を除く通常の回帰より検出力が高く、欠測が「ほかの観測された変数で説明できる」（MAR：ランダムな欠測）場合には偏りも小さくなります。` : '欠測値がないので、係数は通常の重回帰（最小二乗法）と同じです。標準誤差は最尤法の式（人数 N で割る）なので、わずかに小さくなります。最尤法にすると、対数尤度・AIC・BIC でモデルどうしを比べられます。',
    sigW(M.pLR, `尤度比検定は有意（${pTxt(M.pLR)}）で、説明変数のセットは${nm(y)}の予測に役立っています。R² = ${fmt(M.r2, 2)}（${fmt(M.r2 * 100, 1)}% を説明）。`, `尤度比検定は有意ではなく（${pTxt(M.pLR)}）、説明変数で${nm(y)}を予測できるとはいえません。`),
    sig.length ? `ほかの変数を一定にしたうえで有意だった説明変数：${sig.map(c => `${esc(c.name)}（β = ${fmt(c.beta, 2)}）`).join('、')}。` : '個々の説明変数に、有意なものはありませんでした。',
    cmp && nMiss ? (() => { const big = M.coef.slice(1).map((c, j) => ({ c, d: Math.abs(c.b - cmp.coef[j + 1].b) / (cmp.coef[j + 1].se || 1) })).filter(o => o.d > .5); return big.length ? `欠測者を除いた回帰と係数が大きく違う変数（${big.map(o => esc(o.c.name)).join('、')}）があります。欠測者を除くと結果が偏っていた可能性があります。` : '欠測者を除いた回帰と係数はおおむね同じで、FIML のほうが標準誤差が小さく（推定が精密に）なっています。'; })() : '',
    '最尤法は、変数が多変量正規分布にしたがうことを前提にしています。カテゴリの説明変数（0/1）を含む場合も一般に使われますが、目的変数が大きく偏っているときは注意してください。');
  h += apa('論文記載例', `欠測値を含むデータに対し、完全情報最尤法（FIML）による重回帰分析を行った（<i>N</i> = ${M.N}）。モデルは${M.pLR < .05 ? '有意であり' : '有意ではなく'}（χ²(${M.df}) = ${fmt(M.LR, 2)}, ${apaP(M.pLR)}, <i>R</i>² = ${fmt(M.r2, 2)}）、${sig.length ? sig.map(c => `${esc(c.name)}（β = ${fmt(c.beta, 2)}, ${apaP(c.p)}）`).join('、') + 'が有意な予測因子であった。' : '有意な予測因子はなかった。'}`);
  return { title: `最尤法による回帰分析（${vn(y)}）`, html: h };
};

// ----- 二要因の共分散分析 -----
function adjInterPlot(A, la, lb, nA, nB, yName) { // 調整済みセル平均の交互作用図（ひげ＝95%CI）
  const X = la.length, L = lb.length, vals = A.cells.flat().flatMap(c => [c.L, c.U]), yt = niceTicks(Math.min(...vals), Math.max(...vals));
  const W = Math.max(440, 140 + X * 130), H = 332, M = { l: 52, r: 18, t: 46, b: 46 }, slot = (W - M.l - M.r) / X;
  const fx = (xi, li) => M.l + slot * (xi + .5) + (L > 1 ? (li - (L - 1) / 2) * Math.min(18, slot * .14) : 0), fy = v => H - M.b - (v - yt[0]) / (yt[yt.length - 1] - yt[0]) * (H - M.t - M.b);
  let s = frame(W, H, M, yt, yName, fy);
  lb.forEach((_, li) => {
    const c = GC[li % 6]; s += `<polyline points="${la.map((_, xi) => `${fx(xi, li)},${fy(A.cells[xi][li].adj)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
    la.forEach((_, xi) => { const e = A.cells[xi][li], x = fx(xi, li); s += `<line x1="${x}" x2="${x}" y1="${fy(e.L)}" y2="${fy(e.U)}" stroke="${c}" stroke-width="1.4"/><line x1="${x - 5}" x2="${x + 5}" y1="${fy(e.L)}" y2="${fy(e.L)}" stroke="${c}" stroke-width="1.4"/><line x1="${x - 5}" x2="${x + 5}" y1="${fy(e.U)}" y2="${fy(e.U)}" stroke="${c}" stroke-width="1.4"/><circle cx="${x}" cy="${fy(e.adj)}" r="4.6" fill="${c}" stroke="var(--sheet)" stroke-width="1.2"/>`; });
  });
  la.forEach((l, xi) => s += `<text x="${M.l + slot * (xi + .5)}" y="${H - M.b + 18}" text-anchor="middle" style="fill:var(--fg)">${esc(l)}</text>`);
  s += `<text x="${(M.l + W - M.r) / 2}" y="${H - 8}" text-anchor="middle">${esc(nA)}</text>`;
  let lx = M.l; s += `<text x="${lx}" y="16">${esc(nB)}</text>`; lx += String(nB).length * 11 + 10; lb.forEach((l, li) => { s += `<rect x="${lx}" y="7" width="14" height="10" rx="2" fill="${GC[li % 6]}"/><text x="${lx + 18}" y="16" style="fill:var(--fg)">${esc(l)}</text>`; lx += 30 + String(l).length * 11; });
  s += `<text x="${W - M.r}" y="34" text-anchor="end">点＝調整済み平均、ひげ＝95%信頼区間</text>`;
  return s + '</svg>';
}
ANALYSES.db.ancova2 = function () {
  const R = state.db.roles, y = needRole('y', '目的変数'), a = needRole('a', '要因A'), b = needRole('b', '要因B'), cv = (R.cov || []).filter(j => j !== y && j !== a && j !== b);
  need(a !== b, '要因Aと要因Bには別の列を選んでください。'); need(cv.length >= 1, '共変量を1つ以上選んでください（例：事前得点）。'); need(cv.every(j => colType(j) === 'num'), '共変量は数値の列を選んでください。');
  const Y = dbCol(y).map(toNum), Av = dbCol(a), Bv = dbCol(b), Cs = cv.map(j => dbCol(j).map(toNum)), ok = Y.map((v, i) => isFinite(v) && Av[i] !== '' && Bv[i] !== '' && Cs.every(c => isFinite(c[i])));
  const yy = Y.filter((_, i) => ok[i]), aa = Av.filter((_, i) => ok[i]), bb = Bv.filter((_, i) => ok[i]), cc = Cs.map(c => c.filter((_, i) => ok[i])), la = levelsOf(aa), lb = levelsOf(bb);
  need(la.length >= 2 && lb.length >= 2, '要因A・Bはそれぞれ2区分以上必要です。'); need(la.length * lb.length <= 30, '区分が多すぎます。');
  const empty = la.flatMap(x => lb.filter(z => !aa.some((v, i) => v === x && bb[i] === z)).map(z => `${x}×${z}`)); need(!empty.length, `人がいないセルがあります（${empty.join('、')}）。`);
  let A; try { A = S.ancova2(yy, aa, bb, cc, la, lb); } catch (e) { throw new Error('計算できませんでした。セルの人数が少なすぎないか確認してください。'); }
  const nA = nm(a), nB = nm(b), cn = cv.map(nm), drop = ok.filter(v => !v).length;
  let h = `<p class="note">目的変数 = ${nm(y)}、要因A = ${nA}（${la.map(esc).join('・')}）、要因B = ${nB}（${lb.map(esc).join('・')}）、共変量 = ${cn.join('・')}、n = ${A.n}${drop ? `（欠測などで ${drop} 行を除外）` : ''}。</p>`;
  h += '<h4>セルごとの平均 (SD) と人数（調整前）</h4>' + table([`${nA} ＼ ${nB}`, ...lb.map(esc)], la.map((l, i) => [esc(l), ...lb.map((_, j) => { const c = A.cells[i][j]; return `${fmt(c.mean, 2)} (${fmt(c.sd, 2)}) n=${c.n}`; })]));
  if (A.slopes) h += '<h4>回帰の傾きの等質性の検定（前提の確認）</h4>' + table(['検定', 'F', '自由度', 'p 値'], [['要因（A・B・A×B）× 共変量 の交互作用', fmt(A.slopes.F), `${A.slopes.df1}, ${A.slopes.df2}`, pcell(A.slopes.p)]]);
  h += '<h4>共分散分析表（タイプIII平方和）</h4>' + table(['変動要因', '平方和', '自由度', '平均平方', 'F', 'p 値', '偏 η²'], [
    ...A.cov.map((t, j) => [`${cn[j]}（共変量）`, fmt(t.ss), t.df, fmt(t.ms), fmt(t.F), pcell(t.p), fmt(t.peta2)]),
    ...[['A', nA], ['B', nB], ['AB', `${nA} × ${nB}`]].map(([k, lab]) => [lab, fmt(A.T[k].ss), A.T[k].df, fmt(A.T[k].ms), fmt(A.T[k].F), pcell(A.T[k].p), fmt(A.T[k].peta2)]),
    ['誤差', fmt(A.error.ss), A.error.df, fmt(A.error.ms), '', '', ''], ['全体（修正済み）', fmt(A.sst), A.n - 1, '', '', '', '']]);
  h += `<p class="note">R² = ${fmt(A.r2, 3)}。人数が群ごとに違っても SPSS の「一変量」（タイプIII）と同じ計算です。</p>`;
  h += '<h4>共変量の回帰係数</h4>' + table(['共変量', 'B', 'SE', 't', 'p 値'], A.slope.map((s2, j) => [cn[j], fmt(s2.b), fmt(s2.se), fmt(s2.t), pcell(s2.p)]));
  h += '<h4>調整済み平均（共変量を全体平均にそろえたとき）</h4>' + table([`${nA} ＼ ${nB}`, ...lb.map(esc), `${nA}の周辺平均`], [
    ...la.map((l, i) => [esc(l), ...lb.map((_, j) => { const c = A.cells[i][j]; return `${fmt(c.adj, 2)} [${fmt(c.L, 2)}, ${fmt(c.U, 2)}]`; }), `<b>${fmt(A.margA[i].adj, 2)}</b> (SE ${fmt(A.margA[i].se, 2)})`]),
    [`${nB}の周辺平均`, ...lb.map((_, j) => `<b>${fmt(A.margB[j].adj, 2)}</b> (SE ${fmt(A.margB[j].se, 2)})`), '']])
    + `<p class="note">セルの値は調整済み平均 [95%信頼区間]。周辺平均は、もう一方の要因の各水準を同じ重みで平均したもの（SPSS・emmeans と同じ）。共変量の全体平均：${cv.map((_, j) => `${cn[j]} = ${fmt(A.cm[j], 2)}`).join('、')}。</p>`;
  h += adjInterPlot(A, la, lb, vn(a), vn(b), vn(y));
  const inter = A.T.AB; let MC2 = null;
  const fam = (pairs, k) => { const M = mcAdjust(pairs.map(q => ({ i: q.i, j: q.j, t: q.t, df: A.error.df, p: q.p, vec: q.vec })), k, { pooled: true, V: A.V, what: '調整済み平均の比較' }); pairs.forEach((q, i) => { q.pb = M.p[i]; q.keep = M.keep[i]; }); MC2 = M; };
  A.simpleA.forEach(x => fam(x.pairs, la.length)); A.simpleB.forEach(x => fam(x.pairs, lb.length)); fam(A.pairsA, la.length); fam(A.pairsB, lb.length);
  const simpTbl = (list, fixName, varyName, varyLv) => table([`${fixName} の水準`, `${varyName} の効果 F`, '自由度', 'p 値', '偏 η²'], list.map(x => [esc(x.level), fmt(x.F), `${x.df1}, ${x.df2}`, pcell(x.p), fmt(x.peta2)]))
    + table([`${fixName} の水準`, '組', '調整済み平均の差', 'SE', '調整前の p', `調整済み p（${MC2.label}）`], list.flatMap(x => x.pairs.filter(q => q.keep).map(q => [esc(x.level), `${esc(varyLv[q.i])} − ${esc(varyLv[q.j])}`, fmt(q.diff, 2), fmt(q.se, 3), pcell(q.p), pcell(q.pb)])));
  h += `<h4>単純主効果の検定（調整済み平均）${inter.p < .05 ? '　交互作用が有意なので、こちらを解釈します' : '　交互作用は有意ではありません（参考）'}</h4>` + simpTbl(A.simpleA, nB, nA, la) + simpTbl(A.simpleB, nA, nB, lb);
  if (inter.p >= .05) h += '<h4>主効果の対比較（周辺の調整済み平均）</h4>' + table(['要因', '組', '差', 'SE', '調整前の p', `調整済み p（${MC2.label}）`], [...A.pairsA.filter(q => q.keep).map(q => [nA, `${esc(la[q.i])} − ${esc(la[q.j])}`, fmt(q.diff, 2), fmt(q.se, 3), pcell(q.p), pcell(q.pb)]), ...A.pairsB.filter(q => q.keep).map(q => [nB, `${esc(lb[q.i])} − ${esc(lb[q.j])}`, fmt(q.diff, 2), fmt(q.se, 3), pcell(q.p), pcell(q.pb)])]);
  h += `<p class="note">単純主効果は、もう一方の要因の水準ごとに、共変量で調整した平均の差を F 検定（全体の誤差平均平方を使用）。対比較は ${MC2.label}で調整${MC2.note ? '（' + MC2.note + '）' : ''}。</p>`;
  h += normCheck([{ label: '残差', x: A.resid }], { qqLabel: '標準化残差', title: '残差の正規性', need: '二要因の共分散分析は、残差（実測値 − モデルによる予測値）が正規分布に従うことを前提にしています。' });
  const sA = A.simpleA.filter(x => x.p < .05).map(x => esc(x.level)), sB = A.simpleB.filter(x => x.p < .05).map(x => esc(x.level));
  h += interp(
    A.slopes ? (A.slopes.p >= .05 ? `回帰の傾きの等質性の検定は有意ではなく（${pTxt(A.slopes.p)}）、共変量と目的変数の関係はどのセルでも同じと考えられます。共分散分析の前提は満たされています。` : `回帰の傾きの等質性の検定が有意です（${pTxt(A.slopes.p)}）。共変量の効果がセルによって違うので、調整済み平均の解釈には注意が必要です。`) : '',
    A.cov.map((t, j) => `共変量の${cn[j]}は${t.p < .05 ? `有意で（${pTxt(t.p)}）、調整に意味があります` : `有意ではありません（${pTxt(t.p)}）`}。`).join(''),
    inter.p < .05 ? `共変量で調整したうえで、${nA} × ${nB} の交互作用が有意です（${pTxt(inter.p)}、偏 η² = ${fmt(inter.peta2, 2)}）。${nA}の効果は${nB}の水準によって違う、ということです。単純主効果を見ると、${nA}の効果が有意だったのは${nB}が ${sA.length ? sA.join('・') : '（なし）'} のとき、${nB}の効果が有意だったのは${nA}が ${sB.length ? sB.join('・') : '（なし）'} のときです。交互作用図で調整済み平均の線の開き方を確かめてください。`
      : `交互作用は有意ではありません（${pTxt(inter.p)}）。主効果を読みます。${nA}の主効果は${A.T.A.p < .05 ? `有意（${pTxt(A.T.A.p)}、偏 η² = ${fmt(A.T.A.peta2, 2)}）` : `有意ではありません（${pTxt(A.T.A.p)}）`}、${nB}の主効果は${A.T.B.p < .05 ? `有意（${pTxt(A.T.B.p)}、偏 η² = ${fmt(A.T.B.peta2, 2)}）` : `有意ではありません（${pTxt(A.T.B.p)}）`}です。どの水準の間に差があるかは、周辺の調整済み平均の対比較で確かめます。`,
    '二要因の共分散分析は、2つの要因の効果と交互作用を、共変量（例：事前得点）を一定にそろえたうえで検討する方法です。');
  h += apa('論文記載例', `${cn.join('・')}を共変量とする二要因の共分散分析の結果、${nA}の主効果（<i>F</i>(${A.T.A.df}, ${A.error.df}) = ${fmt(A.T.A.F, 2)}, ${apaP(A.T.A.p)}, 偏 η² = ${fmt(A.T.A.peta2, 2)}）、${nB}の主効果（<i>F</i>(${A.T.B.df}, ${A.error.df}) = ${fmt(A.T.B.F, 2)}, ${apaP(A.T.B.p)}, 偏 η² = ${fmt(A.T.B.peta2, 2)}）、交互作用（<i>F</i>(${inter.df}, ${A.error.df}) = ${fmt(inter.F, 2)}, ${apaP(inter.p)}, 偏 η² = ${fmt(inter.peta2, 2)}）について検討した。${inter.p < .05 ? '交互作用が有意であったため、単純主効果の検定を行った。' : ''}`);
  return { title: `二要因の共分散分析（${vn(y)} × ${vn(a)} × ${vn(b)}、共変量：${cv.map(j => vn(j)).join('・')}）`, html: h };
};
