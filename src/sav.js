// ===== SPSS データファイル（.sav / .zsav）の読み込み（PSPP の仕様書に基づく） =====
async function readSav(buf) {
  const u8 = new Uint8Array(buf), magic = String.fromCharCode(...u8.slice(0, 4));
  if (magic !== '$FL2' && magic !== '$FL3') throw new Error('SPSS のデータファイル（.sav）ではないようです。');
  let dv = new DataView(buf), le = true;
  { const lc = dv.getInt32(64, true); if (lc !== 2 && lc !== 3) le = false; }
  let pos = 0;
  const i32 = () => { const v = dv.getInt32(pos, le); pos += 4; return v; }, f64 = () => { const v = dv.getFloat64(pos, le); pos += 8; return v; };
  const bytes = n => { const b = u8.slice(pos, pos + n); pos += n; return b; };
  pos = 64; i32(); const caseSize = i32(), compression = i32(); i32(); const nCases = i32(), bias = f64();
  pos = 176;
  const vars = [], slots = [], vlRecs = [], info = {}; let dec = null;
  const SYSMIS = -Number.MAX_VALUE;
  while (true) {
    const rt = i32();
    if (rt === 2) {
      const type = i32(), hasLab = i32(), nMiss = i32(), print = i32(); i32(); const name = bytes(8);
      let label = null; if (hasLab) { const L = i32(); label = bytes(L); pos += (4 - L % 4) % 4; }
      const miss = []; for (let k = 0; k < Math.abs(nMiss); k++) miss.push(type === 0 ? f64() : bytes(8));
      if (type === -1) { slots.push(null); continue; }
      const v = { type, name, label, nMiss, miss, fmt: print >>> 16 & 255, dec: print & 255, slot: slots.length, nslots: type > 0 ? Math.ceil(type / 8) : 1 };
      vars.push(v); slots.push(v);
    } else if (rt === 3) {
      const n = i32(), labs = [];
      for (let k = 0; k < n; k++) { const val = bytes(8), L = u8[pos]; pos += 1; const lab = bytes(L); pos += (8 - (L + 1) % 8) % 8; labs.push([val, lab]); }
      if (i32() !== 4) throw new Error('値ラベルの読み込みに失敗しました。'); const m = i32(), idx = []; for (let k = 0; k < m; k++) idx.push(i32());
      vlRecs.push({ labs, idx });
    } else if (rt === 6) { const n = i32(); pos += n * 80; }
    else if (rt === 7) { const sub = i32(), size = i32(), count = i32(); info[sub] = { start: pos, size, count, data: u8.slice(pos, pos + size * count) }; pos += size * count; }
    else if (rt === 999) { i32(); break; }
    else throw new Error(`読めない記録（種類 ${rt}）があります。ファイルが壊れていないか確認してください。`);
  }
  // 文字コード
  const enc = (() => {
    if (info[20]) { const s = String.fromCharCode(...info[20].data).trim().toLowerCase(); if (/utf-?8/.test(s)) return 'utf-8'; if (/(shift|sjis|31j|932)/.test(s)) return 'shift_jis'; if (/euc-?jp/.test(s)) return 'euc-jp'; try { new TextDecoder(s); return s; } catch (e) { } }
    if (info[3] && info[3].count >= 8) { const d = new DataView(info[3].data.buffer), cc = d.getInt32(28, le); if (cc === 65001) return 'utf-8'; if (cc === 932) return 'shift_jis'; if (cc === 20932 || cc === 51932) return 'euc-jp'; }
    return 'windows-1252';
  })();
  const td = new TextDecoder(enc), txt = b => td.decode(b).replace(/[\s\u0000]+$/, '');
  dec = txt;
  vars.forEach(v => { v.short = txt(v.name); v.longName = v.short; v.lab = v.label ? txt(v.label) : ''; });
  // 長い変数名（13）
  if (info[13]) txt(info[13].data).split('\t').forEach(p => { const k = p.indexOf('='); if (k < 0) return; const s = p.slice(0, k).trim(), l = p.slice(k + 1); const v = vars.find(x => x.short.toUpperCase() === s.toUpperCase()); if (v) v.longName = l; });
  // とても長い文字列（14）：分割された変数をまとめる
  const vls = {}; if (info[14]) txt(info[14].data).split(/[\t\u0000]+/).forEach(p => { const k = p.indexOf('='); if (k > 0) vls[p.slice(0, k).trim().toUpperCase()] = parseInt(p.slice(k + 1)); });
  const out = [];
  for (let k = 0; k < vars.length; k++) {
    const v = vars[k], W = vls[v.short.toUpperCase()];
    if (W > 255) { const nseg = Math.ceil(W / 252); v.segs = vars.slice(k, k + nseg); v.width = W; k += nseg - 1; }
    out.push(v);
  }
  // 尺度（11）
  if (info[11]) { const d = new DataView(info[11].data.buffer); const per = info[11].count / vars.length; if (per === 3) vars.forEach((v, k) => { v.measure = d.getInt32(k * 12, le); }); }
  // 値ラベル
  vlRecs.forEach(r => r.idx.forEach(i => { const v = slots[i - 1]; if (!v) return; v.vl = v.vl || []; r.labs.forEach(([val, lab]) => v.vl.push([v.type === 0 ? new DataView(val.buffer).getFloat64(0, le) : txt(val), txt(lab)])); }));
  // データ部
  let data;
  if (compression === 2) {
    const zh = pos, zdv = new DataView(buf, zh), get64 = o => Number(le ? zdv.getBigInt64(o, true) : zdv.getBigInt64(o, false));
    const ztOfs = get64(8), tdv = new DataView(buf, ztOfs), nb = tdv.getInt32(20, le), parts = [];
    for (let b = 0; b < nb; b++) {
      const o = 24 + b * 24, cofs = Number(le ? tdv.getBigInt64(o + 8, true) : tdv.getBigInt64(o + 8, false)), csz = tdv.getInt32(o + 20, le);
      const ds = new Blob([u8.slice(cofs, cofs + csz)]).stream().pipeThrough(new DecompressionStream('deflate'));
      parts.push(new Uint8Array(await new Response(ds).arrayBuffer()));
    }
    const tot = parts.reduce((s, p) => s + p.length, 0); data = new Uint8Array(tot); let o = 0; parts.forEach(p => { data.set(p, o); o += p.length; });
  } else data = u8.slice(pos);
  const ddv = new DataView(data.buffer); let dp = 0;
  const rows = [], N = nCases >= 0 ? nCases : Infinity;
  // 8 バイト単位の値を順に取り出す
  let cmd = [], ci = 8, eof = false;
  const nextBlock = () => {
    if (compression === 0) { if (dp + 8 > data.length) { eof = true; return null; } const b = data.subarray(dp, dp + 8); dp += 8; return { raw: b }; }
    while (true) {
      if (ci >= 8) { if (dp + 8 > data.length) { eof = true; return null; } cmd = data.subarray(dp, dp + 8); dp += 8; ci = 0; }
      const c = cmd[ci++];
      if (c === 0) continue;
      if (c === 252) { eof = true; return null; }
      if (c === 253) { const b = data.subarray(dp, dp + 8); dp += 8; return { raw: b }; }
      if (c === 254) return { spaces: true };
      if (c === 255) return { sysmis: true };
      return { num: c - bias };
    }
  };
  const asNum = b => b.sysmis ? NaN : b.num != null ? b.num : b.spaces ? NaN : (v => v === SYSMIS ? NaN : v)(new DataView(b.raw.buffer, b.raw.byteOffset, 8).getFloat64(0, le));
  const asBytes = b => b.spaces ? new Uint8Array(8).fill(32) : b.raw ? b.raw : new Uint8Array(8).fill(32);
  const SP_EPOCH = Date.UTC(1582, 9, 14) / 1000, DATEF = new Set([20, 22, 23, 24, 28, 29, 30, 38, 39]);
  while (rows.length < N) {
    const vals = new Array(slots.length); let ok = true;
    for (let s = 0; s < caseSize; s++) { const b = nextBlock(); if (!b) { ok = false; break; } vals[s] = b; }
    if (!ok) break;
    rows.push(out.map(v => {
      if (v.type === 0) { const x = asNum(vals[v.slot]); if (!isFinite(x)) return ''; if (DATEF.has(v.fmt)) { const d = new Date((x + SP_EPOCH) * 1000); return d.toISOString().slice(0, 10); } return String(+x.toPrecision(15)); }
      const segs = v.segs || [v], chunks = [];
      segs.forEach((sv, q) => { const bs = []; for (let s = 0; s < sv.nslots; s++) bs.push(asBytes(vals[sv.slot + s])); const all = new Uint8Array(bs.length * 8); bs.forEach((b, i) => all.set(b, i * 8)); chunks.push(all.subarray(0, v.segs && q < segs.length - 1 ? 255 : Math.min(all.length, sv.type))); });
      const all = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0)); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
      return txt(all).trim();
    }));
  }
  // 変数の定義（名前・ラベル・値ラベル・尺度・欠損値）
  const fmtNum = x => String(+x.toPrecision(15)), LOHI = x => x <= -1e300 ? 'LO' : x >= 1e300 ? 'HI' : fmtNum(x);
  const cols = out.map(v => {
    let missing = '';
    if (v.type === 0 && v.nMiss) { const m = v.miss; missing = v.nMiss > 0 ? m.map(fmtNum).join(', ') : [`${LOHI(m[0])}~${LOHI(m[1])}`, ...(v.nMiss === -3 ? [fmtNum(m[2])] : [])].join(', '); }
    else if (v.type > 0 && v.nMiss > 0) missing = v.miss.map(b => txt(b).trim()).join(', ');
    return { name: v.longName, on: true, label: v.lab, measure: { 1: 'nominal', 2: 'ordinal', 3: 'scale' }[v.measure] || '', values: (v.vl || []).map(([k, l]) => [typeof k === 'number' ? fmtNum(k) : String(k).trim(), l]), missing };
  });
  return { cols, rows, encoding: enc, nCases: rows.length, compression: ['なし', 'バイト圧縮', 'zlib 圧縮（.zsav）'][compression] || '?' };
}
if (typeof module !== 'undefined') module.exports = { readSav };
