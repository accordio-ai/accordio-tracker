import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OnboardingWindow } from './onboarding/OnboardingWindow';
import { DragHelper } from './onboarding/DragHelper';
import { HotkeyHint } from './onboarding/HotkeyHint';
import './styles/globals.css';
import './onboarding/onboarding.css';

// One bundle, several windows. The main process tags each BrowserWindow with
// the surface it should render (see main/onboarding-windows.ts).
const params = new URLSearchParams(window.location.search);
const surface = params.get('window');

function Root() {
  switch (surface) {
    case 'onboarding':
      return <OnboardingWindow />;
    case 'drag-helper':
      return <DragHelper kind={params.get('kind') === 'accessibility' ? 'accessibility' : 'screenRecording'} />;
    case 'hotkey-hint':
      return <HotkeyHint shortcut={params.get('shortcut') ?? ''} />;
    default:
      return <App />;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
