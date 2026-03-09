import { useState } from 'react';
import { BarChart3, Check, X as XIcon, Minus, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api.js';

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
  useState(() => { if (state.activeUser && !compareUser) setCompareUser(state.activeUser); });
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
