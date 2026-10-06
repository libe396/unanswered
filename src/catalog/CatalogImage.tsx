import { useState, type CSSProperties, type SyntheticEvent } from 'react';

export const BASE = import.meta.env.BASE_URL;
export const imageUrl = (file: string) => `${BASE}catalog/${file}`;

export interface CatalogImageData {
  src: string | string[];
  alt: string;
  ratio: string;
}

export type OpenImage = (url: string, alt: string) => void;

/** Tries each candidate in turn; when none loads, a same-ratio placeholder
 *  showing the file name takes its place so nothing below it shifts —
 *  or, with `hideIfMissing`, nothing at all. */
export function CatalogImage({
  image,
  onOpen,
  onLoad,
  hideIfMissing = false,
  className = '',
  style: extraStyle,
  loading = 'lazy',
  priority = false,
}: {
  image: CatalogImageData;
  onOpen?: OpenImage;
  onLoad?: (img: HTMLImageElement) => void;
  hideIfMissing?: boolean;
  className?: string;
  style?: CSSProperties;
  /** 'eager' for images that must be ready before they scroll in. */
  loading?: 'lazy' | 'eager';
  /** fetchpriority="high" — the first thing on screen. */
  priority?: boolean;
}) {
  const sources = Array.isArray(image.src) ? image.src : [image.src];
  const [index, setIndex] = useState(0);
  const missing = index >= sources.length;
  const style = { aspectRatio: image.ratio, ...extraStyle };

  if (missing && hideIfMissing) return null;
  if (missing) {
    // rule-canvas.svg / rule-canvas.png → "rule-canvas" (.svg / .png)
    const name = sources.length > 1 ? sources[0].replace(/\.[^.]+$/, '') : sources[0];
    return (
      <div className={`catalog-image catalog-image--missing ${className}`} style={style} role="img" aria-label={image.alt}>
        <span>{name}</span>
      </div>
    );
  }

  const url = imageUrl(sources[index]);
  const img = (
    <img
      src={url}
      alt={image.alt}
      loading={loading}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : {})}
      onLoad={onLoad ? (e: SyntheticEvent<HTMLImageElement>) => onLoad(e.currentTarget) : undefined}
      onError={() => setIndex((i) => i + 1)}
    />
  );
  if (!onOpen) {
    return <div className={`catalog-image ${className}`} style={style}>{img}</div>;
  }
  return (
    <button type="button" className={`catalog-image catalog-image--zoom ${className}`} style={style} onClick={() => onOpen(url, image.alt)}>
      {img}
    </button>
  );
}
