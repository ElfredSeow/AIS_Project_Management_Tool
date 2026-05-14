import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/excel-export';
import { exportProjectsToPdf } from '@/lib/pdf-export';
import { useAISProjectManagerList, useUpdateAISProjectManager, useCreateAISProjectManager } from '@/generated/hooks/use-aisproject-manager';
import type { AISProjectManager, AISProjectManagerStatusKey, AISProjectManagerProjecttypeKey } from '@/generated/models/aisproject-manager-model';
import { useProjectPriorities } from '@/hooks/use-project-priority';


import { Button } from '@/components/ui/button';
import { KanbanCard } from '@/components/kanban-card';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { ProjectDetailModal } from '@/components/project-detail-modal';
import { ExportProjectsDialog } from '@/components/export-projects-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Layers, Cpu, HardDrive, ArrowUpDown, Filter, Sun, Moon, ChevronsUpDown, Download, FileText, FileDown } from 'lucide-react';



type ColumnConfig = (typeof STATUS_COLUMNS)[number];

const TODAY = new Date();

// Status columns configuration
const STATUS_COLUMNS = [
  {
    id: 'ideation',
    label: 'Ideation',
    statusKeys: ['StatusKey0'] as AISProjectManagerStatusKey[],
    targetStatusKey: 'StatusKey0' as AISProjectManagerStatusKey,
    color: 'bg-violet-500',
    dotColor: 'bg-violet-500',
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    statusKeys: ['StatusKey1'] as AISProjectManagerStatusKey[],
    targetStatusKey: 'StatusKey1' as AISProjectManagerStatusKey,
    color: 'bg-amber-500',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'completed',
    label: 'Completed',
    statusKeys: ['StatusKey2'] as AISProjectManagerStatusKey[],
    targetStatusKey: 'StatusKey2' as AISProjectManagerStatusKey,
    color: 'bg-emerald-500',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'de-prioritised',
    label: 'De-Prioritised',
    statusKeys: ['StatusKey3'] as AISProjectManagerStatusKey[],
    targetStatusKey: 'StatusKey3' as AISProjectManagerStatusKey,
    color: 'bg-slate-500',
    dotColor: 'bg-slate-500',
  },
  {
    id: 'o-and-s',
    label: 'O & S',
    statusKeys: ['StatusKey4'] as AISProjectManagerStatusKey[],
    targetStatusKey: 'StatusKey4' as AISProjectManagerStatusKey,
    color: 'bg-[#04D9FF]',
    dotColor: 'bg-[#04D9FF]',
  },
];

