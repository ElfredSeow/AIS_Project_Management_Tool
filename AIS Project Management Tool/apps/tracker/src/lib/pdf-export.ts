// PDF export utility - generates clean PDF with projects grouped by status
// Uses pure JavaScript approach to generate PDF - Landscape 2-page layout
// Page 1: Ideation, In Progress, O & S | Page 2: Completed, De-Prioritised

import type { AISProjectManager, AISProjectManagerStatusKey } from '@/generated/models/aisproject-manager-model';

interface StatusGroup {
  label: string;
  statusKeys: AISProjectManagerStatusKey[];
  color: string;
  bgColor: string;
}

const STATUS_GROUPS: StatusGroup[] = [
  { label: 'Ideation', statusKeys: ['StatusKey0'], color: '#8b5cf6', bgColor: '#faf5ff' },
  { label: 'In Progress', statusKeys: ['StatusKey1'], color: '#f59e0b', bgColor: '#fffbeb' },
  { label: 'Completed', statusKeys: ['StatusKey2'], color: '#10b981', bgColor: '#ecfdf5' },
  { label: 'De-Prioritised', statusKeys: ['StatusKey3'], color: '#64748b', bgColor: '#f8fafc' },
  { label: 'O & S', statusKeys: ['StatusKey4'], color: '#04D9FF', bgColor: '#ecfeff' },
];

const TYPE_CONFIG = {
  hardware: { key: 'ProjecttypeKey0', label: 'ASSET', color: '#ea580c', bgColor: '#fff7ed' },
  software: { key: 'ProjecttypeKey1', label: 'DST', color: '#0891b2', bgColor: '#ecfeff' },
};

