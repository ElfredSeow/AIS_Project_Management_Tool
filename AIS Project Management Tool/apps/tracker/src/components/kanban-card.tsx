import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { Calendar, GripVertical, Target, ChevronRight, Flag, Pencil, Eye } from 'lucide-react';
import type { AISProjectManager } from '@/generated/models/aisproject-manager-model';
import { AISProjectManagerProjecttypeKeyToLabel } from '@/generated/models/aisproject-manager-model';
import { cn } from '@/lib/utils';
import { useProjectPriorities, getPriorityStyle, getPriorityLabel } from '@/hooks/use-project-priority';

type DateStatus = 'overdue' | 'due-soon' | 'on-track' | 'tbc' | 'completed' | 'de-prioritised' | 'o-and-s';

interface MilestoneData {
  title: string;
  description: string;
  expectedDate: string;
  completed: boolean;
}

interface KanbanCardProps {
  project: AISProjectManager;
  index: number;
  onEdit: () => void;
  onViewDetails: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isExpanded?: boolean;
  columnStatus?: string;
}

// Use start of day in local timezone to avoid timezone issues
const TODAY = new Date(2026, 3, 15); // April 15, 2026 (month is 0-indexed)

function getDateStatus(dateStr: string | null | undefined): DateStatus {
  if (!dateStr) return 'on-track';
  
  // Parse the date string as local date (not UTC)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Calculate difference in days
  const diffTime = date.getTime() - TODAY.getTime();
  const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Overdue - past the date
  if (daysDiff < 0) return 'overdue';
  
  // Due soon - within 7 days (0-7 days remaining)
  if (daysDiff <= 7) return 'due-soon';
  
  return 'on-track';
}

const statusConfig = {
  overdue: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Overdue',
  },
  'due-soon': {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'Due Soon',
  },
  'on-track': {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'On Track',
  },
  tbc: {
    border: 'border-l-gray-400',
    bg: 'bg-gray-400/10',
    text: 'text-gray-500 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: 'TBC',
  },
  completed: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    label: 'Completed',
  },
  'de-prioritised': {
    border: 'border-l-slate-500',
    bg: 'bg-slate-500/10',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500',
    label: 'De-Prioritised',
  },
  'o-and-s': {
    border: 'border-l-[#04D9FF]',
    bg: 'bg-[#04D9FF]/10',
    text: 'text-[#04D9FF]',
    dot: 'bg-[#04D9FF]',
    label: 'O & S',
  },
};

const typeColors: Record<string, string> = {
  ASSET: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  DST: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
};

