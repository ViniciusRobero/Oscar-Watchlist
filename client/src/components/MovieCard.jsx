import { useState, useEffect } from 'react';
import { Eye, EyeOff, Star, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { motion } from 'framer-motion';

const availColors = {
  available: 'text-emerald-400',
  partial: 'text-yellow-500',
  unavailable: 'text-gray-600',
  unknown: 'text-gray-600',
};
const availLabels = {
  available: 'Disponível',
  partial: 'Parcial',
  unavailable: 'Indisponível',
  unknown: '—',
};

// Cache of resolved poster URLs (filmId → url string)
const posterCache = {};

function usePoster(film) {
  const isPlaceholder = !film.poster || film.poster.endsWith('.svg');
  const [src, setSrc] = useState(isPlaceholder ? null : film.poster);

  useEffect(() => {
    if (!isPlaceholder) { setSrc(film.poster); return; }
    if (posterCache[film.id] !== undefined) { setSrc(posterCache[film.id]); return; }

    let cancelled = false;
    fetch(`/api/poster/${encodeURIComponent(film.id)}`)
      .then(r => r.json())
      .then(({ posterUrl }) => {
        if (cancelled) return;
        const url = posterUrl || null;
        posterCache[film.id] = url;
        setSrc(url);
      })
      .catch(() => { posterCache[film.id] = null; });
    return () => { cancelled = true; };
  }, [film.id, film.poster, isPlaceholder]);

  return src;
}

export function MovieCard({ film, onOpen }) {
  const { state, getFilmState, updateFilm, showToast } = useApp();
  const fs = getFilmState(film.id);
  const hasUser = !!state.activeUser;
  const posterSrc = usePoster(film);

  const predCats = state.categories.filter(
    (c) => state.profile.predictions?.[c.id] === film.id ||
      c.nominees?.some(n => n.id === state.profile.predictions?.[c.id] && n.filmId === film.id)
  ).length;

  async function toggleWatched(e) {
    e.stopPropagation();
    if (!hasUser) return showToast('Selecione um usuário primeiro.', 'error');
    try {
      await updateFilm(film.id, { watched: !fs.watched });
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onOpen(film)}
      className={`card flex gap-3.5 p-3.5 cursor-pointer group transition-all duration-300 hover:shadow-glow hover:border-accent/40 ${fs.watched ? 'opacity-60' : ''
        }`}
    >
      {/* Poster */}
      <div className="shrink-0 w-[68px] h-[100px] rounded-lg overflow-hidden border border-border bg-bg-raised flex items-center justify-center">
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={film.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-bg-surface text-gray-700 px-1">
            <span className="text-[9px] text-center font-medium leading-tight line-clamp-3">{film.title}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-100 leading-snug line-clamp-2 group-hover:text-white">
              {film.title}
            </h3>
            <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs text-gray-500 font-medium">
              {film.nominations} nom.
            </span>
            {film.imdbRating && (
              <span className="flex items-center gap-0.5 text-xs text-gold font-bold">
                <Star className="w-3 h-3" />{film.imdbRating}
              </span>
            )}
            {predCats > 0 && (
              <span className="badge badge-gold text-[10px] py-0.5 px-2">
                {predCats} palpite{predCats > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <p className={`text-[11px] mt-1.5 font-medium ${availColors[film.availabilityStatus] || 'text-gray-600'}`}>
            {availLabels[film.availabilityStatus] || '—'}
            {film.watchLinks?.[0]?.label ? ` · ${film.watchLinks[0].label}` : ''}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2">
          {fs.personalRating ? (
            <span className="flex items-center gap-1 text-xs text-gold font-bold">
              <Star className="w-3 h-3" />{fs.personalRating}/10
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={toggleWatched}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${fs.watched
              ? 'bg-emerald-950 border-emerald-800 text-success'
              : 'bg-bg-raised border-border text-gray-600 hover:border-border-active hover:text-gray-400'
              }`}
          >
            {fs.watched ? (
              <><Eye className="w-3 h-3" /> Assistido</>
            ) : (
              <><EyeOff className="w-3 h-3" /> Pendente</>
            )}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
