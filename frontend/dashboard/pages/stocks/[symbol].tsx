import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, Quote, Signal, Candle } from "../../services/api";
import PriceDisplay from "../../components/PriceDisplay";
import SignalCard from "../../components/SignalCard";
import ScoreBar from "../../components/ScoreBar";

export default function StockDetailPage() {
  const router = useRouter();
  const symbol = router.query.symbol as string | undefined;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    try {
      const [quoteData, candleData, allSignals] = await Promise.all([
        api.getLiveQuote(symbol),
        api.getHistorical(symbol, "1d"),
        api.getSignals(200),
      ]);
      setQuote(quoteData);
      setCandles(candleData);
      setSignals(allSignals.filter((s) => s.stock_symbol === symbol));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">📈 Trading Analytics</h1>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">Dashboard</Link>
          <Link href="/analytics" className="text-gray-600 hover:text-blue-600">Analytics</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/dashboard" className="text-sm text-blue-500 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </Link>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading {symbol}…</div>
        ) : (
          <>
            {/* Price header */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex items-start justify-between">
              {quote ? (
                <>
                  <PriceDisplay
                    symbol={quote.symbol}
                    ltp={quote.ltp}
                    change={quote.change}
                    changePercent={quote.change_percent}
                  />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600">
                    <span>Open</span>
                    <span className="font-medium text-gray-900">₹{quote.open.toFixed(2)}</span>
                    <span>High</span>
                    <span className="font-medium text-green-600">₹{quote.high.toFixed(2)}</span>
                    <span>Low</span>
                    <span className="font-medium text-red-600">₹{quote.low.toFixed(2)}</span>
                    <span>Volume</span>
                    <span className="font-medium text-gray-900">
                      {quote.volume.toLocaleString("en-IN")}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-gray-400">Live data unavailable</p>
              )}
            </div>

            {/* Candle mini-table */}
            {candles.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold text-gray-800">Recent OHLCV Data (last {Math.min(10, candles.length)} candles)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {["Date", "Open", "High", "Low", "Close", "Volume"].map((h) => (
                          <th key={h} className="text-left px-4 py-2 text-gray-600 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {candles.slice(-10).reverse().map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(c.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">₹{c.open.toFixed(2)}</td>
                          <td className="px-4 py-2 text-green-600">₹{c.high.toFixed(2)}</td>
                          <td className="px-4 py-2 text-red-600">₹{c.low.toFixed(2)}</td>
                          <td className="px-4 py-2 font-medium">₹{c.close.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {c.volume.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Signals for this stock */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                Signals for {symbol} ({signals.length})
              </h3>
              {signals.length === 0 ? (
                <p className="text-gray-400 text-sm">No signals generated yet for this stock.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {signals.slice(0, 9).map((s) => (
                    <SignalCard key={s.id} signal={s} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
