import { useState, useEffect } from 'react';
import { X, Star, ExternalLink, Eye, EyeOff, Film, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy-load poster from server
const posterCache = {};
function PosterImage({ film, className }) {
  const isPlaceholder = !film.poster || film.poster.endsWith('.svg');
  const [src, setSrc] = useState(isPlaceholder ? null : film.poster);
  useEffect(() => {
    if (!isPlaceholder) { setSrc(film.poster); return; }
    if (posterCache[film.id] !== undefined) { setSrc(posterCache[film.id]); return; }
    let cancelled = false;
    fetch(`/api/poster/${encodeURIComponent(film.id)}`)
      .then(r => r.json()).then(({ posterUrl }) => {
        if (cancelled) return;
        posterCache[film.id] = posterUrl || null;
        setSrc(posterUrl || null);
      }).catch(() => { });
    return () => { cancelled = true; };
  }, [film.id, film.poster, isPlaceholder]);
  if (!src) return <div className={`${className} bg-bg-raised flex items-center justify-center text-gray-700`}><span className="text-xs text-center px-2">{film.title}</span></div>;
  return <img src={src} alt={film.title} className={className} onError={(e) => e.target.style.display = 'none'} />;
}


function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          className={`star-btn text-lg leading-none transition-colors ${n <= display ? 'text-gold' : 'text-gray-700'
            } ${readonly ? 'cursor-default' : 'hover:text-gold cursor-pointer'}`}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(null)}
          onClick={() => !readonly && onChange?.(n === value ? null : n)}
          title={`${n}/10`}
        >
          ★
        </button>
      ))}
      {value ? (
        <span className="ml-1 text-xs text-gold font-bold">{value}/10</span>
      ) : (
        <span className="ml-1 text-xs text-gray-600">sem nota</span>
      )}
    </div>
  );
}

