import { WebSocketServer } from 'ws';
import { Client } from 'ssh2';

const PORT = parseInt(process.env.PORT || '8888', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const SSH_TIMEOUT = 10000;

const wss = new WebSocketServer({ port: PORT });

console.log(`SSH proxy listening on port ${PORT}`);

wss.on('connection', (ws, req) => {
  // Origin validation
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = req.headers.origin || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      ws.close(4003, 'Origin not allowed');
      return;
    }
  }

  let sshClient = null;
  let sshStream = null;
  let connected = false;

  ws.on('message', (data, isBinary) => {
    // Binary frames are terminal input — forward to SSH
    if (isBinary || data instanceof ArrayBuffer || Buffer.isBuffer(data) && connected) {
      if (sshStream) {
        sshStream.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
      }
      return;
    }

    // Text frames are control messages
    const raw = data.toString();

    // After connection, non-JSON text is also terminal input
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      if (connected && sshStream) {
        sshStream.write(raw);
      }
      return;
    }

    if (msg.type === 'connect' && !connected) {
      handleConnect(ws, msg);
    } else if (msg.type === 'resize' && sshStream) {
      const cols = Math.max(1, Math.min(500, msg.cols || 80));
      const rows = Math.max(1, Math.min(200, msg.rows || 24));
      sshStream.setWindow(rows, cols, rows * 16, cols * 8);
    }
  });

  ws.on('close', () => {
    if (sshStream) sshStream.close();
    if (sshClient) sshClient.end();
    sshClient = null;
    sshStream = null;
  });

  ws.on('error', () => {
    if (sshClient) sshClient.end();
  });

  function handleConnect(ws, msg) {
    const host = String(msg.host || '').trim();
    const port = parseInt(msg.port, 10) || 22;
    const username = String(msg.username || '').trim();
    const password = msg.password || undefined;
    const privateKey = msg.privateKey || undefined;
    const cols = Math.max(1, Math.min(500, msg.cols || 80));
    const rows = Math.max(1, Math.min(200, msg.rows || 24));

    // Input validation
    if (!host || !username) {
      sendError(ws, 'Host and username are required');
      return;
    }
    if (port < 1 || port > 65535) {
      sendError(ws, 'Invalid port number');
      return;
    }
    if (!password && !privateKey) {
      sendError(ws, 'Password or private key is required');
      return;
    }

    const client = new Client();
    sshClient = client;

    const connectTimeout = setTimeout(() => {
      sendError(ws, 'SSH connection timed out');
      client.end();
    }, SSH_TIMEOUT);

    client.on('ready', () => {
      clearTimeout(connectTimeout);
      client.shell({ cols, rows, term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          sendError(ws, `Shell error: ${err.message}`);
          client.end();
          return;
        }

        sshStream = stream;
        connected = true;
        ws.send(JSON.stringify({ type: 'connected' }));

        stream.on('data', (chunk) => {
          if (ws.readyState === 1) {
            ws.send(chunk); // Binary frame
          }
        });

        stream.stderr.on('data', (chunk) => {
          if (ws.readyState === 1) {
            ws.send(chunk); // Stderr also goes to terminal
          }
        });

        stream.on('close', () => {
          connected = false;
          if (ws.readyState === 1) ws.close(1000, 'SSH session closed');
        });
      });
    });

    client.on('error', (err) => {
      clearTimeout(connectTimeout);
      sendError(ws, err.message || 'SSH connection failed');
    });

    client.on('close', () => {
      clearTimeout(connectTimeout);
      connected = false;
      sshStream = null;
      sshClient = null;
    });

    const connectOpts = {
      host,
      port,
      username,
      readyTimeout: SSH_TIMEOUT,
    };

    if (privateKey) {
      connectOpts.privateKey = privateKey;
      // If password is also provided, use it as passphrase for encrypted keys
      if (password) connectOpts.passphrase = password;
    } else {
      connectOpts.password = password;
    }

    try {
      client.connect(connectOpts);
    } catch (err) {
      clearTimeout(connectTimeout);
      sendError(ws, `Connection failed: ${err.message}`);
    }
  }
});

function sendError(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'error', message }));
  }
}
