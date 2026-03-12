import { useCallback } from 'react';
import { api, setCurrentEdition, clearTokens, isAuthenticated as checkAuth, getAccessToken } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

function decodeJwtUsername(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.username || payload.sub || '';
  } catch {
    return '';
  }
}

/**
 * Authentication actions: login, register, logout, restoreSession.
 * Reads/writes AppContext state via dispatch + hydrate.
 */
export function useAuth() {
  const { state, dispatch, showToast } = useApp();

  const hydrate = useCallback((data) => {
    dispatch({ type: 'HYDRATE', payload: data });
  }, [dispatch]);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    if (username) localStorage.setItem('oscar_active_user', username);
    hydrate({ ...data, isAuthenticated: true, userRole: data.userRole || 'user' });
    showToast(`Bem-vindo, ${username}!`);
  }, [hydrate, showToast]);

  const register = useCallback(async (username, password) => {
    const data = await api.register(username, password);
    if (username) localStorage.setItem('oscar_active_user', username);
    hydrate({ ...data, isAuthenticated: true, userRole: 'user' });
    showToast(`Conta criada! Bem-vindo, ${username}!`);
  }, [hydrate, showToast]);

  const logout = useCallback(async () => {
    await api.logout();
    dispatch({
      type: 'HYDRATE',
      payload: {
        activeUser: '',
        profile: { films: {}, predictions: {} },
        officialResults: {},
        isAuthenticated: false,
        userRole: 'user',
      },
    });
    showToast('Saiu do perfil.');
  }, [dispatch, showToast]);

  const restoreSession = useCallback(async (editionId = '') => {
    dispatch({ type: 'SET_LOADING', payload: true });
    if (editionId) setCurrentEdition(editionId);
    const restored = await api.restoreSession();
    if (!restored) return null;
    const savedUser = localStorage.getItem('oscar_active_user') || '';
    return savedUser || decodeJwtUsername(getAccessToken() || '');
  }, [dispatch]);

  return { login, register, logout, restoreSession, isAuthenticated: state.isAuthenticated, userRole: state.userRole };
}
