import { useState, useEffect } from 'react';
import {
  PlusCircle, LogIn, Users, Star, Trophy, Eye, Lock, EyeOff,
  AlertCircle, Shield, UserX, UserCheck, Unlock, Trash2, Globe, EyeOff as PrivateIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../api.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="input w-full pr-10 text-sm"
      />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-2.5 text-gray-600 hover:text-gray-400">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Own-user settings panel ───────────────────────────────────────────────────

function SettingsPanel({ summary, onClose }) {
  const { showToast, state, bootstrap } = useApp();
  const [tab, setTab] = useState('privacy');
  const [isPrivate, setIsPrivate] = useState(summary.isPrivate ?? true);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function savePrivacy() {
    setLoading(true); setError('');
    try {
      await api.updateSettings(state.activeUser, { isPrivate });
      await bootstrap(state.activeUser);
      showToast(isPrivate ? 'Perfil agora é privado.' : 'Perfil agora é público.');
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) return setError('Nova senha deve ter ao menos 6 caracteres.');
    if (newPw !== confirmPw) return setError('Senhas não coincidem.');
    setLoading(true);
    try {
      await api.updateSettings(state.activeUser, { currentPassword: currentPw, newPassword: newPw });
      showToast('Senha alterada com sucesso!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-bg-raised rounded-lg p-1">
        <button
          onClick={() => { setTab('privacy'); setError(''); }}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${tab === 'privacy' ? 'bg-bg-hover text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Privacidade
        </button>
        <button
          onClick={() => { setTab('password'); setError(''); }}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${tab === 'password' ? 'bg-bg-hover text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Alterar senha
        </button>
      </div>

      {tab === 'privacy' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Contas privadas não aparecem na lista pública de perfis.
          </p>
          <button
            onClick={() => setIsPrivate(v => !v)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium ${
              isPrivate
                ? 'border-border bg-bg-raised text-gray-300'
                : 'border-gold/40 bg-gold-muted text-gold'
            }`}
          >
            {isPrivate
              ? <><Lock className="w-4 h-4 text-gray-500" /> Perfil privado (padrão)</>
              : <><Globe className="w-4 h-4" /> Perfil público (visível a todos)</>
            }
          </button>
          {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          <div className="flex gap-2">
            <button onClick={savePrivacy} disabled={loading} className="btn btn-gold text-xs py-1.5 px-3 flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose} className="btn text-xs py-1.5 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <form onSubmit={savePassword} className="space-y-2">
          <PasswordInput value={currentPw} onChange={e => setCurrentPw(e.target.value)}
            placeholder="Senha atual" autoComplete="current-password" autoFocus />
          <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="Nova senha (mín. 6 caracteres)" autoComplete="new-password" />
          <PasswordInput value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            placeholder="Confirmar nova senha" autoComplete="new-password" />
          {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !currentPw || !newPw || !confirmPw}
              className="btn btn-gold text-xs py-1.5 px-3 flex-1">
              {loading ? 'Salvando...' : 'Alterar senha'}
            </button>
            <button type="button" onClick={onClose} className="btn text-xs py-1.5 px-3">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── User Card ─────────────────────────────────────────────────────────────────

function UserCard({ summary, isActive, onSelect, onLogout, totalFilms }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const progressPct = totalFilms > 0 ? Math.round((summary.watchedCount / totalFilms) * 100) : 0;

  async function handleLogin(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!password.trim()) return;
    setLoading(true); setError('');
    try {
      await onSelect(summary.username, password.trim());
      setShowLogin(false); setPassword('');
    } catch (err) {
      setError(err.message || 'Senha incorreta.');
    } finally { setLoading(false); }
  }

  const privacyBadge = isActive ? (
    summary.isPrivate
      ? <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 border border-border rounded-full px-2 py-0.5"><Lock className="w-2.5 h-2.5" />Privado</span>
      : <span className="inline-flex items-center gap-1 text-[10px] text-gold/70 border border-gold/20 rounded-full px-2 py-0.5"><Globe className="w-2.5 h-2.5" />Público</span>
  ) : null;

  return (
    <article className={`card p-5 transition-all duration-150 ${isActive ? 'border-gold-dim ring-1 ring-gold-dim/30' : 'hover:border-border-active hover:shadow-xl hover:shadow-black/30'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-gold' : 'bg-gray-700'}`} />
            <h3 className="font-bold text-gray-100">{summary.username}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isActive && <span className="badge badge-gold text-[10px] py-0.5 px-2">Perfil ativo</span>}
            {privacyBadge}
          </div>
        </div>
        <div className="flex gap-1.5">
          {isActive && (
            <>
              <button
                onClick={() => { setShowSettings(v => !v); setShowLogin(false); setError(''); }}
                className="btn btn-ghost text-xs py-1.5 px-3"
                title="Configurações"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { if (window.confirm('Sair do perfil?')) onLogout(); }}
                className="btn text-xs py-1.5 px-3 text-red-400 border-red-900/40 hover:border-red-700/60"
              >
                Sair
              </button>
            </>
          )}
          {!isActive && !showLogin && (
            <button onClick={() => setShowLogin(true)} className="btn text-xs py-1.5 px-3">
              <LogIn className="w-3.5 h-3.5" /> Entrar
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <form onSubmit={handleLogin} className="mb-3 flex flex-col gap-2">
          <div className="relative">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Digite a senha" className="input w-full text-sm pr-8" autoFocus />
            <Lock className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-600" />
          </div>
          {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!password.trim() || loading} className="btn btn-gold text-xs py-1.5 px-3 flex-1">
              {loading ? 'Entrando...' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => { setShowLogin(false); setPassword(''); setError(''); }} className="btn text-xs py-1.5 px-3">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showSettings && isActive && (
        <SettingsPanel summary={summary} onClose={() => setShowSettings(false)} />
      )}

      <div className="grid grid-cols-3 gap-2 mb-3 mt-2">
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
          <span>{summary.watchedCount}/{totalFilms}</span>
        </div>
        <div className="bg-bg-base rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </article>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────

function AdminPanel({ edition }) {
  const { showToast } = useApp();
  const [users, setUsers] = useState([]);
  const [locked, setLocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.admin.listUsers(edition);
      setUsers(data.users || []);
      setLocked(data.locked || []);
    } catch (e) {
      showToast(e.message || 'Erro ao carregar usuários.', 'error');
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, [edition]);

  async function handleAction(action, username) {
    setActionLoading(`${action}-${username}`);
    try {
      if (action === 'delete') {
        if (!window.confirm(`Excluir permanentemente o usuário "${username}" e todos os seus dados?`)) return;
        await api.admin.deleteUser(username);
        showToast(`Usuário "${username}" excluído.`);
      } else if (action === 'activate') {
        await api.admin.setActive(username, true);
        showToast(`Usuário "${username}" ativado.`);
      } else if (action === 'deactivate') {
        await api.admin.setActive(username, false);
        showToast(`Usuário "${username}" desativado.`);
      } else if (action === 'unblock') {
        await api.admin.unblock(username);
        showToast(`Bloqueio de "${username}" removido.`);
      }
      await refresh();
    } catch (e) {
      showToast(e.message || 'Erro ao executar ação.', 'error');
    } finally {
      setActionLoading('');
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-600">Carregando...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold" /> Painel Admin
        </h2>
        <span className="text-xs text-gray-500">{users.length} usuário(s)</span>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-gray-600 py-4 text-center">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const isLocked = u.isLocked;
            const key = u.username;
            return (
              <div key={key}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  !u.isActive ? 'border-red-900/30 bg-red-950/10' : 'border-border bg-bg-raised'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-100 truncate">{u.username}</span>
                    {u.role === 'admin' && (
                      <span className="text-[10px] badge badge-gold py-0.5 px-2">Admin</span>
                    )}
                    {!u.isActive && (
                      <span className="text-[10px] text-red-400 border border-red-900/50 rounded-full px-2 py-0.5">Inativo</span>
                    )}
                    {u.isPrivate ? (
                      <span className="text-[10px] text-gray-500 border border-border rounded-full px-2 py-0.5">Privado</span>
                    ) : (
                      <span className="text-[10px] text-gold/60 border border-gold/20 rounded-full px-2 py-0.5">Público</span>
                    )}
                    {isLocked && (
                      <span className="text-[10px] text-orange-400 border border-orange-900/50 rounded-full px-2 py-0.5">Bloqueado</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {u.watchedCount ?? 0} filmes · {u.predictionsCount ?? 0} palpites
                    {u.averageRating ? ` · ★ ${u.averageRating}` : ''}
                  </p>
                </div>

                <div className="flex gap-1.5 flex-shrink-0">
                  {isLocked && (
                    <button
                      onClick={() => handleAction('unblock', u.username)}
                      disabled={!!actionLoading}
                      className="btn text-xs py-1 px-2 text-orange-400 border-orange-900/40 hover:border-orange-700/60"
                      title="Desbloquear"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {u.role !== 'admin' && (
                    <>
                      {u.isActive ? (
                        <button
                          onClick={() => handleAction('deactivate', u.username)}
                          disabled={!!actionLoading}
                          className="btn text-xs py-1 px-2 text-yellow-500 border-yellow-900/40 hover:border-yellow-700/60"
                          title="Desativar conta"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction('activate', u.username)}
                          disabled={!!actionLoading}
                          className="btn text-xs py-1 px-2 text-green-500 border-green-900/40 hover:border-green-700/60"
                          title="Ativar conta"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleAction('delete', u.username)}
                        disabled={!!actionLoading}
                        className="btn text-xs py-1 px-2 text-red-400 border-red-900/40 hover:border-red-700/60"
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { state, showToast } = useApp();
  const { login, register, logout } = useAuth();
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);

  const isAdmin = state.userRole === 'admin';
  const isFormValid = newName.trim().length >= 2 && newPassword.length >= 6 && newPassword === confirmPassword;
  const totalFilms = state.films.length;

  async function handleLogin(username, password) {
    await login(username, password);
    localStorage.setItem('oscar_active_user', username);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) return;
    if (!newPassword.trim()) return setCreateError('Senha obrigatória.');
    if (newPassword.length < 6) return setCreateError('Senha deve ter ao menos 6 caracteres.');
    if (newPassword !== confirmPassword) return setCreateError('Senhas não coincidem.');
    setCreating(true);
    try {
      await register(newName.trim(), newPassword.trim());
      localStorage.setItem('oscar_active_user', newName.trim());
      setNewName(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="section-title font-display text-2xl">Perfis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cada perfil tem sua própria watchlist, notas e palpites.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdmin(v => !v)}
            className={`btn text-xs py-2 px-3 flex items-center gap-1.5 flex-shrink-0 ${showAdmin ? 'btn-gold' : ''}`}
          >
            <Shield className="w-3.5 h-3.5" />
            {showAdmin ? 'Ocultar admin' : 'Painel admin'}
          </button>
        )}
      </div>

      {/* Admin panel */}
      {isAdmin && showAdmin && (
        <div className="card p-5 mb-6">
          <AdminPanel edition={state.edition} />
        </div>
      )}

      {/* Create new profile */}
      <div className="card p-5 mb-6">
        <p className="meta-label mb-3">Criar novo perfil</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            name="username"
            autoComplete="username"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome de usuário"
            className="input w-full"
            maxLength={40}
          />
          <div className="relative">
            <input
              name="password"
              autoComplete="new-password"
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="input w-full pr-10"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-2.5 text-gray-600 hover:text-gray-400">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input
            name="confirmPassword"
            autoComplete="new-password"
            type={showPw ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirmar senha"
            className="input w-full"
          />
          {createError && (
            <p className="text-xs text-danger flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {createError}
            </p>
          )}
          <button type="submit" disabled={!isFormValid || creating} className="btn btn-gold px-4 w-full">
            <PlusCircle className="w-4 h-4" />
            {creating ? 'Criando...' : 'Criar perfil'}
          </button>
          <p className="text-xs text-gray-600 text-center">
            Novos perfis são privados por padrão. Você pode torná-lo público nas configurações.
          </p>
        </form>
      </div>

      {/* Public profiles */}
      {state.userSummaries.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Users className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-medium">Nenhum perfil público ainda</p>
          <p className="text-sm text-gray-600">
            {state.activeUser
              ? 'Torne seu perfil público nas configurações para aparecer aqui.'
              : 'Crie um perfil e torne-o público para aparecer aqui.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.userSummaries.map(summary => (
            <UserCard
              key={summary.username}
              summary={summary}
              isActive={summary.username === state.activeUser}
              onSelect={handleLogin}
              onLogout={logout}
              totalFilms={totalFilms}
            />
          ))}
        </div>
      )}
    </div>
  );
}
