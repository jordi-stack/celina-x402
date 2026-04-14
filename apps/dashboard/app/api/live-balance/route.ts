import { NextResponse } from 'next/server';
import { OKXMCPClient } from '@x402/mcp-client';
import { OKX_MCP_ENDPOINT, USDG_CONTRACT } from '@x402/shared';

export const dynamic = 'force-dynamic';

interface WalletBalance {
  label: string;
  address: string;
  usdg: string | null;
  rawUsdg: string | null;
  error: string | null;
  fetchedAt: number;
}

let clientInstance: OKXMCPClient | null = null;

function getClient(): OKXMCPClient {
  if (!clientInstance) {
    const apiKey = process.env.OKX_API_KEY;
    if (!apiKey) {
      throw new Error('OKX_API_KEY not set');
    }
    clientInstance = new OKXMCPClient({
      url: OKX_MCP_ENDPOINT,
      apiKey,
      timeoutMs: 8_000,
    });
  }
  return clientInstance;
}

async function fetchBalance(label: string, address: string): Promise<WalletBalance> {
  const fetchedAt = Date.now();
  try {
    const data = await getClient().getTotalTokenBalances({
      chains: '196',
      address,
    });
    const usdg = data.tokenAssets.find(
      (a) => a.tokenContractAddress.toLowerCase() === USDG_CONTRACT.toLowerCase()
    );
    return {
      label,
      address,
      usdg: usdg?.balance ?? '0',
      rawUsdg: usdg?.rawBalance ?? '0',
      error: null,
      fetchedAt,
    };
  } catch (err) {
    return {
      label,
      address,
      usdg: null,
      rawUsdg: null,
      error: (err as Error).message,
      fetchedAt,
    };
  }
}

export async function GET() {
  const consumerAddress = process.env.CONSUMER_ADDRESS;
  const producerAddress = process.env.PRODUCER_ADDRESS;

  if (!consumerAddress || !producerAddress) {
    return NextResponse.json(
      { error: 'CONSUMER_ADDRESS or PRODUCER_ADDRESS not set in env' },
      { status: 500 }
    );
  }

  const [consumer, producer] = await Promise.all([
    fetchBalance('Consumer', consumerAddress),
    fetchBalance('Producer', producerAddress),
  ]);

  return NextResponse.json({
    consumer,
    producer,
    source: 'dex-okx-balance-total-token-balances',
    chain: 'X Layer (196)',
    token: 'USDG',
  });
}
