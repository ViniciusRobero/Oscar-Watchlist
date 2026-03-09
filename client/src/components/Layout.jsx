import { useState } from 'react';
import { Trophy, Users, Star, Calendar, BarChart3, ChevronDown, LogIn, PlusCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const NAV_ITEMS = [
  { id: 'watchlist', label: 'Filmes', Icon: Star },
  { id: 'predictions', label: 'Palpites', Icon: Trophy },
  { id: 'oscar-night', label: 'Noite do Oscar', Icon: Calendar },
  { id: 'compare', label: 'Comparar', Icon: BarChart3 },
  { id: 'users', label: 'Perfis', Icon: Users },
];

function EditionSelector() {
  const { state, switchEdition } = useApp();
  const editions = state.editions || [];
  if (editions.length <= 1) return null;

  return (
    <select
      value={state.edition || ''}
      onChange={(e) => switchEdition(e.target.value)}
      className="bg-bg-hover text-gray-200 text-xs rounded-lg px-2 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-gold cursor-pointer"
      title="Trocar edição do Oscar"
    >
      {editions.map((ed) => (
        <option key={ed.id} value={ed.id}>
          {ed.label}
        </option>
      ))}
    </select>
  );
}

function UserDropdown({ onClose }) {
  const { state, login, bootstrap, showToast } = useApp();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleLogin(username) {
    try {
      await login(username);
      onClose();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await login(newName.trim());
      setNewName('');
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-72 z-50 card-raised border border-border shadow-2xl shadow-black/50 rounded-2xl overflow-hidden">
      {/* Existing users */}
      {state.users.length > 0 && (
        <div className="p-2 border-b border-border">
          <p className="meta-label px-2 py-1.5">Entrar como</p>
          {state.users.map((u) => {
            const summary = state.userSummaries.find((s) => s.username === u);
            const isActive = u === state.activeUser;
            return (
              <button
                key={u}
                onClick={() => handleLogin(u)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-100 ${isActive
                  ? 'bg-gold-muted text-gold'
                  : 'text-gray-300 hover:bg-bg-hover'
                  }`}
              >
                <span>{u}</span>
                <span className="text-xs text-gray-500">
                  {summary ? `${summary.watchedCount} films · ${summary.predictionsCount} palpites` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Create new */}
      <form onSubmit={handleCreate} className="p-3">
        <p className="meta-label mb-2">Novo perfil</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Seu nome"
            className="input flex-1"
            maxLength={40}
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="btn btn-gold px-3 py-2 text-xs"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export function Layout({ activePage, onChangePage, children }) {
  const { state } = useApp();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const summary = state.userSummaries.find((s) => s.username === state.activeUser);
  const totalFilms = state.films.length;
  const watchedFilms = state.activeUser
    ? state.films.filter((f) => state.profile.films[f.id]?.watched).length
    : 0;

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg-base/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo + Edition */}
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-gold" />
            <span className="font-display text-lg text-gray-100 hidden sm:block">
              {(state.editions || []).find(e => e.id === state.edition)?.label || 'Oscar Watchlist'}
            </span>
            <span className="font-display text-lg text-gray-100 sm:hidden">Oscar</span>
            <EditionSelector />
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => onChangePage(id)}
                className={`nav-tab ${activePage === id ? 'nav-tab-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* User switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown((v) => !v)}
              className="btn text-xs py-2 px-3 flex items-center gap-1.5"
            >
              {state.activeUser ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-gold" />
                  <span className="max-w-[100px] truncate">{state.activeUser}</span>
                  {summary && (
                    <span className="text-gray-500 hidden sm:inline">
                      {watchedFilms}/{totalFilms}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </>
              )}
            </button>
            {showUserDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserDropdown(false)}
                />
                <div className="z-50 relative">
                  <UserDropdown onClose={() => setShowUserDropdown(false)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav (Bottom Bar) */}
        <nav className="sm:hidden fixed bottom-0 w-full z-50 bg-bg-base/90 backdrop-blur-xl border-t border-white/5 pb-safe">
          <div className="flex justify-around items-center px-2 py-2">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activePage === id;
              return (
                <button
                  key={id}
                  onClick={() => onChangePage(id)}
                  className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 ${isActive ? 'text-gold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${isActive ? 'scale-110 drop-shadow-glow-gold' : ''}`} />
                  <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-5xl mx-auto px-4 py-6 sm:pb-6 pb-24">
        {children}
      </main>
    </div>
  );
}
