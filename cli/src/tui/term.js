// Terminal session for the TUI: alternate screen, raw keypresses, and a
// diff-based painter. Only lines that changed since the previous frame are
// rewritten, wrapped in synchronized-update markers (\e[?2026h/l) so
// supporting terminals (iTerm2, Terminal.app, kitty, wezterm, most Linux
// emulators) present each frame atomically — no flicker, no tearing.

import readline from "node:readline";

export function openScreen(out = process.stdout) {
  out.write("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let prev = [];
  let prevW = 0;
  let prevH = 0;
  let keyFn = null;
  let resizeFn = null;

  const onResize = () => {
    prev = [];
    prevW = prevH = 0;
    out.write("\x1b[2J");
    if (resizeFn) resizeFn();
  };
  out.on("resize", onResize);

  return {
    size: () => ({ W: out.columns || 80, H: out.rows || 24 }),

    // `cursor` is {row, col} (1-based) to show a real cursor (input modes),
    // or null to keep it hidden.
    paint(lines, cursor = null) {
      const { W, H } = this.size();
      let buf = "\x1b[?2026h";
      if (W !== prevW || H !== prevH) {
        buf += "\x1b[2J";
        prev = [];
        prevW = W;
        prevH = H;
      }
      for (let i = 0; i < H; i++) {
        if (lines[i] !== prev[i]) buf += `\x1b[${i + 1};1H` + (lines[i] ?? "") + "\x1b[K";
      }
      prev = lines;
      buf += cursor
        ? `\x1b[${cursor.row};${Math.max(1, Math.min(W, cursor.col))}H\x1b[?25h`
        : "\x1b[?25l";
      buf += "\x1b[?2026l";
      out.write(buf);
    },

    onKey(fn) {
      keyFn = fn;
      process.stdin.on("keypress", fn);
    },

    onResize(fn) {
      resizeFn = fn;
    },

    close() {
      if (keyFn) process.stdin.removeListener("keypress", keyFn);
      out.removeListener("resize", onResize);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      out.write("\x1b[?25h\x1b[2J\x1b[H\x1b[?1049l");
    },
  };
}
