import { useState, useRef, useEffect } from 'react';

interface Props {
  hostLabel: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export default function PasswordPromptDialog({ hostLabel, onSubmit, onCancel }: Props) {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <form
        onSubmit={handleSubmit}
        className="bg-terminal-surface border border-terminal-border rounded-lg p-5 w-80 max-w-[90vw]"
      >
        <h3 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-1">
          Password Required
        </h3>
        <p className="text-xs text-terminal-fg mb-4 font-mono">{hostLabel}</p>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-terminal-fg hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!password}
            className="px-4 py-1.5 bg-terminal-green text-black rounded text-sm font-medium hover:brightness-110 disabled:opacity-50 transition"
          >
            Connect
          </button>
        </div>
      </form>
    </div>
  );
}
