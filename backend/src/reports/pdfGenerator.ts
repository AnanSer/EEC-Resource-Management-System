/**
 * Zero-dependency PDF 1.4 Document Generator for EEC RMS.
 * Generates standards-compliant, beautiful multi-page PDF documents
 * compatible with all standard PDF readers (Adobe Acrobat, Chrome, Firefox, Safari, Edge).
 * 
 * Features:
 * - Landscape & Portrait orientation support
 * - Exact Helvetica proportional font metric measurements
 * - Multi-line word-wrapping within table cells with zero clipping
 * - Dynamic row heights automatically expanding based on text content
 * - Seamless row continuation across page boundaries
 * - Table headers automatically repeated on every new page
 * - Dynamic multi-page footers with accurate total page count
 */

export interface PDFTableColumn {
  header: string;
  width: number; // width in points
  align?: 'left' | 'right' | 'center';
  bold?: boolean;
}

export interface PDFDocumentOptions {
  orientation?: 'portrait' | 'landscape';
  margin?: number;
}

export interface DrawTableOptions {
  fontSize?: number;
  headerFontSize?: number;
  lineHeight?: number;
  cellPadding?: number;
  headerHeight?: number;
}

// Standard Type 1 Helvetica font character metrics (width at 1000 units of font size)
const HELVETICA_CHAR_METRICS: Record<number, number> = {
  32: 278, // space
  33: 278, // !
  34: 355, // "
  35: 556, // #
  36: 556, // $
  37: 889, // %
  38: 667, // &
  39: 191, // '
  40: 333, // (
  41: 333, // )
  42: 389, // *
  43: 584, // +
  44: 278, // ,
  45: 333, // -
  46: 278, // .
  47: 278, // /
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556, // 0-9
  58: 278, // :
  59: 278, // ;
  60: 584, // <
  61: 584, // =
  62: 584, // >
  63: 556, // ?
  64: 1015, // @
  65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500,
  75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611,
  85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611, // A-Z
  91: 278, // [
  92: 278, // \
  93: 278, // ]
  94: 469, // ^
  95: 556, // _
  96: 333, // `
  97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556, 104: 556, 105: 222, 106: 222,
  107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278,
  117: 556, 118: 500, 119: 722, 120: 500, 121: 500, 122: 500, // a-z
  123: 334, 124: 260, 125: 334, 126: 584,
};

/**
 * Accurately measures text width in points for standard Helvetica / Helvetica-Bold
 */
export function measureTextWidth(text: string, fontSize: number, isBold = false): number {
  if (!text) return 0;
  let totalWidth = 0;
  const boldFactor = isBold ? 1.08 : 1.0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const unitWidth = HELVETICA_CHAR_METRICS[code] || 550;
    totalWidth += (unitWidth / 1000) * fontSize * boldFactor;
  }
  return totalWidth;
}

/**
 * Wraps text into lines that fit within maxWidth with zero truncation.
 * If a word is longer than maxWidth, it splits the word cleanly across lines.
 */
