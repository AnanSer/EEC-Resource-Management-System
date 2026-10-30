/**
 * Zero-dependency PDF 1.4 Document Generator for EEC RMS.
 * Generates standards-compliant, beautiful multi-page PDF documents
 * compatible with all standard PDF readers (Adobe Acrobat, Chrome, Firefox, Safari, Edge).
 */

export interface PDFTableColumn {
  header: string;
  width: number; // width in points
  align?: 'left' | 'right' | 'center';
}

export class SimplePDFDocument {
  private pages: string[] = [];
  private currentContent: string[] = [];
  private pageHeight = 792; // 11 inches @ 72 dpi (Letter)
  private pageWidth = 612;  // 8.5 inches @ 72 dpi (Letter)
  private margin = 40;
  private currentY = 740;

  constructor(private title: string, private subtitle?: string) {
    this.addPage();
  }

  public addPage() {
    if (this.currentContent.length > 0 || this.pages.length === 0) {
      this.pages.push(this.currentContent.join('\n'));
      this.currentContent = [];
    }
    this.currentY = 740;
    this.drawPageHeader();
  }

  public getPageCount(): number {
    return this.pages.length;
  }

  private drawPageHeader() {
    // EEC Header Bar
    this.rect(this.margin, 755, this.pageWidth - (this.margin * 2), 2, 0.04, 0.22, 0.29); // #0A3742 (eec-primary)
    
    // Header title
    this.text('ETHIOPIAN ENGINEERING CORPORATION', this.margin, 762, {
      font: 'Helvetica-Bold',
      size: 9,
      color: [0.04, 0.22, 0.29],
    });
    this.text(this.title, this.pageWidth - this.margin, 762, {
      font: 'Helvetica',
      size: 8,
      align: 'right',
      color: [0.4, 0.45, 0.5],
    });
  }

  private drawPageFooter(pageNum: number, totalPages: number) {
    const footerY = 30;
    // Line above footer
    const lineCmd = `0.85 0.88 0.91 RG 1 w ${this.margin} ${footerY + 12} m ${this.pageWidth - this.margin} ${footerY + 12} l S`;
    
    // Footer text
    const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const leftText = `EEC Resource Management System (RMS) • Official Audit Report • Generated: ${dateStr}`;
    const rightText = `Page ${pageNum} of ${totalPages}`;

    const textCmds = [
      `BT /F1 7 Tf 0.45 0.5 0.55 rg ${this.margin} ${footerY} Td (${this.escapeText(leftText)}) Tj ET`,
      `BT /F1 7 Tf 0.45 0.5 0.55 rg ${this.pageWidth - this.margin - 45} ${footerY} Td (${this.escapeText(rightText)}) Tj ET`,
    ].join('\n');

    return `${lineCmd}\n${textCmds}`;
  }

  public checkPageBreak(requiredHeight: number) {
    if (this.currentY - requiredHeight < 50) {
      this.addPage();
    }
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
      const approxWidth = str.length * size * 0.5;
      adjustedX = x - approxWidth;
    } else if (options.align === 'center') {
      const approxWidth = str.length * size * 0.5;
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

  public drawHeaderBlock(title: string, subtitle: string, metaFields: { label: string; value: string }[]) {
    this.checkPageBreak(90);
    
    // Title
    this.text(title, this.margin, this.currentY, {
      font: 'Helvetica-Bold',
      size: 15,
      color: [0.04, 0.22, 0.29],
    });
    this.currentY -= 14;

    // Subtitle
    this.text(subtitle, this.margin, this.currentY, {
      font: 'Helvetica',
      size: 8.5,
      color: [0.35, 0.4, 0.45],
    });
    this.currentY -= 16;

    // Meta Box
    const boxHeight = 22;
    this.rect(this.margin, this.currentY - 4, this.pageWidth - (this.margin * 2), boxHeight, 0.96, 0.97, 0.98, [0.85, 0.88, 0.91]);
    
    let curX = this.margin + 8;
    metaFields.forEach((field) => {
      this.text(`${field.label}: `, curX, this.currentY + 6, {
        font: 'Helvetica-Bold',
        size: 7.5,
        color: [0.3, 0.35, 0.4],
      });
      const labelW = field.label.length * 4.5 + 10;
      this.text(field.value, curX + labelW, this.currentY + 6, {
        font: 'Helvetica',
        size: 7.5,
        color: [0.1, 0.15, 0.2],
      });
      curX += labelW + field.value.length * 4.5 + 20;
    });

    this.currentY -= (boxHeight + 12);
  }

  public drawTable(columns: PDFTableColumn[], rows: (string | number)[][]) {
    const tableWidth = columns.reduce((acc, col) => acc + col.width, 0);
    const rowHeight = 18;

    // Table Header
    this.checkPageBreak(rowHeight * 2);
    this.rect(this.margin, this.currentY - 3, tableWidth, rowHeight, 0.04, 0.22, 0.29); // Dark blue header

    let x = this.margin;
    columns.forEach((col) => {
      this.text(col.header.toUpperCase(), x + 4, this.currentY + 3, {
        font: 'Helvetica-Bold',
        size: 7,
        color: [1, 1, 1],
      });
      x += col.width;
    });

    this.currentY -= rowHeight;

    // Table Rows
    rows.forEach((row, rowIndex) => {
      this.checkPageBreak(rowHeight + 10);
      
      const isAlt = rowIndex % 2 === 1;
      if (isAlt) {
        this.rect(this.margin, this.currentY - 3, tableWidth, rowHeight, 0.97, 0.98, 0.99);
      }
      this.hLine(this.currentY - 3, [0.9, 0.92, 0.94]);

      let colX = this.margin;
      columns.forEach((col, colIndex) => {
        const rawVal = row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
        // Truncate if exceeds column width
        const maxChars = Math.floor(col.width / 4.5);
        const cellText = rawVal.length > maxChars ? rawVal.substring(0, maxChars - 3) + '...' : rawVal;

        this.text(cellText, colX + 4, this.currentY + 3, {
          font: colIndex === 0 ? 'Helvetica-Bold' : 'Helvetica',
          size: 7,
          color: [0.15, 0.2, 0.25],
        });
        colX += col.width;
      });

      this.currentY -= rowHeight;
    });

    this.currentY -= 15;
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

      // Page Object
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

