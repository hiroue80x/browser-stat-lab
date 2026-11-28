// ===== 解析の自動記録：記録フォルダに「出力（HTML）・R スクリプト・その時のデータ・解析記録」を保存し、一覧の HTML を作り直す =====
// 記録フォルダ/
//   解析記録一覧.html … 記録の一覧（ダブルクリックでブラウザで開く）
//   解析記録.json / 解析記録.csv … 記録の台帳（.csv は Excel 用）
//   出力/〈名前〉.html … 解析の出力（日時・データ・使った変数つき）
//   R/〈名前〉.R …… 同じ解析を行う R スクリプト
//   データ/ ……… 解析した時点のデータ（中身が同じなら 1 回だけ保存）
const REC = { dir: null, name: '', busy: Promise.resolve(), lastRun: null, msg: '', n: 0 };
const REC_KEY = 'statlab-v1-rec';
const recCfg = (() => { try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch (e) { return {}; } })();
const recCfgSave = () => { try { localStorage.setItem(REC_KEY, JSON.stringify(recCfg)); } catch (e) { } };
const recOK = () => rlinkFsOK();
const recP2 = v => String(v).padStart(2, '0');
const recStamp = d => `${d.getFullYear()}${recP2(d.getMonth() + 1)}${recP2(d.getDate())}${recP2(d.getHours())}${recP2(d.getMinutes())}`;
const recWhen = d => `${d.getFullYear()}-${recP2(d.getMonth() + 1)}-${recP2(d.getDate())} ${recP2(d.getHours())}:${recP2(d.getMinutes())}`;
const recSafe = s => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, '').replace(/\s+/g, '').replace(/[（(]/g, '_').replace(/[）)]/g, '').replace(/[・、，,]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

async function recRestore() { if (!recOK() || REC.dir) return; const h = await rlinkIdb('readonly', st => st.get('recdir')); if (h && h.kind === 'directory') { REC.dir = h; REC.name = h.name; recUi(); } }
async function recPick() {
  try { const h = await window.showDirectoryPicker({ id: 'statlab-rec', mode: 'readwrite' }); REC.dir = h; REC.name = h.name; await rlinkIdb('readwrite', st => st.put(h, 'recdir')); recUi(); return true; }
  catch (e) { if (e && e.name !== 'AbortError') recSay('記録フォルダを選べませんでした：' + e.message); return false; }
}
function recSay(t) { REC.msg = t; const el = document.getElementById('recMsg'); if (el) el.textContent = t; }

// ---- 何を使った解析か ----
function recVars(r) { // R スクリプトに埋め込んだデータの見出し＝解析に使った列
  const m = r && r.match(/read\.csv\(text = r"---\(\n([^\n]*)\n/); if (!m) return [];
  const out = [], re = /("([^"]|"")*"|[^,]*)(,|$)/g; let x; while ((x = re.exec(m[1])) && x[0] !== '') { let v = x[1]; if (v.startsWith('"')) v = v.slice(1, -1).replace(/""/g, '"'); out.push(v); if (x[3] === '') break; }
  return out;
}
function recShort(title) { // 「因子分析（5 因子・最尤法・…）」→「因子分析5因子モデル」
  const m = title.match(/^([^（(]+)[（(]([^）)]*)/); let base = recSafe(m ? m[1] : title); const inner = m ? m[2].split(/[・、,]/).map(s => s.trim()).filter(Boolean) : [];
  const fk = title.match(/(\d+)\s*因子/);
  if (fk && /因子分析/.test(base)) base += fk[1] + '因子モデル';
  else if (inner[0] && recSafe(inner[0]).length <= 14) base += '_' + recSafe(inner[0]);
  return base;
}
function recData() { // 解析した時点のデータ
  const f = state.fmt;
  if (f === 'db') return { ext: 'csv', text: rlinkDataCsv(), labels: typeof cbCsv === 'function' ? cbCsv(cbRows()) : null, src: state.db.file || '', n: state.db.rows.length, p: state.db.cols.length };
  const D = state[f];
  if (D && D.cols && D.rows) { const on = D.cols.map((c, j) => j).filter(j => D.cols[j].on !== false); return { ext: 'csv', text: '﻿' + [on.map(j => csvCell(D.cols[j].name)).join(','), ...D.rows.map(r => on.map(j => csvCell(r[j] ?? '')).join(','))].join('\n') + '\n', src: '', n: D.rows.filter(r => r.some(v => String(v ?? '').trim() !== '')).length, p: on.length }; }
  return { ext: 'json', text: JSON.stringify(D, null, 1), src: '', n: NaN, p: NaN };
}

// ---- フォルダへの書き込み ----
async function recDirOf(root, parts) { let d = root; for (const p of parts) d = await d.getDirectoryHandle(p, { create: true }); return d; }
async function recWrite(path, text) { const parts = path.split('/'), name = parts.pop(), d = await recDirOf(REC.dir, parts), h = await d.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(text); await w.close(); }
async function recRead(path) { try { const parts = path.split('/'), name = parts.pop(); let d = REC.dir; for (const p of parts) d = await d.getDirectoryHandle(p); return await (await (await d.getFileHandle(name)).getFile()).text(); } catch (e) { return null; } }
async function recExists(path) { return (await recRead(path)) !== null; }

function recCss() { return [...document.querySelectorAll('style')].map(s => s.textContent).join('\n'); }
function recOutHtml(e, body, r) {
  const row = (k, v) => v ? `<tr><th>${k}</th><td>${v}</td></tr>` : '';
  return `<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.id)}</title>
<style>${recCss()}</style>
<style>body{display:block;height:auto;overflow:auto;padding:20px 24px 60px;max-width:1100px;margin:0 auto;background:var(--sheet,#fff);color:var(--fg,#222)} .recnav{font-size:13px;margin-bottom:10px} table.out.recmeta th{text-align:left!important;white-space:nowrap;padding-right:14px;vertical-align:top} table.out.recmeta td{text-align:left!important} h1{font-size:20px;margin:6px 0 12px} pre.rsrc{white-space:pre-wrap;font-size:12px;background:var(--panel,#f5f5f5);padding:10px;border-radius:6px}</style></head>
<body><p class="recnav"><a href="../解析記録一覧.html">← 解析記録の一覧</a></p>
<h1>${esc(e.title)}</h1>
<table class="out recmeta"><tbody>${row('記録名', esc(e.id))}${row('日時', esc(e.when))}${row('研究名', esc(e.study))}${row('解析', esc(e.kind + (e.run ? ' → ' + e.run : '')))}${row('データ', `${esc(e.src || '（読み込んだファイル名なし）')}・${isFinite(e.n) ? e.n + ' 行' : ''}${isFinite(e.p) ? ' × ' + e.p + ' 列' : ''}　<a href="../${esc(e.data)}">解析時のデータ</a>${e.labels ? `　<a href="../${esc(e.labels)}">ラベル表</a>` : ''}`)}${row('使った変数', e.vars.length ? `${e.vars.length} 個：${e.vars.map(esc).join('、')}` : '')}${row('ケースの選択', esc(e.filter))}${row('R スクリプト', e.r ? `<a href="../${esc(e.r)}">${esc(e.r)}</a>` : '')}${row('メモ', esc(e.memo))}</tbody></table>
<article class="res"><div class="body">${body}</div></article>
${r ? `<h2 style="font-size:16px;margin-top:24px">R スクリプト</h2><pre class="rsrc">${esc(r)}</pre>` : ''}
</body></html>\n`;
}
function recCsv(list) {
  const H = ['記録名', '日時', '研究名', '解析', '種類', '変数の数', '使った変数', '行数', 'データのファイル', '解析時のデータ', '出力', 'R スクリプト', 'ケースの選択', 'メモ'];
  return '﻿' + [H.join(','), ...list.map(e => [e.id, e.when, e.study, e.title, e.kind + (e.run ? ' → ' + e.run : ''), e.vars.length || '', e.vars.join('・'), isFinite(e.n) ? e.n : '', e.src, e.data, e.out, e.r || '', e.filter, e.memo].map(csvCell).join(','))].join('\n') + '\n';
}
function recIndexHtml(list) {
  const json = JSON.stringify(list).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>解析記録の一覧</title>
<style>
:root{--bg:#fbfaf7;--fg:#22211f;--muted:#6d6a64;--line:#dcd8d0;--panel:#f1eee8;--accent:#2f6f9f;--tag:#e6eef5}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--fg:#ecebe8;--muted:#a19d96;--line:#3a3936;--panel:#262624;--accent:#7fb3dc;--tag:#24323d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.6 -apple-system,"Hiragino Sans","Yu Gothic UI",sans-serif;padding:20px 16px 60px}
.wrap{max-width:1200px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 14px;font-size:13px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.bar input,.bar select{font:inherit;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}.bar input{flex:1;min-width:200px}
.count{color:var(--muted);font-size:13px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--panel);font-weight:600;cursor:pointer;white-space:nowrap}td.when{white-space:nowrap;font-variant-numeric:tabular-nums}a{color:var(--accent)}
.name a{font-weight:600;word-break:break-all}.title{color:var(--muted);font-size:12px}.tag{display:inline-block;background:var(--tag);border-radius:4px;padding:0 6px;font-size:12px;margin:1px 2px 1px 0}
.vars{max-width:280px;color:var(--muted);font-size:12px}.files a{margin-right:8px;white-space:nowrap}.tw{overflow-x:auto}
@media (max-width:700px){.vars,.hide-s{display:none}}
</style></head><body><div class="wrap">
<h1>解析記録の一覧</h1><p class="sub">ブラウザ統計ラボで記録した解析です。名前を押すと出力が開きます。最後の更新：${esc(recWhen(new Date()))}（${list.length} 件）</p>
<div class="bar"><input id="q" placeholder="絞り込み（研究名・解析・変数名など）"><select id="st"><option value="">すべての研究</option></select><span class="count" id="cnt"></span></div>
<div class="tw"><table><thead><tr><th data-k="time">日時 ▾</th><th data-k="id">記録名・解析</th><th data-k="study">研究名</th><th data-k="nv" class="hide-s">変数</th><th data-k="src" class="hide-s">データ</th><th data-k="n">行数</th><th>ファイル</th></tr></thead><tbody id="tb"></tbody></table></div>
</div>
<script>
const RECS = ${json};
const e = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const st = document.getElementById('st'); [...new Set(RECS.map(r => r.study).filter(Boolean))].forEach(s => st.insertAdjacentHTML('beforeend', '<option>' + e(s) + '</option>'));
let key = 'time', asc = false;
function draw() {
  const q = document.getElementById('q').value.trim().toLowerCase(), s = st.value;
  const rows = RECS.filter(r => (!s || r.study === s) && (!q || [r.id, r.title, r.study, r.kind, r.run, r.src, r.memo, ...(r.vars || [])].join(' ').toLowerCase().includes(q)));
  rows.sort((a, b) => { const va = key === 'nv' ? (a.vars || []).length : a[key], vb = key === 'nv' ? (b.vars || []).length : b[key]; return (va > vb ? 1 : va < vb ? -1 : 0) * (asc ? 1 : -1); });
  document.getElementById('tb').innerHTML = rows.map(r => '<tr><td class="when">' + e(r.when) + '</td><td class="name"><a href="' + e(r.out) + '">' + e(r.id) + '</a><div class="title">' + e(r.title) + '</div><span class="tag">' + e(r.kind) + '</span>' + (r.memo ? '<div>' + e(r.memo) + '</div>' : '') + '</td><td>' + e(r.study) + '</td><td class="vars hide-s">' + ((r.vars || []).length ? '<b>' + r.vars.length + '</b>：' + e(r.vars.slice(0, 12).join('、')) + (r.vars.length > 12 ? ' ほか' : '') : '') + '</td><td class="hide-s">' + e(r.src) + '</td><td>' + (r.n == null || r.n === '' ? '' : e(r.n)) + '</td><td class="files"><a href="' + e(r.out) + '">出力</a>' + (r.r ? '<a href="' + e(r.r) + '">R</a>' : '') + '<a href="' + e(r.data) + '">データ</a>' + (r.labels ? '<a href="' + e(r.labels) + '">ラベル表</a>' : '') + '</td></tr>').join('') || '<tr><td colspan="7">該当する記録はありません。</td></tr>';
  document.getElementById('cnt').textContent = rows.length + ' / ' + RECS.length + ' 件';
}
document.getElementById('q').oninput = draw; st.onchange = draw;
document.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; asc = key === k ? !asc : k !== 'time'; key = k; document.querySelectorAll('th[data-k]').forEach(t => t.textContent = t.textContent.replace(/ [▴▾]$/, '')); th.textContent += asc ? ' ▴' : ' ▾'; draw(); });
draw();
<\/script></body></html>
`;
}

// ---- 1 件の記録 ----
async function recSave(art, o, info) {
  if (!REC.dir) { recSay('記録フォルダが選ばれていません。'); return false; }
  if (!(await rlinkPerm(REC.dir))) { recSay('記録フォルダに書き込む許可がありません。「記録フォルダを選ぶ」から選び直してください。'); return false; }
  const t = info.time, stamp = recStamp(t), study = recSafe(recCfg.study || '');
  const vars = recVars(o.r), unit = /因子分析|クラスター|信頼性|一致/.test(o.title) ? '項目' : '変数';
  let base = [study, recShort(o.title), vars.length ? `${vars.length}${unit}使用` : '', stamp].filter(Boolean).join('_').slice(0, 120);
  const raw = await recRead('解析記録.json'); let log = []; try { log = raw ? JSON.parse(raw).records || [] : []; } catch (e) { log = []; }
  let id = base, k = 2; while (log.some(x => x.id === id)) id = `${base}_${k++}`;
  const D = info.data, hash = crc32(new TextEncoder().encode(D.text)).toString(16).padStart(8, '0');
  const prev = log.find(x => x.hash === hash && x.data);
  let data = prev && (await recExists(prev.data)) ? prev.data : `データ/${study ? study + '_' : ''}データ_${stamp}_${hash.slice(0, 6)}.${D.ext}`, labels = prev && prev.labels ? prev.labels : null;
  if (!prev || data !== prev.data) { await recWrite(data, D.text); if (D.labels) { labels = data.replace(/\.csv$/, '_ラベル表.csv'); await recWrite(labels, D.labels); } }
  const e = { id, time: t.toISOString(), when: recWhen(t), study: recCfg.study || '', title: o.title, kind: info.kind, run: info.run || '', vars, n: isFinite(D.n) ? D.n : null, p: isFinite(D.p) ? D.p : null, src: D.src, hash, data, labels, out: `出力/${id}.html`, r: o.r ? `R/${id}.R` : null, filter: info.filter || '', memo: '' };
  await recWrite(e.out, recOutHtml(e, o.html, o.r));
  if (o.r) await recWrite(e.r, o.r);
  log.push(e);
  await recWrite('解析記録.json', JSON.stringify({ app: 'ブラウザ統計ラボ', version: 1, records: log }, null, 1));
  await recWrite('解析記録.csv', recCsv(log));
  await recWrite('解析記録一覧.html', recIndexHtml(log));
  if (art) { art.dataset.rec = id; const m = art.querySelector('header .meta'); if (m && !m.querySelector('.rectag')) m.insertAdjacentHTML('beforeend', ` · <span class="rectag" title="${esc(id)}">記録済み</span>`); }
  REC.n++; recSay(`「${REC.name}」に記録しました：${id}（全 ${log.length} 件）`);
  return true;
}
function recQueue(art, o, info) { REC.busy = REC.busy.then(() => recSave(art, o, info)).catch(err => recSay('記録できませんでした：' + (err && (err.message || err.name) || err))); return REC.busy; }

// ---- 結果ツリーへの取り付け ----
{ const add0 = addResult;
  addResult = function (o, quiet) {
    add0(o, quiet);
    const art = document.querySelector('#results article.res'), f = FORMATS.find(x => x.id === state.fmt);
    const info = { time: new Date(), kind: f ? f.label : state.fmt, run: REC.lastRun && Date.now() - REC.lastRun.t < 4000 ? REC.lastRun.label : '', data: recData(), filter: state.fmt === 'db' && typeof filterMask === 'function' && filterMask() ? filterText() : '' };
    if (art) art._rec = { o: { title: o.title, html: o.html, r: o.r || null }, info };
    if (recCfg.on && REC.dir && recOK()) recQueue(art, art._rec.o, info);
  };
}
$('#panelBody').addEventListener('click', e => { const b = e.target.closest('[data-run]'); if (b) REC.lastRun = { t: Date.now(), label: (b.querySelector('b') || b).textContent.trim() }; }, true);

// ---- 設定の窓 ----
function recBtnLabel() { return recCfg.on && REC.dir ? `● 自動記録中` : '自動記録'; }
function recUi() {
  const b = document.getElementById('recBtn'); if (b) { b.textContent = recBtnLabel(); b.classList.toggle('recon', !!(recCfg.on && REC.dir)); b.title = REC.dir ? `記録フォルダ：${REC.name}` : '解析の出力・データ・記録をフォルダに自動で保存します'; }
  const p = document.getElementById('recPop'); if (p && !p.hidden) recPopRender();
}
function recPopRender() {
  const p = document.getElementById('recPop'); if (!p) return;
  if (!recOK()) { p.innerHTML = `<b>解析の自動記録</b><p class="hint">このブラウザ（またはこの画面）ではフォルダに書き込めません。ダウンロードした「ブラウザ統計ラボ.html」を <b>Chrome か Edge で直接開く</b>と使えます（claude.ai の中や Safari では使えません）。</p><div class="sheettools"><button class="btn" data-rec="close">閉じる</button></div>`; return; }
  const arts = [...document.querySelectorAll('#results article.res')].filter(a => a._rec && !a.dataset.rec);
  p.innerHTML = `<b>解析の自動記録</b>
  <p class="hint" style="margin:4px 0 8px">解析を実行するたびに、出力（HTML）・R スクリプト・その時のデータを記録フォルダに保存し、<b>解析記録一覧.html</b> を作り直します。</p>
  <label class="recrow">研究名（ファイル名の先頭）<input id="recStudy" value="${esc(recCfg.study || '')}" placeholder="例：FMS研究"></label>
  <div class="recrow">記録フォルダ：<b>${REC.dir ? esc(REC.name) : '未設定'}</b> <button class="btn" data-rec="pick">${REC.dir ? '変える' : '選ぶ'}</button></div>
  <label class="recrow"><input type="checkbox" id="recOn" ${recCfg.on ? 'checked' : ''} ${REC.dir ? '' : 'disabled'}> 解析を実行するたびに自動で記録する</label>
  <p class="hint" id="recEx" style="margin:2px 0 6px">名前の例：${esc([recSafe(recCfg.study || '研究名'), '因子分析5因子モデル', '36項目使用', recStamp(new Date())].join('_'))}</p>
  <div class="sheettools">${arts.length ? `<button class="btn" data-rec="all" ${REC.dir ? '' : 'disabled'}>結果ツリーのまだ記録していない ${arts.length} 件を記録</button>` : ''}<button class="btn" data-rec="close">閉じる</button></div>
  <p class="hint" id="recMsg" style="margin:6px 0 0">${esc(REC.msg)}</p>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('#recBtn, [data-rec]'); const p = document.getElementById('recPop');
  if (!b) { if (p && !p.hidden && !e.target.closest('#recPop')) p.hidden = true; return; }
  if (b.id === 'recBtn') { p.hidden = !p.hidden; if (!p.hidden) { await recRestore(); recPopRender(); } return; }
  const a = b.dataset.rec;
  if (a === 'close') { p.hidden = true; return; }
  if (a === 'pick') { if (await recPick()) { if (!recCfg.on) { recCfg.on = true; recCfgSave(); } recSay(`記録フォルダを「${REC.name}」にしました。これから実行する解析を自動で記録します。`); recUi(); recPopRender(); } return; }
  if (a === 'all') { const arts = [...document.querySelectorAll('#results article.res')].filter(x => x._rec && !x.dataset.rec).reverse(); for (const x of arts) await recQueue(x, x._rec.o, x._rec.info); recPopRender(); return; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'recOn') { recCfg.on = e.target.checked; recCfgSave(); recSay(recCfg.on ? 'これから実行する解析を自動で記録します。' : '自動記録を止めました。'); recUi(); }
});
document.addEventListener('input', e => { if (e.target.id === 'recStudy') { recCfg.study = e.target.value; recCfgSave(); const ex = document.getElementById('recEx'); if (ex) ex.textContent = '名前の例：' + [recSafe(recCfg.study || '研究名'), '因子分析5因子モデル', '36項目使用', recStamp(new Date())].join('_'); } });
setTimeout(recRestore, 0);