export function exportProjectsToPdf(projects: AISProjectManager[], title: string = 'AIS Project Summary'): void {
  // Group projects by status, then by type
  const groupedProjects: Record<string, { hardware: AISProjectManager[]; software: AISProjectManager[] }> = {};
  
  for (const group of STATUS_GROUPS) {
    const statusProjects = projects.filter(
      (p: AISProjectManager) => p.statusKey && group.statusKeys.includes(p.statusKey as AISProjectManagerStatusKey)
    ).sort((a: AISProjectManager, b: AISProjectManager) => 
      (a.projectname || '').localeCompare(b.projectname || '')
    );
    
    groupedProjects[group.label] = {
      hardware: statusProjects.filter((p: AISProjectManager) => p.projecttypeKey === TYPE_CONFIG.hardware.key),
      software: statusProjects.filter((p: AISProjectManager) => p.projecttypeKey === TYPE_CONFIG.software.key),
    };
  }

  // Generate PDF content (returns array of page streams)
  const pdfStreams = generatePdfContent(title, groupedProjects);
  
  // Build and download PDF
  const pdfContent = buildPdf(pdfStreams, 841.89, 595.28);
  downloadPdf(pdfContent, `ais-projects-summary-${formatDate(new Date())}.pdf`);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function generatePdfContent(title: string, groupedProjects: Record<string, { hardware: AISProjectManager[]; software: AISProjectManager[] }>): string[] {
  // A4 Landscape dimensions in points
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 30;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);
  
  // Page configurations: which status groups go on which page
  const page1Groups = ['Ideation', 'In Progress'];
  const page2Groups = ['Completed', 'De-Prioritised', 'O & S'];
  
  // Constants for project list rendering
  const lineHeight = 12;
  const itemSpacing = 4;
  const page1MaxCharsPerLine = 65;
  const page2MaxCharsPerLine = 45;
  const headerPadding = 20;
  const bottomPadding = 10;
  const headerHeight = 50;
  const footerHeight = 25;
  const columnsAreaHeight = contentHeight - headerHeight - footerHeight - 20;
  const subCardGap = 6;
  
  // Helper to wrap text
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    return lines;
  };
  
  // Helper function to calculate required height for a project list
  function calculateProjectListHeight(projects: AISProjectManager[], maxCharsPerLine: number): number {
    if (projects.length === 0) {
      return lineHeight + bottomPadding;
    }
    
    let totalHeight = 0;
    for (const project of projects) {
      const projectName = project.projectname || 'Untitled';
      const wrappedLines = wrapText(projectName, maxCharsPerLine);
      totalHeight += wrappedLines.length * lineHeight + itemSpacing;
    }
    return totalHeight + bottomPadding;
  }
  
  // Helper function to render project list within a sub-card
  function renderProjectList(
    projects: AISProjectManager[],
    startX: number,
    startY: number,
    bulletColor: string,
    maxCharsPerLine: number,
    addTextFn: (text: string, x: number, y: number, fontSize: number, fontWeight: 'normal' | 'bold', color: string) => void,
    addRectFn: (x: number, y: number, width: number, height: number, color: string) => void
  ) {
    let itemY = startY;
    
    if (projects.length === 0) {
      addTextFn('No projects', startX, itemY, 11, 'normal', '0.55 0.55 0.6');
      return;
    }
    
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const projectName = project.projectname || 'Untitled';
      const wrappedLines = wrapText(projectName, maxCharsPerLine);
      const totalItemHeight = wrappedLines.length * lineHeight + itemSpacing;
      
      addRectFn(startX, itemY + 3, 4, 4, bulletColor);
      
      for (let j = 0; j < wrappedLines.length; j++) {
        const lineX = startX + 9;
        addTextFn(wrappedLines[j], lineX, itemY - (j * lineHeight), 11, 'normal', '0.2 0.2 0.25');
      }
      
      itemY -= totalItemHeight;
    }
  }
  
  // Function to generate a single page
  function generatePage(
    pageTitle: string,
    statusLabels: string[],
    pageNumber: number,
    totalPages: number,
    maxCharsPerLine: number
  ): string {
    let currentStream = '';
    
    // Helper to add text
    const addText = (text: string, x: number, y: number, fontSize: number, fontWeight: 'normal' | 'bold' = 'normal', color: string = '0 0 0') => {
      const font = fontWeight === 'bold' ? '/F2' : '/F1';
      currentStream += `BT ${font} ${fontSize} Tf ${color} rg ${x} ${y} Td (${escapePdfString(text)}) Tj ET\n`;
    };
    
    // Helper to add a filled rectangle
    const addRect = (x: number, y: number, width: number, height: number, color: string) => {
      currentStream += `${color} rg ${x} ${y} ${width} ${height} re f\n`;
    };
    
    // Helper to add rounded rectangle
    const addRoundedRect = (x: number, y: number, width: number, height: number, radius: number, fillColor: string, strokeColor?: string) => {
      const r = Math.min(radius, width / 2, height / 2);
      currentStream += `${fillColor} rg\n`;
      if (strokeColor) {
        currentStream += `${strokeColor} RG 0.5 w\n`;
      }
      currentStream += `${x + r} ${y} m\n`;
      currentStream += `${x + width - r} ${y} l\n`;
      currentStream += `${x + width} ${y} ${x + width} ${y + r} ${x + width} ${y + r} c\n`;
      currentStream += `${x + width} ${y + height - r} l\n`;
      currentStream += `${x + width} ${y + height} ${x + width - r} ${y + height} ${x + width - r} ${y + height} c\n`;
      currentStream += `${x + r} ${y + height} l\n`;
      currentStream += `${x} ${y + height} ${x} ${y + height - r} ${x} ${y + height - r} c\n`;
      currentStream += `${x} ${y + r} l\n`;
      currentStream += `${x} ${y} ${x + r} ${y} ${x + r} ${y} c\n`;
      if (strokeColor) {
        currentStream += `b\n`;
      } else {
        currentStream += `f\n`;
      }
    };
    
    // ===== HEADER SECTION =====
    const headerY = pageHeight - margin - headerHeight;
    addRoundedRect(margin, headerY, contentWidth, headerHeight, 6, '0.98 0.98 0.99');
    
    // Title
    addText(pageTitle, margin + 15, headerY + 18, 20, 'bold', '0.1 0.1 0.15');
    
    // Page projects count badge
    const pageProjectCount = statusLabels.reduce((sum: number, label: string) => {
      const group = groupedProjects[label];
      return sum + (group ? group.hardware.length + group.software.length : 0);
    }, 0);
    const countText = `${pageProjectCount} Projects`;
    addRoundedRect(pageWidth - margin - 85, headerY + 15, 70, 22, 4, '0.2 0.2 0.25');
    addText(countText, pageWidth - margin - 75, headerY + 22, 9, 'bold', '1 1 1');
    
    // ===== STATUS COLUMNS =====
    const columnCount = statusLabels.length;
    const columnGap = 15;
    const columnWidth = (contentWidth - (columnGap * (columnCount - 1))) / columnCount;
    const columnsTopY = headerY - 15;
    
    // Calculate max heights for this page's columns
    let maxHwCardHeight = 0;
    let maxSwCardHeight = 0;
    
    for (const label of statusLabels) {
      const projectsInGroup = groupedProjects[label];
      if (!projectsInGroup) continue;
      const hwContentHeight = calculateProjectListHeight(projectsInGroup.hardware, maxCharsPerLine);
      const swContentHeight = calculateProjectListHeight(projectsInGroup.software, maxCharsPerLine);
      const hwCardHeight = headerPadding + hwContentHeight;
      const swCardHeight = headerPadding + swContentHeight;
      maxHwCardHeight = Math.max(maxHwCardHeight, hwCardHeight);
      maxSwCardHeight = Math.max(maxSwCardHeight, swCardHeight);
    }
    
    statusLabels.forEach((label: string, colIndex: number) => {
      const group = STATUS_GROUPS.find((g: StatusGroup) => g.label === label);
      if (!group) return;
      
      const projectsInGroup = groupedProjects[label];
      const columnX = margin + colIndex * (columnWidth + columnGap);
      const columnY = columnsTopY - columnsAreaHeight;
      const totalCount = projectsInGroup.hardware.length + projectsInGroup.software.length;
      
      // Main card background
      const bgRgb = hexToRgb(group.bgColor);
      const borderRgb = hexToRgb(group.color);
      addRoundedRect(columnX, columnY, columnWidth, columnsAreaHeight, 6, bgRgb, `${borderRgb.split(' ').map((v: string) => (parseFloat(v) * 0.6 + 0.2).toFixed(3)).join(' ')}`);
      
      // Colored accent bar at top
      const accentRgb = hexToRgb(group.color);
      addRoundedRect(columnX, columnsTopY - 5, columnWidth, 5, 2, accentRgb);
      
      // Status header
      const headerTextY = columnsTopY - 22;
      addText(group.label, columnX + 10, headerTextY, 11, 'bold', '0.15 0.15 0.2');
      
      // Count badge
      const countBadgeWidth = 24;
      const countBadgeX = columnX + columnWidth - countBadgeWidth - 8;
      addRoundedRect(countBadgeX, headerTextY - 5, countBadgeWidth, 18, 9, accentRgb);
      const statusCountText = String(totalCount);
      const countTextX = countBadgeX + (countBadgeWidth - statusCountText.length * 5) / 2;
      addText(statusCountText, countTextX, headerTextY, 9, 'bold', '1 1 1');
      
      // Sub-cards start position
      const subCardsStartY = headerTextY - 18;
      
      // ===== ASSET SUB-CARD =====
      const hwCardY = subCardsStartY - maxHwCardHeight;
      const hwBgRgb = hexToRgb(TYPE_CONFIG.hardware.bgColor);
      const hwColorRgb = hexToRgb(TYPE_CONFIG.hardware.color);
      addRoundedRect(columnX + 5, hwCardY, columnWidth - 10, maxHwCardHeight, 4, hwBgRgb);
      
      // Hardware accent bar
      addRect(columnX + 5, hwCardY + maxHwCardHeight - 3, columnWidth - 10, 3, hwColorRgb);
      
      // ASSET header
      const hwHeaderY = subCardsStartY - 14;
      addText('ASSET', columnX + 12, hwHeaderY, 8, 'bold', hwColorRgb);
      addText(`(${projectsInGroup.hardware.length})`, columnX + 38, hwHeaderY, 7, 'normal', '0.5 0.5 0.55');
      
      // ASSET projects
      renderProjectList(
        projectsInGroup.hardware, 
        columnX + 12, 
        hwHeaderY - 14, 
        hwColorRgb,
        maxCharsPerLine,
        addText,
        addRect
      );
      
      // ===== DST SUB-CARD =====
      const swCardY = hwCardY - subCardGap - maxSwCardHeight;
      const swBgRgb = hexToRgb(TYPE_CONFIG.software.bgColor);
      const swColorRgb = hexToRgb(TYPE_CONFIG.software.color);
      addRoundedRect(columnX + 5, swCardY, columnWidth - 10, maxSwCardHeight, 4, swBgRgb);
      
      // Software accent bar
      addRect(columnX + 5, swCardY + maxSwCardHeight - 3, columnWidth - 10, 3, swColorRgb);
      
      // DST header
      const swHeaderY = hwCardY - subCardGap - 14;
      addText('DST', columnX + 12, swHeaderY, 8, 'bold', swColorRgb);
      addText(`(${projectsInGroup.software.length})`, columnX + 30, swHeaderY, 7, 'normal', '0.5 0.5 0.55');
      
      // DST projects
      renderProjectList(
        projectsInGroup.software, 
        columnX + 12, 
        swHeaderY - 14, 
        swColorRgb,
        maxCharsPerLine,
        addText,
        addRect
      );
    });
    
    // ===== FOOTER =====
    const footerY = margin + 5;
    currentStream += `0.9 0.9 0.92 RG 0.5 w ${margin} ${footerY + footerHeight} m ${pageWidth - margin} ${footerY + footerHeight} l S\n`;
    
    const footerText = `Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`;
    addText(footerText, margin, footerY + 8, 7, 'normal', '0.5 0.5 0.55');
    addText(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin - 60, footerY + 8, 7, 'normal', '0.5 0.5 0.55');
    
    return currentStream;
  }
  
  // Generate both pages
  const page1Stream = generatePage(title, page1Groups, 1, 2, page1MaxCharsPerLine);
  const page2Stream = generatePage(title, page2Groups, 2, 2, page2MaxCharsPerLine);
  
  return [page1Stream, page2Stream];
}

