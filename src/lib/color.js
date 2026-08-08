export function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

export function mixColors(colorA, colorB, amount = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(
    a.map((channel, index) =>
      Math.round(channel + (b[index] - channel) * amount),
    ),
  );
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
