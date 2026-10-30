import zlib from 'zlib';

/**
 * Pure TypeScript Zero-Dependency OpenXML XLSX Generator for EEC RMS.
 * Generates native Microsoft Excel (.xlsx) files with:
 * - Proper column widths
 * - Bold styled header rows with corporate colors
 * - Text wrapping and top-alignment enabled on all cells
 * - Active auto-filters on header columns
 * - Full Unicode and special character support
 */

interface ZipEntry {
  name: string;
  data: Buffer;
}

function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colNumberToName(num: number): string {
  let s = '';
  while (num > 0) {
    const modulo = (num - 1) % 26;
    s = String.fromCharCode(65 + modulo) + s;
    num = Math.floor((num - modulo) / 26);
  }
  return s;
}

function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const crc = zlib.crc32(entry.data);
    const compressed = zlib.deflateRawSync(entry.data);

    // Local file header (30 bytes + name length)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed (2.0)
    local.writeUInt16LE(0x0800, 6); // flags (UTF-8 filename)
    local.writeUInt16LE(8, 8); // compression method (deflate)
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc-32
    local.writeUInt32LE(compressed.length, 18); // compressed size
    local.writeUInt32LE(entry.data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(local, 30);

    localHeaders.push(local, compressed);

    // Central directory header (46 bytes + name length)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags
    central.writeUInt16LE(8, 10); // compression method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc-32
    central.writeUInt32LE(compressed.length, 20); // compressed size
    central.writeUInt32LE(entry.data.length, 24); // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // file name length
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    central.writeUInt32LE(offset, 42); // local header offset
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

export interface ExcelColumnDefinition {
  header: string;
  width?: number; // Approximate character width in Excel
}

export function generateExcelWorkbook(
  sheetName: string,
  columns: ExcelColumnDefinition[],
  rows: (string | number)[][]
): Buffer {
  const safeSheetName = sheetName.replace(/[\\/?*\[\]]/g, '').slice(0, 31) || 'Sheet1';
  const totalCols = columns.length;
  const totalRows = rows.length + 1; // 1 header row + data rows
  const lastColLetter = colNumberToName(totalCols);

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 3. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 4. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/>
  </bookViews>
  <sheets>
    <sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // 5. xl/styles.xml
  // Style 0: Default
  // Style 1: Header (Font 1 - bold white, Fill 2 - corporate dark teal #0A3742, Border 1, Alignment centered with wrap)
  // Style 2: Data (Font 0 - regular, Fill 0 - none, Border 1 - light gray, Alignment top-left with wrapText=1)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="10"/>
      <color rgb="FF1E293B"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="10.5"/>
      <color rgb="FFFFFFFF"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF0A3742"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // 6. xl/worksheets/sheet1.xml
  const colElements = columns.map((col, idx) => {
    const w = col.width || 20;
    return `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`;
  }).join('\n    ');

  let sheetDataXml = '';

  // Row 1: Header Row (height 26 pt)
  sheetDataXml += `<row r="1" ht="26" customHeight="1">\n`;
  columns.forEach((col, idx) => {
    const cellRef = `${colNumberToName(idx + 1)}1`;
    sheetDataXml += `  <c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(col.header)}</t></is></c>\n`;
  });
  sheetDataXml += `</row>\n`;

  // Rows 2..N: Data Rows
  rows.forEach((row, rowIdx) => {
    const rNum = rowIdx + 2;
    sheetDataXml += `<row r="${rNum}">\n`;
    columns.forEach((_, colIdx) => {
      const cellRef = `${colNumberToName(colIdx + 1)}${rNum}`;
      const rawVal = row[colIdx];
      const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      sheetDataXml += `  <c r="${cellRef}" s="2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(valStr)}</t></is></c>\n`;
    });
    sheetDataXml += `</row>\n`;
  });

  const filterRef = `A1:${lastColLetter}${Math.max(1, totalRows)}`;

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    ${colElements}
  </cols>
  <sheetData>
    ${sheetDataXml}  </sheetData>
  <autoFilter ref="${filterRef}"/>
</worksheet>`;

  return createZipArchive([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypesXml, 'utf-8') },
    { name: '_rels/.rels', data: Buffer.from(rootRelsXml, 'utf-8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRelsXml, 'utf-8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf-8') },
    { name: 'xl/styles.xml', data: Buffer.from(stylesXml, 'utf-8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(worksheetXml, 'utf-8') },
  ]);
}

