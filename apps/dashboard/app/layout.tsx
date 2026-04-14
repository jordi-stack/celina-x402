import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Celina - Onchain Intelligence Agent',
  description:
    'Goal-directed agent that pays for onchain research via x402 on X Layer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
          <header className="mb-8 flex items-baseline gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Celina</h1>
            <span className="text-sm text-neutral-400">
              onchain intelligence agent on X Layer
            </span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