export function MovieModal({ film, onClose }) {
  const { state, getFilmState, updateFilm, showToast } = useApp();
  const filmState = getFilmState(film?.id);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const hasUser = !!state.activeUser;

  useEffect(() => {
    if (film) {
      setNotes(filmState.personalNotes || '');
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [film?.id]);

  if (!film) return null;

  const predCount = Object.values(state.profile.predictions || {}).filter(
    (id) => id === film.id
  ).length;

  async function handleWatched() {
    if (!hasUser) return showToast('Selecione um usuário primeiro.', 'error');
    try {
      await updateFilm(film.id, { watched: !filmState.watched });
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleRating(r) {
    if (!hasUser) return showToast('Selecione um usuário primeiro.', 'error');
    try {
      await updateFilm(film.id, { personalRating: r });
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleSaveNotes(andClose = false) {
    if (!hasUser) return showToast('Selecione um usuário primeiro.', 'error');
    setSaving(true);
    try {
      await updateFilm(film.id, { personalNotes: notes });
      showToast('Notas salvas!');
      if (andClose) onClose();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const availLabels = {
    available: { text: 'Disponível', cls: 'badge-success' },
    unavailable: { text: 'Indisponível online', cls: 'badge-neutral' },
    partial: { text: 'Parcialmente disponível', cls: 'badge-accent' },
    unknown: { text: 'Disponibilidade não confirmada', cls: 'badge-neutral' },
  };
  const avail = availLabels[film.availabilityStatus] || availLabels.unknown;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-3xl max-h-[96vh] sm:max-h-[88vh] overflow-y-auto bg-bg-surface/95 backdrop-blur-xl border border-border shadow-2xl rounded-t-3xl sm:rounded-2xl flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-bg-surface/95 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4 text-gold" />
              <span className="text-sm font-semibold text-gray-300">{film.type}</span>
              {film.nominations > 0 && (
                <span className="badge badge-gold">{film.nominations} indicações</span>
              )}
              {predCount > 0 && (
                <span className="badge badge-accent">{predCount} palpite{predCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <button onClick={onClose} className="btn btn-ghost p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Poster */}
              <div className="shrink-0">
                <PosterImage film={film} className="w-full sm:w-40 h-52 sm:h-60 object-cover rounded-xl border border-border bg-bg-raised" />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl sm:text-3xl text-gray-100 leading-tight">{film.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`badge ${avail.cls}`}>{avail.text}</span>
                  {film.imdbRating && (
                    <span className="badge badge-gold">
                      <Star className="w-3 h-3" />
                      IMDb {film.imdbRating}
                    </span>
                  )}
                </div>

                {/* Synopsis */}
                {film.synopsis ? (
                  <p className="mt-3 text-sm text-gray-400 leading-relaxed">{film.synopsis}</p>
                ) : (
                  <p className="mt-3 text-sm text-gray-600 italic flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Sinopse pendente de curadoria
                  </p>
                )}

                {/* Categories */}
                {film.categories?.length > 0 && (
                  <div className="mt-3">
                    <p className="meta-label mb-2">Categorias indicadas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {film.categories.map((c) => (
                        <span key={c} className="badge badge-neutral">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {film.imdbUrl ? (
                    <a href={film.imdbUrl} target="_blank" rel="noopener noreferrer" className="btn text-xs py-1.5 px-3">
                      <ExternalLink className="w-3 h-3" />
                      IMDb
                    </a>
                  ) : (
                    <span className="text-xs text-gray-600 italic flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Link IMDb pendente
                    </span>
                  )}
                  {film.watchLinks?.map((link, i) =>
                    link.url ? (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`btn text-xs py-1.5 px-3 ${link.status !== 'confirmed' ? 'opacity-70' : ''}`}
                        title={link.status !== 'confirmed' ? 'Link não confirmado' : ''}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.label || 'Assistir'}
                        {link.status !== 'confirmed' && <AlertCircle className="w-3 h-3 text-yellow-600" />}
                      </a>
                    ) : null
                  )}
                </div>
              </div>
            </div>

            {/* Trivia */}
            {film.trivia?.length > 0 && (
              <div className="mt-5 card-raised p-4">
                <p className="meta-label mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold" /> Curiosidades
                </p>
                <ul className="space-y-2">
                  {film.trivia.map((t, i) => (
                    <li key={i} className="text-sm text-gray-400 leading-relaxed flex gap-2">
                      <span className="text-gold mt-0.5">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* User actions */}
            <div className="mt-5 border-t border-border pt-5 space-y-4">
              <p className="meta-label">Meu registro</p>

              {/* Watched toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Assistido</span>
                <button
                  onClick={handleWatched}
                  disabled={!hasUser}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${filmState.watched
                    ? 'bg-emerald-950 border-emerald-700 text-success'
                    : 'bg-bg-raised border-border text-gray-500 hover:text-gray-300 hover:border-border-active'
                    } disabled:opacity-40`}
                >
                  {filmState.watched ? (
                    <><Eye className="w-4 h-4" /> Assistido</>
                  ) : (
                    <><EyeOff className="w-4 h-4" /> Pendente</>
                  )}
                </button>
              </div>

              {/* Rating */}
              <div>
                <p className="text-sm text-gray-300 mb-2">Minha nota</p>
                <StarRating
                  value={filmState.personalRating}
                  onChange={hasUser ? handleRating : undefined}
                  readonly={!hasUser}
                />
              </div>

              {/* Notes */}
              <div>
                <p className="text-sm text-gray-300 mb-2">Notas pessoais</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!hasUser}
                  placeholder="Escreva suas impressões sobre o filme..."
                  rows={3}
                  className="input resize-none text-sm disabled:opacity-40"
                  maxLength={600}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-600">{notes.length}/600</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveNotes(false)}
                      disabled={!hasUser || saving}
                      className="btn text-xs py-1.5 px-3"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => handleSaveNotes(true)}
                      disabled={!hasUser || saving}
                      className="btn btn-gold text-xs py-1.5 px-3"
                    >
                      Salvar e fechar
                    </button>
                  </div>
                </div>
              </div>

              {!hasUser && (
                <p className="text-xs text-gray-600 italic text-center">
                  Selecione um perfil para registrar seu progresso.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
