interface Props {
  ltp: number;
  change: number;
  changePercent: number;
  symbol: string;
}

export default function PriceDisplay({ ltp, change, changePercent, symbol }: Props) {
  const isPositive = change >= 0;
  const sign = isPositive ? "+" : "";
  const colorClass = isPositive ? "text-green-600" : "text-red-600";

  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">
        {symbol}
      </span>
      <span className="text-3xl font-bold text-gray-900">
        ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </span>
      <span className={`text-sm font-semibold ${colorClass}`}>
        {sign}
        {change.toFixed(2)} ({sign}
        {changePercent.toFixed(2)}%)
      </span>
    </div>
  );
}
