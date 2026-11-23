// ===== 系列媒介分析（PROCESS モデル 6 に相当） =====
function fastCoef(yv, colsv, idx) { // 正規方程式で係数だけを求める（ブートストラップ用）
  const q = colsv.length + 1, A = Array.from({ length: q }, () => new Array(q).fill(0)), v = new Array(q).fill(0), row = new Array(q);
  for (const i of idx) { row[0] = 1; for (let c = 0; c < colsv.length; c++) row[c + 1] = colsv[c][i]; for (let a = 0; a < q; a++) { v[a] += row[a] * yv[i]; for (let b = a; b < q; b++) A[a][b] += row[a] * row[b]; } }
  for (let a = 0; a < q; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];
  const M = A.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < q; c++) { let p = c; for (let r = c + 1; r < q; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < q; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= q; j++) M[r][j] -= f * M[c][j]; } }
  return M.map((r, i) => r[q] / r[i]);
}
function serialDiagram(o) { // o: { xn, yn, mn: [], a: [], d: [[...]], b: [], cp, p: { a: [], d: [[]], b: [], cp } }
  const k = o.mn.length, W = 680, H = k === 3 ? 360 : 300, bw = 124, bh = 38, X = { x: 80, y: H - 50 }, Y = { x: W - 80, y: H - 50 };
  const Ms = o.mn.map((_, i) => k === 2 ? { x: [230, 450][i], y: 95 } : [{ x: 160, y: 160 }, { x: 340, y: 40 }, { x: 520, y: 160 }][i]);
  const col = p => p < .05 ? 'var(--accent)' : 'var(--muted)', lab = (v, p) => `${c2(v)}${p < .05 ? star(p) : ''}`;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" style="max-width:680px"><defs><marker id="sra" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--fg)"/></marker></defs>`;
  const edge = (p1, p2, txt, p, off = 0) => { const dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, tx = (u, v) => Math.min(Math.abs(u) > 1e-9 ? bw / 2 / Math.abs(u) : 1e9, Math.abs(v) > 1e-9 ? bh / 2 / Math.abs(v) : 1e9), t1 = tx(ux, uy), x1 = p1.x + ux * t1, y1 = p1.y + uy * t1, x2 = p2.x - ux * t1, y2 = p2.y - uy * t1, mx = (x1 + x2) / 2 - uy * off, my = (y1 + y2) / 2 + ux * off;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col(p)}" stroke-width="1.7" ${p >= .05 ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#sra)"/><rect x="${(mx - tw(txt) / 2 - 3).toFixed(1)}" y="${(my - 12).toFixed(1)}" width="${(tw(txt) + 6).toFixed(1)}" height="16" rx="3" fill="var(--sheet)" fill-opacity=".92"/><text x="${mx.toFixed(1)}" y="${(my + 1).toFixed(1)}" text-anchor="middle" style="fill:var(--fg);font-size:11px">${txt}</text>`; };
  o.mn.forEach((_, i) => { s += edge(X, Ms[i], `a${i + 1} = ${lab(o.a[i], o.p.a[i])}`, o.p.a[i], i === 1 && k === 3 ? 12 : 0); s += edge(Ms[i], Y, `b${i + 1} = ${lab(o.b[i], o.p.b[i])}`, o.p.b[i], i === 1 && k === 3 ? -12 : 0); });
  for (let j = 1; j < k; j++) for (let i = 0; i < j; i++) s += edge(Ms[i], Ms[j], `d${j + 1}${i + 1} = ${lab(o.d[j][i], o.p.d[j][i])}`, o.p.d[j][i], j - i === 2 ? 14 : 0);
  s += edge(X, Y, `c′ = ${lab(o.cp, o.p.cp)}`, o.p.cp);
  const box = (p, t, f) => `<rect x="${p.x - bw / 2}" y="${p.y - bh / 2}" width="${bw}" height="${bh}" rx="4" fill="${f || 'var(--sheet)'}" stroke="var(--fg)" stroke-width="1.4"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" style="fill:var(--fg);font-size:12.5px">${esc(t.length > 9 ? t.slice(0, 9) + '…' : t)}</text>`;
  s += box(X, o.xn) + box(Y, o.yn) + o.mn.map((m, i) => box(Ms[i], `M${i + 1}：${m}`, 'var(--accent-soft)')).join('');
  s += `<text x="10" y="${H - 6}" style="font-size:10.5px">係数は非標準化。実線＝有意（p < .05）、点線＝有意でない。d は媒介変数どうしのパス（前の M → 後の M）。</text>`;
  return s + '</svg>';
}

