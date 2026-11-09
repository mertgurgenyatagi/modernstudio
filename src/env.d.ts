import type { StudioBridge } from './core/fileBridge';

declare global {
  interface Window {
    /** The bridge to the main process (electron/preload). Absent when the page runs outside the app. */
    studio?: StudioBridge;
  }
}
