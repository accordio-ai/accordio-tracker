/**
 * What the popover shows when there is no session: a single button that opens
 * the setup window. Sign-in itself lives there (see onboarding/).
 */
export function SignInPrompt() {
  return (
    <div className="onboarding">
      <div className="onboarding-container">
        <div className="onboarding-logo">
          <svg width="48" height="48" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor" />
            <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor" />
          </svg>
        </div>
        <div className="onboarding-step">
          <h1 className="onboarding-title">
            Finish setting up<br />
            <span className="onboarding-title-accent">Accordio.</span>
          </h1>
          <p className="onboarding-subtitle">Sign in and set up tracking in a couple of minutes.</p>
          <button className="onboarding-btn primary" onClick={() => window.electron.onboarding.open()}>
            Open setup
          </button>
        </div>
      </div>
    </div>
  );
}
