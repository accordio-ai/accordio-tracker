import { useEffect, useState, type ReactNode } from 'react';
import DottedBackground from '../DottedBackground';

/**
 * The dark right-hand column's backdrop: the auth page's animated dot
 * matrix under a wash that keeps the middle calm. Rendered once by the
 * frame and kept across steps, so the animation never restarts.
 */
export function DotPanelFrame() {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setWebgl(!!(canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
      setWebgl(false);
    }
  }, []);

  return (
    <div className="ob-dotpanel">
      {webgl ? (
        <div className="ob-dotpanel-bg">
          <DottedBackground bgColor="#0a0a0a" colors={['#12291a', '#3E8A47', '#78D277']} />
        </div>
      ) : (
        <div className="ob-dotpanel-fallback" />
      )}
      <div className="ob-dotpanel-wash" aria-hidden="true" />
    </div>
  );
}

/** A step's mockup layer, laid over the persistent DotPanelFrame. */
export function DotPanel({ children }: { children?: ReactNode; inset?: boolean }) {
  return (
    <div className="ob-right">
      <div className="ob-dotpanel-content">{children}</div>
    </div>
  );
}
