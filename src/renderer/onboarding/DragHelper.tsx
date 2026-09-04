import { AppIcon } from './mockups/brand';

/**
 * The System Settings companion. macOS lets you add an app to a privacy list
 * by dropping its bundle on the list, so this panel hands the user the app
 * as a native file drag: grab the row, drop it on the list, done.
 */
export function DragHelper({ kind }: { kind: 'accessibility' | 'screenRecording' }) {
  const label = kind === 'accessibility' ? 'Accessibility' : 'Screen Recording';
  return (
    <div className="ob-float">
      <div className="ob-float-card">
        <div className="ob-float-head">
          <span>
            Drag <strong>Accordio AI</strong> to the list above to allow <strong>{label}</strong>
          </span>
          <button type="button" className="ob-float-close" aria-label="Close" onClick={() => window.electron.onboarding.hideDragHelper()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="ob-float-row"
          draggable
          onDragStart={(e) => {
            // Hand the drag to the main process: it becomes a real file drag
            // of the .app bundle, which System Settings accepts as a drop.
            e.preventDefault();
            window.electron.onboarding.startAppDrag();
          }}
        >
          <AppIcon size={30} />
          <span>Accordio AI</span>
          <span className="ob-float-grip" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
