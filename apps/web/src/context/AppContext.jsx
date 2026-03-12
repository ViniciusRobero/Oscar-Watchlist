import { createContext, useContext, useReducer, useCallback } from 'react';
import { api, setCurrentEdition, isAuthenticated as checkAuth, getAccessToken } from '../api.js';

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

function decodeJwtUsername(token) {
  return decodeJwt(token).username || decodeJwt(token).sub || '';
}

const AppContext = createContext(null);

const initialState = {
  films: [],
  categories: [],
  users: [],
  userSummaries: [],
  profile: { films: {}, predictions: {} },
  activeUser: '',
  nick: '',
  officialResults: {},
  edition: '',
  editions: [],
  awards: [],
  currentAward: null,
  loading: true,
  error: null,
  toast: null,
  isAuthenticated: false,
  userRole: 'user',
};

export function reducer(state, action) {
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

        // Try to restore session from refresh token if no username provided
        if (!username) {
          const restored = await api.restoreSession();
          if (restored) {
            const savedUser = localStorage.getItem('oscar_active_user') || '';
            username = savedUser || decodeJwtUsername(getAccessToken() || '');
          }
        }

        const data = await api.bootstrap(username);
        if (data.edition) setCurrentEdition(data.edition);
        const jwtPayload = decodeJwt(getAccessToken() || '');
        hydrate({
          ...data,
          isAuthenticated: checkAuth(),
          userRole: data.userRole || 'user',
          nick: data.nick || jwtPayload.nick || username || '',
        });

        if (username) localStorage.setItem('oscar_active_user', username);
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
      }
    },
    [hydrate]
  );

  const getFilmState = useCallback(
    (filmId) =>
      state.profile.films[filmId] || { watched: false, personalRating: null, personalNotes: '' },
    [state.profile.films]
  );

  const filmById = useCallback(
    (id) => state.films.find((f) => f.id === id),
    [state.films]
  );

  const nomineeById = useCallback(
    (categoryId, nomineeId) => {
      const cat = (state.categories || []).find((c) => c.id === categoryId);
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
        hydrate,
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
