// ===== 出力：APA 形式の表（Word に貼り付け・.docx・.xlsx・HTML・Markdown） =====
const APA_SYM = { 'p 値': 'p', 'p': 'p', 't': 't', 'F': 'F', 'z': 'z', 'n': 'n', 'N': 'N', 'SD': 'SD', 'SE': 'SE', 'M': 'M', 'B': 'B', 'r': 'r', '自由度': 'df', 'df': 'df', 'U': 'U', 'W': 'W', 'H': 'H', 'β': 'β', 'R²': 'R²', 'R': 'R' };
const STAR_NOTE = '* p < .05. ** p < .01. *** p < .001.';
// 結果カードから、表・図・論文記載例を順に取り出す
function extractBlocks(art) {
  const body = art.querySelector('.body'), out = [{ type: 'title', text: art.dataset.title }]; let lastH = '';
  const skip = el => el.closest('.interp, .guide, .rcode, details, .figbar, .apa');
  body.querySelectorAll('h4, table.out, svg.chart, .apa, p.note').forEach(el => {
    if (el.tagName !== 'DIV' && el.classList && !el.classList.contains('apa') && skip(el)) return;
    if (el.tagName === 'H4') { lastH = el.textContent.trim(); return; }
    if (el.classList.contains('apa')) { out.push({ type: 'apa', html: el.innerHTML.replace(/^<b>[^<]*<\/b>/, '') }); return; }
    if (el.tagName === 'P') { const prev = out[out.length - 1]; if (prev && prev.type === 'table' && !prev.note && el.previousElementSibling && el.previousElementSibling.querySelector && el.previousElementSibling.querySelector('table.out')) prev.note = el.textContent.trim(); return; }
    if (el.tagName === 'TABLE') {
      const head = [...el.querySelectorAll('thead th')].map(th => th.textContent.trim()), rows = [...el.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.replace(/\s+/g, ' ').trim()));
      if (!rows.length) return; const prev = out[out.length - 1];
      out.push({ type: 'table', title: prev && prev.type === 'table' && prev.title.replace(/（続き）$|（モデルの要約）$/, '') === lastH ? lastH + (head.some(h => /^R²$|^R$|調整済み R²/.test(h)) ? '（モデルの要約）' : '（続き）') : (lastH || '結果'), head, rows, stars: rows.some(r => r.some(c => /\*/.test(c))) }); return;
    }
    if (el.tagName === 'svg' || el.tagName === 'SVG') { if (el.closest('.p3dwrap') && !el.dataset.p3d) return; out.push({ type: 'fig', svg: el, title: lastH || art.dataset.title }); }
  });
  return out;
}
const headSym = h => APA_SYM[h] ? { text: APA_SYM[h], it: true } : { text: h, it: false };
const numLike = s => /^[−-]?\d*\.?\d+(e[−-]?\d+)?$/i.test(String(s).replace(/,/g, ''));
const toNumber = s => Number(String(s).replace(/−/g, '-').replace(/,/g, ''));

