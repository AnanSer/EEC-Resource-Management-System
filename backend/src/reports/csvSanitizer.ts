/**
 * Ethiopian Engineering Corporation (EEC) Resource Management System (RMS)
 * Centralized CSV Sanitization and Escaping Utility (SEC-11)
 *
 * Protects against CSV Injection / Formula Injection (CWE-1236) across all
 * CSV generation and export endpoints.
 *
 * Attack vector:
 * Spreadsheet applications (Microsoft Excel, LibreOffice Calc, Google Sheets)
 * automatically execute cells starting with '=', '+', '-', '@', '\t', or '\r' as
 * dynamic formulas or DDE execution commands (e.g. =cmd|' /C calc'!A0).
 *
 * Remediation:
 * - Neutralizes formula payloads by prepending a single quote (') so spreadsheet
 *   applications treat the content strictly as text literals.
 * - Handles leading whitespace prior to dangerous formula characters.
 * - Carefully distinguishes dangerous payloads from legitimate numbers (integers,
 *   decimals, scientific notation, negative numbers), dates, and normal text (item codes).
 * - Complies strictly with RFC 4180: wraps fields containing quotes, commas, or newlines
 *   in double quotes and escapes existing double quotes as `""`.
 */

const PURE_NUMBER_REGEX = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const DANGEROUS_FORMULA_CHAR_REGEX = /^[\s]*[=@\t\r]/;
const PLUS_MINUS_PREFIX_REGEX = /^[\s]*[+-]/;

/**
 * Sanitizes an individual CSV cell value against formula injection attacks.
 */
export function sanitizeCSVValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }

  // Pure numbers are safe from formula execution
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '';
  }

  // Boolean values are safe
  if (typeof val === 'boolean') {
    return String(val);
  }

  // Date objects are safe
  if (val instanceof Date) {
    return val.toISOString();
  }

  const str = String(val);
  if (!str) {
    return '';
  }

  const trimmed = str.trim();
  if (!trimmed) {
    // If the string only consists of whitespace, but contains \t or \r, neutralize it
    if (str.includes('\t') || str.includes('\r')) {
      return `'${str}`;
    }
    return str;
  }

  // If starts with '=', '@', '\t', '\r' (with or without preceding whitespace), it is an active formula trigger
  if (DANGEROUS_FORMULA_CHAR_REGEX.test(str)) {
    return `'${str}`;
  }

  // If starts with '+' or '-' (with or without preceding whitespace):
  // Verify if the entire trimmed string is a valid numeric value
  if (PLUS_MINUS_PREFIX_REGEX.test(str)) {
    if (PURE_NUMBER_REGEX.test(trimmed)) {
      return str;
    }
    // Non-numeric starting with '+' or '-' (e.g. "-2+3*cmd", "+cmd|...", "  -cmd", "--test")
    return `'${str}`;
  }

  return str;
}

/**
 * Escapes a single CSV field value according to RFC 4180 with CSV formula injection protection.
 * Wraps in double quotes and escapes internal double quotes as `""`.
 */
export function escapeCSV(val: any): string {
  const sanitized = sanitizeCSVValue(val);
  return `"${sanitized.replace(/"/g, '""')}"`;
}
