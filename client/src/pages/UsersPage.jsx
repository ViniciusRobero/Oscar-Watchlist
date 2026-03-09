import { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Users, Star, Trophy, Eye, Lock, EyeOff, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api.js';

function UserCard({ summary, isActive, onSelect, onLogout }) {
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const progressPct = summary.watchedCount > 0 ? Math.round((summary.watchedCount / 50) * 100) : 0;

  async function handleLogin(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSelect(summary.username, password.trim());
      setShowLogin(false);
      setPassword('');
    } catch (err) {
      setError(err.message || 'Senha incorreta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className={`card p-5 transition-all duration-150 ${
        isActive ? 'border-gold-dim ring-1 ring-gold-dim/30' : 'hover:border-border-active hover:shadow-xl hover:shadow-black/30'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-gold' : 'bg-gray-700'}`} />
            <h3 className="font-bold text-gray-100">{summary.username}</h3>
          </div>
          {isActive && (
            <span className="inline-block mt-1 badge badge-gold text-[10px] py-0.5 px-2">Perfil ativo</span>
          )}
        </div>
        {!isActive && !showLogin && (
          <button
            onClick={() => setShowLogin(true)}
            className="btn text-xs py-1.5 px-3"
          >
            <LogIn className="w-3.5 h-3.5" />
            Entrar
          </button>
        )}
        {isActive && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowLogin((v) => !v)}
              className="btn btn-ghost text-xs py-1.5 px-3"
              title="Trocar senha"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { if(window.confirm('Sair do perfil?')) onLogout(); }}
              className="btn text-xs py-1.5 px-3 text-red-400 border-red-900/40 hover:border-red-700/60"
              title="Sair do perfil"
            >
              Sair
            </button>
          </div>
        )}
      </div>

      {showLogin && (
        <form onSubmit={handleLogin} className="mb-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="input w-full text-sm pr-8"
              autoFocus
            />
            <Lock className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-600" />
          </div>
          {error && (
            <p className="text-xs text-danger flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!password.trim() || loading}
              className="btn btn-gold text-xs py-1.5 px-3 flex-1"
            >
              {loading ? 'Entrando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowLogin(false); setPassword(''); setError(''); }}
              className="btn text-xs py-1.5 px-3"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-bg-raised rounded-lg p-2.5 text-center">
          <Eye className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-100">{summary.watchedCount}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Assistidos</p>
        </div>
        <div className="bg-bg-raised rounded-lg p-2.5 text-center">
          <Trophy className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-100">{summary.predictionsCount}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Palpites</p>
        </div>
        <div className="bg-bg-raised rounded-lg p-2.5 text-center">
          <Star className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-100">{summary.averageRating ?? '—'}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Média</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progresso</span>
          <span>{summary.watchedCount}/50</span>
        </div>
        <div className="bg-bg-base rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </article>
  );
}

export function UsersPage() {
  const { state, login, logout, showToast } = useApp();
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function handleLogin(username, password) {
    await login(username, password);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) return;
    if (!newPassword.trim()) return setCreateError('Senha obrigatória.');
    if (newPassword.length < 3) return setCreateError('Senha deve ter ao menos 3 caracteres.');
    if (newPassword !== confirmPassword) return setCreateError('Senhas não coincidem.');
    setCreating(true);
    try {
      await login(newName.trim(), newPassword.trim());
      setNewName('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="section-title font-display text-2xl">Perfis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cada perfil tem sua própria watchlist, notas e palpites. Use login e senha para proteger seu perfil.
        </p>
      </div>

      {/* Create new */}
      <div className="card p-5 mb-6">
        <p className="meta-label mb-3">Criar novo perfil</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome de usuário"
            className="input w-full"
            maxLength={40}
          />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Senha (mín. 3 caracteres)"
              className="input w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-2.5 text-gray-600 hover:text-gray-400"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input
            type={showPw ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar senha"
            className="input w-full"
          />
          {createError && (
            <p className="text-xs text-danger flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {createError}
            </p>
          )}
          <button
            type="submit"
            disabled={!newName.trim() || !newPassword.trim() || creating}
            className="btn btn-gold px-4 w-full"
          >
            <PlusCircle className="w-4 h-4" />
            {creating ? 'Criando...' : 'Criar perfil'}
          </button>
        </form>
      </div>

      {/* Existing users */}
      {state.userSummaries.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Users className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-medium">Nenhum perfil criado ainda</p>
          <p className="text-sm text-gray-600">
            Crie um perfil para começar a registrar sua watchlist e palpites.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.userSummaries.map((summary) => (
            <UserCard
              key={summary.username}
              summary={summary}
              isActive={summary.username === state.activeUser}
              onSelect={handleLogin}
              onLogout={logout}
            />
          ))}
        </div>
      )}
    </div>
  );
}
