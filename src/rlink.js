// ---- RStudio 連携：作業フォルダに data.csv・読み込み用 R・分析ごとの R スクリプト・.Rproj を書き出す ----
const RLINK = { dir: null, name: '' };
const rlinkFsOK = () => typeof window.showDirectoryPicker === 'function' && (() => { try { return window.self === window.top; } catch (e) { return false; } })();
function rlinkIdb(mode, fn) { // 作業フォルダの記憶（ブラウザの IndexedDB。使えなければ毎回選ぶ）
  return new Promise(res => { try { const rq = indexedDB.open('statlab-rlink', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('h'); rq.onsuccess = () => { try { const tx = rq.result.transaction('h', mode), st = tx.objectStore('h'), r = fn(st); tx.oncomplete = () => res(r && 'result' in r ? r.result : true); tx.onerror = () => res(null); } catch (e) { res(null); } }; rq.onerror = () => res(null); } catch (e) { res(null); } });
}
async function rlinkRestore() { if (!rlinkFsOK() || RLINK.dir) return; const h = await rlinkIdb('readonly', st => st.get('dir')); if (h && h.kind === 'directory') { RLINK.dir = h; RLINK.name = h.name; rlinkStatus(); } }
async function rlinkPick() {
  try { const h = await window.showDirectoryPicker({ id: 'statlab-r', mode: 'readwrite' }); RLINK.dir = h; RLINK.name = h.name; await rlinkIdb('readwrite', st => st.put(h, 'dir')); rlinkStatus(); return true; }
  catch (e) { if (e && e.name !== 'AbortError') rlinkSay('作業フォルダを選べませんでした：' + e.message); return false; }
}
async function rlinkPerm(h) { try { if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true; return (await h.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { return false; } }
function rlinkStatus() { const el = document.getElementById('rlinkDir'); if (el) el.textContent = RLINK.dir ? `作業フォルダ：「${RLINK.name}」` : (rlinkFsOK() ? '作業フォルダ：未設定' : '（このブラウザでは ZIP でダウンロードします）'); }
function rlinkSay(t) { const m = $('#msg'); if (m) m.textContent = t; }

const rlDate = () => { const d = new Date(), p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const rlStamp = () => { const d = new Date(), p = v => String(v).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
function rlinkDataCsv() { // 解析が使うのと同じ値（欠損値は空欄、名義の列は値ラベル）
  const cols = state.db.cols.map((_, j) => dbCol(j)), n = state.db.rows.length;
  return '﻿' + [state.db.cols.map(c => csvCell(c.name)).join(','), ...Array.from({ length: n }, (_, i) => cols.map(c => csvCell(c[i] ?? '')).join(','))].join('\n') + '\n';
}
function rlinkLoaderR() {
  const C = state.db.cols, cat = C.map((_, j) => j).filter(j => colType(j) === 'cat');
  return `# 00_読み込み.R ── ブラウザ統計ラボから書き出したデータを読み込みます（${rlDate()}）
# 作業ディレクトリは、このファイルのあるフォルダです（.Rproj から RStudio を開くと自動でそうなります）。
# 欠損値は NA に、名義尺度の列は値ラベルの因子（factor）にしてあります。値ラベルなどの一覧は labels.csv にあります。

options(mc.cores = 1)   # psych などの並列計算を止める（Mac で平行分析などが途中で止まるのを防ぐ）
全データ <- read.csv("data.csv", check.names = FALSE, na.strings = c("", "NA"), fileEncoding = "UTF-8-BOM")
${cat.map(j => `全データ$${RQ(C[j].name)} <- factor(全データ$${RQ(C[j].name)}, levels = c(${levelsOf(dbCol(j)).map(RS).join(', ')}))`).join('\n')}
# 変数ラベル（項目内容）：RStudio の View(全データ) で、列名の下に表示されます
${C.map(c => (c.label || '').trim() ? `attr(全データ$${RQ(c.name)}, "label") <- ${RS(c.label.trim())}` : '').filter(Boolean).join('\n') || '# （変数ラベルはありません）'}

cat("全データ：", nrow(全データ), "人 ×", ncol(全データ), "変数を読み込みました\\n")
`;
}
const RLINK_RPROJ = 'Version: 1.0\n\nRestoreWorkspace: No\nSaveWorkspace: No\nAlwaysSaveHistory: Default\n\nEnableCodeIndexing: Yes\nUseSpacesForTab: Yes\nNumSpacesForTab: 2\nEncoding: UTF-8\n\nRnwWeave: Sweave\nLaTeX: pdfLaTeX\n';
function rlinkReadme(scripts) {
  return `ブラウザ統計ラボ → RStudio 連携（${rlDate()} に書き出し）

■ 使い方
1. このフォルダの「ブラウザ統計ラボ.Rproj」をダブルクリックすると、RStudio が開き、作業ディレクトリがこのフォルダになります。
2. 「00_読み込み.R」を開いて実行（Source）すると、データが「全データ」という名前で読み込まれます。
3. 分析ごとの R スクリプト（01_〜）は、それぞれ最初に 00_読み込み.R を読み込んでから、アプリと同じ分析を行います。

■ ファイル
- data.csv ………… データ（欠損値は空欄、名義尺度の列は値ラベル）。Excel でも開けます。
- labels.csv ……… ラベル表（変数ラベル・値ラベル・尺度・欠損値）。ブラウザ統計ラボの「ラベル表を読み込む」で読み戻せます。
- 00_読み込み.R …… data.csv を読み込み、因子と変数ラベルを設定するスクリプト
${(state.db.recipe || []).length ? '- 加工の記録.R …… アプリで行ったデータの加工（尺度得点・リコードなど）を R で行うコード（記録用。data.csv にはすでに加工後の列が入っています）\n' : ''}${filterMask() ? `- ケースの選択中（${filterText()}）に書き出したので、選ばれていない人の値は data.csv で空欄（欠損）になっています。\n` : ''}${scripts.map(s => `- ${s}`).join('\n') || '- （分析の R スクリプトはありません。アプリで分析してから書き出すと、ここに入ります）'}
- 以前の版/ ……… 同じ名前のファイルを書き換える前の控え（作業フォルダに書き出したときだけ）

■ 注意
- データを書き出した時点の内容です。アプリでデータを直したら、もう一度書き出してください。
- 書き出し後のデータとは違うデータで作った分析は、データをスクリプトの中に埋め込んだまま書き出しています。
`;
}
function rlinkScripts() { // 結果ツリーの R スクリプトを、data.csv を読む形に書き換える
  const arts = [...document.querySelectorAll('#results .res, .res')].filter((a, i, A) => A.indexOf(a) === i && a.querySelector('.rcode pre')).reverse(), out = [], used = new Set();
  const names = new Set(state.db.cols.map(c => c.name)), csvOf = js => js.map(j => csvCell(state.db.cols[j].name)).join(',') + '\n' + state.db.rows.map((_, i) => js.map(j => csvCell(dbCol(j)[i] ?? '')).join(',')).join('\n');
  const parseHead = line => { const r = [], re = /("([^"]|"")*"|[^,]*)(,|$)/g; let m; while ((m = re.exec(line)) && m[0] !== '') { let v = m[1]; if (v.startsWith('"')) v = v.slice(1, -1).replace(/""/g, '"'); r.push(v); if (m[3] === '') break; } return r; };
  arts.forEach((a, k) => {
    let t = a.querySelector('.rcode pre').textContent; const title = a.dataset.title || a.querySelector('h3')?.textContent || '分析';
    let linked = false;
    t = t.replace(/(\w+) <- read\.csv\(text = r"---\(\n([^\n]*)\n([\s\S]*?)\n?\)---", check\.names = FALSE, na\.strings = c\("", "NA"\), fileEncoding = "UTF-8"\)\n/, (all, obj, head, body) => {
      const hs = parseHead(head); if (!hs.length || !hs.every(h => names.has(h))) return all;
      const js = hs.map(h => state.db.cols.findIndex(c => c.name === h)), cur = csvOf(js).split('\n').slice(1).join('\n');
      if (cur.replace(/\n+$/, '') !== body.replace(/\n+$/, '')) return all; // データが変わっている → 埋め込みのまま
      linked = true; return `source("00_読み込み.R", encoding = "UTF-8")   # data.csv を「全データ」として読み込む\n${obj} <- 全データ[, c(${hs.map(RS).join(', ')}), drop = FALSE]\n`;
    });
    if (linked) t = t.replace('データはこのファイルに埋め込んであります。', 'データは同じフォルダの data.csv から読み込みます。');
    let base = String(k + 1).padStart(2, '0') + '_' + title.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '').slice(0, 40); while (used.has(base)) base += '_'; used.add(base);
    out.push({ name: base + '.R', text: t, linked });
  });
  return out;
}
function rlinkFiles() {
  const sc = rlinkScripts();
  return { scripts: sc, files: [{ name: 'data.csv', text: rlinkDataCsv() }, { name: 'labels.csv', text: cbCsv(cbRows()) }, { name: '00_読み込み.R', text: rlinkLoaderR() }, { name: 'ブラウザ統計ラボ.Rproj', text: RLINK_RPROJ, keep: true }, ...((state.db.recipe || []).length ? [{ name: '加工の記録.R', text: recipeR() }] : []), ...sc, { name: 'はじめに.txt', text: rlinkReadme(sc.map(s => s.name)) }] };
}
async function rlinkWriteDir(dir, files) { // 同じ名前で中身が違うファイルは「以前の版」に控えてから書く
  let backup = null, nb = 0, stamp = rlStamp();
  for (const f of files) {
    let old = null; try { old = await (await (await dir.getFileHandle(f.name)).getFile()).text(); } catch (e) { }
    if (old !== null && f.keep) continue;
    if (old !== null && old !== f.text) { if (!backup) backup = await (await dir.getDirectoryHandle('以前の版', { create: true })).getDirectoryHandle(stamp, { create: true }); const bh = await backup.getFileHandle(f.name, { create: true }), bw = await bh.createWritable(); await bw.write(old); await bw.close(); nb++; }
    if (old === f.text) continue;
    const h = await dir.getFileHandle(f.name, { create: true }), w = await h.createWritable(); await w.write(f.text); await w.close();
  }
  return { nb, stamp };
}
async function rlinkExport(btn) {
  const say = t => { if (btn) { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = t; setTimeout(() => btn.textContent = o, 4000); } };
  if (state.fmt !== 'db') { rlinkSay('RStudio 連携は「データベース型」のデータで使えます。'); return; }
  const F = rlinkFiles(), nl = F.scripts.filter(s => s.linked).length;
  try {
    if (rlinkFsOK()) {
      if (!RLINK.dir && !(await rlinkPick())) return;
      if (!(await rlinkPerm(RLINK.dir))) { rlinkSay('作業フォルダに書き込む許可がありません。「作業フォルダを選ぶ」から選び直してください。'); return; }
      const r = await rlinkWriteDir(RLINK.dir, F.files);
      rlinkSay(`作業フォルダ「${RLINK.name}」に書き出しました：data.csv・labels.csv・00_読み込み.R・分析スクリプト ${F.scripts.length} 本（うち data.csv を読む形 ${nl} 本）。${r.nb ? `書き換えた ${r.nb} ファイルの前の版は「以前の版/${r.stamp}」に残しました。` : ''}「ブラウザ統計ラボ.Rproj」をダブルクリックすると RStudio が開きます。`);
      say('書き出しました');
    } else {
      const zip = zipStore(F.files.map(f => ({ name: 'ブラウザ統計ラボ_R/' + f.name, data: f.text })));
      await saveFile('ブラウザ統計ラボ_R.zip', zip);
      rlinkSay(`ZIP（ブラウザ統計ラボ_R.zip）を保存しました：data.csv・labels.csv・00_読み込み.R・分析スクリプト ${F.scripts.length} 本。展開したフォルダの「ブラウザ統計ラボ.Rproj」をダブルクリックすると RStudio が開きます。`);
      say('保存しました');
    }
  } catch (e) { say('書き出せませんでした'); rlinkSay('書き出せませんでした：' + (e && (e.message || e.code) || e)); }
}
function rlinkBox() {
  return `<div class="vvbox" style="margin-top:10px"><b>RStudio 連携</b> <span class="hint" id="rlinkDir">${RLINK.dir ? `作業フォルダ：「${esc(RLINK.name)}」` : (rlinkFsOK() ? '作業フォルダ：未設定' : '（このブラウザでは ZIP でダウンロードします）')}</span>
    <div class="sheettools" style="margin-top:6px"><button class="btn primary" data-vact="rlink">RStudio 用に書き出す</button>${rlinkFsOK() ? '<button class="btn" data-vact="rdir">作業フォルダを選ぶ</button>' : ''}</div>
    <p class="hint" style="margin:4px 0 0">データ（data.csv）・ラベル表・読み込み用の R・結果ツリーにある分析の R スクリプト・RStudio のプロジェクトファイル（.Rproj）を${rlinkFsOK() ? '作業フォルダに書き出します。同じ名前のファイルは「以前の版」に控えてから書き換えます' : 'まとめて ZIP で保存します。展開したフォルダの .Rproj をダブルクリックすると RStudio が開きます（作業フォルダへの直接書き出しは、Chrome か Edge で HTML ファイルを開いたときに使えます）'}。</p></div>`;
}
setTimeout(rlinkRestore, 0);
