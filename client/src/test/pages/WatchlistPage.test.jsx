import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockAppProvider } from '../helpers/mockAppContext.jsx';

vi.mock('../../context/AppContext.jsx', () => import('../helpers/mockAppContext.jsx'));

vi.mock('framer-motion', () => ({
  motion: {
    article: ({ children, ...props }) => <article {...props}>{children}</article>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

vi.mock('../../components/MovieCard.jsx', () => ({
  MovieCard: ({ film }) => <div data-testid="movie-card">{film.title}</div>,
}));

vi.mock('../../components/MovieModal.jsx', () => ({
  MovieModal: () => null,
}));

beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ posterUrl: null }) })
  );
});

import { WatchlistPage } from '../../pages/WatchlistPage.jsx';

const films = [
  { id: 'film-1', title: 'Oppenheimer', nominations: 13, categories: [] },
  { id: 'film-2', title: 'Barbie', nominations: 8, categories: [] },
  { id: 'film-3', title: 'Poor Things', nominations: 5, categories: [] },
];

function renderWatchlistPage(stateOverrides = {}, contextOverrides = {}) {
  const defaultState = {
    films,
    categories: [],
    activeUser: '',
    profile: { films: {}, predictions: {} },
  };
  return render(
    <MockAppProvider value={{ state: { ...defaultState, ...stateOverrides }, ...contextOverrides }}>
      <WatchlistPage />
    </MockAppProvider>
  );
}

describe('WatchlistPage', () => {
  it('shows film cards when films exist', () => {
    renderWatchlistPage();
    const cards = screen.getAllByTestId('movie-card');
    expect(cards).toHaveLength(3);
    expect(screen.getByText('Oppenheimer')).toBeInTheDocument();
    expect(screen.getByText('Barbie')).toBeInTheDocument();
    expect(screen.getByText('Poor Things')).toBeInTheDocument();
  });

  it('shows empty state when no films', () => {
    renderWatchlistPage({ films: [] });
    expect(screen.getByText('Nenhum filme encontrado')).toBeInTheDocument();
    expect(screen.queryByTestId('movie-card')).toBeNull();
  });

  it('search input filters films by title', () => {
    renderWatchlistPage();
    const input = screen.getByPlaceholderText('Buscar filme, plataforma ou categoria...');
    fireEvent.change(input, { target: { value: 'Barbie' } });
    const cards = screen.getAllByTestId('movie-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('Barbie')).toBeInTheDocument();
    expect(screen.queryByText('Oppenheimer')).toBeNull();
  });

  it('filter button "Assistidos" shows only watched films when user is logged in', () => {
    const profileFilms = {
      'film-1': { watched: true, personalRating: null, personalNotes: '' },
      'film-2': { watched: false, personalRating: null, personalNotes: '' },
      'film-3': { watched: false, personalRating: null, personalNotes: '' },
    };
    const getFilmState = (filmId) =>
      profileFilms[filmId] || { watched: false, personalRating: null, personalNotes: '' };

    renderWatchlistPage(
      { activeUser: 'alice', profile: { films: profileFilms, predictions: {} } },
      { getFilmState }
    );

    fireEvent.click(screen.getByText('Assistidos'));
    const cards = screen.getAllByTestId('movie-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('Oppenheimer')).toBeInTheDocument();
    expect(screen.queryByText('Barbie')).toBeNull();
  });

  it('filter button "Pendentes" shows only unwatched films when user is logged in', () => {
    const profileFilms = {
      'film-1': { watched: true, personalRating: null, personalNotes: '' },
      'film-2': { watched: false, personalRating: null, personalNotes: '' },
      'film-3': { watched: false, personalRating: null, personalNotes: '' },
    };
    const getFilmState = (filmId) =>
      profileFilms[filmId] || { watched: false, personalRating: null, personalNotes: '' };

    renderWatchlistPage(
      { activeUser: 'alice', profile: { films: profileFilms, predictions: {} } },
      { getFilmState }
    );

    fireEvent.click(screen.getByText('Pendentes'));
    const cards = screen.getAllByTestId('movie-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Barbie')).toBeInTheDocument();
    expect(screen.getByText('Poor Things')).toBeInTheDocument();
    expect(screen.queryByText('Oppenheimer')).toBeNull();
  });
});
