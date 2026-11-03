import { useEffect, useRef } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { beginChoiceReplay, discardChoiceReplay, syncReplayVisit, type ChoiceScene, type ReplayInput } from '../lib/replay/choiceReplay';
import { createFrameCapture } from '../lib/replay/captureChoiceFrame';

/** Effects are suspended by Activity. Also wait for the film's inert gate to open. */
export function useChoiceReplay(scene: ChoiceScene, phase: string, enabled: boolean, selector: string) {
  const finishRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!enabled) return;
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) return;
    let stop: (() => void) | undefined;
    let stopped = false;
    function start() {
      if (stop || stopped || document.hidden || !root || root.closest('[inert], [hidden]')) return;
      const state = useExperienceStore.getState();
      if (state.currentScene !== scene) return;
      syncReplayVisit(state.visitId);
      const record = beginChoiceReplay(scene, phase);
      root.dataset.replayRecording = String(record.id);
      let painted = false;
      const paint = requestAnimationFrame(() => { painted = true; });
      const capture = createFrameCapture(record);
      const started = performance.now();
      const now = () => performance.now() - started;
      let raf = 0;
      let animationTimer = 0;
      let closed = false;
      function frame() {
        if (closed || !root) return;
        const value = capture(root, now());
        const last = record.frames.at(-1);
        if (!last || value.html !== last.html || value.width !== last.width || value.height !== last.height || JSON.stringify(value.scroll) !== JSON.stringify(last.scroll)) record.frames.push(value);
        // Sample actual finite transitions (preview blur, selection glow), never synthesize them.
        if (root.getAnimations({ subtree: true }).some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)) {
          window.clearTimeout(animationTimer);
          animationTimer = window.setTimeout(queueFrame, 33);
        }
      }
      function queueFrame() {
        if (raf || closed) return;
        raf = requestAnimationFrame(() => { raf = 0; frame(); });
      }
      function input(event: Event) {
        if (closed || useExperienceStore.getState().currentScene !== scene) return;
        const target = event.target instanceof Element ? event.target : null;
        const control = target?.closest('button,[role="button"],summary') ?? target;
        const kind: ReplayInput['kind'] = event.type === 'pointermove' ? 'move'
          : event.type === 'pointerover' ? 'enter' : event.type === 'pointerout' ? 'leave'
          : event.type === 'pointerdown' ? 'down' : event.type === 'pointerup' ? 'up'
          : event.type === 'focusin' ? 'focus' : event.type === 'focusout' ? 'blur' : 'click';
        const pointer = event instanceof MouseEvent && !(event.type === 'click' && event.detail === 0);
        const samples = event instanceof PointerEvent && event.type === 'pointermove' ? (event.getCoalescedEvents?.() ?? []) : [];
        for (const sample of samples.length ? samples : [event]) record.inputs.push({ t: Math.max(0, sample.timeStamp - started), kind, target: control?.getAttribute('aria-label') || control?.textContent?.trim().slice(0, 160) || '',
          ...(pointer ? { x: (sample as MouseEvent).clientX, y: (sample as MouseEvent).clientY, pointerType: event instanceof PointerEvent ? event.pointerType : 'mouse' } : {}) });
        if (event.type !== 'pointermove') queueFrame();
      }
      const outside = (event: PointerEvent) => {
        if (!event.relatedTarget) record.inputs.push({ t: now(), kind: 'leave', target: '', pointerType: event.pointerType });
      };
      const blur = () => record.inputs.push({ t: now(), kind: 'leave', target: '' });
      const events = ['pointermove', 'pointerover', 'pointerout', 'pointerdown', 'pointerup', 'click', 'focusin', 'focusout'];
      for (const name of events) document.addEventListener(name, input, true);
      document.addEventListener('pointerout', outside);
      window.addEventListener('blur', blur);
      window.addEventListener('resize', queueFrame);
      document.addEventListener('scroll', queueFrame, true);
      root.addEventListener('load', queueFrame, true);
      // State changes capture after React commits, independently of input ordering.
      const observer = new MutationObserver(queueFrame);
      observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
      // Capture the unselected screen immediately, before any visitor input.
      frame();
      if (record.frames[0]) record.frames[0].t = 0;
      finishRef.current = () => { if (!closed) { frame(); record.completed = true; stop?.(); } };
      stop = () => {
        if (closed) return;
        // Preserve the last selection frame; the next phase may already be mounted.
        record.duration = now();
        closed = true;
        cancelAnimationFrame(raf);
        window.clearTimeout(animationTimer);
        cancelAnimationFrame(paint);
        delete root!.dataset.replayRecording;
        // React StrictMode's pre-paint setup/cleanup is not a visitor's visit.
        if (!painted && record.inputs.length === 0) discardChoiceReplay(record);
        observer.disconnect();
        for (const name of events) document.removeEventListener(name, input, true);
        document.removeEventListener('pointerout', outside);
        window.removeEventListener('blur', blur);
        window.removeEventListener('resize', queueFrame);
        document.removeEventListener('scroll', queueFrame, true);
        root.removeEventListener('load', queueFrame, true);
        finishRef.current = () => {};
      };
    }
    const visibility = () => {
      if (document.hidden) { stop?.(); stop = undefined; }
      else start();
    };
    document.addEventListener('visibilitychange', visibility);
    start();
    const gate = new MutationObserver(start);
    if (!stop) gate.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['inert', 'hidden'] });
    return () => { stopped = true; gate.disconnect(); document.removeEventListener('visibilitychange', visibility); stop?.(); };
  }, [scene, phase, enabled, selector]);
  return () => finishRef.current();
}

// Clear on every reset/new visit, including while all recording scenes are hidden.
useExperienceStore.subscribe((state, previous) => {
  if (state.visitId !== previous.visitId) syncReplayVisit(state.visitId);
});
