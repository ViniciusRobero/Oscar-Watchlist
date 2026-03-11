import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { Layout } from './components/Layout.jsx';
import { Toast } from './components/Toast.jsx';
import { HubPage } from './pages/HubPage.jsx';
import { WatchlistPage } from './pages/WatchlistPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { PredictionsPage } from './pages/PredictionsPage.jsx';
import { OscarNightPage } from './pages/OscarNightPage.jsx';
import { ComparePage } from './pages/ComparePage.jsx';
import { Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonFilmCard } from './components/SkeletonFilmCard.jsx';
import { setCurrentEdition } from './api.js';

function AppInner() {
  const { state, bootstrap, switchEdition } = useApp();
  const [activePage, setActivePage] = useState('watchlist');
  // null = Hub view; otherwise the award object selected by the user
  const [selectedAward, setSelectedAward] = useState(null);

  // Restore last logged-in user from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('oscar_active_user') || '';
    bootstrap(saved);
  }, []);

  // Persist active user whenever it changes
  useEffect(() => {
    if (state.activeUser) {
      localStorage.setItem('oscar_active_user', state.activeUser);
    }
  }, [state.activeUser]);

  // Auto-select the current award once data loads (skip hub if only one active award)
  useEffect(() => {
    if (!state.loading && state.awards?.length > 0 && selectedAward === null) {
      const activeAwards = state.awards.filter(a => a.active);
      if (activeAwards.length === 1) {
        // Only one active award — jump straight in, no hub needed
        setSelectedAward(activeAwards[0]);
      }
      // Multiple active awards → show hub (selectedAward stays null)
    }
  }, [state.loading, state.awards]);

  function handleSelectAward(award, edition) {
    setSelectedAward(award);
    if (edition) {
      switchEdition(edition.id);
    }
    setActivePage('watchlist');
  }

  function handleBackToHub() {
    setSelectedAward(null);
    setActivePage('watchlist');
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
        <div className="card p-8 max-w-sm text-center">
          <p className="text-danger font-semibold mb-2">Erro ao carregar</p>
          <p className="text-sm text-gray-500 mb-4">{state.error}</p>
          <button onClick={() => bootstrap()} className="btn btn-gold">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const pages = {
    watchlist: <WatchlistPage />,
    users: <UsersPage />,
    predictions: <PredictionsPage />,
    'oscar-night': <OscarNightPage />,
    compare: <ComparePage />,
  };

  // Show Hub if no award selected and multiple active awards exist
  const showHub = selectedAward === null && !state.loading;
  const multipleActiveAwards = (state.awards || []).filter(a => a.active).length > 1;

  return (
    <>
      {showHub && multipleActiveAwards ? (
        // Full-page Hub — no Layout chrome needed
        <div className="min-h-screen bg-bg-base">
          <header className="sticky top-0 z-40 border-b border-border bg-bg-base/90 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-gold" />
              <span className="font-display text-lg text-gray-100">Watchlist</span>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-8">
            <HubPage onSelectAward={handleSelectAward} />
          </main>
        </div>
      ) : (
        <Layout
          activePage={activePage}
          onChangePage={setActivePage}
          onBackToHub={multipleActiveAwards ? handleBackToHub : null}
          currentAward={selectedAward}
        >
          <AnimatePresence mode="wait">
            {state.loading ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonFilmCard key={i} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={activePage + (selectedAward ? selectedAward.id : 'hub')}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                {pages[activePage] || <WatchlistPage />}
              </motion.div>
            )}
          </AnimatePresence>
        </Layout>
      )}
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
