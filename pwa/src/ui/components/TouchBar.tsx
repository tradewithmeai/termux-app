interface Props {
  onKey: (data: string) => void;
}

const KEYS = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'Ctrl', data: '', modifier: true },
  { label: '|', data: '|' },
  { label: '~', data: '~' },
  { label: '/', data: '/' },
  { label: '-', data: '-' },
  { label: 'Up', data: '\x1b[A' },
  { label: 'Dn', data: '\x1b[B' },
  { label: 'Lt', data: '\x1b[D' },
  { label: 'Rt', data: '\x1b[C' },
];

/**
 * Touch-optimized bar for special keys that are hard to type
 * on Chromebook virtual keyboards or tablet keyboards.
 */
export default function TouchBar({ onKey }: Props) {
  const handleKey = (key: typeof KEYS[number]) => {
    if (key.modifier) {
      // For Ctrl, we don't send anything yet — the next keypress
      // should be modified. For simplicity in the MVP, just toggle
      // a Ctrl state indicator. Full implementation would intercept
      // the next key and send ctrl+key.
      // For now, send a visual cue and handle common combos.
      return;
    }
    onKey(key.data);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-terminal-surface border-t border-terminal-border overflow-x-auto">
      {KEYS.map((key) => (
        <button
          key={key.label}
          onClick={() => handleKey(key)}
          className="flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 active:bg-terminal-green/20 transition-colors min-w-[32px]"
        >
          {key.label}
        </button>
      ))}

      {/* Common Ctrl combos */}
      <div className="w-px h-4 bg-terminal-border mx-1 flex-shrink-0" />
      <button
        onClick={() => onKey('\x03')}
        className="flex-shrink-0 px-2.5 py-1 bg-terminal-red/20 rounded text-xs text-terminal-red hover:bg-terminal-red/30 active:bg-terminal-red/40 transition-colors"
        title="Ctrl+C"
      >
        ^C
      </button>
      <button
        onClick={() => onKey('\x04')}
        className="flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 transition-colors"
        title="Ctrl+D"
      >
        ^D
      </button>
      <button
        onClick={() => onKey('\x1a')}
        className="flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 transition-colors"
        title="Ctrl+Z"
      >
        ^Z
      </button>
      <button
        onClick={() => onKey('\x0c')}
        className="flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 transition-colors"
        title="Ctrl+L (clear)"
      >
        ^L
      </button>
    </div>
  );
}
