import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore, SavedConnection } from '../../store/connections';
import ConnectionCard from '../components/ConnectionCard';
import ConnectionForm from '../components/ConnectionForm';

export default function HomePage() {
  const navigate = useNavigate();
  const { connections, addConnection, deleteConnection } = useConnectionsStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...connections].sort((a, b) => {
    const at = a.lastConnected || 0;
    const bt = b.lastConnected || 0;
    return bt - at;
  });

  const handleSave = (conn: Omit<SavedConnection, 'id'>) => {
    if (editingId) {
      useConnectionsStore.getState().updateConnection(editingId, conn);
      setEditingId(null);
    } else {
      addConnection(conn);
    }
    setShowForm(false);
  };

  const handleConnect = (id: string) => {
    useConnectionsStore.getState().touchConnection(id);
    navigate(`/terminal/${id}`);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this connection?')) {
      deleteConnection(id);
    }
  };

  const editingConn = editingId
    ? connections.find((c) => c.id === editingId)
    : undefined;

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-terminal-surface border-b border-terminal-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-terminal-green flex items-center justify-center text-black font-bold text-sm">
            T
          </div>
          <h1 className="text-lg font-semibold text-white">Termux Web</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="px-3 py-1.5 text-sm text-terminal-fg hover:text-white transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="px-3 py-1.5 text-sm bg-terminal-green text-black rounded font-medium hover:brightness-110 transition"
          >
            + New
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {connections.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-xl bg-terminal-surface flex items-center justify-center mb-4">
              <span className="text-3xl text-terminal-green">&gt;_</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No connections yet</h2>
            <p className="text-terminal-fg mb-6 max-w-sm">
              Add an SSH connection to get started. You'll need a WebSocket proxy
              running on your server to bridge SSH connections.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-terminal-green text-black rounded font-medium hover:brightness-110 transition"
            >
              Add Connection
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {showForm && (
              <ConnectionForm
                initial={editingConn}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingId(null); }}
              />
            )}
            {sorted.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onConnect={() => handleConnect(conn.id)}
                onEdit={() => handleEdit(conn.id)}
                onDelete={() => handleDelete(conn.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 text-xs text-terminal-fg/50 border-t border-terminal-border text-center">
        Termux Web Terminal &mdash; SSH client for ChromeOS
      </footer>
    </div>
  );
}
