import type { ReactNode } from 'react';

export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
      <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

export function ErrorState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-100 bg-red-50 p-8 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
