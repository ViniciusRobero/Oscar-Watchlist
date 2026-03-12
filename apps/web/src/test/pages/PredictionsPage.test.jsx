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

import { PredictionsPage } from '../../pages/PredictionsPage.jsx';

const categories = [
  {
    id: 'best-picture',
    name: 'Melhor Filme',
    nominees: [
      { id: 'nom-1', filmId: 'film-1', nomineeName: null },
      { id: 'nom-2', filmId: 'film-2', nomineeName: null },
    ],
  },
  {
    id: 'best-director',
    name: 'Melhor Diretor',
    nominees: [
      { id: 'nom-3', filmId: 'film-1', nomineeName: 'Christopher Nolan' },
    ],
  },
  {
    id: 'best-actress',
    name: 'Melhor Atriz',
    nominees: [
      { id: 'nom-4', filmId: 'film-3', nomineeName: 'Cate Blanchett' },
    ],
  },
];

const films = [
  { id: 'film-1', title: 'Oppenheimer', nominations: 13 },
  { id: 'film-2', title: 'Barbie', nominations: 8 },
  { id: 'film-3', title: 'Poor Things', nominations: 5 },
];

function renderPredictionsPage(stateOverrides = {}) {
  const defaultState = {
    films,
    categories,
    activeUser: '',
    profile: { films: {}, predictions: {} },
    officialResults: {},
  };
  return render(
    <MockAppProvider value={{ state: { ...defaultState, ...stateOverrides } }}>
      <PredictionsPage />
    </MockAppProvider>
  );
}

describe('PredictionsPage', () => {
  it('shows "Faça login" message when no active user', () => {
    renderPredictionsPage({ activeUser: '' });
    expect(
      screen.getByText('Faça login para registrar seus palpites.')
    ).toBeInTheDocument();
  });

  it('shows categories when user is logged in', () => {
    renderPredictionsPage({ activeUser: 'alice' });
    expect(screen.getByText('Melhor Filme')).toBeInTheDocument();
    expect(screen.getByText('Melhor Diretor')).toBeInTheDocument();
    expect(screen.getByText('Melhor Atriz')).toBeInTheDocument();
  });

  it('shows total categories count', () => {
    renderPredictionsPage({ activeUser: 'alice' });
    // The total is shown as "de {totalCategories}"
    expect(screen.getByText(`de ${categories.length}`)).toBeInTheDocument();
  });

  it('shows how many predictions have been filled', () => {
    const predictions = {
      'best-picture': 'nom-1',
      'best-director': 'nom-3',
      // best-actress intentionally left empty
    };
    renderPredictionsPage({
      activeUser: 'alice',
      profile: { films: {}, predictions },
    });
    // filledPredictions count displayed as a large number
    const filledCount = Object.values(predictions).filter(Boolean).length; // 2
    expect(screen.getByText(String(filledCount))).toBeInTheDocument();
  });
});
