import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '../../store/connections';
import { terminalManager, TerminalSession } from '../../core/terminal-manager';
import TouchBar from '../components/TouchBar';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const [status, setStatus] = useState<TerminalSession['status']>('disconnected');
  const [showToolbar, setShowToolbar] = useState(true);
  const connection = useConnectionsStore((s) => s.getConnection(id!));
  const settings = useConnectionsStore((s) => s.settings);

  useEffect(() => {
    if (!id || !containerRef.current || !connection) return;

    const session = terminalManager.createSession(id, containerRef.current);
    sessionRef.current = session;

    // Apply font size from settings
    session.terminal.options.fontSize = settings.fontSize;

    // Connect
    terminalManager.connect(id, {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      proxyUrl: connection.proxyUrl || settings.defaultProxyUrl,
    }, setStatus);

    // Handle resize
    const handleResize = () => terminalManager.fit(id);
    window.addEventListener('resize', handleResize);

    // Initial fit after fonts load
    const fitTimer = setTimeout(handleResize, 100);

    return () => {
      clearTimeout(fitTimer);
      window.removeEventListener('resize', handleResize);
      terminalManager.destroy(id);
      sessionRef.current = null;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDisconnect = useCallback(() => {
    if (id) terminalManager.disconnect(id);
    navigate('/');
  }, [id, navigate]);

  const handleReconnect = useCallback(() => {
    if (!id || !connection) return;
    terminalManager.destroy(id);
    if (containerRef.current) {
      const session = terminalManager.createSession(id, containerRef.current);
      sessionRef.current = session;
      session.terminal.options.fontSize = settings.fontSize;
      terminalManager.connect(id, {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        proxyUrl: connection.proxyUrl || settings.defaultProxyUrl,
      }, setStatus);
    }
  }, [id, connection, settings]);

  const sendSpecialKey = useCallback((data: string) => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'data', data }));
    }
    session.terminal.focus();
  }, []);

  if (!connection) {
    return (
      <div className="h-full flex items-center justify-center bg-terminal-bg">
        <div className="text-center">
          <p className="text-terminal-red mb-4">Connection not found</p>
          <button onClick={() => navigate('/')} className="text-terminal-green hover:underline">
            Back to connections
          </button>
        </div>
      </div>
    );
  }

  const statusColor = {
    connecting: 'text-terminal-yellow',
    connected: 'text-terminal-green',
    disconnected: 'text-terminal-fg',
    error: 'text-terminal-red',
  }[status];

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {/* Top bar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-terminal-surface border-b border-terminal-border text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDisconnect}
              className="text-terminal-fg hover:text-white transition-colors"
              title="Disconnect"
            >
              &larr;
            </button>
            <span className="text-white font-medium">{connection.name || connection.host}</span>
            <span className={`text-xs ${statusColor}`}>
              ({status})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {status === 'disconnected' && (
              <button
                onClick={handleReconnect}
                className="px-2 py-0.5 text-xs bg-terminal-green text-black rounded hover:brightness-110"
              >
                Reconnect
              </button>
            )}
            <button
              onClick={() => setShowToolbar(false)}
              className="text-terminal-fg hover:text-white text-xs"
              title="Hide toolbar"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* Terminal */}
      <div
        className="flex-1 xterm-container"
        ref={containerRef}
        onClick={() => {
          if (!showToolbar) setShowToolbar(true);
        }}
      />

      {/* Touch bar for special keys */}
      <TouchBar onKey={sendSpecialKey} />
    </div>
  );
}
