import { SimplePDFDocument, PDFTableColumn } from './pdfGenerator';
import { generateExcelWorkbook } from './xlsxGenerator';

/**
 * Escapes a single CSV field value according to RFC 4180
 * Correctly handles quotes, commas, and newlines.
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates formatted CSV string for Audit Events.
 * Optimized for Microsoft Excel with:
 * - UTF-8 Byte Order Mark (BOM) to prevent character corruption
 * - Standard RFC 4180 escaping
 * - Row 1 column headers so Excel auto-filter immediately works
 * - Zero truncation of text values
 */
export function exportAuditTrailCSV(
  events: any[],
  metadata: {
    generatedAt: string;
    generatedBy: string;
    scopeLabel: string;
    filtersApplied: Record<string, any>;
  }
): string {
  const lines: string[] = [];

  // UTF-8 Byte Order Mark (BOM: \uFEFF) for immediate UTF-8 recognition in Excel
  const BOM = '\uFEFF';

  // Standard Header Row
  const headers = [
    'Timestamp (UTC)',
    'Action Type',
    'Reference ID',
    'Equipment / Resource Name',
    'Item Code',
    'Category',
    'Directorate',
    'Actor Name',
    'Actor Role',
    'Details / Notes',
  ];
  lines.push(headers.map(escapeCSV).join(','));

  // Data Rows
  for (const e of events) {
    const row = [
      e.timestamp ? new Date(e.timestamp).toISOString() : '',
      e.actionType || '',
      e.referenceId || '',
      e.resourceName || '',
      e.resourceCode || '',
      e.resourceCategory || '',
      e.department?.name || '',
      e.actorName || '',
      e.actorRole || '',
      e.details || '',
    ];
    lines.push(row.map(escapeCSV).join(','));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Generates formatted native Microsoft Excel (.xlsx) workbook for Audit Events
 * with styled bold headers, auto-filters, custom column widths, and wrapped text.
 */
export function exportAuditTrailXLSX(
  events: any[],
  metadata: {
    generatedAt: string;
    generatedBy: string;
    scopeLabel: string;
    filtersApplied: Record<string, any>;
  }
): Buffer {
  const columns = [
    { header: 'Date/Time (UTC)', width: 22 },
    { header: 'Action Type', width: 25 },
    { header: 'Reference ID', width: 18 },
    { header: 'Equipment / Resource', width: 32 },
    { header: 'Item Code', width: 16 },
    { header: 'Category', width: 22 },
    { header: 'Directorate', width: 28 },
    { header: 'Officer / Actor', width: 22 },
    { header: 'Role', width: 16 },
    { header: 'Operational Details & Notes', width: 55 },
  ];

  const rows = events.map((e) => [
    e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 19).replace('T', ' ') : '',
    e.actionType ? e.actionType.replace(/_/g, ' ') : '',
    e.referenceId || '',
    e.resourceName || '',
    e.resourceCode || '',
    e.resourceCategory ? e.resourceCategory.replace(/_/g, ' ') : '',
    e.department?.name || '',
    e.actorName || '',
    e.actorRole || '',
    e.details || '',
  ]);

  return generateExcelWorkbook('Audit Trail', columns, rows);
}

/**
 * Generates formatted PDF document for Audit Events
 * - Landscape Letter (792x612)
 * - Calibrated sensible column widths matching 720pt printable area
 * - Word-wrapped cells with zero truncation
 * - Dynamic row heights
 * - Repeated table headers on every page
 */
export function exportAuditTrailPDF(
  events: any[],
  metadata: {
    generatedAt: string;
    generatedBy: string;
    scopeLabel: string;
    filtersApplied: Record<string, any>;
  }
): Buffer {
  const doc = new SimplePDFDocument(
    'RESOURCE AUDIT TRAIL REPORT',
    'Official corporate audit log of asset transactions and custody history',
    { orientation: 'landscape', margin: 36 }
  );

  // Filters summary string
  const activeFilters = Object.entries(metadata.filtersApplied)
    .filter(([_, v]) => v && v !== 'ALL')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ') || 'None (All Records)';

  // Header Block
  doc.drawHeaderBlock(
    'Corporate Audit Trail & Verification Ledger',
    'Comprehensive chronological record of physical asset custody, maintenance, and lifecycle events',
    [
      { label: 'Generated', value: metadata.generatedAt.slice(0, 19).replace('T', ' ') },
      { label: 'Auditor', value: metadata.generatedBy },
      { label: 'Scope', value: metadata.scopeLabel },
      { label: 'Records', value: String(events.length) },
      { label: 'Filters', value: activeFilters.slice(0, 35) },
    ]
  );

  // Column widths total: 70 + 85 + 65 + 125 + 80 + 95 + 200 = 720 pt (exact printable width)
  const columns: PDFTableColumn[] = [
    { header: 'Date / Time', width: 70 },
    { header: 'Action Type', width: 85, bold: true },
    { header: 'Reference ID', width: 65 },
    { header: 'Equipment / Resource', width: 125 },
    { header: 'Directorate', width: 80 },
    { header: 'Officer / Actor', width: 95 },
    { header: 'Operational Details & Notes', width: 200 },
  ];

  const rows = events.map((e) => [
    e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '—',
    e.actionType ? e.actionType.replace(/_/g, ' ') : '—',
    e.referenceId || '—',
    `${e.resourceName || 'Unknown'}${e.resourceCode ? ` (${e.resourceCode})` : ''}`,
    e.department?.name || e.department?.code || '—',
    `${e.actorName || 'Officer'}${e.actorRole ? ` [${e.actorRole}]` : ''}`,
    e.details || '—',
  ]);

  doc.drawTable(columns, rows, {
    fontSize: 6.5,
    lineHeight: 8.5,
    cellPadding: 4,
    headerHeight: 16,
  });

  return doc.toBuffer();
}

/**
 * Generates formatted PDF dossier for a single Resource Lifecycle History
 * - Landscape Letter (792x612)
 * - Calibrated sensible column widths matching 720pt printable area
 * - Word-wrapped cells with zero truncation
 * - Dynamic row heights
 * - Repeated table headers on every page
 */
export function exportResourceLifecyclePDF(
  resource: any,
  events: any[],
  metadata: {
    generatedAt: string;
    generatedBy: string;
  }
): Buffer {
  const doc = new SimplePDFDocument(
    `RESOURCE LIFECYCLE DOSSIER: ${resource.itemCode}`,
    'Full chronological audit trail from registration to current state',
    { orientation: 'landscape', margin: 36 }
  );

  doc.drawHeaderBlock(
    `Asset Dossier: ${resource.name}`,
    `Item Code: ${resource.itemCode} • Category: ${resource.category} • Directorate: ${resource.departmentName || 'N/A'}`,
    [
      { label: 'Item Code', value: resource.itemCode },
      { label: 'Status', value: resource.status },
      { label: 'Condition', value: resource.condition },
      { label: 'Location', value: resource.location || 'Central Store' },
      { label: 'Current Custodian', value: resource.currentAssigneeName || 'In Store' },
      { label: 'Purchase Cost', value: `${resource.purchaseCostETB?.toLocaleString() || 0} ETB` },
    ]
  );

  // Column widths total: 75 + 105 + 75 + 105 + 90 + 270 = 720 pt (exact printable width)
  const columns: PDFTableColumn[] = [
    { header: 'Date & Time', width: 75 },
    { header: 'Lifecycle Event', width: 105, bold: true },
    { header: 'Reference ID', width: 75 },
    { header: 'Responsible Officer', width: 105 },
    { header: 'Directorate', width: 90 },
    { header: 'Historical Details & Notes', width: 270 },
  ];

  const rows = events.map((e) => [
    e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '—',
    e.actionType ? e.actionType.replace(/_/g, ' ') : '—',
    e.referenceId || '—',
    `${e.actorName || 'Staff'}${e.actorRole ? ` [${e.actorRole}]` : ''}`,
    e.department?.name || e.department?.code || resource.departmentCode || '—',
    e.details || '—',
  ]);

  doc.drawTable(columns, rows, {
    fontSize: 6.5,
    lineHeight: 8.5,
    cellPadding: 4,
    headerHeight: 16,
  });

  return doc.toBuffer();
}
