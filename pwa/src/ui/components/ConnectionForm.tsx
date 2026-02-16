import { useState, useEffect } from 'react';
import { SavedConnection, useConnectionsStore } from '../../store/connections';
import { listKeys, SSHKey } from '../../core/key-manager';

interface Props {
  initial?: SavedConnection;
  onSave: (conn: Omit<SavedConnection, 'id'>) => void;
  onCancel: () => void;
}

export default function ConnectionForm({ initial, onSave, onCancel }: Props) {
  const defaultProxy = useConnectionsStore((s) => s.settings.defaultProxyUrl);
  const [keys, setKeys] = useState<SSHKey[]>([]);

  const [name, setName] = useState(initial?.name || '');
  const [host, setHost] = useState(initial?.host || '');
  const [port, setPort] = useState(initial?.port || 22);
  const [username, setUsername] = useState(initial?.username || '');
  const [authMethod, setAuthMethod] = useState<'password' | 'key'>(initial?.authMethod || 'password');
  const [password, setPassword] = useState(initial?.password || '');
  const [savePassword, setSavePassword] = useState(initial?.savePassword ?? true);
  const [keyId, setKeyId] = useState(initial?.keyId || '');
  const [proxyUrl, setProxyUrl] = useState(initial?.proxyUrl || '');

  useEffect(() => {
    listKeys().then(setKeys);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !username.trim()) return;

    onSave({
      name: name.trim() || `${username}@${host}`,
      host: host.trim(),
      port,
      username: username.trim(),
      authMethod,
      password: savePassword ? password : undefined,
      savePassword,
      keyId: authMethod === 'key' ? keyId : undefined,
      proxyUrl: proxyUrl.trim() || defaultProxy,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-terminal-surface rounded-lg border border-terminal-green/40 p-4 mb-4">
      <h3 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-3">
        {initial ? 'Edit Connection' : 'New Connection'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="text-xs text-terminal-fg block mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Server"
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          />
        </div>

        {/* Host */}
        <div>
          <label className="text-xs text-terminal-fg block mb-1">Host *</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.100"
            required
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          />
        </div>

        {/* Port */}
        <div>
          <label className="text-xs text-terminal-fg block mb-1">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
            min={1}
            max={65535}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          />
        </div>

        {/* Username */}
        <div>
          <label className="text-xs text-terminal-fg block mb-1">Username *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
            required
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          />
        </div>

        {/* Auth method */}
        <div>
          <label className="text-xs text-terminal-fg block mb-1">Auth Method</label>
          <select
            value={authMethod}
            onChange={(e) => setAuthMethod(e.target.value as 'password' | 'key')}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          >
            <option value="password">Password</option>
            <option value="key">SSH Key</option>
          </select>
        </div>

        {/* Password */}
        {authMethod === 'password' && (
          <div className="sm:col-span-2">
            <label className="text-xs text-terminal-fg block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
            />
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={savePassword}
                onChange={(e) => setSavePassword(e.target.checked)}
                className="accent-terminal-green"
              />
              <span className="text-xs text-terminal-fg">Save password</span>
            </label>
          </div>
        )}

        {/* Key selection */}
        {authMethod === 'key' && (
          <div className="sm:col-span-2">
            <label className="text-xs text-terminal-fg block mb-1">SSH Key</label>
            {keys.length === 0 ? (
              <p className="text-xs text-terminal-fg/60">
                No SSH keys found. Generate or import one in Settings.
              </p>
            ) : (
              <select
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
              >
                <option value="">Select a key...</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Proxy URL */}
        <div className="sm:col-span-2">
          <label className="text-xs text-terminal-fg block mb-1">
            WebSocket Proxy URL (leave blank for default)
          </label>
          <input
            type="text"
            value={proxyUrl}
            onChange={(e) => setProxyUrl(e.target.value)}
            placeholder={defaultProxy}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-terminal-fg hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-terminal-green text-black rounded text-sm font-medium hover:brightness-110 transition"
        >
          {initial ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  );
}
