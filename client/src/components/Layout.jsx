import { useState } from 'react';
import { Trophy, Users, Star, Calendar, BarChart3, ChevronDown, LogIn, ChevronLeft } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useEdition } from '../hooks/useEdition.js';

const NAV_ITEMS = [
  { id: 'watchlist', label: 'Filmes', Icon: Star },
  { id: 'predictions', label: 'Palpites', Icon: Trophy },
  { id: 'oscar-night', label: 'Noite do Oscar', Icon: Calendar },
  { id: 'compare', label: 'Comparar', Icon: BarChart3 },
  { id: 'users', label: 'Perfis', Icon: Users },
];

function EditionSelector() {
  const { state } = useApp();
  const { switchEdition } = useEdition();
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

function UserDropdown({ onClose, onNavigate }) {
  const { state, showToast } = useApp();
  const { login, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalFilms = state.films.length;
  const watchedFilms = state.activeUser
    ? state.films.filter((f) => state.profile.films[f.id]?.watched).length
    : 0;
  const progressPct = totalFilms > 0 ? Math.round((watchedFilms / totalFilms) * 100) : 0;
  const summary = state.userSummaries.find((s) => s.username === state.activeUser);

  function selectUser(username) {
    if (username === state.activeUser) return;
    setSelectedUser(username);
    setPassword('');
    setError('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(selectedUser, password.trim());
      localStorage.setItem('oscar_active_user', selectedUser);
      onClose();
    } catch (err) {
      setError(err.message || 'Senha incorreta.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    if (window.confirm('Sair do perfil?')) {
      logout();
      onClose();
    }
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-80 z-50 card-raised border border-border shadow-2xl shadow-black/50 rounded-2xl overflow-hidden">

      {/* ── Logged-in user card ── */}
      {state.activeUser && (
        <div className="p-4 border-b border-border bg-bg-raised">
          <div className="flex items-center gap-3 mb-3">
            <UserAvatar username={state.activeUser} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-100 truncate">{state.activeUser}</p>
              {state.userRole === 'admin' && (
                <span className="text-[10px] badge badge-gold py-0.5 px-2">Admin</span>
              )}
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-base font-bold text-gray-100">{watchedFilms}</p>
              <p className="text-[10px] text-gray-600">Assistidos</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-100">{Object.keys(state.profile.predictions || {}).length}</p>
              <p className="text-[10px] text-gray-600">Palpites</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-100">{summary?.averageRating ?? '—'}</p>
              <p className="text-[10px] text-gray-600">Média</p>
            </div>
          </div>
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-600 mb-1">
              <span>Progresso</span>
              <span>{watchedFilms}/{totalFilms} ({progressPct}%)</span>
            </div>
            <div className="bg-bg-base rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { onNavigate('users'); onClose(); }}
              className="btn btn-ghost text-xs py-1.5 px-3 flex-1"
            >
              Configurações
            </button>
            <button
              onClick={handleLogout}
              className="btn text-xs py-1.5 px-3 text-red-400 border-red-900/40 hover:border-red-700/60"
            >
              Sair
            </button>
          </div>
        </div>
      )}

      {/* ── Switch account ── */}
      {state.users.length > 0 && (
        <div className="p-2 border-b border-border">
          <p className="meta-label px-2 py-1.5">Trocar conta</p>
          {state.users.filter(u => u !== state.activeUser).map((u) => {
            const uSummary = state.userSummaries.find((s) => s.username === u);
            const isSelected = u === selectedUser;
            return (
              <div key={u}>
                <button
                  onClick={() => selectUser(u)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-100 ${
                    isSelected ? 'bg-bg-hover text-gray-100' : 'text-gray-300 hover:bg-bg-hover'
                  }`}
                >
                  <UserAvatar username={u} size="sm" />
                  <span className="flex-1 text-left truncate">{u}</span>
                  <span className="text-xs text-gray-500">{uSummary ? `${uSummary.watchedCount} filmes` : ''}</span>
                </button>
                {isSelected && (
                  <form onSubmit={handleLogin} className="px-3 pb-2 pt-1">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha"
                        className="input flex-1 text-sm py-1.5"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Escape' && setSelectedUser(null)}
                      />
                      <button type="submit" disabled={!password.trim() || loading} className="btn btn-gold px-3 py-1.5 text-xs">
                        {loading ? '...' : 'OK'}
                      </button>
                    </div>
                    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create account ── */}
      {!state.activeUser && (
        <button
          onClick={() => { onNavigate('users'); onClose(); }}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:bg-bg-hover transition-colors"
        >
          <Users className="w-4 h-4" />
          Entrar / Criar conta
        </button>
      )}
    </div>
  );
}

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-yellow-500 to-amber-600',
  'from-purple-500 to-violet-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-orange-500 to-red-600',
  'from-indigo-500 to-blue-600',
];

function avatarColor(username) {
  let h = 0;
  for (let i = 0; i < (username || '').length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function UserAvatar({ username, size = 'md' }) {
  const initials = (username || '?').slice(0, 2).toUpperCase();
  const color = avatarColor(username);
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function Layout({ activePage, onChangePage, onBackToHub, currentAward, children }) {
  const { state } = useApp();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const totalFilms = state.films.length;
  const watchedFilms = state.activeUser
    ? state.films.filter((f) => state.profile.films[f.id]?.watched).length
    : 0;
  const progressPct = totalFilms > 0 ? Math.round((watchedFilms / totalFilms) * 100) : 0;

  const awardIcon = currentAward?.icon || '🏆';
  const editionLabel = (state.editions || []).find(e => e.id === state.edition)?.label || 'Oscar Watchlist';

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg-base/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo + back to hub */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToHub ? (
              <button
                onClick={onBackToHub}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-100 transition-colors mr-1"
                title="Voltar às premiações"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : null}
            <span className="text-lg flex-shrink-0">{awardIcon}</span>
            <span className="font-display text-lg text-gray-100 hidden sm:block truncate">{editionLabel}</span>
            <span className="font-display text-lg text-gray-100 sm:hidden">{currentAward?.name || 'Oscar'}</span>
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

          {/* User area — prominent avatar + info */}
          <div className="relative flex-shrink-0">
            {state.activeUser ? (
              <button
                onClick={() => setShowUserDropdown((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-bg-hover transition-colors group"
              >
                <UserAvatar username={state.activeUser} />
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="text-sm font-semibold text-gray-100 leading-tight truncate max-w-[100px]">
                    {state.activeUser}
                  </span>
                  <div className="flex items-center gap-1.5 w-full">
                    <div className="flex-1 bg-bg-raised rounded-full h-1 overflow-hidden w-16">
                      <div
                        className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{watchedFilms}/{totalFilms}</span>
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => setShowUserDropdown((v) => !v)}
                className="btn text-xs py-2 px-3 flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
            )}
            {showUserDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
                <div className="z-50 relative">
                  <UserDropdown onClose={() => setShowUserDropdown(false)} onNavigate={onChangePage} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav (Bottom Bar) */}
        <nav className="md:hidden fixed bottom-0 w-full z-50 bg-bg-base/90 backdrop-blur-xl border-t border-white/5 pb-safe">
          <div className="flex justify-around items-center px-2 py-2">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const isActive = activePage === id;
              return (
                <button
                  key={id}
                  onClick={() => onChangePage(id)}
                  className={`flex flex-col flex-1 min-w-0 items-center justify-center h-12 rounded-xl transition-all duration-200 ${isActive ? 'text-gold' : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  <Icon className={`w-5 h-5 mb-1 shrink-0 ${isActive ? 'scale-110 drop-shadow-glow-gold' : ''}`} />
                  <span className={`text-[9px] font-medium truncate w-full text-center px-0.5 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
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
