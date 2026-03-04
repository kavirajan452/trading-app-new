const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export type WsMessageHandler = (data: unknown) => void;

export class TradingWebSocket {
  private ws: WebSocket | null = null;
  private handlers: WsMessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  connect(): void {
    if (typeof window === "undefined") return;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.info("[WS] Connected to", WS_URL);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(event.data as string);
        this.handlers.forEach((h) => h(data));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = (err) => {
      console.warn("[WS] Error", err);
    };

    this.ws.onclose = () => {
      console.info("[WS] Disconnected");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };
  }

  onMessage(handler: WsMessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}

export const tradingWs = new TradingWebSocket();
