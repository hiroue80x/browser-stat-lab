// ===== はじめの設定：①データを読み込む → ②結果を保存するフォルダ → ③ R の作業フォルダ を順番に案内する =====
const SETUP_KEY = 'statlab-v1-setup';
const setupCfg = (() => { try { return JSON.parse(localStorage.getItem(SETUP_KEY)) || {}; } catch (e) { return {}; } })();
const setupSave = () => { try { localStorage.setItem(SETUP_KEY, JSON.stringify(setupCfg)); } catch (e) { } };
const SU = { step: 0, msg: '' };
function setupHasData() { return state.db && state.db.rows && state.db.rows.some(r => r.some(v => String(v ?? '').trim() !== '')) && !!(state.db.file || setupCfg.sample); }
function setupStatus() {
  const fs = recOK();
  return [
    { done: setupHasData(), skip: false },
    { done: !!REC.dir, skip: !fs || !!setupCfg.skipRec },
    { done: !!RLINK.dir, skip: !fs || !!setupCfg.skipR }
  ];
}
function setupFirstOpen() { const st = setupStatus(); const i = st.findIndex(s => !s.done && !s.skip); return i < 0 ? 3 : i; }
function setupOpen(step) {
  document.getElementById('setupDlg')?.remove();
  SU.step = step == null ? setupFirstOpen() : step; SU.msg = '';
  document.body.insertAdjacentHTML('beforeend', '<div class="setupdlg" id="setupDlg" role="dialog" aria-modal="true" aria-label="はじめの設定"><div class="setupbox" id="setupBox"></div></div>');
  setupRender();
}
function setupClose() { document.getElementById('setupDlg')?.remove(); }
function setupRender() {
  const box = document.getElementById('setupBox'); if (!box) return;
  const st = setupStatus(), fs = recOK(), s = SU.step;
  const labels = ['データを読み込む', '結果を保存するフォルダ', 'R の作業フォルダ'];
  const mark = (i) => st[i].done ? '<span class="sumark ok">✓</span>' : st[i].skip ? '<span class="sumark skip">−</span>' : `<span class="sumark">${i + 1}</span>`;
  const steps = `<ol class="susteps">${labels.map((l, i) => `<li class="${i === s ? 'cur' : ''}${st[i].done ? ' done' : ''}"><button data-su="go" data-i="${i}">${mark(i)}<span>${l}</span></button></li>`).join('')}</ol>`;
  const noFs = `<p class="warn">このブラウザ（またはこの画面）ではフォルダを選べません。ダウンロードした「ブラウザ統計ラボ.html」を <b>Chrome か Edge で直接開く</b>と設定できます。この手順は飛ばして先へ進めます。</p>`;
  let body = '';
  if (s === 0) body = `<h3>① 分析するデータを読み込みます</h3>
    <p>Excel（.xlsx）・CSV・SPSS（.sav）のファイルを選びます。1 行が 1 人、1 列が 1 つの項目（変数）になっている表です。いちばん上の行は項目名にしてください。</p>
    <div class="sufig"><table><tr><th>ID</th><th>性別</th><th>Q1</th><th>Q2</th><th>…</th></tr><tr><td>1</td><td>1</td><td>4</td><td>3</td><td>…</td></tr><tr><td>2</td><td>2</td><td>5</td><td>2</td><td>…</td></tr></table><span>← 1 行目が項目名、2 行目から 1 人 1 行</span></div>
    <div class="suact"><button class="btn primary" data-su="file">ファイルを選ぶ（Excel・CSV・SPSS）</button><input type="file" id="suFile" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.sav,.zsav,.xls" multiple hidden><button class="btn" data-su="sample">まず練習用のデータで試す</button></div>
    ${st[0].done ? `<p class="suok">✓ 読み込み済み：${esc(state.db.file || '練習用のデータ')}（${state.db.rows.length} 行 × ${state.db.cols.length} 列）</p>` : ''}
    <p class="hint">読み込んだあと、「変数ビュー」で項目の内容（ラベル）や型（数値・文字・日付）を確かめられます。</p>`;
  if (s === 1) body = `<h3>② 結果を保存するフォルダを決めます</h3>
    <p>解析を実行するたびに、<b>出力・その時のデータ・R スクリプト</b>をこのフォルダに自動で保存し、<b>解析記録一覧.html</b> を作ります。あとから「どのデータで、何を、どう分析したか」をたどれます。</p>
    <div class="sufig tree">研究フォルダ（例：FMS研究）/<br>　├ データ/ ……… 元のデータ<br>　├ <b>結果/</b> ……… ← ここを選ぶ<br>　└ R/ ……………… ③で選ぶ</div>
    ${fs ? `<label class="surow">研究名（記録のファイル名の先頭につきます）<input id="suStudy" value="${esc(recCfg.study || '')}" placeholder="例：FMS研究"></label>
    <div class="suact"><button class="btn primary" data-su="rec">${REC.dir ? 'フォルダを変える' : '保存するフォルダを選ぶ'}</button>${st[1].done ? '' : '<button class="btn" data-su="skiprec">今はしない</button>'}</div>
    ${st[1].done ? `<p class="suok">✓ 保存先：「${esc(REC.name)}」${recCfg.on ? '（自動記録：オン）' : '（自動記録：オフ）'}</p>` : ''}` : noFs}
    <p class="hint">新しいフォルダを作るときは、フォルダを選ぶ画面の「新規フォルダ」を使います。</p>`;
  if (s === 2) body = `<h3>③ R の作業フォルダを決めます</h3>
    <p>「RStudio 用に書き出す」を押したとき、データ（data.csv）・読み込み用の R・分析ごとの R スクリプト・RStudio のプロジェクトファイルをこのフォルダに書き出します。アプリと同じ分析を R で確かめられます。</p>
    <div class="sufig tree">研究フォルダ（例：FMS研究）/<br>　├ データ/<br>　├ 結果/ ……… ②で選んだフォルダ<br>　└ <b>R/</b> ……………… ← ここを選ぶ</div>
    ${fs ? `<div class="suact"><button class="btn primary" data-su="r">${RLINK.dir ? 'フォルダを変える' : 'R の作業フォルダを選ぶ'}</button>${st[2].done ? '' : '<button class="btn" data-su="skipr">今はしない（R は使わない）</button>'}</div>
    ${st[2].done ? `<p class="suok">✓ R の作業フォルダ：「${esc(RLINK.name)}」</p>` : ''}` : noFs}
    <p class="hint">②と同じフォルダは選ばないでください（R のファイルと記録がまざります）。</p>`;
  if (s === 3) body = `<h3>設定ができました</h3>
    <ul class="sudone">${labels.map((l, i) => `<li>${mark(i)} ${l}：${i === 0 ? (st[0].done ? esc(state.db.file || '練習用のデータ') : '未設定') : i === 1 ? (st[1].done ? '「' + esc(REC.name) + '」' : st[1].skip ? '設定しない' : '未設定') : (st[2].done ? '「' + esc(RLINK.name) + '」' : st[2].skip ? '設定しない' : '未設定')}</li>`).join('')}</ul>
    <p>次は、左の「データベース型」で、上の分析のタブ（基本統計・t 検定・因子分析 など）を選び、変数を入れて実行します。迷ったら「どの分析を使えばいい？」の案内を使ってください。</p>
    <p class="hint">この設定は、画面の上の「はじめの設定」からいつでもやり直せます。</p>`;
  const done = st.filter(x => x.done || x.skip).length;
  box.innerHTML = `<div class="suhead"><b>はじめの設定</b><span class="hint">${done} / 3 完了</span><button class="btn" data-su="close" aria-label="閉じる">×</button></div>
    <div class="suprog"><i style="width:${done / 3 * 100}%"></i></div>${steps}<div class="subody">${body}</div>
    ${SU.msg ? `<p class="sumsg">${esc(SU.msg)}</p>` : ''}
    <div class="sufoot">${s > 0 ? '<button class="btn" data-su="prev">← 戻る</button>' : ''}<span style="flex:1"></span>${s < 3 ? `<button class="btn" data-su="later">あとで設定する</button><button class="btn ${st[s].done || st[s].skip ? 'primary' : ''}" data-su="next">${st[s].done || st[s].skip ? '次へ →' : 'とばして次へ →'}</button>` : '<button class="btn primary" data-su="finish">はじめる</button>'}</div>`;
}
document.addEventListener('click', async e => {
  if (e.target.closest('#setupBtn')) { setupOpen(); return; }
  const b = e.target.closest('[data-su]'); if (!b) return; const a = b.dataset.su;
  if (a === 'close' || a === 'later') { setupCfg.seen = true; setupSave(); setupClose(); return; }
  if (a === 'finish') { setupCfg.seen = true; setupCfg.done = true; setupSave(); setupClose(); return; }
  if (a === 'go') { SU.step = +b.dataset.i; SU.msg = ''; setupRender(); return; }
  if (a === 'next') { SU.step = Math.min(3, SU.step + 1); SU.msg = ''; setupRender(); return; }
  if (a === 'prev') { SU.step = Math.max(0, SU.step - 1); SU.msg = ''; setupRender(); return; }
  if (a === 'file') { document.getElementById('suFile').click(); return; }
  if (a === 'sample') { if (state.fmt !== 'db') { state.fmt = 'db'; save(); renderAll(); } state.db = makeScaleSample(); if (!state.db.semModel) state.db.semModel = emptySemModel(); state.opt.dbTab = 'fa'; setupCfg.sample = true; setupSave(); save(); renderAll(); SU.msg = '練習用のデータ（尺度データ）を読み込みました。'; setupRender(); return; }
  if (a === 'rec') { if (await recPick()) { recCfg.on = true; recCfgSave(); recUi(); SU.msg = `結果の保存先を「${REC.name}」にしました。解析のたびに自動で記録します。`; } setupRender(); return; }
  if (a === 'r') { if (await rlinkPick()) SU.msg = `R の作業フォルダを「${RLINK.name}」にしました。`; setupRender(); return; }
  if (a === 'skiprec') { setupCfg.skipRec = true; setupSave(); SU.step = 2; setupRender(); return; }
  if (a === 'skipr') { setupCfg.skipR = true; setupSave(); SU.step = 3; setupRender(); return; }
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'suFile' || !e.target.files.length) return;
  const files = [...e.target.files]; e.target.value = '';
  if (state.fmt !== 'db') { state.fmt = 'db'; save(); renderAll(); }
  const dlg = document.getElementById('setupDlg'); if (dlg) dlg.hidden = true; // 「置き換えますか？」の確認がデータシートに出るので、いったん隠す
  try { await importFiles(files); } catch (err) { }
  if (dlg) dlg.hidden = false;
  if (state.db.file) { setupCfg.sample = false; setupSave(); SU.msg = `「${state.db.file}」を読み込みました。`; } else SU.msg = '読み込めませんでした。データシートの上のメッセージを確かめてください。';
  setupRender();
});
document.addEventListener('input', e => { if (e.target.id === 'suStudy') { recCfg.study = e.target.value; recCfgSave(); } });
// 「はじめの設定」ボタンと、初めて開いたときの表示
document.querySelector('header.top')?.insertAdjacentHTML('beforeend', '<button class="btn setupbtn" id="setupBtn" title="データの読み込み・結果の保存先・R の作業フォルダを順番に設定します">はじめの設定</button>');
setTimeout(async () => { await Promise.all([recRestore(), rlinkRestore()]); if (!setupCfg.seen) setupOpen(); }, 300);
