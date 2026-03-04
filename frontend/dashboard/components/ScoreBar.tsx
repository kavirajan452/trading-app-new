interface Props {
  score: number;
  label?: string;
  max?: number;
}

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.75) return "bg-green-500";
  if (pct >= 0.60) return "bg-yellow-400";
  return "bg-red-400";
}

export default function ScoreBar({ score, label, max = 100 }: Props) {
  const pct = Math.min(100, (score / max) * 100);
  const barColor = scoreColor(score, max);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{label}</span>
          <span className="font-semibold">{score.toFixed(1)}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`${barColor} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
