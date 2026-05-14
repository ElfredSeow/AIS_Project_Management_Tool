import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, Check } from 'lucide-react';
import type { AISProjectManager, AISProjectManagerStatusKey } from '@/generated/models/aisproject-manager-model';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { toast } from 'sonner';
import { exportProjectsDetailedPdf } from '@/lib/pdf-export-detailed';

interface ExportProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: AISProjectManager[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  'StatusKey0': { label: 'Ideation', color: 'bg-violet-500/10 border-violet-500/30', dotColor: 'bg-violet-500' },
  'StatusKey1': { label: 'In Progress', color: 'bg-amber-500/10 border-amber-500/30', dotColor: 'bg-amber-500' },
  'StatusKey2': { label: 'Completed', color: 'bg-emerald-500/10 border-emerald-500/30', dotColor: 'bg-emerald-500' },
  'StatusKey3': { label: 'De-Prioritised', color: 'bg-slate-500/10 border-slate-500/30', dotColor: 'bg-slate-500' },
  'StatusKey4': { label: 'O & S', color: 'bg-rose-500/10 border-rose-500/30', dotColor: 'bg-rose-500' },
};

const STATUS_ORDER: AISProjectManagerStatusKey[] = ['StatusKey0', 'StatusKey1', 'StatusKey2', 'StatusKey3', 'StatusKey4'];

export function ExportProjectsDialog({ open, onOpenChange, projects }: ExportProjectsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Group projects by status
  const groupedProjects = useMemo(() => {
    const groups: Record<string, AISProjectManager[]> = {};
    
    for (const statusKey of STATUS_ORDER) {
      groups[statusKey] = projects
        .filter((p: AISProjectManager) => p.statusKey === statusKey)
        .sort((a: AISProjectManager, b: AISProjectManager) => 
          (a.projectname || '').localeCompare(b.projectname || '')
        );
    }
    
    return groups;
  }, [projects]);

  const toggleProject = (id: string) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStatus = (statusKey: string) => {
    const statusProjects = groupedProjects[statusKey] || [];
    const allSelected = statusProjects.every((p: AISProjectManager) => selectedIds.has(p.id));
    
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in this status
        statusProjects.forEach((p: AISProjectManager) => next.delete(p.id));
      } else {
        // Select all in this status
        statusProjects.forEach((p: AISProjectManager) => next.add(p.id));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(projects.map((p: AISProjectManager) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one project');
      return;
    }

    try {
      const selectedProjects = projects.filter((p: AISProjectManager) => selectedIds.has(p.id));
      exportProjectsDetailedPdf(selectedProjects);
      toast.success(`Exported ${selectedProjects.length} project${selectedProjects.length > 1 ? 's' : ''} to PDF`);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF. Please try again.');
    }
  };

  const isStatusAllSelected = (statusKey: string) => {
    const statusProjects = groupedProjects[statusKey] || [];
    return statusProjects.length > 0 && statusProjects.every((p: AISProjectManager) => selectedIds.has(p.id));
  };

  const isStatusPartialSelected = (statusKey: string) => {
    const statusProjects = groupedProjects[statusKey] || [];
    const selectedCount = statusProjects.filter((p: AISProjectManager) => selectedIds.has(p.id)).length;
    return selectedCount > 0 && selectedCount < statusProjects.length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Export Projects
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} of {projects.length} projects selected
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 py-4">
            {STATUS_ORDER.map((statusKey: AISProjectManagerStatusKey) => {
              const config = STATUS_CONFIG[statusKey];
              const statusProjects = groupedProjects[statusKey] || [];
              
              if (statusProjects.length === 0) return null;

              return (
                <motion.div
                  key={statusKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-xl border p-4',
                    config.color
                  )}
                >
                  {/* Status Header */}
                  <div 
                    className="flex items-center gap-3 mb-3 cursor-pointer"
                    onClick={() => toggleStatus(statusKey)}
                  >
                    <Checkbox
                      checked={isStatusAllSelected(statusKey)}
                      className={cn(
                        isStatusPartialSelected(statusKey) && 'data-[state=unchecked]:bg-primary/50'
                      )}
                      onCheckedChange={() => toggleStatus(statusKey)}
                    />
                    <div className={cn('w-3 h-3 rounded-full', config.dotColor)} />
                    <span className="font-semibold text-foreground">{config.label}</span>
                    <span className="text-xs text-muted-foreground">({statusProjects.length})</span>
                  </div>

                  {/* Project List */}
                  <div className="space-y-1 ml-6">
                    {statusProjects.map((project: AISProjectManager) => (
                      <label
                        key={project.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                          selectedIds.has(project.id) 
                            ? 'bg-primary/10' 
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(project.id)}
                          onCheckedChange={() => toggleProject(project.id)}
                        />
                        <span className="flex-1 text-sm text-foreground truncate">
                          {project.projectname || 'Untitled Project'}
                        </span>
                        {selectedIds.has(project.id) && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </label>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border pt-4 mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport}
            disabled={selectedIds.size === 0}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