// ---- APA 形式の HTML（Word にそのまま貼れるインライン書式） ----
function svgString(svg, widthPx) {
  const vb = svg.viewBox.baseVal; let s = new XMLSerializer().serializeToString(svg).replace(/var\((--[\w-]+)\)/g, (m, v) => LIGHT[v] || '#000');
  if (!/xmlns=/.test(s.slice(0, 300))) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return s.replace(/^<svg([^>]*)>/, (m, at) => `<svg${at.replace(/class="[^"]*"/, '').replace(/style="[^"]*"/, '')} width="${widthPx || vb.width}" height="${(widthPx || vb.width) * vb.height / vb.width}"><style>text{font-family:"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;font-size:11px;fill:#5b6b67}</style>`);
}
function apaHtml(blocksList, o = {}) {
  let tn = 0, fn = 0; const F = 'font-family:\'Times New Roman\',\'游明朝\',\'Yu Mincho\',serif;', cell = 'padding:2pt 6pt;' + F + 'font-size:10.5pt;';
  return blocksList.map(blocks => blocks.map(b => {
    if (b.type === 'title') return o.titles === false ? '' : `<p style="${F}font-size:12pt;font-weight:bold;margin:18pt 0 6pt">${esc(b.text)}</p>`;
    if (b.type === 'apa') return `<p style="${F}font-size:10.5pt;line-height:1.7;margin:6pt 0">${b.html}</p>`;
    if (b.type === 'fig') { fn++; return o.figures === false ? '' : `<p style="${F}font-size:10.5pt;font-weight:bold;margin:12pt 0 0">図 ${fn}</p><p style="${F}font-size:10.5pt;font-style:italic;margin:2pt 0 6pt">${esc(b.title)}</p><div>${o.figures === 'png' ? '' : svgString(b.svg, 520)}</div>`; }
    if (b.type !== 'table') return '';
    tn++; const th = b.head.map((h, j) => { const s = headSym(h); return `<th style="${cell}border-bottom:1px solid #000;text-align:${j ? 'center' : 'left'};font-weight:normal;${s.it ? 'font-style:italic;' : ''}">${esc(s.text)}</th>`; }).join('');
    const tr = b.rows.map((r, i) => `<tr>${r.map((c, j) => `<td style="${cell}text-align:${j ? 'center' : 'left'};${i === b.rows.length - 1 ? 'border-bottom:1px solid #000;' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('');
    const note = [b.note, b.stars ? STAR_NOTE : ''].filter(Boolean).join(' ');
    return `<p style="${F}font-size:10.5pt;font-weight:bold;margin:14pt 0 0">表 ${tn}</p><p style="${F}font-size:10.5pt;font-style:italic;margin:2pt 0 4pt">${esc(b.title)}</p><table style="border-collapse:collapse;border-top:1px solid #000;border-bottom:1px solid #000;margin:0 0 4pt">${b.head.length ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>${note ? `<p style="${F}font-size:9.5pt;margin:2pt 0 10pt"><i>注</i>．${esc(note).replace(/\bp &lt;/g, '<i>p</i> &lt;')}</p>` : ''}`;
  }).join('')).join('');
}
function apaHtmlDocument(blocksList, title) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{max-width:760px;margin:32px auto;padding:0 16px;color:#000;background:#fff}@media print{body{margin:0}}</style></head><body>${apaHtml(blocksList)}<p style="font-size:9pt;color:#666;margin-top:24pt">ブラウザ統計ラボで作成（APA 第 7 版の表の体裁：横罫線 3 本・縦罫線なし・表番号は太字・表題は斜体）</p></body></html>`;
}

// ---- Markdown ----
function toMarkdown(blocksList) {
  let tn = 0, fn = 0; const md = s => String(s).replace(/\|/g, '\\|');
  return blocksList.map(blocks => blocks.map(b => {
    if (b.type === 'title') return `## ${b.text}\n`;
    if (b.type === 'apa') return b.html.replace(/<i>(.*?)<\/i>/g, '*$1*').replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<sup>(.*?)<\/sup>/g, '^$1^').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') + '\n';
    if (b.type === 'fig') { fn++; return `**図 ${fn}**\n*${b.title}*\n\n（図は「図をコピー」で画像として貼り付けてください）\n`; }
    if (b.type !== 'table') return '';
    tn++; const w = Math.max(b.head.length, ...b.rows.map(r => r.length)), head = b.head.length ? b.head.map(h => { const s = headSym(h); return s.it ? `*${s.text}*` : s.text; }) : Array(w).fill('');
    return `**表 ${tn}**\n*${b.title}*\n\n| ${head.map(md).join(' | ')} |\n|${head.map((_, j) => j ? ':---:' : ':---').join('|')}|\n${b.rows.map(r => `| ${r.map(md).join(' | ')} |`).join('\n')}\n` + ([b.note, b.stars ? STAR_NOTE : ''].filter(Boolean).length ? `\n*注*．${[b.note, b.stars ? STAR_NOTE : ''].filter(Boolean).join(' ')}\n` : '');
  }).join('\n')).join('\n---\n\n');
}

