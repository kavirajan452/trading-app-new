import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Analytics, Prediction } from "../services/api";
import ScoreBar from "../components/ScoreBar";

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

  const statusColor: Record<string, string> = {
    EVALUATED: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    EXPIRED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">📈 Trading Analytics</h1>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
          <Link href="/analytics" className="text-blue-600">Analytics</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Analytics</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading analytics…</div>
        ) : (
          <>
            {/* Win rate cards */}
            {analytics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {analytics.win_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-700 font-medium mt-1">Win Rate</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                  <div className="text-4xl font-bold text-red-600">
                    {analytics.loss_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-red-700 font-medium mt-1">Loss Rate</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
                  <div className="text-4xl font-bold text-gray-600">
                    {analytics.neutral_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-700 font-medium mt-1">Neutral Rate</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
                  <div className="text-4xl font-bold text-blue-600">
                    {analytics.ai_correlation != null
                      ? `${analytics.ai_correlation.toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-sm text-blue-700 font-medium mt-1">AI Correlation</div>
                </div>
              </div>
            )}

            {/* Win rate visual bar */}
            {analytics && analytics.total > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Outcome Distribution ({analytics.total} total)
                </h3>
                <div className="flex rounded-full overflow-hidden h-6">
                  <div
                    className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${analytics.win_rate}%` }}
                    title={`Win: ${analytics.win_rate.toFixed(1)}%`}
                  >
                    {analytics.win_rate >= 10 ? `${analytics.win_rate.toFixed(0)}%` : ""}
                  </div>
                  <div
                    className="bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold"
                    style={{ width: `${analytics.neutral_rate}%` }}
                    title={`Neutral: ${analytics.neutral_rate.toFixed(1)}%`}
                  >
                    {analytics.neutral_rate >= 10 ? `${analytics.neutral_rate.toFixed(0)}%` : ""}
                  </div>
                  <div
                    className="bg-red-500 flex items-center justify-center text-white text-xs font-bold"
                    style={{ width: `${analytics.loss_rate}%` }}
                    title={`Loss: ${analytics.loss_rate.toFixed(1)}%`}
                  >
                    {analytics.loss_rate >= 10 ? `${analytics.loss_rate.toFixed(0)}%` : ""}
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                    Win
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />
                    Neutral
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    Loss
                  </span>
                </div>
              </div>
            )}

            {/* Predictions history table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold text-gray-800">Prediction History</h3>
              </div>
              {predictions.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No predictions yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Symbol</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Entry</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold w-36">Rule Score</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold w-36">AI Score</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {predictions.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">
                          <Link href={`/stocks/${p.stock_symbol}`} className="hover:text-blue-600">
                            {p.stock_symbol}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          ₹{p.entry_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 w-36">
                          <ScoreBar score={p.rule_score} />
                        </td>
                        <td className="px-4 py-3 w-36">
                          {p.ai_score != null ? (
                            <ScoreBar score={p.ai_score} />
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              statusColor[p.status] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(p.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
