// Excel import utility - parses .xlsx files produced by (or round-tripped through) excel-export.ts
// Uses fflate to unzip and DOMParser to read the worksheet XML.

import { unzipSync, strFromU8 } from 'fflate';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_ROWS = 5000;

const EXPECTED_HEADERS = [
  'Project ID',
  'Project Name',
  'Status',
  'Project Type',
  'Problem Statement',
  'Proposed Solution',
  'Expected Benefits',
  'Contributors JSON Data',
  'Start Date',
  'Due Date',
  'Estimated Man-Hours Saved',
  'Milestones JSON Data',
] as const;

const STATUS_LABEL_TO_KEY: Record<string, string> = {
  'Ideation': 'StatusKey0',
  'In Progress': 'StatusKey1',
  'Completed': 'StatusKey2',
  'De-Prioritised': 'StatusKey3',
  'O & S': 'StatusKey4',
  // accept raw keys too, for robustness
  'StatusKey0': 'StatusKey0',
  'StatusKey1': 'StatusKey1',
  'StatusKey2': 'StatusKey2',
  'StatusKey3': 'StatusKey3',
  'StatusKey4': 'StatusKey4',
};

const TYPE_LABEL_TO_KEY: Record<string, string> = {
  'ASSET': 'ProjecttypeKey0',
  'DST': 'ProjecttypeKey1',
  'ProjecttypeKey0': 'ProjecttypeKey0',
  'ProjecttypeKey1': 'ProjecttypeKey1',
};

export interface ImportedRow {
  sheetRow: number; // 1-based row number in the sheet, for error reporting
  projectId: string | null; // null means "create"
  projectname: string;
  statusKey: string;
  projecttypeKey: string;
  problemstatement: string;
  proposedsolution: string;
  expectedbenefits: string;
  contributorsjsondata: string;
  startdate: string;
  duedate: string;
  estimatedmanhourssaved: number | null;
  milestonesjsondata: string;
}

export interface ImportError {
  sheetRow: number;
  message: string;
}

// Convert Excel column letter(s) to a 0-based index (inverse of colIndexToLetter)
function colLetterToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

// Split a cell ref like "AA12" into { col: 26, row: 12 }
function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return null;
  return { col: colLetterToIndex(match[1]), row: parseInt(match[2], 10) };
}

// Excel serial date epoch: 1899-12-30 (accounts for Excel's leap-year bug)
function excelSerialToIsoDate(serial: number): string | null {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value: string): boolean {
  if (value === '') return true;
  return !isNaN(new Date(value).getTime());
}

interface RawCell {
  value: string;
  isNumeric: boolean;
}

// Parse xl/sharedStrings.xml into an array of strings (indexed by <si> order)
function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const items = Array.from(doc.getElementsByTagName('si'));
  return items.map((si: Element) => {
    // <si> may contain a single <t>, or multiple <r><t>text</t></r> runs
    const tNodes = Array.from(si.getElementsByTagName('t'));
    return tNodes.map((t: Element) => t.textContent || '').join('');
  });
}

// Parse xl/worksheets/sheet1.xml into a sparse row -> col -> RawCell map
function parseSheetRows(xml: string, sharedStrings: string[]): Map<number, Map<number, RawCell>> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rowEls = Array.from(doc.getElementsByTagName('row'));
  const rows = new Map<number, Map<number, RawCell>>();

  for (const rowEl of rowEls) {
    const rowNum = parseInt(rowEl.getAttribute('r') || '', 10);
    if (!rowNum) continue;
    const cols = new Map<number, RawCell>();
    const cellEls = Array.from(rowEl.getElementsByTagName('c'));

    for (const cellEl of cellEls) {
      const ref = cellEl.getAttribute('r');
      if (!ref) continue;
      const parsed = parseCellRef(ref);
      if (!parsed) continue;

      const type = cellEl.getAttribute('t');
      let value = '';
      let isNumeric = false;

      if (type === 'inlineStr') {
        const t = cellEl.getElementsByTagName('t')[0];
        value = t?.textContent || '';
      } else if (type === 's') {
        const v = cellEl.getElementsByTagName('v')[0];
        const idx = parseInt(v?.textContent || '', 10);
        value = sharedStrings[idx] ?? '';
      } else if (type === 'str') {
        const v = cellEl.getElementsByTagName('v')[0];
        value = v?.textContent || '';
      } else {
        // plain numeric cell (no t attribute)
        const v = cellEl.getElementsByTagName('v')[0];
        value = v?.textContent || '';
        isNumeric = value !== '';
      }

      cols.set(parsed.col, { value, isNumeric });
    }

    rows.set(rowNum, cols);
  }

  return rows;
}

function cellText(cols: Map<number, RawCell> | undefined, colIndex: number): string {
  const cell = cols?.get(colIndex);
  if (!cell) return '';
  // DOMParser has already decoded XML entities in textContent; decoding again
  // would turn a literal "&amp;" in the data into "&" and corrupt the round trip.
  return cell.value.trim();
}

