import { SavedConnection } from '../../store/connections';

interface Props {
  connection: SavedConnection;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ConnectionCard({ connection, onConnect, onEdit, onDelete }: Props) {
  const lastUsed = connection.lastConnected
    ? formatRelativeTime(connection.lastConnected)
    : 'Never used';

  return (
    <div className="bg-terminal-surface rounded-lg p-4 border border-terminal-border hover:border-terminal-green/40 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-terminal-green/10 flex items-center justify-center flex-shrink-0">
            <span className="text-terminal-green text-lg font-mono">&gt;_</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium truncate">
              {connection.name || connection.host}
            </h3>
            <p className="text-sm text-terminal-fg truncate">
              {connection.username}@{connection.host}:{connection.port}
            </p>
            <p className="text-xs text-terminal-fg/50 mt-0.5">{lastUsed}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onConnect}
            className="px-3 py-1.5 bg-terminal-green text-black rounded text-sm font-medium hover:brightness-110 transition"
          >
            Connect
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-terminal-fg hover:text-white opacity-0 group-hover:opacity-100 transition-all"
            title="Edit"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-terminal-fg hover:text-terminal-red opacity-0 group-hover:opacity-100 transition-all"
            title="Delete"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
