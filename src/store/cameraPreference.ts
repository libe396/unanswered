import { create } from 'zustand';

// Session-only live-camera choice, set after the pre-reveal consent UI.
// Never persisted with the report; reset when leaving the camera stage.
export const useCameraPreference = create<{ enabled: boolean; setEnabled: (enabled: boolean) => void }>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));
