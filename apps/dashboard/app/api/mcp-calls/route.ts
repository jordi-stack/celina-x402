import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface McpCallRow {
  id: number;
  timestamp: number;
  tool: string;
  duration_ms: number;
  success: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, timestamp, tool, duration_ms, success
       FROM mcp_calls
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(limit) as McpCallRow[];

  const stats = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
         AVG(duration_ms) as avg_duration_ms
       FROM mcp_calls`
    )
    .get() as { total: number; success_count: number; avg_duration_ms: number | null };

  const byTool = db
    .prepare(
      `SELECT tool, COUNT(*) as count
       FROM mcp_calls
       GROUP BY tool
       ORDER BY count DESC`
    )
    .all() as Array<{ tool: string; count: number }>;

  return NextResponse.json({
    calls: rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      tool: r.tool,
      durationMs: r.duration_ms,
      success: Boolean(r.success),
    })),
    stats: {
      total: stats.total,
      successCount: stats.success_count ?? 0,
      successRate: stats.total > 0 ? (stats.success_count ?? 0) / stats.total : 0,
      avgDurationMs: stats.avg_duration_ms ?? 0,
    },
    byTool,
  });
}
