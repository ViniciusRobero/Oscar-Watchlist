import { createContext, useContext } from 'react';

// Re-export context so components that call useApp() still work in tests.
// Usage: wrap your component with <MockAppProvider value={...}>

const AppContext = createContext(null);

export const defaultState = {
  films: [],
  categories: [],
  users: [],
  userSummaries: [],
  profile: { films: {}, predictions: {} },
  activeUser: '',
  officialResults: {},
  edition: '',
  editions: [],
  awards: [],
  currentAward: null,
  loading: false,
  error: null,
  toast: null,
  isAuthenticated: false,
  userRole: 'user',
};

export function MockAppProvider({ children, value = {} }) {
  const ctx = {
    state: { ...defaultState, ...value.state },
    dispatch: value.dispatch || (() => {}),
    bootstrap: value.bootstrap || (() => Promise.resolve()),
    hydrate: value.hydrate || (() => {}),
    showToast: value.showToast || (() => {}),
    getFilmState: value.getFilmState || ((filmId) => {
      const films = (value.state?.profile?.films) || {};
      return films[filmId] || { watched: false, personalRating: null, personalNotes: '' };
    }),
    filmById: value.filmById || (() => undefined),
    nomineeById: value.nomineeById || (() => null),
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

// Monkey-patch the real AppContext module so components that call useApp()
// (from '../context/AppContext.jsx') get our mock context during tests.
// This works because vi.mock() hoists imports.
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within MockAppProvider');
  return ctx;
}
