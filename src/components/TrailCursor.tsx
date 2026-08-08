import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import './TrailCursor.css';

const SPAWN_DISTANCE = 16;
const MAX_NODES = 20;
const NODE_LIFETIME_MS = 1500;

/**
 * Custom cursor for Landing: a lead dot plus a trail of fading afterimage
 * nodes. This is the "hover reveals a trace, not a reaction" interaction
 * principle (PROJECT_GUIDELINES §7) made literal. Scoped to whichever Scene
 * mounts it — does not touch the global cursor.
 */
export function TrailCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const lastSpawnRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<HTMLSpanElement[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    function handleMove(event: MouseEvent) {
      const { clientX: x, clientY: y } = event;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }

      if (prefersReducedMotion) return;

      const dx = x - lastSpawnRef.current.x;
      const dy = y - lastSpawnRef.current.y;
      if (Math.hypot(dx, dy) < SPAWN_DISTANCE) return;
      lastSpawnRef.current = { x, y };

      const node = document.createElement('span');
      node.className = 'trail-cursor__node';
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      layerRef.current?.appendChild(node);
      nodesRef.current.push(node);

      requestAnimationFrame(() => {
        node.style.opacity = '0';
      });

      window.setTimeout(() => {
        node.remove();
        nodesRef.current = nodesRef.current.filter((n) => n !== node);
      }, NODE_LIFETIME_MS);

      if (nodesRef.current.length > MAX_NODES) {
        const oldest = nodesRef.current.shift();
        oldest?.remove();
      }
    }

    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      nodesRef.current.forEach((node) => node.remove());
      nodesRef.current = [];
    };
  }, [prefersReducedMotion]);

  return (
    <div className="trail-cursor" aria-hidden="true">
      <div ref={layerRef} className="trail-cursor__layer" />
      <div ref={dotRef} className="trail-cursor__dot" />
    </div>
  );
}
