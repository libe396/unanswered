import { useEffect, useRef } from 'react';

interface Props { onUse: () => void; onSkip: () => void }

/** Consent belongs immediately before the live mirror, never on Landing. */
export function CameraOptIn({ onUse, onSkip }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  return <section className="camera-consent" aria-labelledby="camera-consent-title">
    <h2 id="camera-consent-title" ref={heading} tabIndex={-1}>마지막 장면을 여는 방법을 선택해 주세요.</h2>
    <p>다음 장면에서 카메라로 내 모습을 실시간으로 볼 수 있습니다. 영상은 저장·전송하지 않으며 마이크는 사용하지 않습니다.</p>
    <div className="camera-consent__actions">
      <button type="button" className="cta cta--primary" onClick={onUse}>카메라로 보기</button>
      <button type="button" className="cta cta--secondary" onClick={onSkip}>카메라 없이 계속</button>
    </div>
  </section>;
}
