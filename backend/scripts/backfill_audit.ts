/**
 * Ethiopian Engineering Corporation (EEC) Resource Management System (RMS)
 * Standalone Maintenance Script: Idempotent Historical Audit Events Backfill (SEC-05)
 * 
 * Usage:
 *   npx tsx scripts/backfill_audit.ts
 * 
 * Purpose:
 *   Backfills existing resources, assignments, transfers, maintenance requests,
 *   and inspections into the centralized AuditEvent table if corresponding events
 *   are missing.
 * 
 * Safety:
 *   - Idempotent: checks for existence before creating any records to avoid duplicates.
 *   - Never called during server startup or standard API request execution.
 *   - Safe to execute multiple times against existing databases without record rewriting.
 */

import prisma from '../src/lib/prisma';
import { backfillHistoricalAuditEvents } from '../src/audit/audit.service';

async function main() {
  console.log('================================================================');
  console.log('EEC RMS: Explicit Historical Audit Backfill Maintenance Script');
  console.log('================================================================');

  const auditCountBefore = await prisma.auditEvent.count();
  console.log(`[Backfill] Initial audit events count: ${auditCountBefore}`);

  console.log('[Backfill] Running idempotent historical audit events backfill...');
  await backfillHistoricalAuditEvents();

  const auditCountAfter = await prisma.auditEvent.count();
  console.log(`[Backfill] Final audit events count: ${auditCountAfter}`);
  console.log(`[Backfill] Net new events added: ${auditCountAfter - auditCountBefore}`);
  console.log('[Backfill] Maintenance backfill completed successfully.');
}

if (process.argv[1]?.endsWith('backfill_audit.ts') || process.argv[1]?.endsWith('backfill_audit.js')) {
  main()
    .catch((err) => {
      console.error('[Backfill Error]', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

