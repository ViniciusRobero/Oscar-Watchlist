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

import { MovieModal } from '../../components/MovieModal.jsx';

const film = {
  id: 'film-1',
  title: 'Oppenheimer',
  nominations: 13,
  type: 'Filme',
  imdbRating: '8.9',
  imdbUrl: 'https://www.imdb.com/title/tt15398776/',
  availabilityStatus: 'available',
  poster: null,
  categories: ['Melhor Filme', 'Melhor Diretor'],
  watchLinks: [],
  synopsis: 'A story about the atomic bomb.',
};

function renderMovieModal(filmOverrides = {}, stateOverrides = {}, contextOverrides = {}) {
  const onClose = vi.fn();
  const mergedFilm = { ...film, ...filmOverrides };
  const defaultState = {
    activeUser: '',
    profile: { films: {}, predictions: {} },
    categories: [],
  };
  const getFilmState = () => ({ watched: false, personalRating: null, personalNotes: '' });

  const result = render(
    <MockAppProvider
      value={{
        state: { ...defaultState, ...stateOverrides },
        getFilmState: contextOverrides.getFilmState || getFilmState,
        ...contextOverrides,
      }}
    >
      <MovieModal film={mergedFilm} onClose={onClose} />
    </MockAppProvider>
  );
  return { ...result, onClose };
}

describe('MovieModal', () => {
  it('renders film title', () => {
    renderMovieModal();
    // The title is rendered in an h2 element; use heading role to avoid ambiguity with the poster placeholder
    expect(screen.getByRole('heading', { name: 'Oppenheimer' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const { onClose } = renderMovieModal();
    // The close button contains an X icon; find by its title or role
    const closeButton = screen.getByRole('button', { name: '' });
    // There are multiple buttons; find the one wrapping the X icon via btn btn-ghost class
    // The close button is the only one with p-1.5 class in the header area.
    // We can query all buttons and click the one nearest the X icon.
    // Since the close button is the last in the sticky header, find by querying all buttons.
    const allButtons = screen.getAllByRole('button');
    // The close (X) button is the first button in the header (after the modal header area)
    // It has no text content, only the icon. Filter buttons with no accessible name / empty text.
    const xButton = allButtons.find((btn) => btn.querySelector('svg') && btn.textContent.trim() === '');
    expect(xButton).toBeTruthy();
    fireEvent.click(xButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows "Assistido" label in the watched toggle section when user is logged in', () => {
    renderMovieModal({}, { activeUser: 'alice' });
    // The section label "Assistido" is the text next to the watched toggle
    expect(screen.getByText('Assistido')).toBeInTheDocument();
  });

  it('shows IMDB rating when available', () => {
    renderMovieModal({ imdbRating: '8.9' });
    expect(screen.getByText('IMDb 8.9')).toBeInTheDocument();
  });
});
