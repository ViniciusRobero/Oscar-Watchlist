import { useState } from 'react';
import { Trophy, Check, X as XIcon, Lock, Unlock, Star } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

function NomineeDisplay({ nomineeId, category, filmById }) {
  if (!nomineeId) return <span className="text-sm text-gray-600 italic">sem palpite</span>;
  const nominee = category.nominees?.find((n) => n.id === nomineeId);
  const film = nominee ? filmById(nominee.filmId) : filmById(nomineeId);
  if (!film && !nominee) return <span className="text-sm text-gray-500 italic">{nomineeId}</span>;
  return (
    <span className="text-sm font-semibold text-gray-200 truncate">
      {nominee?.nomineeName
        ? `${nominee.nomineeName} — ${film?.title || ''}`
        : film?.title || nomineeId}
    </span>
  );
}

function ResultRow({ category, prediction, officialNomineeId, onSetWinner, isAdmin, filmById }) {
  const [open, setOpen] = useState(false);

  // Resolve nominees to film objects
  const predictedNominee = prediction
    ? category.nominees?.find((n) => n.id === prediction)
    : null;
  const officialNominee = officialNomineeId
    ? category.nominees?.find((n) => n.id === officialNomineeId)
    : null;

  const hasOfficial = !!officialNomineeId;
  const hasPrediction = !!prediction;
  const isCorrect = hasPrediction && hasOfficial && prediction === officialNomineeId;
  const isWrong = hasPrediction && hasOfficial && !isCorrect;

  const officialFilm = officialNominee ? filmById(officialNominee.filmId) : null;
  const officialDisplayName = officialNominee?.nomineeName
    ? `${officialNominee.nomineeName} — ${officialFilm?.title || ''}`
    : officialFilm?.title || officialNomineeId;

  return (
    <div
      className={`card overflow-hidden ${isCorrect ? 'border-emerald-800/60' : isWrong ? 'border-red-900/40' : ''
        }`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="shrink-0">
          {!hasOfficial ? (
            <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center">
              <span className="text-gray-600 text-xs">?</span>
            </div>
          ) : isCorrect ? (
            <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center">
              <Check className="w-4 h-4 text-success" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-red-950 border border-red-800 flex items-center justify-center">
              <XIcon className="w-4 h-4 text-danger" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
            {category.name}
          </p>
          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-gray-600 shrink-0">Meu palpite:</span>
              <NomineeDisplay nomineeId={prediction} category={category} filmById={filmById} />
            </div>
            {hasOfficial && (
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-3 h-3 text-gold shrink-0" />
                <span className="text-sm font-bold text-gold truncate">{officialDisplayName}</span>
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn btn-ghost py-1.5 px-2 text-xs"
            title="Definir vencedor"
          >
            {hasOfficial ? <Lock className="w-3.5 h-3.5 text-gold" /> : <Unlock className="w-3.5 h-3.5 text-gray-600" />}
          </button>
        )}
      </div>

      {isAdmin && open && (
        <div className="border-t border-border px-4 py-3 bg-bg-raised/40 space-y-1.5">
          <p className="meta-label mb-2">Definir vencedor oficial</p>
          {(category.nominees || []).map((nominee) => {
            const film = filmById(nominee.filmId);
            const isWinner = nominee.id === officialNomineeId;
            const label = nominee.nomineeName
              ? `${nominee.nomineeName} — ${film?.title || ''}`
              : film?.title || nominee.id;
            return (
              <button
                key={nominee.id}
                onClick={() => {
                  onSetWinner(category.id, isWinner ? '' : nominee.id);
                  setOpen(false);
                }}
                className={`nominee-card ${isWinner ? 'nominee-card-winner' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {film && (
                    <img
                      src={film.poster}
                      alt={film.title}
                      className="w-7 h-10 rounded object-cover border border-border shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span className="text-sm font-semibold flex-1 text-left">{label}</span>
                  {isWinner && <Trophy className="w-4 h-4 text-success ml-auto" />}
                </div>
              </button>
            );
          })}
          <button
            onClick={() => { onSetWinner(category.id, ''); setOpen(false); }}
            className="btn btn-ghost text-xs w-full mt-1"
          >
            Limpar resultado
          </button>
        </div>
      )}
    </div>
  );
}

export function OscarNightPage() {
  const { state, setOfficialWinner, showToast, filmById } = useApp();
  const [isAdmin, setIsAdmin] = useState(false);
  const hasUser = !!state.activeUser;

  const officialCount = Object.values(state.officialResults).filter(Boolean).length;
  const predictions = state.profile.predictions || {};

  let correctCount = 0;
  let comparableCount = 0;
  state.categories.forEach((cat) => {
    const official = state.officialResults[cat.id];
    const predicted = predictions[cat.id];
    if (official) {
      comparableCount++;
      if (predicted && predicted === official) correctCount++;
    }
  });

  async function handleSetWinner(categoryId, nomineeId) {
    try {
      await setOfficialWinner(categoryId, nomineeId);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  const highlightCategories = state.categories.filter((c) => c.highlight);
  const otherCategories = state.categories.filter((c) => !c.highlight);

  function renderSection(cats, title) {
    return (
      <div className="mb-6">
        <p className="meta-label mb-3">{title}</p>
        <div className="space-y-2">
          {cats.map((category) => (
            <ResultRow
              key={category.id}
              category={category}
              prediction={predictions[category.id] || ''}
              officialNomineeId={state.officialResults[category.id] || ''}
              onSetWinner={handleSetWinner}
              isAdmin={isAdmin}
              filmById={filmById}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl text-gray-100">Noite do Oscar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhe os resultados e veja seus acertos.
          </p>
        </div>
        {state.userRole === 'admin' && (
          <button
            onClick={() => setIsAdmin((v) => !v)}
            className={`btn text-xs py-1.5 px-3 ${isAdmin ? 'border-gold-dim text-gold' : ''}`}
            title="Modo admin: define os vencedores oficiais"
          >
            {isAdmin ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isAdmin ? 'Admin on' : 'Admin off'}
          </button>
        )}
      </div>

      {hasUser && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gold">{officialCount}</p>
            <p className="text-xs text-gray-500 mt-1">Resultados oficiais</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-success">{correctCount}</p>
            <p className="text-xs text-gray-500 mt-1">Acertos</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-300">
              {comparableCount > 0 ? `${Math.round((correctCount / comparableCount) * 100)}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Aproveitamento</p>
          </div>
        </div>
      )}

      {!hasUser && (
        <div className="card p-4 mb-5 text-sm text-gray-500 flex items-center gap-2">
          <Star className="w-4 h-4 text-gray-600 shrink-0" />
          Selecione um perfil para ver seus acertos ao lado dos resultados oficiais.
        </div>
      )}

      {renderSection(highlightCategories, 'Categorias principais')}
      {renderSection(otherCategories, 'Demais categorias')}
    </div>
  );
}
