import { Film } from 'lucide-react';
import { motion } from 'framer-motion';

export function SkeletonFilmCard() {
    return (
        <motion.article
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card flex gap-3.5 p-3.5 opacity-70 pointer-events-none"
        >
            {/* Poster Skeleton */}
            <div className="shrink-0 w-[68px] h-[100px] rounded-lg overflow-hidden border border-border/50 bg-bg-raised/50 flex items-center justify-center poster-placeholder">
                <Film className="w-6 h-6 text-gray-800" />
            </div>

            {/* Content Skeleton */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                    {/* Title skeleton */}
                    <div className="h-4 w-3/4 bg-bg-raised/80 rounded-md poster-placeholder mb-2.5"></div>
                    {/* Tags skeleton */}
                    <div className="flex gap-2 mb-3">
                        <div className="h-3 w-12 bg-bg-raised/60 rounded-full poster-placeholder"></div>
                        <div className="h-3 w-8 bg-gold-dark/20 rounded-full"></div>
                    </div>
                    {/* Streaming skeleton */}
                    <div className="h-2.5 w-1/2 bg-bg-raised/50 rounded-md"></div>
                </div>

                {/* Bottom actions skeleton */}
                <div className="flex items-center justify-between mt-2">
                    <div className="h-3 w-10 bg-bg-raised/50 rounded-md"></div>
                    <div className="h-6 w-20 bg-bg-raised/60 rounded-lg poster-placeholder"></div>
                </div>
            </div>
        </motion.article>
    );
}
