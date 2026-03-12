import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MockAppProvider } from '../helpers/mockAppContext.jsx';

vi.mock('../../context/AppContext.jsx', () => import('../helpers/mockAppContext.jsx'));

// framer-motion can cause issues in jsdom; mock it with passthrough
vi.mock('framer-motion', () => ({
  motion: {
    article: ({ children, ...props }) => <article {...props}>{children}</article>,
  },
  AnimatePresence: ({ children }) => children,
}));

// Mock fetch for poster requests
beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ posterUrl: null }) })
  );
});

import { MovieCard } from '../../components/MovieCard.jsx';

const film = {
  id: 'film-1',
  title: 'Oppenheimer',
  nominations: 13,
  imdbRating: '8.9',
  availabilityStatus: 'available',
  watchLinks: [],
  poster: null,
};

function renderCard(overrides = {}) {
  const onOpen = vi.fn();
  const filmState = overrides.filmState || { watched: false, personalRating: null, personalNotes: '' };
  return {
    onOpen,
    ...render(
      <MockAppProvider value={{ state: { activeUser: 'alice', categories: [], profile: { films: { 'film-1': filmState }, predictions: {} } } }}>
        <MovieCard film={film} onOpen={onOpen} />
      </MockAppProvider>
    ),
  };
}

describe('MovieCard', () => {
  it('renders the film title in the heading', () => {
    renderCard();
    // The h3 heading and the poster placeholder span both contain the title.
    // We check the heading specifically.
    const heading = screen.getByRole('heading', { name: 'Oppenheimer' });
    expect(heading).toBeInTheDocument();
  });

  it('shows "Assistido" badge when watched is true', () => {
    renderCard({
      filmState: { watched: true, personalRating: null, personalNotes: '' },
    });
    expect(screen.getByText('Assistido')).toBeInTheDocument();
  });

  it('shows "Pendente" badge when watched is false', () => {
    renderCard();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.queryByText('Assistido')).toBeNull();
  });

  it('calls onOpen when card is clicked', () => {
    const { onOpen } = renderCard();
    fireEvent.click(screen.getByRole('article'));
    expect(onOpen).toHaveBeenCalledWith(film);
  });

  it('shows nomination count', () => {
    renderCard();
    expect(screen.getByText(/13 nom\./)).toBeInTheDocument();
  });
});
