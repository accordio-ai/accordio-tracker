import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#78D277', '#A9E0A4', '#3E8A47', '#FFD166', '#F2A35A', '#1a1f1c', '#ffffff', '#2d7cf6'];

/** A one-shot burst that drifts down across the whole window. */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 3.2 + Math.random() * 2.4,
        size: 6 + Math.random() * 9,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 720,
      })),
    [count]
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 4 }} aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: -40, rotate: 0, opacity: 0 }}
          animate={{ x: p.drift, y: 820, rotate: p.spin, opacity: [0, 1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.round ? p.size : p.size * 0.55,
            borderRadius: p.round ? '50%' : 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
