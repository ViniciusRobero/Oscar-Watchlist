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

  if (state.loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Trophy className="w-10 h-10 text-gold animate-pulse" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
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

  return (
    <>
      <Layout activePage={activePage} onChangePage={setActivePage}>
        {pages[activePage] || <WatchlistPage />}
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
