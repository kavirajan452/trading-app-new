import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Analytics, Prediction } from "../services/api";

interface MetricCardProps {
  label: string;
  value: string | number;
  color: string;
}

function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [analyticsData, predictionsData] = await Promise.all([
        api.getAnalytics(),
        api.getPredictions(100),
      ]);
      setAnalytics(analyticsData);
      setPredictions(predictionsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute win-rate by setup type (prediction status used as setup proxy until
  // a dedicated setup_type field is available on the Prediction model)
  const winsBySetup: Record<string, { wins: number; total: number }> = {};
  predictions.forEach((p) => {
    const setup = p.status;
    if (!winsBySetup[setup]) winsBySetup[setup] = { wins: 0, total: 0 };
    winsBySetup[setup].total += 1;
    if (p.status === "EVALUATED") winsBySetup[setup].wins += 1;
  });

  const setupEntries = Object.entries(winsBySetup);

  const wins = analytics ? Math.round((analytics.win_rate / 100) * analytics.total) : 0;
  const losses = analytics ? Math.round((analytics.loss_rate / 100) * analytics.total) : 0;

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
        <div className="flex gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/analytics" className="text-white border-b-2 border-blue-400 pb-0.5">
            Analytics
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Page title ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Accuracy &amp; performance metrics (last 30 days)</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading analytics…</div>
        ) : (
          <>
            {/* ── Metric cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="Total Predictions"
                value={analytics?.total ?? 0}
                color="text-blue-600"
              />
              <MetricCard
                label="Win Rate"
                value={analytics ? `${analytics.win_rate.toFixed(0)}%` : "0%"}
                color="text-green-500"
              />
              <MetricCard
                label="Wins"
                value={wins}
                color="text-green-500"
              />
              <MetricCard
                label="Losses"
                value={losses}
                color="text-red-500"
              />
            </div>

            {/* ── Chart panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Win Rate by Setup Type */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Win Rate by Setup Type</h3>
                {setupEntries.length === 0 ? (
                  <p className="text-sm text-gray-400">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {setupEntries.map(([setup, stat]) => {
                      const rate = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
                      return (
                        <div key={setup}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span className="font-medium">{setup}</span>
                            <span>{rate.toFixed(0)}% ({stat.total})</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* AI Score vs Outcome */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">AI Score vs Outcome</h3>
                {predictions.filter((p) => p.ai_score != null).length === 0 ? (
                  <p className="text-sm text-gray-400">No data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {predictions
                      .filter((p) => p.ai_score != null)
                      .slice(0, 8)
                      .map((p) => (
                        <div key={p.id} className="flex items-center gap-3 text-xs">
                          <span className="font-semibold w-20 truncate text-gray-700">{p.stock_symbol}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-blue-400 h-2 rounded-full"
                              style={{ width: `${Math.min(100, p.ai_score!)}%` }}
                            />
                          </div>
                          <span className="text-gray-500 w-10 text-right">{p.ai_score!.toFixed(0)}</span>
                          <span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                              p.status === "EVALUATED"
                                ? "bg-blue-100 text-blue-700"
                                : p.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
