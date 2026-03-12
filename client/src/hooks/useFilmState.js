import { useCallback } from 'react';
import { api } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

/**
 * Film state operations: get and update watched/rating/notes per film.
 */
export function useFilmState() {
  const { state, dispatch } = useApp();

  const getFilmState = useCallback(
    (filmId) =>
      state.profile.films[filmId] || { watched: false, personalRating: null, personalNotes: '' },
    [state.profile.films]
  );

  const updateFilm = useCallback(
    async (filmId, patch) => {
      if (!state.activeUser) throw new Error('Nenhum usuário ativo.');
      const { filmState } = await api.updateFilm(state.activeUser, filmId, patch);
      dispatch({ type: 'UPDATE_FILM_STATE', payload: { filmId, filmState } });
    },
    [state.activeUser, dispatch]
  );

  return { getFilmState, updateFilm };
}
