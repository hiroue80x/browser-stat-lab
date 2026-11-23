// ===== Excel（.xlsx）と CSV の読み込み =====
async function unzipEntries(buf, want) { // ZIP から必要なファイルだけ取り出す
  const u8 = new Uint8Array(buf), dv = new DataView(buf); let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Excel ファイル（.xlsx）として読めません。');
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const out = {}, td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!want(name)) continue;
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = u8.slice(ds, ds + csz);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error('対応していない圧縮方式のファイルです。');
    out[name] = td.decode(data);
  }
  return out;
}
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const byTag = (el, tag) => [...el.getElementsByTagName(tag)].concat(el.getElementsByTagNameNS ? [...el.getElementsByTagNameNS('*', tag)].filter(x => x.tagName !== tag) : []);
function isDateFmt(id, code) {
  if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
  if (!code) return false; const c = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[ymdhsegGaA]|年|月|日/.test(c) && !/^[#0.,%\s]*$/.test(c);
}
async function readXlsx(buf) {
  const f = await unzipEntries(buf, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(n));
  if (!f['xl/workbook.xml']) throw new Error('Excel ファイル（.xlsx）として読めません。');
  const wb = xmlDoc(f['xl/workbook.xml']), rels = xmlDoc(f['xl/_rels/workbook.xml.rels'] || '<r/>'), relMap = {};
  byTag(rels, 'Relationship').forEach(r => relMap[r.getAttribute('Id')] = r.getAttribute('Target'));
  const d1904 = byTag(wb, 'workbookPr').some(w => /^(1|true)$/.test(w.getAttribute('date1904') || ''));
  // 共有文字列（ふりがな rPh は除く）
  const ss = f['xl/sharedStrings.xml'] ? byTag(xmlDoc(f['xl/sharedStrings.xml']), 'si').map(si => byTag(si, 't').filter(t => { let e = t.parentNode; while (e && e !== si) { if (e.localName === 'rPh') return false; e = e.parentNode; } return true; }).map(t => t.textContent).join('')) : [];
  // 日付の書式
  const dateXf = [];
  if (f['xl/styles.xml']) {
    const st = xmlDoc(f['xl/styles.xml']), codes = {}; byTag(st, 'numFmt').forEach(nf => codes[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode'));
    const cx = byTag(st, 'cellXfs')[0]; if (cx) [...cx.children].filter(x => x.localName === 'xf').forEach((xf, i) => { const id = +xf.getAttribute('numFmtId') || 0; dateXf[i] = isDateFmt(id, codes[id]); });
  }
  const toDate = v => { const ms = Math.round((v + (d1904 ? 1462 : 0) - 25569) * 86400000), d = new Date(ms), iso = d.toISOString(); return Math.abs(v % 1) < 1e-9 ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' '); };
  const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
  const sheets = byTag(wb, 'sheet').map(sh => {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'); let tgt = relMap[rid] || '';
    tgt = tgt.startsWith('/') ? tgt.slice(1) : 'xl/' + tgt.replace(/^\.\//, ''); const xml = f[tgt]; if (!xml) return { name: sh.getAttribute('name'), rows: [] };
    const doc = xmlDoc(xml), rows = [];
    byTag(doc, 'row').forEach((r, ri) => {
      const rn = (+r.getAttribute('r') || ri + 1) - 1, row = rows[rn] = rows[rn] || [];
      [...r.children].filter(c => c.localName === 'c').forEach((c, ci) => {
        const ref = c.getAttribute('r'), j = ref ? colIdx(ref) : ci, t = c.getAttribute('t'), vEl = [...c.children].find(x => x.localName === 'v'), v = vEl ? vEl.textContent : '';
        let out = '';
        if (t === 's') out = ss[+v] ?? ''; else if (t === 'inlineStr') out = byTag(c, 't').map(x => x.textContent).join(''); else if (t === 'str') out = v; else if (t === 'b') out = v === '1' ? 'TRUE' : 'FALSE'; else if (t === 'e') out = '';
        else if (v !== '') { const num = parseFloat(v); out = dateXf[+c.getAttribute('s') || 0] && isFinite(num) ? toDate(num) : String(+num.toPrecision(15)); }
        row[j] = out.trim();
      });
    });
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i] || [];
    return { name: sh.getAttribute('name'), rows: tidyRows(rows) };
  });
  return sheets;
}
function tidyRows(rows) { // 空の行・列を除き、長さをそろえる
  rows = rows.map(r => Array.from({ length: r.length }, (_, j) => r[j] ?? ''));
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
  const w = Math.max(0, ...rows.map(r => { let k = r.length; while (k && r[k - 1] === '') k--; return k; }));
  return rows.map(r => Array.from({ length: w }, (_, j) => r[j] ?? ''));
}
function readCsv(buf) {
  const u8 = new Uint8Array(buf); let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { text = new TextDecoder('shift_jis').decode(u8); }
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '', sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"' && cur === '') q = true; else if (c === sep) { row.push(cur.trim()); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur.trim()); rows.push(row); }
  return [{ name: 'CSV', rows: tidyRows(rows) }];
}
function rowsToDb(rows) { // 1行目が見出しなら変数名にする
  const isNum = v => v !== '' && !isNaN(Number(String(v).replace(/,/g, '')));
  const header = rows.length > 1 && rows[0].some(v => v !== '' && !isNum(v)) && rows[0].filter(v => v !== '').length >= rows[0].length * .5;
  const w = rows[0] ? rows[0].length : 0, seen = {};
  const names = Array.from({ length: w }, (_, j) => { let n = header ? String(rows[0][j] || '').replace(/[\r\n]+/g, ' ').trim() : ''; if (!n) n = `変数${j + 1}`; if (seen[n]) { let k = 2; while (seen[`${n}_${k}`]) k++; n = `${n}_${k}`; } seen[n] = 1; return n; });
  return { header, cols: names.map(n => ({ name: n, on: true })), rows: (header ? rows.slice(1) : rows).map(r => r.map(v => String(v))) };
}
if (typeof module !== 'undefined') module.exports = { readXlsx, readCsv, rowsToDb, tidyRows };
