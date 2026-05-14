// PDF export utility - generates detailed PDF for selected projects
// Layout matches the read-only project detail modal

import type { AISProjectManager } from '@/generated/models/aisproject-manager-model';
import { AISProjectManagerProjecttypeKeyToLabel, AISProjectManagerStatusKeyToLabel } from '@/generated/models/aisproject-manager-model';

interface MilestoneData {
  title: string;
  description: string;
  expectedDate: string;
  completed: boolean;
}

interface Contributor {
  name: string;
  role: string;
}

const STATUS_COLORS: Record<string, { color: string; bgColor: string }> = {
  'StatusKey0': { color: '#8b5cf6', bgColor: '#faf5ff' }, // Ideation - Violet
  'StatusKey1': { color: '#f59e0b', bgColor: '#fffbeb' }, // In Progress - Amber
  'StatusKey2': { color: '#10b981', bgColor: '#ecfdf5' }, // Completed - Emerald
  'StatusKey3': { color: '#64748b', bgColor: '#f8fafc' }, // De-Prioritised - Slate
  'StatusKey4': { color: '#04D9FF', bgColor: '#ecfeff' }, // O & S - Cyan
};

const TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  'ProjecttypeKey0': { color: '#7c3aed', bgColor: '#f5f3ff' }, // Hardware - Violet
  'ProjecttypeKey1': { color: '#0891b2', bgColor: '#ecfeff' }, // Software - Cyan
};