// ---- ZIP（無圧縮）：docx と xlsx の入れ物 ----
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files) { // files: [{ name, data: string | Uint8Array }]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  });
  const csz = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
}
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

// ---- Word（.docx） ----
async function buildDocx(blocksList, docTitle) {
  const R = (t, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.va ? `<w:vertAlign w:val="${o.va}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
  const P = (runs, o = {}) => `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 80}" w:line="${o.line || 300}" w:lineRule="auto"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${runs}</w:p>`;
  const htmlRuns = html => { const d = document.createElement('div'); d.innerHTML = html; let s = ''; const walk = (n, st) => { n.childNodes.forEach(c => { if (c.nodeType === 3) { if (c.textContent) s += R(c.textContent, st); } else { const t = c.tagName; walk(c, { ...st, i: st.i || t === 'I' || t === 'EM', b: st.b || t === 'B' || t === 'STRONG', va: t === 'SUB' ? 'subscript' : t === 'SUP' ? 'superscript' : st.va }); } }); }; walk(d, {}); return s; };
  const BD = (side, sz = 8) => `<w:${side} w:val="single" w:sz="${sz}" w:space="0" w:color="000000"/>`;
  let body = P(R(docTitle, { b: true, sz: 28 }), { after: 240, jc: 'center' }), tn = 0, fn = 0, img = 0; const media = [], rels = [];
  for (const blocks of blocksList) for (const b of blocks) {
    if (b.type === 'title') { if (blocksList.length > 1) body += P(R(b.text, { b: true, sz: 24 }), { before: 360, after: 120, keep: true }); continue; }
    if (b.type === 'apa') { body += P(R('論文記載例：', { b: true, sz: 20 }) + htmlRuns(b.html), { before: 120, after: 160, line: 360 }); continue; }
    if (b.type === 'table') {
      tn++; body += P(R(`表 ${tn}`, { b: true }), { before: 240, after: 0, keep: true }) + P(R(b.title, { i: true }), { after: 80, keep: true });
      const w = Math.max(b.head.length, ...b.rows.map(r => r.length)), cw = t => [...String(t)].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 1 : .56), 0);
      let widths = Array.from({ length: w }, (_, j) => Math.max(640, Math.round(Math.max(cw(headSym(b.head[j] || '').text), ...b.rows.map(r => cw(r[j] ?? ''))) * 200 + 200)));
      const tot = widths.reduce((a, v) => a + v, 0); if (tot > 9070) widths = widths.map(v => Math.max(560, Math.floor(v * 9070 / tot)));
      const cellXml = (txt, j, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${widths[j]}" w:type="dxa"/>${o.bottom ? `<w:tcBorders>${BD('bottom', 6)}</w:tcBorders>` : ''}</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/><w:jc w:val="${j ? 'center' : 'left'}"/></w:pPr>${R(txt, { i: o.i, sz: 20 })}</w:p></w:tc>`;
      let rows = '';
      if (b.head.length) rows += `<w:tr><w:trPr><w:tblHeader/></w:trPr>${Array.from({ length: w }, (_, j) => { const s = headSym(b.head[j] || ''); return cellXml(s.text, j, { bottom: true, i: s.it }); }).join('')}</w:tr>`;
      b.rows.forEach(r => rows += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${Array.from({ length: w }, (_, j) => cellXml(r[j] ?? '', j)).join('')}</w:tr>`);
      body += `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${BD('top')}${BD('bottom')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(v => `<w:gridCol w:w="${v}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
      const note = [b.note, b.stars ? STAR_NOTE : ''].filter(Boolean).join(' ');
      body += note ? P(R('注', { i: true, sz: 19 }) + R('．', { sz: 19 }) + note.split(/(\bp\b)/).map(t => t === 'p' ? R('p', { i: true, sz: 19 }) : R(t, { sz: 19 })).join(''), { before: 60, after: 200 }) : P('', { after: 160 });
      continue;
    }
    if (b.type === 'fig') {
      fn++; let png; try { png = new Uint8Array(await (await svgToPng(b.svg)).arrayBuffer()); } catch (e) { continue; }
      img++; const rid = `rIdImg${img}`, vb = b.svg.viewBox.baseVal, wEmu = Math.round(Math.min(15.5, vb.width / 38) * 360000), hEmu = Math.round(wEmu * vb.height / vb.width);
      media.push({ name: `word/media/image${img}.png`, data: png }); rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${img}.png"/>`);
      body += P(R(`図 ${fn}`, { b: true }), { before: 240, after: 0, keep: true }) + P(R(b.title, { i: true }), { after: 80, keep: true });
      body += `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${img}" name="図${fn}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${img}" name="図${fn}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1418" w:bottom="1701" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="游明朝" w:cs="Times New Roman"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  return zipStore([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>` },
    { name: 'word/document.xml', data: doc }, { name: 'word/styles.xml', data: styles }, ...media]);
}

