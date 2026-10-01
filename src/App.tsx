import { useEffect, useState } from 'react';
import { SceneController } from './components/SceneController';
import { MobileReportView } from './scenes/mobile/MobileReportView';
import { readReportPayload } from './lib/reportShare';
import { VenueIdleGuard } from './components/VenueIdleGuard';
import { isVenueMode } from './lib/venueMode';

function App() {
  // `#/r/<payload>` is a visitor's mobile report link; everything else is the exhibition.
  const [payload, setPayload] = useState(() => readReportPayload(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setPayload(readReportPayload(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [venue] = useState(isVenueMode);

  if (payload !== null) return <MobileReportView payload={payload} />;
  return (
    <>
      <SceneController />
      {venue && <VenueIdleGuard />}
    </>
  );
}

export default App;
