import { lazy, Suspense, useEffect, useState } from 'react';
import { MobileReportView } from './scenes/mobile/MobileReportView';
import { ReportErrorBoundary } from './scenes/mobile/ReportErrorBoundary';
import { readReportPayload } from './lib/reportShare';
import { isVenueMode } from './lib/venueMode';
import { ExhibitionFeedback } from './components/ExhibitionFeedback';
import wordmark from './assets/wordmark.svg';
import './components/FeedbackPage.css';

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
  const [feedbackPage, setFeedbackPage] = useState(() => window.location.hash === '#/feedback');
  useEffect(() => {
    const onHashChange = () => {
      setPayload(readReportPayload(window.location.hash));
      setFeedbackPage(window.location.hash === '#/feedback');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const [venue] = useState(isVenueMode);

  if (feedbackPage) {
    return <main className="feedback-page">
      <div className="feedback-page__content">
        <a className="feedback-page__brand" href={import.meta.env.BASE_URL}><img src={wordmark} alt="UNANSWERED" /></a>
        <ExhibitionFeedback standalone />
      </div>
    </main>;
  }

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
