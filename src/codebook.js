// ---- ラベル表（コードブック）：Excel の別シート・別の CSV から、変数ラベル・値ラベル・尺度・欠損値を読み込む ----
const CB_COLS = {
  name: ['変数名', '変数', 'name', 'variable', 'var', '項目名', '短い項目名'],
  label: ['ラベル', '変数ラベル', 'label', 'variablelabel', '項目内容', '内容', '質問文', '項目'],
  value: ['値', 'value', 'コード', 'code', '値コード'],
  vlab: ['値ラベル', 'valuelabel', 'valuelabels', '値の意味', '値の内容', '値ラベル（例：1=男性;2=女性）'],
  measure: ['尺度', '測定尺度', 'measure', '尺度水準', '水準', 'measurement'],
  missing: ['欠損値', 'missing', '欠損', 'missingvalues'] };
const cbNorm = s => String(s ?? '').normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase();
function cbHeader(rows) { // 見出し行（最初の 3 行から探す）と列の位置
  for (let r = 0; r < Math.min(3, rows.length); r++) {
    const h = rows[r].map(cbNorm), idx = {};
    Object.entries(CB_COLS).forEach(([k, syn]) => { const s = syn.map(cbNorm); const j = h.findIndex(x => s.includes(x)); if (j >= 0) idx[k] = j; });
    if (idx.name !== undefined && ['label', 'value', 'vlab', 'measure', 'missing'].some(k => idx[k] !== undefined)) return { r, idx };
  }
  return null;
}
const cbIsCodebook = rows => !!cbHeader(rows);
function cbMeasure(s) { const v = cbNorm(s); if (!v) return null; if (/^(スケール|scale|間隔|比率|量的|数値|連続|interval|ratio)/.test(v)) return 'scale'; if (/^(順序|ordinal|順位)/.test(v)) return 'ordinal'; if (/^(名義|nominal|カテゴリ|質的|category)/.test(v)) return 'nominal'; return undefined; }
function cbParse(sheets) { // name → { label, values, measure, missing }
  const map = new Map(), bad = [];
  sheets.forEach(sh => {
    const H = cbHeader(sh.rows); if (!H) return; const g = (row, k) => H.idx[k] === undefined ? '' : String(row[H.idx[k]] ?? '').trim(); let cur = null;
    sh.rows.slice(H.r + 1).forEach((row, q) => {
      const nm = g(row, 'name');
      if (nm) { if (!map.has(nm)) map.set(nm, { label: '', values: [], measure: null, missing: null, hasVal: false }); cur = map.get(nm); }
      if (!cur) return; // 変数名の空欄は、すぐ上の変数の続き（値ラベルを複数行に書く場合）
      const lab = g(row, 'label'); if (lab && nm) cur.label = lab;
      const ms = g(row, 'measure'); if (ms) { const m = cbMeasure(ms); if (m === undefined) bad.push(`${nm || '（続き）'} の尺度「${ms}」`); else cur.measure = m; }
      const mi = g(row, 'missing'); if (mi) cur.missing = mi.replace(/[、，]/g, ',');
      const v = g(row, 'value'), vl = g(row, 'vlab');
      if (v !== '' && vl !== '') { cur.values = cur.values.filter(x => x[0] !== v); cur.values.push([v, vl]); cur.hasVal = true; }
      else if (v === '' && /[=＝]/.test(vl)) { // 「1=男性; 2=女性」のように 1 つのセルにまとめた書き方
        vl.split(/[;；\n]|[,，、]\s*(?=[^,，、;；=＝]+[=＝])/).map(x => x.trim()).filter(Boolean).forEach(p => { const m = p.match(/^([^=＝]+)[=＝](.*)$/); if (m) { const c = m[1].trim(), l = m[2].trim(); cur.values = cur.values.filter(x => x[0] !== c); cur.values.push([c, l]); cur.hasVal = true; } });
      }
    });
  });
  return { map, bad };
}
function cbApply(sheets) {
  const { map, bad } = cbParse(sheets), cols = state.db.cols, used = new Set(), sum = { label: 0, values: 0, measure: 0, missing: 0, matched: 0 };
  const byName = new Map(cols.map((c, j) => [c.name, j])), byNorm = new Map(cols.map((c, j) => [cbNorm(c.name), j]));
  const unknown = [];
  map.forEach((e, nm) => {
    const j = byName.has(nm) ? byName.get(nm) : byNorm.get(cbNorm(nm)); if (j === undefined) { unknown.push(nm); return; }
    const c = cols[j]; sum.matched++; used.add(j);
    if (e.label) { c.label = e.label; sum.label++; }
    if (e.hasVal) { c.values = e.values.map(v => [...v]); sum.values++; }
    if (e.measure) { c.measure = e.measure; sum.measure++; }
    if (e.missing !== null) { c.missing = e.missing; sum.missing++; }
  });
  const noEntry = cols.filter((_, j) => !used.has(j)).map(c => c.name);
  return { sum, unknown, noEntry, bad, n: map.size };
}
function cbApplyAndReport(sheets, src, afterLoad) {
  const prev = ($('#msg') || {}).textContent || '', R = cbApply(sheets); save(); renderSheet(); renderPanel();
  const s = R.sum, line = `ラベル表（${src}）から ${s.matched} 変数に設定しました：変数ラベル ${s.label}・値ラベル ${s.values}・尺度 ${s.measure}・欠損値 ${s.missing}。`;
  const warn = [R.unknown.length ? `データにない変数名（${R.unknown.length}）：${R.unknown.slice(0, 12).map(esc).join('、')}${R.unknown.length > 12 ? ' ほか' : ''}（綴りや全角・半角の違いを確認してください）` : '',
    R.bad.length ? `読み取れなかった尺度：${R.bad.slice(0, 6).map(esc).join('、')}（「スケール」「順序」「名義」のどれかを書いてください）` : '',
    R.noEntry.length && R.noEntry.length < state.db.cols.length ? `ラベル表に書かれていない変数（${R.noEntry.length}）：${R.noEntry.slice(0, 12).map(esc).join('、')}${R.noEntry.length > 12 ? ' ほか' : ''}` : ''].filter(Boolean);
  const box = importNotice(`<b>${afterLoad ? 'データとラベル表を読み込みました' : 'ラベル表を読み込みました'}</b><div style="margin-top:4px">${esc(line)}変数ビューで確認・修正できます。</div>${warn.map(w => `<div class="hint" style="margin-top:4px;color:var(--sig)">${w}</div>`).join('')}<div class="sheettools" style="margin-top:8px"><button class="btn" data-ia="var">変数ビューで確認する</button><button class="btn" data-ia="close">閉じる</button></div>`, warn.length ? 'err' : '');
  box.addEventListener('click', e => { const b = e.target.closest('[data-ia]'); if (!b) return; if (b.dataset.ia === 'var') { state.opt.dbView = 'var'; save(); renderSheet(); } else box.remove(); });
  const msg = $('#msg'); if (msg) msg.textContent = (afterLoad && prev ? prev + ' ' : '') + line;
}
async function cbReadSheets(files) {
  const out = [];
  for (const f of files) { const ext = (f.name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase(), buf = await f.arrayBuffer(); const sh = (ext === 'csv' || ext === 'tsv' || ext === 'txt' ? readCsv(buf) : await readXlsx(buf)).filter(s => s.rows.length); sh.forEach(s => out.push({ ...s, file: f.name })); }
  return out;
}
async function importFiles(files) { // データ（と、あればラベル表）を読み込む。複数ファイルを同時に選んでもよい
  files = files.filter(f => /\.(z?sav|xlsx|xlsm|xls|csv|tsv|txt)$/i.test(f.name)); if (!files.length) return;
  const sav = files.find(f => /\.z?sav$/i.test(f.name)); if (sav) return importSav(sav);
  if (files.some(f => /\.xls$/i.test(f.name))) return importError('古い Excel 形式（.xls）は読めません。Excel で開いて「名前を付けて保存」から「Excel ブック（.xlsx）」で保存し直してください。');
  let all; try { all = await cbReadSheets(files); } catch (err) { return importError(err.message); }
  const cb = all.filter(s => cbIsCodebook(s.rows)), data = all.filter(s => !cbIsCodebook(s.rows)), src = cb.map(s => files.length > 1 ? s.file : `「${s.name}」シート`).join('・');
  if (!data.length) { if (!cb.length) return importError('データの入ったシートがありません。'); return cbApplyAndReport(cb, src, false); }
  if (!(await confirmReplace({ name: files.map(f => f.name).join('」と「') }))) return;
  if (data.length === 1) { loadTable(data[0], data[0].file); if (cb.length) cbApplyAndReport(cb, src, true); return; }
  $('#sheetBody').innerHTML = `<div class="vvbox"><b>データの入ったシートが ${data.length} 枚あります。読み込むシートを選んでください。</b>${cb.length ? `<div class="hint" style="margin-top:4px">ラベル表（${esc(src)}）は、選んだシートに自動で設定します。</div>` : ''}<div class="sheettools" style="margin-top:8px">${data.map((s, i) => `<button class="btn" data-pick="${i}">${files.length > 1 ? esc(s.file) + '：' : ''}${esc(s.name)}（${s.rows.length} 行 × ${s.rows[0].length} 列）</button>`).join('')}<button class="btn" data-pick="-1">やめる</button></div></div>`;
  pendingSheets = { sheets: data, name: files[0].name, cb, src };
}
async function importCodebookFiles(files) { // 今のデータにラベル表だけを読み込む
  if (!files.length) return; let all; try { all = await cbReadSheets(files); } catch (err) { return importError(err.message); }
  const cb = all.filter(s => cbIsCodebook(s.rows));
  if (!cb.length) return importError('ラベル表として読める表が見つかりませんでした。1 行目に「変数名」と、「ラベル」「値」「値ラベル」「尺度」「欠損値」のどれかの見出しが必要です（「ラベル表の作り方」を参照）。');
  cbApplyAndReport(cb, cb.map(s => files.length > 1 || cb.length === 1 ? s.file : s.name).join('・'), false);
}

// ---- ひな形の書き出し ----
function cbRows() { // 今の変数ビューの設定をラベル表（縦長の形式）にする
  const ml = { scale: 'スケール', ordinal: '順序', nominal: '名義' }, out = [['変数名', 'ラベル', '値', '値ラベル', '尺度', '欠損値']];
  state.db.cols.forEach(c => { const vals = c.values || [], m = ml[c.measure] || '';
    if (!vals.length) out.push([c.name, c.label || '', '', '', m, c.missing || '']);
    vals.forEach((v, k) => out.push(k ? ['', '', v[0], v[1], '', ''] : [c.name, c.label || '', v[0], v[1], m, c.missing || ''])); });
  return out;
}
function xlsxMulti(sheets) { // シートを複数もつ簡単な .xlsx（文字はセルに直接書く）
  const esx = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sx = (rows, widths) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${widths ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}<sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => { const ref = col(j) + (i + 1), s = String(v ?? ''); if (s === '') return ''; const st = i === 0 ? ' s="1"' : ''; return i > 0 && /^-?\d+(\.\d+)?$/.test(s) && s.length < 16 ? `<c r="${ref}"${st}><v>${s}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esx(s)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="游ゴシック"/></font><font><b/><sz val="11"/><name val="游ゴシック"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  return zipStore([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esx(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sx(s.rows, s.widths) })),
    { name: 'xl/styles.xml', data: styles }]);
}
const cbCsv = rows => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
async function exportCodebook(kind, btn) {
  const say = t => { if (btn) { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = t; setTimeout(() => btn.textContent = o, 3000); } };
  try {
    if (kind === 'xlsx') await saveFile('データとラベル表.xlsx', xlsxMulti([{ name: 'データ', rows: [state.db.cols.map(c => c.name), ...state.db.rows] }, { name: 'ラベル', rows: cbRows(), widths: [14, 40, 8, 24, 10, 10] }]));
    else await saveFile('ラベル表.csv', cbCsv(cbRows()));
    say('保存しました');
  } catch (e) { say('保存できませんでした'); }
}
function cbHelp() {
  return `<details class="mcguide"><summary>ラベル表の作り方（Excel の 2 シート目・別の CSV）</summary><div style="padding:6px 2px">
    <p class="note">データとは別に「ラベル表」を用意すると、読み込むときに変数ラベル（項目内容）・値ラベル・尺度・欠損値をまとめて設定できます。1 行目に次の見出しを書きます（必要な列だけでかまいません）。</p>
    ${table(['変数名', 'ラベル', '値', '値ラベル', '尺度', '欠損値'], [['性別', '回答者の性別', '1', '男性', '名義', '9'], ['', '', '2', '女性', '', ''], ['対人1', '初対面の人と話すのは苦手だ', '1', '全くあてはまらない', '順序', '9'], ['', '', '2', 'あまりあてはまらない', '', ''], ['', '', '…', '…', '', ''], ['年齢', '回答時の年齢', '', '', 'スケール', '999']])}
    <ul class="note" style="margin:6px 0 0 1.2em;padding:0">
      <li><b>Excel</b>：1 枚目にデータ、2 枚目（シート名は自由）にラベル表を置いて「ファイルを開く」で読み込むと、自動で見分けて設定します。</li>
      <li><b>CSV</b>：データの CSV とラベル表の CSV を<b>同時に選んで</b>（⌘ を押しながらクリック）開くか、データを読み込んだあとで「ラベル表を読み込む」を押します。</li>
      <li>値ラベルは 1 行に 1 つずつ書き、変数名が空欄の行はすぐ上の変数の続きとみなします。1 つのセルに「1=男性; 2=女性」とまとめて書いてもかまいません。</li>
      <li>尺度は「スケール」「順序」「名義」、欠損値は「9」「9, 99」「90~99」のように書きます。</li>
      <li>「ラベル表のひな形を書き出す」で今の設定を書き出し、Excel で書き足してから読み込むのが簡単です。</li></ul></div></details>`;
}
