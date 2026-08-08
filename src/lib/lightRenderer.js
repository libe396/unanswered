import { hexToRgb, mixColors, rgbToHex, withAlpha } from './color.js';

const WIDTH = 1000;
const HEIGHT = 1000;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

export function renderLightGraphic(canvas, rawRules, variation = 1) {
  if (!canvas) return;

  const rules = applyEmotionModifiers(rawRules);

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const context = canvas.getContext('2d');
  const seed = hashRules(rules, variation);
  const random = mulberry32(seed);
  const palette = refinePalette(rules.palette, rules);
  const colorWeights = normalizePaletteWeights(rules.paletteWeights, palette.length);
  const origin = {
    x: clampToRange(rules.lightOrigin.x * WIDTH, 60, WIDTH - 60),
    y: clampToRange(rules.lightOrigin.y * HEIGHT, 60, HEIGHT - 60),
  };
  const field = createRuleField(rules, palette, colorWeights, origin, seed);

  paintCanvas(context, palette, colorWeights, rules, origin);
  paintMemoryField(context, field.memoryField, rules);
  paintSoftCircles(context, field.circles, rules);
  paintFaintLines(context, field.lines, rules);
  paintSensoryOrigin(context, palette, field.secondaryLights, rules, origin);
  paintIntersections(context, field.intersections, palette, rules);
  paintTexture(context, palette, rules, field.memoryField, random);
  applyContrastPass(context, palette, rules);
}

function createRuleField(rules, palette, colorWeights, origin, seed) {
  const random = mulberry32(seed ^ 0xa53a9d1f);
  const brightAnchors = getBrightRegionAnchors(rules, palette);
  const structureAnchors = getStructureAnchors(rules, palette);
  const memoryField = createMemoryField(rules, palette, brightAnchors, structureAnchors, origin);
  const circles = createSoftCircles(rules, palette, colorWeights, origin, brightAnchors, structureAnchors, memoryField, random);
  const secondaryLights = createSecondaryLights(rules, palette, colorWeights, origin, circles, brightAnchors, random);
  const lines = createFaintLines(
    rules,
    palette,
    colorWeights,
    origin,
    circles,
    secondaryLights,
    structureAnchors,
    memoryField,
    random,
  );
  const intersections = findIntersections(circles, lines, secondaryLights, origin, brightAnchors, structureAnchors, memoryField);

  return { circles, intersections, lines, memoryField, secondaryLights };
}

function paintCanvas(context, palette, colorWeights, rules, origin) {
  console.log('[BG] palette:', palette, 'colorWeights:', colorWeights);
  const motion = ((rules.motionDirection.angle || 0) * Math.PI) / 180;
  const atmosphericDark = getAtmosphericDark(palette, rules);
  const colorStops = getProportionalColorStops(palette, colorWeights);
  const dominant = colorStops[0]?.color || palette[0];
  const lastColor = colorStops[colorStops.length - 1]?.color || palette[palette.length - 1];

  // Weighted average of palette colors scaled to 18% — gives a dark but hue-correct base.
  let r = 0, g = 0, b = 0, totalW = 0;
  palette.forEach((hex, i) => {
    const w = colorWeights[i] || 1;
    const rgb = hexToRgb(hex);
    r += rgb[0] * w; g += rgb[1] * w; b += rgb[2] * w; totalW += w;
  });
  r = Math.round(r / totalW * 1.2);
  g = Math.round(g / totalW * 1.2);
  b = Math.round(b / totalW * 1.2);
  console.log('[BG] final bgColor:', `rgb(${r},${g},${b})`);

  // Paint palette-tinted base, then dark overlay on top.
  context.fillStyle = `rgb(${r},${g},${b})`;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = 'rgba(8,8,16,0.35)';
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Dominant palette color radial glow from light origin.
  const dominantHex = palette[0];
  const [dr, dg, db] = hexToRgb(dominantHex);
  const radGrad = context.createRadialGradient(
    WIDTH * rules.lightOrigin.x,
    HEIGHT * rules.lightOrigin.y,
    0,
    WIDTH * 0.5, HEIGHT * 0.5,
    WIDTH * 0.8,
  );
  radGrad.addColorStop(0, `rgba(${dr},${dg},${db},0.25)`);
  radGrad.addColorStop(1, `rgba(${dr},${dg},${db},0)`);
  context.fillStyle = radGrad;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.globalCompositeOperation = 'multiply';
  const vignette = context.createRadialGradient(origin.x, origin.y, 80, CENTER.x, CENTER.y, 720);
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(0.5, withAlpha(atmosphericDark, 0.02));
  vignette.addColorStop(0.78, withAlpha(atmosphericDark, rules.averageBrightness < 0.35 ? 0.38 : 0.22));
  vignette.addColorStop(1, withAlpha(atmosphericDark, rules.averageBrightness < 0.35 ? 0.64 : 0.38));
  context.fillStyle = vignette;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  const originWash = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, 620);
  originWash.addColorStop(0, 'rgba(255,255,255,0.018)');
  originWash.addColorStop(0.24, withAlpha(dominant, 0.014));
  originWash.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = originWash;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();
}

function createMemoryField(rules, palette, brightAnchors, structureAnchors, origin) {
  const structure = getStructure(rules);
  const brightCount = brightAnchors.length;
  const rhythm = clampToRange(
    structure.repetition * 0.34 + structure.geometricRhythm * 0.32 + structure.concentration * 0.22 + brightCount * 0.035,
    0,
    1,
  );
  const clusters = createMemoryClusters(brightAnchors, structureAnchors, palette, origin);
  const averageClusterDensity = clusters.length
    ? clusters.reduce((sum, cluster) => sum + cluster.density, 0) / clusters.length
    : 0;
  const density = clampToRange(
    brightCount * 0.065 + averageClusterDensity * 0.52 + rhythm * 0.34 + (1 - structure.distribution) * 0.18,
    0,
    1,
  );
  const concentration = clampToRange(structure.concentration * 0.48 + averageClusterDensity * 0.42 + brightCount * 0.025, 0, 1);

  return {
    clusters,
    concentration,
    density,
    rhythm,
    state:
      density > 0.72
        ? 'explosive'
        : density > 0.5
          ? 'concentrated'
          : density > 0.28
            ? 'balanced'
            : 'sparse',
  };
}

