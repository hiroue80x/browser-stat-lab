// ===== 同じ解析を R で実行するスクリプトを作る =====
const RQ = n => '`' + String(n).replace(/`/g, "'") + '`';           // R の変数名（バッククォート）
const RS = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const csvCell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function rDataFrame(names, cols, obj = 'd') { // cols: 値（文字列）の配列の配列
  const n = Math.max(0, ...cols.map(c => c.length)), lines = [names.map(csvCell).join(',')];
  for (let i = 0; i < n; i++) lines.push(cols.map(c => csvCell(c[i] ?? '')).join(','));
  return `${obj} <- read.csv(text = r"---(\n${lines.join('\n')}\n)---", check.names = FALSE, na.strings = c("", "NA"), fileEncoding = "UTF-8")\n`;
}
function rHeader(title, pkgs) {
  const d = new Date(), ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `# ${title}\n# ブラウザ統計ラボが作成した R スクリプト（${ds}）。データはこのファイルに埋め込んであります。\n` + (pkgs.length ? `# 初めて使うパッケージは、先に次の 1 行を実行してください：\n# install.packages(c(${pkgs.map(RS).join(', ')}))\n` : '') + (pkgs.includes('psych') ? 'options(mc.cores = 1)   # psych の並列計算を止める（Mac の RStudio・R で fa.parallel などが「コアが結果を提供しませんでした」で止まるのを防ぐ）\n' : '') + '\n';
}
const P_ADJ = { holm: 'holm', bonferroni: 'bonferroni', hochberg: 'hochberg', bh: 'BH', none: 'none', sidak: 'holm' };
const EMM_ADJ = { tukey: 'tukey', scheffe: 'scheffe', holm: 'holm', bonferroni: 'bonferroni', sidak: 'sidak', hochberg: 'hochberg', bh: 'fdr', none: 'none', games: 'tukey', dunnett: 'dunnettx' };
function rMcOneWay(y, g, m = 'm', data = 'long', k = 3) {
  if (k < 3) return '# 2 群なので多重比較は必要ありません（分散分析の結果がそのまま 2 群の比較です）\n';
  const mc = state.opt.mc || 'tukey', ctlLast = state.opt.dunCtl === 'last';
  const lines = { tukey: `TukeyHSD(${m})`, games: `rstatix::games_howell_test(${data}, ${y} ~ ${g})`, scheffe: `emmeans::emmeans(${m}, pairwise ~ ${g}, adjust = "scheffe")`,
    dunnett: `${ctlLast ? `${data}$${g} <- relevel(${data}$${g}, ref = tail(levels(${data}$${g}), 1))  # 対照群を最後の水準に\n${m} <- update(${m}, data = ${data})\n` : ''}summary(multcomp::glht(${m}, linfct = multcomp::mcp(${g} = "Dunnett")))  # 対照群 = 最初の水準`,
    sidak: `emmeans::emmeans(${m}, pairwise ~ ${g}, adjust = "sidak")` }[mc] || `pairwise.t.test(${data}$${y}, ${data}$${g}, p.adjust.method = "${P_ADJ[mc]}")  # 誤差平均平方を使う t 検定`;
  return `# 多重比較（${MC[mc]}）\n${lines}\n`;
}
function rKw(y, g, data = 'long', kk = 3) {
  if (kk < 3) return '';
  const k = state.opt.kwmc || 'steeldwass';
  const L = { steeldwass: `PMCMRplus::dscfAllPairsTest(${y} ~ ${g}, data = ${data})  # Steel-Dwass（Dwass-Steel-Critchlow-Fligner）法`,
    steel: `# Steel 法（対照群との比較）：各群と対照群の Wilcoxon 順位和検定を多変量正規で調整\nPMCMRplus::manyOneUTest(${y} ~ ${g}, data = ${data}, p.adjust.method = "single-step")`,
    'dunn-holm': `FSA::dunnTest(${y} ~ ${g}, data = ${data}, method = "holm")`, 'dunn-bonferroni': `FSA::dunnTest(${y} ~ ${g}, data = ${data}, method = "bonferroni")`, 'dunn-bh': `FSA::dunnTest(${y} ~ ${g}, data = ${data}, method = "bh")`,
    'mw-holm': `pairwise.wilcox.test(${data}$${y}, ${data}$${g}, p.adjust.method = "holm", exact = FALSE)`, 'mw-bonferroni': `pairwise.wilcox.test(${data}$${y}, ${data}$${g}, p.adjust.method = "bonferroni", exact = FALSE)` }[k];
  return `# Kruskal-Wallis の多重比較（${KWMC[k]}）\n${L}\n`;
}
const R_DIAG = m => `\n# ---- 回帰の診断 ----\npar(mfrow = c(2, 2)); plot(${m}); par(mfrow = c(1, 1))  # 残差 対 予測値・Q-Q・Scale-Location・てこ比\nshapiro.test(rstandard(${m}))           # 残差の正規性\nlmtest::bptest(${m})                     # Breusch-Pagan 検定（等分散性）\ncar::durbinWatsonTest(${m})              # 残差の独立性\ninfl <- data.frame(stdres = rstandard(${m}), rstudent = rstudent(${m}), hat = hatvalues(${m}), cook = cooks.distance(${m}))\ninfl[infl$cook > 4 / nobs(${m}) | abs(infl$rstudent) > 3, ]  # 確認したいケース\n# 等分散でないときは頑健な標準誤差（HC3）で\nlmtest::coeftest(${m}, vcov = sandwich::vcovHC(${m}, type = "HC3"))\n`;
const DIAG_PKGS = ['lmtest', 'car', 'sandwich'];
const R_RM = () => 'long <- data.frame(id = factor(rep(seq_len(nrow(d)), ncol(d))), cond = factor(rep(names(d), each = nrow(d)), levels = names(d)), y = unlist(d))\na <- afex::aov_ez("id", "y", long, within = "cond")\nsummary(a)            # Mauchly の球面性検定と Greenhouse-Geisser・Huynh-Feldt の補正\nfriedman.test(as.matrix(d))\n' + `pairwise.t.test(long$y, long$cond, paired = TRUE, p.adjust.method = "${P_ADJ[state.opt.mc] || 'holm'}")  # 多重比較\n`;

// ---- 列を取り出す ----
const wideCols = () => { const c = selCols(); return { names: c.map(x => x.name), cols: c.map(x => state[state.fmt].rows.map(r => String(r[x.j] ?? '').trim())) }; };
function dbData(js) { const J = [...new Set(js.filter(j => j >= 0))]; return { J, src: rDataFrame(J.map(j => state.db.cols[j].name), J.map(j => dbCol(j))) }; }
function dbFactors(js) { return js.filter(j => j >= 0 && colType(j) === 'cat').map(j => `d$${RQ(state.db.cols[j].name)} <- factor(d$${RQ(state.db.cols[j].name)}, levels = c(${levelsOf(dbCol(j)).map(RS).join(', ')}))\n`).join(''); }
const dn = j => RQ(state.db.cols[j].name);

function faRelR(items) { // 下位尺度の α と ω（アプリで最後に実行した因子分析の項目の割り当てを使う）
  const L = typeof FA_LAST_REL !== 'undefined' ? FA_LAST_REL : null;
  if (!L || L.items.join() !== items.join()) return '\n# 下位尺度の信頼性：アプリで因子分析を実行してから R スクリプトを開くと、ここに α と ω の計算が入ります\n';
  const nmj = j => RS(state.db.cols[j].name);
  let s = `\n# ---- 下位尺度の信頼性（|負荷量| ≥ .40 の項目、負の負荷の項目は反転：${L.lo} ＋ ${L.hi} − 得点）----\n`;
  L.rel.forEach((r, q) => { if (r.its.length < 2) return; const v = `s${q + 1}`;
    s += `${v} <- d[, c(${r.its.map(nmj).join(', ')})]\n` + r.rev.map(j => `${v}[[${nmj(j)}]] <- ${L.lo + L.hi} - ${v}[[${nmj(j)}]]   # 逆転項目\n`).join('')
      + `psych::alpha(${v})$total$raw_alpha   # 第${q + 1}因子の α\n` + (r.its.length >= 3 ? `suppressMessages(suppressWarnings(psych::omega(${v}, nfactors = 1, plot = FALSE)))$omega.tot   # 第${q + 1}因子の ω\n` : '')
      + (r.rev.length ? `# 参考：psych::alpha(d[, c(${r.its.map(nmj).join(', ')})], check.keys = TRUE) でも逆転項目を自動で判断します\n` : ''); });
  return s;
}
const RCODE = {
  indep: {
    _pre() { const W = wideCols(); return rDataFrame(W.names, W.cols) + `long <- na.omit(stack(d)); names(long) <- c("y", "group")\nlong$group <- factor(long$group, levels = names(d))\n\n`; },
    desc() { return rHeader('基本統計量', ['psych']) + RCODE.indep._pre() + 'psych::describe(d)\n'; },
    two() { const W = wideCols(); let s = rHeader('2群間の差の検定', ['effectsize']) + rDataFrame(W.names, W.cols); S.pairs(W.names.length).forEach(([i, j]) => { const a = RQ(W.names[i]), b = RQ(W.names[j]); s += `\n# ---- ${W.names[i]} vs ${W.names[j]} ----\na <- na.omit(d$${a}); b <- na.omit(d$${b})\nshapiro.test(a); shapiro.test(b)       # 各群の正規性\nvar.test(a, b)                          # F 検定（分散の比）\nt.test(a, b, var.equal = TRUE)          # Student の t 検定\nt.test(a, b)                            # Welch の t 検定\nwilcox.test(a, b, exact = FALSE, correct = TRUE)  # Mann-Whitney の U 検定\neffectsize::cohens_d(a, b)              # 効果量 d\n`; }); return s; },
    multi() { return rHeader('一元配置分散分析と多重比較', ['car', 'rstatix', 'multcomp', 'emmeans', 'PMCMRplus', 'FSA', 'effectsize']) + RCODE.indep._pre() + 'm <- aov(y ~ group, data = long)\nsummary(m)\neffectsize::eta_squared(m)\noneway.test(y ~ group, data = long)                   # Welch の分散分析\ncar::leveneTest(y ~ group, data = long, center = median)  # Levene 検定（Brown-Forsythe）\nbartlett.test(y ~ group, data = long)\nkruskal.test(y ~ group, data = long)\nshapiro.test(residuals(m))                            # 残差の正規性\n\n' + rMcOneWay('y', 'group', 'm', 'long', selCols().length) + '\n' + rKw('y', 'group', 'long', selCols().length); },
    box() { return rHeader('箱ひげ図', []) + RCODE.indep._pre() + 'boxplot(y ~ group, data = long)\nstripchart(y ~ group, data = long, vertical = TRUE, method = "jitter", add = TRUE, pch = 16, col = "#17607a88")\n'; },
    hist() { return rHeader('度数分布図', []) + RCODE.indep._pre() + 'par(mfrow = c(1, ncol(d)))\nfor (v in names(d)) { x <- na.omit(d[[v]]); hist(x, freq = FALSE, main = v); curve(dnorm(x, mean(na.omit(d[[v]])), sd(na.omit(d[[v]]))), add = TRUE) }\n'; }
  },
  paired: {
    _pre() { const W = wideCols(); return rDataFrame(W.names, W.cols) + 'd <- na.omit(d)  # 空欄のある行を除く\n\n'; },
    desc() { return rHeader('基本統計量（対応あり）', ['psych']) + RCODE.paired._pre() + 'psych::describe(d)\n'; },
    ptwo() { const W = wideCols(); let s = rHeader('対応のある2群の検定', ['effectsize']) + RCODE.paired._pre(); S.pairs(W.names.length).forEach(([i, j]) => { const a = `d$${RQ(W.names[i])}`, b = `d$${RQ(W.names[j])}`; s += `# ---- ${W.names[i]} − ${W.names[j]} ----\nshapiro.test(${a} - ${b})                # 差の正規性\nt.test(${a}, ${b}, paired = TRUE)\nwilcox.test(${a}, ${b}, paired = TRUE, exact = FALSE, correct = TRUE)\nbinom.test(sum(${a} > ${b}), sum(${a} != ${b}))  # 符号検定\neffectsize::repeated_measures_d(${a}, ${b}, method = "z")  # d_z\n\n`; }); if (W.names.length > 2) s += `# 複数の組の p 値の調整（${MC[state.opt.mc]}）は p.adjust(p, method = "${P_ADJ[state.opt.mc] || 'holm'}") で\n`; return s; },
    rm() { return rHeader('反復測定の分散分析', ['afex', 'emmeans']) + RCODE.paired._pre() + R_RM(); },
    _unused() { return 'long <- data.frame(id = factor(rep(seq_len(nrow(d)), ncol(d))), cond = factor(rep(names(d), each = nrow(d)), levels = names(d)), y = unlist(d))\na <- afex::aov_ez("id", "y", long, within = "cond")\nsummary(a)            # Mauchly の球面性検定と Greenhouse-Geisser・Huynh-Feldt の補正\nfriedman.test(as.matrix(d))\nshapiro.test(residuals(aov(y ~ cond + Error(id/cond), long)$Within))\n' + `pairwise.t.test(long$y, long$cond, paired = TRUE, p.adjust.method = "${P_ADJ[state.opt.mc] || 'holm'}")  # 多重比較\n`; },
    alpha() { return rHeader('信頼性分析（Cronbach の α）', ['psych']) + RCODE.paired._pre() + 'psych::alpha(d)\n'; },
    profile() { return rHeader('個人別推移図', []) + RCODE.paired._pre() + 'matplot(t(d), type = "l", lty = 1, col = "#17607a55", xaxt = "n", ylab = "")\naxis(1, at = seq_along(d), labels = names(d)); lines(colMeans(d), lwd = 3, col = "#a3480f")\n'; }
  },
  bivar: {
    desc() { const W = wideCols(); return rHeader('基本統計量', ['psych']) + rDataFrame(W.names, W.cols) + 'psych::describe(d)\n'; },
    cor() { const W = wideCols(); const [x, y] = W.names.map(RQ); return rHeader('相関係数', ['psych']) + rDataFrame(W.names, W.cols) + 'd <- na.omit(d)\n' + `cor.test(d$${x}, d$${y}, method = "pearson")\ncor.test(d$${x}, d$${y}, method = "spearman", exact = FALSE)\ncor.test(d$${x}, d$${y}, method = "kendall", exact = FALSE)\n` + (W.names.length > 2 ? 'psych::corr.test(d)  # 相関行列と p 値\n' : ''); },
    reg() { const W = wideCols(); const [x, y] = W.names.map(RQ); return rHeader('単回帰分析', DIAG_PKGS) + rDataFrame(W.names.slice(0, 2), W.cols.slice(0, 2)) + `m <- lm(${y} ~ ${x}, data = d)\nsummary(m)\nconfint(m)\nplot(d$${x}, d$${y}); abline(m, col = "#a3480f")\n` + R_DIAG('m'); },
    scatter() { const W = wideCols(); const [x, y] = W.names.map(RQ); return rHeader('散布図', []) + rDataFrame(W.names.slice(0, 2), W.cols.slice(0, 2)) + `plot(d$${x}, d$${y}, pch = 16, col = "#17607a")\n`; }
  },
  table: {
    chi() { const t = state.table; return rHeader('分割表の検定', ['effectsize']) + `m <- matrix(c(${t.cells.flat().map(v => toNum(v)).join(', ')}), nrow = ${t.cells.length}, byrow = TRUE,\n            dimnames = list(c(${t.rowNames.map(RS).join(', ')}), c(${t.colNames.map(RS).join(', ')})))\nm\nr <- chisq.test(m, correct = FALSE); r\nr$expected        # 期待度数\nr$stdres          # 調整済み残差（|値| > 1.96 で有意）\neffectsize::cramers_v(m)\n` + (t.cells.length === 2 && t.colNames.length === 2 ? 'chisq.test(m)     # Yates の補正\nfisher.test(m)    # Fisher の直接確率法\nmcnemar.test(m)\n' : ''); }
  },
  db: {
    graph() { const R = state.db.roles; const D = dbData([R.y, R.a, R.b]); return rHeader('かんたんグラフ', []) + D.src + dbFactors([R.a, R.b]) + (R.a >= 0 ? (R.b >= 0 ? `with(d, interaction.plot(${dn(R.a)}, ${dn(R.b)}, ${dn(R.y)}))\n` : `boxplot(${dn(R.y)} ~ ${dn(R.a)}, data = d)\n`) : `hist(d$${dn(R.y)})\n`); },
    cross() { const R = state.db.roles; const js = state.db.cols.map((_, j) => j); const D = dbData(js); return rHeader('一括クロス集計', []) + D.src + dbFactors(js) + `g <- d$${dn(R.a)}\nfor (v in setdiff(names(d), ${RS(state.db.cols[R.a].name)})) {\n  x <- d[[v]]; cat("\\n====", v, "====\\n")\n  if (is.numeric(x)) { print(tapply(x, g, function(z) c(mean = mean(z, na.rm = TRUE), sd = sd(z, na.rm = TRUE))))\n    if (nlevels(factor(g)) == 2) print(t.test(x ~ g)) else print(summary(aov(x ~ g))) }\n  else { tb <- table(x, g); print(tb); print(suppressWarnings(chisq.test(tb, correct = FALSE))) }\n}\n`; },
    anova1() { const R = state.db.roles; const D = dbData([R.y, R.a]); return rHeader('一元配置分散分析（対応なし）', ['car', 'rstatix', 'multcomp', 'emmeans', 'PMCMRplus', 'FSA']) + D.src + `d$${dn(R.a)} <- factor(d$${dn(R.a)}, levels = c(${levelsOf(dbCol(R.a)).map(RS).join(', ')}))\nlong <- na.omit(data.frame(y = d$${dn(R.y)}, group = d$${dn(R.a)}))\n` + 'm <- aov(y ~ group, data = long)\nsummary(m)\noneway.test(y ~ group, data = long)\ncar::leveneTest(y ~ group, data = long, center = median)\nkruskal.test(y ~ group, data = long)\nshapiro.test(residuals(m))\n\n' + rMcOneWay('y', 'group', 'm', 'long', levelsOf(dbCol(R.a)).length) + '\n' + rKw('y', 'group', 'long', levelsOf(dbCol(R.a)).length); },
    rm1() { const R = state.db.roles, rep = [...R.rep].sort((a, b) => a - b); const D = dbData(rep); return rHeader('一元配置分散分析（対応あり）', ['afex']) + D.src + 'd <- na.omit(d)\n' + R_RM(); },
    anova2() { const R = state.db.roles; const D = dbData([R.y, R.a, R.b]); const a = dn(R.a), b = dn(R.b), y = dn(R.y); return rHeader('二元配置分散分析', ['car', 'emmeans']) + D.src + dbFactors([R.a, R.b]) + `options(contrasts = c("contr.sum", "contr.poly"))  # タイプIII平方和のため\nm <- lm(${y} ~ ${a} * ${b}, data = d)\ncar::Anova(m, type = 3)\nshapiro.test(residuals(m))\n# 単純主効果と対比較\nemmeans::joint_tests(m, by = ${RS(state.db.cols[R.b].name)})\nemmeans::joint_tests(m, by = ${RS(state.db.cols[R.a].name)})\npairs(emmeans::emmeans(m, ~ ${a} | ${b}), adjust = "${EMM_ADJ[state.opt.mc]}")\ninteraction.plot(d$${a}, d$${b}, d$${y})\n`; },
    mixed() { const R = state.db.roles, rep = [...R.rep].sort((a, b) => a - b); const D = dbData([R.a, ...rep]); const a = state.db.cols[R.a].name; return rHeader('混合計画の分散分析', ['afex', 'emmeans']) + D.src + dbFactors([R.a]) + `d <- na.omit(d); d$id <- factor(seq_len(nrow(d)))\nreps <- c(${rep.map(j => RS(state.db.cols[j].name)).join(', ')})\nlong <- data.frame(id = rep(d$id, length(reps)), g = rep(d[[${RS(a)}]], length(reps)), cond = factor(rep(reps, each = nrow(d)), levels = reps), y = unlist(d[reps]))\nam <- afex::aov_ez("id", "y", long, between = "g", within = "cond")\nsummary(am)   # 球面性の補正つき\nemmeans::joint_tests(am, by = "cond")   # 各条件での群の効果\nemmeans::joint_tests(am, by = "g")      # 各群での条件の効果\npairs(emmeans::emmeans(am, ~ cond | g), adjust = "${EMM_ADJ[state.opt.mc] === 'tukey' ? 'holm' : EMM_ADJ[state.opt.mc]}")\n`; },
    ancova() { const R = state.db.roles, cv = (R.cov || []).filter(j => j !== R.y && j !== R.a); const D = dbData([R.y, R.a, ...cv]); const y = dn(R.y), a = dn(R.a), cs = cv.map(dn).join(' + '); return rHeader('共分散分析', ['car', 'emmeans']) + D.src + dbFactors([R.a]) + `options(contrasts = c("contr.sum", "contr.poly"))\nm <- lm(${y} ~ ${a} + ${cs}, data = d)\ncar::Anova(m, type = 3)                                   # 共分散分析表（タイプIII）\nanova(m, lm(${y} ~ ${a} * (${cs}), data = d))              # 回帰の傾きの等質性\nemmeans::emmeans(m, ~ ${a})                                # 調整済み平均\npairs(emmeans::emmeans(m, ~ ${a}), adjust = "${EMM_ADJ[state.opt.mc]}")\nshapiro.test(residuals(m))\n`; },
    ancova2() { const R = state.db.roles, cv = (R.cov || []).filter(j => j !== R.y && j !== R.a && j !== R.b); const D = dbData([R.y, R.a, R.b, ...cv]); const y = dn(R.y), a = dn(R.a), b = dn(R.b), cs = cv.map(dn).join(' + '); return rHeader('二要因の共分散分析', ['car', 'emmeans']) + D.src + dbFactors([R.a, R.b]) + `options(contrasts = c("contr.sum", "contr.poly"))\nm <- lm(${y} ~ ${a} * ${b} + ${cs}, data = d)\ncar::Anova(m, type = 3)\nanova(m, lm(${y} ~ (${a} * ${b}) * (${cs}), data = d))     # 回帰の傾きの等質性\nemmeans::emmeans(m, ~ ${a} * ${b})                          # 調整済みセル平均\nemmeans::emmeans(m, ~ ${a}); emmeans::emmeans(m, ~ ${b})     # 周辺の調整済み平均\nemmeans::joint_tests(m, by = ${RS(state.db.cols[R.b].name)})   # 単純主効果\npairs(emmeans::emmeans(m, ~ ${a} | ${b}), adjust = "${EMM_ADJ[state.opt.mc]}")\n`; },
    mreg() { const R = state.db.roles, xs = R.x.filter(j => j !== R.y); const D = dbData([R.y, ...xs]); const f = `${dn(R.y)} ~ ${xs.map(dn).join(' + ')}`; const meth = state.opt.method;
      return rHeader('重回帰分析', [...DIAG_PKGS, ...(meth === 'all' ? ['leaps'] : [])]) + D.src + dbFactors(xs) + `m <- lm(${f}, data = na.omit(d))\nsummary(m)\nconfint(m)\nif (length(attr(terms(m), "term.labels")) >= 2) car::vif(m)   # 多重共線性（VIF。説明変数が 2 つ以上のとき）\n# 標準偏回帰係数 β\nX <- model.matrix(m)[, -1, drop = FALSE]; coef(m)[-1] * apply(X, 2, sd) / sd(model.response(model.frame(m)))\n`
        + (meth === 'step' ? `# ステップワイズ法（R の step() は AIC 基準。このアプリは p < .15 の変数増減法）\nstep(lm(${dn(R.y)} ~ 1, data = na.omit(d)), scope = ~ ${xs.map(dn).join(' + ')}, direction = "both")\n` : meth === 'all' ? `# 総当たり法\ns <- summary(leaps::regsubsets(${f}, data = na.omit(d), nvmax = ${xs.length})); data.frame(adjr2 = s$adjr2, cp = s$cp, bic = s$bic)\n` : '') + R_DIAG('m'); },
    mregcmp() { return RCODE.db.mreg(); },
    hreg() { const R = state.db.roles, xs = R.x.filter(j => j !== R.y), st = R.step || {}, steps = [...new Set(xs.map(j => +(st[j] || 1)))].sort((a, b) => a - b), it = (R.inter || []).filter(j => xs.includes(j)), useInt = it.length === 2 && state.opt.center !== false;
      const D = dbData([R.y, ...xs]); let s = rHeader('階層的重回帰分析', [...DIAG_PKGS, 'interactions']) + D.src + dbFactors(xs) + 'd <- na.omit(d)\n';
      const nameOf = j => useInt && it.includes(j) ? RQ(state.db.cols[j].name + '_c') : dn(j);
      if (useInt) s += it.map(j => `d$${RQ(state.db.cols[j].name + '_c')} <- d$${dn(j)} - mean(d$${dn(j)})  # 中心化\n`).join('');
      steps.forEach((k, i) => { const vs = xs.filter(j => +(st[j] || 1) === k).map(nameOf).join(' + '); s += i === 0 ? `m1 <- lm(${dn(R.y)} ~ ${vs}, data = d)\n` : `m${i + 1} <- update(m${i}, . ~ . + ${vs})\n`; });
      let K = steps.length; if (it.length === 2) { s += `m${K + 1} <- update(m${K}, . ~ . + ${nameOf(it[0])}:${nameOf(it[1])})  # 交互作用項\n`; K++; }
      s += `models <- list(${Array.from({ length: K }, (_, i) => `m${i + 1}`).join(', ')})\nsapply(models, function(m) summary(m)$r.squared)   # 各ステップの R²\n` + Array.from({ length: K - 1 }, (_, i) => `anova(m${i + 1}, m${i + 2})   # ステップ ${i + 2} の ΔR² の F 検定\n`).join('') + `summary(m${K})\n`;
      if (it.length === 2) s += `# 単純傾斜と Johnson-Neyman 法\ninteractions::sim_slopes(m${K}, pred = ${nameOf(it[0])}, modx = ${nameOf(it[1])}, johnson_neyman = TRUE)\ninteractions::interact_plot(m${K}, pred = ${nameOf(it[0])}, modx = ${nameOf(it[1])})\n`;
      const nx = xs.filter(j => colType(j) === 'num').slice(0, 2);
      if (nx.length === 2) { const a = it.length === 2 ? it.map(nameOf) : nx.map(nameOf); s += `# 回帰平面の 3D プロット（ほかの変数は平均値）\ng1 <- seq(min(d$${a[0]}), max(d$${a[0]}), length = 20); g2 <- seq(min(d$${a[1]}), max(d$${a[1]}), length = 20)\nnd <- expand.grid(g1, g2); names(nd) <- c(${RS(a[0].slice(1, -1))}, ${RS(a[1].slice(1, -1))})\nfor (v in setdiff(all.vars(formula(m${K}))[-1], names(nd))) nd[[v]] <- if (is.numeric(d[[v]])) mean(d[[v]]) else levels(factor(d[[v]]))[1]\npersp(g1, g2, matrix(predict(m${K}, nd), 20), theta = 35, phi = 25, xlab = ${RS(a[0].slice(1, -1))}, ylab = ${RS(a[1].slice(1, -1))}, zlab = ${RS(state.db.cols[R.y].name)}, col = "#dcecf1")\n`; }
      return s + R_DIAG(`m${K}`); },
    mlreg() { const R = state.db.roles, xs = R.x.filter(j => j !== R.y); const D = dbData([R.y, ...xs]); let s = rHeader('最尤法（完全情報最尤法）による回帰分析', ['lavaan']) + D.src, terms = [];
      xs.forEach(j => { if (colType(j) === 'num') terms.push(dn(j)); else levelsOf(dbCol(j)).slice(1).forEach((l, q) => { const v = `${state.db.cols[j].name}_${l}`; s += `d$${RQ(v)} <- ifelse(is.na(d$${dn(j)}), NA, as.numeric(d$${dn(j)} == ${RS(l)}))  # ダミー変数\n`; terms.push(RQ(v)); }); });
      return s + `fit <- lavaan::sem(${RS(`${state.db.cols[R.y].name} ~ ${terms.map(t => t.slice(1, -1)).join(' + ')}`)}, data = d, missing = "ml", fixed.x = FALSE)\nsummary(fit, rsquare = TRUE, standardized = TRUE)\nlavaan::fitMeasures(fit, c("logl", "aic", "bic"))\n`; },
    med() { const R = state.db.roles, ms = (R.mm || []).filter(j => j !== R.y && j !== R.mx), cv = (R.mcov || []).filter(j => ![R.y, R.mx, ...ms].includes(j)); const D = dbData([R.y, R.mx, ...ms, ...cv]);
      const xCat = colType(R.mx) === 'cat', xl = xCat ? levelsOf(dbCol(R.mx)) : null, X = xCat ? 'X01' : dn(R.mx), Xp = X.replace(/`/g, ''), cs = cv.length ? ' + ' + cv.map(dn).join(' + ') : '', B = state.opt.medBoot || 5000, Ms = ms.map(dn), yname = state.db.cols[R.y].name;
      let s = rHeader('媒介分析（PROCESS モデル 4 に相当）', ['lavaan']) + D.src + dbFactors(cv) + 'd <- na.omit(d)\n' + (xCat ? `d$X01 <- as.numeric(d$${dn(R.mx)} == ${RS(xl[1])})  # ${xl[1]} = 1\n` : '');
      s += Ms.map((m, j) => `fit_a${j + 1} <- lm(${m} ~ ${X}${cs}, data = d); summary(fit_a${j + 1})   # a パス\n`).join('');
      s += `fit_b <- lm(${dn(R.y)} ~ ${X} + ${Ms.join(' + ')}${cs}, data = d); summary(fit_b)   # b パスと直接効果 c′\nfit_c <- lm(${dn(R.y)} ~ ${X}${cs}, data = d); summary(fit_c)   # 総合効果 c\n`;
      s += `# 間接効果 a×b のブートストラップ（パーセンタイル法）\nind <- function(dd) { b <- coef(lm(${dn(R.y)} ~ ${X} + ${Ms.join(' + ')}${cs}, data = dd)); c(${Ms.map((m, j) => `coef(lm(${m} ~ ${X}${cs}, data = dd))[2] * b[${3 + j}]`).join(', ')}) }\nind(d)   # 間接効果の推定値\nset.seed(1); bs <- replicate(${B}, ind(d[sample(nrow(d), replace = TRUE), ]))\n${ms.length > 1 ? 'apply(bs, 1, quantile, c(.025, .975))' : 'quantile(bs, c(.025, .975))'}   # 95%信頼区間（0 を含まなければ有意）\n`;
      let covDum = ''; const cT = []; cv.forEach(j => { if (colType(j) === 'num') cT.push(state.db.cols[j].name); else levelsOf(dbCol(j)).slice(1).forEach(l => { const nm1 = `${state.db.cols[j].name}_${l}`; covDum += `d$${RQ(nm1)} <- as.numeric(d$${dn(j)} == ${RS(l)})   # lavaan 用のダミー変数\n`; cT.push(nm1); }); });
      const cP = cT.length ? ' + ' + cT.join(' + ') : '';
      s += covDum;
      const lines = [...Ms.map((m, j) => `  ${m.slice(1, -1)} ~ a${j + 1}*${Xp}${cP}`), `  ${yname} ~ cp*${Xp} + ${Ms.map((m, j) => `b${j + 1}*${m.slice(1, -1)}`).join(' + ')}${cP}`, ...Ms.map((m, j) => `  ind${j + 1} := a${j + 1}*b${j + 1}`), `  total := cp + ${Ms.map((m, j) => `a${j + 1}*b${j + 1}`).join(' + ')}`];
      return s + `\n# lavaan で同じモデル（ブートストラップ）\nmodel <- '\n${lines.join('\n')}\n'\nfit <- lavaan::sem(model, data = d, se = "bootstrap", bootstrap = ${B})\nlavaan::parameterEstimates(fit, boot.ci.type = "perc")\n`; },
    mod() { const R = state.db.roles, cv = (R.mcov || []).filter(j => ![R.y, R.mx, R.mw].includes(j)); const D = dbData([R.y, R.mx, R.mw, ...cv]); const wCat = colType(R.mw) === 'cat', xCat = colType(R.mx) === 'cat', center = state.opt.center !== false, cs = cv.length ? ' + ' + cv.map(dn).join(' + ') : '';
      let s = rHeader('調整分析（PROCESS モデル 1 に相当）', ['interactions', 'emmeans', ...DIAG_PKGS]) + D.src + dbFactors([R.mw, ...cv]) + 'd <- na.omit(d)\n';
      const X = xCat ? 'X01' : center ? 'X_c' : dn(R.mx), W = wCat ? dn(R.mw) : center ? 'W_c' : dn(R.mw);
      if (xCat) s += `d$X01 <- as.numeric(d$${dn(R.mx)} == ${RS(levelsOf(dbCol(R.mx))[1])})\n`; else if (center) s += `d$X_c <- d$${dn(R.mx)} - mean(d$${dn(R.mx)})   # 中心化\n`;
      if (!wCat && center) s += `d$W_c <- d$${dn(R.mw)} - mean(d$${dn(R.mw)})\n`;
      s += `m0 <- lm(${dn(R.y)} ~ ${X} + ${W}${cs}, data = d)\nm1 <- lm(${dn(R.y)} ~ ${X} * ${W}${cs}, data = d)\nsummary(m1)\nanova(m0, m1)   # 交互作用による ΔR² の F 検定\n`;
      s += wCat ? `emmeans::emtrends(m1, ~ ${W}, var = "${X}")   # 群ごとの X の傾き（単純傾斜）\n` : `interactions::sim_slopes(m1, pred = ${X}, modx = ${W}, johnson_neyman = TRUE)   # 単純傾斜（平均 ± 1SD）と Johnson-Neyman 法\ninteractions::interact_plot(m1, pred = ${X}, modx = ${W})\n`;
      return s + R_DIAG('m1'); },
    modmed() { const R = state.db.roles, model = state.opt.mmModel || '7', ms = (R.mm || []).filter(j => j !== R.y && j !== R.mx && j !== R.mw), mj = ms[0], cv = (R.mcov || []).filter(j => ![R.y, R.mx, R.mw, mj].includes(j)); const D = dbData([R.y, R.mx, R.mw, mj, ...cv]);
      const center = state.opt.center !== false, B = state.opt.medBoot || 5000;
      let s = rHeader(`調整媒介分析（PROCESS モデル ${model} に相当）`, ['lavaan']) + D.src + 'd <- na.omit(d)\n';
      const bin = j => colType(j) === 'cat', lvOf = j => levelsOf(dbCol(j));
      s += bin(R.mx) ? `d$X <- as.numeric(d$${dn(R.mx)} == ${RS(lvOf(R.mx)[1])})\n` : `d$X <- d$${dn(R.mx)}${center ? ` - mean(d$${dn(R.mx)})   # 中心化` : ''}\n`;
      s += bin(R.mw) ? `d$W <- as.numeric(d$${dn(R.mw)} == ${RS(lvOf(R.mw)[1])})\n` : `d$W <- d$${dn(R.mw)}${center ? ` - mean(d$${dn(R.mw)})   # 中心化` : ''}\n`;
      s += `d$M <- d$${dn(mj)}${model === '14' && center ? ` - mean(d$${dn(mj)})   # 中心化（M × W の積のため）` : ''}\nd$Y <- d$${dn(R.y)}\nd$XW <- d$X * d$W; d$MW <- d$M * d$W\n`;
      const cT = []; cv.forEach(j => { if (colType(j) === 'num') cT.push(RQ(state.db.cols[j].name)); else lvOf(j).slice(1).forEach(l => { const nm1 = `${state.db.cols[j].name}_${l}`; s += `d$${RQ(nm1)} <- as.numeric(d$${dn(j)} == ${RS(l)})\n`; cT.push(RQ(nm1)); }); });
      const cP = cT.length ? ' + ' + cT.map(t => t.slice(1, -1)).join(' + ') : '';
      const wsd = 'sd(d$W)', wvals = colType(R.mw) === 'cat' ? ['0', '1'] : [`-${wsd}`, '0', wsd].map(v => center ? v : `mean(d$W) + (${v})`);
      const eq = { '7': [`  M ~ a1*X + a2*W + a3*XW${cP}`, `  Y ~ cp*X + b*M${cP}`, '  index := a3*b'], '8': [`  M ~ a1*X + a2*W + a3*XW${cP}`, `  Y ~ cp1*X + cp2*W + cp3*XW + b*M${cP}`, '  index := a3*b'], '14': [`  M ~ a*X${cP}`, `  Y ~ cp*X + b1*M + b2*W + b3*MW${cP}`, '  index := a*b3'] }[model];
      const condF = w => model === '14' ? `a*(b1 + b3*(${w}))` : `(a1 + a3*(${w}))*b`;
      s += `\n# W の代表値（${colType(R.mw) === 'cat' ? '0 と 1' : '平均 − 1SD・平均・平均 + 1SD'}）\n${wvals.map((v, i) => `w${i + 1} <- ${v.replace(/sd\(d\$W\)/g, 'sd(d$W)')}`).join('; ')}\n`;
      s += `model <- paste0('\n${eq.join('\n')}\n${wvals.map((_, i) => `  ind_w${i + 1} := ${condF(`', w${i + 1}, '`)}`).join('\n')}\n')\n`;
      s += `fit <- lavaan::sem(model, data = d, se = "bootstrap", bootstrap = ${B})\nlavaan::parameterEstimates(fit, boot.ci.type = "perc")   # index（調整媒介指標）と ind_w1〜（条件付き間接効果）\n`;
      s += `\n# 回帰式（係数の確認）\nsummary(lm(${model === '14' ? 'M ~ X' : 'M ~ X + W + XW'}${cP.replace(/ \+ /g, ' + ')}, data = d))\nsummary(lm(${{ '7': 'Y ~ X + M', '8': 'Y ~ X + W + XW + M', '14': 'Y ~ X + M + W + MW' }[model]}${cP}, data = d))\n`;
      return s; },
    serial() { const R = state.db.roles, ms = (R.mm || []).filter(j => j !== R.y && j !== R.mx), cv = (R.mcov || []).filter(j => ![R.y, R.mx, ...ms].includes(j)); const D = dbData([R.y, R.mx, ...ms, ...cv]);
      const k = ms.length, B = state.opt.medBoot || 5000, xCat = colType(R.mx) === 'cat';
      let s = rHeader('系列媒介分析（PROCESS モデル 6 に相当）', ['lavaan']) + D.src + 'd <- na.omit(d)\n';
      s += xCat ? `d$X <- as.numeric(d$${dn(R.mx)} == ${RS(levelsOf(dbCol(R.mx))[1])})\n` : `d$X <- d$${dn(R.mx)}\n`;
      s += ms.map((j, i) => `d$M${i + 1} <- d$${dn(j)}   # ${state.db.cols[j].name}\n`).join('') + `d$Y <- d$${dn(R.y)}\n`;
      const cT = []; cv.forEach(j => { if (colType(j) === 'num') cT.push(RQ(state.db.cols[j].name)); else levelsOf(dbCol(j)).slice(1).forEach(l => { const nm1 = `${state.db.cols[j].name}_${l}`; s += `d$${RQ(nm1)} <- as.numeric(d$${dn(j)} == ${RS(l)})\n`; cT.push(RQ(nm1)); }); });
      const cP = cT.length ? ' + ' + cT.map(t => t.slice(1, -1)).join(' + ') : '';
      // 経路の一覧
      const paths = []; for (let mask = 1; mask < (1 << k); mask++) { const P = []; for (let j = 0; j < k; j++) if (mask & (1 << j)) P.push(j); paths.push(P); } paths.sort((p, q) => p.length - q.length || p[0] - q[0]);
      const term = P => [`a${P[0] + 1}`, ...P.slice(1).map((j, t) => `d${j + 1}${P[t] + 1}`), `b${P[P.length - 1] + 1}`].join('*'), nameP = P => 'ind_' + P.map(j => j + 1).join('');
      const lines = [];
      for (let j = 0; j < k; j++) lines.push(`  M${j + 1} ~ a${j + 1}*X${Array.from({ length: j }, (_, i) => ` + d${j + 1}${i + 1}*M${i + 1}`).join('')}${cP}`);
      lines.push(`  Y ~ cp*X + ${Array.from({ length: k }, (_, j) => `b${j + 1}*M${j + 1}`).join(' + ')}${cP}`);
      paths.forEach(P => lines.push(`  ${nameP(P)} := ${term(P)}   # X → ${P.map(j => 'M' + (j + 1)).join(' → ')} → Y`));
      lines.push(`  total_ind := ${paths.map(nameP).join(' + ')}`, '  total := cp + total_ind');
      s += `model <- '\n${lines.join('\n')}\n'\nfit <- lavaan::sem(model, data = d, se = "bootstrap", bootstrap = ${B})\nlavaan::parameterEstimates(fit, boot.ci.type = "perc")   # ind_1・ind_12 などが各経路の間接効果\n`;
      s += `\n# 回帰式（係数の確認）\n${Array.from({ length: k }, (_, j) => `summary(lm(M${j + 1} ~ X${Array.from({ length: j }, (_, i) => ` + M${i + 1}`).join('')}${cP}, data = d))`).join('\n')}\nsummary(lm(Y ~ X + ${Array.from({ length: k }, (_, j) => `M${j + 1}`).join(' + ')}${cP}, data = d))\n`;
      return s; },
    lmAnova() { const R = state.db.roles, bj = R.b >= 0 && R.b !== R.a ? R.b : -1, cv = (R.cov || []).filter(j => ![R.y, R.a, bj].includes(j) && colType(j) === 'num'); const D = dbData([R.y, R.a, bj, ...cv]);
      const y = dn(R.y), a = dn(R.a), b = bj >= 0 ? dn(bj) : null, rhs = [b ? `${a} * ${b}` : a, ...cv.map(dn)].join(' + ');
      return rHeader('分散分析を回帰分析（一般線形モデル）として見る', ['car']) + D.src + dbFactors([R.a, bj]) + 'd <- na.omit(d)\n'
        + `${state.opt.coding === 'effect' ? 'options(contrasts = c("contr.sum", "contr.poly"))   # 効果コーディング（R の contr.sum は「最後の水準」を −1 にするので、係数の並びはアプリ（最初の水準が −1）と違って見えます。F は同じ）' : 'options(contrasts = c("contr.treatment", "contr.poly"))   # ダミーコーディング（基準＝最初の水準）'}\nm <- lm(${y} ~ ${rhs}, data = d)\nhead(model.matrix(m), 10)   # デザイン行列（ダミー変数の表）\nsummary(m)                  # 回帰係数と、モデル全体の F・R²\n`
        + `tapply(d$${y}, d$${a}, mean)   # 群の平均（ダミーコーディングなら、切片＝基準群の平均、係数＝平均の差）\nanova(lm(${y} ~ 1, data = d), m)   # 「切片だけ」と比べたモデル比較の F\n`
        + `options(contrasts = c("contr.sum", "contr.poly")); car::Anova(lm(${y} ~ ${rhs}, data = d), type = 3)   # 分散分析表（タイプIII）\n` + (!b && !cv.length ? `summary(aov(${y} ~ ${a}, data = d))   # いつもの一元配置分散分析（F が一致する）\n` : ''); },
    glmFam() { const R = state.db.roles, cv = (R.cov || []).filter(j => ![R.y, R.a].includes(j) && colType(j) === 'num'); const D = dbData([R.y, R.a, ...cv]);
      const raw = dbCol(R.y), lvY = levelsOf(raw.filter(v => v !== '')), nums = raw.map(toNum); let fam = state.opt.family; if (fam === 'auto') fam = lvY.length === 2 ? 'binomial' : nums.filter(isFinite).every(v => v >= 0 && Number.isInteger(v)) ? 'poisson' : 'gaussian';
      const ev = fam === 'binomial' ? (lvY.includes(R.event) ? R.event : lvY[1]) : null, a = dn(R.a), rhs = [a, ...cv.map(dn)].join(' + ');
      let s = rHeader(`一般化線形モデル（${fam}）`, []) + D.src + dbFactors([R.a]) + 'd <- na.omit(d)\n' + (fam === 'binomial' ? `d$Y <- as.integer(d$${dn(R.y)} == ${RS(ev)})   # 「${ev}」= 1\n` : `d$Y <- d$${dn(R.y)}\n`);
      const famR = { gaussian: 'gaussian', binomial: 'binomial', poisson: 'poisson' }[fam];
      s += `m <- glm(Y ~ ${rhs}, family = ${famR}, data = d)\nsummary(m)\n${fam !== 'gaussian' ? 'exp(cbind(exp_B = coef(m), confint.default(m)))   # オッズ比（二項）・率比（ポアソン）\n' : ''}m0 <- glm(Y ~ ${cv.length ? cv.map(dn).join(' + ') : '1'}, family = ${famR}, data = d)\nanova(m0, m, test = "${fam === 'gaussian' ? 'F' : 'Chisq'}")   # 逸脱度分析（尤度比検定）\n`;
      if (fam === 'binomial' && !cv.length) s += `tb <- table(d$${a}, d$Y); tb\nchisq.test(tb, correct = FALSE)   # Pearson の χ² 検定\nE <- chisq.test(tb)$expected; 2 * sum(tb * log(tb / E), na.rm = TRUE)   # G 統計量（尤度比検定と一致）\n`;
      if (fam === 'poisson') s += `summary(aov(Y ~ ${a}, data = d))   # 回数をそのまま分散分析した場合\ndeviance(m) / df.residual(m)   # 過分散の目安（1.5 を超えたら quasipoisson や MASS::glm.nb を検討）\n`;
      return s; },
    _cl(title, body, hier) { const js = [...(state.db.roles.cl || [])].filter(j => colType(j) === 'num').sort((a, b) => a - b), D = dbData(js), K = CL_LAST && CL_LAST.k ? CL_LAST.k : (state.opt.clK === 'auto' ? 3 : +state.opt.clK);
      return rHeader(title, ['cluster']) + D.src + 'd <- na.omit(d)\n' + (state.opt.clZ ? 'X <- scale(d)   # 標準化（z 得点）\n' : 'X <- as.matrix(d)   # 標準化しない\n')
        + `K <- ${K}   # クラスター数（アプリで選ばれた数。変えて試せます）\n`
        + 'ch <- function(X, cl) { k <- length(unique(cl)); n <- nrow(X); W <- sum(sapply(split(as.data.frame(X), cl), function(g) sum(scale(g, scale = FALSE)^2))); B <- sum(scale(X, scale = FALSE)^2) - W; (B / (k - 1)) / (W / (n - k)) }   # Calinski–Harabasz\n' + body
        + 'table(cl)                          # 各クラスターの人数\naggregate(d, list(クラスター = cl), mean)   # クラスターごとの平均（元の単位）\naggregate(as.data.frame(X), list(クラスター = cl), mean)   # プロフィール（標準得点）\n'
        + (hier ? 's <- cluster::silhouette(cl, dd)' : 's <- cluster::silhouette(cl, dist(X))') + '; mean(s[, 3])   # 平均シルエット\n' + 'plot(s, col = 1:K + 1, border = NA)   # シルエット図\n'
        + 'for (v in names(d)) print(summary(aov(d[[v]] ~ factor(cl))))   # 変数ごとの F 検定（分類に使った変数なので参考）\n'; },
    hclust() { const m = state.opt.clMethod, dk = state.opt.clDist, p = Math.max(1, +state.opt.clP || 3), rm = m === 'ward' ? 'ward.' + clWardType(dk) : m;
      const dl = { euclid: 'dd <- dist(X)   # ユークリッド距離', sqeuclid: 'dd <- dist(X)^2   # 平方ユークリッド距離', cityblock: 'dd <- dist(X, method = "manhattan")   # 都市ブロック距離', chebychev: 'dd <- dist(X, method = "maximum")   # Chebychev 距離', minkowski: `dd <- dist(X, method = "minkowski", p = ${p})   # Minkowski 距離`, cosine: 'dd <- as.dist(1 - tcrossprod(X / sqrt(rowSums(X^2))))   # 1 − コサイン類似度', correlation: 'dd <- as.dist(1 - cor(t(X)))   # 1 − 人ごとの変数間の相関' }[dk];
      const within = m === 'waverage' ? `# グループ内平均連結法（SPSS の方法）は R の hclust にないので、同じ手順の関数を定義します\nhclust_within <- function(d) {\n  D <- as.matrix(d); n <- nrow(D); S <- rep(0, n); size <- rep(1, n); act <- rep(TRUE, n); id <- -(1:n)\n  merge <- matrix(0L, n - 1, 2); height <- numeric(n - 1)\n  for (s in 1:(n - 1)) {\n    best <- Inf; bi <- bj <- 0; a <- which(act)\n    for (i in a) for (j in a[a > i]) { m <- size[i] + size[j]; v <- (S[i] + S[j] + D[i, j]) / (m * (m - 1) / 2); if (v < best) { best <- v; bi <- i; bj <- j } }\n    merge[s, ] <- c(id[bi], id[bj]); height[s] <- best\n    S[bi] <- S[bi] + S[bj] + D[bi, bj]; D[bi, ] <- D[bi, ] + D[bj, ]; D[, bi] <- D[bi, ]; size[bi] <- size[bi] + size[bj]; act[bj] <- FALSE; id[bi] <- s\n  }\n  ord <- function(v) if (v < 0) -v else c(ord(merge[v, 1]), ord(merge[v, 2]))\n  structure(list(merge = merge, height = height, order = ord(n - 1), labels = NULL, method = "within-groups average", call = match.call(), dist.method = "custom"), class = "hclust")\n}\n` : '';
      return RCODE.db._cl(`階層的クラスター分析（${CL_HM[m][0]}・${CL_DIST[dk]}）`,
      dl + '\n' + within + (m === 'waverage' ? 'hc <- hclust_within(dd)\n' : `hc <- hclust(dd, method = ${RS(rm)})   # ${CL_HM[m][0]}${m === 'ward' ? (rm === 'ward.D' ? '（ward.D：距離をそのまま使う。平方ユークリッド距離と組み合わせる）' : '（ward.D2：距離を 2 乗して計算。ユークリッド距離と組み合わせる）') : ''}\n`)
      + `plot(hc, labels = FALSE, hang = -1); rect.hclust(hc, k = K, border = "red")   # デンドログラム\nrev(hc$height)[1:15]   # 結合距離（最後の 15 段階）\n`
      + `sapply(2:8, function(k) mean(cluster::silhouette(cutree(hc, k), dd)[, 3]))   # k = 2〜8 の平均シルエット（選んだ距離で）\nsapply(2:8, function(k) ch(X, cutree(hc, k)))   # k = 2〜8 の Calinski–Harabasz\ncl <- cutree(hc, k = K)\n`, true); },
    kmeans() { return RCODE.db._cl('k-means クラスター分析（Ward 法の結果を初期値に）',
      `hc <- hclust(dist(X), method = "ward.D2")\nkm_from_ward <- function(k) { init <- aggregate(as.data.frame(X), list(cutree(hc, k)), mean)[, -1]; kmeans(X, centers = init, iter.max = 100) }\n`
      + `sapply(2:8, function(k) { km <- km_from_ward(k); mean(cluster::silhouette(km$cluster, dist(X))[, 3]) })   # 平均シルエット\nsapply(2:8, function(k) km_from_ward(k)$tot.withinss)   # 群内平方和（肘を探す）\n`
      + `km <- km_from_ward(K)\nkm$centers                 # クラスターの中心\nkm$betweenss / km$totss     # 分類で説明できた割合\ncl <- km$cluster\n`); },
    kappa() { const js = [...(state.db.roles.ag || [])].sort((a, b) => a - b), k = js.length, kw = state.opt.kappaW;
      const C = js.map(j => rawCol(j)), lev = agLevels(C.map(c => c.filter(v => v !== ''))), D = rDataFrame(js.map(j => state.db.cols[j].name), C), single = lev.every(v => /^\d$/.test(v));
      return rHeader(`評定者間一致（${k === 2 ? 'Cohen' : 'Fleiss'} の κ）`, ['irr', 'psych']) + D + 'd <- na.omit(d)   # 評定がそろっている対象だけ（値はコード）\n'
        + `lev <- c(${lev.map(RS).join(', ')})   # カテゴリの順序（重みつき κ で使う）\n`
        + (k === 2 ? `irr::kappa2(d, weight = "unweighted")   # Cohen の κ（z 検定）\n`
          + (kw !== 'none' ? (single ? `irr::kappa2(d, weight = ${RS(kw === 'linear' ? 'equal' : 'squared')})   # 重みつき κ の z 検定\n` : `# 注意：irr::kappa2 の重みつき κ は、カテゴリを文字として並べる（"10" が "2" より前）ため、この評定では使えません\n`) : '')
          + `psych::cohen.kappa(d, levels = lev${kw === 'linear' ? ', w.exp = 1' : ''})   # κ と重みつき κ（${kw === 'linear' ? '線形' : '2 次'}の重み）の 95% 信頼区間\ntable(factor(d[[1]], levels = lev), factor(d[[2]], levels = lev))   # 2 人の評定のクロス表\n`
          : 'irr::kappam.fleiss(d, detail = TRUE)   # Fleiss の κ とカテゴリごとの κ（カテゴリごとの値は小数第 3 位で丸めて表示されます）\nirr::kappam.light(d)   # Light の κ（2 人ずつの Cohen の κ の平均）\n'); },
    icc() { const js = [...(state.db.roles.ag || [])].sort((a, b) => a - b), D = dbData(js), m = state.opt.iccModel, t = state.opt.iccType, u = state.opt.iccUnit;
      return rHeader('評定者間一致（ICC）', ['irr', 'psych']) + D.src + 'd <- na.omit(d)\n'
        + `irr::icc(d, model = ${RS(m === 'oneway' ? 'oneway' : 'twoway')}, type = ${RS(m === 'oneway' ? 'agreement' : t)}, unit = ${RS(u)})   # 選んだ ICC（${m === 'twoway-mixed' ? '二元配置の混合モデルも、計算は twoway と同じ' : ICC_MODEL_L[m]}）\npsych::ICC(d)   # 6 種類の ICC と信頼区間（ICC1 = ICC(1,1), ICC2 = ICC(A,1), ICC3 = ICC(C,1) …）\n`
        + (js.length === 2 ? 'dif <- d[[1]] - d[[2]]; c(平均の差 = mean(dif), 下限 = mean(dif) - 1.96 * sd(dif), 上限 = mean(dif) + 1.96 * sd(dif))   # Bland-Altman の一致の限界\n' : ''); },
    fa() { const R = state.db.roles, items = [...R.fa].sort((a, b) => a - b); const D = dbData(items); const fm = { ml: 'ml', pa: 'pa', pa1: 'pa', uls: 'minres', gls: 'gls', alpha: 'alpha', pca: 'pca' }[state.opt.ext] || 'ml';
      const rot = state.opt.rot, rotMap = { none: 'none', varimax: 'varimax', quartimax: 'quartimax', equamax: 'equamax', bentlerT: 'bentlerT', geominT: 'geominT', varimin: 'varimin', promax: 'promax', oblimin: 'oblimin', simplimax: 'simplimax', bentlerQ: 'bentlerQ', geominQ: 'geominQ', biquartimin: 'biquartimin', bifactorT: 'bifactor' };
      const k = state.opt.nf === 'auto' ? 'NF' : state.opt.nf;
      const poly = ['poly', 'cmp'].includes(state.opt.fcor), pc = poly ? ', cor = "poly"' : '';
      const faCall = (c, nm) => fm === 'pca' ? `${nm} <- psych::principal(${poly && c ? 'pc$rho' : 'd'}, nfactors = ${k}, rotate = ${RS(rotMap[rot] || 'promax')}${poly && c ? ', n.obs = nrow(d)' : ''})\n` : `${nm} <- psych::fa(d, nfactors = ${k}, fm = ${RS(fm)}, rotate = ${RS(rotMap[rot] || rot)}${state.opt.ext === 'pa1' ? ', max.iter = 1' : ''}${c})\n`;
      return rHeader('因子分析', ['psych', 'GPArotation']) + D.src + 'd <- na.omit(d)\n'
        + (poly ? 'pc <- psych::polychoric(d)   # ポリコリック相関（アプリと同じ psych の方法）\nround(pc$rho, 3)\npsych::KMO(pc$rho)\npsych::cortest.bartlett(pc$rho, n = nrow(d))\nev <- eigen(pc$rho)$values   # 固有値（アプリの平行分析は、この値を正規乱数データの 95 パーセント点と比べます）\n' : 'psych::KMO(d)\npsych::cortest.bartlett(cor(d), n = nrow(d))\npsych::fa.parallel(d, fa = "fa")   # 平行分析\n')
        + (state.opt.nf === 'auto' ? (poly ? 'NF <- psych::fa.parallel(d, fa = "fa", cor = "poly", plot = FALSE)$nfact  # 平行分析（psych は乱数のつくり方がアプリと違うため、因子数が違うときは数字を直接入れてください）\n' : 'NF <- psych::fa.parallel(d, fa = "fa", plot = FALSE)$nfact  # 平行分析で決めた因子数（アプリは 95 パーセント点基準。違う場合は数字を直接入れてください）\n') : '')
        + faCall(pc, 'f') + (state.opt.fcor === 'cmp' ? '# 比較：通常の（ピアソンの）相関で同じ因子分析\n' + faCall('', 'f0') + 'psych::factor.congruence(f, f0)   # タッカーの一致係数（行：ポリコリック、列：通常）\n' : '')
        + (rot.startsWith('promax') && poly ? '# 注：psych::fa の rotate = "promax" は、stats::promax（アプリと同じ）と小数第 3 位で違うことがあります。そろえるときは stats::promax(unclass(psych::fa(d, ' + k + ', fm = ' + RS(fm) + ', rotate = "none"' + pc + ')$loadings)) を使います\n' : '')
        + `print(f$loadings, cutoff = .4, sort = TRUE)\nf$Phi        # 因子間相関（斜交回転のとき）\nf$communality\n` + faRelR(items) + (rotMap[rot] ? '' : `# 「${S.ROTATIONS[rot] ? S.ROTATIONS[rot][0] : rot}」は GPArotation パッケージの関数で回転できます（例：GPArotation::${rot}(unclass(f$loadings))）\n`); },
    logit() { const R = state.db.roles, xs = R.x.filter(j => j !== R.bin); const D = dbData([R.bin, ...xs]); const yv = state.db.cols[R.bin].name;
      return rHeader('ロジスティック回帰分析', ['ResourceSelection', 'pROC']) + D.src + dbFactors(xs) + `d$y01 <- as.integer(d$${RQ(yv)} == ${RS(R.event)})  # 「${R.event}」を 1\nm <- glm(y01 ~ ${xs.map(dn).join(' + ')}, family = binomial, data = na.omit(d))\nsummary(m)\nexp(cbind(OR = coef(m), confint.default(m)))   # オッズ比と 95%CI（Wald）\nanova(update(m, . ~ 1), m, test = "Chisq")      # モデルの尤度比検定\nResourceSelection::hoslem.test(m$y, fitted(m), g = 10)\nr <- pROC::roc(m$y, fitted(m)); pROC::auc(r); pROC::ci.auc(r, method = "delong")\npROC::coords(r, "best", best.method = "youden")\n`; },
    km() { const R = state.db.roles; const D = dbData([R.time, R.st, R.a]); const t = dn(R.time), s0 = dn(R.st), g = R.a >= 0 ? dn(R.a) : '1';
      return rHeader('生存曲線（Kaplan-Meier）', ['survival']) + D.src + dbFactors([R.a]) + `library(survival)\nd$event <- as.integer(d$${s0} == ${RS(R.stev)})  # 「${R.stev}」をイベント\nfit <- survfit(Surv(${t}, event) ~ ${g}, data = d, conf.type = "log")\nsummary(fit)$table      # 中央値と 95%CI\nplot(fit, col = 1:4, mark.time = TRUE, xlab = ${RS(state.db.cols[R.time].name)}, ylab = "生存率")\n` + (R.a >= 0 ? `survdiff(Surv(${t}, event) ~ ${g}, data = d, rho = 0)   # ログランク検定\nsurvdiff(Surv(${t}, event) ~ ${g}, data = d, rho = 1)   # Peto-Peto 検定\n` : ''); },
    cox() { const R = state.db.roles, xs = R.x.filter(j => j !== R.time && j !== R.st); const D = dbData([R.time, R.st, ...xs]);
      return rHeader('Cox 比例ハザード回帰', ['survival']) + D.src + dbFactors(xs) + `library(survival)\nd$event <- as.integer(d$${dn(R.st)} == ${RS(R.stev)})\nm <- coxph(Surv(${dn(R.time)}, event) ~ ${xs.map(dn).join(' + ')}, data = d, ties = "efron")\nsummary(m)      # ハザード比・尤度比/Wald/スコア検定・C 統計量\ncox.zph(m)      # 比例ハザード性の検定\n`; },
    roc() { const R = state.db.roles, vars = R.roc.filter(j => j !== R.bin && colType(j) === 'num'); const D = dbData([R.bin, ...vars]); const lv = levelsOf(dbCol(R.bin)), pos = R.event && lv.includes(R.event) ? R.event : lv[lv.length - 1], neg = lv.find(l => l !== pos);
      const dir = state.opt.rocDir === 'high' ? ', direction = "<"' : state.opt.rocDir === 'low' ? ', direction = ">"' : '', bm = state.opt.rocCut === 'closest' ? 'closest.topleft' : 'youden';
      return rHeader('ROC 分析', ['pROC']) + D.src + 'd <- na.omit(d)\n' + vars.map((j, k) => `r${k + 1} <- pROC::roc(d$${dn(R.bin)}, d$${dn(j)}, levels = c(${RS(neg)}, ${RS(pos)})${dir})   # ${state.db.cols[j].name}\npROC::ci.auc(r${k + 1}, method = "delong")\npROC::coords(r${k + 1}, "best", best.method = "${bm}", ret = c("threshold", "sensitivity", "specificity", "ppv", "npv"))\n`).join('')
        + (vars.length >= 2 ? S.pairs(vars.length).map(([a, b]) => `pROC::roc.test(r${a + 1}, r${b + 1}, method = "delong", paired = TRUE)\n`).join('') + `plot(r1); ${vars.slice(1).map((_, k) => `plot(r${k + 2}, add = TRUE, col = ${k + 2})`).join('; ')}\n` : 'plot(r1)\n'); },
    sem() { const m = state.db.semModel, obs = m.nodes.filter(n => n.kind === 'obs').map(n => n.name), js = obs.map(nm0 => state.db.cols.findIndex(c => c.name === nm0)).filter(j => j >= 0); const D = dbData(js);
      const auto = semAutoCov(m).map(e => `${m.nodes.find(n => n.id === e.from).name} ~~ ${m.nodes.find(n => n.id === e.to).name}`), B = +state.opt.semBoot;
      return rHeader('構造方程式モデリング', ['lavaan', 'semPlot']) + D.src + `model <- '\n${semSyntax(m)}${auto.length ? `\n# 外生変数どうしの共分散（アプリの「自動で仮定」に合わせて明示）\n${auto.join('\n')}` : ''}\n'\nfit <- lavaan::sem(model, data = d${B > 0 ? `, se = "bootstrap", bootstrap = ${B}` : ''}${m.autoCov ? '' : ', auto.cov.lv.x = FALSE'})\nsummary(fit, fit.measures = TRUE, standardized = TRUE, rsquare = TRUE)\nlavaan::fitMeasures(fit, c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "rmsea.ci.lower", "rmsea.ci.upper", "srmr", "gfi", "agfi", "aic", "bic"))\nlavaan::modindices(fit, sort. = TRUE, minimum.value = 3.84)\n${B > 0 ? 'lavaan::parameterEstimates(fit, boot.ci.type = "bca.simple", standardized = TRUE)   # ブートストラップ信頼区間（バイアス修正法）\n' : ''}semPlot::semPaths(fit, "std", layout = "tree2", edge.label.cex = .9)\n`; }
  }
};
function rScript(fmt, run) { const f = RCODE[fmt] && RCODE[fmt][run]; return f ? f() : null; }
