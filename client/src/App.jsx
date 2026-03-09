import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { Layout } from './components/Layout.jsx';
import { Toast } from './components/Toast.jsx';
import { WatchlistPage } from './pages/WatchlistPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { PredictionsPage } from './pages/PredictionsPage.jsx';
import { OscarNightPage } from './pages/OscarNightPage.jsx';
import { ComparePage } from './pages/ComparePage.jsx';
import { Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonFilmCard } from './components/SkeletonFilmCard.jsx';

function AppInner() {
  const { state, bootstrap } = useApp();
  const [activePage, setActivePage] = useState('watchlist');

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

  return (
    <>
      <Layout activePage={activePage} onChangePage={setActivePage}>
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
              key={activePage}
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
