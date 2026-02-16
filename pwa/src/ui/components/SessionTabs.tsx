interface Session {
  id: string;
  label: string;
}

interface Props {
  sessions: Session[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  maxSessions?: number;
}

export default function SessionTabs({ sessions, activeId, onSelect, onCreate, onClose, maxSessions = 8 }: Props) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-terminal-surface border-b border-terminal-border overflow-x-auto">
      {sessions.map((s, i) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-t text-xs transition-colors flex-shrink-0 ${
            s.id === activeId
              ? 'bg-terminal-bg text-white border-t border-x border-terminal-green/50'
              : 'text-terminal-fg hover:text-white hover:bg-terminal-bg/50'
          }`}
        >
          <span>{i + 1}: {s.label}</span>
          {sessions.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
              className="text-terminal-fg/40 hover:text-terminal-red ml-0.5 cursor-pointer"
              title="Close session"
            >
              x
            </span>
          )}
        </button>
      ))}
      {sessions.length < maxSessions && (
        <button
          onClick={onCreate}
          className="px-2 py-1 text-xs text-terminal-green hover:text-white transition-colors flex-shrink-0"
          title="New session"
        >
          +
        </button>
      )}
    </div>
  );
}
