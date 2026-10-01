import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  url: string;
  /** CSS pixels. */
  size: number;
  className?: string;
}

/**
 * The visit's mobile report link as a QR. Generated locally by the bundled
 * `qrcode` package — no CDN, so it works on an offline exhibition PC. Dark
 * modules on a light quiet zone: inverted codes on the dark UI scan
 * unreliably on older phone cameras.
 */
export function ReportQr({ url, size, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(3, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
    QRCode.toCanvas(canvas, url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * scale,
      color: { dark: '#0b0b0e', light: '#f4f3f7' },
    }).catch(() => undefined);
  }, [url, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
      role="img"
      aria-label="휴대폰으로 보고서를 받는 QR 코드"
    />
  );
}
