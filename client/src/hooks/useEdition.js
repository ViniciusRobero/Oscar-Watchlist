import { useCallback } from 'react';
import { api, setCurrentEdition } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

/**
 * Edition switching.
 */
export function useEdition() {
  const { state, dispatch, showToast } = useApp();

  const hydrate = useCallback((data) => {
    dispatch({ type: 'HYDRATE', payload: data });
  }, [dispatch]);

  const switchEdition = useCallback(
    async (editionId) => {
      setCurrentEdition(editionId);
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const data = await api.bootstrap(state.activeUser);
        if (data.edition) setCurrentEdition(data.edition);
        hydrate(data);
        showToast(`Edição: ${data.editions?.find(e => e.id === data.edition)?.label || data.edition}`);
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
      }
    },
    [state.activeUser, hydrate, showToast, dispatch]
  );

  return { switchEdition, edition: state.edition, editions: state.editions };
}
