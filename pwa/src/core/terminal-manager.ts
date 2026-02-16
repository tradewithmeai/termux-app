import { Terminal, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export interface TerminalSession {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  connectTimeout: ReturnType<typeof setTimeout> | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface ConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  proxyUrl: string;
  timeout?: number;
}

export interface SessionOptions {
  fontSize?: number;
  theme?: string;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollbackRows?: number;
  bellBehavior?: 'vibrate' | 'beep' | 'ignore';
}

const THEMES: Record<string, ITheme> = {
  dark: {
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
  green: {
    background: '#001100',
    foreground: '#33FF33',
    cursor: '#33FF33',
    selectionBackground: '#005500',
    black: '#001100',
    red: '#FF3333',
    green: '#33FF33',
    yellow: '#FFFF33',
    blue: '#33CCFF',
    magenta: '#FF33FF',
    cyan: '#33FFCC',
    white: '#CCFFCC',
    brightBlack: '#006600',
    brightRed: '#FF6666',
    brightGreen: '#66FF66',
    brightYellow: '#FFFF66',
    brightBlue: '#66CCFF',
    brightMagenta: '#FF66FF',
    brightCyan: '#66FFCC',
    brightWhite: '#FFFFFF',
  },
  amber: {
    background: '#110800',
    foreground: '#FFB000',
    cursor: '#FFB000',
    selectionBackground: '#553300',
    black: '#110800',
    red: '#FF4400',
    green: '#FFB000',
    yellow: '#FFCC00',
    blue: '#FF8800',
    magenta: '#FF6600',
    cyan: '#FFDD00',
    white: '#FFDDA0',
    brightBlack: '#664400',
    brightRed: '#FF6633',
    brightGreen: '#FFC033',
    brightYellow: '#FFDD33',
    brightBlue: '#FFA033',
    brightMagenta: '#FF8833',
    brightCyan: '#FFEE33',
    brightWhite: '#FFFFFF',
  },
};

/**
 * Manages terminal sessions and WebSocket connections.
 * Sends JSON for control messages (connect, resize) and binary for terminal data.
 */
export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();

  createSession(id: string, container: HTMLElement, opts: SessionOptions = {}): TerminalSession {
    const theme = THEMES[opts.theme || 'dark'] || THEMES.dark;
    const terminal = new Terminal({
      cursorBlink: opts.cursorBlink ?? true,
      cursorStyle: opts.cursorStyle || 'block',
      fontSize: opts.fontSize || 14,
      scrollback: opts.scrollbackRows || 1000,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, monospace',
      theme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);

    // Bell handler
    const bellBehavior = opts.bellBehavior || 'ignore';
    terminal.onBell(() => {
      if (bellBehavior === 'vibrate' && navigator.vibrate) {
        navigator.vibrate(200);
      } else if (bellBehavior === 'beep') {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 800;
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        } catch { /* audio not available */ }
      }
    });

    // Initial fit after opening
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    const session: TerminalSession = {
      id,
      terminal,
      fitAddon,
      ws: null,
      connectTimeout: null,
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

      // Connection timeout
      const timeout = options.timeout || 10000;
      session.connectTimeout = setTimeout(() => {
        if (session.status === 'connecting') {
          session.terminal.writeln('\r\n\x1b[31mConnection timed out.\x1b[0m');
          session.status = 'error';
          session.ws = null;
          ws.close();
          onStatus('error');
        }
      }, timeout);

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
              if (session.connectTimeout) { clearTimeout(session.connectTimeout); session.connectTimeout = null; }
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
        if (session.connectTimeout) { clearTimeout(session.connectTimeout); session.connectTimeout = null; }
        session.terminal.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
        session.status = 'disconnected';
        session.ws = null;
        onStatus('disconnected');
      };

      ws.onerror = () => {
        if (session.connectTimeout) { clearTimeout(session.connectTimeout); session.connectTimeout = null; }
        session.terminal.writeln('\r\n\x1b[31mConnection error.\x1b[0m');
        session.status = 'error';
        session.ws = null;
        onStatus('error');
      };

      // Forward terminal input as binary frames
      session.terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(data));
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

  setTheme(id: string, themeName: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.terminal.options.theme = THEMES[themeName] || THEMES.dark;
    }
  }

  setFontSize(id: string, size: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.terminal.options.fontSize = size;
      session.fitAddon.fit();
    }
  }
}

export const terminalManager = new TerminalManager();
