import { useState, useEffect } from 'react';
import { Eye, Target, Star, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api.js';

const ACTION_CONFIG = {
  prediction: {
    icon: Target,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/30 border-blue-900/30',
    label: (item, filmById, categories) => {
      const cat = categories.find(c => c.id === item.entityId);
      return cat ? `Apostou em "${cat.name}"` : 'Registrou palpite';
    },
  },
  film_watch: {
    icon: Eye,
    color: 'text-green-400',
    bgColor: 'bg-green-950/20 border-green-900/30',
    label: (item, filmById) => {
      const film = filmById(item.entityId);
      return film ? `Assistiu "${film.title}"` : 'Marcou filme como assistido';
    },
  },
  film_rate: {
    icon: Star,
    color: 'text-gold',
    bgColor: 'bg-gold-muted border-gold/20',
    label: (item, filmById) => {
      const film = filmById(item.entityId);
      const rating = item.metadata?.rating;
      const ratingStr = rating != null ? ` — ${rating}/10` : '';
      return film ? `Avaliou "${film.title}"${ratingStr}` : `Avaliou um filme${ratingStr}`;
    },
  },
};

function groupByDate(timeline) {
  const groups = {};
  for (const item of timeline) {
    const date = item.createdAt ? item.createdAt.slice(0, 10) : 'Sem data';
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function formatDate(dateStr) {
  if (!dateStr || dateStr === 'Sem data') return 'Sem data';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  try {
    return new Date(dateTimeStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function TimelinePage() {
  const { state, filmById } = useApp();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nick = state.nick || state.activeUser;

  useEffect(() => {
    if (!nick) return;
    setLoading(true);
    setError('');
    api.getUserTimeline(nick)
      .then(data => setTimeline(data.timeline || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [nick]);

  if (!nick) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Clock className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-medium">Faça login para ver sua timeline</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-16 text-gray-600">Carregando timeline...</div>
      </div>
    );
  }

  const groups = groupByDate(timeline);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="section-title font-display text-2xl">Minha Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">
          Histórico de atividades de <span className="text-gold">@{nick}</span>
        </p>
      </div>

      {error && (
        <div className="card p-4 border-red-900/40 bg-red-950/10 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!loading && timeline.length === 0 && !error && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Clock className="w-10 h-10 text-gray-700" />
          <p className="text-gray-500 font-medium">Nenhuma atividade registrada ainda</p>
          <p className="text-sm text-gray-600">
            Suas ações — palpites e filmes assistidos — aparecerão aqui.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([date, items]) => (
          <div key={date}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-3 capitalize">
              {formatDate(date)}
            </p>
            <div className="space-y-2">
              {items.map(item => {
                const config = ACTION_CONFIG[item.actionType];
                if (!config) return null;
                const IconComponent = config.icon;
                const label = config.label(item, filmById, state.categories || []);
                const time = formatTime(item.createdAt);
                return (
                  <div key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${config.bgColor}`}
                  >
                    <IconComponent className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                    <span className="flex-1 text-gray-300">{label}</span>
                    {time && <span className="text-xs text-gray-600 flex-shrink-0">{time}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
