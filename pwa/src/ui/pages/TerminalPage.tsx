import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnectionsStore } from '../../store/connections';
import { terminalManager, TerminalSession } from '../../core/terminal-manager';
import { getKey } from '../../core/key-manager';
import TouchBar from '../components/TouchBar';
import SessionTabs from '../components/SessionTabs';
import PasswordPromptDialog from '../components/PasswordPromptDialog';
import '@xterm/xterm/css/xterm.css';

interface SessionInfo {
  id: string;
  label: string;
  status: TerminalSession['status'];
}

const MAX_SESSIONS = 8;

export default function TerminalPage() {
  const { id: connId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [showToolbar, setShowToolbar] = useState(true);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const pendingPasswordSessionRef = useRef<string>('');
  const connection = useConnectionsStore((s) => s.getConnection(connId!));
  const settings = useConnectionsStore((s) => s.settings);

  const getSessionOpts = useCallback(() => ({
    fontSize: settings.fontSize,
    theme: settings.colorScheme,
    cursorStyle: settings.cursorStyle,
    cursorBlink: settings.cursorBlink,
    scrollbackRows: settings.scrollbackRows,
    bellBehavior: settings.bellBehavior,
  }), [settings]);

  const doConnect = useCallback(async (sessionId: string, passwordOverride?: string) => {
    if (!connId) return;
    const conn = useConnectionsStore.getState().getConnection(connId);
    if (!conn) return;
    const appSettings = useConnectionsStore.getState().settings;

    let privateKey: string | undefined;
    if (conn.authMethod === 'key' && conn.keyId) {
      const keyData = await getKey(conn.keyId);
      if (!keyData) {
        terminalManager.writeLocal(sessionId, '\x1b[31mSSH key not found. Check Settings.\x1b[0m\r\n');
        setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status: 'error' } : s));
        return;
      }
      privateKey = keyData.privateKey;
    }

    const password = passwordOverride || conn.password;
    if (conn.authMethod === 'password' && !password && !privateKey) {
      pendingPasswordSessionRef.current = sessionId;
      setShowPasswordPrompt(true);
      return;
    }

    terminalManager.connect(sessionId, {
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password,
      privateKey,
      proxyUrl: conn.proxyUrl || appSettings.defaultProxyUrl,
      timeout: appSettings.connectionTimeout || 10000,
    }, (status) => {
      setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status } : s));
    });
  }, [connId]);

  // Create initial session on mount
  useEffect(() => {
    if (!connId || !connection) return;

    const sessionId = `${connId}-initial`;
    const info: SessionInfo = {
      id: sessionId,
      label: 'Shell 1',
      status: 'disconnected',
    };
    setSessions([info]);
    setActiveSessionId(sessionId);

    return () => {
      // Cleanup all sessions
      setSessions((prev) => {
        prev.forEach((s) => terminalManager.destroy(s.id));
        return [];
      });
      containersRef.current.clear();
    };
  }, [connId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mount terminal when container ref is set for initial session
  const initialMounted = useRef(false);
  useEffect(() => {
    if (initialMounted.current) return;
    if (sessions.length === 0 || !activeSessionId) return;

    const container = containersRef.current.get(activeSessionId);
    if (!container) return;

    initialMounted.current = true;
    terminalManager.createSession(activeSessionId, container, getSessionOpts());
    doConnect(activeSessionId);
  }, [sessions, activeSessionId, getSessionOpts, doConnect]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (activeSessionId) terminalManager.fit(activeSessionId);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSessionId]);

  // Fit active session when switching
  useEffect(() => {
    if (activeSessionId) {
      requestAnimationFrame(() => terminalManager.fit(activeSessionId));
      const session = terminalManager.getSession(activeSessionId);
      if (session) session.terminal.focus();
    }
  }, [activeSessionId]);

  // Keyboard shortcuts: Ctrl+Alt+N (next), Ctrl+Alt+P (prev), Ctrl+Alt+C (create)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === activeSessionId);
          if (idx >= 0 && idx < prev.length - 1) {
            setActiveSessionId(prev[idx + 1].id);
          }
          return prev;
        });
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === activeSessionId);
          if (idx > 0) {
            setActiveSessionId(prev[idx - 1].id);
          }
          return prev;
        });
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleCreateSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateSession = useCallback(() => {
    if (sessions.length >= MAX_SESSIONS) return;
    const sessionId = `${connId}-${Date.now()}`;
    const info: SessionInfo = {
      id: sessionId,
      label: `Shell ${sessions.length + 1}`,
      status: 'disconnected',
    };
    setSessions((prev) => [...prev, info]);
    setActiveSessionId(sessionId);
    // Terminal will be mounted when the container div renders and ref callback fires
  }, [connId, sessions.length]);

  const handleCloseSession = useCallback((sessionId: string) => {
    terminalManager.destroy(sessionId);
    containersRef.current.delete(sessionId);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (next.length === 0) {
        navigate('/');
        return [];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[next.length - 1].id);
      }
      return next;
    });
  }, [activeSessionId, navigate]);

  const handleDisconnect = useCallback(() => {
    sessions.forEach((s) => terminalManager.destroy(s.id));
    navigate('/');
  }, [sessions, navigate]);

  const handleReconnect = useCallback(() => {
    if (activeSessionId) {
      const container = containersRef.current.get(activeSessionId);
      if (container) {
        terminalManager.destroy(activeSessionId);
        container.innerHTML = '';
        terminalManager.createSession(activeSessionId, container, getSessionOpts());
        doConnect(activeSessionId);
      }
    }
  }, [activeSessionId, getSessionOpts, doConnect]);

  const handlePasswordSubmit = useCallback((password: string) => {
    setShowPasswordPrompt(false);
    const sid = pendingPasswordSessionRef.current;
    if (sid) doConnect(sid, password);
  }, [doConnect]);

  const handlePasswordCancel = useCallback(() => {
    setShowPasswordPrompt(false);
    navigate('/');
  }, [navigate]);

  const sendData = useCallback((data: string) => {
    if (!activeSessionId) return;
    const session = terminalManager.getSession(activeSessionId);
    if (!session) return;
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(new TextEncoder().encode(data));
    }
    session.terminal.focus();
  }, [activeSessionId]);

  // Ref callback to attach terminal to container div
  const setContainerRef = useCallback((sessionId: string) => (el: HTMLDivElement | null) => {
    if (!el) return;
    if (containersRef.current.has(sessionId) && containersRef.current.get(sessionId) === el) return;
    containersRef.current.set(sessionId, el);

    // If this session doesn't have a terminal yet, create one
    if (!terminalManager.getSession(sessionId)) {
      terminalManager.createSession(sessionId, el, getSessionOpts());
      doConnect(sessionId);
    }
  }, [getSessionOpts, doConnect]);

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

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeStatus = activeSession?.status || 'disconnected';
  const statusColor = {
    connecting: 'text-terminal-yellow',
    connected: 'text-terminal-green',
    disconnected: 'text-terminal-fg',
    error: 'text-terminal-red',
  }[activeStatus];

  return (
    <div className="h-full flex flex-col bg-terminal-bg">
      {showPasswordPrompt && (
        <PasswordPromptDialog
          hostLabel={`${connection.username}@${connection.host}:${connection.port}`}
          onSubmit={handlePasswordSubmit}
          onCancel={handlePasswordCancel}
        />
      )}

      {/* Top bar */}
      {showToolbar && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-terminal-surface border-b border-terminal-border text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDisconnect}
              className="text-terminal-fg hover:text-white transition-colors"
              title="Disconnect all & go back"
            >
              &larr;
            </button>
            <span className="text-white font-medium">{connection.name || connection.host}</span>
            <span className={`text-xs ${statusColor}`}>
              ({activeStatus})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeStatus === 'disconnected' && (
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

      {/* Session tabs */}
      {sessions.length > 1 && (
        <SessionTabs
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={setActiveSessionId}
          onCreate={handleCreateSession}
          onClose={handleCloseSession}
          maxSessions={MAX_SESSIONS}
        />
      )}

      {/* Terminal containers — only active one is visible */}
      <div className="flex-1 relative">
        {sessions.map((s) => (
          <div
            key={s.id}
            ref={setContainerRef(s.id)}
            className={`absolute inset-0 xterm-container ${s.id === activeSessionId ? '' : 'hidden'}`}
            onClick={() => {
              if (!showToolbar) setShowToolbar(true);
            }}
          />
        ))}
      </div>

      {/* Touch bar for special keys */}
      <TouchBar onKey={sendData} />
    </div>
  );
}