ANALYSES.db.serial = function () {
  const R = state.db.roles, yj = needRole('y', '目的変数（Y）'); need(R.mx >= 0, '独立変数（X）を選んでください。');
  const ms = (R.mm || []).filter(j => j !== yj && j !== R.mx); need(ms.length >= 2, '系列媒介分析には、媒介変数 M を 2 つか 3 つ、影響が伝わる順番にチェックしてください。'); need(ms.length <= 3, '媒介変数は 3 つまでにしてください。');
  need(ms.every(j => colType(j) === 'num') && colType(yj) === 'num', '媒介変数と目的変数は数値の列を選んでください。');
  const Xv = mmVar(R.mx), Yv = dbCol(yj).map(toNum), Mv = ms.map(j => dbCol(j).map(toNum)), C = covCols((R.mcov || []).filter(j => ![yj, R.mx, ...ms].includes(j)));
  const ok = Yv.map((y, i) => isFinite(y) && isFinite(Xv.vals[i]) && Mv.every(m => isFinite(m[i])) && C.every(c => isFinite(c.vals[i])));
  const f = a => a.filter((_, i) => ok[i]), y = f(Yv), x = f(Xv.vals), M = Mv.map(f), Cs = C.map(c => f(c.vals)), n = y.length, k = ms.length; need(n >= 10 + k + Cs.length, '人数が少なすぎます。');
  // 係数：M_j ~ X + M_1..M_{j-1} + 共変量、Y ~ X + M_1..M_k + 共変量
  const fitM = M.map((m, j) => olsV(m, [x, ...M.slice(0, j), ...Cs])), FY = olsV(y, [x, ...M, ...Cs]), FT = olsV(y, [x, ...Cs]);
  const coefs = (mB, yB) => ({ a: mB.map(b => b[1]), d: mB.map((b, j) => Array.from({ length: j }, (_, i) => b[2 + i])), b: Array.from({ length: k }, (_, j) => yB[2 + j]), cp: yB[1] });
  // 経路：媒介変数の順序つき部分集合
  const paths = []; for (let mask = 1; mask < (1 << k); mask++) { const S2 = []; for (let j = 0; j < k; j++) if (mask & (1 << j)) S2.push(j); paths.push(S2); }
  paths.sort((p, q) => p.length - q.length || p[0] - q[0]);
  const effOf = c => paths.map(P => { let v = c.a[P[0]]; for (let t = 1; t < P.length; t++) v *= c.d[P[t]][P[t - 1]]; return v * c.b[P[P.length - 1]]; });
  const C0 = coefs(fitM.map(F => F.b), FY.b), E0 = effOf(C0), tot0 = S.sum(E0), sx = S.sd(x), sy = S.sd(y);
  const B = +state.opt.medBoot || 5000, Rg = rng(20261120), boot = [];
  for (let r = 0; r < B; r++) {
    const idx = new Array(n); for (let i = 0; i < n; i++) idx[i] = Math.floor(Rg() * n);
    const mB = []; let bad = false; for (let j = 0; j < k; j++) { const b = fastCoef(M[j], [x, ...M.slice(0, j), ...Cs], idx); if (!b) { bad = true; break; } mB.push(b); }
    const yB = !bad && fastCoef(y, [x, ...M, ...Cs], idx); if (!yB) continue;
    let mx = 0, my = 0; for (const i of idx) { mx += x[i]; my += y[i]; } mx /= n; my /= n; let vx = 0, vy = 0; for (const i of idx) { vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; }
    const E = effOf(coefs(mB, yB)); boot.push({ E, tot: S.sum(E), sc: Math.sqrt(vx / vy) });
  }
  const ex0 = c => c[0] > 0 || c[1] < 0, mn = ms.map(j => vn(j)), xn = Xv.name, yn = vn(yj);
  const pathName = P => [xn, ...P.map(j => mn[j]), yn].map(esc).join(' → '), pathLab = P => P.length === 1 ? `a${P[0] + 1}×b${P[0] + 1}` : `a${P[0] + 1}×${P.slice(1).map((j, t) => `d${j + 1}${P[t] + 1}`).join('×')}×b${P[P.length - 1] + 1}`;
  const ciE = paths.map((_, q) => S.sem.bootCI(boot.map(b => b.E[q]), E0[q])), ciT = S.sem.bootCI(boot.map(b => b.tot), tot0), ciS = paths.map((_, q) => S.sem.bootCI(boot.map(b => b.E[q] * b.sc), E0[q] * sx / sy));
  let h = guideBox('系列媒介分析とは（はじめて使う人へ）', [
    ['何がわかるか：', `${esc(xn)}の影響が、<b>${mn.map(esc).join(' → ')} の順に連鎖して</b>${esc(yn)}に伝わるかを調べます。例：ストレス → 自尊感情が下がる → くよくよ考える（反すう）が増える → 抑うつが高まる。`],
    ['並列媒介との違い：', '並列媒介（媒介分析で M を複数選んだ場合）は、M どうしが影響し合わないと考えます。系列媒介は、<b>前の M が後の M に影響する</b>（M1 → M2 の矢印 d がある）と考えます。'],
    ['見る結果：', `媒介変数が ${k} つなら、間接効果の経路は ${paths.length} 通りあります。とくに大切なのは、すべての M を順に通る経路（${pathLab(paths[paths.length - 1])}）です。それぞれの経路のブートストラップ 95%信頼区間が <b>0 を含まなければ</b>、その経路の媒介効果は有意です。`],
    ['注意：', '媒介変数の<b>順序</b>は理論で決めます（チェックした順が順序です。逆順も試せますが、結果を見て順序を選ぶのは避けましょう）。順序の妥当性は、本来は時間をおいて測る縦断データで確かめるのが理想です。']]);
  h += `<p class="note">X = ${esc(xn)}、${mn.map((m, j) => `M${j + 1} = ${esc(m)}`).join('、')}、Y = ${esc(yn)}${C.length ? `、共変量 = ${C.map(cv => esc(cv.name)).join('、')}` : ''}、n = ${n}${ok.filter(v => !v).length ? `（欠測のある ${ok.filter(v => !v).length} 行を除外）` : ''}。ブートストラップ ${boot.length} 回。</p>`;
  h += '<h4>パス図</h4>' + serialDiagram({ xn, yn, mn, a: C0.a, d: C0.d, b: C0.b, cp: C0.cp, p: { a: fitM.map(F => F.p[1]), d: fitM.map((F, j) => Array.from({ length: j }, (_, i) => F.p[2 + i])), b: Array.from({ length: k }, (_, j) => FY.p[2 + j]), cp: FY.p[1] } });
  const rows = (F, ynm, nms) => nms.map((nm1, i) => [i === 0 ? `<b>${esc(ynm)}</b>（R² = ${fmt(F.r2, 3)}）` : '', esc(nm1), fmt(F.b[i + 1], 3), fmt(F.se[i + 1], 3), fmt(F.t[i + 1], 2), pcell(F.p[i + 1])]);
  h += '<h4>回帰分析の結果（各パス）</h4>' + table(['目的変数', '説明変数', 'B', 'SE', 't', 'p 値'], [
    ...fitM.flatMap((F, j) => rows(F, `M${j + 1}：${mn[j]}`, [`${xn}（a${j + 1}）`, ...mn.slice(0, j).map((m, i) => `${m}（d${j + 1}${i + 1}）`), ...C.map(cv => cv.name)])),
    ...rows(FY, yn, [`${xn}（c′）`, ...mn.map((m, j) => `${m}（b${j + 1}）`), ...C.map(cv => cv.name)]), ...rows(FT, yn + '（総合効果）', [`${xn}（c）`])]);
  const tcT = S.qt(.025, FT.df), tcY = S.qt(.025, FY.df);
  h += '<h4>総合効果・直接効果・間接効果</h4>' + table(['効果', '経路', '推定値', 'SE', '95%CI', '判定'], [
    ['総合効果 c', `${esc(xn)} → ${esc(yn)}（全体）`, fmt(FT.b[1], 3), fmt(FT.se[1], 3), `[${fmt(FT.b[1] - tcT * FT.se[1], 3)}, ${fmt(FT.b[1] + tcT * FT.se[1], 3)}]`, FT.p[1] < .05 ? '有意' : '有意でない'],
    ['直接効果 c′', `${esc(xn)} → ${esc(yn)}`, fmt(FY.b[1], 3), fmt(FY.se[1], 3), `[${fmt(FY.b[1] - tcY * FY.se[1], 3)}, ${fmt(FY.b[1] + tcY * FY.se[1], 3)}]`, FY.p[1] < .05 ? '有意' : '有意でない'],
    ...paths.map((P, q) => [`間接効果 ${pathLab(P)}`, pathName(P), fmt(E0[q], 3), fmt(ciE[q].se, 3) + '（Boot）', `[${fmt(ciE[q].perc[0], 3)}, ${fmt(ciE[q].perc[1], 3)}]`, ex0(ciE[q].perc) ? '<b>有意</b>' : '有意でない']),
    ['間接効果の合計', 'すべての経路', fmt(tot0, 3), fmt(ciT.se, 3) + '（Boot）', `[${fmt(ciT.perc[0], 3)}, ${fmt(ciT.perc[1], 3)}]`, ex0(ciT.perc) ? '<b>有意</b>' : '有意でない']]);
  h += table(['間接効果', 'バイアス修正法 95%CI', '完全標準化（Boot 95%CI）'], paths.map((P, q) => [pathLab(P), `[${fmt(ciE[q].bc[0], 3)}, ${fmt(ciE[q].bc[1], 3)}]`, `${fmt(E0[q] * sx / sy, 3)} [${fmt(ciS[q].perc[0], 3)}, ${fmt(ciS[q].perc[1], 3)}]`]));
  h += `<p class="note">c（${fmt(FT.b[1], 4)}）＝ c′（${fmt(FY.b[1], 4)}）＋ 間接効果の合計（${fmt(tot0, 4)}）が成り立っています。</p>`;
  const cons = []; for (let p = 0; p < paths.length; p++) for (let q = p + 1; q < paths.length; q++) { const ci = S.sem.bootCI(boot.map(b => b.E[p] - b.E[q]), E0[p] - E0[q]); cons.push([`${pathLab(paths[p])} − ${pathLab(paths[q])}`, fmt(E0[p] - E0[q], 3), `[${fmt(ci.perc[0], 3)}, ${fmt(ci.perc[1], 3)}]`, ex0(ci.perc) ? '差あり' : '差があるとはいえない']); }
  h += `<details><summary class="note" style="cursor:pointer">間接効果どうしの比較（対比、${cons.length} 組）を表示</summary>${table(['対比', '差', 'Boot 95%CI', '判定'], cons)}<p class="note">信頼区間が 0 を含まなければ、2 つの経路の間接効果の大きさに差があります（PROCESS の contrast オプションと同じ考え方）。</p></details>`;
  const full = paths.length - 1, sig = paths.map((P, q) => q).filter(q => ex0(ciE[q].perc));
  h += interp(ex0(ciE[full].perc) ? `すべての媒介変数を順に通る経路（${pathName(paths[full])}）の間接効果は ${fmt(E0[full], 3)}（95%CI [${fmt(ciE[full].perc[0], 3)}, ${fmt(ciE[full].perc[1], 3)}]）で、<b>有意な系列媒介</b>が認められます。${esc(xn)}の影響が、${mn.map(esc).join(' から ')} へと順に伝わり、${esc(yn)}に至る道筋が支持されます。` : `すべての媒介変数を順に通る経路（${pathLab(paths[full])}）の間接効果は有意ではありません（95%CI [${fmt(ciE[full].perc[0], 3)}, ${fmt(ciE[full].perc[1], 3)}]）。媒介変数どうしをつなぐ連鎖の道筋は支持されません。`,
    sig.length ? `有意だった経路：${sig.map(q => `${pathLab(paths[q])}（${fmt(E0[q], 3)}）`).join('、')}。` : '有意な間接効果の経路はありませんでした。',
    FY.p[1] < .05 ? `直接効果 c′ も有意（${pTxt(FY.p[1])}）で、媒介変数を通らない影響も残っています。` : `直接効果 c′ は有意ではなく（${pTxt(FY.p[1])}）、${esc(xn)}の影響は主に媒介変数を通して伝わっています。`,
    '論文では、各経路の間接効果とブートストラップ信頼区間を表にまとめ、特に系列の経路（すべての M を通る経路）に注目して報告します。');
  h += apa('論文記載例', `${esc(xn)}が${mn.map(esc).join('、')}を順に介して${esc(yn)}に影響するという系列媒介モデルを検討するため、系列媒介分析（PROCESS Model 6 に相当、ブートストラップ ${boot.length} 回）を行った。${mn.map(esc).join('から')}を順に介した間接効果は${ex0(ciE[full].perc) ? '有意であった' : '有意ではなかった'}（<i>ab</i> = ${fmt(E0[full], 2)}, 95% CI [${fmt(ciE[full].perc[0], 2)}, ${fmt(ciE[full].perc[1], 2)}]）。${paths.slice(0, k).map((P, q) => `${esc(mn[P[0]])}のみを介した間接効果は ${fmt(E0[q], 2)}（95% CI [${fmt(ciE[q].perc[0], 2)}, ${fmt(ciE[q].perc[1], 2)}]）`).join('、')}であった。`);
  return { title: `系列媒介分析（${[xn, ...mn, yn].join(' → ')}）`, html: h };
};
