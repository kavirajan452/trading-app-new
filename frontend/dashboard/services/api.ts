const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  is_active: boolean;
  created_at: string;
}

export interface Signal {
  id: number;
  stock_symbol: string;
  timestamp: string;
  rule_score: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  features: Record<string, unknown> | null;
}

export interface Prediction {
  id: number;
  stock_symbol: string;
  timestamp: string;
  entry_price: number;
  rule_score: number;
  ai_score: number | null;
  ai_reason: string | null;
  status: "PENDING" | "EVALUATED" | "EXPIRED";
}

export interface Analytics {
  total: number;
  win_rate: number;
  loss_rate: number;
  neutral_rate: number;
  ai_correlation: number | null;
}

export interface Quote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  change_percent: number;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StatusValue =
  | "connected"
  | "live"
  | "stale"
  | "configured"
  | "not_required"
  | "unchecked"
  | "unknown"
  | "error"
  | "not_installed";

export interface ComponentStatus {
  status: StatusValue;
  error: string | null;
}

export interface SystemStatus {
  database: ComponentStatus;
  redis: ComponentStatus;
  auth: ComponentStatus;
  market_data: ComponentStatus;
  ai: ComponentStatus;
  last_fetch: string | null;
  uptime_seconds: number;
}

export interface UserProfile {
  client_id: string;
  name: string;
  email: string;
  mobile: string;
  pan: string;
  is_active: boolean;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getStocks: () => apiFetch<Stock[]>("/api/stocks"),

  addStock: (stock: { symbol: string; name: string; exchange?: string }) =>
    apiFetch<Stock>("/api/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    }),

  getSignals: (limit = 50) => apiFetch<Signal[]>(`/api/signals?limit=${limit}`),

  getPredictions: (limit = 50) =>
    apiFetch<Prediction[]>(`/api/predictions?limit=${limit}`),

  getAnalytics: () => apiFetch<Analytics>("/api/analytics"),

  getLiveQuote: (symbol: string) =>
    apiFetch<Quote>(`/api/live/${encodeURIComponent(symbol)}`),

  getHistorical: (symbol: string, timeframe = "1d", start?: string, end?: string) => {
    const params = new URLSearchParams({ timeframe });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return apiFetch<Candle[]>(
      `/api/historical/${encodeURIComponent(symbol)}?${params}`
    );
  },

  getStatus: () => apiFetch<SystemStatus>("/api/status"),

  getUser: () => apiFetch<UserProfile>("/api/user"),

  healthCheck: () => apiFetch<{ status: string }>("/health"),
};
