/**
 * GET /api/v9/inworld-stt-ws?token=<hmac-proxy-token>
 *
 * WebSocket proxy for the Inworld STT realtime endpoint.
 *
 * This Pages Router API route (not App Router) is required because App Router
 * route handlers do not have access to the raw Node.js socket needed to
 * perform an HTTP → WebSocket upgrade.  The Pages Router exposes
 * `res.socket` which is the underlying net.Socket, enabling low-level
 * protocol switching.
 *
 * Auth flow:
 *   1. Browser fetches a short-lived HMAC proxy token from
 *      GET /api/v9/inworld-stt-token (type: 'proxy').
 *   2. Browser opens: new WebSocket('/api/v9/inworld-stt-ws?token=<hmac>')
 *   3. This route validates the HMAC token, upgrades the HTTP connection,
 *      opens a TLS socket to api.inworld.ai:443, sends an HTTP/1.1 Upgrade
 *      request with Authorization: Basic <INWORLD_API_KEY>, and pipes
 *      both sockets bidirectionally once Inworld responds with 101.
 *
 * INWORLD_API_KEY never appears in any browser-visible response or frame.
 *
 * Only used when Inworld does not provide its own token-issuance endpoint.
 * If GET /api/v9/inworld-stt-token returns type: 'inworld', the hook
 * bypasses this route and connects directly to Inworld's WebSocket.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import tls from 'tls';

export const config = { api: { bodyParser: false } };

const TOKEN_TTL_MS = 60_000;
const INWORLD_WS_HOST = 'api.inworld.ai';
const INWORLD_WS_PATH = '/v1/stt/transcribe:stream';

function verifyProxyToken(token: string, secret: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    // Format: <userId>:<exp>:<hmac>
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon < 0) return null;
    const hmac = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);

    const secondLastColon = payload.lastIndexOf(':');
    if (secondLastColon < 0) return null;
    const expStr = payload.slice(secondLastColon + 1);
    const userId = payload.slice(0, secondLastColon);

    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() > exp) return null;
    if (Date.now() + TOKEN_TTL_MS * 2 < exp) return null; // issued too far in the future

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    // Constant-time compare (pad to same length to avoid length side-channel)
    const a = Buffer.from(hmac.padEnd(64, '0'));
    const b = Buffer.from(expected.padEnd(64, '0'));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    return userId;
  } catch {
    return null;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
    res.status(426).json({ error: 'WebSocket upgrade required' });
    return;
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const apiKey = process.env.INWORLD_API_KEY;

  if (!apiKey) {
    console.error('[InworldSttWs] INWORLD_API_KEY not configured');
    req.socket?.destroy();
    return;
  }

  const secret = process.env.INWORLD_JWT_SECRET ?? apiKey;
  const userId = verifyProxyToken(token, secret);
  if (!userId) {
    console.warn('[InworldSttWs] Invalid or expired proxy token');
    req.socket?.destroy();
    return;
  }

  const clientSocket = req.socket;
  if (!clientSocket) return;

  clientSocket.setTimeout(0);
  clientSocket.setNoDelay(true);
  clientSocket.setKeepAlive(true, 30_000);

  // Build the HTTP/1.1 Upgrade request to send upstream.
  const wsKey = crypto.randomBytes(16).toString('base64');
  const upgradeRequest = [
    `GET ${INWORLD_WS_PATH} HTTP/1.1`,
    `Host: ${INWORLD_WS_HOST}`,
    `Authorization: Basic ${apiKey}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${wsKey}`,
    'Sec-WebSocket-Version: 13',
    '',
    '',
  ].join('\r\n');

  const backendSocket = tls.connect({
    host: INWORLD_WS_HOST,
    port: 443,
    servername: INWORLD_WS_HOST,
  });

  backendSocket.once('secureConnect', () => {
    backendSocket.write(upgradeRequest);
  });

  // Wait for the 101 Switching Protocols from Inworld.
  backendSocket.once('data', (data: Buffer) => {
    const responseHead = data.toString('utf8', 0, Math.min(data.length, 256));
    if (!responseHead.includes('101')) {
      console.error('[InworldSttWs] Inworld did not return 101:', responseHead.slice(0, 100));
      clientSocket.destroy();
      backendSocket.destroy();
      return;
    }

    // Relay 101 to the browser.
    clientSocket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    );

    // Pipe bidirectionally.
    clientSocket.pipe(backendSocket);
    backendSocket.pipe(clientSocket);

    const cleanup = () => {
      clientSocket.unpipe(backendSocket);
      backendSocket.unpipe(clientSocket);
      backendSocket.destroy();
      clientSocket.destroy();
    };
    clientSocket.on('error', cleanup);
    clientSocket.on('close', cleanup);
    backendSocket.on('error', cleanup);
    backendSocket.on('close', cleanup);
  });

  backendSocket.on('error', (err) => {
    console.error('[InworldSttWs] Backend socket error:', err.message);
    clientSocket.destroy();
  });
}
