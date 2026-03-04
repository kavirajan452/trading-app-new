import type { Signal } from "../services/api";

interface Props {
  signal: Signal;
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "border-red-500 bg-red-50",
  MEDIUM: "border-yellow-500 bg-yellow-50",
  LOW: "border-gray-300 bg-white",
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-gray-100 text-gray-600",
};

export default function SignalCard({ signal }: Props) {
  const borderClass = PRIORITY_COLORS[signal.priority] ?? PRIORITY_COLORS.LOW;
  const badgeClass = PRIORITY_BADGE[signal.priority] ?? PRIORITY_BADGE.LOW;
  const time = new Date(signal.timestamp).toLocaleTimeString();

  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${borderClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-lg tracking-wide">{signal.stock_symbol}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {signal.priority}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
        <span>Rule Score</span>
        <span className="font-semibold text-gray-900">{signal.rule_score.toFixed(1)}</span>
      </div>
      {signal.features && (
        <div className="text-xs text-gray-500 space-y-0.5">
          {Object.entries(signal.features).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="capitalize">{k.replace(/_/g, " ")}</span>
              <span>{typeof v === "number" ? v.toFixed(2) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-xs text-gray-400 text-right">{time}</div>
    </div>
  );
}
