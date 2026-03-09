import { useState, useEffect } from 'react';
import { Trophy, ChevronDown, ChevronUp, Check, AlertCircle, User } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

// ── Lazy poster cache ─────────────────────────────────────────────────────────
const posterCache = {};
function useLazyPoster(film) {
  const isPlaceholder = !film?.poster || film.poster.endsWith('.svg');
  const [src, setSrc] = useState(isPlaceholder ? null : film?.poster);
  useEffect(() => {
    if (!film) return;
    if (!isPlaceholder) { setSrc(film.poster); return; }
    if (posterCache[film.id] !== undefined) { setSrc(posterCache[film.id]); return; }
    fetch(`/api/poster/${encodeURIComponent(film.id)}`)
      .then(r => r.json())
      .then(({ posterUrl }) => {
        posterCache[film.id] = posterUrl || null;
        setSrc(posterUrl || null);
      })
      .catch(() => { posterCache[film.id] = null; });
  }, [film?.id]);
  return src;
}

// ── Nominee label ─────────────────────────────────────────────────────────────
function NomineeLabel({ nominee, film }) {
  if (!film) return <span className="text-sm text-gray-500 italic">Filme não encontrado</span>;
  if (nominee.nomineeName) {
    return (
      <div>
        <p className="text-sm font-semibold leading-snug">{nominee.nomineeName}</p>
        <p className="text-xs text-gray-500 mt-0.5 italic">{film.title}</p>
      </div>
    );
  }
  return <p className="text-sm font-semibold leading-snug">{film.title}</p>;
}

// ── Nominee Button with lazy poster ───────────────────────────────────────────
function NomineeButton({ nominee, film, isSelected, disabled, saving, onClick }) {
  const posterSrc = useLazyPoster(film);
  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={onClick}
      className={[
        'nominee-card',
        isSelected ? 'nominee-card-selected' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        saving ? 'opacity-70' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-12 rounded overflow-hidden border border-border bg-bg-raised shrink-0 flex items-center justify-center">
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={film?.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span className="text-[7px] text-gray-700 text-center px-0.5 leading-tight">
              {film?.title?.slice(0,12)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <NomineeLabel nominee={nominee} film={film} />
          {film?.imdbRating && (
            <p className="text-xs text-gold mt-0.5">IMDb {film.imdbRating}</p>
          )}
        </div>
        {isSelected && (
          <Check className="w-4 h-4 ml-auto shrink-0 text-gold" />
        )}
      </div>
    </button>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────
function CategoryCard({ category, films, prediction, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedNominee = category.nominees?.find((n) => n.id === prediction);
  const selectedFilm = selectedNominee ? films.find((f) => f.id === selectedNominee.filmId) : null;

  async function handleNomineeClick(e, nominee, isSelected) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSelect(category.id, isSelected ? '' : nominee.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header — toggle open/close */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-bg-raised/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {prediction ? (
            <div className="w-6 h-6 rounded-full bg-gold-muted border border-gold-dim flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-gold" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center shrink-0">
              <span className="text-gray-600 text-xs">?</span>
            </div>
          )}
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-gray-200">{category.name}</p>
            {selectedNominee && (
              <p className="text-xs text-gold mt-0.5 truncate">
                {selectedNominee.nomineeName || selectedFilm?.title || prediction}
              </p>
            )}
            {!prediction && (
              <p className="text-xs text-gray-600 mt-0.5">Sem palpite</p>
            )}
          </div>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        }
      </button>

      {/* Nominees list */}
      {open && (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-bg-raised/30">
          <p className="meta-label mb-2">Indicados</p>
          {(category.nominees || []).map((nominee) => {
            const film = films.find((f) => f.id === nominee.filmId);
            const isSelected = nominee.id === prediction;
            return (
              <NomineeButton
                key={nominee.id}
                nominee={nominee}
                film={film}
                isSelected={isSelected}
                disabled={disabled}
                saving={saving}
                onClick={(e) => handleNomineeClick(e, nominee, isSelected)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function PredictionsPage() {
  const { state, savePrediction, showToast } = useApp();
  const hasUser = !!state.activeUser;

  const totalCategories = state.categories.length;
  const filledPredictions = Object.values(state.profile.predictions || {}).filter(Boolean).length;

  async function handleSelect(categoryId, nomineeId) {
    try {
      await savePrediction(categoryId, nomineeId);
      if (nomineeId) showToast('Palpite salvo!');
    } catch (e) {
      showToast(e.message || 'Erro ao salvar palpite.', 'error');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl text-gray-100">Palpites</h1>
          <p className="text-sm text-gray-500 mt-1">
            {hasUser
              ? `Quem você acha que vai ganhar em cada categoria?`
              : 'Faça login para registrar seus palpites.'}
          </p>
        </div>
        {hasUser && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gold">{filledPredictions}</p>
            <p className="text-xs text-gray-500">de {totalCategories}</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {hasUser && (
        <div className="mb-5">
          <div className="bg-bg-surface rounded-full h-2 overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
              style={{ width: `${(filledPredictions / Math.max(totalCategories, 1)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5 text-right">
            {filledPredictions === totalCategories
              ? '🎉 Todos os palpites feitos!'
              : `${totalCategories - filledPredictions} categorias sem palpite`}
          </p>
        </div>
      )}

      {/* No user warning */}
      {!hasUser && (
        <div className="card p-5 mb-5 flex items-center gap-3 border-amber-900/40 bg-amber-950/20">
          <User className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-300/80">
            Vá até a aba <strong className="text-amber-300">Perfis</strong> para entrar ou criar seu perfil e então volte aqui para fazer seus palpites.
          </p>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {state.categories.map((category) => {
          const prediction = state.profile.predictions?.[category.id] || '';
          return (
            <CategoryCard
              key={category.id}
              category={category}
              films={state.films}
              prediction={prediction}
              onSelect={handleSelect}
              disabled={!hasUser}
            />
          );
        })}
      </div>
    </div>
  );
}
