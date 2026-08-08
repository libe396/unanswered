import { rgbToHex } from './color.js';

const ANALYSIS_SIZE = 180;

export async function analyzeImage(imageUrl) {
  const image = await loadImage(imageUrl);
  const { canvas, context, width, height } = drawImageForAnalysis(image);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const luminance = new Float32Array(width * height);
  const paletteBuckets = new Map();

  let brightnessTotal = 0;
  let brightest = { value: -1, x: width / 2, y: height / 2 };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.05) continue;

      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      luminance[y * width + x] = light;
      brightnessTotal += light;

      if (light > brightest.value) {
        brightest = { value: light, x, y };
      }

      const bucketKey = [r, g, b].map((value) => Math.round(value / 18) * 18).join(',');
      const current = paletteBuckets.get(bucketKey) || {
        count: 0,
        r: 0,
        g: 0,
        b: 0,
        score: 0,
      };
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      current.count += 1;
      current.r += r;
      current.g += g;
      current.b += b;
      current.score += 0.4 + saturation * 2.2 + light * 0.2;
      paletteBuckets.set(bucketKey, current);
    }
  }

  const edgeStats = measureEdges(luminance, width, height);
  const structure = measureStructure(luminance, width, height);
  const brightRegions = detectBrightRegions(pixels, luminance, width, height, brightnessTotal / (width * height));
  const structureAnchors = detectStructureAnchors(pixels, luminance, width, height);

  canvas.width = 1;
  canvas.height = 1;

  const paletteData = extractPalette(paletteBuckets);
  const primaryRegion = brightRegions[0] || {
    x: clamp(brightest.x / width, 0.05, 0.95),
    y: clamp(brightest.y / height, 0.05, 0.95),
  };

  return {
    palette: paletteData.colors,
    paletteWeights: paletteData.weights,
    lightOrigin: {
      x: primaryRegion.x,
      y: primaryRegion.y,
    },
    brightRegions,
    structureAnchors,
    averageBrightness: clamp(brightnessTotal / (width * height), 0, 1),
    blurDensity: edgeStats.blurDensity,
    motionDirection: {
      angle: edgeStats.angle,
      label: angleLabel(edgeStats.angle),
    },
    structure,
  };
}

function detectBrightRegions(pixels, luminance, width, height, averageBrightness) {
  const visited = new Uint8Array(width * height);
  const regions = [];
  const threshold = clamp(Math.max(averageBrightness + 0.16, 0.62), 0.48, 0.9);
  const minPixels = Math.max(5, Math.round((width * height) * 0.00045));
  const queue = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const startIndex = y * width + x;
      if (visited[startIndex] || luminance[startIndex] < threshold) continue;

      let count = 0;
      let brightnessTotal = 0;
      let weightedX = 0;
      let weightedY = 0;
      let positionWeightTotal = 0;
      let rTotal = 0;
      let gTotal = 0;
      let bTotal = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      queue.length = 0;
      queue.push(startIndex);
      visited[startIndex] = 1;

      while (queue.length) {
        const current = queue.pop();
        const cx = current % width;
        const cy = Math.floor(current / width);
        const light = luminance[current];
        const pixelIndex = current * 4;
        const weight = Math.max(0.01, light - threshold + 0.08);

        count += 1;
        brightnessTotal += light;
        weightedX += cx * weight;
        weightedY += cy * weight;
        positionWeightTotal += weight;
        rTotal += pixels[pixelIndex] * light;
        gTotal += pixels[pixelIndex + 1] * light;
        bTotal += pixels[pixelIndex + 2] * light;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) continue;
            const neighborIndex = ny * width + nx;
            if (!visited[neighborIndex] && luminance[neighborIndex] >= threshold * 0.94) {
              visited[neighborIndex] = 1;
              queue.push(neighborIndex);
            }
          }
        }
      }

      if (count < minPixels) continue;

      const averageRegionBrightness = brightnessTotal / count;
      const size = Math.sqrt((maxX - minX + 1) * (maxY - minY + 1)) / Math.max(width, height);
      const colorWeight = brightnessTotal || 1;

      regions.push({
        brightness: clamp(averageRegionBrightness, 0, 1),
        color: rgbToHex([
          Math.round(rTotal / colorWeight),
          Math.round(gTotal / colorWeight),
          Math.round(bTotal / colorWeight),
        ]),
        size: clamp(size, 0.02, 0.28),
        strength: clamp(averageRegionBrightness * 0.72 + Math.sqrt(count / (width * height)) * 1.4, 0, 1),
        x: clamp(weightedX / Math.max(0.0001, positionWeightTotal) / width, 0.05, 0.95),
        y: clamp(weightedY / Math.max(0.0001, positionWeightTotal) / height, 0.05, 0.95),
      });
    }
  }

  return regions
    .sort((a, b) => b.strength - a.strength)
    .reduce((result, region) => {
      const tooClose = result.some((existing) => Math.hypot(existing.x - region.x, existing.y - region.y) < 0.09);
      return tooClose || result.length >= 8 ? result : [...result, region];
    }, [])
    .slice(0, 8);
}

