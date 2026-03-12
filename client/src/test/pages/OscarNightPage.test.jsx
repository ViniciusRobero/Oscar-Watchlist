import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockAppProvider } from '../helpers/mockAppContext.jsx';

vi.mock('../../context/AppContext.jsx', () => import('../helpers/mockAppContext.jsx'));

vi.mock('framer-motion', () => ({
  motion: {
    article: ({ children, ...props }) => <article {...props}>{children}</article>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

vi.mock('../../api.js', () => ({
  api: {
    savePrediction: vi.fn(() => Promise.resolve({ predictions: {} })),
    setOfficialWinner: vi.fn(() => Promise.resolve({ officialResults: {} })),
    updateFilm: vi.fn(() =>
      Promise.resolve({ filmState: { watched: false, personalRating: null, personalNotes: '' } })
    ),
  },
  setCurrentEdition: vi.fn(),
  isAuthenticated: vi.fn(() => false),
  getAccessToken: vi.fn(() => null),
}));

beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ posterUrl: null }) })
  );
});

import { OscarNightPage } from '../../pages/OscarNightPage.jsx';

const categories = [
  {
    id: 'best-picture',
    name: 'Melhor Filme',
    highlight: true,
    nominees: [
      { id: 'nom-1', filmId: 'film-1', nomineeName: null },
      { id: 'nom-2', filmId: 'film-2', nomineeName: null },
    ],
  },
  {
    id: 'best-director',
    name: 'Melhor Diretor',
    highlight: false,
    nominees: [
      { id: 'nom-3', filmId: 'film-1', nomineeName: 'Christopher Nolan' },
    ],
  },
];

const films = [
  { id: 'film-1', title: 'Oppenheimer', nominations: 13 },
  { id: 'film-2', title: 'Barbie', nominations: 8 },
];

function renderOscarNightPage(stateOverrides = {}, contextOverrides = {}) {
  const filmById = (filmId) => films.find((f) => f.id === filmId);
  const defaultState = {
    films,
    categories,
    activeUser: '',
    profile: { films: {}, predictions: {} },
    officialResults: {},
    userRole: 'user',
  };
  return render(
    <MockAppProvider
      value={{
        state: { ...defaultState, ...stateOverrides },
        filmById,
        ...contextOverrides,
      }}
    >
      <OscarNightPage />
    </MockAppProvider>
  );
}

describe('OscarNightPage', () => {
  it('shows "Noite do Oscar" heading', () => {
    renderOscarNightPage();
    expect(screen.getByText('Noite do Oscar')).toBeInTheDocument();
  });

  it('shows category names in the list', () => {
    renderOscarNightPage();
    expect(screen.getByText('Melhor Filme')).toBeInTheDocument();
    expect(screen.getByText('Melhor Diretor')).toBeInTheDocument();
  });

  it('shows correct prediction score when official results exist', () => {
    // User predicted nom-1 for best-picture and nom-3 for best-director.
    // Official results are nom-1 for best-picture (correct) and nom-3 for best-director (correct).
    const predictions = {
      'best-picture': 'nom-1',
      'best-director': 'nom-3',
    };
    const officialResults = {
      'best-picture': 'nom-1',
      'best-director': 'nom-3',
    };
    renderOscarNightPage({
      activeUser: 'alice',
      profile: { films: {}, predictions },
      officialResults,
    });

    // The "Acertos" label is shown in the stats grid; its sibling p shows correctCount = 2
    const acertosLabel = screen.getByText('Acertos');
    expect(acertosLabel).toBeInTheDocument();
    // The parent card contains the score above the label
    const scoreEl = acertosLabel.closest('.card').querySelector('p:first-child');
    expect(scoreEl.textContent).toBe('2');
  });

  it('shows 0 correct when no official results', () => {
    renderOscarNightPage({
      activeUser: 'alice',
      profile: { films: {}, predictions: { 'best-picture': 'nom-1' } },
      officialResults: {},
    });

    // With no official results, correctCount = 0
    const acertosLabel = screen.getByText('Acertos');
    expect(acertosLabel).toBeInTheDocument();
    // The parent card contains the score above the label
    const scoreEl = acertosLabel.closest('.card').querySelector('p:first-child');
    expect(scoreEl.textContent).toBe('0');
  });
});
