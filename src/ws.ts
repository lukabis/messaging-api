import { WebSocket, WebSocketServer } from "ws";
import { createRemoteJWKSet, jwtVerify } from "jose";

const WS_CLOSE_POLICY_VIOLATION = 1008;
export const clients = new Map<string, WebSocket>();

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
);

export function setupWs(wss: WebSocketServer) {
  wss.on("connection", async (socket, req) => {
    // "http://x" is a throwaway base — req.url is path-only, URL() needs a full URL to parse
    const token = new URL(req.url!, "http://x").searchParams.get("token");

    if (!token) {
      socket.close(WS_CLOSE_POLICY_VIOLATION, "Missing token");
      return;
    }

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      });

      if (!payload.sub) throw new Error("Missing sub");
      userId = payload.sub;
    } catch {
      socket.close(WS_CLOSE_POLICY_VIOLATION, "Invalid token");
      return;
    }

    clients.set(userId, socket);

    socket.on("close", () => {
      clients.delete(userId);
    });
  });
}
