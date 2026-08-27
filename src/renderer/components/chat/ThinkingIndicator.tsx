/**
 * The gap between sending and the first chunk.
 *
 * Matches the dashboard: the Accordio sparkle Lottie plus shimmer-gradient
 * "Thinking..." text. Kept on `lottie-react` (lottie-web, pure JS) rather than
 * the dashboard's `@lottiefiles/dotlottie-react` — that one is wasm-backed and
 * the renderer CSP has no `wasm-unsafe-eval`, so it would hard-fail here.
 */

import { lazy, Suspense, useEffect, useState } from 'react';

const Lottie = lazy(() => import('lottie-react'));
const accordioStars = () =>
  import('../../lib/lottie/accordio-stars.json').then((m) => m.default);

export function ThinkingIndicator() {
  const [animData, setAnimData] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    accordioStars().then((data) => {
      if (!cancelled) setAnimData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-1">
      <div className="h-10 w-10 shrink-0">
        {animData ? (
          <Suspense fallback={<div className="h-10 w-10" />}>
            <Lottie animationData={animData} loop autoplay style={{ width: 40, height: 40 }} />
          </Suspense>
        ) : (
          <div className="h-10 w-10" />
        )}
      </div>
      <span className="thinking-shimmer text-[13px]">Thinking...</span>
    </div>
  );
}
