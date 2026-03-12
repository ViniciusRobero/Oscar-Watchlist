import { useApp } from '../context/AppContext.jsx';
import { motion } from 'framer-motion';
import { ChevronRight, Lock } from 'lucide-react';

function AwardCard({ award, editions, onSelect }) {
  const awardEditions = editions.filter(e => e.award_id === award.id);
  const currentEdition = awardEditions.find(e => e.current) || awardEditions[0];
  const isActive = award.active;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isActive ? { scale: 1.02 } : {}}
      whileTap={isActive ? { scale: 0.98 } : {}}
      onClick={() => isActive && onSelect(award, currentEdition)}
      className={`relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-200 ${
        isActive
          ? 'border-border hover:border-gold/40 cursor-pointer'
          : 'border-border/50 cursor-not-allowed opacity-60'
      }`}
    >
      {/* Gradient background strip */}
      <div className={`absolute inset-0 bg-gradient-to-br ${award.color || 'from-gray-600 to-gray-700'} opacity-10`} />

      <div className="relative p-5 flex items-center gap-4">
        <div className={`text-4xl flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${award.color || 'from-gray-600 to-gray-700'} bg-opacity-20`}>
          {award.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-lg font-bold text-gray-100">{award.name}</h2>
            {!isActive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-bg-hover text-gray-500 border border-border">
                <Lock className="w-2.5 h-2.5" />
                Em breve
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-1">{award.fullName}</p>
          <p className="text-xs text-gray-400 line-clamp-1">{award.description}</p>
          {isActive && currentEdition && (
            <p className="text-xs text-gold/70 mt-1 font-medium">{currentEdition.label}</p>
          )}
        </div>

        {isActive && (
          <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
        )}
      </div>
    </motion.button>
  );
}

export function HubPage({ onSelectAward }) {
  const { state } = useApp();
  const awards = state.awards || [];
  const editions = state.editions || [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-gray-100 mb-2">Premiações</h1>
        <p className="text-gray-500 text-sm">Escolha uma premiação para ver os indicados e fazer seus palpites</p>
      </div>

      <div className="flex flex-col gap-3">
        {awards.map((award, i) => (
          <motion.div
            key={award.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <AwardCard
              award={award}
              editions={editions}
              onSelect={onSelectAward}
            />
          </motion.div>
        ))}
      </div>

      {awards.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🏆</p>
          <p>Nenhuma premiação disponível</p>
        </div>
      )}
    </div>
  );
}
