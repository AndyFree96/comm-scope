// Minimal ambient typing for neo-blessed (ships no TypeScript types).
declare module 'neo-blessed' {
  // Widgets are loosely typed: the blessed object model is dynamic.
  export interface BlessedScreen {
    append(el: unknown): void;
    key(keys: string[], cb: () => void): void;
    render(): void;
    destroy(): void;
  }
  export interface BlessedWidget {
    setContent(content: string): void;
    log(line: string): void;
    focus(): void;
  }
  interface Blessed {
    screen(opts?: Record<string, unknown>): BlessedScreen;
    box(opts?: Record<string, unknown>): BlessedWidget;
    log(opts?: Record<string, unknown>): BlessedWidget;
  }
  const blessed: Blessed;
  export default blessed;
}
