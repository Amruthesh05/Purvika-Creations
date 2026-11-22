import { Printer } from 'lucide-react';

const notice = 'Every piece is custom printed when your order arrives, so allow a little extra time before it reaches you. It would take roughly 6–7 days from the date of order to receive your product in Bangalore, 8–10 days outside Bangalore.';

function NoticeContent() {
  return (
    <span className="inline-flex shrink-0 items-center gap-3 px-8 text-sm font-medium text-amber-900 sm:text-base">
      <Printer className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <span className="font-semibold">Custom printed for you</span>
      <span className="text-amber-800">{notice}</span>
      <span className="text-amber-500" aria-hidden="true">•</span>
    </span>
  );
}

export function CustomPrintNotice() {
  return (
    <aside className="custom-print-notice border-y border-amber-200 bg-amber-50 py-3" aria-label="Custom printing and delivery notice">
      <div className="overflow-hidden">
        <div className="custom-print-track flex w-max">
          <NoticeContent />
          <span aria-hidden="true"><NoticeContent /></span>
        </div>
      </div>
    </aside>
  );
}
