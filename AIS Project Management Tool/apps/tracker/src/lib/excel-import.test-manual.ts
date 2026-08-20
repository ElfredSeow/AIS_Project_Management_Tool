// Plain assert-based self-check for excel-import.ts (no test framework in this repo).
// Run with: npx tsx src/lib/excel-import.test-manual.ts
//
// ponytail: Node has no global DOMParser (that's a browser API the real code relies
// on, correctly). This file installs a minimal regex/stack XML-DOM polyfill scoped to
// this script only, just enough to walk the simple worksheet/sharedStrings XML shapes
// excel-export.ts produces. Upgrade path: if this repo ever adds a real test runner
// with jsdom/happy-dom, delete the polyfill and use that instead.

import assert from 'node:assert';
import { zipSync, strToU8 } from 'fflate';

// A real DOMParser decodes entities when you read textContent. The polyfill must too,
// otherwise it silently validates behaviour the browser never exhibits.
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

class FakeElement {
  tagName: string;
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  textParts: string[] = [];
  constructor(tagName: string) {
    this.tagName = tagName;
  }
  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }
  get textContent(): string {
    let s = decodeEntities(this.textParts.join(''));
    for (const c of this.children) s += c.textContent;
    return s;
  }
  getElementsByTagName(tag: string): FakeElement[] {
    const out: FakeElement[] = [];
    const walk = (el: FakeElement): void => {
      for (const c of el.children) {
        if (c.tagName === tag) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
}

function parseXml(xml: string): FakeElement {
  const root = new FakeElement('#root');
  const stack: FakeElement[] = [root];
  const tokenRe = /<([^>]+)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(xml))) {
    if (m[2] !== undefined) {
      if (m[2].trim() !== '') stack[stack.length - 1].textParts.push(m[2]);
      continue;
    }
    const raw = m[1];
    if (raw.startsWith('?') || raw.startsWith('!')) continue;
    if (raw.startsWith('/')) {
      stack.pop();
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const nameMatch = /^([A-Za-z0-9_:.-]+)/.exec(body.trim());
    const name = nameMatch ? nameMatch[1] : body.trim();
    const el = new FakeElement(name);
    const attrRe = /([A-Za-z0-9_:.-]+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(body))) {
      el.attrs[am[1]] = am[2];
    }
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  return root;
}

class FakeDOMParser {
  parseFromString(xml: string): FakeElement {
    return parseXml(xml);
  }
}

(globalThis as unknown as { DOMParser: unknown }).DOMParser = FakeDOMParser;

// Import after installing the polyfill (DOMParser is only used inside function bodies,
// called after this module has finished evaluating, so import order doesn't matter —
// but keep it below the polyfill for readability).
const { parseProjectsXlsx } = await import('./excel-import');

function colIndexToLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

const HEADERS = [
  'Project ID', 'Project Name', 'Status', 'Project Type', 'Problem Statement',
  'Proposed Solution', 'Expected Benefits', 'Contributors JSON Data', 'Start Date',
  'Due Date', 'Estimated Man-Hours Saved', 'Milestones JSON Data',
];

function escapeXml(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Builds a sheet1.xml using inlineStr cells, mirroring excel-export.ts's shape.
function buildInlineStrSheet(headers: string[], rows: (string | number)[][]): string {
  const headerRow = headers
    .map((h: string, i: number) => `<c r="${colIndexToLetter(i)}1" t="inlineStr" s="1"><is><t>${escapeXml(h)}</t></is></c>`)
    .join('');
  const dataRows = rows
    .map((row: (string | number)[], rowIndex: number) => {
      const rowNum = rowIndex + 2;
      const cells = row
        .map((cell: string | number, colIndex: number) => {
          const ref = `${colIndexToLetter(colIndex)}${rowNum}`;
          if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
          if (cell === '') return '';
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${headerRow}</row>${dataRows}</sheetData></worksheet>`;
}

// Builds a sheet1.xml using shared-string cells (t="s"), mirroring what real Excel
// writes after a user opens/edits/re-saves the exported file.
function buildSharedStringSheet(headers: string[], rows: (string | number)[][]): { sheetXml: string; sharedStringsXml: string } {
  const strings: string[] = [];
  const internIndex = (s: string): number => {
    let idx = strings.indexOf(s);
    if (idx === -1) {
      idx = strings.length;
      strings.push(s);
    }
    return idx;
  };

  const headerRow = headers
    .map((h: string, i: number) => `<c r="${colIndexToLetter(i)}1" t="s"><v>${internIndex(h)}</v></c>`)
    .join('');
  const dataRows = rows
    .map((row: (string | number)[], rowIndex: number) => {
      const rowNum = rowIndex + 2;
      const cells = row
        .map((cell: string | number, colIndex: number) => {
          const ref = `${colIndexToLetter(colIndex)}${rowNum}`;
          if (typeof cell === 'number') return `<c r="${ref}"><v>${cell}</v></c>`;
          if (cell === '') return '';
          return `<c r="${ref}" t="s"><v>${internIndex(cell)}</v></c>`;
        })
        .join('');
      return `<row r="${rowNum}">${cells}</row>`;
    })
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${headerRow}</row>${dataRows}</sheetData></worksheet>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s: string) => `<si><t>${escapeXml(s)}</t></si>`).join('')}</sst>`;

  return { sheetXml, sharedStringsXml };
}

function zipToArrayBuffer(files: Record<string, Uint8Array>): ArrayBuffer {
  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

const rows: (string | number)[][] = [
  // row2: full valid row, existing project (update), exercises XML-entity unescaping
  [VALID_UUID, 'Project Alpha', 'In Progress', 'ASSET', 'Problem & <Risk>', 'Fix it', 'Saves 5&amp;6 hrs', '[]', '2024-01-15', '2024-02-20', 40, '[]'],
  // row3: blank Project ID -> create, blank dates/manhours -> null
  ['', 'Project Beta', 'Ideation', 'DST', '', '', '', '', '', '', '', ''],
  // row4: bad status -> row error, skipped
  ['', 'Project Gamma', 'Nonsense', 'ASSET', '', '', '', '', '', '', '', ''],
  // row5: bad UUID -> row error, skipped
  ['not-a-uuid', 'Project Delta', 'Completed', 'ASSET', '', '', '', '', '', '', '', ''],
  // row6: Excel serial date number for Start Date -> must convert to ISO date
  ['', 'Project Epsilon', 'Completed', 'DST', '', '', '', '', 45000, '', '', ''],
];

// --- Case 1: inlineStr (our own exporter's shape) ---
{
  const sheetXml = buildInlineStrSheet(HEADERS, rows);
  const buf = zipToArrayBuffer({ 'xl/worksheets/sheet1.xml': strToU8(sheetXml) });
  const { rows: parsed, errors } = parseProjectsXlsx(buf);

  assert.strictEqual(errors.length, 2, `expected 2 row errors, got ${errors.length}: ${JSON.stringify(errors)}`);
  assert.strictEqual(parsed.length, 3, `expected 3 valid rows, got ${parsed.length}`);

  assert.strictEqual(parsed[0].projectId, VALID_UUID);
  assert.strictEqual(parsed[0].statusKey, 'StatusKey1');
  assert.strictEqual(parsed[0].projecttypeKey, 'ProjecttypeKey0');
  assert.strictEqual(parsed[0].problemstatement, 'Problem & <Risk>');
  assert.strictEqual(parsed[0].estimatedmanhourssaved, 40);
  // Regression: a literal "&amp;" in the data must survive untouched. Decoding entities
  // a second time after DOMParser already did would silently rewrite it to "&".
  assert.strictEqual(parsed[0].expectedbenefits, 'Saves 5&amp;6 hrs');

  assert.strictEqual(parsed[1].projectId, null);
  assert.strictEqual(parsed[1].statusKey, 'StatusKey0');
  assert.strictEqual(parsed[1].projecttypeKey, 'ProjecttypeKey1');
  assert.strictEqual(parsed[1].estimatedmanhourssaved, null);

  assert.match(parsed[2].startdate, /^\d{4}-\d{2}-\d{2}$/);

  console.log('PASS: inlineStr round-trip');
}

// --- Case 2: shared strings (what real Excel writes after edit + re-save) ---
{
  const { sheetXml, sharedStringsXml } = buildSharedStringSheet(HEADERS, rows);
  const buf = zipToArrayBuffer({
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    'xl/sharedStrings.xml': strToU8(sharedStringsXml),
  });
  const { rows: parsed, errors } = parseProjectsXlsx(buf);

  assert.strictEqual(errors.length, 2, `expected 2 row errors, got ${errors.length}: ${JSON.stringify(errors)}`);
  assert.strictEqual(parsed.length, 3, `expected 3 valid rows, got ${parsed.length}`);
  assert.strictEqual(parsed[0].projectId, VALID_UUID);
  assert.strictEqual(parsed[0].statusKey, 'StatusKey1');
  assert.strictEqual(parsed[0].problemstatement, 'Problem & <Risk>');
  // Regression: a literal "&amp;" in the data must survive untouched. Decoding entities
  // a second time after DOMParser already did would silently rewrite it to "&".
  assert.strictEqual(parsed[0].expectedbenefits, 'Saves 5&amp;6 hrs');
  assert.strictEqual(parsed[1].projectId, null);

  console.log('PASS: sharedStrings round-trip');
}

// --- Case 3: bad header row is rejected outright ---
{
  const badHeaders = [...HEADERS];
  badHeaders[0] = 'Wrong Header';
  const sheetXml = buildInlineStrSheet(badHeaders, rows);
  const buf = zipToArrayBuffer({ 'xl/worksheets/sheet1.xml': strToU8(sheetXml) });
  const { rows: parsed, errors } = parseProjectsXlsx(buf);

  assert.strictEqual(parsed.length, 0);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0].message, /Header row/);

  console.log('PASS: header mismatch rejected');
}

console.log('All excel-import self-checks passed.');