// ---- Excel（.xlsx） ----
function buildXlsx(blocksList) {
  const rows = []; let tn = 0; const push = (cells, st) => rows.push({ cells, st });
  blocksList.forEach(blocks => blocks.forEach(b => {
    if (b.type === 'title') { push([b.text], 1); push([]); }
    if (b.type === 'apa') { push(['論文記載例', b.html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')], 0); push([]); }
    if (b.type !== 'table') return; tn++;
    push([`表 ${tn}`], 1); push([b.title], 3); if (b.head.length) push(b.head.map(h => headSym(h).text), 2);
    b.rows.forEach((r, i) => push(r, i === b.rows.length - 1 ? 4 : 0));
    const note = [b.note, b.stars ? STAR_NOTE : ''].filter(Boolean).join(' '); if (note) push(['注．' + note], 5); push([]);
  }));
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const maxC = Math.max(1, ...rows.map(r => r.cells.length));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="30" customWidth="1"/>${maxC > 1 ? `<col min="2" max="${maxC}" width="14" customWidth="1"/>` : ''}</cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.cells.map((c, j) => { const ref = col(j) + (i + 1), s = r.st === 2 || r.st === 4 ? r.st : (j === 0 ? r.st : (r.st === 4 ? 4 : 0)); return numLike(c) && j > 0 ? `<c r="${ref}" s="${r.st === 4 ? 6 : 0}"><v>${toNumber(c)}</v></c>` : `<c r="${ref}" t="inlineStr" s="${s}"><is><t xml:space="preserve">${xe(c)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="游ゴシック"/></font><font><b/><sz val="11"/><name val="游ゴシック"/></font><font><i/><sz val="11"/><name val="游ゴシック"/></font><font><sz val="9"/><name val="游ゴシック"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"/><bottom style="thin"/><diagonal/></border><border><left/><right/><top/><bottom style="thin"/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="結果" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }, { name: 'xl/styles.xml', data: styles }]);
}

// ---- コピー（クリップボードが使えないときは、選択して ⌘C でコピーできる画面を出す） ----
async function copyRich(html, text) {
  try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return 'ok'; } } catch (e) { }
  const box = document.createElement('div'); box.innerHTML = html; box.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;color:#000'; document.body.appendChild(box);
  const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } sel.removeAllRanges(); box.remove();
  if (ok) return 'ok';
  let ov = document.getElementById('copyBox'); if (!ov) { ov = document.createElement('div'); ov.id = 'copyBox'; ov.className = 'copybox'; document.body.appendChild(ov); ov.addEventListener('click', e => { if (e.target.dataset.cbclose != null || e.target === ov) ov.hidden = true; }); }
  ov.innerHTML = `<div class="copyinner"><div class="copybar"><b>このブラウザでは自動でコピーできません。</b><span>下の内容が選択されています。<b>⌘C</b>（Windows は <b>Ctrl+C</b>）でコピーして、Word に貼り付けてください。</span><button class="btn" data-cbclose>閉じる</button></div><div class="copycontent" tabindex="0">${html}</div></div>`;
  ov.hidden = false; const c = ov.querySelector('.copycontent'), r2 = document.createRange(); r2.selectNodeContents(c); sel.removeAllRanges(); sel.addRange(r2); c.focus();
  return 'manual';
}
// ---- 保存（claude.ai の中では確認つきの保存、ファイルとして開いたときは通常のダウンロード） ----
async function saveFile(filename, data) {
  const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
  if (dl) { await dl.save({ filename, data }); return 'saved'; }
  const a = document.createElement('a'), blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' }); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return 'saved';
}
const safeName = s => (s || '結果').replace(/[\\/:*?"<>|（）()、・ →×]+/g, '_').replace(/_+/g, '_').slice(0, 50);
async function doExport(kind, arts, btn) {
  const blocks = arts.map(extractBlocks), title = arts.length === 1 ? arts[0].dataset.title : `分析結果（${arts.length} 件）`, base = safeName(arts.length === 1 ? title : '分析結果まとめ');
  const say = t => { if (btn) { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = t; setTimeout(() => btn.textContent = o, 3200); } };
  try {
    if (kind === 'apacopy') { const r = await copyRich(apaHtml(blocks, { figures: false, titles: arts.length > 1 }), toMarkdown(blocks)); say(r === 'ok' ? 'コピーしました。Word に貼り付けてください' : '表示された内容を ⌘C でコピーしてください'); return; }
    if (kind === 'md') { const t = toMarkdown(blocks), r = await copyRich(`<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px">${esc(t)}</pre>`, t); say(r === 'ok' ? 'Markdown をコピーしました' : '表示された内容を ⌘C でコピーしてください'); return; }
    if (kind === 'mdfile') { await saveFile(base + '.md', toMarkdown(blocks)); say('保存しました'); return; }
    if (kind === 'html') { await saveFile(base + '.html', apaHtmlDocument(blocks, title)); say('保存しました'); return; }
    if (kind === 'xlsx') { await saveFile(base + '.xlsx', buildXlsx(blocks)); say('保存しました'); return; }
    if (kind === 'docx') { say('作成中…'); await saveFile(base + '.docx', await buildDocx(blocks, title)); say('保存しました'); return; }
  } catch (err) { say(err && err.code === 'declined' ? '保存をやめました' : err && err.code === 'rate_limited' ? '少し待ってからもう一度' : '失敗しました：' + (err && (err.message || err.code) || '')); }
}
const EXPORT_MENU = `<div class="expmenu" hidden><p class="hint" style="margin:0 0 6px">APA 第 7 版の体裁（横罫線 3 本・縦罫線なし・表番号は太字・表題は斜体）で出力します。</p>
  <button class="btn primary" data-exp="apacopy">APA 形式でコピー（Word に貼り付け）<small>おすすめ</small></button>
  <button class="btn" data-exp="docx">Word ファイル（.docx）<small>表・図・論文記載例</small></button>
  <button class="btn" data-exp="xlsx">Excel ファイル（.xlsx）<small>数値を加工したいとき</small></button>
  <button class="btn" data-exp="html">HTML ファイル<small>印刷・PDF・Google ドキュメントへ</small></button>
  <button class="btn" data-exp="md">Markdown でコピー<small>Quarto・R Markdown・Notion 用</small></button></div>`;
document.addEventListener('click', e => {
  const t = e.target.closest('[data-expshow]'); if (t) { const m = (t.closest('article.res') || t.closest('.box')).querySelector('.expmenu'); if (m) m.hidden = !m.hidden; return; }
  const b = e.target.closest('[data-exp]'); if (!b) return; const art = b.closest('article.res');
  doExport(b.dataset.exp, art ? [art] : [...document.querySelectorAll('article.res')].reverse(), b);
});
