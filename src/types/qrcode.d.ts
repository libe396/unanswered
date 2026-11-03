/** The slice of `qrcode` (no bundled types) the report QR uses. */
declare module 'qrcode' {
  interface QRCodeRenderOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }
  export function create(text: string, options?: QRCodeRenderOptions): { modules: { size: number } };
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeRenderOptions): Promise<void>;
  export function toDataURL(text: string, options?: QRCodeRenderOptions): Promise<string>;
  const QRCode: { create: typeof create; toCanvas: typeof toCanvas; toDataURL: typeof toDataURL };
  export default QRCode;
}
