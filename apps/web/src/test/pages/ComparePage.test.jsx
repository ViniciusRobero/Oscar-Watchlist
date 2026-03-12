import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockAppProvider } from '../helpers/mockAppContext.jsx';

vi.mock('../../context/AppContext.jsx', () => import('../helpers/mockAppContext.jsx'));
vi.mock('../../api.js', () => ({
  api: {
    compareUsers: vi.fn(),
    compareWithOfficial: vi.fn(),
  },
  setCurrentEdition: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  isAuthenticated: vi.fn(() => false),
}));

import { api } from '../../api.js';
import { ComparePage } from '../../pages/ComparePage.jsx';

const stateWithUsers = {
  users: ['alice', 'bob', 'charlie'],
  films: [],
  categories: [],
  officialResults: {},
  activeUser: 'alice',
};

function renderComparePage(stateOverrides = {}) {
  const showToast = vi.fn();
  const filmById = vi.fn(() => undefined);
  return {
    showToast,
    filmById,
    ...render(
      <MockAppProvider value={{ state: { ...stateWithUsers, ...stateOverrides }, showToast, filmById }}>
        <ComparePage />
      </MockAppProvider>
    ),
  };
}

describe('ComparePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mode selector tabs', () => {
    renderComparePage();
    expect(screen.getByText('Usuário vs Usuário')).toBeInTheDocument();
    expect(screen.getByText('vs Oscar oficial')).toBeInTheDocument();
  });

  it('renders user selectors in "users" mode', () => {
    renderComparePage();
    expect(screen.getByText('Usuário A')).toBeInTheDocument();
    expect(screen.getByText('Usuário B')).toBeInTheDocument();
  });

  it('Comparar button is disabled when no users selected', () => {
    renderComparePage();
    const btn = screen.getByRole('button', { name: /Comparar/i });
    expect(btn).toBeDisabled();
  });

  it('Comparar button is enabled when both users selected', () => {
    renderComparePage();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'alice' } });
    fireEvent.change(selects[1], { target: { value: 'bob' } });
    const btn = screen.getByRole('button', { name: /Comparar/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows empty state prompt when no result', () => {
    renderComparePage();
    expect(screen.getByText('Selecione os usuários e clique em Comparar')).toBeInTheDocument();
  });

  it('shows error toast when API call fails', async () => {
    api.compareUsers.mockRejectedValue(new Error('Network error'));
    const { showToast } = renderComparePage();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'alice' } });
    fireEvent.change(selects[1], { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: /Comparar/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Network error', 'error');
    });
  });

  it('switches to official mode when tab clicked', () => {
    renderComparePage();
    fireEvent.click(screen.getByText('vs Oscar oficial'));
    expect(screen.getByText('Usuário')).toBeInTheDocument();
    // The users A/B labels should disappear
    expect(screen.queryByText('Usuário A')).toBeNull();
  });

  it('shows results after successful compare', async () => {
    api.compareUsers.mockResolvedValue({
      totalCategories: 5,
      matchesCount: 3,
      comparedCategories: 4,
      matches: [
        { categoryId: 'cat1', categoryName: 'Melhor Filme', filmId: 'f1', leftFilmId: 'f1', rightFilmId: 'f1' },
      ],
      diffs: [],
    });

    renderComparePage();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'alice' } });
    fireEvent.change(selects[1], { target: { value: 'bob' } });
    fireEvent.click(screen.getByRole('button', { name: /Comparar/i }));

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // totalCategories
      expect(screen.getByText('3')).toBeInTheDocument(); // matchesCount
    });
  });
});
