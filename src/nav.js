// ===== 「どの分析を使えばいい？」ナビ =====
FORMATS.unshift({ id: 'nav', label: '分析ナビ', sub: 'どの分析を使う？', desc: '' });
state.nav = state.nav && Array.isArray(state.nav.path) ? state.nav : { path: [] };
const DB = (tab, run, label) => ({ fmt: 'db', tab, run, label: 'データベース型 → ' + label });
const NAV_Q = {
  start: { q: '何を知りたいですか？', o: [
    ['グループや条件のあいだに差があるか', '例：男女で得点が違うか、指導法で成績が違うか、事前と事後で変わったか', 'cmp_y'],
    ['変数どうしの関係', '例：ストレスと抑うつは関係があるか、何が成績を予測するか', 'rel'],
    ['影響のしくみ', '例：X が M を通して Y に影響するか（媒介）、効果の大きさが条件によって変わるか（調整）', 'mech'],
    ['たくさんの項目をまとめる・尺度を作る', '例：質問紙の因子構造、下位尺度の信頼性', 'items'],
    ['人をタイプ（グループ）に分ける', '例：回答のパターンから学習動機づけのタイプを見つける', 'types'],
    ['「はい／いいえ」の結果を予測する・検査の精度を調べる', '例：合格するかどうか、うつ病のスクリーニングのカットオフ', 'bin'],
    ['出来事が起こるまでの時間', '例：治療の中断・再発・離職までの期間を比べる', 'surv'],
    ['まずデータの様子を見たい', '平均・SD・分布・外れ値の確認', 'r_desc'],
    ['研究を始める前に、必要な人数を知りたい', '検定力分析（事前の計画）', 'r_power']] },
  cmp_y: { q: '比べたいもの（目的変数）は、どんなデータですか？', o: [
    ['数値（尺度得点・テストの点・反応時間など）', '平均を比べたいとき', 'cmp_fac'],
    ['順序のある評定、または大きく偏った数値', '1 つの 5 件法の項目、順位、外れ値が多いデータなど（中央値・順位で比べる）', 'np_k'],
    ['カテゴリ（はい／いいえ、選んだ選択肢）', '人数・割合を比べたいとき', 'r_chisq']] },
  cmp_fac: { q: 'グループを分ける要因（独立変数）はいくつですか？', o: [
    ['1 つ', '例：指導法（講義・討論・自習）だけ', 'cmp_k'],
    ['2 つ', '例：指導法 × 性別、群 × 時点', 'cmp_two'],
    ['1〜2 つ ＋ そろえたい数値の変数がある', '例：事前得点の違いをそろえて、指導法の効果を比べたい（共変量）', 'r_ancova']] },
  cmp_k: { q: 'グループ（条件）の数はいくつですか？', o: [['2 つ', '例：男性と女性、事前と事後', 'cmp_p2'], ['3 つ以上', '例：3 つの指導法、3 時点', 'cmp_pk']] },
  cmp_p2: { q: '同じ人を両方の条件で測りましたか？', o: [['いいえ（別々の人）', '対応なし：例 男性と女性、実験群と統制群', 'r_tind'], ['はい（同じ人）', '対応あり：例 同じ人の事前と事後、同じ人の 2 条件', 'r_tpair']] },
  cmp_pk: { q: '同じ人をすべての条件で測りましたか？', o: [['いいえ（別々の人）', '対応なし：例 3 つのクラスに別の指導法', 'r_anova1'], ['はい（同じ人）', '対応あり（反復測定）：例 同じ人を 3 時点で測定', 'r_rm1']] },
  cmp_two: { q: '2 つの要因のそれぞれについて、同じ人を測っていますか？', o: [
    ['どちらも別々の人', '例：指導法 × 性別（どの人も 1 つの組み合わせだけ）', 'r_anova2'],
    ['片方だけ同じ人', '例：群（実験・統制）× 時点（事前・事後）', 'r_mixed'],
    ['どちらも同じ人', '例：同じ人が「刺激の種類 × 提示時間」のすべての組み合わせに回答', 'r_within2']] },
  np_k: { q: 'グループ（条件）の数はいくつですか？', o: [['2 つ', '', 'np_p2'], ['3 つ以上', '', 'np_pk']] },
  np_p2: { q: '同じ人を両方の条件で測りましたか？', o: [['いいえ（別々の人）', '', 'r_mw'], ['はい（同じ人）', '', 'r_wil']] },
  np_pk: { q: '同じ人をすべての条件で測りましたか？', o: [['いいえ（別々の人）', '', 'r_kw'], ['はい（同じ人）', '', 'r_fried']] },
  rel: { q: 'どんな関係を調べたいですか？', o: [
    ['2 つの変数の関係の強さ', '例：ストレスと抑うつの相関', 'rel_pair'],
    ['1 つの結果を、いくつかの変数で説明・予測する', '例：成績を、勉強時間・動機づけ・不安で予測', 'rel_y'],
    ['潜在変数を含むモデル全体', '例：パス解析、因子どうしの因果モデル、確認的因子分析', 'r_sem'],
    ['分散分析と回帰分析の関係を学びたい', '一般線形モデル・一般化線形モデルの考え方', 'r_lmguide']] },
  rel_pair: { q: '2 つの変数は、どんなデータですか？', o: [
    ['両方とも数値', '例：尺度得点どうし', 'r_cor'],
    ['順序のある評定、または外れ値・偏りがある', '例：順位、1 つの 5 件法の項目', 'r_spear'],
    ['両方ともカテゴリ', '例：性別 × 部活動の有無', 'r_chisq'],
    ['片方がグループ（例：性別と得点）', 'これは「グループの差」の問題です', 'cmp_y']] },
  rel_y: { q: '説明・予測したい結果（目的変数）は？', o: [
    ['数値', '例：テストの点、尺度得点', 'rel_how'],
    ['2 値（はい／いいえ）', '例：合格・不合格、受診した・しない', 'r_logit'],
    ['出来事が起こるまでの時間', '例：離職までの期間', 'r_cox']] },
  rel_how: { q: '説明変数をどのように扱いたいですか？', o: [
    ['まとめて入れて、それぞれの影響を見る', '重回帰分析', 'r_mreg'],
    ['順番に入れて、追加した変数で説明力がどれだけ増えるかを見る', '例：属性を統制したうえで、心理変数の効果を見る', 'r_hreg'],
    ['ある変数の効果が、別の変数の値によって変わるかを見る', '交互作用（調整効果）', 'r_mod'],
    ['欠損が多く、できるだけ人を除かずに分析したい', '最尤法（FIML）', 'r_mlreg']] },
  mech: { q: 'どんなしくみを調べたいですか？', o: [
    ['X が M を通して Y に影響する', '間接効果（媒介）：例 ストレス → 反すう → 抑うつ', 'mech_m'],
    ['X の効果の大きさが、W によって変わる', '調整（交互作用）：例 ストレスの影響がサポートの多さで変わる', 'r_mod'],
    ['間接効果の大きさが、W によって変わる', '調整媒介：例 反すうを通した影響が、サポートの多い人では弱い', 'r_modmed']] },
  mech_m: { q: '間に入る変数（媒介変数）は？', o: [
    ['1 つ', 'X → M → Y', 'r_med'],
    ['2〜3 つが並列', 'それぞれが別々に X と Y の間に入る', 'r_med'],
    ['2〜3 つが順番につながる', 'X → M1 → M2 → Y', 'r_serial']] },
  items: { q: '何をしたいですか？', o: [
    ['項目の背後にある因子（下位尺度）を探す', '新しく作った尺度、構造がわからないとき', 'r_efa'],
    ['決まっている因子構造が当てはまるか確かめる', '先行研究の構造を、自分のデータで確認したいとき', 'r_cfa'],
    ['尺度・下位尺度の信頼性を調べる', 'α 係数・ω 係数', 'r_rel'],
    ['下位尺度得点を作る', '項目の平均・合計、逆転項目の処理', 'r_score'],
    ['評定者どうしの判断の一致を調べる', '例：2 人のコーダーの分類、3 人の採点者の得点', 'agree']] },
  agree: { q: '評定は、どんなデータですか？', o: [['カテゴリ（分類・コーディング）', '例：発言を「肯定・中立・否定」に分類、診断のあり・なし', 'r_kappa'], ['数値（得点・評価点）', '例：作文を 10 段階で採点、行動の頻度を数える', 'r_icc']] },
  types: { q: 'どのように分けたいですか？', o: [
    ['何タイプに分かれるかを探りたい（数百人まで）', 'デンドログラムで構造を見る', 'r_hclust'],
    ['タイプの数の見当がついている、または人数が多い', '', 'r_kmeans']] },
  bin: { q: '目的は？', o: [
    ['いくつかの要因が、結果の起こりやすさにどう影響するか', '例：不安・睡眠時間・性別が受診にどう関係するか', 'r_logit'],
    ['検査や尺度の得点で、結果をどれだけ見分けられるか', '例：スクリーニング尺度のカットオフと精度', 'r_roc']] },
  surv: { q: '目的は？', o: [['グループで比べる', '例：2 つの治療法で、中断までの期間が違うか', 'r_km'], ['複数の要因の影響を同時に調べる', '例：年齢・重症度・治療法がそれぞれ再発に与える影響', 'r_cox']] }
};
const NP_NOTE = '「同じ人」の判断に迷ったら、データの 1 行に同じ人の両方の値が並ぶかどうかで考えます（並ぶなら対応あり）。';
const NAV_R = {
  r_tind: { t: '独立な 2 群の t 検定（Welch の t 検定）', why: '別々の人からなる 2 つのグループの平均を比べます。等分散を仮定しない Welch の t 検定が標準です。', data: '1 行 1 人で「グループ」と「得点」の列（データベース型）、またはグループごとに列を分ける（独立多群型）。', where: [{ fmt: 'indep', run: 'two', label: '独立多群型 → 2群間の差の検定' }, DB('basic', 'cross', 'グラフ・集計 → 一括クロス集計（要因A = グループ）')], alt: '外れ値が多い・分布が大きく偏る・人数がとても少ないときは、Mann-Whitney の U 検定（同じボタンで一緒に出ます）。', es: 'Cohen の d', pw: 'tind', cat: '差' },
  r_tpair: { t: '対応のある t 検定', why: '同じ人の 2 つの条件（事前と事後など）の平均を比べます。一人ひとりの「差」に注目するので、個人差の影響を取り除けます。', data: '1 行 1 人で、2 つの条件の得点を 2 列に並べる（関連多群型）。', where: [{ fmt: 'paired', run: 'ptwo', label: '関連多群型 → 対応のある2群の検定' }], alt: '差の分布が大きく偏るときは、Wilcoxon の符号付き順位検定（同じボタンで一緒に出ます）。', es: 'Cohen の d_z（差の平均 ÷ 差の SD）', pw: 'tpair', cat: '差' },
  r_anova1: { t: '一元配置分散分析（対応なし）＋ 多重比較', why: '3 つ以上の別々のグループの平均を比べます。全体として差があれば、多重比較でどのグループの間に差があるかを調べます。', data: '1 行 1 人で「グループ」と「得点」の列。', where: [DB('anova', 'anova1', '分散分析 → 一元配置分散分析（対応なし）'), { fmt: 'indep', run: 'multi', label: '独立多群型 → 多群間の差の検定' }], alt: '分散が等しくないとき：Welch の分散分析と Games-Howell 法。分布が大きく偏るとき：Kruskal-Wallis 検定。', es: 'η²・ω²（検定力分析では f）', pw: 'anova1', cat: '差' },
  r_rm1: { t: '反復測定の分散分析（一元配置・対応あり）', why: '同じ人を 3 つ以上の条件・時点で測ったとき、その平均を比べます。球面性の仮定が崩れるときは Greenhouse-Geisser の補正を使います（自動で出ます）。', data: '1 行 1 人で、条件ごとの得点を列に並べる。', where: [DB('anova', 'rm1', '分散分析 → 一元配置分散分析（対応あり）'), { fmt: 'paired', run: 'rm', label: '関連多群型 → 反復測定の分散分析' }], alt: '分布が大きく偏るときは Friedman 検定（同じ結果に一緒に出ます）。', es: '偏 η²', cat: '差' },
  r_anova2: { t: '二元配置分散分析', why: '2 つの要因（例：指導法 × 性別）の効果と、その組み合わせの効果（交互作用）を同時に調べます。', data: '1 行 1 人で「要因A」「要因B」「得点」の列。', where: [DB('anova', 'anova2', '分散分析 → 二元配置分散分析')], alt: '交互作用が有意なら、単純主効果を調べます（結果に出ます）。人数がそろわないときはタイプ III の平方和を使います（標準）。', es: '偏 η²', cat: '差' },
  r_mixed: { t: '混合計画の分散分析', why: '片方の要因が別々の人（例：実験群・統制群）、もう片方が同じ人の繰り返し（例：事前・事後）のデザインです。「群 × 時点」の交互作用が、介入の効果を表すことが多いです。', data: '1 行 1 人で「群」の列と、時点ごとの得点の列。', where: [DB('anova', 'mixed', '分散分析 → 混合計画の分散分析')], alt: '人によって測定回数がそろわない・欠測が多いときは、R で線形混合モデル（lme4 パッケージ）を使うのが一般的です。', es: '偏 η²', cat: '差' },
  r_within2: { t: '2 要因とも対応ありの分散分析', why: '同じ人が 2 つの要因のすべての組み合わせに回答するデザインです。', data: '1 行 1 人で、組み合わせごとの得点を列に並べる。', where: [], alt: 'このアプリにはまだありません。R の afex パッケージ（aov_ez で within = c("A", "B")）か、線形混合モデルを使ってください。片方の要因について平均した値で、対応ありの一元配置分散分析を行うこともできます。', es: '偏 η²', cat: '差' },
  r_ancova: { t: '共分散分析（ANCOVA）', why: '事前得点などの共変量の影響を取り除いた（そろえた）うえで、グループの平均を比べます。結果の「調整済み平均」を比べるのがポイントです。', data: '1 行 1 人で「グループ」「得点」「共変量」の列。', where: [DB('anova', 'ancova', '分散分析 → 共分散分析（1要因）'), DB('anova', 'ancova2', '分散分析 → 二要因の共分散分析')], alt: '「回帰の傾きがグループで等しい」という前提を確認します（結果に出ます）。成り立たないときは、交互作用を含む回帰分析で調べます。', es: '偏 η²', cat: '差' },
  r_mw: { t: 'Mann-Whitney の U 検定', why: '別々の 2 グループを、値の順位で比べます。外れ値や分布の偏りに強い方法です。', data: '1 行 1 人で「グループ」と「値」の列、またはグループごとに列を分ける。', where: [{ fmt: 'indep', run: 'two', label: '独立多群型 → 2群間の差の検定（U 検定が一緒に出ます）' }, DB('basic', 'cross', 'グラフ・集計 → 一括クロス集計（検定を「ノンパラメトリック」に）')], alt: '数値でおおむね左右対称の分布なら、t 検定のほうが検出力が高くなります。', es: '効果量 r（＝ z ÷ √N）', cat: '差' },
  r_wil: { t: 'Wilcoxon の符号付き順位検定', why: '同じ人の 2 つの条件を、差の順位で比べます。', data: '1 行 1 人で、2 条件の値を 2 列に並べる。', where: [{ fmt: 'paired', run: 'ptwo', label: '関連多群型 → 対応のある2群の検定（Wilcoxon が一緒に出ます）' }], alt: '差がほぼ正規分布なら、対応のある t 検定。', es: '効果量 r', cat: '差' },
  r_kw: { t: 'Kruskal-Wallis 検定 ＋ 多重比較', why: '3 つ以上の別々のグループを、順位で比べます。全体で差があれば、Steel-Dwass 法などの多重比較を行います。', data: '1 行 1 人で「グループ」と「値」の列。', where: [{ fmt: 'indep', run: 'multi', label: '独立多群型 → 多群間の差の検定（Kruskal-Wallis が一緒に出ます）' }, DB('basic', 'cross', 'グラフ・集計 → 一括クロス集計（ノンパラメトリック）')], alt: '数値でおおむね正規分布なら、一元配置分散分析。', es: 'ε²', cat: '差' },
  r_fried: { t: 'Friedman 検定', why: '同じ人の 3 つ以上の条件を、順位で比べます。', data: '1 行 1 人で、条件ごとの値を列に並べる。', where: [{ fmt: 'paired', run: 'rm', label: '関連多群型 → 反復測定の分散分析（Friedman が一緒に出ます）' }], alt: '数値でおおむね正規分布なら、反復測定の分散分析。', es: 'Kendall の W', cat: '差' },
  r_chisq: { t: 'χ² 検定（クロス集計）', why: 'カテゴリどうしの関係（例：性別によって部活動の参加率が違うか）を、人数の偏りで調べます。有意なら、残差分析でどのセルが多い・少ないかを見ます。', data: '分割表型に人数を入れる、またはデータベース型で 1 行 1 人のカテゴリの列。', where: [{ fmt: 'table', run: 'chi', label: '分割表型 → 分割表の検定' }, DB('basic', 'cross', 'グラフ・集計 → 一括クロス集計')], alt: '期待度数が 5 未満のセルが多いとき（特に 2 × 2 表）は Fisher の正確検定（同じ結果に出ます）。同じ人を 2 回分類したとき（事前・事後の「はい／いいえ」）は McNemar 検定（R の mcnemar.test）。', es: 'φ・Cramér の V（検定力分析では w）', pw: 'chisq', cat: '差' },
  r_cor: { t: 'Pearson の相関係数', why: '2 つの数値の直線的な関係の強さと向きを、−1〜1 で表します。まず散布図で、直線的な関係か・外れ値がないかを確かめます。', data: '1 行 1 人で、2 つの変数を 2 列に並べる（2変量型）。データベース型では相関行列も出せます。', where: [{ fmt: 'bivar', run: 'cor', label: '2変量型 → 相関係数' }, { fmt: 'bivar', run: 'scatter', label: '2変量型 → 散布図' }], alt: '外れ値や曲線的な関係があるときは Spearman の順位相関（同じボタンで出ます）。ほかの変数の影響を除いた関係は偏相関・重回帰分析で。', es: 'r そのもの', pw: 'r', cat: '関係' },
  r_spear: { t: 'Spearman の順位相関係数', why: '値を順位に直してから相関を求めます。順序のある評定や、外れ値がある数値に向いています。', data: '1 行 1 人で、2 つの変数を 2 列に並べる。', where: [{ fmt: 'bivar', run: 'cor', label: '2変量型 → 相関係数（Spearman・Kendall が一緒に出ます）' }], alt: '両方とも数値で直線的な関係なら Pearson の相関。', es: 'ρ（ロー）', cat: '関係' },
  r_mreg: { t: '重回帰分析', why: '複数の説明変数で 1 つの結果を説明し、ほかの変数をそろえたときの各変数の影響（偏回帰係数・β）を調べます。', data: '1 行 1 人で、結果と説明変数の列。', where: [DB('reg', 'mreg', '回帰分析 → 重回帰分析')], alt: '残差の正規性・等分散性・多重共線性（VIF）を確認します（結果に診断が出ます）。結果が 2 値ならロジスティック回帰。', es: 'R²・f²、β', pw: 'reg', cat: '関係' },
  r_hreg: { t: '階層的重回帰分析', why: '説明変数をブロックごとに順番に入れ、追加したブロックで説明力（R²）がどれだけ増えるか（ΔR²）を調べます。「年齢や性別を統制しても、心理変数に効果があるか」を示すときによく使います。', data: '1 行 1 人で、結果と説明変数の列。', where: [DB('reg', 'hreg', '回帰分析 → 階層的重回帰分析')], alt: '交互作用項を最後のステップに入れると、調整効果の分析になります（中心化も自動）。', es: 'ΔR²・f²', pw: 'regd', cat: '関係' },
  r_mlreg: { t: '最尤法（FIML）による回帰分析', why: '欠損のある人を除かず、手元にあるすべての情報を使って回帰係数を推定します。欠損がランダムに近いときに、偏りの少ない推定ができます。', data: '1 行 1 人（欠損は空欄のまま）。', where: [DB('reg', 'mlreg', '回帰分析 → 最尤法による回帰分析')], alt: '欠損がごく少なければ、通常の重回帰分析（リストワイズ削除）でも結果はほぼ同じです。', es: 'R²', cat: '関係' },
  r_logit: { t: 'ロジスティック回帰分析', why: '「はい／いいえ」の結果が起こる確率が、説明変数によってどう変わるかを調べます。効果はオッズ比で表します。', data: '1 行 1 人で、2 値の結果と説明変数の列。', where: [DB('reg', 'logit', '回帰分析 → ロジスティック回帰')], alt: '説明変数が 1 つのカテゴリだけなら χ² 検定でも同じことを調べられます（一般化線形モデルのタブで、両者の関係を確かめられます）。', es: 'オッズ比', cat: '関係' },
  r_sem: { t: '構造方程式モデリング（SEM）', why: '潜在変数（因子）を含む複数の変数の関係を、1 つのモデルとして同時に推定し、モデルの当てはまり（CFI・RMSEA など）を評価します。', data: '1 行 1 人で、観測変数（項目・尺度得点）の列。', where: [DB('sem', 'sem', '構造方程式モデリング（AMOS 風の画面でパス図を描く）')], alt: '潜在変数がなく、観測変数どうしのパスだけなら、重回帰分析や媒介分析で足りることもあります。', es: '標準化係数・R²', cat: '関係' },
  r_lmguide: { t: '線形モデルで理解する（一般線形モデル・一般化線形モデル）', why: '分散分析・t 検定・共分散分析が「回帰分析」の一種であること、結果が 2 値や回数のときの一般化線形モデルを、実際のデータで確かめながら学べます。', data: '例のデータで試せます。', where: [DB('lmguide', 'lmAnova', '線形モデルで理解する')], alt: '', es: '', cat: '関係' },
  r_mod: { t: '調整分析（交互作用）', why: 'X の効果の大きさが、W（調整変数）の値によって変わるかを調べます。有意なら、単純傾斜（W が低い・高いときの X の効果）と Johnson-Neyman 法で、どこから効果があるかを示します。', data: '1 行 1 人で X・W・Y の列。', where: [DB('medmod', 'mod', '媒介・調整分析 → 調整分析（交互作用）')], alt: 'X と W を中心化して交互作用項を作ります（自動）。W がグループ（カテゴリ）なら、二元配置分散分析と同じ考え方です。', es: 'ΔR²（交互作用項）', cat: 'しくみ' },
  r_med: { t: '媒介分析（間接効果）', why: 'X が M を通して Y に影響する間接効果（a × b）を、ブートストラップ信頼区間で検定します。0 を含まなければ間接効果があると判断します。', data: '1 行 1 人で X・M・Y の列（M は 3 つまで並列に入れられます）。', where: [DB('medmod', 'med', '媒介・調整分析 → 媒介分析')], alt: '横断データでは因果の向きは決められません。「媒介」と言えるかは、研究デザインと理論にもとづいて慎重に解釈します。', es: '標準化間接効果', cat: 'しくみ' },
  r_serial: { t: '系列媒介分析', why: 'X → M1 → M2 → Y のように、媒介変数が順番につながる間接効果を調べます（PROCESS のモデル 6）。', data: '1 行 1 人で X・M1・M2（・M3）・Y の列。', where: [DB('medmod', 'serial', '媒介・調整分析 → 系列媒介分析')], alt: '媒介変数どうしに順序の理論的な根拠がなければ、並列の媒介分析を使います。', es: '各間接効果', cat: 'しくみ' },
  r_modmed: { t: '調整媒介分析', why: '間接効果の大きさが、W の値によって変わるか（調整された媒介）を調べます。調整媒介指標（index）の信頼区間で判断します（PROCESS のモデル 7・8・14）。', data: '1 行 1 人で X・M・W・Y の列。', where: [DB('medmod', 'modmed', '媒介・調整分析 → 調整媒介分析')], alt: 'W がどのパス（X → M か、M → Y か）を調整するかを、理論で決めてからモデルを選びます。', es: '調整媒介指標', cat: 'しくみ' },
  r_efa: { t: '探索的因子分析', why: '項目の背後にある共通因子を探し、どの項目がどの因子に属するか（下位尺度）を決めます。因子数は平行分析を参考にします。', data: '1 行 1 人で、項目の列。', where: [DB('fa', 'fa', '因子分析')], alt: '結果をもとに、負荷量の低い項目や複数の因子にまたがる項目を除いてやり直すことがあります（項目は左右のリストで選べます）。', es: '因子負荷量・寄与率', cat: '項目' },
  r_cfa: { t: '確認的因子分析（CFA）', why: '決めておいた因子構造（どの項目がどの因子に属するか）がデータに当てはまるかを、適合度指標（CFI・TLI・RMSEA・SRMR）で評価します。', data: '1 行 1 人で、項目の列。', where: [DB('sem', 'sem', '構造方程式モデリング（「因子分析から作る」で CFA のパス図を作れます）')], alt: '当てはまりが悪いときは、修正指標を参考にしますが、理論的に説明できない修正は避けます。', es: '標準化因子負荷量', cat: '項目' },
  r_rel: { t: '信頼性（α 係数・ω 係数）', why: '尺度の項目がどれだけ一貫して同じものを測っているかを表します。.70 以上が目安です。逆転項目は反転してから計算します。', data: '1 行 1 人で、項目の列。', where: [DB('fa', 'fa', '因子分析（下位尺度ごとの α・ω が自動で出ます）'), { fmt: 'paired', run: 'alpha', label: '関連多群型 → 信頼性分析（1 つの尺度の α・I-T 相関）' }], alt: 'α は項目の負荷量が等しいことを前提にします。ω もあわせて報告するのがおすすめです。', es: 'α・ω', cat: '項目' },
  r_score: { t: '下位尺度得点を作る', why: '下位尺度ごとに項目の平均（または合計）を求め、相関・t 検定・回帰などの分析に使います。', data: '1 行 1 人で、項目の列。', where: [{ fmt: 'db', view: 'prep', label: 'データベース型 → データの加工 → 尺度得点（因子分析の結果から一括でも作れます）' }], alt: '', es: '', cat: '項目' },
  r_kappa: { t: '評定者間一致：κ 係数', why: '評定者が同じ対象を同じカテゴリに分類した程度を、偶然の一致を差し引いて表します。2 人なら Cohen の κ、順序のあるカテゴリなら重みつき κ、3 人以上なら Fleiss の κ を使います。', data: '1 行 ＝ 評定される対象、1 列 ＝ 評定者（データベース型）。', where: [DB('agree', 'kappa', '評定者間一致 → κ 係数')], alt: '単純な一致率だけでは、カテゴリの偏りによる偶然の一致を区別できません。カテゴリがとても偏っているときは κ が低めに出ることがあるので、一致率も一緒に報告します。', es: 'κ（.61 以上で「かなりの一致」）', cat: '項目' },
  r_icc: { t: '評定者間一致：ICC（級内相関係数）', why: '数値の評定が評定者のあいだでどれだけ一致しているかを表します。モデル（一元・二元）、タイプ（絶対一致・一貫性）、単位（単一・平均）を目的に合わせて選びます。', data: '1 行 ＝ 評定される対象、1 列 ＝ 評定者（データベース型）。', where: [DB('agree', 'icc', '評定者間一致 → ICC')], alt: 'Pearson の相関は「一貫性」しか見ないため、評定者の甘い・辛いの違いを見逃します。評定者間一致には ICC を使います。', es: 'ICC（.75 以上で良好）', cat: '項目' },
  r_hclust: { t: '階層的クラスター分析', why: '似ている人どうしを 1 組ずつまとめていき、その過程をデンドログラムで示します。心理学では Ward 法 ＋ 平方ユークリッド距離（変数は標準化）が標準です。', data: '1 行 1 人で、分類に使う変数の列（尺度得点など）。', where: [DB('cluster', 'hclust', 'クラスター分析 → 階層的クラスター分析')], alt: '人数が多いときや、タイプの数の見当がついているときは k-means 法。結果は、分類に使っていない変数でクラスター間を比べて確かめます。', es: '平均シルエット', cat: 'タイプ' },
  r_kmeans: { t: 'k-means 法（非階層的クラスター分析）', why: 'クラスター数 k を決めて、各人を最も近い中心に割り当て直すことをくり返します。Ward 法の結果を初期値にする 2 段階法がよく使われます。', data: '1 行 1 人で、分類に使う変数の列。', where: [DB('cluster', 'kmeans', 'クラスター分析 → 非階層的（k-means 法）')], alt: 'k の決め方に迷うときは、階層的クラスター分析でまず構造を見ます。', es: '平均シルエット・群間平方和の割合', cat: 'タイプ' },
  r_roc: { t: 'ROC 分析', why: '検査や尺度の得点が、2 つの状態（例：うつ病あり・なし）をどれだけ見分けられるかを AUC で表し、最適なカットオフ（Youden 指数など）を求めます。', data: '1 行 1 人で「状態（2 値）」と「得点」の列。', where: [DB('roc', 'roc', 'ROC分析')], alt: '複数の検査を比べるときは、AUC の差の検定（DeLong 法）が一緒に出ます。', es: 'AUC・感度・特異度', cat: '2値' },
  r_km: { t: '生存曲線（Kaplan-Meier 法）とログランク検定', why: '出来事（中断・再発など）が起こるまでの時間を、途中で観察が終わった人（打ち切り）も含めて推定し、グループで比べます。', data: '1 行 1 人で「時間」「出来事が起きたか」「グループ」の列。', where: [DB('surv', 'km', '生存時間分析 → 生存曲線（Kaplan-Meier）')], alt: 'ほかの要因の影響も同時に調べたいときは Cox 回帰。', es: 'ハザード比', cat: '時間' },
  r_cox: { t: 'Cox 比例ハザード回帰', why: '複数の要因が、出来事の起こりやすさ（ハザード）にそれぞれどう影響するかを調べます。効果はハザード比で表します。', data: '1 行 1 人で「時間」「出来事」「説明変数」の列。', where: [DB('surv', 'cox', '生存時間分析 → Cox 比例ハザード回帰')], alt: '比例ハザード性（効果が時間によって変わらない）の確認が必要です（結果に出ます）。', es: 'ハザード比', cat: '時間' },
  r_desc: { t: '記述統計とグラフ', why: '分析の前に、平均・SD・分布の形・外れ値・欠損を確認します。どの検定を使うかの判断にも役立ちます。', data: 'どの形式のデータでも。', where: [DB('basic', 'graph', 'グラフ・集計 → かんたんグラフ'), { fmt: 'indep', run: 'desc', label: '独立多群型 → 基本統計量' }, { fmt: 'indep', run: 'box', label: '独立多群型 → 箱ひげ図＋点列図' }], alt: '', es: '', cat: '準備' },
  r_power: { t: '検定力分析（必要なサンプルサイズ）', why: '見つけたい効果の大きさ・有意水準・検定力から、研究に必要な人数を求めます。研究を始める前に行います。', data: 'データは必要ありません。', where: [{ fmt: 'power', label: '検定力分析' }], alt: '', es: '', cat: '準備' }
};
const NAV_CAT = [['差', 'グループ・条件の差'], ['関係', '変数どうしの関係'], ['しくみ', '影響のしくみ'], ['項目', '項目・尺度'], ['タイプ', '人のタイプ分け'], ['2値', '2値の予測・検査'], ['時間', '出来事までの時間'], ['準備', '準備・計画']];
const PW_NAME = { tind: '独立な 2 群の t 検定', tpair: '対応のある t 検定', anova1: '一元配置分散分析', r: '相関', reg: '重回帰分析', regd: '階層的重回帰分析', chisq: 'χ² 検定' };