function detectStructureAnchors(pixels, luminance, width, height) {
  const cellCount = 6;
  const cells = Array.from({ length: cellCount * cellCount }, (_, index) => ({
    b: 0,
    count: 0,
    diagonal: 0,
    energy: 0,
    g: 0,
    horizontal: 0,
    index,
    radial: 0,
    r: 0,
    vertical: 0,
    weightedX: 0,
    weightedY: 0,
  }));
  const center = { x: width / 2, y: height / 2 };

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const left = luminance[y * width + (x - 1)];
      const right = luminance[y * width + (x + 1)];
      const top = luminance[(y - 1) * width + x];
      const bottom = luminance[(y + 1) * width + x];
      const gx = right - left;
      const gy = bottom - top;
      const energy = Math.hypot(gx, gy);
      if (energy < 0.035) continue;

      const cellX = Math.min(cellCount - 1, Math.floor((x / width) * cellCount));
      const cellY = Math.min(cellCount - 1, Math.floor((y / height) * cellCount));
      const cell = cells[cellY * cellCount + cellX];
      const pixelIndex = (y * width + x) * 4;
      const fromCenterX = x - center.x;
      const fromCenterY = y - center.y;
      const fromCenterLength = Math.hypot(fromCenterX, fromCenterY) || 1;
      const radialAlignment = Math.abs((gx * fromCenterX + gy * fromCenterY) / ((energy || 1) * fromCenterLength));
      const absX = Math.abs(gx);
      const absY = Math.abs(gy);

      cell.count += 1;
      cell.energy += energy;
      cell.weightedX += x * energy;
      cell.weightedY += y * energy;
      cell.r += pixels[pixelIndex] * energy;
      cell.g += pixels[pixelIndex + 1] * energy;
      cell.b += pixels[pixelIndex + 2] * energy;
      cell.vertical += absX;
      cell.horizontal += absY;
      cell.diagonal += Math.min(absX, absY);
      cell.radial += radialAlignment * energy;
    }
  }

  const maxEnergy = Math.max(...cells.map((cell) => cell.energy), 0.0001);

  return cells
    .filter((cell) => cell.count > 3 && cell.energy / maxEnergy > 0.18)
    .map((cell) => {
      const totalAxis = Math.max(0.0001, cell.vertical + cell.horizontal + cell.diagonal + cell.radial);
      const axisScores = [
        { type: 'vertical', value: cell.vertical / totalAxis },
        { type: 'horizontal', value: cell.horizontal / totalAxis },
        { type: 'diagonal', value: cell.diagonal / totalAxis },
        { type: 'radial', value: cell.radial / totalAxis },
      ].sort((a, b) => b.value - a.value);
      const type = cell.energy / cell.count > 0.12 && axisScores[0].value < 0.36 ? 'dense' : axisScores[0].type;

      return {
        color: rgbToHex([
          Math.round(cell.r / cell.energy),
          Math.round(cell.g / cell.energy),
          Math.round(cell.b / cell.energy),
        ]),
        strength: clamp(cell.energy / maxEnergy, 0, 1),
        type,
        x: clamp(cell.weightedX / cell.energy / width, 0.05, 0.95),
        y: clamp(cell.weightedY / cell.energy / height, 0.05, 0.95),
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .reduce((result, anchor) => {
      const tooClose = result.some((existing) => Math.hypot(existing.x - anchor.x, existing.y - anchor.y) < 0.12);
      return tooClose || result.length >= 8 ? result : [...result, anchor];
    }, [])
    .slice(0, 8);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageForAnalysis(image) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(ANALYSIS_SIZE / image.naturalWidth, ANALYSIS_SIZE / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return { canvas, context, width, height };
}

function extractPalette(bucketMap) {
  const buckets = [...bucketMap.values()].map((bucket) => ({
    count: bucket.count,
    score: bucket.score,
    rgb: [
      Math.round(bucket.r / bucket.count),
      Math.round(bucket.g / bucket.count),
      Math.round(bucket.b / bucket.count),
    ],
  }));
  const selected = [...bucketMap.values()]
    .map((bucket) => ({
      count: bucket.count,
      score: bucket.score,
      rgb: [
        Math.round(bucket.r / bucket.count),
        Math.round(bucket.g / bucket.count),
        Math.round(bucket.b / bucket.count),
      ],
    }))
    .sort((a, b) => b.score - a.score)
    .reduce((result, color) => {
      const isTooClose = result.some((existing) => colorDistance(existing.rgb, color.rgb) < 32);
      return isTooClose || result.length >= 5 ? result : [...result, color];
    }, []);

  if (selected.length < 3) {
    return {
      colors: ['#f3efe7', '#d7d7ce', '#8c93a1', '#26272b'],
      weights: [0.36, 0.28, 0.22, 0.14],
    };
  }

  const coverage = new Array(selected.length).fill(0);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;

  buckets.forEach((bucket) => {
    const nearestIndex = selected
      .map((color, index) => ({
        distance: colorDistance(bucket.rgb, color.rgb),
        index,
      }))
      .sort((a, b) => a.distance - b.distance)[0].index;

    coverage[nearestIndex] += bucket.count;
  });

  const weightedSelection = selected
    .map((color, index) => ({
      ...color,
      weight: coverage[index] / total,
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    colors: weightedSelection.map((color) => rgbToHex(color.rgb)),
    weights: weightedSelection.map((color) => color.weight),
  };
}

function measureEdges(luminance, width, height) {
  let gradientTotal = 0;
  let jxx = 0;
  let jyy = 0;
  let jxy = 0;
  let samples = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const left = luminance[y * width + (x - 1)];
      const right = luminance[y * width + (x + 1)];
      const top = luminance[(y - 1) * width + x];
      const bottom = luminance[(y + 1) * width + x];
      const gx = right - left;
      const gy = bottom - top;
      const magnitude = Math.hypot(gx, gy);

      gradientTotal += magnitude;
      jxx += gx * gx;
      jyy += gy * gy;
      jxy += gx * gy;
      samples += 1;
    }
  }

  const averageEdge = samples ? gradientTotal / samples : 0;
  const blurDensity = clamp(1 - averageEdge * 5.7, 0.08, 0.98);
  const radians = 0.5 * Math.atan2(2 * jxy, jxx - jyy);
  const degrees = Number.isFinite(radians) ? (radians * 180) / Math.PI : 0;

  return {
    blurDensity,
    angle: normalizeAngle(degrees + 90),
  };
}

function measureStructure(luminance, width, height) {
  let verticalEnergy = 0;
  let horizontalEnergy = 0;
  let diagonalEnergy = 0;
  let diagonalPositiveEnergy = 0;
  let diagonalNegativeEnergy = 0;
  let radialEnergy = 0;
  let totalEnergy = 0;
  let weightedX = 0;
  let weightedY = 0;
  let centerEnergy = 0;
  let outerEnergy = 0;
  const columnEnergy = new Float32Array(width);
  const rowEnergy = new Float32Array(height);
  const quadrantEnergy = [0, 0, 0, 0];
  const center = { x: width / 2, y: height / 2 };

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const left = luminance[y * width + (x - 1)];
      const right = luminance[y * width + (x + 1)];
      const top = luminance[(y - 1) * width + x];
      const bottom = luminance[(y + 1) * width + x];
      const gx = right - left;
      const gy = bottom - top;
      const absX = Math.abs(gx);
      const absY = Math.abs(gy);
      const energy = Math.hypot(gx, gy);
      const fromCenterX = x - center.x;
      const fromCenterY = y - center.y;
      const fromCenterLength = Math.hypot(fromCenterX, fromCenterY) || 1;
      const gradientLength = energy || 1;
      const radialAlignment = Math.abs((gx * fromCenterX + gy * fromCenterY) / (gradientLength * fromCenterLength));
      const centerDistance = fromCenterLength / Math.hypot(center.x, center.y);

      verticalEnergy += absX;
      horizontalEnergy += absY;
      diagonalEnergy += Math.min(absX, absY);
      diagonalPositiveEnergy += Math.abs(gx + gy) * 0.5;
      diagonalNegativeEnergy += Math.abs(gx - gy) * 0.5;
      radialEnergy += radialAlignment * energy;
      totalEnergy += energy;
      weightedX += x * energy;
      weightedY += y * energy;
      columnEnergy[x] += energy;
      rowEnergy[y] += energy;

      if (centerDistance < 0.32) centerEnergy += energy;
      else if (centerDistance > 0.58) outerEnergy += energy;

      const quadrant = (x > center.x ? 1 : 0) + (y > center.y ? 2 : 0);
      quadrantEnergy[quadrant] += energy;
    }
  }

  const verticalDominance = totalEnergy ? clamp(verticalEnergy / (verticalEnergy + horizontalEnergy), 0, 1) : 0.5;
  const horizontalDominance = totalEnergy ? clamp(horizontalEnergy / (verticalEnergy + horizontalEnergy), 0, 1) : 0.5;
  const repetition = clamp((profileRhythm(columnEnergy) + profileRhythm(rowEnergy)) * 0.5, 0, 1);
  const geometricRhythm = clamp((diagonalEnergy / Math.max(0.0001, totalEnergy)) * 2.2 + repetition * 0.35, 0, 1);
  const diagonalDominance = clamp(
    Math.max(diagonalPositiveEnergy, diagonalNegativeEnergy) / Math.max(0.0001, verticalEnergy + horizontalEnergy),
    0,
    1,
  );
  const radialDominance = clamp(radialEnergy / Math.max(0.0001, totalEnergy), 0, 1);
  const concentration = clamp(centerEnergy / Math.max(0.0001, centerEnergy + outerEnergy), 0, 1);
  const distribution = distributionScore(quadrantEnergy);
  const balance = {
    x: totalEnergy ? clamp(weightedX / totalEnergy / width, 0.05, 0.95) : 0.5,
    y: totalEnergy ? clamp(weightedY / totalEnergy / height, 0.05, 0.95) : 0.5,
  };
  const dominantAxis = dominantAxisLabel({
    diagonalDominance,
    horizontalDominance,
    radialDominance,
    repetition,
    verticalDominance,
  });
  const shapeEnergy = shapeEnergyLabel({
    concentration,
    diagonalDominance,
    geometricRhythm,
    horizontalDominance,
    radialDominance,
    repetition,
    verticalDominance,
  });
  const spatialWeight = spatialWeightLabel(balance, distribution);
  const compositionType = compositionTypeLabel({
    concentration,
    dominantAxis,
    distribution,
    geometricRhythm,
    horizontalDominance,
    repetition,
    shapeEnergy,
    verticalDominance,
  });

  return {
    balance,
    compositionType,
    concentration,
    diagonalDominance,
    dominantAxis,
    distribution,
    geometricRhythm,
    horizontalDominance,
    radialDominance,
    repetition,
    shapeEnergy,
    spatialWeight,
    type: `${dominantAxis} / ${shapeEnergy}`,
    verticalDominance,
  };
}

function profileRhythm(profile) {
  const values = [...profile];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map((value) => value - average);
  const variance = centered.reduce((sum, value) => sum + value * value, 0) / centered.length;
  if (variance < 0.000001) return 0;

  let strongest = 0;
  const maxLag = Math.min(36, Math.floor(values.length / 2));
  for (let lag = 4; lag <= maxLag; lag += 1) {
    let score = 0;
    let count = 0;
    for (let index = 0; index < centered.length - lag; index += 1) {
      score += centered[index] * centered[index + lag];
      count += 1;
    }
    strongest = Math.max(strongest, score / Math.max(1, count) / variance);
  }

  return clamp(strongest, 0, 1);
}

function distributionScore(quadrants) {
  const total = quadrants.reduce((sum, value) => sum + value, 0);
  if (!total) return 1;

  const normalized = quadrants.map((value) => value / total);
  const max = Math.max(...normalized);
  const min = Math.min(...normalized);
  return clamp(1 - (max - min) * 1.8, 0, 1);
}

function dominantAxisLabel({ diagonalDominance, horizontalDominance, radialDominance, repetition, verticalDominance }) {
  if (radialDominance > 0.64 && repetition < 0.54) return 'radial';
  if (diagonalDominance > 0.62 && Math.abs(verticalDominance - horizontalDominance) < 0.16) return 'diagonal';
  if (verticalDominance > 0.58) return 'vertical';
  if (horizontalDominance > 0.58) return 'horizontal';
  return 'balanced / scattered';
}

function compositionTypeLabel({
  concentration,
  dominantAxis,
  distribution,
  geometricRhythm,
  horizontalDominance,
  repetition,
  shapeEnergy,
  verticalDominance,
}) {
  if (repetition > 0.48) return 'pattern / repetition';
  if (geometricRhythm > 0.46 && (verticalDominance > 0.54 || horizontalDominance > 0.54)) {
    return 'architecture / geometric';
  }
  if (dominantAxis === 'horizontal' && distribution > 0.48) return 'landscape / atmospheric';
  if (concentration > 0.58 && verticalDominance > 0.5) return 'portrait / emotional center';
  if (concentration > 0.52 || shapeEnergy === 'clustered') return 'object / single focal point';
  return 'abstract / unclear';
}

function shapeEnergyLabel({
  concentration,
  diagonalDominance,
  geometricRhythm,
  horizontalDominance,
  radialDominance,
  repetition,
  verticalDominance,
}) {
  if (repetition > 0.52 && geometricRhythm > 0.38) return 'grid-like';
  if (radialDominance > 0.62) return 'circular';
  if (concentration > 0.6) return 'clustered';
  if (horizontalDominance > 0.56 && geometricRhythm < 0.42) return 'layered';
  if (diagonalDominance > 0.58 && geometricRhythm < 0.5) return 'wave-like';
  if (verticalDominance > 0.56 || horizontalDominance > 0.56 || geometricRhythm > 0.44) return 'linear';
  return 'wave-like';
}

function spatialWeightLabel(balance, distribution) {
  if (distribution > 0.72 && Math.abs(balance.x - 0.5) < 0.1 && Math.abs(balance.y - 0.5) < 0.1) {
    return 'distributed';
  }
  if (Math.abs(balance.x - 0.5) < 0.11 && Math.abs(balance.y - 0.5) < 0.11) return 'centered';
  if (Math.abs(balance.x - 0.5) > Math.abs(balance.y - 0.5)) {
    return balance.x < 0.5 ? 'left-heavy' : 'right-heavy';
  }
  return balance.y < 0.5 ? 'top-heavy' : 'bottom-heavy';
}

function angleLabel(angle) {
  const normalized = (angle + 360) % 180;
  if (normalized < 22.5 || normalized >= 157.5) return 'horizontal drift';
  if (normalized < 67.5) return 'rising diagonal drift';
  if (normalized < 112.5) return 'vertical drift';
  return 'falling diagonal drift';
}

function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
