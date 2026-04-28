// Stub for Issue #3. Full implementation provided by Issue #2.
// After Issue #2 merges, this file will be replaced with the real implementation.

export async function calcVirtualRateLimit(accountId, plan, logsDir) {
  // Placeholder: returns zero utilization. Real implementation in Issue #2.
  const now = Date.now();
  const HOUR = 3600_000;
  const reset5h = Math.ceil(now / (5 * HOUR)) * (5 * HOUR);
  const d = new Date(now);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const reset7d = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday);

  return {
    window5h: { utilization: 0, resetAt: reset5h, status: 'allowed' },
    weekly: { utilization: 0, resetAt: reset7d, status: 'allowed' },
  };
}
