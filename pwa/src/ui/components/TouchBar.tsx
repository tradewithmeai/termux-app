import { useState } from 'react';

interface Props {
  onKey: (data: string) => void;
}

const KEYS = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\t' },
  { label: 'Ctrl', data: '', modifier: 'ctrl' as const },
  { label: 'Alt', data: '', modifier: 'alt' as const },
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
 * Touch-optimized bar for special keys.
 * Ctrl and Alt are sticky modifiers: tap once to activate (highlighted),
 * then the next non-modifier key press applies the modifier and resets.
 */
export default function TouchBar({ onKey }: Props) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const handleKey = (key: typeof KEYS[number]) => {
    if (key.modifier === 'ctrl') {
      setCtrlActive((v) => !v);
      return;
    }
    if (key.modifier === 'alt') {
      setAltActive((v) => !v);
      return;
    }

    let data = key.data;

    // Apply Ctrl: for printable ASCII letters, send the control character
    if (ctrlActive && data.length === 1) {
      const code = data.toUpperCase().charCodeAt(0);
      if (code >= 0x40 && code <= 0x5f) {
        data = String.fromCharCode(code & 0x1f);
      }
    }

    // Apply Alt: prepend ESC (standard terminal Alt encoding)
    if (altActive) {
      data = '\x1b' + data;
    }

    onKey(data);
    setCtrlActive(false);
    setAltActive(false);
  };

  const sendCombo = (data: string) => {
    onKey(data);
    setCtrlActive(false);
    setAltActive(false);
  };

  const modifierClass = (active: boolean) =>
    active
      ? 'flex-shrink-0 px-2.5 py-1 bg-terminal-green/40 rounded text-xs text-terminal-green font-bold hover:bg-terminal-green/50 active:bg-terminal-green/60 transition-colors min-w-[32px] ring-1 ring-terminal-green'
      : 'flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 active:bg-terminal-green/20 transition-colors min-w-[32px]';

  const keyClass = 'flex-shrink-0 px-2.5 py-1 bg-terminal-border rounded text-xs text-terminal-fg hover:text-white hover:bg-terminal-fg/20 active:bg-terminal-green/20 transition-colors min-w-[32px]';

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-terminal-surface border-t border-terminal-border overflow-x-auto">
      {KEYS.map((key) => (
        <button
          key={key.label}
          onClick={() => handleKey(key)}
          className={key.modifier ? modifierClass(key.modifier === 'ctrl' ? ctrlActive : altActive) : keyClass}
        >
          {key.label}
        </button>
      ))}

      {/* Common Ctrl combos */}
      <div className="w-px h-4 bg-terminal-border mx-1 flex-shrink-0" />
      <button
        onClick={() => sendCombo('\x03')}
        className="flex-shrink-0 px-2.5 py-1 bg-terminal-red/20 rounded text-xs text-terminal-red hover:bg-terminal-red/30 active:bg-terminal-red/40 transition-colors"
        title="Ctrl+C"
      >
        ^C
      </button>
      <button
        onClick={() => sendCombo('\x04')}
        className={keyClass}
        title="Ctrl+D"
      >
        ^D
      </button>
      <button
        onClick={() => sendCombo('\x1a')}
        className={keyClass}
        title="Ctrl+Z"
      >
        ^Z
      </button>
      <button
        onClick={() => sendCombo('\x0c')}
        className={keyClass}
        title="Ctrl+L (clear)"
      >
        ^L
      </button>
    </div>
  );
}
