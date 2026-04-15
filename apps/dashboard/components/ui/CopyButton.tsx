'use client';

import { useState } from 'react';

interface Props {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label, className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can fail in http:// dev contexts; fall back to selection hint
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy ${label ?? 'value'}`}
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition ${
        copied ? 'text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
      } ${className}`}
    >
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8.5L6.5 12L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4.5" y="4.5" width="8" height="9" rx="1" />
            <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" />
          </svg>
          copy
        </>
      )}
    </button>
  );
}