function navNode(path) { let id = 'start'; for (const k of path) { const o = NAV_Q[id] && NAV_Q[id].o[k]; if (!o) break; id = o[2]; } return id; }
function renderNav() {
  const P = state.nav.path, id = navNode(P), trail = []; let cur = 'start';
  P.forEach((k, i) => { const n = NAV_Q[cur]; if (!n || !n.o[k]) return; trail.push(`<button class="btn" data-nav-back="${i}" style="padding:1px 8px" title="ここからやり直す">${esc(n.o[k][0])}</button>`); cur = n.o[k][2]; });
  let h = `<div class="pp-box"><div class="pp-row" style="justify-content:space-between"><b style="font-size:14px">どの分析を使えばいい？</b>${P.length ? '<button class="btn" data-nav-reset style="padding:1px 8px">最初から</button>' : ''}</div>${trail.length ? `<div class="pp-row" style="gap:4px">${trail.join('<span class="hint">›</span>')}</div>` : '<p class="hint" style="margin:4px 0">質問に答えていくと、ぴったりの分析と、このアプリのどこで行うかを案内します。右の「分析の地図」から直接選ぶこともできます。</p>'}</div>`;
  if (NAV_Q[id]) {
    const n = NAV_Q[id];
    h += `<div class="pp-box"><div style="font-size:15px;font-weight:700;margin-bottom:8px">${esc(n.q)}</div><div class="navopts">${n.o.map((o, k) => `<button class="navopt" data-nav-go="${k}"><b>${esc(o[0])}</b>${o[1] ? `<span>${esc(o[1])}</span>` : ''}</button>`).join('')}</div>${/p2|pk/.test(id) ? `<p class="hint" style="margin:8px 0 0">${NP_NOTE}</p>` : ''}${id === 'cmp_y' ? '<p class="hint" style="margin:8px 0 0">尺度得点（複数の項目の平均・合計）は、ふつう「数値」として扱います。1 つの項目の 5 件法の回答は「順序」として扱うのが慎重な方法です。</p>' : ''}</div>`;
  } else h += navResult(id);
  $('#sheetBody').innerHTML = h;
}
function navResult(id) {
  const R = NAV_R[id]; if (!R) return '<p class="hint">該当する分析が見つかりませんでした。「最初から」やり直してください。</p>';
  return `<div class="pp-box navres"><div class="hint">おすすめの分析</div><div style="font-size:17px;font-weight:700;margin:2px 0 8px">${esc(R.t)}</div>
    <p style="margin:0 0 8px">${esc(R.why)}</p>
    ${table(['', ''], [['データの形', esc(R.data)], ...(R.es ? [['効果量', esc(R.es)]] : []), ...(R.alt ? [['前提が崩れるとき・ほかの選択肢', esc(R.alt)]] : [])])}
    ${R.where.length ? `<div style="margin-top:10px"><b>このアプリで行うには</b></div>${R.where.map((w, k) => `<div class="pp-row"><button class="btn primary" data-nav-open="${id}|${k}">この分析へ移動</button><span>${esc(w.label)}</span></div>`).join('')}` : '<p class="pp-msg err" style="margin-top:8px">この分析は、このアプリにはまだありません（上の「ほかの選択肢」を参照）。</p>'}
    ${R.pw ? `<div class="pp-row" style="margin-top:6px"><button class="btn" data-nav-power="${R.pw}">この分析の検定力分析（必要な人数）</button><span class="hint">${esc(PW_NAME[R.pw] || '')}として計算します</span></div>` : ''}
    <p class="hint" style="margin:8px 0 0">移動すると、分析のボタンが光ります。先にデータを入れる（またはファイルを開く）必要があります。迷ったら「例のデータ」で試してみましょう。</p></div>`;
}
function renderNavPanel() {
  $('#panelBody').innerHTML = `<p class="hint">分析の地図：目的ごとの分析の一覧です。名前を押すと、その分析の説明が左に出ます。</p>` + NAV_CAT.map(([c, l]) => `<h4 style="margin:10px 0 4px">${l}</h4><div class="navmap">${Object.entries(NAV_R).filter(([, r]) => r.cat === c).map(([k, r]) => `<button class="btn" data-nav-res="${k}">${esc(r.t.replace(/（.*?）/g, ''))}</button>`).join('')}</div>`).join('') + '<div class="msg" id="msg"></div>';
}
function navOpen(w) {
  state.fmt = w.fmt; if (w.fmt === 'db') { if (w.tab) state.opt.dbTab = w.tab; state.opt.dbView = w.view || 'data'; if (w.view === 'prep' && typeof PREP !== 'undefined') PREP.sec = 'score'; }
  save(); renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' });
  if (w.run) setTimeout(() => { const b = document.querySelector(`#panelBody [data-run="${w.run}"]`); if (b) { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); b.classList.add('navpulse'); setTimeout(() => b.classList.remove('navpulse'), 4200); } }, 80);
}
(() => { const st = document.createElement('style'); st.textContent = `
.navopts { display:grid; grid-template-columns:1fr; gap:8px; } .navopt { text-align:left; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--sheet); color:var(--fg); cursor:pointer; font:inherit; }
.navopt:hover { border-color:var(--accent); background:var(--accent-soft); } .navopt b { display:block; font-size:13.5px; } .navopt span { display:block; color:var(--muted); font-size:12px; margin-top:2px; }
.navmap { display:flex; flex-wrap:wrap; gap:4px; } .navmap .btn { font-size:12px; padding:2px 8px; }
.navres table.out td, .navres table.out th { white-space:normal !important; text-align:left !important; font-family:inherit !important; vertical-align:top; line-height:1.55; } .navres table.out td:first-child { white-space:nowrap !important; font-weight:600; width:9em; } .navres table.out thead { display:none; }
@keyframes navpulse { 0%,100% { box-shadow:0 0 0 0 rgba(0,0,0,0); } 50% { box-shadow:0 0 0 4px var(--sig); } } .navpulse { animation:navpulse 1s ease-in-out 4; }`; document.head.appendChild(st); })();
{ const rs0 = renderSheet; renderSheet = function () { if (state.fmt === 'nav') { $('#sheetTitle').textContent = '分析ナビ'; renderNav(); return; } return rs0.apply(this, arguments); }; }
{ const rp0 = renderPanel; renderPanel = function () { if (state.fmt === 'nav') { renderNavPanel(); return; } return rp0.apply(this, arguments); }; }
document.addEventListener('click', e => {
  if (state.fmt !== 'nav') return; const t = e.target.closest('[data-nav-go],[data-nav-back],[data-nav-reset],[data-nav-open],[data-nav-power],[data-nav-res]'); if (!t) return;
  const P = state.nav.path;
  if (t.dataset.navGo != null) P.push(+t.dataset.navGo);
  else if (t.dataset.navBack != null) state.nav.path = P.slice(0, +t.dataset.navBack);
  else if (t.dataset.navReset != null) state.nav.path = [];
  else if (t.dataset.navRes != null) { state.nav.path = []; state.nav.direct = t.dataset.navRes; save(); $('#sheetBody').innerHTML = `<div class="pp-box"><div class="pp-row" style="justify-content:space-between"><b style="font-size:14px">どの分析を使えばいい？</b><button class="btn" data-nav-reset style="padding:1px 8px">質問に答えて選ぶ</button></div></div>` + navResult(t.dataset.navRes); return; }
  else if (t.dataset.navOpen != null) { const [id, k] = t.dataset.navOpen.split('|'); navOpen(NAV_R[id].where[+k]); return; }
  else if (t.dataset.navPower != null) { state.pow.test = t.dataset.navPower; state.pow.es = PW_TESTS[state.pow.test].bm[1]; navOpen({ fmt: 'power' }); return; }
  save(); renderNav();
});
