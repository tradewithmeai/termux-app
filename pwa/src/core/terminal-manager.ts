import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export interface TerminalSession {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface ConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  proxyUrl: string;
}

/**
 * Manages terminal sessions and WebSocket connections.
 *
 * Supports two WebSocket proxy protocols:
 * 1. JSON-envelope protocol: proxy expects { type, host, port, username, ... }
 *    and forwards SSH data as { type: "data", data: "..." }.
 * 2. Raw binary protocol: after initial connect handshake, all data is raw
 *    terminal I/O (compatible with ttyd, gotty, webssh2, etc.).
 *
 * The proxy handles the SSH connection server-side. The browser only sees
 * terminal input/output over WebSocket.
 */
export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();

  createSession(id: string, container: HTMLElement): TerminalSession {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, monospace',
      theme: {
        background: '#000000',
        foreground: '#A9B7C6',
        cursor: '#A9B7C6',
        selectionBackground: '#264F78',
        black: '#000000',
        red: '#F44747',
        green: '#4EC9B0',
        yellow: '#DCDCAA',
        blue: '#569CD6',
        magenta: '#C586C0',
        cyan: '#9CDCFE',
        white: '#D4D4D4',
        brightBlack: '#808080',
        brightRed: '#F44747',
        brightGreen: '#4EC9B0',
        brightYellow: '#DCDCAA',
        brightBlue: '#569CD6',
        brightMagenta: '#C586C0',
        brightCyan: '#9CDCFE',
        brightWhite: '#FFFFFF',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);

    // Initial fit after opening
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    const session: TerminalSession = {
      id,
      terminal,
      fitAddon,
      ws: null,
      status: 'disconnected',
    };

    this.sessions.set(id, session);
    return session;
  }

  connect(id: string, options: ConnectOptions, onStatus: (status: TerminalSession['status']) => void): void {
    const session = this.sessions.get(id);
    if (!session) return;

    session.status = 'connecting';
    onStatus('connecting');

    session.terminal.writeln(`\x1b[33mConnecting to ${options.host}:${options.port}...\x1b[0m`);

    try {
      const ws = new WebSocket(options.proxyUrl);
      session.ws = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // Send connection request to proxy
        const connectMsg = JSON.stringify({
          type: 'connect',
          host: options.host,
          port: options.port,
          username: options.username,
          password: options.password || undefined,
          privateKey: options.privateKey || undefined,
          cols: session.terminal.cols,
          rows: session.terminal.rows,
        });
        ws.send(connectMsg);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'connected') {
              session.status = 'connected';
              onStatus('connected');
              session.terminal.writeln(`\x1b[32mConnected to ${options.host}\x1b[0m\r\n`);
              session.terminal.focus();
            } else if (msg.type === 'data') {
              session.terminal.write(msg.data);
            } else if (msg.type === 'error') {
              session.terminal.writeln(`\x1b[31mError: ${msg.message}\x1b[0m`);
              session.status = 'error';
              onStatus('error');
            }
          } catch {
            // Not JSON — treat as raw terminal data
            session.terminal.write(event.data);
            if (session.status === 'connecting') {
              session.status = 'connected';
              onStatus('connected');
            }
          }
        } else {
          // Binary data — write directly
          session.terminal.write(new Uint8Array(event.data));
          if (session.status === 'connecting') {
            session.status = 'connected';
            onStatus('connected');
          }
        }
      };

      ws.onclose = () => {
        session.terminal.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
        session.status = 'disconnected';
        session.ws = null;
        onStatus('disconnected');
      };

      ws.onerror = () => {
        session.terminal.writeln('\r\n\x1b[31mConnection error.\x1b[0m');
        session.status = 'error';
        session.ws = null;
        onStatus('error');
      };

      // Forward terminal input to WebSocket
      session.terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data }));
        }
      });

      // Forward resize events
      session.terminal.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });

    } catch (err) {
      session.terminal.writeln(`\x1b[31mFailed to connect: ${err}\x1b[0m`);
      session.status = 'error';
      onStatus('error');
    }
  }

  disconnect(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.ws) {
      session.ws.close();
      session.ws = null;
    }
    session.status = 'disconnected';
  }

  fit(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.fitAddon.fit();
    }
  }

  destroy(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    this.disconnect(id);
    session.terminal.dispose();
    this.sessions.delete(id);
  }

  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  /** Write a local line to the terminal (no WebSocket). */
  writeLocal(id: string, text: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.terminal.write(text);
    }
  }
}

export const terminalManager = new TerminalManager();
