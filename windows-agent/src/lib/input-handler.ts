/**
 * Input handler — routes viewer input events to the Electron native bridge.
 *
 * Inspired by QuickDesk's `input/mouse-handler.js` + `input/keyboard-handler.js`,
 * but adapted to our relay-WS message format (the viewer sends JSON messages,
 * not protobuf over a DataChannel).
 *
 * Handles: mouse_move, mouse_click, key, wheel, scroll.
 * Delegates to `window.electron.injectInput()` which uses the native addon
 * (<1ms/event) with a PowerShell fallback.
 */

import type { ViewerMessage } from "./session";

export type InputEventType =
  | "mouse_move"
  | "mouse_click"
  | "key"
  | "wheel"
  | "scroll";

export interface InputEvent {
  type: InputEventType;
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  down?: boolean;
  key?: string;
  deltaX?: number;
  deltaY?: number;
  wheelDelta?: number;
}

export class InputHandler {
  private enabled = false;

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  /** Handle a viewer message; returns true if it was an input event. */
  async handle(msg: ViewerMessage): Promise<boolean> {
    if (!this.enabled) return false;

    const bridge = (window as any).electron;
    if (!bridge?.injectInput) return false;

    const type = msg.type as InputEventType;
    if (
      type !== "mouse_move" &&
      type !== "mouse_click" &&
      type !== "key" &&
      type !== "wheel" &&
      type !== "scroll"
    ) {
      return false;
    }

    try {
      await bridge.injectInput(msg);
    } catch (err) {
      console.error("[Input] Inject failed", err);
    }
    return true;
  }
}