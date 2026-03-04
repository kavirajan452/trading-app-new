import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Signal } from "../services/api";
import { tradingWs } from "../services/websocket";
import SignalCard from "../components/SignalCard";
import ScoreBar from "../components/ScoreBar";

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      const data = await api.getSignals(50);
      setSignals(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 10_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

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

  const high = signals.filter((s) => s.priority === "HIGH");
  const medium = signals.filter((s) => s.priority === "MEDIUM");
  const low = signals.filter((s) => s.priority === "LOW");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">📈 Trading Analytics</h1>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard" className="text-blue-600">Dashboard</Link>
          <Link href="/analytics" className="text-gray-600 hover:text-blue-600">Analytics</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{high.length}</div>
            <div className="text-sm text-red-700 font-medium">HIGH Priority</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{medium.length}</div>
            <div className="text-sm text-yellow-700 font-medium">MEDIUM Priority</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-600">{low.length}</div>
            <div className="text-sm text-gray-700 font-medium">LOW Priority</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {lastUpdated && (
          <p className="text-xs text-gray-400 mb-4">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading signals…</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No signals yet. Add stocks to your watchlist.</div>
        ) : (
          <>
            {/* Full signals table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Symbol</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Priority</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold w-48">Rule Score</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                              ? "bg-red-100 text-red-800"
                              : signal.priority === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {signal.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-48">
                        <ScoreBar score={signal.rule_score} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/stocks/${signal.stock_symbol}`}
                          className="text-blue-500 hover:underline text-xs"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signal cards for HIGH priority */}
            {high.length > 0 && (
              <>
                <h2 className="text-lg font-bold text-gray-800 mb-3">🔴 High Priority Signals</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {high.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
