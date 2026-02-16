import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '../../store/connections';
import { listKeys, generateKeyPair, deleteKey, importKeyFromPEM, SSHKey } from '../../core/key-manager';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useConnectionsStore();
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState('');
  const [importPem, setImportPem] = useState('');
  const [importError, setImportError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    listKeys().then(setKeys);
  }, []);

  const handleGenerate = async () => {
    if (!newKeyName.trim()) return;
    setGenerating(true);
    try {
      const key = await generateKeyPair(newKeyName.trim());
      setKeys((prev) => [...prev, key]);
      setNewKeyName('');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Delete this SSH key?')) return;
    await deleteKey(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleImport = async () => {
    if (!importName.trim() || !importPem.trim()) return;
    setImportError('');
    try {
      const key = await importKeyFromPEM(importName.trim(), importPem.trim());
      setKeys((prev) => [...prev, key]);
      setShowImport(false);
      setImportName('');
      setImportPem('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid key format');
    }
  };

  const handleCopyPublicKey = async (key: SSHKey) => {
    await navigator.clipboard.writeText(key.publicKey);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-terminal-surface border-b border-terminal-border">
        <button
          onClick={() => navigate('/')}
          className="text-terminal-fg hover:text-white transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {/* Terminal Settings */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-3">
            Terminal
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Font Size</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateSettings({ fontSize: Math.max(8, settings.fontSize - 1) })}
                  className="w-8 h-8 bg-terminal-border rounded text-white hover:bg-terminal-fg/30"
                >
                  -
                </button>
                <span className="w-8 text-center text-white text-sm">{settings.fontSize}</span>
                <button
                  onClick={() => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })}
                  className="w-8 h-8 bg-terminal-border rounded text-white hover:bg-terminal-fg/30"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Color Scheme</label>
              <select
                value={settings.colorScheme}
                onChange={(e) => updateSettings({ colorScheme: e.target.value as 'dark' | 'green' | 'amber' })}
                className="bg-terminal-border text-white text-sm rounded px-2 py-1"
              >
                <option value="dark">Dark</option>
                <option value="green">Green (Phosphor)</option>
                <option value="amber">Amber (Phosphor)</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Cursor Style</label>
              <select
                value={settings.cursorStyle}
                onChange={(e) => updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
                className="bg-terminal-border text-white text-sm rounded px-2 py-1"
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Cursor Blink</label>
              <input
                type="checkbox"
                checked={settings.cursorBlink}
                onChange={(e) => updateSettings({ cursorBlink: e.target.checked })}
                className="accent-terminal-green w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Bell</label>
              <select
                value={settings.bellBehavior}
                onChange={(e) => updateSettings({ bellBehavior: e.target.value as 'vibrate' | 'beep' | 'ignore' })}
                className="bg-terminal-border text-white text-sm rounded px-2 py-1"
              >
                <option value="ignore">Ignore</option>
                <option value="beep">Beep</option>
                <option value="vibrate">Vibrate</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <label className="text-sm text-white">Scrollback Lines</label>
              <input
                type="number"
                value={settings.scrollbackRows}
                onChange={(e) => updateSettings({ scrollbackRows: Math.max(100, Math.min(50000, parseInt(e.target.value) || 1000)) })}
                min={100}
                max={50000}
                step={100}
                className="w-24 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-terminal-green"
              />
            </div>
          </div>
        </section>

        {/* Connection Settings */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-3">
            Connection
          </h2>
          <div className="space-y-3">
            <div className="bg-terminal-surface rounded p-3">
              <label className="text-xs text-terminal-fg mb-1 block">Default Proxy URL</label>
              <input
                type="text"
                value={settings.defaultProxyUrl}
                onChange={(e) => updateSettings({ defaultProxyUrl: e.target.value })}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
                placeholder="ws://localhost:8888"
              />
              <p className="text-xs text-terminal-fg/60 mt-2">
                The WebSocket proxy bridges browser connections to SSH servers.
                Run the included proxy server on a machine with network access
                to your SSH targets.
              </p>
            </div>

            <div className="flex items-center justify-between bg-terminal-surface rounded p-3">
              <div>
                <label className="text-sm text-white block">Connection Timeout</label>
                <span className="text-xs text-terminal-fg/60">{settings.connectionTimeout / 1000}s</span>
              </div>
              <input
                type="range"
                min={5000}
                max={30000}
                step={1000}
                value={settings.connectionTimeout}
                onChange={(e) => updateSettings({ connectionTimeout: parseInt(e.target.value) })}
                className="w-32 accent-terminal-green"
              />
            </div>
          </div>
        </section>

        {/* SSH Keys */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-3">
            SSH Keys
          </h2>

          {/* Key list */}
          <div className="space-y-2 mb-3">
            {keys.length === 0 && (
              <p className="text-sm text-terminal-fg/60 bg-terminal-surface rounded p-3">
                No SSH keys. Generate or import one below.
              </p>
            )}
            {keys.map((key) => (
              <div key={key.id} className="bg-terminal-surface rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{key.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyPublicKey(key)}
                      className="text-xs text-terminal-cyan hover:underline"
                    >
                      {copiedId === key.id ? 'Copied!' : 'Copy Public Key'}
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="text-xs text-terminal-red hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-xs text-terminal-fg/60 font-mono truncate">
                  {key.publicKey.substring(0, 80)}...
                </p>
                <p className="text-xs text-terminal-fg/40 mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {/* Generate new key */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. chromebook)"
              className="flex-1 bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !newKeyName.trim()}
              className="px-4 py-2 bg-terminal-green text-black rounded text-sm font-medium hover:brightness-110 disabled:opacity-50 transition"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Import key */}
          {!showImport ? (
            <button
              onClick={() => setShowImport(true)}
              className="text-xs text-terminal-cyan hover:underline"
            >
              Import existing key
            </button>
          ) : (
            <div className="bg-terminal-surface rounded p-3 space-y-2">
              <input
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Key name"
                className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-terminal-green"
              />
              <textarea
                value={importPem}
                onChange={(e) => { setImportPem(e.target.value); setImportError(''); }}
                placeholder="Paste private key PEM..."
                rows={5}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-terminal-green resize-none"
              />
              {importError && (
                <p className="text-xs text-terminal-red">{importError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={!importName.trim() || !importPem.trim()}
                  className="px-3 py-1.5 bg-terminal-green text-black rounded text-sm font-medium hover:brightness-110 disabled:opacity-50"
                >
                  Import
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportName(''); setImportPem(''); setImportError(''); }}
                  className="px-3 py-1.5 text-sm text-terminal-fg hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold text-terminal-green uppercase tracking-wide mb-3">
            About
          </h2>
          <div className="bg-terminal-surface rounded p-3 text-sm text-terminal-fg">
            <p className="mb-1">
              <span className="text-white">Termux Web Terminal</span> v1.0.0
            </p>
            <p>
              A Chromebook-native SSH terminal client. Connects to SSH servers
              through a WebSocket proxy, providing a full terminal experience
              without requiring Crostini or Android VMs.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
