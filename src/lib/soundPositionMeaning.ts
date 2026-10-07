import type { MemoryPosition } from '../types';
/** Visitor-authored imagined distance and clarity, not a psychological measurement. */
export function soundPositionMeaning(position: MemoryPosition | null): string | null {
  if (!position) return null;
  const clarity = position.x < .4 ? '흐릿한' : position.x > .6 ? '선명한' : '흐릿함과 선명함 사이의';
  const distance = position.y < .4 ? '가까운' : position.y > .6 ? '먼' : '중간';
  return `당신은 이 소리를 ${distance} 거리의 ${clarity} 기억으로 놓았습니다.`;
}