function escapePdfString(str: string): string {
  // Replace common Unicode characters with ASCII equivalents
  // WinAnsiEncoding (used by Helvetica) doesn't support Unicode
  const unicodeReplacements: Record<string, string> = {
    '\u2022': '-',   // bullet
    '\u2713': 'Y',   // check mark
    '\u2714': 'Y',   // heavy check mark
    '\u2717': 'X',   // ballot x
    '\u2718': 'X',   // heavy ballot x
    '\u2019': "'",   // right single quote
    '\u2018': "'",   // left single quote
    '\u201C': '"',   // left double quote
    '\u201D': '"',   // right double quote
    '\u2013': '-',   // en dash
    '\u2014': '--',  // em dash
    '\u2026': '...', // ellipsis
    '\u00B7': '-',   // middle dot
    '\u25CF': 'o',   // black circle
    '\u25CB': 'o',   // white circle
    '\u2192': '->',  // right arrow
    '\u2190': '<-',  // left arrow
    '\u00A0': ' ',   // non-breaking space
  };
  
  let result = str;
  
  // Apply Unicode replacements
  for (const [unicode, replacement] of Object.entries(unicodeReplacements)) {
    result = result.split(unicode).join(replacement);
  }
  
  // Escape PDF special characters
  result = result
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  
  // Remove any remaining non-ASCII characters (outside printable range)
  // Keep only ASCII 32-126 (printable) plus common extended ASCII that WinAnsiEncoding supports
  result = result.replace(/[^\x20-\x7E\xA1-\xAC\xAE-\xFF]/g, '');
  
  return result;
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function buildPdf(streams: string[], pageWidth: number, pageHeight: number): string {
  const objects: string[] = [];
  let objectCount = 0;
  
  const addObject = (content: string): number => {
    objectCount++;
    objects.push(`${objectCount} 0 obj\n${content}\nendobj\n`);
    return objectCount;
  };
  
  // Object 1: Catalog
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  
  // Object 2: Pages (placeholder)
  const pagesObjNum = objectCount + 1;
  addObject('PAGES_PLACEHOLDER');
  
  // Object 3: Font 1 (Helvetica)
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  
  // Object 4: Font 2 (Helvetica-Bold)
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  
  // Create pages
  const pageObjNums: number[] = [];
  
  for (const stream of streams) {
    const contentObjNum = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageObjNum = addObject(
      `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Contents ${contentObjNum} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`
    );
    pageObjNums.push(pageObjNum);
  }
  
  // Update Pages object
  const pageRefs = pageObjNums.map((n: number) => `${n} 0 R`).join(' ');
  objects[1] = `${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageObjNums.length} >>\nendobj\n`;
  
  // Build PDF
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  
  // Cross-reference table
  const xrefStart = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  
  // Trailer
  pdf += 'trailer\n';
  pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefStart}\n`;
  pdf += '%%EOF';
  
  return pdf;
}

function downloadPdf(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
