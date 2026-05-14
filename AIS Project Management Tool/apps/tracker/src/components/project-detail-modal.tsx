import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  X,
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  Circle,
  Users,
  Lightbulb,
  TrendingUp,
  Flag,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { AISProjectManager } from '@/generated/models/aisproject-manager-model';
import { AISProjectManagerProjecttypeKeyToLabel } from '@/generated/models/aisproject-manager-model';
import { useProjectMediaURLList } from '@/generated/hooks/use-project-media-url';
import { useProjectPriorities, getPriorityStyle } from '@/hooks/use-project-priority';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

interface ProjectDetailModalProps {
  project: AISProjectManager | null;
  isOpen: boolean;
  onClose: () => void;
}

const TODAY = new Date(2026, 3, 16); // April 16, 2026


// Helper function to ensure URL has a protocol prefix
function ensureUrlProtocol(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
function getDateStatus(dateStr: string | null | undefined): 'overdue' | 'due-soon' | 'on-track' | 'tbc' {
  if (!dateStr) return 'tbc';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const diffTime = date.getTime() - TODAY.getTime();
  const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (daysDiff < 0) return 'overdue';
  if (daysDiff <= 7) return 'due-soon';
  return 'on-track';
}

const statusColors = {
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  'due-soon': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  'on-track': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  tbc: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  'de-prioritised': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  'o-and-s': 'bg-[#04D9FF]/10 text-[#04D9FF] border-[#04D9FF]/30',
};

const typeColors: Record<string, { bg: string; text: string; glow: string }> = {
  ASSET: {
    bg: 'from-violet-500/20 to-purple-600/20',
    text: 'text-violet-600 dark:text-violet-400',
    glow: 'shadow-violet-500/20',
  },
  DST: {
    bg: 'from-sky-500/20 to-cyan-600/20',
    text: 'text-sky-600 dark:text-sky-400',
    glow: 'shadow-sky-500/20',
  },
};

export function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  const { data: allMediaUrls } = useProjectMediaURLList();
  const { getPriority } = useProjectPriorities();
  
  if (!project) return null;

  // Filter media URLs for this project
  const projectMediaUrls = allMediaUrls?.filter(
    (m) => m.projectid === project.id
  ) || [];

  // Parse media URLs from JSON data
  interface MediaItem {
    url: string;
    label: string;
  }
  
  const mediaItems: MediaItem[] = [];
  projectMediaUrls.forEach((m) => {
    if (m.urljsondata) {
      try {
        const parsed = JSON.parse(m.urljsondata) as MediaItem[];
        parsed.forEach((item: MediaItem) => {
          if (item.url?.trim() && item.label?.trim()) {
            mediaItems.push(item);
          }
        });
      } catch {
        // Skip invalid JSON
      }
    }
  });

  const typeLabel = project.projecttypeKey
    ? AISProjectManagerProjecttypeKeyToLabel[project.projecttypeKey]
    : 'Unknown';
  const typeStyle = typeColors[typeLabel] || typeColors.DST;

  // Parse milestones
  let milestones: MilestoneData[] = [];
  if (project.milestonesjsondata) {
    try {
      milestones = JSON.parse(project.milestonesjsondata) as MilestoneData[];
    } catch {
      milestones = [];
    }
  }

  // Parse contributors - can be JSON array or comma-separated
  const contributorsByRole = new Map<string, Contributor[]>();
  
  // Try parsing as JSON first (array of {name, role} objects)
  if (project.contributorsjsondata) {
    try {
      const parsed = JSON.parse(project.contributorsjsondata);
      if (Array.isArray(parsed)) {
        parsed.forEach((contributor: { name?: string; role?: string }) => {
          const name = contributor.name || 'Unknown';
          const role = contributor.role || 'Team Member';
          if (!contributorsByRole.has(role)) {
            contributorsByRole.set(role, []);
          }
          contributorsByRole.get(role)!.push({ name, role });
        });
      }
    } catch {
      // Legacy: single contributor stored as plain text
      const role = 'Team Member';
      if (!contributorsByRole.has(role)) {
        contributorsByRole.set(role, []);
      }
      contributorsByRole.get(role)!.push({ name: project.contributorsjsondata, role });
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'TBC';
    return format(parseISO(dateStr), 'MMM d, yyyy');
  };

  const calculateProgress = () => {
    if (!milestones.length) return 0;
    const completed = milestones.filter((m: MilestoneData) => m.completed).length;
    return Math.round((completed / milestones.length) * 100);
  };

  const progress = calculateProgress();

  const calculateDaysRemaining = () => {
    if (!project.duedate) return null;
    const [year, month, day] = project.duedate.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    return differenceInDays(dueDate, TODAY);
  };

  const daysRemaining = calculateDaysRemaining();

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  } as const;

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: { duration: 0.2 },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  } as const;

  const staggerItem = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl',
              'bg-gradient-to-br from-card via-card to-card/95',
              'border border-border/50 shadow-2xl',
              typeStyle.glow
            )}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Decorative gradient background */}
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-30 pointer-events-none',
                typeStyle.bg
              )}
            />
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Content wrapper with scroll */}
            <div className="relative overflow-y-auto max-h-[90vh] custom-scrollbar">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-b from-card via-card to-card/0 pt-6 px-8 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                      className="flex items-center gap-3 mb-3"
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-3 py-1 text-xs font-semibold uppercase tracking-wider border-2',
                          typeLabel === 'ASSET'
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/40'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/40'
                        )}
                      >
                        <Sparkles className="w-3 h-3 mr-1.5" />
                        {typeLabel}
                      </Badge>
                      {(() => {
                        const priority = getPriority(project.id);
                        if (!priority) return null;
                        const style = getPriorityStyle(priority);
                        return (
                          <Badge
                            variant="outline"
                            className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
                          >
                            <Flag className="w-3 h-3 mr-1.5" />
                            P{priority}
                          </Badge>
                        );
                      })()}
                      {daysRemaining !== null && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-3 py-1 text-xs font-semibold border',
                            statusColors[getDateStatus(project.duedate)]
                          )}
                        >
                          <Clock className="w-3 h-3 mr-1.5" />
                          {daysRemaining < 0
                            ? `${Math.abs(daysRemaining)} days overdue`
                            : daysRemaining === 0
                              ? 'Due today'
                              : `${daysRemaining} days remaining`}
                        </Badge>
                      )}
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="text-2xl font-bold text-foreground leading-tight"
                    >
                      {project.projectname}
                    </motion.h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Content Grid */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="px-8 pb-8 space-y-3"
              >
                {/* Progress Bar */}
                <motion.div variants={staggerItem} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
                    <span className="text-sm font-bold text-foreground">{progress}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' as const }}
                      className={cn(
                        'h-full rounded-full bg-gradient-to-r',
                        progress === 100
                          ? 'from-emerald-500 to-green-500'
                          : progress >= 50
                            ? 'from-amber-500 to-orange-500'
                            : 'from-blue-500 to-indigo-500'
                      )}
                    />
                  </div>
                </motion.div>

                {/* Contributors Section */}
                {contributorsByRole.size > 0 && (
                  <motion.div variants={staggerItem}>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className={cn('w-5 h-5', typeStyle.text)} />
                      <h3 className="text-lg font-semibold text-foreground">Project Team</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Array.from(contributorsByRole.entries()).map(([role, contributors]) => (
                        <div
                          key={role}
                          className="bg-muted/50 rounded-xl p-4 border border-border/50"
                        >
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {role}
                          </div>
                          <div className="space-y-1">
                            {contributors.map((c: Contributor, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">
                                    {c.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm font-medium text-foreground truncate">
                                  {c.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Problem Statement & Solution */}
                <motion.div variants={staggerItem} className="grid md:grid-cols-2 gap-4">
                  <motion.div
                    variants={staggerItem}
                    className="bg-gradient-to-br from-rose-500/5 to-orange-500/5 rounded-xl p-5 border border-rose-500/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-rose-500/10">
                        <Lightbulb className="w-4 h-4 text-rose-500" />
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Problem Statement
                      </h3>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {project.problemstatement || 'No problem statement provided.'}
                    </p>
                  </motion.div>

                  <motion.div
                    variants={staggerItem}
                    className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-xl p-5 border border-emerald-500/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Proposed Solution
                      </h3>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {project.proposedsolution || 'No proposed solution provided.'}
                    </p>
                  </motion.div>
                </motion.div>

                {/* Benefits & Man Hours */}
                <motion.div variants={staggerItem} className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-xl p-5 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Expected Benefits
                      </h3>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {project.expectedbenefits || 'No expected benefits documented.'}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 rounded-xl p-5 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Est. Man-Hours Savings
                      </h3>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        {project.estimatedmanhourssaved?.toLocaleString() || '—'}
                      </span>
                      <span className="text-sm text-muted-foreground">hours/year</span>
                    </div>
                  </div>
                </motion.div>

                {/* Timeline Section */}
                <motion.div variants={staggerItem}>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className={cn('w-5 h-5', typeStyle.text)} />
                    <h3 className="text-lg font-semibold text-foreground">Timeline</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Project Start
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {formatDate(project.startdate)}
                      </div>
                    </div>
                    <div className={cn(
                      'rounded-xl p-4 border',
                      project.statusKey === 'StatusKey2' ? statusColors.completed :
                      project.statusKey === 'StatusKey3' ? statusColors['de-prioritised'] :
                      project.statusKey === 'StatusKey4' ? statusColors['o-and-s'] :
                      statusColors[getDateStatus(project.duedate)]
                    )}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">
                        {project.statusKey === 'StatusKey2' || project.statusKey === 'StatusKey4' ? 'Completed Date' : 'Target Completion'}
                      </div>
                      <div className="text-lg font-bold">
                        {formatDate(project.duedate)}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Milestones */}
                {milestones.length > 0 && (
                  <motion.div variants={staggerItem}>
                    <div className="flex items-center gap-2 mb-4">
                      <Flag className={cn('w-5 h-5', typeStyle.text)} />
                      <h3 className="text-lg font-semibold text-foreground">Project Milestones</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {milestones.filter((m: MilestoneData) => m.completed).length} / {milestones.length} completed
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {milestones.map((milestone: MilestoneData, idx: number) => {
                        const milestoneStatus = milestone.completed
                          ? 'completed'
                          : getDateStatus(milestone.expectedDate);
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + idx * 0.1 }}
                            className={cn(
                              'relative flex items-start gap-4 p-4 rounded-xl border transition-all',
                              milestone.completed
                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                            )}
                          >
                            {/* Timeline connector */}
                            {idx < milestones.length - 1 && (
                              <div className="absolute left-[26px] top-[48px] w-0.5 h-[calc(100%-16px)] bg-border/50" />
                            )}
                            
                            <div
                              className={cn(
                                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                                milestone.completed
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-muted border-2 border-border'
                              )}
                            >
                              {milestone.completed ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4
                                  className={cn(
                                    'font-medium',
                                    milestone.completed
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-foreground'
                                  )}
                                >
                                  {milestone.title}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs flex-shrink-0',
                                    milestone.completed
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : statusColors[milestoneStatus as keyof typeof statusColors]
                                  )}
                                >
                                  <Target className="w-3 h-3 mr-1" />
                                  {milestone.completed ? 'Done' : formatDate(milestone.expectedDate)}
                                </Badge>
                              </div>
                              {milestone.description && (
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                                  {milestone.description}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Media URLs Section */}
                {mediaItems.length > 0 && (
                  <motion.div variants={staggerItem}>
                    <div className="flex items-center gap-2 mb-4">
                      <ExternalLink className={cn('w-5 h-5', typeStyle.text)} />
                      <h3 className="text-lg font-semibold text-foreground">Media</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {mediaItems.length} {mediaItems.length === 1 ? 'link' : 'links'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mediaItems.map((item: MediaItem, idx: number) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="gap-2 bg-primary/10 text-primary border-primary/40 hover:bg-primary/20"
                          onClick={() => {
                            if (item.url?.trim()) {
                              window.open(ensureUrlProtocol(item.url), '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
