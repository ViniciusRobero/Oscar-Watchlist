import { createContext, useContext, useReducer, useCallback } from 'react';
import { api, setCurrentEdition } from '../api.js';

const AppContext = createContext(null);

const initialState = {
  films: [],
  categories: [],
  users: [],
  userSummaries: [],
  profile: { films: {}, predictions: {} },
  activeUser: '',
  officialResults: {},
  edition: '',
  editions: [],
  loading: true,
  error: null,
  toast: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        ...action.payload,
        loading: false,
        error: null,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    case 'UPDATE_FILM_STATE': {
      const { filmId, filmState } = action.payload;
      return {
        ...state,
        profile: {
          ...state.profile,
          films: { ...state.profile.films, [filmId]: filmState },
        },
      };
    }
    case 'UPDATE_PREDICTIONS':
      return {
        ...state,
        profile: { ...state.profile, predictions: action.payload },
      };
    case 'UPDATE_OFFICIAL_RESULTS':
      return { ...state, officialResults: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydrate = useCallback((data) => {
    dispatch({ type: 'HYDRATE', payload: data });
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: 'SET_TOAST', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 2800);
  }, []);

  const bootstrap = useCallback(
    async (username = '', editionId = '') => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        if (editionId) setCurrentEdition(editionId);
        const data = await api.bootstrap(username);
        // Sync edition to api module
        if (data.edition) setCurrentEdition(data.edition);
        hydrate(data);
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
      }
    },
    [hydrate]
  );

  const switchEdition = useCallback(
    async (editionId) => {
      setCurrentEdition(editionId);
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const data = await api.bootstrap(state.activeUser);
        if (data.edition) setCurrentEdition(data.edition);
        hydrate(data);
        showToast(`Edição: ${data.editions?.find(e => e.id === data.edition)?.label || data.edition}`);
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
      }
    },
    [state.activeUser, hydrate, showToast]
  );

  const login = useCallback(
    async (username, password) => {
      const data = await api.login(username, password);
      hydrate(data);
      showToast(`Bem-vindo, ${username}!`);
    },
    [hydrate, showToast]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('oscar_active_user');
    dispatch({ type: 'HYDRATE', payload: { activeUser: '', profile: { films: {}, predictions: {} } } });
    showToast('Saiu do perfil.');
  }, [showToast]);

  const updateFilm = useCallback(
    async (filmId, patch) => {
      if (!state.activeUser) throw new Error('Nenhum usuário ativo.');
      const { filmState } = await api.updateFilm(state.activeUser, filmId, patch);
      dispatch({ type: 'UPDATE_FILM_STATE', payload: { filmId, filmState } });
    },
    [state.activeUser]
  );

  const savePrediction = useCallback(
    async (categoryId, nomineeId) => {
      if (!state.activeUser) throw new Error('Nenhum usuário ativo.');
      // Optimistic update — UI responds immediately
      dispatch({
        type: 'UPDATE_PREDICTIONS',
        payload: { ...state.profile.predictions, [categoryId]: nomineeId },
      });
      try {
        const { predictions } = await api.savePrediction(state.activeUser, categoryId, nomineeId);
        dispatch({ type: 'UPDATE_PREDICTIONS', payload: predictions });
      } catch (e) {
        // Roll back on failure
        dispatch({ type: 'UPDATE_PREDICTIONS', payload: state.profile.predictions });
        throw e;
      }
    },
    [state.activeUser, state.profile.predictions]
  );

  const setOfficialWinner = useCallback(async (categoryId, nomineeId) => {
    const { officialResults } = await api.setOfficialWinner(categoryId, nomineeId);
    dispatch({ type: 'UPDATE_OFFICIAL_RESULTS', payload: officialResults });
    showToast('Resultado oficial salvo!');
  }, [showToast]);

  const getFilmState = useCallback(
    (filmId) =>
      state.profile.films[filmId] || { watched: false, personalRating: null, personalNotes: '' },
    [state.profile.films]
  );

  const filmById = useCallback(
    (id) => state.films.find((f) => f.id === id),
    [state.films]
  );

  // Find a nominee by its ID across all categories
  const nomineeById = useCallback(
    (categoryId, nomineeId) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return null;
      return cat.nominees?.find((n) => n.id === nomineeId) || null;
    },
    [state.categories]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        bootstrap,
        switchEdition,
        login,
        logout,
        updateFilm,
        savePrediction,
        setOfficialWinner,
        getFilmState,
        filmById,
        nomineeById,
        showToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
