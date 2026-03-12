import { useState, useEffect } from 'react';
import { BarChart3, Check, X as XIcon, Minus, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api.js';
import { esc, reportGrad, officialFilmForRow, REPORT_GRADS } from '../utils/compareReport.js';

// ── Export helpers ────────────────────────────────────────────────────────────

function getCompareRows(result) {
  return result.mode === 'users'
    ? [...(result.matches || []), ...(result.diffs || [])]
    : (result.results || []);
}

function exportCSV(result, filmById) {
  const leftLabel = result.mode === 'users' ? result.leftUser : result.compareUser;
  const rightLabel = result.mode === 'users' ? result.rightUser : 'Resultado Oficial';
  const rows = [['Categoria', leftLabel, rightLabel, 'Resultado']];

  for (const row of getCompareRows(result)) {
    const leftFilm = result.mode === 'users' ? filmById(row.filmId || row.leftFilmId) : filmById(row.predictedFilmId);
    const rightFilm = result.mode === 'users' ? filmById(row.filmId || row.rightFilmId) : filmById(row.officialFilmId);
    const status = result.mode === 'users'
      ? (row.leftFilmId && row.rightFilmId && row.leftFilmId === row.rightFilmId ? 'Igual' : 'Diferente')
      : (row.isCorrect ? 'Acerto' : row.officialFilmId ? 'Erro' : 'Pendente');
    rows.push([row.categoryName, leftFilm?.title || '—', rightFilm?.title || '—', status]);
  }

  const bom = '\uFEFF';
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparacao_${leftLabel}_vs_${rightLabel}_${new Date().toISOString().slice(0, 10)}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
  a.click();
  URL.revokeObjectURL(url);
}

// ── Visual Report Generator ───────────────────────────────────────────────

function openVisualReport(result, filmById, officialResults = {}, categories = []) {
  const isUsers = result.mode === 'users';
  const rows = isUsers
    ? [...(result.matches || []), ...(result.diffs || [])]
    : (result.results || []);
  const leftLabel = isUsers ? result.leftUser : result.compareUser;
  const rightLabel = isUsers ? result.rightUser : 'Resultado Oficial';
  const rightIsOfficial = !isUsers;

  // Check if any official results exist (for users mode → adds 3rd column)
  const hasOfficialCol = isUsers
    ? rows.some(r => officialFilmForRow(r.categoryId, officialResults, categories, filmById))
    : false;

  // Compute per-user accuracy when official col is available
  let leftScore = 0, rightScore = 0, revealedCount = 0;
  if (hasOfficialCol) {
    for (const row of rows) {
      const of = officialFilmForRow(row.categoryId, officialResults, categories, filmById);
      if (!of) continue;
      revealedCount++;
      if (filmById(row.leftFilmId || row.filmId)?.id === of.id) leftScore++;
      if (filmById(row.rightFilmId || row.filmId)?.id === of.id) rightScore++;
    }
  }

  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Grid columns
  let grid, thead;
  if (!isUsers) {
    grid = '2fr 1.8fr 1.8fr 22px';
    thead = `<span>Categoria</span><span>${esc(leftLabel)}</span><span>Resultado Oficial</span><span></span>`;
  } else if (hasOfficialCol) {
    grid = '2fr 1.7fr 1.7fr 1.7fr';
    thead = `<span>Categoria</span><span>${esc(leftLabel)}</span><span>${esc(rightLabel)}</span><span>🏆 Oficial</span>`;
  } else {
    grid = '2fr 1.8fr 1.8fr';
    thead = `<span>Categoria</span><span>${esc(leftLabel)}</span><span>${esc(rightLabel)}</span>`;
  }

  // Build row HTML
  const rowsHtml = rows.map(row => {
    let cls = '', cols = '';
    if (!isUsers) {
      const lf = filmById(row.predictedFilmId);
      const rf = filmById(row.officialFilmId);
      if (row.isCorrect) cls = 'rm';
      else if (row.officialFilmId) cls = 'rd';
      const icon = row.isCorrect ? '<span class="ic ok">✓</span>' : row.officialFilmId ? '<span class="ic ko">✗</span>' : '<span class="ic nd">–</span>';
      cols = `<span class="cc">${esc(row.categoryName)}</span>
        <span class="fc ${row.isCorrect ? 'ok' : ''}">${lf ? esc(lf.title) : row.predictedFilmId ? '…' : '<i>sem palpite</i>'}</span>
        <span class="fc gold">${rf ? esc(rf.title) : row.officialFilmId ? '…' : '<i>aguardando</i>'}</span>
        ${icon}`;
    } else {
      const lf = filmById(row.leftFilmId || row.filmId);
      const rf = filmById(row.rightFilmId || row.filmId);
      const isMatch = row.leftFilmId && row.rightFilmId ? row.leftFilmId === row.rightFilmId : !!row.filmId;
      cls = isMatch ? 'rm' : 'rd';
      if (hasOfficialCol) {
        const of = officialFilmForRow(row.categoryId, officialResults, categories, filmById);
        const lw = lf && of && lf.id === of.id;
        const rw = rf && of && rf.id === of.id;
        cols = `<span class="cc">${esc(row.categoryName)}</span>
          <span class="fc ${lw ? 'ok' : ''}">${lf ? esc(lf.title) : '<i>sem palpite</i>'}</span>
          <span class="fc ${rw ? 'ok' : ''}">${rf ? esc(rf.title) : '<i>sem palpite</i>'}</span>
          <span class="fc gold">${of ? esc(of.title) : (officialResults?.[row.categoryId] ? '…' : '<i>aguardando</i>')}</span>`;
      } else {
        cols = `<span class="cc">${esc(row.categoryName)}</span>
          <span class="fc ${isMatch ? 'ok' : ''}">${lf ? esc(lf.title) : '<i>sem palpite</i>'}</span>
          <span class="fc ${isMatch ? 'ok' : ''}">${rf ? esc(rf.title) : '<i>sem palpite</i>'}</span>`;
      }
    }
    return `<div class="tr ${cls}" style="grid-template-columns:${grid}">${cols}</div>`;
  }).join('');

  // Stats
  let statsHtml;
  if (!isUsers) {
    const pct = result.comparableCategories > 0
      ? Math.round((result.correctCount / result.comparableCategories) * 100) + '%' : '—';
    statsHtml = `
      <div class="st"><div class="sv">${result.totalCategories}</div><div class="sl">Categorias</div></div>
      <div class="st"><div class="sv grn">${result.correctCount}</div><div class="sl">Acertos</div></div>
      <div class="st"><div class="sv gld">${pct}</div><div class="sl">Aproveitamento</div></div>`;
  } else if (hasOfficialCol) {
    statsHtml = `
      <div class="st"><div class="sv">${result.totalCategories}</div><div class="sl">Categorias</div></div>
      <div class="st"><div class="sv grn">${result.matchesCount}</div><div class="sl">Iguais</div></div>
      <div class="st"><div class="sv gld">${leftScore}/${revealedCount}</div><div class="sl">${esc(leftLabel)}</div></div>
      <div class="st"><div class="sv gld">${rightScore}/${revealedCount}</div><div class="sl">${esc(rightLabel)}</div></div>`;
  } else {
    statsHtml = `
      <div class="st"><div class="sv">${result.totalCategories}</div><div class="sl">Categorias</div></div>
      <div class="st"><div class="sv grn">${result.matchesCount}</div><div class="sl">Iguais</div></div>
      <div class="st"><div class="sv">${result.comparedCategories}</div><div class="sl">Comparáveis</div></div>`;
  }

  // Avatar section
  const lg = reportGrad(leftLabel);
  const rg = rightIsOfficial ? 'linear-gradient(135deg,#d4af37,#b8860b)' : reportGrad(rightLabel);
  const li = leftLabel.charAt(0).toUpperCase();
  const ri = rightIsOfficial ? '🏆' : rightLabel.charAt(0).toUpperCase();

  let lScore = '', rScore = '';
  if (!isUsers) {
    lScore = `<div class="usc">${result.correctCount}<span class="usd">/${result.comparableCategories > 0 ? result.comparableCategories : '?'}</span></div><div class="usl">acertos</div>`;
  } else if (hasOfficialCol) {
    lScore = `<div class="usc">${leftScore}<span class="usd">/${revealedCount}</span></div><div class="usl">acertos</div>`;
    rScore = `<div class="usc">${rightScore}<span class="usd">/${revealedCount}</span></div><div class="usl">acertos</div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Oscar Watchlist — ${esc(leftLabel)} vs ${esc(rightLabel)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#07070f;color:#e0e0f0;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;padding:20px;min-height:100vh;gap:14px}
.ctrls{display:flex;gap:10px}
.btn{padding:9px 22px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:600}
.btn-g{background:linear-gradient(135deg,#d4af37,#b8860b);color:#0a0a0f}
.btn-q{background:#141422;color:#70709a;border:1px solid #222234}
.card{width:660px;background:linear-gradient(170deg,#0e0e1c,#09091300);border:1px solid rgba(212,175,55,.16);border-radius:20px;overflow:hidden;box-shadow:0 0 80px rgba(212,175,55,.05),0 24px 64px rgba(0,0,0,.75)}
.hdr{background:linear-gradient(135deg,#100a00,#1c1200,#100a00);padding:28px 28px 20px;text-align:center;border-bottom:1px solid rgba(212,175,55,.1);position:relative}
.hdr::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:200px;height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent)}
.trp{font-size:40px;display:block;margin-bottom:8px;filter:drop-shadow(0 0 14px rgba(212,175,55,.4))}
.ht{font-size:17px;font-weight:700;background:linear-gradient(135deg,#f0d060,#d4af37,#b0800a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px}
.hs{font-size:10px;color:#5a4a22;letter-spacing:2px;text-transform:uppercase}
.vs{display:flex;align-items:center;gap:10px;padding:18px 22px 12px}
.ub{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;padding:14px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px}
.av{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#fff;border:2px solid rgba(255,255,255,.18);box-shadow:0 4px 14px rgba(0,0,0,.35);flex-shrink:0}
.un{font-size:12px;font-weight:600;color:#b0b0c8;text-align:center;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.usc{font-size:22px;font-weight:800;background:linear-gradient(135deg,#f0d060,#d4af37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.usd{font-size:12px;-webkit-text-fill-color:#4a3c18}
.usl{font-size:8px;color:#3a3a50;text-transform:uppercase;letter-spacing:1px}
.vb{width:36px;height:36px;border-radius:50%;background:#0e0e1a;border:1px solid #1e1e30;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#303040;letter-spacing:1px;flex-shrink:0}
.sts{display:flex;gap:6px;padding:0 18px 14px}
.st{flex:1;padding:10px 6px;background:#0e0e18;border:1px solid #1a1a28;border-radius:9px;text-align:center}
.sv{font-size:19px;font-weight:800;color:#d0d0e8;line-height:1;margin-bottom:3px}
.sv.grn{color:#4ade80}.sv.gld{background:linear-gradient(135deg,#f0d060,#d4af37);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sl{font-size:8px;color:#303040;text-transform:uppercase;letter-spacing:1px}
.tbl{padding:0 12px 12px}
.th{display:grid;padding:6px 10px;gap:6px;margin-bottom:2px}
.th span{font-size:8px;font-weight:700;color:#282838;text-transform:uppercase;letter-spacing:1px}
.tr{display:grid;padding:9px 10px;gap:6px;margin-bottom:2px;border-radius:7px;border-left:2px solid transparent}
.tr:nth-child(odd){background:rgba(255,255,255,.01)}
.rm{background:rgba(74,222,128,.04)!important;border-left-color:rgba(74,222,128,.22)}
.rd{background:rgba(248,113,113,.03)!important;border-left-color:rgba(248,113,113,.15)}
.cc{font-size:9px;font-weight:600;color:#404052;text-transform:uppercase;letter-spacing:.5px;padding-top:1px;line-height:1.4}
.fc{font-size:12px;color:#707088;line-height:1.35}
.fc.ok{color:#4ade80;font-weight:600}
.fc.gold{background:linear-gradient(135deg,#f0d060,#c09020);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:600}
.fc i{color:#2a2a38;font-style:italic}
.ic{font-size:13px;text-align:center;padding-top:1px}
.ic.ok{color:#4ade80}.ic.ko{color:#f87171}.ic.nd{color:#333340}
.ft{padding:12px 18px;background:#060610;border-top:1px solid rgba(255,255,255,.04);text-align:center}
.ft p{font-size:9px;color:#1e1e28;letter-spacing:1px;text-transform:uppercase}
.ft span{color:#2e2e40}
@media print{
  body{background:#fff;padding:0;gap:0}.ctrls{display:none}
  .card{box-shadow:none;border:none;border-radius:0;width:100%;max-width:660px;margin:0 auto;background:#fff}
  .hdr{background:#f7f4ee!important;border-bottom:2px solid #d4af37}.ht{-webkit-text-fill-color:#9a6c00!important}
  .hs{color:#888!important}.trp{filter:none}
  .ub{background:#f5f5f5!important;border-color:#e0e0e0!important}
  .un{color:#333!important}.usc{-webkit-text-fill-color:#9a6c00!important}.usd{-webkit-text-fill-color:#888!important}
  .vb{background:#eee!important;border-color:#ccc!important;color:#999!important}
  .st{background:#f5f5f5!important;border-color:#e8e8e8!important}.sv{color:#111!important}
  .sv.grn{color:#15803d!important}.sv.gld{-webkit-text-fill-color:#9a6c00!important}
  .sl{color:#888!important}.cc{color:#666!important}.fc{color:#333!important}
  .fc.ok{color:#15803d!important}.fc.gold{-webkit-text-fill-color:#9a6c00!important}
  .rm{background:rgba(74,222,128,.08)!important}.rd{background:rgba(248,113,113,.07)!important}
  .ft p,.ft span{color:#aaa!important}
}
@page{size:A4 portrait;margin:.7cm}
</style></head>
<body>
<div class="ctrls">
  <button class="btn btn-g" onclick="window.print()">🖨&nbsp; Salvar como PDF</button>
  <button class="btn btn-q" onclick="window.close()">✕ Fechar</button>
</div>
<div class="card">
  <div class="hdr">
    <span class="trp">🏆</span>
    <div class="ht">Oscar Watchlist</div>
    <div class="hs">Comparação de Palpites &middot; ${date}</div>
  </div>
  <div class="vs">
    <div class="ub">
      <div class="av" style="background:${lg}">${li}</div>
      <div class="un">${esc(leftLabel)}</div>
      ${lScore}
    </div>
    <div class="vb">VS</div>
    <div class="ub">
      <div class="av" style="background:${rg}">${ri}</div>
      <div class="un">${esc(rightLabel)}</div>
      ${rScore}
    </div>
  </div>
  <div class="sts">${statsHtml}</div>
  <div class="tbl">
    <div class="th" style="grid-template-columns:${grid}">${thead}</div>
    ${rowsHtml}
  </div>
  <div class="ft"><p>oscar watchlist &middot; <span>gerado em ${date}</span></p></div>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
}

function CompareRow({ row, leftFilm, rightFilm, mode }) {
  const isMatch = mode === 'users'
    ? row.leftFilmId && row.rightFilmId && row.leftFilmId === row.rightFilmId
    : row.isCorrect;
  const isDiff = mode === 'users'
    ? !isMatch
    : row.officialFilmId && !row.isCorrect;

  return (
    <div
      className={`card flex items-start gap-3 p-3.5 ${
        isMatch ? 'border-emerald-900/50' : isDiff ? 'border-red-900/30' : ''
      }`}
    >
      <div className="shrink-0 mt-0.5">
        {isMatch ? (
          <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-success" />
          </div>
        ) : isDiff ? (
          <div className="w-6 h-6 rounded-full bg-red-950 border border-red-800 flex items-center justify-center">
            <XIcon className="w-3.5 h-3.5 text-danger" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center">
            <Minus className="w-3 h-3 text-gray-600" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {row.categoryName}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            {mode === 'users' ? (
              leftFilm ? (
                <p className="text-sm text-gray-300 truncate">{leftFilm.title}</p>
              ) : (
                <p className="text-sm text-gray-600 italic">sem palpite</p>
              )
            ) : (
              row.predictedFilmId ? (
                <p className="text-sm text-gray-300 truncate">{leftFilm?.title || row.predictedFilmId}</p>
              ) : (
                <p className="text-sm text-gray-600 italic">sem palpite</p>
              )
            )}
          </div>
          <div>
            {mode === 'users' ? (
              rightFilm ? (
                <p className={`text-sm truncate ${isMatch ? 'text-success font-semibold' : 'text-gray-300'}`}>
                  {rightFilm.title}
                </p>
              ) : (
                <p className="text-sm text-gray-600 italic">sem palpite</p>
              )
            ) : (
              row.officialFilmId ? (
                <p className={`text-sm truncate ${isMatch ? 'text-success font-semibold' : 'text-gold'}`}>
                  {rightFilm?.title || row.officialFilmId}
                </p>
              ) : (
                <p className="text-sm text-gray-600 italic">aguardando</p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparePage() {
  const { state, filmById, showToast } = useApp();
  const [mode, setMode] = useState('users'); // 'users' | 'official'
  const [leftUser, setLeftUser] = useState('');
  const [rightUser, setRightUser] = useState('');
  const [compareUser, setCompareUser] = useState(state.activeUser || '');
  // Keep compareUser in sync when active user changes (e.g. after login)
  useEffect(() => {
    if (state.activeUser && !compareUser) setCompareUser(state.activeUser);
  }, [state.activeUser]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleCompare() {
    setLoading(true);
    setResult(null);
    try {
      if (mode === 'users') {
        if (!leftUser || !rightUser) throw new Error('Selecione dois usuários.');
        if (leftUser === rightUser) throw new Error('Selecione usuários diferentes.');
        const data = await api.compareUsers(leftUser, rightUser);
        setResult({ mode: 'users', ...data, leftUser, rightUser });
      } else {
        if (!compareUser) throw new Error('Selecione um usuário.');
        const data = await api.compareWithOfficial(compareUser);
        setResult({ mode: 'official', ...data, compareUser });
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const users = state.users;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="font-display text-2xl text-gray-100">Comparar</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compare palpites entre usuários ou com o resultado oficial.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-bg-surface border border-border rounded-xl mb-5 w-fit">
        <button
          onClick={() => { setMode('users'); setResult(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'users' ? 'bg-bg-raised text-gray-100 border border-border' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Usuário vs Usuário
        </button>
        <button
          onClick={() => { setMode('official'); setResult(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'official' ? 'bg-bg-raised text-gray-100 border border-border' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          vs Oscar oficial
        </button>
      </div>

      {/* Selectors */}
      <div className="card p-4 mb-5">
        {mode === 'users' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="meta-label mb-2">Usuário A</p>
              <select
                value={leftUser}
                onChange={(e) => setLeftUser(e.target.value)}
                className="input"
              >
                <option value="">Selecionar...</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <p className="meta-label mb-2">Usuário B</p>
              <select
                value={rightUser}
                onChange={(e) => setRightUser(e.target.value)}
                className="input"
              >
                <option value="">Selecionar...</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <p className="meta-label mb-2">Usuário</p>
            <select
              value={compareUser}
              onChange={(e) => setCompareUser(e.target.value)}
              className="input max-w-xs"
            >
              <option value="">Selecionar...</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}

        <button
          onClick={handleCompare}
          disabled={loading || (mode === 'users' ? !leftUser || !rightUser : !compareUser)}
          className="btn btn-gold mt-4 px-5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Comparando...' : 'Comparar'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-100">{result.totalCategories}</p>
              <p className="text-xs text-gray-500 mt-1">Categorias</p>
            </div>
            {result.mode === 'users' ? (
              <>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-success">{result.matchesCount}</p>
                  <p className="text-xs text-gray-500 mt-1">Palpites iguais</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gray-300">{result.comparedCategories}</p>
                  <p className="text-xs text-gray-500 mt-1">Comparáveis</p>
                </div>
              </>
            ) : (
              <>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-success">{result.correctCount}</p>
                  <p className="text-xs text-gray-500 mt-1">Acertos</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-2xl font-bold text-gold">
                    {result.comparableCategories > 0
                      ? `${Math.round((result.correctCount / result.comparableCategories) * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Aproveitamento</p>
                </div>
              </>
            )}
          </div>

          {/* Export actions */}
          <div className="flex gap-2 mb-4 justify-end">
            <button
              onClick={() => exportCSV(result, filmById)}
              className="btn text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
            <button
              onClick={() => openVisualReport(result, filmById, state.officialResults, state.categories)}
              className="btn btn-gold text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Relatório Visual
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-2 gap-2 px-3.5 mb-2">
            <p className="meta-label">
              {result.mode === 'users' ? result.leftUser : result.compareUser}
            </p>
            <p className="meta-label">
              {result.mode === 'users' ? result.rightUser : 'Resultado oficial'}
            </p>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {(result.mode === 'users' ? [...result.matches, ...result.diffs] : result.results).map((row) => {
              const leftFilm = result.mode === 'users'
                ? filmById(row.filmId || row.leftFilmId)
                : filmById(row.predictedFilmId);
              const rightFilm = result.mode === 'users'
                ? filmById(row.filmId || row.rightFilmId)
                : filmById(row.officialFilmId);
              return (
                <CompareRow
                  key={row.categoryId}
                  row={row}
                  leftFilm={leftFilm}
                  rightFilm={rightFilm}
                  mode={result.mode}
                />
              );
            })}
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card p-10 flex flex-col items-center gap-3 text-center">
          <BarChart3 className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500">Selecione os usuários e clique em Comparar</p>
        </div>
      )}
    </div>
  );
}
