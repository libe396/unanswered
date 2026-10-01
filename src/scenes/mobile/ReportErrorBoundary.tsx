import { Component, type ReactNode } from 'react';

/** Temporary: `?debug=1` shows the error and its stack instead of the plain line. */
export function isReportDebug(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

interface State {
  error: Error | null;
}

/**
 * A render error in the mobile report shows a message instead of a white
 * screen. Errors outside React (script load, async) are caught by the inline
 * handler in index.html.
 */
export class ReportErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ padding: 24, color: '#edecf2', background: '#0b0b0e', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ margin: 0, fontSize: 16 }}>기록을 불러오지 못했습니다.</p>
        {isReportDebug() ? (
          <pre style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#b8b5c2' }}>
            {`${error.name}: ${error.message}\n\n${error.stack ?? '(no stack)'}`}
          </pre>
        ) : null}
      </div>
    );
  }
}