export default function DashboardPage() {
  const { data: projects, isLoading } = useAISProjectManagerList();
  const updateProject = useUpdateAISProjectManager();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewDetailProjectId, setViewDetailProjectId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogDefaultStatus, setCreateDialogDefaultStatus] = useState<AISProjectManagerStatusKey | undefined>(undefined);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'title' | 'created' | 'target' | 'priority'>('title');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'hardware' | 'software'>('all');
  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const { getPriority } = useProjectPriorities();
  const [exportProjectsDialogOpen, setExportProjectsDialogOpen] = useState(false);

  // Refs for synchronized scrolling
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  // Synchronized scroll handlers
  const handleTopScroll = useCallback(() => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrolling.current = false; });
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isScrolling.current = false; });
  }, []);


  // Calculate KPI stats
  const stats = useMemo(() => {
    if (!projects) return { total: 0, hardware: 0, software: 0 };
    return {
      total: projects.length,
      hardware: projects.filter((p: AISProjectManager) => p.projecttypeKey === 'ProjecttypeKey0').length,
      software: projects.filter((p: AISProjectManager) => p.projecttypeKey === 'ProjecttypeKey1').length,
    };
  }, [projects]);

  // Sort function
  const sortProjects = useCallback((projectList: AISProjectManager[]) => {
    return [...projectList].sort((a: AISProjectManager, b: AISProjectManager) => {
      switch (sortBy) {
        case 'title':
          return (a.projectname || '').localeCompare(b.projectname || '');
        case 'created':
          if (!a.startdate && !b.startdate) return 0;
          if (!a.startdate) return 1;
          if (!b.startdate) return -1;
          return new Date(b.startdate).getTime() - new Date(a.startdate).getTime();
        case 'target':
          if (!a.duedate && !b.duedate) return 0;
          if (!a.duedate) return 1;
          if (!b.duedate) return -1;
          return new Date(a.duedate).getTime() - new Date(b.duedate).getTime();
        case 'priority': {
          const priorityA = getPriority(a.id);
          const priorityB = getPriority(b.id);
          // Priority 1 is highest, so sort ascending (lower number = higher priority)
          // Projects without priority go to the end
          if (!priorityA && !priorityB) return 0;
          if (!priorityA) return 1;
          if (!priorityB) return -1;
          return priorityA - priorityB;
        }
        default:
          return 0;
      }
    });
  }, [sortBy, getPriority]);

  // Filter columns by status filter
  const filteredColumns = useMemo(() => {
    if (statusFilters.length === 0) return STATUS_COLUMNS;
    return STATUS_COLUMNS.filter((col: ColumnConfig) => statusFilters.includes(col.id));
  }, [statusFilters]);

  const toggleStatusFilter = (columnId: string) => {
    setStatusFilters((prev: string[]) =>
      prev.includes(columnId)
        ? prev.filter((id: string) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const clearFilters = () => setStatusFilters([]);


  // Group projects by status column
  const groupedProjects = useMemo(() => {
    if (!projects) return {};
    
    // Apply type filter first
    let filteredProjects = projects;
    if (typeFilter === 'hardware') {
      filteredProjects = projects.filter((p: AISProjectManager) => p.projecttypeKey === 'ProjecttypeKey0');
    } else if (typeFilter === 'software') {
      filteredProjects = projects.filter((p: AISProjectManager) => p.projecttypeKey === 'ProjecttypeKey1');
    }
    
    const groups: Record<string, AISProjectManager[]> = {};
    
    STATUS_COLUMNS.forEach((col: ColumnConfig) => {
      const filtered = filteredProjects.filter((p: AISProjectManager) =>
        p.statusKey && col.statusKeys.includes(p.statusKey as AISProjectManagerStatusKey)
      );
      groups[col.id] = sortProjects(filtered);
    });
    
    return groups;
  }, [projects, sortProjects, typeFilter]);

  const selectedProject = projects?.find((p: AISProjectManager) => p.id === selectedProjectId);
  const viewDetailProject = projects?.find((p: AISProjectManager) => p.id === viewDetailProjectId);

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumn: ColumnConfig) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    const projectId = e.dataTransfer.getData('projectId');
    const project = projects?.find((p: AISProjectManager) => p.id === projectId);
    
    if (!project) return;
    
    // Check if already in this column
    if (project.statusKey && targetColumn.statusKeys.includes(project.statusKey as AISProjectManagerStatusKey)) return;
    
    // Update the project status
    updateProject.mutate(
      {
        id: projectId,
        changedFields: {
          statusKey: targetColumn.targetStatusKey as AISProjectManagerStatusKey,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Moved to ${targetColumn.label}`);
        },
        onError: (error: unknown) => {
          console.error('Failed to update project status:', error);
          toast.error('Failed to update project status. Check that the status option exists in Dataverse.');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 relative overflow-hidden">
        {/* Scanning beam overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3, delay: 1.2 }}
        >
          <motion.div
            className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/30"
            initial={{ left: '-8rem' }}
            animate={{ left: 'calc(100% + 8rem)' }}
            transition={{ duration: 1, ease: 'easeInOut' as const }}
          />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <h1 className="font-bold tracking-tight font-mono text-3xl">AIS Project Dashboard</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {format(TODAY, 'EEEE, MMMM d, yyyy')}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex items-center gap-3"
        >
          <Button
            variant="outline"
            onClick={() => {
              if (!projects || projects.length === 0) {
                toast.error('No projects to export');
                return;
              }
              
              // Export all columns from the table
              exportToExcel({
                filename: `ais-projects-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
                sheetName: 'AIS Project Tracker',
                columns: [
                  { header: 'Project ID', width: 36 },
                  { header: 'Project Name', width: 30 },
                  { header: 'Status', width: 15, dropdownOptions: ['Ideation', 'In Progress', 'Completed', 'De-Prioritised', 'O & S'] },
                  { header: 'Project Type', width: 12, dropdownOptions: ['ASSET', 'DST'] },
                  { header: 'Problem Statement', width: 40 },
                  { header: 'Proposed Solution', width: 40 },
                  { header: 'Expected Benefits', width: 40 },
                  { header: 'Contributors JSON Data', width: 40 },
                  { header: 'Start Date', width: 12 },
                  { header: 'Due Date', width: 12 },
                  { header: 'Estimated Man-Hours Saved', width: 22 },
                  { header: 'Milestones JSON Data', width: 50 },
                ],
                data: projects.map((p: AISProjectManager) => {
                  const statusLabels: Record<string, string> = {
                    'StatusKey0': 'Ideation',
                    'StatusKey1': 'In Progress',
                    'StatusKey2': 'Completed',
                    'StatusKey3': 'De-Prioritised',
                    'StatusKey4': 'O & S',
                  };
                  const typeLabels: Record<string, string> = {
                    'ProjecttypeKey0': 'ASSET',
                    'ProjecttypeKey1': 'DST'
                  };
                  return [
                    p.id,
                    p.projectname || '',
                    statusLabels[p.statusKey] || p.statusKey || '',
                    typeLabels[p.projecttypeKey] || p.projecttypeKey || '',
                    p.problemstatement || '',
                    p.proposedsolution || '',
                    p.expectedbenefits || '',
                    p.contributorsjsondata || '',
                    p.startdate || '',
                    p.duedate || '',
                    p.estimatedmanhourssaved ?? '',
                    p.milestonesjsondata || '',
                  ];
                })
              });
              
              toast.success(`Exported ${projects.length} projects to Excel`);
            }}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Raw
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!projects || projects.length === 0) {
                toast.error('No projects to export');
                return;
              }
              setExportProjectsDialogOpen(true);
            }}
            className="gap-2"
          >
            <FileDown className="w-4 h-4" />
            Export Projects
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!projects || projects.length === 0) {
                toast.error('No projects to export');
                return;
              }
              exportProjectsToPdf(projects, 'AIS Project Summary');
              toast.success('PDF exported successfully');
            }}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Export Dashboard
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const root = document.documentElement;
              const isDark = root.classList.contains('dark');
              root.classList.toggle('dark', !isDark);
            }}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button onClick={() => { setCreateDialogDefaultStatus(undefined); setCreateDialogOpen(true); }} size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </motion.div>
      </div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.3, ease: [0.25, 0.46, 0.45, 0.94] as const }}
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6"
      >
        {/* Total Projects */}
        <div
          onClick={() => setTypeFilter('all')}
          className={cn(
            'bg-card border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            typeFilter === 'all' ? 'border-primary ring-2 ring-primary/20' : 'border-border'
          )}
        >
          <div className="p-3 rounded-lg bg-primary/10">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-mono">Total Projects</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
        </div>

        {/* ASSET */}
        <div
          onClick={() => setTypeFilter('hardware')}
          className={cn(
            'bg-card border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            typeFilter === 'hardware' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-border'
          )}
        >
          <div className="p-3 rounded-lg bg-orange-500/10">
            <HardDrive className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-mono">ASSET</p>
            <p className="text-2xl font-bold text-foreground">{stats.hardware}</p>
          </div>
        </div>

        {/* DST */}
        <div
          onClick={() => setTypeFilter('software')}
          className={cn(
            'bg-card border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md',
            typeFilter === 'software' ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-border'
          )}
        >
          <div className="p-3 rounded-lg bg-cyan-500/10">
            <Cpu className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-mono">DST</p>
            <p className="text-2xl font-bold text-foreground">{stats.software}</p>
          </div>
        </div>

        {/* Sort By */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-mono">Sort By</p>
          </div>
          <Select value={sortBy} onValueChange={(val: string) => setSortBy(val as 'title' | 'created' | 'target' | 'priority')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Project Title (A-Z)</SelectItem>
              <SelectItem value="created">Start Date</SelectItem>
              <SelectItem value="target">Target Completion Date</SelectItem>
              <SelectItem value="priority">Priority (High to Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-mono">Filter Status</p>
          </div>
          <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="text-sm">
                  {statusFilters.length === 0
                    ? 'All Status'
                    : statusFilters.length === 1
                      ? STATUS_COLUMNS.find((c: ColumnConfig) => c.id === statusFilters[0])?.label
                      : `${statusFilters.length} selected`}
                </span>
                <ChevronsUpDown className="w-4 h-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-2">
              <div className="space-y-1">
                {STATUS_COLUMNS.map((col: ColumnConfig) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={statusFilters.includes(col.id)}
                      onCheckedChange={() => toggleStatusFilter(col.id)}
                    />
                    <span className="flex items-center gap-2 text-sm">
                      <span className={cn('w-2 h-2 rounded-full', col.dotColor)} />
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="border-t border-border mt-2 pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilterOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Apply
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      {/* Top Scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden h-3 scrollbar-thin"
      >
        <div className={cn(
          'h-1',
          filteredColumns.length <= 3 ? 'w-full' : 'min-w-max'
        )} style={{ width: filteredColumns.length > 3 ? `${filteredColumns.length * 336}px` : undefined }} />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className="flex-1 overflow-x-auto pb-4"
      >
        <div className={cn(
          'flex gap-4 h-full',
          filteredColumns.length <= 3 ? 'w-full' : 'min-w-max'
        )}>
          {filteredColumns.map((column: ColumnConfig, colIndex: number) => {
            const columnProjects = groupedProjects[column.id] || [];
            const isDragOver = dragOverColumn === column.id;
            
            return (
              <div
                key={column.id}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e: React.DragEvent) => handleDrop(e, column)}
                className={cn(
                  'flex flex-col rounded-2xl p-3 transition-colors duration-200',
                  filteredColumns.length <= 3 ? 'flex-1 min-w-[280px]' : 'w-[320px] flex-shrink-0',
                  isDragOver 
                    ? 'bg-primary/10 ring-2 ring-primary/50 ring-dashed' 
                    : 'bg-muted/30'
                )}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', column.dotColor)} />
                    <h3 className="font-semibold text-foreground text-sm">{column.label}</h3>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                      {columnProjects.length} {columnProjects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => { setCreateDialogDefaultStatus(column.targetStatusKey); setCreateDialogOpen(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedColumns((prev: Record<string, boolean>) => ({
                        ...prev,
                        [column.id]: !prev[column.id]
                      }))}
                      title={expandedColumns[column.id] ? 'Collapse all cards' : 'Expand all cards'}
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[100px]">
                  <AnimatePresence mode="popLayout">
                    {columnProjects.length === 0 ? (
                      <div
                        className={cn(
                          'flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed rounded-xl transition-colors',
                          isDragOver ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                        )}
                      >
                        {isDragOver ? 'Drop here' : 'No projects'}
                      </div>
                    ) : (
                      columnProjects.map((project: AISProjectManager, index: number) => (
                        <KanbanCard
                          key={project.id}
                          project={project}
                          index={index}
                          onEdit={() => setSelectedProjectId(project.id)}
                          onViewDetails={() => setViewDetailProjectId(project.id)}
                          onDragStart={(e: React.DragEvent) => handleDragStart(e, project.id)}
                          isExpanded={expandedColumns[column.id] || false}
                          columnStatus={column.label}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Create Dialog */}
      <CreateProjectDialog
        open={createDialogOpen || !!selectedProjectId}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setCreateDialogOpen(false);
            setSelectedProjectId(null);
            setCreateDialogDefaultStatus(undefined);
          }
        }}
        project={selectedProject}
        defaultStatus={createDialogDefaultStatus}
      />

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={viewDetailProject ?? null}
        isOpen={!!viewDetailProjectId}
        onClose={() => setViewDetailProjectId(null)}
      />

      {/* Export Projects Dialog */}
      <ExportProjectsDialog
        open={exportProjectsDialogOpen}
        onOpenChange={setExportProjectsDialogOpen}
        projects={projects || []}
      />

    </div>
  );
}
