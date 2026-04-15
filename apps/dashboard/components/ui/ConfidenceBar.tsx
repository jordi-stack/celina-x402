interface Props {
  score: number;
  label?: string;
  className?: string;
}

function tintFromScore(score: number): { fill: string; text: string; track: string } {
  if (score >= 0.7)
    return {
      fill: 'bg-emerald-500',
      text: 'text-emerald-400',
      track: 'bg-emerald-950',
    };
  if (score >= 0.4)
    return {
      fill: 'bg-amber-500',
      text: 'text-amber-400',
      track: 'bg-amber-950',
    };
  return {
    fill: 'bg-rose-500',
    text: 'text-rose-400',
    track: 'bg-rose-950',
  };
}

export function ConfidenceBar({ score, label, className = '' }: Props) {
  const clamped = Math.max(0, Math.min(1, score));
  const pct = Math.round(clamped * 100);
  const tint = tintFromScore(clamped);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className={`text-[10px] uppercase tracking-wide font-medium ${tint.text}`}>
          {label}
        </span>
      )}
      <div className={`relative h-1.5 w-20 rounded-full overflow-hidden ${tint.track}`}>
        <div
          className={`absolute inset-y-0 left-0 ${tint.fill} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${tint.text}`}>{pct}%</span>
    </div>
  );
}
