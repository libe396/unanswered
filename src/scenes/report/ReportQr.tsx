import { useEffect, useMemo, useRef } from 'react';
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
  const displaySize = useMemo(() => {
    try {
      const modules = QRCode.create(url, { errorCorrectionLevel: 'M' }).modules.size + 8;
      // Whole CSS pixels per module prevent the browser from blurring a dense code.
      return modules * Math.max(2, Math.round(size / modules));
    } catch { return size; }
  }, [url, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(3, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
    QRCode.toCanvas(canvas, url, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: displaySize * scale,
      color: { dark: '#0b0b0e', light: '#f4f3f7' },
    }).then(() => {
      // qrcode also writes inline CSS dimensions; retain the requested display
      // size while keeping its larger backing canvas for high-DPI screens.
      canvas.style.width = `${displaySize}px`;
      canvas.style.height = `${displaySize}px`;
    }).catch(() => undefined);
  }, [url, displaySize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: displaySize, height: displaySize, display: 'block', imageRendering: 'pixelated' }}
      role="img"
      aria-label="휴대폰으로 보고서를 받는 QR 코드"
    />
  );
}