export function KanbanCard({ project, index, onEdit, onViewDetails, onDragStart, isExpanded = false, columnStatus }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  // Sync with external isExpanded prop
  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  const { getPriority } = useProjectPriorities();
  const priority = getPriority(project.id);
  const priorityStyle = getPriorityStyle(priority);
  const typeLabel = project.projecttypeKey ? AISProjectManagerProjecttypeKeyToLabel[project.projecttypeKey] : '';

  // Parse milestones from JSON
  let milestones: MilestoneData[] = [];
  if (project.milestonesjsondata) {
    try {
      milestones = JSON.parse(project.milestonesjsondata) as MilestoneData[];
    } catch {
      milestones = [];
    }
  }
  
  // Get the first incomplete milestone by expected delivery date
  const nextMilestone = milestones
    .filter((m: MilestoneData) => !m.completed)
    .sort((a: MilestoneData, b: MilestoneData) => {
      if (!a.expectedDate) return 1;
      if (!b.expectedDate) return -1;
      return new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime();
    })
    .find(() => true);

  // Determine the nearest date and its status for the card indicator
  const milestoneDate = nextMilestone?.expectedDate || null;
  const targetDate = project.duedate || null;
  
  // Find the nearest date between milestone EDD and target completion
  let nearestDate: string | null = null;
  if (milestoneDate && targetDate) {
    // Both exist - use the one that comes first
    const milestoneTime = new Date(milestoneDate).getTime();
    const targetTime = new Date(targetDate).getTime();
    nearestDate = milestoneTime <= targetTime ? milestoneDate : targetDate;
  } else if (milestoneDate) {
    nearestDate = milestoneDate;
  } else if (targetDate) {
    nearestDate = targetDate;
  }
  
  // Calculate status based on the nearest date, or use column status for Completed/De-Prioritised/O & S
  let cardStatus: DateStatus;
  let statusLabel: string;
  
  // Column-specific status mapping
  const columnStatusMap: Record<string, DateStatus> = {
    'Completed': 'completed',
    'De-Prioritised': 'de-prioritised',
    'O & S': 'o-and-s',
  };
  
  const isColumnOverride = columnStatus === 'Completed' || columnStatus === 'De-Prioritised' || columnStatus === 'O & S';
  
  if (isColumnOverride && columnStatus) {
    // For Completed, De-Prioritised, and O & S columns, use column-specific status
    cardStatus = columnStatusMap[columnStatus];
    statusLabel = columnStatus;
  } else {
    // For other columns, use date-based status
    cardStatus = nearestDate ? getDateStatus(nearestDate) : 'tbc';
    statusLabel = statusConfig[cardStatus].label;
  }
  const statusStyle = statusConfig[cardStatus];
  
  // Individual date statuses for display - use column status color for Completed/De-Prioritised/O & S
  const milestoneStatus: DateStatus = isColumnOverride && columnStatus
    ? columnStatusMap[columnStatus]
    : (milestoneDate ? getDateStatus(milestoneDate) : 'tbc');
  const targetStatus: DateStatus = isColumnOverride && columnStatus
    ? columnStatusMap[columnStatus]
    : (targetDate ? getDateStatus(targetDate) : 'tbc');

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'TBC';
    return format(parseISO(dateStr), 'dd MMM yy').toUpperCase();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group cursor-grab active:cursor-grabbing"
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        whileHover={{ y: -6, boxShadow: '0 12px 24px -8px rgba(0, 0, 0, 0.15)' }}
        transition={{ duration: 0.2, ease: "easeOut" as const }}
        className={cn(
          'bg-card rounded-xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-border transition-all duration-200',
          'border-l-4 w-full flex flex-col rounded-xl',
          !expanded && 'min-h-[220px]',
          statusStyle.border
        )}
      >
        {/* Drag Handle & Title Row */}
        <div className="flex items-start gap-2 mb-3">
          <div className="mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <h4 className="flex-1 font-medium text-card-foreground text-sm line-clamp-4">
            {project.projectname}
          </h4>
          {/* Edit Button */}
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
            title="Edit project"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
          </button>
          {/* Expand Toggle */}
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <motion.div
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>
        </div>

        {/* Solution Type & Priority Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3 pl-6">
          <span
            className={cn(
              'px-2 py-0.5 rounded-md text-xs font-medium',
              typeColors[typeLabel] || 'bg-gray-100 text-gray-700'
            )}
          >
            {typeLabel}
          </span>
          {priority && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1',
                priorityStyle.bg,
                priorityStyle.text
              )}
            >
              <Flag className="w-3 h-3" />
              {getPriorityLabel(priority)}
            </span>
          )}
        </div>

        {/* Dates Section */}
        <div className="pl-6 space-y-2 mb-3 flex-1 min-h-0 overflow-hidden">
          {/* Start Date */}
          {project.startdate && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-muted">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground font-mono">Start Date:</span>
              </div>
              <span className="font-mono font-medium text-foreground">
                {formatDate(project.startdate)}
              </span>
            </div>
          )}

          {/* Milestone EDD */}
          {nextMilestone && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={cn('p-1 rounded', statusConfig[milestoneStatus].bg)}>
                  <Flag className={cn('w-3 h-3', statusConfig[milestoneStatus].text)} />
                </div>
                <span className="text-muted-foreground font-mono">Milestone EDD:</span>
              </div>
              <span className={cn('font-mono font-medium', statusConfig[milestoneStatus].text)}>
                {formatDate(nextMilestone.expectedDate)}
              </span>
            </div>
          )}

          {/* Target Completion */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={cn('p-1 rounded', statusConfig[targetStatus].bg)}>
                <Target className={cn('w-3 h-3', statusConfig[targetStatus].text)} />
              </div>
              <span className="text-muted-foreground font-mono">{columnStatus === 'Completed' || columnStatus === 'O & S' ? 'Completed Date:' : 'Target Completion:'}</span>
            </div>
            <span className={cn('font-mono font-medium', statusConfig[targetStatus].text)}>
              {formatDate(project.duedate)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pl-6 mt-auto">
          <div className="flex items-center gap-2">
            {/* Status Indicator */}
            <div className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', statusStyle.dot)} />
              <span className={cn('text-xs font-medium', statusStyle.text)}>
                {statusLabel}
              </span>
            </div>
          </div>
          {/* View Button */}
          <button
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' as const }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border/50 pl-6 space-y-3">
                {/* Problem Statement */}
                <div>
                  <p className="text-xs font-bold underline text-muted-foreground uppercase tracking-wide mb-1">Problem Statement</p>
                  <p className="text-sm text-card-foreground leading-relaxed">
                    {project.problemstatement || 'No problem statement provided.'}
                  </p>
                </div>

                {/* Proposed Solutions */}
                <div>
                  <p className="text-xs font-bold underline text-muted-foreground uppercase tracking-wide mb-1">Proposed Solutions</p>
                  <p className="text-sm text-card-foreground leading-relaxed">
                    {project.proposedsolution || 'No proposed solutions provided.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
