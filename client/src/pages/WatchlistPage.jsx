import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, Film } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { MovieCard } from '../components/MovieCard.jsx';
import { MovieModal } from '../components/MovieModal.jsx';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'watched', label: 'Assistidos' },
];

export function WatchlistPage() {
  const { state, getFilmState } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedFilm, setSelectedFilm] = useState(null);

  const watchedCount = state.activeUser
    ? state.films.filter((f) => getFilmState(f.id).watched).length
    : 0;
  const total = state.films.length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let films = [...state.films].sort((a, b) => {
      // Unwatched first, then by nominations desc
      if (state.activeUser) {
        const aw = getFilmState(a.id).watched ? 1 : 0;
        const bw = getFilmState(b.id).watched ? 1 : 0;
        if (aw !== bw) return aw - bw;
      }
      if (b.nominations !== a.nominations) return b.nominations - a.nominations;
      return a.title.localeCompare(b.title);
    });

    if (q) {
      films = films.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.watchLinks?.some((l) => l.label?.toLowerCase().includes(q)) ||
          f.categories?.some((c) => c.toLowerCase().includes(q))
      );
    }

    if (state.activeUser) {
      if (filter === 'pending') films = films.filter((f) => !getFilmState(f.id).watched);
      if (filter === 'watched') films = films.filter((f) => getFilmState(f.id).watched);
    }

    return films;
  }, [state.films, state.profile.films, state.activeUser, search, filter]);

  return (
    <>
      {/* Stats bar */}
      {state.activeUser && (
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 bg-bg-surface rounded-full h-2 overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
              style={{ width: total > 0 ? `${(watchedCount / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-sm font-bold text-gray-400 shrink-0">
            <span className="text-gold">{watchedCount}</span>/{total} assistidos
          </span>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar filme, plataforma ou categoria..."
            className="input pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {state.activeUser && (
          <div className="flex gap-1 p-1 bg-bg-surface border border-border rounded-xl">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-100 ${
                  filter === f.id
                    ? 'bg-bg-raised text-gray-100 border border-border'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {filtered.length} filme{filtered.length !== 1 ? 's' : ''}
          {search ? ` para "${search}"` : ''}
        </p>
      </div>

      {/* Film grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Film className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-medium">Nenhum filme encontrado</p>
          {search && (
            <button onClick={() => setSearch('')} className="btn text-sm">
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((film) => (
            <MovieCard key={film.id} film={film} onOpen={setSelectedFilm} />
          ))}
        </div>
      )}

      {selectedFilm && (
        <MovieModal film={selectedFilm} onClose={() => setSelectedFilm(null)} />
      )}
    </>
  );
}
