// Excel export utility - generates .xlsx files with dropdown validations
// Uses pure JavaScript/XML approach compatible with Excel

interface ExcelColumn {
  header: string;
  width: number;
  dropdownOptions?: string[];
}

interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  data: (string | number)[][];
}

// Escape XML special characters
function escapeXml(str: string | number): string {
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert column index to Excel column letter (0 = A, 1 = B, etc.)
function colIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function exportToExcel({ filename, sheetName, columns, data }: ExcelExportOptions): void {
  const rowCount = data.length + 1; // +1 for header
  
  // Build column definitions
  const colsXml = columns
    .map((_col: ExcelColumn, i: number) => `<col min="${i + 1}" max="${i + 1}" width="${columns[i].width}" customWidth="1"/>`)
    .join('');

  // Build header row
  const headerRow = columns
    .map((col: ExcelColumn, i: number) => {
      const cellRef = `${colIndexToLetter(i)}1`;
      return `<c r="${cellRef}" t="inlineStr" s="1"><is><t>${escapeXml(col.header)}</t></is></c>`;
    })
    .join('');

  // Build data rows
  const dataRows = data
    .map((row: (string | number)[], rowIndex: number) => {
      const rowNum = rowIndex + 2; // Excel rows start at 1, header is row 1
      const cells = row
        .map((cell: string | number, colIndex: number) => {
          const cellRef = `${colIndexToLetter(colIndex)}${rowNum}`;
          const isNumber = typeof cell === 'number' || (typeof cell === 'string' && cell !== '' && !isNaN(Number(cell)) && !cell.includes('-'));
          if (isNumber && cell !== '') {
            return `<c r="${cellRef}"><v>${cell}</v></c>`;
          }
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join('');

  // Build data validations for dropdowns
  const validations = columns
    .map((col: ExcelColumn, colIndex: number) => {
      if (!col.dropdownOptions || col.dropdownOptions.length === 0) return '';
      const colLetter = colIndexToLetter(colIndex);
      const sqref = `${colLetter}2:${colLetter}${rowCount}`;
      const formula = col.dropdownOptions.map((opt: string) => escapeXml(opt)).join(',');
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${sqref}"><formula1>"${formula}"</formula1></dataValidation>`;
    })
    .filter((v: string) => v !== '')
    .join('');

  const dataValidationsXml = validations ? `<dataValidations count="${columns.filter((c: ExcelColumn) => c.dropdownOptions).length}">${validations}</dataValidations>` : '';

  // Dimension reference
  const lastCol = colIndexToLetter(columns.length - 1);
  const dimension = `A1:${lastCol}${rowCount}`;

  // Build worksheet XML
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<cols>${colsXml}</cols>
<sheetData>
<row r="1">${headerRow}</row>
${dataRows}
</sheetData>
${dataValidationsXml}
</worksheet>`;

  // Styles XML (for header formatting)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1">
<border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

  // Content Types XML
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // Root rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Workbook XML
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>`;

  // Workbook rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Create ZIP file using JSZip-like manual approach
  // We'll use the Blob API to create a proper XLSX file structure
  const files: Record<string, string> = {
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': rootRelsXml,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRelsXml,
    'xl/worksheets/sheet1.xml': sheetXml,
    'xl/styles.xml': stylesXml,
  };

  // Use fflate for ZIP compression (available in browser)
  createAndDownloadZip(files, filename);
}

async function createAndDownloadZip(files: Record<string, string>, filename: string): Promise<void> {
  // Dynamically import fflate which is a lightweight zip library
  // Since we can't add dependencies, we'll use a simple uncompressed ZIP approach
  const zip = new SimpleZip();
  
  for (const [path, content] of Object.entries(files)) {
    zip.addFile(path, content);
  }
  
  const blob = zip.generate();
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Simple ZIP implementation without compression
class SimpleZip {
  private files: { name: string; data: Uint8Array }[] = [];

  addFile(name: string, content: string): void {
    const encoder = new TextEncoder();
    this.files.push({ name, data: encoder.encode(content) });
  }

  generate(): Blob {
    const parts: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name);
      const data = file.data;
      
      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true); // Version needed to extract
      view.setUint16(6, 0, true); // General purpose bit flag
      view.setUint16(8, 0, true); // Compression method (none)
      view.setUint16(10, 0, true); // File last mod time
      view.setUint16(12, 0, true); // File last mod date
      view.setUint32(14, this.crc32(data), true); // CRC-32
      view.setUint32(18, data.length, true); // Compressed size
      view.setUint32(22, data.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // File name length
      view.setUint16(28, 0, true); // Extra field length
      localHeader.set(nameBytes, 30);

      // Central directory header
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      
      cdView.setUint32(0, 0x02014b50, true); // Central directory signature
      cdView.setUint16(4, 20, true); // Version made by
      cdView.setUint16(6, 20, true); // Version needed
      cdView.setUint16(8, 0, true); // General purpose bit flag
      cdView.setUint16(10, 0, true); // Compression method
      cdView.setUint16(12, 0, true); // File last mod time
      cdView.setUint16(14, 0, true); // File last mod date
      cdView.setUint32(16, this.crc32(data), true); // CRC-32
      cdView.setUint32(20, data.length, true); // Compressed size
      cdView.setUint32(24, data.length, true); // Uncompressed size
      cdView.setUint16(28, nameBytes.length, true); // File name length
      cdView.setUint16(30, 0, true); // Extra field length
      cdView.setUint16(32, 0, true); // File comment length
      cdView.setUint16(34, 0, true); // Disk number start
      cdView.setUint16(36, 0, true); // Internal file attributes
      cdView.setUint32(38, 0, true); // External file attributes
      cdView.setUint32(42, offset, true); // Relative offset of local header
      cdHeader.set(nameBytes, 46);

      parts.push(localHeader);
      parts.push(data);
      centralDirectory.push(cdHeader);
      
      offset += localHeader.length + data.length;
    }

    // Add central directory
    const cdOffset = offset;
    let cdSize = 0;
    for (const cd of centralDirectory) {
      parts.push(cd);
      cdSize += cd.length;
    }

    // End of central directory record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Disk where CD starts
    eocdView.setUint16(8, this.files.length, true); // Number of CD records on this disk
    eocdView.setUint16(10, this.files.length, true); // Total CD records
    eocdView.setUint32(12, cdSize, true); // Size of CD
    eocdView.setUint32(16, cdOffset, true); // Offset of start of CD
    eocdView.setUint16(20, 0, true); // Comment length
    
    parts.push(eocd);

    return new Blob(parts as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = this.getCrc32Table();
    
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }
    
    return (crc ^ 0xffffffff) >>> 0;
  }

  private crc32Table: Uint32Array | null = null;
  
  private getCrc32Table(): Uint32Array {
    if (this.crc32Table) return this.crc32Table;
    
    this.crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      this.crc32Table[i] = c >>> 0;
    }
    
    return this.crc32Table;
  }
}
