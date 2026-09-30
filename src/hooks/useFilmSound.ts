import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let muted = sessionStorage.getItem('unanswered-film-muted') === 'true';
export function setFilmMuted(value: boolean) {
  muted = value;
  sessionStorage.setItem('unanswered-film-muted', String(value));
  listeners.forEach((listener) => listener());
}
export function activateFilmSound() {
  // Called synchronously by the entrance gesture. Preserve an explicit mute.
  if (sessionStorage.getItem('unanswered-film-muted') === null) setFilmMuted(false);
}
export function useFilmSound() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => muted);
}