export function exportProjectsDetailedPdf(projects: AISProjectManager[]): void {
  const pdfContent = generateDetailedPdfContent(projects);
  downloadPdf(pdfContent, `ais-projects-detailed-${formatDate(new Date())}.pdf`);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBC';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateDetailedPdfContent(projects: AISProjectManager[]): string {
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 35;
  const contentWidth = pageWidth - (margin * 2);
  
  const streams: string[] = [];
  let currentStream = '';
  let yPosition = pageHeight - margin;
  
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
  const addRoundedRect = (x: number, y: number, width: number, height: number, radius: number, fillColor: string) => {
    const r = Math.min(radius, width / 2, height / 2);
    currentStream += `${fillColor} rg\n`;
    currentStream += `${x + r} ${y} m\n`;
    currentStream += `${x + width - r} ${y} l\n`;
    currentStream += `${x + width} ${y} ${x + width} ${y + r} ${x + width} ${y + r} c\n`;
    currentStream += `${x + width} ${y + height - r} l\n`;
    currentStream += `${x + width} ${y + height} ${x + width - r} ${y + height} ${x + width - r} ${y + height} c\n`;
    currentStream += `${x + r} ${y + height} l\n`;
    currentStream += `${x} ${y + height} ${x} ${y + height - r} ${x} ${y + height - r} c\n`;
    currentStream += `${x} ${y + r} l\n`;
    currentStream += `${x} ${y} ${x + r} ${y} ${x + r} ${y} c\n`;
    currentStream += `f\n`;
  };

  // Helper to add line
  const addLine = (x1: number, y1: number, x2: number, y2: number, color: string, width: number = 0.5) => {
    currentStream += `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
  };
  
  // Helper to wrap text
  const wrapText = (text: string | null | undefined, maxCharsPerLine: number): string[] => {
    if (!text) return [];
    // First split by newlines to preserve line breaks
    const paragraphs = text.split(/\r?\n/);
    const allLines: string[] = [];
    
    for (const paragraph of paragraphs) {
      // Handle empty lines (preserve blank line from double newlines)
      if (paragraph.trim() === '') {
        allLines.push('');
        continue;
      }
      
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        if (currentLine.length === 0) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
          currentLine += ' ' + word;
        } else {
          allLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine.length > 0) {
        allLines.push(currentLine);
      }
    }
    return allLines;
  };

  // ===== COVER PAGE (Portrait with VERTICAL status rows, split by Hardware/Software) =====
  
  // Header card background
  addRoundedRect(margin, yPosition - 70, contentWidth, 75, 8, '0.98 0.98 0.99');
  
  // Title
  addText('AIS Project Report', margin + 20, yPosition - 25, 24, 'bold', '0.1 0.1 0.15');
  
  // Date
  const dateStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  addText(dateStr, margin + 20, yPosition - 45, 10, 'normal', '0.45 0.45 0.5');
  
  // Total projects badge on right
  const totalBadgeText = `${projects.length} Projects`;
  const totalBadgeWidth = totalBadgeText.length * 6 + 20;
  addRoundedRect(pageWidth - margin - totalBadgeWidth - 20, yPosition - 42, totalBadgeWidth, 24, 4, '0.1 0.1 0.15');
  addText(totalBadgeText, pageWidth - margin - totalBadgeWidth - 5, yPosition - 35, 10, 'bold', '1 1 1');
  
  yPosition -= 95;
  
  // Contents header
  addText('Contents', margin, yPosition, 14, 'bold', '0.2 0.2 0.25');
  yPosition -= 25;
  
  // Group projects by status, then by type (Hardware/Software)
  const statusOrder = ['StatusKey0', 'StatusKey1', 'StatusKey2', 'StatusKey3', 'StatusKey4'];
  const statusGroups: Record<string, { hardware: AISProjectManager[]; software: AISProjectManager[] }> = {};
  
  for (const key of statusOrder) {
    statusGroups[key] = { hardware: [], software: [] };
  }
  
  for (const project of projects) {
    const statusKey = project.statusKey || 'StatusKey0';
    const isHardware = project.projecttypeKey === 'ProjecttypeKey0';
    if (statusGroups[statusKey]) {
      if (isHardware) {
        statusGroups[statusKey].hardware.push(project);
      } else {
        statusGroups[statusKey].software.push(project);
      }
    }
  }
  
  // Get active statuses with projects
  const activeStatuses = statusOrder.filter((key: string) => 
    statusGroups[key].hardware.length > 0 || statusGroups[key].software.length > 0
  );
  
  // Calculate page number mapping
  let pageNumberMap: Record<string, number> = {};
  let pageNum = 2;
  for (const project of projects) {
    pageNumberMap[project.id] = pageNum;
    pageNum++;
  }
  
  // Layout constants for VERTICAL stacking
  const statusCardGap = 8;
  const subCardWidth = (contentWidth - 20) / 2; // Two sub-cards side by side within status row
  const maxCharsPerLine = 35; // Characters per line for project names
  const projectLineHeight = 11; // Height per line of text
  const projectGap = 4; // Extra gap between projects
  // Draw status cards VERTICALLY (stacked rows)
  for (const statusKey of activeStatuses) {
    const group = statusGroups[statusKey];
    const totalInStatus = group.hardware.length + group.software.length;
    if (totalInStatus === 0) continue;
    
    const statusConfig = STATUS_COLORS[statusKey] || STATUS_COLORS['StatusKey0'];
    const statusLabel = AISProjectManagerStatusKeyToLabel[statusKey as keyof typeof AISProjectManagerStatusKeyToLabel] || 'Unknown';
    
    // Show ALL projects (no limit)
    const hwProjects = group.hardware;
    const swProjects = group.software;
    
    // Calculate lines needed for each project
    const hwLines = hwProjects.reduce((acc: number, p: AISProjectManager) => {
      const lines = wrapText(p.projectname || 'Untitled', maxCharsPerLine);
      return acc + lines.length;
    }, 0);
    const swLines = swProjects.reduce((acc: number, p: AISProjectManager) => {
      const lines = wrapText(p.projectname || 'Untitled', maxCharsPerLine);
      return acc + lines.length;
    }, 0);
    const hwProjectCount = hwProjects.length;
    const swProjectCount = swProjects.length;
    
    // Calculate height: header (32) + max of (hw lines + gaps) or (sw lines + gaps) + extra padding (20)
    const hwContentHeight = hwLines * projectLineHeight + (hwProjectCount > 0 ? (hwProjectCount - 1) * projectGap : 0) + 20;
    const swContentHeight = swLines * projectLineHeight + (swProjectCount > 0 ? (swProjectCount - 1) * projectGap : 0) + 20;
    const dynamicHeight = 38 + Math.max(hwContentHeight, swContentHeight, 40);
    const cardHeight = Math.max(90, dynamicHeight);
    
    // Check if we need a new page
    if (yPosition - cardHeight < margin + 40) {
      // Add footer to current page
      addText(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, margin, margin + 10, 8, 'normal', '0.5 0.5 0.55');
      addText('AIS Project Report', pageWidth - margin - 80, margin + 10, 8, 'normal', '0.5 0.5 0.55');
      
      // Start new page
      streams.push(currentStream);
      currentStream = '';
      yPosition = pageHeight - margin;
    }
    
    // Main card background (full width)
    addRoundedRect(margin, yPosition - cardHeight, contentWidth, cardHeight, 6, hexToRgb(statusConfig.bgColor));
    
    // Color accent bar on left
    addRect(margin, yPosition - cardHeight, 5, cardHeight, hexToRgb(statusConfig.color));
    
    // Status name header
    addText(statusLabel, margin + 15, yPosition - 18, 12, 'bold', '0.15 0.15 0.2');
    
    // Count badge
    const countBadgeX = margin + 15 + statusLabel.length * 7;
    addRoundedRect(countBadgeX + 5, yPosition - 21, 20, 14, 7, hexToRgb(statusConfig.color));
    const countText = String(totalInStatus);
    addText(countText, countBadgeX + (countText.length === 1 ? 12 : 9), yPosition - 17, 9, 'bold', '1 1 1');
    
    const subCardStartY = yPosition - 30;
    const subCardHeight = cardHeight - 35;
    
    // === Hardware sub-card (LEFT) ===
    addRoundedRect(margin + 10, subCardStartY - subCardHeight, subCardWidth, subCardHeight, 4, '1 1 1');
    addRect(margin + 10, subCardStartY - subCardHeight, 3, subCardHeight, '0.953 0.518 0.22'); // Orange accent
    
    // ASSET header
    addText('ASSET', margin + 20, subCardStartY - 14, 9, 'bold', '0.91 0.45 0.16');
    addText(`(${group.hardware.length})`, margin + 55, subCardStartY - 14, 8, 'normal', '0.6 0.6 0.65');
    
    // ASSET projects
    let hwY = subCardStartY - 28;
    if (group.hardware.length === 0) {
      addText('No projects', margin + 20, hwY, 8, 'normal', '0.6 0.6 0.65');
    } else {
      hwProjects.forEach((project: AISProjectManager, projIdx: number) => {
        const projectName = project.projectname || 'Untitled';
        const wrappedLines = wrapText(projectName, maxCharsPerLine);
        
        // Bullet - aligned with first line
        addRoundedRect(margin + 18, hwY - 1, 5, 5, 2.5, '0.953 0.518 0.22');
        
        // All lines of project name
        wrappedLines.forEach((line: string, lineIdx: number) => {
          addText(line, margin + 28, hwY - (lineIdx * projectLineHeight), 8, 'normal', '0.2 0.2 0.25');
        });
        
        // Page number on right - aligned with first line
        const pNum = pageNumberMap[project.id];
        if (pNum) {
          addText(`Page ${pNum}`, margin + subCardWidth - 20, hwY, 7, 'normal', '0.5 0.5 0.55');
        }
        
        // Move Y down by total lines height + gap between projects
        hwY -= (wrappedLines.length * projectLineHeight) + (projIdx < hwProjects.length - 1 ? projectGap : 0);
      });
      
      // Show all projects - no '+X more' needed
    }
    
    // === DST sub-card (RIGHT) ===
    const rightCardX = margin + 15 + subCardWidth;
    addRoundedRect(rightCardX, subCardStartY - subCardHeight, subCardWidth, subCardHeight, 4, '1 1 1');
    addRect(rightCardX, subCardStartY - subCardHeight, 3, subCardHeight, '0.035 0.569 0.698'); // Cyan accent
    
    // DST header
    addText('DST', rightCardX + 10, subCardStartY - 14, 9, 'bold', '0.03 0.5 0.62');
    addText(`(${group.software.length})`, rightCardX + 40, subCardStartY - 14, 8, 'normal', '0.6 0.6 0.65');
    
    // DST projects
    let swY = subCardStartY - 28;
    if (group.software.length === 0) {
      addText('No projects', rightCardX + 10, swY, 8, 'normal', '0.6 0.6 0.65');
    } else {
      swProjects.forEach((project: AISProjectManager, projIdx: number) => {
        const projectName = project.projectname || 'Untitled';
        const wrappedLines = wrapText(projectName, maxCharsPerLine);
        
        // Bullet - aligned with first line
        addRoundedRect(rightCardX + 8, swY - 1, 5, 5, 2.5, '0.035 0.569 0.698');
        
        // All lines of project name
        wrappedLines.forEach((line: string, lineIdx: number) => {
          addText(line, rightCardX + 18, swY - (lineIdx * projectLineHeight), 8, 'normal', '0.2 0.2 0.25');
        });
        
        // Page number on right - aligned with first line
        const pNum = pageNumberMap[project.id];
        if (pNum) {
          addText(`Page ${pNum}`, rightCardX + subCardWidth - 30, swY, 7, 'normal', '0.5 0.5 0.55');
        }
        
        // Move Y down by total lines height + gap between projects
        swY -= (wrappedLines.length * projectLineHeight) + (projIdx < swProjects.length - 1 ? projectGap : 0);
      });
      
      // Show all projects - no '+X more' needed
    }
    
    yPosition -= cardHeight + statusCardGap;
  }
  
  // Footer on cover page
  addText(`Generated on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, margin, margin + 10, 8, 'normal', '0.5 0.5 0.55');
  addText('AIS Project Report', pageWidth - margin - 80, margin + 10, 8, 'normal', '0.5 0.5 0.55');
  
  // Start new page for project details
  streams.push(currentStream);
  currentStream = '';
  yPosition = pageHeight - margin;
  
  // ===== PROJECT DETAILS - One page per project =====
  // Sort projects by start date (latest first), projects without start date go to the end
  const sortedProjects = [...projects].sort((a: AISProjectManager, b: AISProjectManager) => {
    // Projects without start date go to the end
    if (!a.startdate && !b.startdate) return 0;
    if (!a.startdate) return 1;
    if (!b.startdate) return -1;
    // Sort by start date descending (latest first)
    return b.startdate.localeCompare(a.startdate);
  });
  
  sortedProjects.forEach((project: AISProjectManager, projectIndex: number) => {
    // Start each project on a new page (except first)
    if (projectIndex > 0) {
      streams.push(currentStream);
      currentStream = '';
      yPosition = pageHeight - margin;
    }
    
    const statusConfig = STATUS_COLORS[project.statusKey] || STATUS_COLORS['StatusKey0'];
    const typeConfig = TYPE_COLORS[project.projecttypeKey] || TYPE_COLORS['ProjecttypeKey0'];
    const statusLabel = project.statusKey ? AISProjectManagerStatusKeyToLabel[project.statusKey] || 'Unknown' : 'Unknown';
    const typeLabel = project.projecttypeKey ? AISProjectManagerProjecttypeKeyToLabel[project.projecttypeKey] || 'Unknown' : 'Unknown';
    
    // ===== HEADER SECTION =====
    // Header background with gradient effect
    addRoundedRect(margin, yPosition - 55, contentWidth, 60, 6, hexToRgb(statusConfig.bgColor));
    addRect(margin, yPosition - 55, 5, 60, hexToRgb(statusConfig.color));
    
    // Project title (wrapped if needed)
    const titleLines = wrapText(project.projectname || 'Untitled Project', 60);
    addText(titleLines[0] || '', margin + 15, yPosition - 20, 16, 'bold', '0.1 0.1 0.15');
    if (titleLines[1]) {
      addText(titleLines[1], margin + 15, yPosition - 36, 14, 'bold', '0.1 0.1 0.15');
    }
    
    yPosition -= 70;
    
    // ===== SOLUTION TYPE & PROJECT STAGE LABELS =====
    addText('Solution Type:', margin, yPosition, 8, 'bold', '0.4 0.4 0.45');
    addText(typeLabel, margin + 55, yPosition, 8, 'normal', hexToRgb(typeConfig.color));
    
    addText('Project Stage:', margin + 130, yPosition, 8, 'bold', '0.4 0.4 0.45');
    addText(statusLabel, margin + 190, yPosition, 8, 'normal', hexToRgb(statusConfig.color));
    
    yPosition -= 18;
    
    // ===== PROGRESS BAR =====
    let milestones: MilestoneData[] = [];
    if (project.milestonesjsondata) {
      try {
        milestones = JSON.parse(project.milestonesjsondata) as MilestoneData[];
      } catch {
        milestones = [];
      }
    }
    const completedCount = milestones.filter((m: MilestoneData) => m.completed).length;
    const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
    
    addText('Overall Progress', margin, yPosition, 9, 'bold', '0.4 0.4 0.45');
    addText(`${progress}%`, pageWidth - margin - 25, yPosition, 9, 'bold', '0.2 0.2 0.25');
    yPosition -= 12;
    
    // Progress bar background
    addRoundedRect(margin, yPosition - 6, contentWidth, 8, 4, '0.92 0.92 0.95');
    // Progress bar fill
    if (progress > 0) {
      const progressColor = progress === 100 ? '0.063 0.725 0.506' : progress >= 50 ? '0.961 0.62 0.043' : '0.231 0.51 0.965';
      addRoundedRect(margin, yPosition - 6, contentWidth * (progress / 100), 8, 4, progressColor);
    }
    yPosition -= 20;
    
    // ===== CONTRIBUTORS (if any) =====
    let contributors: Contributor[] = [];
    if (project.contributorsjsondata) {
      try {
        const parsed = JSON.parse(project.contributorsjsondata);
        if (Array.isArray(parsed)) {
          contributors = parsed.map((c: { name?: string; role?: string }) => ({
            name: c.name || 'Unknown',
            role: c.role || 'Team Member'
          }));
        }
      } catch {
        contributors = [{ name: project.contributorsjsondata, role: 'Team Member' }];
      }
    }
    
    if (contributors.length > 0) {
      addText('Project Team', margin, yPosition, 10, 'bold', '0.15 0.15 0.2');
      yPosition -= 5;
      
      // Display contributors in cards
      const cardWidth = 130;
      const cardGap = 10;
      let xPos = margin;
      
      // Find project manager and developer
      const projectManager = contributors.find((c: Contributor) => c.role?.toLowerCase().includes('manager') || c.role?.toLowerCase().includes('pm'));
      const developer = contributors.find((c: Contributor) => c.role?.toLowerCase().includes('developer') || c.role?.toLowerCase().includes('dev'));
      const displayContributors = [
        projectManager || contributors[0],
        developer || contributors[1]
      ].filter(Boolean);
      
      displayContributors.forEach((c: Contributor) => {
        // Card background
        addRoundedRect(xPos, yPosition - 40, cardWidth, 40, 5, '0.98 0.98 0.99');
        // Role label (smaller, muted)
        const roleLabel = c.role?.toLowerCase().includes('manager') ? 'PROJECT MANAGER' : 
                          c.role?.toLowerCase().includes('developer') ? 'DEVELOPER' : 
                          c.role?.toUpperCase().substring(0, 20) || 'TEAM MEMBER';
        addText(roleLabel, xPos + 12, yPosition - 12, 6, 'normal', '0.5 0.5 0.55');
        // Name (larger, bold)
        addText((c.name || 'Unknown').substring(0, 18), xPos + 12, yPosition - 26, 9, 'bold', '0.15 0.15 0.2');
        xPos += cardWidth + cardGap;
      });
      yPosition -= 45;
    }
    
    // ===== DYNAMIC TWO-COLUMN LAYOUT: Problem Statement & Proposed Solution =====
    const colWidth = (contentWidth - 10) / 2;
    const textWidth = 60; // Character wrap width to use full card space
    const lineHeightText = 10; // Line height for text content
    const cardPaddingTop = 28; // Space for header
    const cardPaddingBottom = 12; // Bottom padding
    const minCardHeight = 60; // Minimum card height
    
    // Calculate dynamic heights for Problem Statement and Proposed Solution
    const problemLines = wrapText(project.problemstatement || 'No problem statement provided.', textWidth);
    const solutionLines = wrapText(project.proposedsolution || 'No proposed solution provided.', textWidth);
    
    const problemContentHeight = problemLines.length * lineHeightText;
    const solutionContentHeight = solutionLines.length * lineHeightText;
    
    // Use the max height between both cards for uniform row height
    const row1CardHeight = Math.max(minCardHeight, cardPaddingTop + Math.max(problemContentHeight, solutionContentHeight) + cardPaddingBottom);
    
    // Check if we need a new page for this section
    if (yPosition - row1CardHeight < margin + 200) {
      // Add page number and start new page
      addText(`Page ${streams.length + 2}`, pageWidth - margin - 40, margin - 10, 8, 'normal', '0.6 0.6 0.65');
      streams.push(currentStream);
      currentStream = '';
      yPosition = pageHeight - margin;
    }
    
    // Problem Statement card (left)
    addRoundedRect(margin, yPosition - row1CardHeight, colWidth, row1CardHeight, 5, '0.996 0.949 0.953');
    addRect(margin, yPosition - row1CardHeight, 4, row1CardHeight, '0.956 0.333 0.388');
    addText('Problem Statement', margin + 12, yPosition - 14, 9, 'bold', '0.88 0.28 0.35');
    problemLines.forEach((line: string, idx: number) => {
      addText(line, margin + 12, yPosition - 30 - (idx * lineHeightText), 8, 'normal', '0.2 0.2 0.25');
    });
    
    // Proposed Solution card (right)
    addRoundedRect(margin + colWidth + 10, yPosition - row1CardHeight, colWidth, row1CardHeight, 5, '0.925 0.992 0.961');
    addRect(margin + colWidth + 10, yPosition - row1CardHeight, 4, row1CardHeight, '0.063 0.725 0.506');
    addText('Proposed Solution', margin + colWidth + 22, yPosition - 14, 9, 'bold', '0.05 0.65 0.45');
    solutionLines.forEach((line: string, idx: number) => {
      addText(line, margin + colWidth + 22, yPosition - 30 - (idx * lineHeightText), 8, 'normal', '0.2 0.2 0.25');
    });
    
    yPosition -= row1CardHeight + 10;

    // ===== DYNAMIC TWO-COLUMN LAYOUT: Expected Benefits & Man-Hours Saved =====
    // Calculate dynamic heights for Expected Benefits
    const benefitsLines = wrapText(project.expectedbenefits || 'No expected benefits documented.', textWidth);
    const benefitsContentHeight = benefitsLines.length * lineHeightText;
    
    // Man-Hours card has fixed content (just the number), so use a reasonable minimum
    const manHoursMinHeight = 70;
    
    // Use the max height between both cards for uniform row height
    const row2CardHeight = Math.max(minCardHeight, manHoursMinHeight, cardPaddingTop + benefitsContentHeight + cardPaddingBottom);
    
    // Check if we need a new page for this section
    if (yPosition - row2CardHeight < margin + 150) {
      // Add page number and start new page
      addText(`Page ${streams.length + 2}`, pageWidth - margin - 40, margin - 10, 8, 'normal', '0.6 0.6 0.65');
      streams.push(currentStream);
      currentStream = '';
      yPosition = pageHeight - margin;
    }
    
    // Expected Benefits card (left)
    addRoundedRect(margin, yPosition - row2CardHeight, colWidth, row2CardHeight, 5, '0.937 0.961 0.996');
    addRect(margin, yPosition - row2CardHeight, 4, row2CardHeight, '0.231 0.51 0.965');
    addText('Expected Benefits', margin + 12, yPosition - 14, 9, 'bold', '0.2 0.45 0.9');
    benefitsLines.forEach((line: string, idx: number) => {
      addText(line, margin + 12, yPosition - 30 - (idx * lineHeightText), 8, 'normal', '0.2 0.2 0.25');
    });
    
    // Man-Hours Saved card (right)
    addRoundedRect(margin + colWidth + 10, yPosition - row2CardHeight, colWidth, row2CardHeight, 5, '0.996 0.976 0.929');
    addRect(margin + colWidth + 10, yPosition - row2CardHeight, 4, row2CardHeight, '0.961 0.62 0.043');
    addText('Est. Man-Hours Saved', margin + colWidth + 22, yPosition - 14, 9, 'bold', '0.85 0.55 0.03');
    const manHours = project.estimatedmanhourssaved ? `${project.estimatedmanhourssaved.toLocaleString()}` : '-';
    addText(manHours, margin + colWidth + 22, yPosition - 38, 22, 'bold', '0.15 0.15 0.2');
    addText('hours/year', margin + colWidth + 22 + manHours.length * 12 + 8, yPosition - 38, 9, 'normal', '0.5 0.5 0.55');
    
    yPosition -= row2CardHeight + 20;
    // ===== TIMELINE SECTION =====
    const timelineCardWidth = (contentWidth - 10) / 2;
    const timelineHeight = 45;
    
    addText('Timeline', margin, yPosition, 10, 'bold', '0.15 0.15 0.2');
    yPosition -= 5;
    
    // Start date card
    addRoundedRect(margin, yPosition - timelineHeight, timelineCardWidth, timelineHeight, 5, '0.97 0.97 0.98');
    addText('Start Date', margin + 12, yPosition - 14, 8, 'bold', '0.5 0.5 0.55');
    addText(formatDisplayDate(project.startdate), margin + 12, yPosition - 32, 11, 'bold', '0.15 0.15 0.2');
    
    // Target completion card - show "Completed Date" for Completed and O & S statuses
    const isCompletedOrOS = project.statusKey === 'StatusKey2' || project.statusKey === 'StatusKey4';
    const completionLabel = isCompletedOrOS ? 'Completed Date' : 'Target Completion';
    addRoundedRect(margin + timelineCardWidth + 10, yPosition - timelineHeight, timelineCardWidth, timelineHeight, 5, '0.97 0.97 0.98');
    addText(completionLabel, margin + timelineCardWidth + 22, yPosition - 14, 8, 'bold', '0.5 0.5 0.55');
    addText(formatDisplayDate(project.duedate), margin + timelineCardWidth + 22, yPosition - 32, 11, 'bold', '0.15 0.15 0.2');
    
    yPosition -= timelineHeight + 28;
    
    // ===== MILESTONES SECTION =====
    if (milestones.length > 0) {
      addText('Project Milestones', margin, yPosition, 10, 'bold', '0.15 0.15 0.2');
      addText(`${completedCount}/${milestones.length} completed`, margin + 100, yPosition, 8, 'normal', '0.5 0.5 0.55');
      yPosition -= 15;
      
      // Calculate height for each milestone
      const milestoneTitleWrapWidth = 65; // Characters for title wrapping
      const milestoneDescWrapWidth = 80; // Characters for description wrapping
      const lineHeight = 10;
      const milestoneGap = 6;
      const milestoneBasePadding = 16; // Top + bottom padding
      
      // Process all milestones (up to 8 to fit on page)
      const displayMilestones = milestones.slice(0, 8);
      
      displayMilestones.forEach((milestone: MilestoneData) => {
        // Wrap title and description
        const titleLines = wrapText(milestone.title || 'Untitled', milestoneTitleWrapWidth);
        const descLines = milestone.description 
          ? wrapText(milestone.description, milestoneDescWrapWidth)
          : [];
        
        // Calculate dynamic height: title lines + desc lines + padding
        const titleHeight = titleLines.length * lineHeight;
        const descHeight = descLines.length * (lineHeight - 1); // Slightly smaller line height for description
        const milestoneHeight = Math.max(36, milestoneBasePadding + titleHeight + descHeight + 4);
        
        // Check if we need a new page
        if (yPosition - milestoneHeight < margin + 30) {
          // Add footer and start new page
          addText(`Page ${streams.length + 2}`, pageWidth - margin - 40, margin - 10, 8, 'normal', '0.6 0.6 0.65');
          streams.push(currentStream);
          currentStream = '';
          yPosition = pageHeight - margin;
          addText('Project Milestones (continued)', margin, yPosition, 10, 'bold', '0.15 0.15 0.2');
          yPosition -= 15;
        }
        
        const bgColor = milestone.completed ? '0.925 0.992 0.961' : '0.97 0.97 0.98';
        const accentColor = milestone.completed ? '0.063 0.725 0.506' : '0.7 0.7 0.75';
        
        addRoundedRect(margin, yPosition - milestoneHeight, contentWidth, milestoneHeight, 4, bgColor);
        
        // Checkbox circle - green for completed, gray for incomplete
        addRoundedRect(margin + 8, yPosition - 15, 12, 12, 6, accentColor);
        
        // Title - fully wrapped
        const titleColor = milestone.completed ? '0.05 0.65 0.45' : '0.2 0.2 0.25';
        let titleY = yPosition - 12;
        titleLines.forEach((line: string, idx: number) => {
          const xOffset = idx === 0 ? margin + 28 : margin + 28;
          addText(line, xOffset, titleY - (idx * lineHeight), 9, 'bold', titleColor);
        });
        
        // Date on right - aligned with first line of title
        addText(formatDisplayDate(milestone.expectedDate), pageWidth - margin - 70, yPosition - 12, 7, 'normal', '0.5 0.5 0.55');
        
        // Description - fully wrapped below title
        if (descLines.length > 0) {
          const descStartY = titleY - (titleLines.length * lineHeight) - 2;
          descLines.forEach((line: string, idx: number) => {
            addText(line, margin + 28, descStartY - (idx * (lineHeight - 1)), 7, 'normal', '0.5 0.5 0.55');
          });
        }
        
        yPosition -= milestoneHeight + milestoneGap;
      });
      
      if (milestones.length > 8) {
        addText(`+${milestones.length - 8} more milestones...`, margin + 28, yPosition, 8, 'normal', '0.5 0.5 0.55');
      }
    }
    
    // Page number
    addText(`Page ${projectIndex + 2}`, pageWidth - margin - 40, margin - 10, 8, 'normal', '0.6 0.6 0.65');
  });
  
  // Push final stream
  streams.push(currentStream);
  
  return buildPdf(streams, pageWidth, pageHeight);
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
