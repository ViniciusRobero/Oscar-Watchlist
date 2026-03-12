import { useState, useEffect } from 'react';
import {
  PlusCircle, LogIn, Star, Trophy, Eye, Lock, EyeOff,
  AlertCircle, Shield, UserX, UserCheck, Unlock, Trash2, Globe, Key,
  User, Mail, Calendar, AtSign, RefreshCw, CheckCircle, XCircle, Newspaper,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../api.js';

// ── Shared helpers ────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder, autoComplete, autoFocus, name }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        name={name}
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

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ onClose }) {
  const { showToast, state, bootstrap } = useApp();
  const [tab, setTab] = useState('privacy');
  const [isPrivate, setIsPrivate] = useState(state.userSummaries.find(s => s.username === state.activeUser)?.isPrivate ?? true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const TABS = ['privacy', 'profile', 'password'];
  const TAB_LABELS = { privacy: 'Privacidade', profile: 'Perfil', password: 'Alterar senha' };

  async function savePrivacy() {
    setLoading(true); setError('');
    try {
      await api.updateSettings(state.activeUser, { isPrivate });
      await bootstrap(state.activeUser);
      showToast(isPrivate ? 'Perfil agora é privado.' : 'Perfil público — aparece na comparação de palpites.');
      onClose();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setError('');
    const patch = {};
    if (firstName.trim()) patch.firstName = firstName.trim();
    if (lastName.trim()) patch.lastName = lastName.trim();
    if (email.trim()) patch.email = email.trim().toLowerCase();
    if (birthDate) patch.birthDate = birthDate;
    if (Object.keys(patch).length === 0) return setError('Preencha ao menos um campo.');
    setLoading(true);
    try {
      await api.updateSettings(state.activeUser, patch);
      showToast('Perfil atualizado!');
      setFirstName(''); setLastName(''); setEmail(''); setBirthDate('');
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
      <div className="flex gap-1 bg-bg-raised rounded-lg p-1">
        {TABS.map(t => (
          <button key={t}
            onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors font-medium ${tab === t ? 'bg-bg-hover text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'privacy' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Contas públicas permitem comparação de palpites com outros usuários.
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
              : <><Globe className="w-4 h-4" /> Público — disponível para comparação</>
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

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="Novo nome" className="input text-sm" maxLength={60} />
            <input value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Novo sobrenome" className="input text-sm" maxLength={60} />
          </div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Novo email" className="input w-full text-sm" />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data de nascimento</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              className="input w-full text-sm" />
          </div>
          {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn btn-gold text-xs py-1.5 px-3 flex-1">
              {loading ? 'Salvando...' : 'Salvar perfil'}
            </button>
            <button type="button" onClick={onClose} className="btn text-xs py-1.5 px-3">Cancelar</button>
          </div>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={savePassword} className="space-y-2">
          <PasswordInput value={currentPw} onChange={e => setCurrentPw(e.target.value)}
            placeholder="Senha atual" autoComplete="current-password" autoFocus name="currentPassword" />
          <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="Nova senha (mín. 6 caracteres)" autoComplete="new-password" name="newPassword" />
          <PasswordInput value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            placeholder="Confirmar nova senha" autoComplete="new-password" name="confirmPassword" />
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

// ── Active user card ──────────────────────────────────────────────────────────

function ActiveUserCard({ onLogout }) {
  const { state } = useApp();
  const [showSettings, setShowSettings] = useState(false);
  const summary = state.userSummaries.find(s => s.username === state.activeUser) || {};
  const totalFilms = state.films.length;
  const progressPct = totalFilms > 0 ? Math.round(((summary.watchedCount || 0) / totalFilms) * 100) : 0;

  return (
    <div className="card p-5 border-gold-dim ring-1 ring-gold-dim/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gold" />
            <h3 className="font-bold text-gray-100">{state.activeUser}</h3>
            {state.nick && state.nick !== state.activeUser && (
              <span className="text-xs text-gray-500">@{state.nick}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge badge-gold text-[10px] py-0.5 px-2">Perfil ativo</span>
            {summary.isPrivate !== undefined && (
              summary.isPrivate
                ? <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 border border-border rounded-full px-2 py-0.5"><Lock className="w-2.5 h-2.5" />Privado</span>
                : <span className="inline-flex items-center gap-1 text-[10px] text-gold/70 border border-gold/20 rounded-full px-2 py-0.5"><Globe className="w-2.5 h-2.5" />Público</span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowSettings(v => !v)}
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-bg-raised rounded-lg p-2.5 text-center">
          <Eye className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-100">{summary.watchedCount ?? 0}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">Assistidos</p>
        </div>
        <div className="bg-bg-raised rounded-lg p-2.5 text-center">
          <Trophy className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-100">{summary.predictionsCount ?? 0}</p>
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
          <span>{summary.watchedCount ?? 0}/{totalFilms}</span>
        </div>
        <div className="bg-bg-base rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold-dim to-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────

function LoginForm({ onLogin }) {
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nick.trim() || !password.trim()) return;
    setLoading(true); setError('');
    try {
      await onLogin(nick.trim().toLowerCase(), password.trim());
    } catch (err) {
      setError(err.message || 'Erro ao fazer login.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <AtSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-600" />
        <input
          value={nick}
          onChange={e => setNick(e.target.value)}
          placeholder="Nick"
          autoComplete="username"
          className="input w-full pl-8 text-sm"
          autoFocus
        />
      </div>
      <PasswordInput value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Senha" autoComplete="current-password" name="password" />
      {error && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
      <button type="submit" disabled={!nick.trim() || !password.trim() || loading}
        className="btn btn-gold w-full">
        <LogIn className="w-4 h-4" />
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────────────────────

function RegisterForm({ onRegister }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nick, setNick] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nickNormalized = nick.toLowerCase().replace(/[^a-z0-9_.]/g, '');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) return setError('Nome é obrigatório.');
    if (!lastName.trim()) return setError('Sobrenome é obrigatório.');
    const n = nick.trim().toLowerCase();
    if (!n || n.length < 3 || n.length > 20) return setError('Nick deve ter entre 3 e 20 caracteres.');
    if (!/^[a-z0-9_.]+$/.test(n)) return setError('Nick: apenas letras minúsculas, números, ponto e underscore.');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Email inválido.');
    if (password.length < 6) return setError('Senha deve ter ao menos 6 caracteres.');
    if (password !== confirmPassword) return setError('Senhas não coincidem.');
    setLoading(true);
    try {
      await onRegister({ nick: n, password, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim().toLowerCase(), birthDate: birthDate || null });
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <User className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-600" />
          <input value={firstName} onChange={e => setFirstName(e.target.value)}
            placeholder="Nome" autoComplete="given-name"
            className="input w-full pl-8 text-sm" maxLength={60} />
        </div>
        <input value={lastName} onChange={e => setLastName(e.target.value)}
          placeholder="Sobrenome" autoComplete="family-name"
          className="input w-full text-sm" maxLength={60} />
      </div>
      <div className="relative">
        <AtSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-600" />
        <input
          value={nickNormalized}
          onChange={e => setNick(e.target.value)}
          placeholder="nick (3-20 chars, letras minúsculas)"
          autoComplete="username"
          className="input w-full pl-8 text-sm"
          maxLength={20}
        />
      </div>
      <div className="relative">
        <Mail className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-600" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="input w-full pl-8 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Data de nascimento <span className="text-gray-600">(opcional)</span>
        </label>
        <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
          className="input w-full text-sm" />
      </div>
      <PasswordInput value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Senha (mín. 6 caracteres)" autoComplete="new-password" name="newPassword" />
      <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
        placeholder="Confirmar senha" autoComplete="new-password" name="confirmPassword" />
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn btn-gold w-full">
        <PlusCircle className="w-4 h-4" />
        {loading ? 'Criando...' : 'Criar conta'}
      </button>
      <p className="text-xs text-gray-600 text-center">
        Novos perfis são privados por padrão. Você pode habilitá-los para comparação de palpites nas configurações.
      </p>
    </form>
  );
}

// ── Results Sync Panel ────────────────────────────────────────────────────────

function SyncPanel() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState(null);

  async function handleSync() {
    setLoading(true);
    try {
      const data = await api.admin.syncResults();
      setLog(data.log);
      if (data.log?.matched?.length) {
        showToast(`${data.log.matched.length} resultado(s) importado(s) — fonte: ${data.log.source}`);
      } else {
        showToast('Nenhum resultado encontrado ainda.', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Erro ao sincronizar.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const SOURCE_LABEL = { wikipedia: 'Wikipedia', wikidata: 'Wikidata', 'newsapi-headlines-only': 'NewsAPI' };

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gold" /> Sincronizar Resultados Oficiais
        </h3>
        <button
          onClick={handleSync}
          disabled={loading}
          className="btn btn-gold text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Buscando...' : 'Sincronizar agora'}
        </button>
      </div>
      <p className="text-[11px] text-gray-600">
        Busca vencedores automaticamente em Wikipedia → Wikidata → NewsAPI.
        O cron roda a cada 15 min nas madrugadas de domingo/segunda em março (UTC).
      </p>

      {log && (
        <div className="bg-bg-base rounded-xl border border-border p-3 space-y-2 text-xs">
          <div className="flex gap-3 text-gray-400">
            <span>Fonte: <span className="text-gold font-medium">{SOURCE_LABEL[log.source] || log.source || '—'}</span></span>
            {log.completedAt && <span className="text-gray-600">{new Date(log.completedAt).toLocaleTimeString('pt-BR')}</span>}
          </div>

          {log.matched?.length > 0 && (
            <div className="space-y-1">
              <p className="text-green-500 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {log.matched.length} categoria(s) importada(s)
              </p>
              <div className="max-h-28 overflow-y-auto space-y-0.5">
                {log.matched.map((m, i) => (
                  <div key={i} className="flex gap-2 text-gray-500">
                    <span className="text-gray-600 shrink-0">{m.categoryId}</span>
                    <span className="text-gray-400 truncate">{m.winner}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.unmatched?.length > 0 && (
            <div className="space-y-1">
              <p className="text-orange-400 font-medium flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {log.unmatched.length} sem correspondência (insira manualmente)
              </p>
              <div className="max-h-20 overflow-y-auto space-y-0.5">
                {log.unmatched.map((m, i) => (
                  <div key={i} className="flex gap-2 text-gray-500">
                    <span className="text-gray-600 shrink-0">{m.categoryId}</span>
                    <span className="truncate">{m.winner}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.newsHeadlines?.length > 0 && (
            <details className="text-gray-600">
              <summary className="cursor-pointer flex items-center gap-1 text-gray-500 hover:text-gray-300">
                <Newspaper className="w-3 h-3" /> {log.newsHeadlines.length} manchete(s) do NewsAPI
              </summary>
              <div className="mt-1 space-y-0.5 pl-4">
                {log.newsHeadlines.map((h, i) => (
                  <a key={i} href={h.url} target="_blank" rel="noreferrer"
                    className="block truncate text-blue-500/70 hover:text-blue-400">
                    {h.title}
                  </a>
                ))}
              </div>
            </details>
          )}

          {Object.keys(log.errors || {}).length > 0 && (
            <div className="text-red-400/80 space-y-0.5">
              {Object.entries(log.errors).map(([k, v]) => (
                <p key={k}><span className="font-medium">{k}:</span> {v}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────

function AdminPanel({ edition }) {
  const { showToast } = useApp();
  const [users, setUsers] = useState([]);
  const [locked, setLocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [changingPasswordFor, setChangingPasswordFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');

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

  useEffect(() => { refresh(); }, []);

  async function handleAction(action, username, nick) {
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

  async function handleChangePassword(nick) {
    if (!newPassword || newPassword.length < 6) {
      showToast('Senha deve ter ao menos 6 caracteres.', 'error');
      return;
    }
    setActionLoading(`password-${nick}`);
    try {
      await api.admin.changePassword(nick, newPassword);
      showToast(`Senha de "@${nick}" alterada.`);
      setChangingPasswordFor(null);
      setNewPassword('');
    } catch (e) {
      showToast(e.message || 'Erro ao alterar senha.', 'error');
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
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-300">↻ Atualizar</button>
        <span className="text-xs text-gray-500">{users.length} usuário(s)</span>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-gray-600 py-4 text-center">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const isLocked = u.isLocked;
            return (
              <div key={u.username}
                className={`p-3 rounded-xl border transition-colors ${
                  !u.isActive ? 'border-red-900/30 bg-red-950/10' : 'border-border bg-bg-raised'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-100">{u.username}</span>
                      {u.nick && u.nick !== u.username && (
                        <span className="text-xs text-gray-500">@{u.nick}</span>
                      )}
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
                    {(u.firstName || u.lastName || u.email) && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {[u.firstName, u.lastName].filter(Boolean).join(' ')}
                        {u.email && <span className="ml-2 text-gray-600">{u.email}</span>}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {u.watchedCount ?? 0} filmes · {u.predictionsCount ?? 0} palpites
                      {u.averageRating ? ` · ★ ${u.averageRating}` : ''}
                    </p>
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    {isLocked && (
                      <button
                        onClick={() => handleAction('unblock', u.username, u.nick)}
                        disabled={!!actionLoading}
                        className="btn text-xs py-1 px-2 text-orange-400 border-orange-900/40 hover:border-orange-700/60"
                        title="Desbloquear"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => { setChangingPasswordFor(changingPasswordFor === u.nick ? null : u.nick); setNewPassword(''); }}
                      disabled={!!actionLoading}
                      className="btn text-xs py-1 px-2 text-blue-400 border-blue-900/40 hover:border-blue-700/60"
                      title="Alterar senha"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    {u.role !== 'admin' && (
                      <>
                        {u.isActive ? (
                          <button
                            onClick={() => handleAction('deactivate', u.username, u.nick)}
                            disabled={!!actionLoading}
                            className="btn text-xs py-1 px-2 text-yellow-500 border-yellow-900/40 hover:border-yellow-700/60"
                            title="Desativar conta"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction('activate', u.username, u.nick)}
                            disabled={!!actionLoading}
                            className="btn text-xs py-1 px-2 text-green-500 border-green-900/40 hover:border-green-700/60"
                            title="Ativar conta"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleAction('delete', u.username, u.nick)}
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

                {changingPasswordFor === u.nick && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nova senha (mín. 6 chars)"
                      className="input flex-1 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleChangePassword(u.nick)}
                      disabled={!!actionLoading || newPassword.length < 6}
                      className="btn btn-gold text-xs py-1.5 px-3"
                    >
                      {actionLoading === `password-${u.nick}` ? '...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => { setChangingPasswordFor(null); setNewPassword(''); }}
                      className="btn text-xs py-1.5 px-3"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SyncPanel />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { state } = useApp();
  const { login, register, logout } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const isAdmin = state.userRole === 'admin';
  const isLoggedIn = state.isAuthenticated && !!state.activeUser;

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="section-title font-display text-2xl">Perfil</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie sua conta e configurações.
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

      {/* Logged-in view: show own profile card */}
      {isLoggedIn ? (
        <ActiveUserCard onLogout={logout} />
      ) : (
        /* Not logged in: login or register */
        <div className="space-y-4">
          {!showRegister ? (
            <div className="card p-5">
              <p className="meta-label mb-4">Entrar na sua conta</p>
              <LoginForm onLogin={login} />
              <p className="text-xs text-gray-600 text-center mt-4">
                Não tem conta?{' '}
                <button onClick={() => setShowRegister(true)} className="text-gold hover:text-gold-light underline">
                  Criar conta
                </button>
              </p>
            </div>
          ) : (
            <div className="card p-5">
              <p className="meta-label mb-4">Criar nova conta</p>
              <RegisterForm onRegister={register} />
              <p className="text-xs text-gray-600 text-center mt-4">
                Já tem conta?{' '}
                <button onClick={() => setShowRegister(false)} className="text-gold hover:text-gold-light underline">
                  Fazer login
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
