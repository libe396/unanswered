import { lazy, Suspense, useEffect, useState } from 'react';
import { MobileReportView } from './scenes/mobile/MobileReportView';
import { ReportErrorBoundary } from './scenes/mobile/ReportErrorBoundary';
import { readReportPayload } from './lib/reportShare';
import { isVenueMode } from './lib/venueMode';

// The exhibition is loaded only off the report path, so a phone opening a
// `#/r/` link downloads and runs the mobile report alone.
const SceneController = lazy(() =>
  import('./components/SceneController').then((m) => ({ default: m.SceneController })),
);
const VenueIdleGuard = lazy(() =>
  import('./components/VenueIdleGuard').then((m) => ({ default: m.VenueIdleGuard })),
);

function App() {
  // `#/r/<payload>` is a visitor's mobile report link; everything else is the exhibition.
  const [payload, setPayload] = useState(() => readReportPayload(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setPayload(readReportPayload(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [venue] = useState(isVenueMode);

  if (payload !== null) {
    return (
      <ReportErrorBoundary>
        <MobileReportView payload={payload} />
      </ReportErrorBoundary>
    );
  }
  return (
    <Suspense fallback={null}>
      <SceneController />
      {venue && <VenueIdleGuard />}
    </Suspense>
  );
}

export default App;