export function parseProjectsXlsx(file: ArrayBuffer): { rows: ImportedRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(new Uint8Array(file));
  } catch {
    return { rows: [], errors: [{ sheetRow: 0, message: 'File is not a valid .xlsx (zip) file.' }] };
  }

  const sheetXmlBytes = unzipped['xl/worksheets/sheet1.xml'];
  if (!sheetXmlBytes) {
    return { rows: [], errors: [{ sheetRow: 0, message: 'Could not find xl/worksheets/sheet1.xml in the uploaded file.' }] };
  }

  const sharedStringsBytes = unzipped['xl/sharedStrings.xml'];
  const sharedStrings = parseSharedStrings(sharedStringsBytes ? strFromU8(sharedStringsBytes) : undefined);
  const sheetRows = parseSheetRows(strFromU8(sheetXmlBytes), sharedStrings);

  // Validate header row (row 1)
  const headerCols = sheetRows.get(1);
  const actualHeaders = EXPECTED_HEADERS.map((_h: string, i: number) => cellText(headerCols, i));
  const headersMatch = EXPECTED_HEADERS.every((h: string, i: number) => actualHeaders[i] === h);
  if (!headersMatch) {
    return {
      rows: [],
      errors: [{
        sheetRow: 1,
        message: `Header row does not match the expected template. Expected: ${EXPECTED_HEADERS.join(' | ')}. Found: ${actualHeaders.join(' | ')}`,
      }],
    };
  }

  const dataRowNums = Array.from(sheetRows.keys())
    .filter((r: number) => r > 1)
    .sort((a: number, b: number) => a - b);

  if (dataRowNums.length > MAX_ROWS) {
    errors.push({ sheetRow: 0, message: `File has ${dataRowNums.length} data rows, which exceeds the ${MAX_ROWS} row limit. Trim the file and try again.` });
    return { rows: [], errors };
  }

  const rows: ImportedRow[] = [];

  for (const rowNum of dataRowNums) {
    const cols = sheetRows.get(rowNum);

    const projectIdRaw = cellText(cols, 0);
    const projectname = cellText(cols, 1);
    const statusRaw = cellText(cols, 2);
    const typeRaw = cellText(cols, 3);
    const problemstatement = cellText(cols, 4);
    const proposedsolution = cellText(cols, 5);
    const expectedbenefits = cellText(cols, 6);
    const contributorsjsondata = cellText(cols, 7);
    const startdateRaw = cellText(cols, 8);
    const duedateRaw = cellText(cols, 9);
    const manhoursRaw = cellText(cols, 10);
    const milestonesjsondata = cellText(cols, 11);

    // skip fully blank rows
    if (!projectIdRaw && !projectname && !statusRaw && !typeRaw && !problemstatement &&
        !proposedsolution && !expectedbenefits && !contributorsjsondata && !startdateRaw &&
        !duedateRaw && !manhoursRaw && !milestonesjsondata) {
      continue;
    }

    let rowHasError = false;

    if (!projectname) {
      errors.push({ sheetRow: rowNum, message: 'Project Name is required.' });
      rowHasError = true;
    }

    let projectId: string | null = null;
    if (projectIdRaw) {
      if (!UUID_REGEX.test(projectIdRaw)) {
        errors.push({ sheetRow: rowNum, message: `Project ID "${projectIdRaw}" is not a valid UUID.` });
        rowHasError = true;
      } else {
        projectId = projectIdRaw;
      }
    }

    const statusKey = STATUS_LABEL_TO_KEY[statusRaw];
    if (!statusKey) {
      errors.push({ sheetRow: rowNum, message: `Status "${statusRaw}" is not valid. Allowed values: Ideation, In Progress, Completed, De-Prioritised, O & S.` });
      rowHasError = true;
    }

    const projecttypeKey = TYPE_LABEL_TO_KEY[typeRaw];
    if (!projecttypeKey) {
      errors.push({ sheetRow: rowNum, message: `Project Type "${typeRaw}" is not valid. Allowed values: ASSET, DST.` });
      rowHasError = true;
    }

    let estimatedmanhourssaved: number | null = null;
    if (manhoursRaw !== '') {
      const n = Number(manhoursRaw);
      if (isNaN(n)) {
        errors.push({ sheetRow: rowNum, message: `Estimated Man-Hours Saved "${manhoursRaw}" is not a number.` });
        rowHasError = true;
      } else {
        estimatedmanhourssaved = n;
      }
    }

    // Dates: accept blank, ISO-ish string, or an Excel serial number
    let startdate = startdateRaw;
    if (startdateRaw !== '' && /^\d+(\.\d+)?$/.test(startdateRaw)) {
      const iso = excelSerialToIsoDate(Number(startdateRaw));
      if (!iso) {
        errors.push({ sheetRow: rowNum, message: `Start Date "${startdateRaw}" is not a valid date.` });
        rowHasError = true;
      } else {
        startdate = iso;
      }
    } else if (!isValidDateString(startdateRaw)) {
      errors.push({ sheetRow: rowNum, message: `Start Date "${startdateRaw}" is not a valid date.` });
      rowHasError = true;
    }

    let duedate = duedateRaw;
    if (duedateRaw !== '' && /^\d+(\.\d+)?$/.test(duedateRaw)) {
      const iso = excelSerialToIsoDate(Number(duedateRaw));
      if (!iso) {
        errors.push({ sheetRow: rowNum, message: `Due Date "${duedateRaw}" is not a valid date.` });
        rowHasError = true;
      } else {
        duedate = iso;
      }
    } else if (!isValidDateString(duedateRaw)) {
      errors.push({ sheetRow: rowNum, message: `Due Date "${duedateRaw}" is not a valid date.` });
      rowHasError = true;
    }

    if (rowHasError) continue;

    rows.push({
      sheetRow: rowNum,
      projectId,
      projectname,
      statusKey,
      projecttypeKey,
      problemstatement,
      proposedsolution,
      expectedbenefits,
      contributorsjsondata,
      startdate,
      duedate,
      estimatedmanhourssaved,
      milestonesjsondata,
    });
  }

  return { rows, errors };
}
