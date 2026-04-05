import { WebSocket as NodeWebSocket } from "ws";

export type RuntimeWebSocketCtor = typeof WebSocket;

export function resolveRuntimeWebSocketCtor(
  globalWebSocket: RuntimeWebSocketCtor | undefined = globalThis.WebSocket
): RuntimeWebSocketCtor {
  return globalWebSocket ?? (NodeWebSocket as unknown as RuntimeWebSocketCtor);
}