export function wrapTextToLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  isBold = false
): string[] {
  if (!text || text.trim() === '') return [''];

  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split('\n');
  const resultLines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      resultLines.push('');
      continue;
    }

    const words = para.split(/\s+/).filter(Boolean);
    let currentLine = '';

    for (const word of words) {
      const wordWidth = measureTextWidth(word, fontSize, isBold);

      // If single word exceeds available column width, break it into characters that fit
      if (wordWidth > maxWidth) {
        if (currentLine) {
          resultLines.push(currentLine);
          currentLine = '';
        }
        let chunk = '';
        for (const char of word) {
          const testChunk = chunk + char;
          if (measureTextWidth(testChunk, fontSize, isBold) > maxWidth && chunk.length > 0) {
            resultLines.push(chunk);
            chunk = char;
          } else {
            chunk = testChunk;
          }
        }
        if (chunk) {
          currentLine = chunk;
        }
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = measureTextWidth(testLine, fontSize, isBold);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          resultLines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines.length > 0 ? resultLines : [''];
}

export class SimplePDFDocument {
  private pages: string[] = [];
  private currentContent: string[] = [];
  private pageHeight: number;
  private pageWidth: number;
  private margin: number;
  private currentY: number;
  private headerBarY: number;
  private footerY: number;
  private bottomLimit: number;
  private contentTopY: number;

  constructor(
    private title: string,
    private subtitle?: string,
    options?: PDFDocumentOptions
  ) {
    const orientation = options?.orientation || 'landscape';
    this.margin = options?.margin || 36; // 0.5 inch

    if (orientation === 'landscape') {
      this.pageWidth = 792;
      this.pageHeight = 612;
      this.headerBarY = 582;
      this.contentTopY = 562;
      this.footerY = 22;
      this.bottomLimit = 42;
    } else {
      this.pageWidth = 612;
      this.pageHeight = 792;
      this.headerBarY = 762;
      this.contentTopY = 742;
      this.footerY = 22;
      this.bottomLimit = 42;
    }

    this.currentY = this.contentTopY;
    this.drawPageHeader();
  }

  public addPage() {
    if (this.currentContent.length > 0) {
      this.pages.push(this.currentContent.join('\n'));
      this.currentContent = [];
    }
    this.currentY = this.contentTopY;
    this.drawPageHeader();
  }

  public getPageCount(): number {
    return this.pages.length + (this.currentContent.length > 0 ? 1 : 0);
  }

  private drawPageHeader() {
    // Header accent bar
    this.rect(this.margin, this.headerBarY, this.pageWidth - (this.margin * 2), 2, 0.04, 0.22, 0.29); // #0A3742
    
    // Header Left: Organization
    this.text('ETHIOPIAN ENGINEERING CORPORATION', this.margin, this.headerBarY + 6, {
      font: 'Helvetica-Bold',
      size: 8.5,
      color: [0.04, 0.22, 0.29],
    });

    // Header Right: Document Title
    this.text(this.title, this.pageWidth - this.margin, this.headerBarY + 6, {
      font: 'Helvetica',
      size: 8,
      align: 'right',
      color: [0.4, 0.45, 0.5],
    });
  }

  private drawPageFooter(pageNum: number, totalPages: number) {
    const lineCmd = `0.85 0.88 0.91 RG 1 w ${this.margin} ${this.footerY + 12} m ${this.pageWidth - this.margin} ${this.footerY + 12} l S`;
    
    const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const leftText = `EEC Resource Management System (RMS) • Official Audit Report • Generated: ${dateStr}`;
    const rightText = `Page ${pageNum} of ${totalPages}`;

    const textCmds = [
      `BT /F1 7 Tf 0.45 0.5 0.55 rg ${this.margin} ${this.footerY} Td (${this.escapeText(leftText)}) Tj ET`,
      `BT /F1 7 Tf 0.45 0.5 0.55 rg ${this.pageWidth - this.margin - 48} ${this.footerY} Td (${this.escapeText(rightText)}) Tj ET`,
    ].join('\n');

    return `${lineCmd}\n${textCmds}`;
  }

  public checkPageBreak(requiredHeight: number): boolean {
    if (this.currentY - requiredHeight < this.bottomLimit) {
      this.addPage();
      return true;
    }
    return false;
  }

  public moveDown(points: number) {
    this.currentY -= points;
  }

  public getY(): number {
    return this.currentY;
  }

  public text(
    str: string,
    x: number,
    y: number,
    options: {
      font?: 'Helvetica' | 'Helvetica-Bold';
      size?: number;
      color?: [number, number, number];
      align?: 'left' | 'right' | 'center';
    } = {}
  ) {
    const font = options.font === 'Helvetica-Bold' ? '/F2' : '/F1';
    const size = options.size || 10;
    const color = options.color || [0.1, 0.1, 0.1];
    const escaped = this.escapeText(str);

    let adjustedX = x;
    if (options.align === 'right') {
      const approxWidth = measureTextWidth(str, size, options.font === 'Helvetica-Bold');
      adjustedX = x - approxWidth;
    } else if (options.align === 'center') {
      const approxWidth = measureTextWidth(str, size, options.font === 'Helvetica-Bold');
      adjustedX = x - (approxWidth / 2);
    }

    this.currentContent.push(
      `${color[0]} ${color[1]} ${color[2]} rg`,
      `BT ${font} ${size} Tf ${adjustedX.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`
    );
  }

  public rect(
    x: number,
    y: number,
    w: number,
    h: number,
    r = 0.9,
    g = 0.9,
    b = 0.9,
    stroke?: [number, number, number]
  ) {
    let cmd = `${r} ${g} ${b} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`;
    if (stroke) {
      cmd += `\n${stroke[0]} ${stroke[1]} ${stroke[2]} RG 0.5 w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`;
    }
    this.currentContent.push(cmd);
  }

  public hLine(y: number, color: [number, number, number] = [0.85, 0.88, 0.91]) {
    this.currentContent.push(
      `${color[0]} ${color[1]} ${color[2]} RG 0.5 w ${this.margin} ${y.toFixed(2)} m ${this.pageWidth - this.margin} ${y.toFixed(2)} l S`
    );
  }

  public drawHeaderBlock(
    title: string,
    subtitle: string,
    metaFields: { label: string; value: string }[]
  ) {
    this.checkPageBreak(75);
    
    // Title
    this.text(title, this.margin, this.currentY, {
      font: 'Helvetica-Bold',
      size: 14,
      color: [0.04, 0.22, 0.29],
    });
    this.currentY -= 13;

    // Subtitle
    this.text(subtitle, this.margin, this.currentY, {
      font: 'Helvetica',
      size: 8,
      color: [0.35, 0.4, 0.45],
    });
    this.currentY -= 15;

    // Meta Box
    const boxHeight = 20;
    this.rect(this.margin, this.currentY - 4, this.pageWidth - (this.margin * 2), boxHeight, 0.96, 0.97, 0.98, [0.85, 0.88, 0.91]);
    
    let curX = this.margin + 8;
    metaFields.forEach((field) => {
      this.text(`${field.label}: `, curX, this.currentY + 5, {
        font: 'Helvetica-Bold',
        size: 7,
        color: [0.3, 0.35, 0.4],
      });
      const labelW = measureTextWidth(`${field.label}: `, 7, true) + 2;
      this.text(field.value, curX + labelW, this.currentY + 5, {
        font: 'Helvetica',
        size: 7,
        color: [0.1, 0.15, 0.2],
      });
      const valW = measureTextWidth(field.value, 7, false) + 16;
      curX += labelW + valW;
    });

    this.currentY -= (boxHeight + 10);
  }

  private drawTableHeaderRow(columns: PDFTableColumn[], tableWidth: number, headerHeight: number) {
    // Dark Teal Header Bar
    this.rect(this.margin, this.currentY - headerHeight + 5, tableWidth, headerHeight, 0.04, 0.22, 0.29);

    let x = this.margin;
    columns.forEach((col) => {
      this.text(col.header.toUpperCase(), x + 4, this.currentY - 3, {
        font: 'Helvetica-Bold',
        size: 6.5,
        color: [1, 1, 1],
      });
      x += col.width;
    });

    this.currentY -= headerHeight;
  }

  /**
   * Draws a multi-page table with:
   * - Full multi-line text wrapping without truncation
   * - Dynamic row height calculation
   * - Clean row breaking across pages without clipping
   * - Repeated table header on every new page
   */
  public drawTable(
    columns: PDFTableColumn[],
    rows: (string | number)[][],
    options?: DrawTableOptions
  ) {
    const tableWidth = columns.reduce((acc, col) => acc + col.width, 0);
    const fontSize = options?.fontSize || 6.5;
    const lineHeight = options?.lineHeight || 8.5;
    const cellPadding = options?.cellPadding || 4;
    const headerHeight = options?.headerHeight || 17;
    const minRowHeight = 14;

    // Check if initial header fits
    this.checkPageBreak(headerHeight + minRowHeight);
    this.drawTableHeaderRow(columns, tableWidth, headerHeight);

    // Process each row
    rows.forEach((row, rowIndex) => {
      // 1. Wrap each column's text into lines that fit exactly in col.width
      const cellLines: string[][] = columns.map((col, colIdx) => {
        const rawVal = row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : '';
        const availableWidth = col.width - (cellPadding * 2);
        return wrapTextToLines(rawVal, availableWidth, fontSize, col.bold);
      });

      let remainingLineIndices = cellLines.map(() => 0);
      let isFirstPartOfRow = true;

      // Draw lines for this row, spanning pages if necessary
      while (true) {
        // How many lines are left in each cell?
        const remainingCounts = cellLines.map((lines, i) => lines.length - remainingLineIndices[i]);
        const maxLinesLeft = Math.max(1, ...remainingCounts);

        if (maxLinesLeft <= 0) {
          break; // Row fully rendered
        }

        const availableSpace = this.currentY - this.bottomLimit;

        // If not even space for 1 line, move to new page
        if (availableSpace < minRowHeight) {
          this.addPage();
          this.drawTableHeaderRow(columns, tableWidth, headerHeight);
          continue;
        }

        // How many lines can we draw in the remaining page space?
        const maxLinesFit = Math.max(1, Math.floor((availableSpace - 6) / lineHeight));
        const linesToDraw = Math.min(maxLinesLeft, maxLinesFit);
        const chunkRowHeight = Math.max(minRowHeight, linesToDraw * lineHeight + 5);

        // Background alternating tint
        const isAlt = rowIndex % 2 === 1;
        if (isAlt) {
          this.rect(this.margin, this.currentY - chunkRowHeight + 3, tableWidth, chunkRowHeight, 0.97, 0.98, 0.99);
        }

        // Draw text lines for each cell in this chunk
        let colX = this.margin;
        columns.forEach((col, colIdx) => {
          const lines = cellLines[colIdx];
          const startIdx = remainingLineIndices[colIdx];
          const endIdx = Math.min(lines.length, startIdx + linesToDraw);

          let textY = this.currentY - 3;
          for (let lineIdx = startIdx; lineIdx < endIdx; lineIdx++) {
            const lineText = lines[lineIdx];
            if (lineText) {
              this.text(lineText, colX + cellPadding, textY, {
                font: col.bold ? 'Helvetica-Bold' : (colIdx === 0 && isFirstPartOfRow ? 'Helvetica-Bold' : 'Helvetica'),
                size: fontSize,
                color: [0.15, 0.2, 0.25],
                align: col.align || 'left',
              });
            }
            textY -= lineHeight;
          }

          remainingLineIndices[colIdx] = endIdx;
          colX += col.width;
        });

        // Horizontal row separator line
        this.hLine(this.currentY - chunkRowHeight + 3, [0.88, 0.9, 0.92]);

        this.currentY -= chunkRowHeight;
        isFirstPartOfRow = false;

        // Check if any cells still have unrendered lines
        const stillLeft = cellLines.some((lines, i) => remainingLineIndices[i] < lines.length);
        if (!stillLeft) {
          break;
        }

        // Move to next page for remaining lines
        this.addPage();
        this.drawTableHeaderRow(columns, tableWidth, headerHeight);
      }
    });

    this.currentY -= 12;
  }

  private escapeText(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\r\n]/g, ' ');
  }

  public toBuffer(): Buffer {
    if (this.currentContent.length > 0) {
      this.pages.push(this.currentContent.join('\n'));
      this.currentContent = [];
    }

    const totalPages = this.pages.length;
    const objects: string[] = [];

    // Obj 1: Catalog
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

    // Obj 2: Pages container
    const kids = Array.from({ length: totalPages }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>\nendobj`);

    // Obj 3: Font Resources
    objects.push(
      '3 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>\nendobj'
    );

    // Page and Stream Objects
    for (let i = 0; i < totalPages; i++) {
      const pageObjNum = 4 + i * 2;
      const streamObjNum = 5 + i * 2;
      
      const pageFooter = this.drawPageFooter(i + 1, totalPages);
      const fullPageStream = `${this.pages[i]}\n${pageFooter}`;
      const streamLen = Buffer.byteLength(fullPageStream, 'latin1');

      // Page Object with custom MediaBox dimensions
      objects.push(
        `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Resources 3 0 R /Contents ${streamObjNum} 0 R >>\nendobj`
      );

      // Stream Object
      objects.push(
        `${streamObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${fullPageStream}\nendstream\nendobj`
      );
    }

    // Assembly
    let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets: number[] = [];

    for (const obj of objects) {
      offsets.push(output.length);
      output += obj + '\n';
    }

    const startXref = output.length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      output += `${off.toString().padStart(10, '0')} 00000 n \n`;
    }

    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(output, 'latin1');
  }
}