function createMemoryClusters(brightAnchors, structureAnchors, palette, origin) {
  const sources = brightAnchors.length
    ? brightAnchors
    : [
        {
          color: palette[0],
          strength: 0.42,
          x: origin.x,
          y: origin.y,
        },
        ...structureAnchors.slice(0, 3),
      ];
  const clusters = [];
  const clusterRadius = brightAnchors.length > 5 ? 170 : 210;

  sources.forEach((source) => {
    const existing = clusters.find((cluster) => Math.hypot(cluster.centerX - source.x, cluster.centerY - source.y) < clusterRadius);
    const strength = source.strength || source.brightness || 0.4;

    if (existing) {
      const total = existing.totalStrength + strength;
      existing.centerX = (existing.centerX * existing.totalStrength + source.x * strength) / total;
      existing.centerY = (existing.centerY * existing.totalStrength + source.y * strength) / total;
      existing.totalStrength = total;
      existing.members.push(source);
      existing.dominantColor = mixColors(existing.dominantColor, source.color || palette[0], strength / total);
      return;
    }

    clusters.push({
      centerX: source.x,
      centerY: source.y,
      dominantColor: source.color || palette[0],
      members: [source],
      totalStrength: strength,
    });
  });

  return clusters
    .map((cluster) => {
      const distances = cluster.members.map((member) => Math.hypot(member.x - cluster.centerX, member.y - cluster.centerY));
      const radius = clampToRange(Math.max(58, ...distances) + 68 + cluster.members.length * 14, 72, 260);
      const direction = cluster.members.length > 1 ? clusterDirection(cluster.members, cluster.centerX, cluster.centerY) : 0;
      const density = clampToRange(cluster.members.length / 8 + cluster.totalStrength * 0.22 + (1 - radius / 340) * 0.26, 0, 1);

      return {
        centerX: cluster.centerX,
        centerY: cluster.centerY,
        density,
        direction,
        dominantColor: cluster.dominantColor,
        radius,
        strength: clampToRange(cluster.totalStrength / Math.max(1, cluster.members.length) + density * 0.36, 0, 1),
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

function paintMemoryField(context, memoryField, rules) {
  if (!memoryField?.clusters?.length || memoryField.density < 0.08) return;

  context.save();
  context.globalCompositeOperation = 'screen';

  memoryField.clusters.forEach((cluster, clusterIndex) => {
    const particleCount = Math.round(16 + cluster.density * 44 + memoryField.rhythm * 18);
    const radius = cluster.radius * (0.7 + memoryField.concentration * 0.26);

    for (let index = 0; index < particleCount; index += 1) {
      const angle = cluster.direction + index * 2.399 + Math.sin(index * 1.71 + clusterIndex) * 0.82;
      const distance = Math.pow(((index * 37) % particleCount) / Math.max(1, particleCount - 1), 0.66) * radius;
      const x = cluster.centerX + Math.cos(angle) * distance * (0.78 + cluster.density * 0.38);
      const y = cluster.centerY + Math.sin(angle) * distance * (0.72 + memoryField.rhythm * 0.34);
      const size = 1.8 + ((index + clusterIndex) % 5) * 0.6 + cluster.density * 2.2;
      const opacity = (0.012 + cluster.density * 0.024 + memoryField.density * 0.012) * (1 - distance / (radius * 1.35));

      context.save();
      context.filter = `blur(${1.6 + cluster.density * 2.8}px)`;
      context.fillStyle = withAlpha(mixColors(cluster.dominantColor, '#ffffff', 0.22), Math.max(0, opacity));
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    context.save();
    context.filter = `blur(${18 + cluster.density * 18}px)`;
    context.strokeStyle = withAlpha(cluster.dominantColor, 0.018 + cluster.density * 0.026);
    context.lineWidth = 1.2 + cluster.density * 2.2;
    context.beginPath();
    const start = cluster.direction - Math.PI * 0.42;
    context.ellipse(cluster.centerX, cluster.centerY, radius * 0.64, radius * 0.28, cluster.direction, start, start + Math.PI * 1.28);
    context.stroke();
    context.restore();
  });

  context.restore();
}

function createSoftCircles(rules, palette, colorWeights, origin, brightAnchors, structureAnchors, memoryField, random) {
  const structure = getStructure(rules);
  const profile = getStructureProfile(structure);
  const weightedPalette = getWeightedPaletteOrder(palette, colorWeights);
  const circleCount = clampToRange(
    Math.round(
      (4.2 + rules.blurDensity * 1.8 + structure.concentration * 1.1 + memoryField.density * 2.4) *
        profile.circleMultiplier,
    ),
    3,
    8,
  );
  const spread = (165 + rules.blurDensity * 330) * profile.spreadMultiplier * (1 - memoryField.density * 0.34);
  const structureCenter = {
    x: mixNumber(origin.x, structure.balance.x * WIDTH, 0.48),
    y: mixNumber(origin.y, structure.balance.y * HEIGHT, 0.48),
  };
  const verticalBias = structure.verticalDominance - structure.horizontalDominance;
  const rhythmStep = 0.9 + structure.repetition * 0.9;
  const circles = [];
  const featureAnchors = [
    {
      color: brightAnchors[0]?.color || palette[0],
      kind: 'origin',
      strength: brightAnchors[0]?.strength || 1,
      x: origin.x,
      y: origin.y,
    },
    ...memoryField.clusters.slice(0, 4).map((cluster) => ({
      color: cluster.dominantColor,
      density: cluster.density,
      kind: 'cluster',
      radius: cluster.radius,
      strength: cluster.strength,
      x: cluster.centerX,
      y: cluster.centerY,
    })),
    ...brightAnchors.slice(1, 6),
    ...structureAnchors.slice(0, 5),
    {
      color: weightedPalette[0],
      kind: 'balance',
      strength: 0.42 + structure.distribution * 0.28,
      x: structureCenter.x,
      y: structureCenter.y,
    },
  ].filter((anchor, index, list) => {
    const firstSimilar = list.findIndex((candidate) => Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y) < 58);
    return firstSimilar === index;
  });

  for (let index = 0; index < circleCount; index += 1) {
    const orbit = index / Math.max(1, circleCount - 1);
    const hierarchy = getCircleHierarchy(index, circleCount);
    const depth = getCircleDepth(index, circleCount, memoryField);
    const anchor = featureAnchors[index % featureAnchors.length] || featureAnchors[0];
    const paletteIndex = weightedPaletteIndex(colorWeights, index / Math.max(1, circleCount - 1), index);
    const nextPaletteIndex = weightedPaletteIndex(colorWeights, (index + 1.7) / Math.max(1, circleCount + 1), index + 3);
    const angle =
      profile.circleAngle +
      index * (1.618 - structure.repetition * 0.38) * rhythmStep * profile.orbitTurn +
      (random() - 0.5) * (0.8 + rules.blurDensity) * profile.irregularity;
    const distance =
      index === 0
        ? 34 + random() * 42
        : 82 + Math.pow(random(), 0.74) * spread + orbit * rules.blurDensity * 120;
    const baseRadius =
      hierarchy === 'large'
        ? 210 + random() * 190 + rules.blurDensity * 92
        : hierarchy === 'medium'
          ? 132 + random() * 124 + rules.blurDensity * 54
          : 58 + random() * 86 + rules.blurDensity * 30;
    const hierarchyScale = hierarchy === 'large' ? 0.74 : hierarchy === 'medium' ? 0.86 : 0.98;
    const radius =
      baseRadius *
      profile.radiusMultiplier *
      hierarchyScale *
      (anchor.kind === 'cluster'
        ? 0.82 + memoryField.density * 0.18
        : memoryField.density > 0.62
          ? 0.9
          : 1);
    const structuralScaleX = clampToRange(1 - verticalBias * 0.75, 0.46, 1.7);
    const structuralScaleY = clampToRange(1 + verticalBias * 0.75, 0.46, 1.7);
    const anchorJitter =
      anchor.kind === 'origin'
        ? 18 + random() * 22
        : anchor.kind === 'cluster'
          ? 16 + random() * 34
          : anchor.kind === 'bright'
          ? 26 + random() * 42
          : 34 + random() * 54;
    const proceduralX =
      index === 0
        ? origin.x
        : structureCenter.x + Math.cos(angle) * distance * structuralScaleX * profile.axisScaleX;
    const proceduralY =
      index === 0
        ? origin.y
        : structureCenter.y + Math.sin(angle) * distance * 0.78 * structuralScaleY * profile.axisScaleY;
    const clusterPull = anchor.kind === 'cluster' ? memoryField.density * 0.72 : 0;
    const anchorWeight =
      anchor.kind === 'origin'
        ? 0.88
        : anchor.kind === 'cluster'
          ? 0.74 + clusterPull * 0.16
          : anchor.kind === 'bright'
            ? 0.78
            : 0.62;
    const x =
      mixNumber(proceduralX, anchor.x, anchorWeight) +
      Math.cos(angle + index * 0.41) * anchorJitter * profile.axisScaleX;
    const y =
      mixNumber(proceduralY, anchor.y, anchorWeight) +
      Math.sin(angle + index * 0.41) * anchorJitter * profile.axisScaleY;
    const dominanceBoost = colorWeights[paletteIndex] || 0.18;
    const densityBoost = anchor.kind === 'cluster' ? memoryField.density * 0.045 + (anchor.density || 0) * 0.026 : 0;
    const featureColor = refineFeatureColor(anchor.color, palette, rules);
    const inheritedColor = mixColors(
      palette[paletteIndex],
      palette[nextPaletteIndex],
      0.08 + random() * 0.14,
    );

    const circleColor = getCirclePaletteColor(
      mixColors(inheritedColor, featureColor, anchor.kind === 'bright' ? 0.70 : 0.46),
      rules,
      index,
    );
    const circleSecondaryColor = getCirclePaletteColor(
      mixColors(palette[nextPaletteIndex], inheritedColor, 0.42),
      rules,
      index + 2,
    );
    const circleAccentColor = getCirclePaletteColor(
      mixColors(palette[nextPaletteIndex], featureColor, anchor.kind === 'cluster' ? 0.46 : 0.36),
      rules,
      index + 5,
    );

    circles.push({
      atmosphereAngle: angle + (random() - 0.5) * 1.2,
      cloudOffset: {
        x: Math.cos(angle + random() * 1.7) * radius * (0.12 + random() * 0.18),
        y: Math.sin(angle + random() * 1.7) * radius * (0.12 + random() * 0.18),
      },
      coreOffset: {
        x: Math.cos(angle - random() * 1.3) * radius * (0.08 + random() * 0.16),
        y: Math.sin(angle - random() * 1.3) * radius * (0.08 + random() * 0.16),
      },
      blur:
        hierarchy === 'large'
          ? (9 + rules.blurDensity * 13 + random() * 9) * depth.blurScale
          : hierarchy === 'medium'
            ? (5 + rules.blurDensity * 10 + random() * 7) * depth.blurScale
            : (3 + rules.blurDensity * 7 + random() * 5) * depth.blurScale,
      accentColor: circleAccentColor,
      color: circleColor,
      depth: depth.name,
      hierarchy,
      source: anchor.kind,
      opacity:
        ((hierarchy === 'large' ? 0.25 : hierarchy === 'medium' ? 0.20 : 0.14) +
          dominanceBoost * 0.084 +
          densityBoost +
          memoryField.density * 0.018 +
          rules.averageBrightness * 0.017 +
          anchor.strength * 0.02) *
        depth.opacityScale,
      radius: radius * depth.radiusScale,
      secondaryColor: circleSecondaryColor,
      x: clampToRange(x, -120, WIDTH + 120),
      y: clampToRange(y, -120, HEIGHT + 120),
    });
  }

  return circles;
}

function paintSoftCircles(context, circles, rules) {
  context.save();
  context.globalCompositeOperation = 'screen';

  circles.forEach((circle, index) => {
    const depthOpacity =
      circle.depth === 'front' ? 1.18 : circle.depth === 'background' ? 0.86 : 1;
    const depthBlur = circle.depth === 'front' ? 0.82 : circle.depth === 'background' ? 1.18 : 1;
    const cloudX = circle.x + circle.cloudOffset.x;
    const cloudY = circle.y + circle.cloudOffset.y;
    const coreX = circle.x + circle.coreOffset.x;
    const coreY = circle.y + circle.coreOffset.y;
    const secondaryColor = circle.secondaryColor || getCircleShiftColor(circle.color, index);
    const accentColor = circle.accentColor || getCircleShiftColor(secondaryColor, index + 3);
    const pooledColor = mixColors(secondaryColor, accentColor, 0.28);
    const highlightColor = getPaletteHighlightColor(circle.color, secondaryColor, accentColor, rules);
    const bodyCenterOpacity = clampToRange(0.55 + (index % 3) * 0.075, 0.55, 0.70) * depthOpacity;

    // Body: deep, saturated fill — four-stop gradient for strong center presence.
    context.save();
    context.globalCompositeOperation = 'source-over';
    context.filter = 'blur(0.5px)';
    const body = context.createRadialGradient(
      circle.x, circle.y, 0,
      circle.x, circle.y, circle.radius * 0.92,
    );
    body.addColorStop(0, withAlpha(circle.color, bodyCenterOpacity));
    body.addColorStop(0.3, withAlpha(circle.color, 0.4 * depthOpacity));
    body.addColorStop(0.6, withAlpha(circle.color, 0.15 * depthOpacity));
    body.addColorStop(1.0, withAlpha(circle.color, 0));
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(circle.x, circle.y, circle.radius * 0.92, circle.radius * 0.78, circle.atmosphereAngle, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Foundation: readable memory-field silhouette.
    context.save();
    context.globalCompositeOperation = 'source-over';
    context.filter = `blur(${Math.max(4, circle.blur * depthBlur * 0.58)}px)`;
    const silhouette = context.createRadialGradient(
      circle.x,
      circle.y,
      circle.radius * 0.12,
      circle.x,
      circle.y,
      circle.radius * 1.02,
    );
    silhouette.addColorStop(0, withAlpha(mixColors(circle.color, secondaryColor, 0.18), circle.opacity * 0.34 * depthOpacity));
    silhouette.addColorStop(0.5, withAlpha(circle.color, circle.opacity * 0.5 * depthOpacity));
    silhouette.addColorStop(0.78, withAlpha(mixColors(circle.color, accentColor, 0.22), circle.opacity * 0.24 * depthOpacity));
    silhouette.addColorStop(1, withAlpha(mixColors(circle.color, secondaryColor, 0.18), 0));
    context.fillStyle = silhouette;
    context.beginPath();
    context.ellipse(circle.x, circle.y, circle.radius * 0.96, circle.radius * 0.82, circle.atmosphereAngle, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Layer 1: large diffuse glow.
    context.save();
    context.filter = `blur(${circle.blur * depthBlur * 1.1}px)`;
    const diffuse = context.createRadialGradient(
      circle.x,
      circle.y,
      circle.radius * 0.02,
      circle.x,
      circle.y,
      circle.radius * 1.08,
    );
    diffuse.addColorStop(0, withAlpha(mixColors(circle.color, highlightColor, 0.045), circle.opacity * 0.64 * depthOpacity));
    diffuse.addColorStop(0.38, withAlpha(mixColors(circle.color, secondaryColor, 0.24), circle.opacity * 1.06 * depthOpacity));
    diffuse.addColorStop(0.68, withAlpha(mixColors(circle.color, accentColor, 0.24), circle.opacity * 0.53 * depthOpacity));
    diffuse.addColorStop(1, withAlpha(circle.color, 0));
    context.fillStyle = diffuse;
    context.beginPath();
    context.ellipse(circle.x, circle.y, circle.radius * 1.04, circle.radius * 0.88, circle.atmosphereAngle, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Layer 2: offset color cloud.
    context.save();
    context.globalCompositeOperation = 'screen';
    context.filter = `blur(${Math.max(4, circle.blur * 0.72)}px)`;
    const cloud = context.createRadialGradient(cloudX, cloudY, circle.radius * 0.04, cloudX, cloudY, circle.radius * 0.72);
    cloud.addColorStop(0, withAlpha(mixColors(pooledColor, highlightColor, 0.035), circle.opacity * 0.76 * depthOpacity));
    cloud.addColorStop(0.4, withAlpha(secondaryColor, circle.opacity * 0.67 * depthOpacity));
    cloud.addColorStop(0.72, withAlpha(mixColors(secondaryColor, accentColor, 0.46), circle.opacity * 0.25 * depthOpacity));
    cloud.addColorStop(1, withAlpha(pooledColor, 0));
    context.fillStyle = cloud;
    context.beginPath();
    context.ellipse(cloudX, cloudY, circle.radius * 0.72, circle.radius * 0.44, circle.atmosphereAngle + 0.54, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Layer 3: local density core, intentionally off-center.
    context.save();
    context.globalCompositeOperation = 'screen';
    context.filter = `blur(${Math.max(2.4, circle.blur * 0.36)}px)`;
    const core = context.createRadialGradient(coreX, coreY, 0, coreX, coreY, circle.radius * 0.34);
    core.addColorStop(0, withAlpha(mixColors(accentColor, highlightColor, 0.06), circle.opacity * 0.48 * depthOpacity));
    core.addColorStop(0.48, withAlpha(mixColors(pooledColor, circle.color, 0.32), circle.opacity * 0.34 * depthOpacity));
    core.addColorStop(1, withAlpha(pooledColor, 0));
    context.fillStyle = core;
    context.beginPath();
    context.ellipse(coreX, coreY, circle.radius * 0.32, circle.radius * 0.22, circle.atmosphereAngle - 0.7, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Layer 4: soft fading edge with uneven disappearance.
    context.save();
    context.globalCompositeOperation = 'screen';
    context.filter = `blur(${Math.max(4.5, circle.blur * 0.56)}px)`;
    const edge = context.createRadialGradient(circle.x, circle.y, circle.radius * 0.48, circle.x, circle.y, circle.radius * 1.02);
    edge.addColorStop(0, withAlpha(circle.color, 0));
    edge.addColorStop(0.5, withAlpha(mixColors(circle.color, secondaryColor, 0.24), circle.opacity * 0.21 * depthOpacity));
    edge.addColorStop(0.68, withAlpha(pooledColor, circle.opacity * 0.25 * depthOpacity));
    edge.addColorStop(0.84, withAlpha(mixColors(circle.color, accentColor, 0.14), circle.opacity * 0.10 * depthOpacity));
    edge.addColorStop(1, withAlpha(circle.color, 0));
    context.fillStyle = edge;
    context.beginPath();
    context.ellipse(
      circle.x - circle.cloudOffset.x * 0.22,
      circle.y - circle.cloudOffset.y * 0.22,
      circle.radius * 0.98,
      circle.radius * 0.78,
      circle.atmosphereAngle + 0.2,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();

    if (index % 4 === 0 || rules.blurDensity > 0.82) {
      const circleShadow = getCircleShadowColor(circle.color, rules);
      context.save();
      context.globalCompositeOperation = 'multiply';
      context.filter = `blur(${circle.blur * 0.46}px)`;
      context.fillStyle = withAlpha(circleShadow, 0.016 + rules.blurDensity * 0.02);
      context.beginPath();
      context.arc(circle.x, circle.y, circle.radius * 1.08, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  });

  circles.forEach((circle, circleIndex) => {
    for (let otherIndex = circleIndex + 1; otherIndex < circles.length; otherIndex += 1) {
      const other = circles[otherIndex];
      const distance = Math.hypot(other.x - circle.x, other.y - circle.y);
      const overlap = circle.radius + other.radius - distance;
      if (overlap <= Math.min(circle.radius, other.radius) * 0.12) continue;

      const x = mixNumber(circle.x, other.x, circle.radius / (circle.radius + other.radius));
      const y = mixNumber(circle.y, other.y, circle.radius / (circle.radius + other.radius));
      const radius = clampToRange(overlap * 0.34, 32, 118);
      const strength = clampToRange(overlap / Math.min(circle.radius, other.radius), 0, 1);

      context.save();
      context.globalCompositeOperation = 'screen';
      context.filter = `blur(${5 + rules.blurDensity * 5}px)`;
      const overlapGlow = context.createRadialGradient(x, y, 0, x, y, radius);
      const color = mixColors(circle.color, other.color, 0.5);
      const overlapAccent = mixColors(circle.accentColor || circle.color, other.secondaryColor || other.color, 0.5);
      const pooledColor = mixColors(color, overlapAccent, 0.3);
      const overlapHighlight = getPaletteHighlightColor(color, overlapAccent, pooledColor, rules);
      overlapGlow.addColorStop(0, withAlpha(mixColors(pooledColor, overlapHighlight, 0.055), 0.07 + strength * 0.052 + (circle.opacity + other.opacity) * 0.26));
      overlapGlow.addColorStop(0.42, withAlpha(pooledColor, 0.056 + strength * 0.044 + (circle.opacity + other.opacity) * 0.15));
      overlapGlow.addColorStop(0.72, withAlpha(color, 0.024 + strength * 0.03));
      overlapGlow.addColorStop(1, withAlpha(color, 0));
      context.fillStyle = overlapGlow;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      context.restore();

      context.save();
      context.globalCompositeOperation = 'multiply';
      context.filter = `blur(${8 + rules.blurDensity * 4}px)`;
      const density = context.createRadialGradient(x, y, 0, x, y, radius * 1.15);
      const shadow = getCircleShadowColor(pooledColor, rules);
      density.addColorStop(0, withAlpha(shadow, 0.018 + strength * 0.026));
      density.addColorStop(1, withAlpha(shadow, 0));
      context.fillStyle = density;
      context.fillRect(x - radius * 1.15, y - radius * 1.15, radius * 2.3, radius * 2.3);
      context.restore();
    }
  });

  context.restore();
}

function createSecondaryLights(rules, palette, colorWeights, origin, circles, brightAnchors, random) {
  const structure = getStructure(rules);
  const count = clampToRange(Math.round(2 + structure.concentration * 1.4 + structure.repetition * 1.6), 2, 5);
  if (brightAnchors.length > 1) {
    return brightAnchors.slice(1, count + 1).map((anchor, index) => ({
      color: refineFeatureColor(anchor.color, palette, rules),
      kind: 'secondary',
      opacity: 0.1 + anchor.strength * 0.1,
      radius: clampToRange(26 + anchor.size * 170 + anchor.strength * 20, 26, 64),
      source: 'bright-region',
      strength: anchor.strength,
      x: anchor.x,
      y: anchor.y,
    }));
  }

  const sortedCircles = [...circles]
    .map((circle) => ({
      ...circle,
      score:
        circle.radius * 0.42 +
        circle.opacity * 460 -
        Math.hypot(circle.x - origin.x, circle.y - origin.y) * 0.08,
    }))
    .sort((a, b) => b.score - a.score);
  const lights = [];

  sortedCircles.forEach((circle, index) => {
    if (lights.length >= count) return;

    const angleToOrigin = Math.atan2(circle.y - origin.y, circle.x - origin.x);
    const distance = Math.hypot(circle.x - origin.x, circle.y - origin.y);
    const paletteIndex = weightedPaletteIndex(colorWeights, (index + 0.5) / Math.max(1, count), index + 7);
    const candidate = {
      color: mixColors(palette[paletteIndex], circle.color, 0.42),
      kind: 'secondary',
      opacity: 0.1 + circle.opacity * 0.52,
      radius: clampToRange(circle.radius * 0.16, 26, 62),
      x: clampToRange(origin.x + Math.cos(angleToOrigin) * distance * (0.48 + random() * 0.3), 52, WIDTH - 52),
      y: clampToRange(origin.y + Math.sin(angleToOrigin) * distance * (0.48 + random() * 0.3), 52, HEIGHT - 52),
    };
    const tooClose = lights.some((light) => Math.hypot(light.x - candidate.x, light.y - candidate.y) < 118);

    if (!tooClose && Math.hypot(candidate.x - origin.x, candidate.y - origin.y) > 92) {
      lights.push(candidate);
    }
  });

  while (lights.length < count) {
    const angle = getStructuralAngle(rules) + (lights.length % 2 === 0 ? 1 : -1) * (0.62 + random() * 0.42);
    const distance = 160 + random() * 330;
    const paletteIndex = weightedPaletteIndex(colorWeights, random(), lights.length + 11);
    lights.push({
      color: palette[paletteIndex],
      kind: 'secondary',
      opacity: 0.09 + random() * 0.055,
      radius: 24 + random() * 28,
      x: clampToRange(origin.x + Math.cos(angle) * distance, 58, WIDTH - 58),
      y: clampToRange(origin.y + Math.sin(angle) * distance, 58, HEIGHT - 58),
    });
  }

  return lights;
}

function createFaintLines(rules, palette, colorWeights, origin, circles, secondaryLights, structureAnchors, memoryField, random) {
  const structure = getStructure(rules);
  const profile = getStructureProfile(structure);
  const totalWeight = colorWeights.reduce((sum, w) => sum + w, 0) || 1;
  const backgroundLuminance = palette.reduce((sum, color, i) => {
    const hsl = rgbToHsl(hexToRgb(color));
    return sum + hsl.l * (colorWeights[i] || 0);
  }, 0) / totalWeight;
  const structuralAngle = getStructuralAngle(rules);
  const motion = mixAngle(((rules.motionDirection.angle || 0) * Math.PI) / 180, structuralAngle, profile.structureInfluence);
  const perpendicular = motion + Math.PI / 2;
  const lineCount = clampToRange(
    Math.round(
      (1.2 + structure.repetition * 0.2 + structure.geometricRhythm * 0.1 + memoryField.density * 0.3) *
        profile.lineMultiplier,
    ),
    1,
    2,
  );
  const structureCenter = {
    x: mixNumber(origin.x, structure.balance.x * WIDTH, 0.56),
    y: mixNumber(origin.y, structure.balance.y * HEIGHT, 0.56),
  };
  const anchors = selectLineAnchors(circles, secondaryLights, structureAnchors, memoryField, origin, structureCenter, lineCount + 8);
  const lines = [];
  const usedAngles = [];

  // Derive base angle from image's dominant edge structure (structure tensor output).
  // motionDirection.angle is in degrees; convert to radians for geometry.
  const motionAngleRad = (rules.motionDirection.angle * Math.PI) / 180;

  // Bias axis choice from image structure: if horizontal energy dominates, prefer
  // horizontal sweeps; if vertical dominates, prefer diagonal; diagonal image energy
  // increases diagonal sweep probability.
  const hDom = structure.horizontalDominance;
  const vDom = structure.verticalDominance;
  const dDom = structure.diagonalDominance;
  const horizontalBias = clampToRange(0.45 + hDom * 0.4 - vDom * 0.25 + dDom * 0.1, 0.25, 0.75);

  // Image's brightest region (normalized 0-1) — lines should emerge from this area.
  const brightX = rules.lightOrigin.x * WIDTH;
  const brightY = rules.lightOrigin.y * HEIGHT;

  for (let index = 0; index < lineCount; index += 1) {
    const isHorizontal = random() < horizontalBias;
    // Per-line variation: small nudge around the image's dominant angle (±10°).
    const angleVariation = (random() - 0.5) * (Math.PI * 20 / 180);
    // The image's structure angle gives us the entry/exit slope — apply directly.
    const sweepAngle = motionAngleRad + angleVariation;

    let start, end;
    if (isHorizontal) {
      // Entry Y biased 60% toward the bright region, 40% free variation.
      const freeY = 80 + random() * (HEIGHT - 160);
      const entryY = mixNumber(freeY, clampToRange(brightY, 80, HEIGHT - 80), 0.6);
      const exitY = clampToRange(entryY + Math.tan(sweepAngle) * WIDTH, -40, HEIGHT + 40);
      start = { x: -20, y: entryY };
      end = { x: WIDTH + 20, y: exitY };
    } else {
      // Entry X biased 60% toward the bright region.
      const freeX = 80 + random() * (WIDTH - 160);
      const entryX = mixNumber(freeX, clampToRange(brightX, 80, WIDTH - 80), 0.6);
      // Diagonal: derive exit from the perpendicular sweep angle.
      const perpAngle = sweepAngle + Math.PI / 2;
      const exitX = clampToRange(entryX + Math.tan(perpAngle) * HEIGHT, -40, WIDTH + 40);
      start = { x: entryX, y: -20 };
      end = { x: exitX, y: HEIGHT + 20 };
    }

    const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const direction = Math.atan2(end.y - start.y, end.x - start.x);

    if (hasSimilarAngle(direction, usedAngles, 0.28)) {
      const nudge = (index % 2 === 0 ? 1 : -1) * (0.35 + random() * 0.2);
      if (isHorizontal) {
        end.y = clampToRange(end.y + nudge * 150, -40, HEIGHT + 40);
      } else {
        end.x = clampToRange(end.x + nudge * 150, -40, WIDTH + 40);
      }
    }
    usedAngles.push(Math.atan2(end.y - start.y, end.x - start.x));

    // Single quadratic arc — one control point, no direction changes.
    // Arc side alternates per line so they curve in different directions.
    const arcSign = index % 2 === 0 ? 1 : -1;
    const arcOffset = distance * (0.08 + random() * 0.04) * arcSign; // 8–12% of length
    const perpX = Math.cos(direction + Math.PI / 2);
    const perpY = Math.sin(direction + Math.PI / 2);
    // Control point at midpoint, offset perpendicularly
    const control = {
      x: (start.x + end.x) / 2 + perpX * arcOffset,
      y: (start.y + end.y) / 2 + perpY * arcOffset,
    };

    const paletteIndex = weightedPaletteIndex(colorWeights, index / Math.max(1, lineCount - 1), index + 13);
    const lineBaseColor = refineFeatureColor(palette[paletteIndex], palette, rules);

    lines.push({
      blur: Math.min(1.4 + rules.blurDensity * 2.6, 6.0),
      color: mixColors(lineBaseColor, '#ffffff', 0.75),
      control,
      end,
      opacity: ((index < 1 ? 0.25 : 0.18) + random() * 0.03 + memoryField.density * 0.015) * (backgroundLuminance > 0.55 ? 0.85 : 1.0),
      role: index < 1 ? 'primary' : 'secondary',
      start,
      purpose: isHorizontal ? 'horizontal sweep' : 'diagonal sweep',
      width: (index < 1 ? 1.8 : 1.1) + random() * 0.3,
    });
  }

  return lines;
}

function drawArc(context, line) {
  context.beginPath();
  context.moveTo(line.start.x, line.start.y);
  context.quadraticCurveTo(line.control.x, line.control.y, line.end.x, line.end.y);
  context.stroke();
}

function paintFaintLines(context, lines, rules) {
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.lineCap = 'round';
  context.lineJoin = 'round';

  lines.forEach((line) => {
    // Luminous halo pass — wide soft glow.
    context.save();
    context.filter = 'blur(4px)';
    context.lineWidth = line.width * 3;
    context.strokeStyle = withAlpha(line.color, 0.10);
    drawArc(context, line);
    context.restore();

    // Diffuse glow pass — medium halo.
    context.save();
    context.filter = `blur(${line.blur + 0.34}px)`;
    context.lineWidth = line.width * (line.role === 'primary' ? 2.45 : 1.9);
    context.strokeStyle = withAlpha(line.color, line.opacity * (line.role === 'primary' ? 0.72 : 0.52));
    drawArc(context, line);
    context.restore();

    // Core trace pass — thin, sharp.
    context.save();
    context.filter = `blur(${line.blur * 0.5}px)`;
    context.lineWidth = line.width;
    context.strokeStyle = withAlpha(line.color, line.opacity);
    drawArc(context, line);
    context.restore();
  });

  context.restore();
}

function paintSensoryOrigin(context, palette, secondaryLights, rules, origin) {
  context.save();
  context.globalCompositeOperation = 'screen';

  const radius = 108 + rules.averageBrightness * 116 + rules.blurDensity * 56;
  const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius);
  glow.addColorStop(0, 'rgba(255,255,255,0.72)');
  glow.addColorStop(0.06, withAlpha(mixColors(palette[0], '#ffffff', 0.3), 0.44));
  glow.addColorStop(0.2, withAlpha(palette[1], 0.13));
  glow.addColorStop(0.42, withAlpha(palette[2], 0.04));
  glow.addColorStop(1, withAlpha(palette[2], 0));

  context.filter = `blur(${2.2 + rules.blurDensity * 4.6}px)`;
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  secondaryLights.forEach((light) => {
    const secondaryGlow = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius * 2.8);
    secondaryGlow.addColorStop(0, 'rgba(255,255,255,0.28)');
    secondaryGlow.addColorStop(0.2, withAlpha(mixColors(light.color, '#ffffff', 0.24), light.opacity * 0.74));
    secondaryGlow.addColorStop(1, withAlpha(light.color, 0));

    context.filter = `blur(${3.5 + rules.blurDensity * 3}px)`;
    context.fillStyle = secondaryGlow;
    context.fillRect(light.x - light.radius * 3, light.y - light.radius * 3, light.radius * 6, light.radius * 6);
  });

  context.filter = `blur(${0.8 + rules.blurDensity * 1.2}px)`;
  context.fillStyle = 'rgba(255,255,255,0.54)';
  context.beginPath();
  context.arc(origin.x, origin.y, 2.6 + rules.averageBrightness * 1.8, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function findIntersections(circles, lines, secondaryLights, origin, brightAnchors, structureAnchors, memoryField) {
  const events = [];

  circles.forEach((circle, circleIndex) => {
    for (let otherIndex = circleIndex + 1; otherIndex < circles.length; otherIndex += 1) {
      const other = circles[otherIndex];
      const dx = other.x - circle.x;
      const dy = other.y - circle.y;
      const distance = Math.hypot(dx, dy);
      const overlap = circle.radius + other.radius - distance;

      if (overlap > Math.min(circle.radius, other.radius) * 0.16 && distance > 8) {
        const influence = circle.radius / (circle.radius + other.radius);
        const overlapPoints = getCircleIntersectionPoints(circle, other);
        const points = overlapPoints.length
          ? overlapPoints.slice(0, 2)
          : [{ x: mixNumber(circle.x, other.x, influence), y: mixNumber(circle.y, other.y, influence) }];

        points.forEach((point) => {
          pushIntersection(events, {
            circleIndex,
            color: mixColors(circle.color, other.color, 0.5),
            kind: 'circle-overlap',
            otherIndex,
            sourceRelationship: 'soft circle overlap',
            strength: 0.46 + overlap / Math.max(circle.radius, other.radius) + (circle.opacity + other.opacity) * 1.55,
            x: point.x,
            y: point.y,
          });
        });
      }
    }
  });

  secondaryLights.forEach((light, index) => {
    pushIntersection(events, {
      color: light.color,
      kind: 'secondary-memory',
      lightIndex: index,
      sourceRelationship: 'secondary light event',
      strength: 0.34 + light.opacity * 0.9,
      x: mixNumber(light.x, origin.x, 0.08),
      y: mixNumber(light.y, origin.y, 0.08),
    });
  });

  brightAnchors.forEach((region, regionIndex) => {
    structureAnchors.forEach((anchor, anchorIndex) => {
      const distance = Math.hypot(region.x - anchor.x, region.y - anchor.y);
      const originAlignment = distanceToSegment(anchor, origin, region);
      if (distance < 180 || originAlignment < 28) {
        pushIntersection(events, {
          anchorIndex,
          color: mixColors(region.color, anchor.color, 0.42),
          kind: 'region-structure-alignment',
          regionIndex,
          sourceRelationship: 'brightRegion aligned with structureAnchor',
          strength: 0.48 + region.strength * 0.5 + anchor.strength * 0.38,
          x: mixNumber(region.x, anchor.x, distance < 180 ? 0.42 : 0.24),
          y: mixNumber(region.y, anchor.y, distance < 180 ? 0.42 : 0.24),
        });
      }
    });
  });

  memoryField.clusters.forEach((cluster, clusterIndex) => {
    circles.forEach((circle, circleIndex) => {
      const distance = Math.hypot(circle.x - cluster.centerX, circle.y - cluster.centerY);
      if (distance > cluster.radius * 0.82) return;

      pushIntersection(events, {
        circleIndex,
        clusterIndex,
        color: mixColors(circle.color, cluster.dominantColor, 0.48),
        kind: 'memory-field-resonance',
        sourceRelationship: 'memory field through soft circle',
        strength: 0.34 + cluster.density * 0.48 + circle.opacity * 1.2 + memoryField.density * 0.18,
        x: mixNumber(circle.x, cluster.centerX, 0.42),
        y: mixNumber(circle.y, cluster.centerY, 0.42),
      });
    });

    lines.forEach((line, lineIndex) => {
      // Sample start, control, midpoint, end for cluster proximity
      const samples = [line.start, line.control, { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 }, line.end];
      for (const point of samples) {
        const distance = Math.hypot(point.x - cluster.centerX, point.y - cluster.centerY);
        if (distance > cluster.radius * 0.58) continue;

        pushIntersection(events, {
          clusterIndex,
          color: mixColors(line.color, cluster.dominantColor, 0.5),
          kind: 'memory-field-resonance',
          lineIndex,
          sourceRelationship: 'line through memory field',
          strength: 0.38 + cluster.density * 0.52 + line.opacity * 1.15,
          x: point.x,
          y: point.y,
        });
        break;
      }
    });
  });

  lines.forEach((line, lineIndex) => {
    // Sample 5 points along the quadratic arc for circle intersection detection
    const arcSamples = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const mt = 1 - t;
      return {
        x: mt * mt * line.start.x + 2 * mt * t * line.control.x + t * t * line.end.x,
        y: mt * mt * line.start.y + 2 * mt * t * line.control.y + t * t * line.end.y,
      };
    });

    arcSamples.forEach((point, sampleIndex) => {
      const previous = arcSamples[Math.max(0, sampleIndex - 1)];

      circles.forEach((circle, circleIndex) => {
        const distance = Math.hypot(point.x - circle.x, point.y - circle.y);
        const previousDistance = Math.hypot(previous.x - circle.x, previous.y - circle.y);
        const outerCrossing = (previousDistance - circle.radius) * (distance - circle.radius) <= 0;
        const innerCrossing =
          (previousDistance - circle.radius * 0.62) * (distance - circle.radius * 0.62) <= 0;
        const threshold = 5.5 + circle.radius * 0.024;
        if (outerCrossing || innerCrossing || Math.abs(distance - circle.radius * 0.72) < threshold) {
          pushIntersection(events, {
            circleIndex,
            color: mixColors(circle.color, line.color, 0.34),
            lineIndex,
            sourceRelationship: 'line through soft circle',
            strength: 0.58 + circle.opacity * 2 + line.opacity * 1.35 + (line.role === 'primary' ? 0.12 : 0),
            x: point.x,
            y: point.y,
          });
        }
      });
    });
  });

  lines.forEach((line, lineIndex) => {
    if (lineIndex >= lines.length - 1) return;

    for (let otherIndex = lineIndex + 1; otherIndex < lines.length; otherIndex += 1) {
      const other = lines[otherIndex];
      // Check crossing using the chord (start→end) of each arc
      const crossing = getSegmentIntersectionPoint(line.start, line.end, other.start, other.end);
      if (!crossing) continue;

      pushIntersection(events, {
        color: mixColors(line.color, other.color, 0.5),
        kind: 'line-line-crossing',
        lineIndex,
        otherIndex,
        sourceRelationship: 'line crossing',
        strength:
          0.88 +
          line.opacity * 1.25 +
          other.opacity * 1.25 +
          (line.role === 'primary' || other.role === 'primary' ? 0.2 : 0),
        x: crossing.x,
        y: crossing.y,
      });
    }
  });

  return events
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8);
}

function pushIntersection(events, event) {
  const existing = events.find(
    (candidate) => Math.hypot(candidate.x - event.x, candidate.y - event.y) < 54,
  );

  if (existing) {
    const totalStrength = existing.strength + event.strength;
    existing.x = (existing.x * existing.strength + event.x * event.strength) / totalStrength;
    existing.y = (existing.y * existing.strength + event.y * event.strength) / totalStrength;
    existing.color = mixColors(existing.color || event.color, event.color || existing.color, 0.42);
    existing.strength = clampToRange(totalStrength * 0.68, 0.16, 1.08);
    if (event.kind === 'line-line-crossing') existing.kind = event.kind;
    existing.relationshipCount = (existing.relationshipCount || 1) + 1;
    existing.sourceRelationship = `${existing.sourceRelationship}, ${event.sourceRelationship}`;
    return;
  }

  events.push({ relationshipCount: 1, ...event });
}

function paintIntersections(context, intersections, palette, rules) {
  context.save();
  context.globalCompositeOperation = 'source-over';

  intersections.forEach((event, index) => {
    const color = event.color || palette[index % palette.length];
    const isLineCrossing = event.kind === 'line-line-crossing';
    const relationshipBoost = clampToRange((event.relationshipCount || 1) * 0.06, 0.05, 0.2);
    const strength = clampToRange(event.strength + relationshipBoost, 0.18, isLineCrossing ? 0.92 : 0.76);
    const radius = isLineCrossing
      ? clampToRange(40 + strength * 42, 40, 80)
      : 26 + strength * 58 + rules.averageBrightness * 12;

    context.save();
    context.globalCompositeOperation = 'source-over';
    context.filter = `blur(${isLineCrossing ? 3.4 + rules.blurDensity * 3 : 3.2 + rules.blurDensity * 3.4}px)`;
    const glow = context.createRadialGradient(event.x, event.y, 0, event.x, event.y, radius);
    glow.addColorStop(0, `rgba(255,255,255,${(isLineCrossing ? 0.3 : 0.18) + strength * 0.16})`);
    glow.addColorStop(0.2, withAlpha(mixColors(color, '#ffffff', isLineCrossing ? 0.32 : 0.18), (isLineCrossing ? 0.28 : 0.2) * strength));
    glow.addColorStop(0.58, withAlpha(color, (isLineCrossing ? 0.088 : 0.062) * strength));
    glow.addColorStop(1, withAlpha(color, 0));
    context.fillStyle = glow;
    context.fillRect(event.x - radius, event.y - radius, radius * 2, radius * 2);
    context.restore();

    if (isLineCrossing || (strength > 0.64 && (event.relationshipCount || 1) > 1)) {
      context.save();
      context.globalCompositeOperation = 'source-over';
      context.filter = 'blur(0.5px)';
      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.beginPath();
      context.arc(event.x, event.y, isLineCrossing ? 4 + strength * 2 : 2 + strength * 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  });

  context.restore();
}

function paintTexture(context, palette, rules, memoryField, random) {
  const imageData = context.getImageData(0, 0, WIDTH, HEIGHT);
  const data = imageData.data;
  // Density 3–4× heavier than before for visible 35mm-style texture
  const density = 18 + rules.blurDensity * 18 + memoryField.density * 14;
  const contrast = 1.015 + rules.blurDensity * 0.018;
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  // Pre-extract palette RGB for colored grain tinting
  const paletteRgb = palette.map((c) => hexToRgb(c));

  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const luma = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722;
    const cloud =
      Math.sin(x * 0.012 + y * 0.008 + phaseA) * 1.8 +
      Math.sin(x * 0.027 - y * 0.014 + phaseB) * 1.1;
    const fieldInfluence = memoryFieldInfluence(memoryField, x, y);
    const brightGrainLift = luma > 160 ? 1.45 + fieldInfluence * 0.36 : 1 + fieldInfluence * 0.28;

    // Colored grain — two passes (light and dark), per-channel tinted by palette
    const palIdx = Math.floor(random() * paletteRgb.length);
    const pal = paletteRgb[palIdx] || paletteRgb[0];
    const grainMag = (random() - 0.5) * density * brightGrainLift;
    let grainR, grainG, grainB;

    if (grainMag >= 0) {
      // Pass 1: light grain — tinted toward white + palette color
      const lightTint = 0.3 + random() * 0.2;
      const lightR = 255 * (1 - lightTint) + pal[0] * lightTint;
      const lightG = 255 * (1 - lightTint) + pal[1] * lightTint;
      const lightB = 255 * (1 - lightTint) + pal[2] * lightTint;
      // Scale: opacity range 0.08–0.18 mapped to grain delta
      const lightScale = (0.08 + random() * 0.10) * brightGrainLift;
      grainR = (lightR - data[index]) * lightScale;
      grainG = (lightG - data[index + 1]) * lightScale;
      grainB = (lightB - data[index + 2]) * lightScale;
    } else {
      // Pass 2: dark grain — tinted toward black + palette color
      const darkTint = 0.2 + random() * 0.2;
      const darkR = pal[0] * darkTint;
      const darkG = pal[1] * darkTint;
      const darkB = pal[2] * darkTint;
      const darkScale = (0.06 + random() * 0.08) * brightGrainLift;
      grainR = (darkR - data[index]) * darkScale;
      grainG = (darkG - data[index + 1]) * darkScale;
      grainB = (darkB - data[index + 2]) * darkScale;
    }

    const particleThreshold = 0.986 - memoryField.density * 0.012 - fieldInfluence * 0.01;
    const particle = random() > particleThreshold ? (random() - 0.5) * (13 + rules.blurDensity * 10 + memoryField.density * 10) : 0;
    const fiber = random() > 0.995 - memoryField.density * 0.002 ? (random() - 0.5) * 18 : 0;

    data[index] = clamp(data[index] * contrast + grainR + cloud + particle + fiber);
    data[index + 1] = clamp(data[index + 1] * contrast + grainG + cloud + particle + fiber);
    data[index + 2] = clamp(data[index + 2] * contrast + grainB + cloud + particle + fiber);
  }

  context.putImageData(imageData, 0, 0);

  context.save();
  context.globalCompositeOperation = 'overlay';
  context.globalAlpha = 0.13 + rules.blurDensity * 0.045 + memoryField.density * 0.065;
  const textureDark = getAtmosphericDark(palette, rules);
  for (let line = 0; line < 92 + Math.round(memoryField.density * 60); line += 1) {
    const y = random() * HEIGHT;
    context.strokeStyle = random() > 0.5 ? 'rgba(255,255,255,0.12)' : withAlpha(textureDark, 0.14);
    context.lineWidth = 0.18 + random() * 0.5;
    context.beginPath();
    context.moveTo(random() * WIDTH - 80, y);
    context.quadraticCurveTo(WIDTH * 0.5, y + (random() - 0.5) * 34, WIDTH + 80, y + (random() - 0.5) * 28);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'soft-light';
  context.globalAlpha = 0.05 + rules.blurDensity * 0.024 + memoryField.density * 0.04;
  for (let cloud = 0; cloud < 18 + Math.round(memoryField.density * 16); cloud += 1) {
    const cluster = memoryField.clusters[cloud % Math.max(1, memoryField.clusters.length)];
    const x = cluster ? mixNumber(random() * WIDTH, cluster.centerX, cluster.density * 0.66) : random() * WIDTH;
    const y = cluster ? mixNumber(random() * HEIGHT, cluster.centerY, cluster.density * 0.66) : random() * HEIGHT;
    const radius = 100 + random() * 220 + (cluster?.density || 0) * 120;
    const cloudGradient = context.createRadialGradient(x, y, 0, x, y, radius);
    cloudGradient.addColorStop(0, withAlpha(textureDark, 0.16));
    cloudGradient.addColorStop(1, withAlpha(textureDark, 0));
    context.fillStyle = cloudGradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.restore();
}

function applyContrastPass(context, palette, rules) {
  const imageData = context.getImageData(0, 0, WIDTH, HEIGHT);
  const data = imageData.data;
  const contrast = 1.40 + rules.averageBrightness * 0.08;
  const pivot = 100 - rules.averageBrightness * 10;
  const saturation = 1.24;

  for (let index = 0; index < data.length; index += 4) {
    let r = pivot + (data[index] - pivot) * contrast;
    let g = pivot + (data[index + 1] - pivot) * contrast;
    let b = pivot + (data[index + 2] - pivot) * contrast;
    const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;

    r = luma + (r - luma) * saturation;
    g = luma + (g - luma) * saturation;
    b = luma + (b - luma) * saturation;

    data[index] = clamp(r);
    data[index + 1] = clamp(g);
    data[index + 2] = clamp(b);
  }

  context.putImageData(imageData, 0, 0);

  context.save();
  context.globalCompositeOperation = 'multiply';
  const atmosphericDark = getAtmosphericDark(palette, rules);
  const shadowGradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  shadowGradient.addColorStop(0, withAlpha(atmosphericDark, rules.averageBrightness < 0.35 ? 0.2 : 0.12));
  shadowGradient.addColorStop(0.42, withAlpha(atmosphericDark, 0));
  shadowGradient.addColorStop(1, withAlpha(atmosphericDark, rules.averageBrightness < 0.35 ? 0.24 : 0.14));
  context.fillStyle = shadowGradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();
}

function sampleQuadratic(start, control, end, steps) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const inv = 1 - t;
    points.push({
      x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
      y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
    });
  }
  return points;
}

function sampleCubic(start, controlA, controlB, end, steps) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const inv = 1 - t;
    points.push({
      x:
        inv * inv * inv * start.x +
        3 * inv * inv * t * controlA.x +
        3 * inv * t * t * controlB.x +
        t * t * t * end.x,
      y:
        inv * inv * inv * start.y +
        3 * inv * inv * t * controlA.y +
        3 * inv * t * t * controlB.y +
        t * t * t * end.y,
    });
  }
  return points;
}

function softenPath(points, random, drift) {
  if (points.length < 4) return points;

  const phase = random() * Math.PI * 2;
  const secondaryPhase = random() * Math.PI * 2;
  const amplitude = drift * (0.72 + random() * 0.28);
  const softlyDrifted = points.map((point, index) => {
    const t = index / (points.length - 1);
    const fade = Math.sin(Math.PI * t);
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x) + Math.PI / 2;
    const longWave = Math.sin(t * Math.PI * 1.35 + phase) * amplitude * 0.46;
    const slowBreath = Math.sin(t * Math.PI * 2.1 + secondaryPhase) * amplitude * 0.18;
    const offset = (longWave + slowBreath) * fade;

    return {
      x: point.x + Math.cos(angle) * offset,
      y: point.y + Math.sin(angle) * offset,
    };
  });

  return smoothPoints(smoothPoints(softlyDrifted));
}

function smoothPoints(points) {
  if (points.length < 5) return points;

  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;

    const previous = points[index - 1];
    const next = points[index + 1];
    return {
      x: point.x * 0.5 + previous.x * 0.25 + next.x * 0.25,
      y: point.y * 0.5 + previous.y * 0.25 + next.y * 0.25,
    };
  });
}

function strokeFadedLine(context, points, color, opacity) {
  if (points.length < 3) return;

  for (let index = 2; index < points.length; index += 2) {
    const t = index / (points.length - 1);
    const fade = Math.sin(Math.PI * t);
    const previous = points[index - 2];
    const control = points[index - 1];
    const current = points[index];

    if (fade < 0.02) continue;

    const residue = 0.94 + Math.sin(t * Math.PI * 1.6) * 0.035;
    context.strokeStyle = withAlpha(color, opacity * Math.pow(fade, 1.82) * residue);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.quadraticCurveTo(control.x, control.y, current.x, current.y);
    context.stroke();
  }
}

function selectLineAnchors(circles, secondaryLights, structureAnchors, memoryField, origin, structureCenter, count) {
  const scored = circles
    .map((circle) => ({
      ...circle,
      score:
        circle.radius * 0.5 +
        Math.hypot(circle.x - origin.x, circle.y - origin.y) * 0.28 +
        circle.opacity * 220,
    }))
    .sort((a, b) => b.score - a.score);
  const anchors = [
    { ...origin, color: circles[0]?.color, kind: 'origin', strength: 1 },
    { ...structureCenter, color: circles[0]?.color, kind: 'balance', strength: 0.45 },
  ];

  secondaryLights.forEach((light) => {
    if (anchors.length < count) anchors.push({ ...light, kind: 'secondary' });
  });

  memoryField.clusters.forEach((cluster) => {
    const tooClose = anchors.some((existing) => Math.hypot(existing.x - cluster.centerX, existing.y - cluster.centerY) < 82);
    if (!tooClose && anchors.length < count) {
      anchors.push({
        color: cluster.dominantColor,
        density: cluster.density,
        kind: 'cluster',
        radius: cluster.radius,
        strength: cluster.strength,
        x: cluster.centerX,
        y: cluster.centerY,
      });
    }
  });

  structureAnchors.forEach((anchor) => {
    const tooClose = anchors.some((existing) => Math.hypot(existing.x - anchor.x, existing.y - anchor.y) < 96);
    if (!tooClose && anchors.length < count) anchors.push({ ...anchor, kind: 'structure' });
  });

  scored.forEach((circle) => {
    const tooClose = anchors.some((anchor) => Math.hypot(anchor.x - circle.x, anchor.y - circle.y) < 120);
    if (!tooClose && anchors.length < count) {
      anchors.push({ x: circle.x, y: circle.y, color: circle.color, kind: 'circle', radius: circle.radius });
    }
  });

  return anchors;
}

function pickRelationshipStart(anchors, index) {
  if (index === 0) return anchors[0];
  const nonOrigin = anchors.filter((anchor) => anchor.kind !== 'origin');
  const fallback = nonOrigin[0] || anchors[0];
  if (index % 3 === 0) return nonOrigin.find((anchor) => anchor.kind === 'secondary') || fallback;
  if (index % 3 === 1) return nonOrigin.find((anchor) => anchor.kind === 'structure') || nonOrigin[(index % Math.max(1, nonOrigin.length - 1)) + 1] || fallback;
  return nonOrigin[(index % Math.max(1, nonOrigin.length - 1)) + 1] || fallback;
}

function pickRelationshipEnd(anchors, start, index) {
  const pool = start.kind !== 'origin'
    ? anchors.filter((anchor) => anchor !== start && anchor.kind !== 'origin')
    : anchors.filter((anchor) => anchor !== start);
  const candidates = pool.length ? pool : anchors.filter((anchor) => anchor !== start);
  const distant = candidates.filter((a) => Math.hypot(a.x - start.x, a.y - start.y) >= 300);
  const distantPool = distant.length >= 2 ? distant : candidates;
  const ranked = distantPool
    .map((anchor) => {
      const distance = Math.hypot(anchor.x - start.x, anchor.y - start.y);
      const kindScore =
        start.kind === 'origin' && anchor.kind === 'secondary'
          ? 420
          : start.kind === 'cluster' && (anchor.kind === 'circle' || anchor.kind === 'secondary')
            ? 410
          : anchor.kind === 'cluster'
            ? 390
          : start.kind === 'structure' && anchor.kind === 'secondary'
            ? 360
          : start.kind === 'secondary' && anchor.kind === 'circle'
            ? 360
          : start.kind === 'circle' && (anchor.kind === 'secondary' || anchor.kind === 'structure')
            ? 340
            : anchor.kind === 'circle' || anchor.kind === 'structure'
              ? 280
              : 120;
      const targetDistance = start.kind === 'cluster' || anchor.kind === 'cluster' ? 210 : 360;
      return { anchor, score: kindScore + distance * 0.24 - Math.abs(distance - targetDistance) * 0.2 };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[index % Math.max(1, Math.min(3, ranked.length))]?.anchor || distantPool[0] || candidates[0] || anchors[0];
}

function extendPoint(from, toward, amount) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + (dx / length) * amount,
    y: from.y + (dy / length) * amount,
  };
}

function projectToCanvasEdge(from, toward) {
  const dx = from.x - toward.x;
  const dy = from.y - toward.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const pad = -30;
  const tx = ux > 0 ? (WIDTH - pad - from.x) / ux : ux < 0 ? (pad - from.x) / ux : Infinity;
  const ty = uy > 0 ? (HEIGHT - pad - from.y) / uy : uy < 0 ? (pad - from.y) / uy : Infinity;
  const t = Math.min(tx > 0 ? tx : Infinity, ty > 0 ? ty : Infinity);
  if (!Number.isFinite(t)) return from;
  return { x: from.x + ux * t, y: from.y + uy * t };
}

function hasSimilarAngle(angle, usedAngles, threshold) {
  return usedAngles.some((used) => {
    const diff = Math.abs(Math.atan2(Math.sin(angle - used), Math.cos(angle - used)));
    return diff < threshold || Math.abs(Math.PI - diff) < threshold;
  });
}

function getBrightRegionAnchors(rules, palette) {
  return (rules.brightRegions || [])
    .map((region) => ({
      brightness: region.brightness || 0.6,
      color: refineFeatureColor(region.color || palette[0], palette, rules),
      kind: 'bright',
      size: region.size || 0.04,
      strength: clampToRange(region.strength || region.brightness || 0.5, 0.12, 1),
      x: clampToRange((region.x || 0.5) * WIDTH, 52, WIDTH - 52),
      y: clampToRange((region.y || 0.5) * HEIGHT, 52, HEIGHT - 52),
    }))
    .sort((a, b) => b.strength - a.strength);
}

function getStructureAnchors(rules, palette) {
  return (rules.structureAnchors || [])
    .map((anchor) => ({
      color: refineFeatureColor(anchor.color || palette[2], palette, rules),
      kind: 'structure',
      strength: clampToRange(anchor.strength || 0.4, 0.1, 1),
      type: anchor.type || 'dense',
      x: clampToRange((anchor.x || 0.5) * WIDTH, 52, WIDTH - 52),
      y: clampToRange((anchor.y || 0.5) * HEIGHT, 52, HEIGHT - 52),
    }))
    .sort((a, b) => b.strength - a.strength);
}

function refineFeatureColor(color, palette, rules) {
  const hsl = rgbToHsl(hexToRgb(color));
  const isDarkFeature = hsl.l < 0.24;
  const closest = palette
    .map((paletteColor) => ({ color: paletteColor, distance: colorDistance(hexToRgb(color), hexToRgb(paletteColor)) }))
    .sort((a, b) => a.distance - b.distance)[0]?.color || palette[0];

  if (isDarkFeature && rules.averageBrightness >= 0.28) {
    return mixColors(
      tuneColor(color, {
        l: 0.34,
        s: clampToRange(hsl.s * 0.72, 0.1, 0.28),
      }),
      closest,
      0.22,
    );
  }

  return mixColors(
    tuneColor(color, {
      l: clampToRange(hsl.l, rules.averageBrightness < 0.28 ? 0.24 : 0.36, 0.78),
      s: clampToRange(hsl.s * 0.88, 0.14, 0.54),
    }),
    closest,
    0.28,
  );
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = clampToRange(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function clusterDirection(members, centerX, centerY) {
  let xx = 0;
  let yy = 0;
  let xy = 0;

  members.forEach((member) => {
    const dx = member.x - centerX;
    const dy = member.y - centerY;
    const weight = member.strength || 0.4;
    xx += dx * dx * weight;
    yy += dy * dy * weight;
    xy += dx * dy * weight;
  });

  return 0.5 * Math.atan2(2 * xy, xx - yy);
}

function memoryFieldInfluence(memoryField, x, y) {
  if (!memoryField?.clusters?.length) return 0;

  return clampToRange(
    memoryField.clusters.reduce((strongest, cluster) => {
      const distance = Math.hypot(x - cluster.centerX, y - cluster.centerY);
      const falloff = Math.max(0, 1 - distance / Math.max(1, cluster.radius * 1.16));
      return Math.max(strongest, falloff * cluster.density * cluster.strength);
    }, 0),
    0,
    1,
  );
}

function getCircleIntersectionPoints(circleA, circleB) {
  const dx = circleB.x - circleA.x;
  const dy = circleB.y - circleA.y;
  const distance = Math.hypot(dx, dy);

  if (!distance || distance > circleA.radius + circleB.radius || distance < Math.abs(circleA.radius - circleB.radius)) {
    return [];
  }

  const a = (circleA.radius * circleA.radius - circleB.radius * circleB.radius + distance * distance) / (2 * distance);
  const heightSquared = circleA.radius * circleA.radius - a * a;
  if (heightSquared < 0) return [];

  const h = Math.sqrt(heightSquared);
  const xm = circleA.x + (a * dx) / distance;
  const ym = circleA.y + (a * dy) / distance;
  const rx = (-dy * h) / distance;
  const ry = (dx * h) / distance;

  return [
    { x: xm + rx, y: ym + ry },
    { x: xm - rx, y: ym - ry },
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function segmentsIntersect(p1, p2, p3, p4) {
  const point = getSegmentIntersectionPoint(p1, p2, p3, p4);
  return Boolean(point);
}

function getSegmentIntersectionPoint(p1, p2, p3, p4) {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < 0.0001) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;

  if (t <= 0.04 || t >= 0.96 || u <= 0.04 || u >= 0.96) return null;

  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

function getOrbitBias(start, end, origin) {
  const startDistance = Math.hypot(start.x - origin.x, start.y - origin.y);
  const endDistance = Math.hypot(end.x - origin.x, end.y - origin.y);
  return clampToRange((startDistance + endDistance) * 0.08, 20, 90);
}

function getCircleHierarchy(index, count) {
  if (index < Math.max(1, Math.round(count * 0.24))) return 'large';
  if (index < Math.max(2, Math.round(count * 0.66))) return 'medium';
  return 'small';
}

function getCircleDepth(index, count, memoryField) {
  const position = index / Math.max(1, count - 1);
  const densityLift = memoryField.density * 0.08;

  if (position < 0.28) {
    return {
      blurScale: 0.86,
      name: 'front',
      opacityScale: 1.18 + densityLift,
      radiusScale: 0.92,
    };
  }

  if (position > 0.68) {
    return {
      blurScale: 1.28,
      name: 'background',
      opacityScale: 0.92 + densityLift * 0.5,
      radiusScale: 1.08,
    };
  }

  return {
    blurScale: 1,
    name: 'middle',
    opacityScale: 1.04 + densityLift,
    radiusScale: 1,
  };
}

function normalizePaletteWeights(sourceWeights, count) {
  const fallback = Array.from({ length: count }, (_, index) => Math.max(0.08, 1 - index * 0.16));
  const weights = Array.from({ length: count }, (_, index) => {
    const value = Number(sourceWeights?.[index]);
    return Number.isFinite(value) && value > 0 ? value : fallback[index] || 0.12;
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  return weights.map((value) => value / total);
}

function weightedPaletteIndex(weights, position, salt = 0) {
  const shifted = (position + salt * 0.173) % 1;
  let cursor = 0;

  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index];
    if (shifted <= cursor) return index;
  }

  return weights.length - 1;
}

function getWeightedPaletteOrder(palette, weights) {
  const ordered = palette
    .map((color, index) => ({ color, weight: weights[index] || 0 }))
    .sort((a, b) => b.weight - a.weight)
    .map((item) => item.color);

  while (ordered.length < 5) ordered.push(palette[ordered.length % palette.length]);

  return ordered;
}

function getProportionalColorStops(palette, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;
  const stops = palette.map((color, index) => {
    const weight = Math.max(0.025, (weights[index] || 0) / total);
    const position = clampToRange(cursor + weight * 0.5, 0.04, 0.96);
    cursor += weight;
    return { color, position, weight };
  });

  return stops
    .sort((a, b) => a.position - b.position)
    .reduce((result, stop) => {
      const previous = result[result.length - 1];
      const position = previous ? Math.max(stop.position, previous.position + 0.035) : stop.position;
      return [...result, { ...stop, position: clampToRange(position, 0.04, 0.96) }];
    }, []);
}

function refinePalette(sourcePalette, rules) {
  const raw = normalizePalette(sourcePalette);
  const sourceWeights = normalizePaletteWeights(rules.paletteWeights, raw.length);
  const isDarkImage = rules.averageBrightness < 0.28;
  const chromaticDominant = getDominantChromaColor(raw, sourceWeights);

  return raw.map((color, index) => refineSourceColor(color, {
    chromaticDominant,
    isDarkImage,
    rules,
    weight: sourceWeights[index] || 0.12,
  }));
}

function normalizePalette(sourcePalette) {
  const fallback = ['#f5c1d7', '#c8d8e3', '#857f94', '#f1e6d3', '#25252b'];
  const palette = sourcePalette?.length ? sourcePalette : fallback;
  const expanded = [...palette];

  while (expanded.length < 5) {
    const base = expanded[expanded.length % palette.length];
    expanded.push(mixColors(base, expanded[0], 0.42));
  }

  return expanded.slice(0, 5);
}

function refineSourceColor(color, { chromaticDominant, isDarkImage, rules, weight }) {
  const hsl = rgbToHsl(hexToRgb(color));
  const neutral = isNeutralColor(color);
  const isDominantNeutral = neutral && weight >= 0.34;
  const isVeryLight = hsl.l > 0.78;
  const isVeryDark = hsl.l < 0.2;

  if (isVeryLight) {
    const warmLight = hsl.h < 80 || hsl.h > 310 ? color : mixColors(color, '#fff2d7', 0.22);
    return tuneColor(warmLight, {
      l: isDarkImage ? 0.72 : 0.82,
      s: clampToRange(hsl.s * 0.72 + 0.08, 0.1, 0.3),
    });
  }

  if (neutral && !isDominantNeutral && chromaticDominant) {
    const dominantHsl = rgbToHsl(hexToRgb(chromaticDominant));
    return hslToHex({
      h: dominantHsl.h,
      l: clampToRange(hsl.l, isDarkImage ? 0.22 : 0.38, isDarkImage ? 0.58 : 0.68),
      s: clampToRange(dominantHsl.s * 0.34 + hsl.s * 0.5, 0.1, 0.24),
    });
  }

  if (isVeryDark && !isDarkImage) {
    return hslToHex({
      h: hsl.h,
      l: 0.3 + rules.averageBrightness * 0.08,
      s: clampToRange(hsl.s * 0.68, 0.1, 0.28),
    });
  }

  return hslToHex({
    h: hsl.h,
    l: clampToRange(hsl.l, isDarkImage ? 0.2 : 0.36, isDarkImage ? 0.7 : 0.76),
    s: clampToRange(hsl.s * 0.86 + (neutral ? 0.04 : 0.02), neutral ? 0.08 : 0.18, isDarkImage ? 0.48 : 0.58),
  });
}

function getDominantChromaColor(palette, weights) {
  return palette
    .map((color, index) => {
      const hsl = rgbToHsl(hexToRgb(color));
      return {
        color,
        score: (weights[index] || 0) * (0.28 + hsl.s) * (1 - Math.abs(hsl.l - 0.52) * 0.42),
      };
    })
    .filter((item) => !isNeutralColor(item.color))
    .sort((a, b) => b.score - a.score)[0]?.color;
}

function isNeutralColor(color) {
  const hsl = rgbToHsl(hexToRgb(color));
  return hsl.s < 0.13;
}

function chooseSoftDark(darkColor, coolColor, warmColor) {
  const coolHue = rgbToHsl(hexToRgb(coolColor)).h;
  const warmHue = rgbToHsl(hexToRgb(warmColor)).h;
  const baseHue = Number.isFinite(coolHue) ? coolHue : warmHue;
  const hue = Number.isFinite(baseHue) ? baseHue : 220;
  const softHue = hue < 80 || hue > 320 ? 28 : hue;
  return hslToHex({ h: softHue, s: 0.16, l: 0.24 + rgbToHsl(hexToRgb(darkColor)).l * 0.08 });
}

function getAtmosphericDark(palette, rules) {
  const isDarkImage = rules.averageBrightness < 0.28;
  const hueSamples = palette.map((color) => rgbToHsl(hexToRgb(color)));
  const coolSample = hueSamples.find((hsl) => hsl.h >= 175 && hsl.h <= 260);
  const warmSample = hueSamples.find((hsl) => hsl.h < 70 || hsl.h > 320);
  const violetSample = hueSamples.find((hsl) => hsl.h >= 260 && hsl.h <= 325);
  const averageSaturation = hueSamples.reduce((sum, hsl) => sum + hsl.s, 0) / hueSamples.length;

  if (isDarkImage) {
    const source = coolSample || violetSample || hueSamples[0];
    return hslToHex({ h: source.h, s: 0.2 + averageSaturation * 0.08, l: 0.13 });
  }

  if (violetSample && averageSaturation > 0.16) {
    return hslToHex({ h: violetSample.h, s: 0.14, l: 0.31 });
  }

  if (coolSample) {
    return hslToHex({ h: coolSample.h, s: 0.16, l: 0.32 });
  }

  if (warmSample) {
    return hslToHex({ h: 28, s: 0.13, l: 0.33 });
  }

  return hslToHex({ h: 215, s: 0.12, l: 0.32 });
}

function getCircleShadowColor(color, rules) {
  const hsl = rgbToHsl(hexToRgb(color));
  return hslToHex({
    h: hsl.h,
    s: clampToRange(hsl.s * 0.48, 0.08, 0.22),
    l: rules.averageBrightness < 0.28 ? 0.16 : 0.28,
  });
}

function getCirclePaletteColor(color, rules, salt = 0) {
  const hsl = rgbToHsl(hexToRgb(color));
  const isLightNeutral = hsl.l > 0.76 && hsl.s < 0.16;
  const saturationBoost = rules.averageBrightness > 0.72 ? 1.18 : 1.34;
  const hueShift = salt % 3 === 0 ? 0 : salt % 3 === 1 ? 5 : -6;

  return hslToHex({
    h: (hsl.h + hueShift + 360) % 360,
    s: isLightNeutral
      ? clampToRange(hsl.s + 0.055, 0.08, 0.24)
      : clampToRange(hsl.s * saturationBoost + 0.035, 0.18, 0.68),
    l: isLightNeutral
      ? clampToRange(hsl.l - 0.08, 0.62, 0.78)
      : clampToRange(hsl.l - 0.035, rules.averageBrightness < 0.3 ? 0.32 : 0.38, 0.68),
  });
}

function getCircleShiftColor(color, salt) {
  const hsl = rgbToHsl(hexToRgb(color));
  return hslToHex({
    h: (hsl.h + (salt % 2 === 0 ? 18 : -22) + 360) % 360,
    l: clampToRange(hsl.l + (salt % 3 === 0 ? 0.06 : -0.035), 0.24, 0.82),
    s: clampToRange(hsl.s * 0.92 + 0.045, 0.08, 0.62),
  });
}

function getPaletteHighlightColor(mainColor, secondaryColor, accentColor, rules) {
  const candidates = [mainColor, secondaryColor, accentColor]
    .map((color) => rgbToHsl(hexToRgb(color)))
    .sort((a, b) => b.l - a.l);
  const lightest = candidates[0];
  const isLightDominant = rules.averageBrightness > 0.68 && lightest.l > 0.72 && lightest.s < 0.22;

  return hslToHex({
    h: lightest.h,
    s: isLightDominant
      ? clampToRange(lightest.s * 0.72, 0.04, 0.18)
      : clampToRange(lightest.s * 0.92 + 0.04, 0.1, 0.46),
    l: isLightDominant ? clampToRange(lightest.l, 0.74, 0.88) : clampToRange(lightest.l + 0.08, 0.54, 0.76),
  });
}

function tuneColor(color, overrides) {
  const hsl = rgbToHsl(hexToRgb(color));
  return hslToHex({
    h: overrides.h ?? hsl.h,
    s: clampToRange(overrides.s ?? hsl.s, 0, 1),
    l: clampToRange(overrides.l ?? hsl.l, 0, 1),
  });
}

function rgbToHsl([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }

  return { h: (h + 360) % 360, l, s };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb = [0, 0, 0];

  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgbToHex(rgb.map((channel) => Math.round((channel + m) * 255)));
}

function hashRules(rules, variation) {
  const source = [
    rules.palette.join(''),
    (rules.paletteWeights || []).map((weight) => Number(weight).toFixed(3)).join(','),
    rules.lightOrigin.x.toFixed(3),
    rules.lightOrigin.y.toFixed(3),
    rules.averageBrightness.toFixed(3),
    rules.blurDensity.toFixed(3),
    rules.motionDirection.angle.toFixed(1),
    (rules.brightRegions || [])
      .map((region) => `${Number(region.x).toFixed(2)},${Number(region.y).toFixed(2)},${Number(region.strength).toFixed(2)}`)
      .join(';'),
    (rules.structureAnchors || [])
      .map((anchor) => `${Number(anchor.x).toFixed(2)},${Number(anchor.y).toFixed(2)},${anchor.type || 'dense'}`)
      .join(';'),
    variation,
  ].join('|');

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function clampToRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getStructure(rules) {
  return (
    rules.structure || {
      balance: { x: 0.5, y: 0.5 },
      compositionType: 'abstract / unclear',
      concentration: 0.4,
      diagonalDominance: 0.3,
      dominantAxis: 'balanced / scattered',
      distribution: 0.7,
      geometricRhythm: 0.35,
      horizontalDominance: 0.5,
      radialDominance: 0.45,
      repetition: 0,
      shapeEnergy: 'wave-like',
      spatialWeight: 'centered',
      type: 'balanced field',
      verticalDominance: 0.5,
    }
  );
}

function getStructuralAngle(rules) {
  const structure = getStructure(rules);
  if (structure.dominantAxis === 'vertical') return Math.PI / 2;
  if (structure.dominantAxis === 'horizontal') return 0;
  if (structure.dominantAxis === 'diagonal') {
    return structure.diagonalDominance > 0.5 ? Math.PI / 4 : -Math.PI / 4;
  }
  if (structure.dominantAxis === 'radial') {
    return ((rules.motionDirection.angle || 0) * Math.PI) / 180 + Math.PI / 5;
  }

  const difference = structure.verticalDominance - structure.horizontalDominance;

  if (Math.abs(difference) < 0.08) {
    return ((rules.motionDirection.angle || 0) * Math.PI) / 180;
  }

  return difference > 0 ? Math.PI / 2 : 0;
}

function getStructureProfile(structure) {
  const profile = {
    angleNoise: 1,
    axisScaleX: 1,
    axisScaleY: 1,
    circleAngle: 0,
    circleMultiplier: 1,
    crossSpread: 1,
    curvatureMultiplier: 1,
    forwardDrift: 1,
    irregularity: 1,
    lineLengthMultiplier: 1,
    lineMultiplier: 1,
    orbitTurn: 1,
    radiusMultiplier: 1,
    spreadMultiplier: 1,
    structureInfluence: 0.62,
  };

  if (structure.dominantAxis === 'vertical') {
    Object.assign(profile, {
      angleNoise: 0.55,
      axisScaleX: 0.55,
      axisScaleY: 1.55,
      circleAngle: Math.PI / 2,
      crossSpread: 0.55,
      lineLengthMultiplier: 1.18,
      orbitTurn: 0.72,
      structureInfluence: 0.86,
    });
  } else if (structure.dominantAxis === 'horizontal') {
    Object.assign(profile, {
      angleNoise: 0.5,
      axisScaleX: 1.65,
      axisScaleY: 0.55,
      circleAngle: 0,
      crossSpread: 0.72,
      curvatureMultiplier: 0.72,
      lineLengthMultiplier: 1.32,
      radiusMultiplier: 1.08,
      spreadMultiplier: 1.12,
      structureInfluence: 0.88,
    });
  } else if (structure.dominantAxis === 'diagonal') {
    Object.assign(profile, {
      angleNoise: 0.78,
      circleAngle: Math.PI / 4,
      crossSpread: 0.86,
      curvatureMultiplier: 1.1,
      lineLengthMultiplier: 1.22,
      lineMultiplier: 1.12,
      structureInfluence: 0.84,
    });
  } else if (structure.dominantAxis === 'radial') {
    Object.assign(profile, {
      axisScaleX: 1.08,
      axisScaleY: 1.08,
      circleMultiplier: 1.28,
      curvatureMultiplier: 1.28,
      lineMultiplier: 0.86,
      orbitTurn: 1.24,
      radiusMultiplier: 1.18,
      structureInfluence: 0.5,
    });
  }

  if (structure.shapeEnergy === 'circular') {
    Object.assign(profile, {
      circleMultiplier: profile.circleMultiplier * 1.35,
      curvatureMultiplier: profile.curvatureMultiplier * 1.22,
      orbitTurn: profile.orbitTurn * 1.18,
      radiusMultiplier: profile.radiusMultiplier * 1.12,
    });
  } else if (structure.shapeEnergy === 'linear') {
    Object.assign(profile, {
      circleMultiplier: profile.circleMultiplier * 0.82,
      lineLengthMultiplier: profile.lineLengthMultiplier * 1.2,
      lineMultiplier: profile.lineMultiplier * 1.24,
      radiusMultiplier: profile.radiusMultiplier * 0.9,
    });
  } else if (structure.shapeEnergy === 'clustered') {
    Object.assign(profile, {
      circleMultiplier: profile.circleMultiplier * 0.9,
      crossSpread: profile.crossSpread * 0.58,
      forwardDrift: profile.forwardDrift * 0.72,
      lineMultiplier: profile.lineMultiplier * 1.16,
      radiusMultiplier: profile.radiusMultiplier * 0.74,
      spreadMultiplier: profile.spreadMultiplier * 0.62,
    });
  } else if (structure.shapeEnergy === 'wave-like') {
    Object.assign(profile, {
      curvatureMultiplier: profile.curvatureMultiplier * 1.45,
      lineLengthMultiplier: profile.lineLengthMultiplier * 1.1,
      orbitTurn: profile.orbitTurn * 0.9,
    });
  } else if (structure.shapeEnergy === 'grid-like') {
    Object.assign(profile, {
      angleNoise: profile.angleNoise * 0.42,
      curvatureMultiplier: profile.curvatureMultiplier * 0.38,
      lineMultiplier: profile.lineMultiplier * 1.2,
      orbitTurn: profile.orbitTurn * 0.58,
      structureInfluence: Math.max(profile.structureInfluence, 0.9),
    });
  } else if (structure.shapeEnergy === 'layered') {
    Object.assign(profile, {
      axisScaleX: profile.axisScaleX * 1.28,
      axisScaleY: profile.axisScaleY * 0.82,
      curvatureMultiplier: profile.curvatureMultiplier * 0.78,
      spreadMultiplier: profile.spreadMultiplier * 1.18,
    });
  }

  if (structure.compositionType === 'architecture / geometric') {
    Object.assign(profile, {
      angleNoise: profile.angleNoise * 0.55,
      curvatureMultiplier: profile.curvatureMultiplier * 0.62,
      lineMultiplier: profile.lineMultiplier * 1.14,
      structureInfluence: Math.max(profile.structureInfluence, 0.88),
    });
  } else if (structure.compositionType === 'landscape / atmospheric') {
    Object.assign(profile, {
      axisScaleX: profile.axisScaleX * 1.24,
      circleMultiplier: profile.circleMultiplier * 0.9,
      curvatureMultiplier: profile.curvatureMultiplier * 1.24,
      lineLengthMultiplier: profile.lineLengthMultiplier * 1.18,
      radiusMultiplier: profile.radiusMultiplier * 1.16,
    });
  } else if (structure.compositionType === 'portrait / emotional center') {
    Object.assign(profile, {
      circleMultiplier: profile.circleMultiplier * 1.1,
      crossSpread: profile.crossSpread * 0.72,
      forwardDrift: profile.forwardDrift * 0.66,
      radiusMultiplier: profile.radiusMultiplier * 1.04,
      spreadMultiplier: profile.spreadMultiplier * 0.68,
    });
  } else if (structure.compositionType === 'pattern / repetition') {
    Object.assign(profile, {
      angleNoise: profile.angleNoise * 0.52,
      circleMultiplier: profile.circleMultiplier * 1.08,
      lineMultiplier: profile.lineMultiplier * 1.22,
      orbitTurn: profile.orbitTurn * 0.62,
    });
  }

  return profile;
}

function mixAngle(a, b, amount) {
  const x = Math.cos(a) * (1 - amount) + Math.cos(b) * amount;
  const y = Math.sin(a) * (1 - amount) + Math.sin(b) * amount;
  return Math.atan2(y, x);
}

function mixNumber(a, b, amount) {
  return a + (b - a) * amount;
}

function normalizeColorToRgb(color) {
  if (!color) return null;

  if (typeof color === 'string') {
    return hexToRgb(color);
  }

  if (
    typeof color === 'object' &&
    Number.isFinite(color.r) &&
    Number.isFinite(color.g) &&
    Number.isFinite(color.b)
  ) {
    return {
      r: color.r,
      g: color.g,
      b: color.b,
    };
  }

  return null;
}

function colorDistance(colorA, colorB) {
  const a = normalizeColorToRgb(colorA);
  const b = normalizeColorToRgb(colorB);

  if (!a || !b) return 999;

  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// ─── Emotion modifier ──────────────────────────────────────────────────────────

const EMOTION_TINTS = {
  '그리움':  { rgb: [190, 145, 95],  brightness: 0.88, blur: 1.12 },   // warm amber
  '설렘':    { rgb: [220, 130, 190], brightness: 1.14, blur: 0.88 },   // rose/pink
  '고요함':  { rgb: [120, 155, 210], brightness: 0.94, blur: 1.22 },   // cool blue
  '슬픔':    { rgb: [90,  105, 185], brightness: 0.78, blur: 1.18 },   // indigo
  '따뜻함':  { rgb: [225, 170, 95],  brightness: 1.12, blur: 0.86 },   // orange
  '공허함':  { rgb: [75,  80,  105], brightness: 0.68, blur: 1.28 },   // dark muted
  '낯섦':    { rgb: [90,  195, 185], brightness: 1.02, blur: 0.84 },   // teal/cyan
  '불안':    { rgb: [165, 95,  210], brightness: 0.84, blur: 0.82 },   // purple
  '평온':    { rgb: [165, 182, 190], brightness: 1.0,  blur: 1.10 },   // soft grey-blue
  '아련함':  { rgb: [185, 155, 205], brightness: 0.90, blur: 1.15 },   // lavender
};

function applyEmotionModifiers(rules) {
  const keywords = rules.emotionKeywords;
  if (!keywords?.length) return rules;

  const active = keywords.map(k => EMOTION_TINTS[k]).filter(Boolean);
  if (!active.length) return rules;

  // Average the tint colors and multipliers across selected keywords
  const avgRgb = active.reduce(
    (acc, e) => [acc[0] + e.rgb[0], acc[1] + e.rgb[1], acc[2] + e.rgb[2]],
    [0, 0, 0],
  ).map(v => Math.round(v / active.length));

  const brightnessScale = active.reduce((acc, e) => acc * e.brightness, 1) ** (1 / active.length);
  const blurScale       = active.reduce((acc, e) => acc * e.blur,       1) ** (1 / active.length);

  // Tint each palette color 35% toward the emotion color
  const tintedPalette = (rules.palette || []).map(hex => {
    const rgb = hexToRgb(hex);
    return rgbToHex([
      Math.round(rgb[0] * 0.65 + avgRgb[0] * 0.35),
      Math.round(rgb[1] * 0.65 + avgRgb[1] * 0.35),
      Math.round(rgb[2] * 0.65 + avgRgb[2] * 0.35),
    ]);
  });

  return {
    ...rules,
    palette: tintedPalette,
    averageBrightness: Math.min(1, Math.max(0, rules.averageBrightness * brightnessScale)),
    blurDensity: Math.min(0.98, Math.max(0.08, rules.blurDensity * blurScale)),
  };
}
