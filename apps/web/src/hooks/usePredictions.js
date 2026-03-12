import { useCallback, useRef } from 'react';
import { api } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

/**
 * Prediction + official results operations.
 * Includes race-condition fix (B-010): stale responses are discarded.
 */
export function usePredictions() {
  const { state, dispatch, showToast } = useApp();
  const predTimestamps = useRef({});

  const savePrediction = useCallback(
    async (categoryId, nomineeId) => {
      if (!state.activeUser) throw new Error('Nenhum usuário ativo.');
      const ts = Date.now();
      predTimestamps.current[categoryId] = ts;
      const prevPredictions = state.profile.predictions;
      dispatch({
        type: 'UPDATE_PREDICTIONS',
        payload: { ...prevPredictions, [categoryId]: nomineeId },
      });
      try {
        const { predictions } = await api.savePrediction(state.activeUser, categoryId, nomineeId);
        if (predTimestamps.current[categoryId] === ts) {
          dispatch({ type: 'UPDATE_PREDICTIONS', payload: predictions });
        }
      } catch (e) {
        if (predTimestamps.current[categoryId] === ts) {
          dispatch({ type: 'UPDATE_PREDICTIONS', payload: prevPredictions });
        }
        throw e;
      }
    },
    [state.activeUser, state.profile.predictions, dispatch]
  );

  const setOfficialWinner = useCallback(
    async (categoryId, nomineeId) => {
      const { officialResults } = await api.setOfficialWinner(categoryId, nomineeId);
      dispatch({ type: 'UPDATE_OFFICIAL_RESULTS', payload: officialResults });
      showToast('Resultado oficial salvo!');
    },
    [dispatch, showToast]
  );

  return { savePrediction, setOfficialWinner };
}
