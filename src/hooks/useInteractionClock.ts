import { createContext, useContext } from 'react';

export const InteractionClockContext = createContext<() => number>(Date.now);
export const useInteractionClock = () => useContext(InteractionClockContext);
