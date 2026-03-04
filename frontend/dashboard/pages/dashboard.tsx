import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Signal, Prediction, SystemStatus, UserProfile } from "../services/api";
import { tradingWs } from "../services/websocket";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusDotColor(status: string): string {
  switch (status) {
    case "connected":
    case "live":
    case "configured":
    case "not_required":
      return "bg-green-500";
    case "stale":
      return "bg-yellow-400";
    case "error":
      return "bg-red-500";
    default:
      return "bg-blue-400";
  }
}

interface StatusItemProps {
  label: string;
  status: string;
  error?: string | null;
}

function StatusItem({ label, status, error }: StatusItemProps) {
  return (
    <div className="flex flex-col gap-1" title={error ?? undefined}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-800">
        <span className={`inline-block w-2 h-2 rounded-full ${statusDotColor(status)}`} />
        {status}
        {error && (
          <span className="ml-1 text-red-500 text-[10px] truncate max-w-[120px]" title={error}>
            ⚠ {error}
          </span>
        )}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [signalsData, predictionsData, statusData] = await Promise.all([
        api.getSignals(50),
        api.getPredictions(10),
        api.getStatus(),
      ]);
      setSignals(signalsData);
      setPredictions(predictionsData);
      setSystemStatus(statusData);
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }

    // Fetch user profile separately (may fail if no Groww token configured)
    try {
      const userData = await api.getUser();
      setUser(userData);
    } catch {
      // User profile is optional – silently ignore when credentials not configured
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Live updates via WebSocket
  useEffect(() => {
    tradingWs.connect();
    const unsub = tradingWs.onMessage((data) => {
      const msg = data as { type?: string; signal?: Signal };
      if (msg.type === "signal" && msg.signal) {
        setSignals((prev) => [msg.signal!, ...prev].slice(0, 100));
      }
    });
    return () => {
      unsub();
      tradingWs.disconnect();
    };
  }, []);

  const activeSignals = signals.filter((s) => s.priority !== "LOW");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Navbar ── */}
      <nav className="bg-[#1a2035] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-6" />
          </svg>
          <span className="text-white font-bold text-base">TradingAI</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-white border-b-2 border-blue-400 pb-0.5">
            Dashboard
          </Link>
          <Link href="/analytics" className="text-gray-400 hover:text-white transition-colors">
            Analytics
          </Link>
          {user && (
            <div className="flex items-center gap-2 ml-4">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold uppercase">
                {user.name ? user.name.charAt(0) : "?"}
              </div>
              <span className="text-gray-300 text-xs">{user.name}</span>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Page title ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Live Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">High-potential stocks ranked by signal strength</p>
        </div>

        {statusError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {statusError}
          </div>
        )}

        {/* ── System Status ── */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            System Status
          </p>
          {loading ? (
            <div className="text-sm text-gray-400">Checking status…</div>
          ) : systemStatus ? (
            <div className="flex flex-wrap gap-8">
              <StatusItem
                label="Database"
                status={systemStatus.database.status}
                error={systemStatus.database.error}
              />
              <StatusItem
                label="Redis"
                status={systemStatus.redis.status}
                error={systemStatus.redis.error}
              />
              <StatusItem
                label="Auth"
                status={systemStatus.auth.status}
                error={systemStatus.auth.error}
              />
              <StatusItem
                label="Market Data"
                status={systemStatus.market_data.status}
                error={systemStatus.market_data.error}
              />
              <StatusItem
                label="AI"
                status={systemStatus.ai.status}
                error={systemStatus.ai.error}
              />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Last Fetch
                </span>
                <span className="text-xs font-medium text-gray-800">
                  {systemStatus.last_fetch
                    ? new Date(systemStatus.last_fetch).toLocaleTimeString()
                    : "never"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Uptime
                </span>
                <span className="text-xs font-medium text-gray-800">
                  {formatUptime(systemStatus.uptime_seconds)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Groww user card (shown when profile is available) ── */}
        {user && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Groww Account
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Name</span>
                <p className="font-semibold text-gray-900">{user.name}</p>
              </div>
              {user.email && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Email</span>
                  <p className="font-semibold text-gray-900">{user.email}</p>
                </div>
              )}
              {user.client_id && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Client ID</span>
                  <p className="font-semibold text-gray-900">{user.client_id}</p>
                </div>
              )}
              {user.pan && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">PAN</span>
                  <p className="font-semibold text-gray-900">{user.pan}</p>
                </div>
              )}
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Status</span>
                <p className={`font-semibold ${user.is_active ? "text-green-600" : "text-red-500"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Scanner Signals ── */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Scanner Signals{" "}
            <span className="text-gray-400 font-normal text-sm">
              ({activeSignals.length} active)
            </span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : signals.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 italic">
                No signals yet. The scanner will populate this as market data arrives.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Symbol</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Priority</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Score</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {signals.map((signal) => (
                    <tr key={signal.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <Link href={`/stocks/${signal.stock_symbol}`} className="hover:text-blue-600">
                          {signal.stock_symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            signal.priority === "HIGH"
                              ? "bg-red-100 text-red-700"
                              : signal.priority === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {signal.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {signal.rule_score.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Recent Predictions ── */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Predictions</h2>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : predictions.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 italic">
                No predictions yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Symbol</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Entry</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Rule Score</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">AI Score</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {predictions.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        <Link href={`/stocks/${p.stock_symbol}`} className="hover:text-blue-600">
                          {p.stock_symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        ₹{p.entry_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{p.rule_score.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {p.ai_score != null ? p.ai_score.toFixed(1) : <span className="text-gray-400">N/A</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            p.status === "EVALUATED"
                              ? "bg-blue-100 text-blue-700"
                              : p.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(p.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
