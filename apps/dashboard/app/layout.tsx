import './globals.css';
import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';

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
          <TopNav />
          {children}
        </div>
      </body>
    </html>
  );
}
