import { describe, it, expect } from 'vitest';
import { reducer } from '../../context/AppContext.jsx';

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
  awards: [],
  currentAward: null,
  loading: true,
  error: null,
  toast: null,
  isAuthenticated: false,
  userRole: 'user',
};

describe('AppContext reducer', () => {
  describe('HYDRATE', () => {
    it('merges payload into state and sets loading: false', () => {
      const payload = { films: [{ id: 'f1', title: 'Test' }], activeUser: 'alice' };
      const next = reducer(initialState, { type: 'HYDRATE', payload });
      expect(next.films).toEqual(payload.films);
      expect(next.activeUser).toBe('alice');
      expect(next.loading).toBe(false);
      expect(next.error).toBeNull();
    });

    it('preserves existing state fields not in payload', () => {
      const state = { ...initialState, edition: '2026' };
      const next = reducer(state, { type: 'HYDRATE', payload: { activeUser: 'bob' } });
      expect(next.edition).toBe('2026');
    });
  });

  describe('SET_LOADING', () => {
    it('sets loading flag', () => {
      const next = reducer(initialState, { type: 'SET_LOADING', payload: true });
      expect(next.loading).toBe(true);
      const next2 = reducer(next, { type: 'SET_LOADING', payload: false });
      expect(next2.loading).toBe(false);
    });
  });

  describe('SET_ERROR', () => {
    it('sets error message and loading: false', () => {
      const next = reducer({ ...initialState, loading: true }, { type: 'SET_ERROR', payload: 'oops' });
      expect(next.error).toBe('oops');
      expect(next.loading).toBe(false);
    });
  });

  describe('SET_TOAST', () => {
    it('sets toast payload', () => {
      const toast = { message: 'Hello', type: 'success' };
      const next = reducer(initialState, { type: 'SET_TOAST', payload: toast });
      expect(next.toast).toEqual(toast);
    });

    it('clears toast when payload is null', () => {
      const state = { ...initialState, toast: { message: 'Hi', type: 'success' } };
      const next = reducer(state, { type: 'SET_TOAST', payload: null });
      expect(next.toast).toBeNull();
    });
  });

  describe('UPDATE_PREDICTIONS', () => {
    it('replaces predictions completely', () => {
      const state = { ...initialState, profile: { films: { f1: { watched: true } }, predictions: { cat1: 'nom1' } } };
      const next = reducer(state, { type: 'UPDATE_PREDICTIONS', payload: { cat2: 'nom2' } });
      expect(next.profile.predictions).toEqual({ cat2: 'nom2' });
      // films should be unchanged
      expect(next.profile.films).toEqual({ f1: { watched: true } });
    });
  });

  describe('UPDATE_FILM_STATE', () => {
    it('updates only the specified filmId', () => {
      const state = {
        ...initialState,
        profile: {
          films: { f1: { watched: true }, f2: { watched: false } },
          predictions: {},
        },
      };
      const filmState = { watched: true, personalRating: 9, personalNotes: 'great' };
      const next = reducer(state, { type: 'UPDATE_FILM_STATE', payload: { filmId: 'f2', filmState } });
      expect(next.profile.films.f2).toEqual(filmState);
      expect(next.profile.films.f1).toEqual({ watched: true }); // unchanged
    });
  });

  describe('UPDATE_OFFICIAL_RESULTS', () => {
    it('replaces officialResults', () => {
      const state = { ...initialState, officialResults: { cat1: 'nom1' } };
      const next = reducer(state, { type: 'UPDATE_OFFICIAL_RESULTS', payload: { cat2: 'nom2' } });
      expect(next.officialResults).toEqual({ cat2: 'nom2' });
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged', () => {
      const next = reducer(initialState, { type: 'UNKNOWN_ACTION' });
      expect(next).toBe(initialState);
    });
  });
});
