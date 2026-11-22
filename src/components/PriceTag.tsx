import { classNames, formatINR } from '@/lib/utils';
import { percentOff } from '@/lib/pricing';

interface PriceTagProps {
  pricePaise: number;
  mrpPaise?: number | null;
  size?: 'md' | 'lg';
  className?: string;
}

export function PriceTag({ pricePaise, mrpPaise, size = 'md', className }: PriceTagProps) {
  const off = percentOff(pricePaise, mrpPaise);
  return (
    <div className={classNames('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {mrpPaise != null && mrpPaise > pricePaise && (
        <span className="text-xs font-medium text-text-muted line-through">{formatINR(mrpPaise)}</span>
      )}
      <span className={classNames('font-bold text-flame-400', size === 'lg' ? 'text-3xl' : 'text-lg')}>
        {formatINR(pricePaise)}
      </span>
      {off > 0 && (
        <span className="rounded-md bg-flame-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-flame-300 ring-1 ring-flame-500/30">
          {off}% off
        </span>
      )}
    </div>
  );
}
