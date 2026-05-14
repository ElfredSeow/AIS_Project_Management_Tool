import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Trash2, Plus, ChevronDown, ChevronUp, X, CalendarIcon, Link as LinkIcon, Flag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCreateAISProjectManager, useUpdateAISProjectManager, useDeleteAISProjectManager } from '@/generated/hooks/use-aisproject-manager';
import type { AISProjectManager, AISProjectManagerProjecttypeKey, AISProjectManagerStatusKey } from '@/generated/models/aisproject-manager-model';
import { useProjectMediaURLList, useCreateProjectMediaURL, useUpdateProjectMediaURL, useDeleteProjectMediaURL } from '@/generated/hooks/use-project-media-url';
import type { ProjectMediaURL } from '@/generated/models/project-media-url-model';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjectPriorities, type PriorityLevel, getPriorityLabel, getPriorityStyle } from '@/hooks/use-project-priority';

const formatDisplayDate = (dateStr: string | undefined) => {
  if (!dateStr) return undefined;
  return format(parseISO(dateStr), 'dd MMM yy').toUpperCase();
};

const CONTRIBUTOR_ROLES = [
  'Project Manager',
  'Developer',
  'End User',
  'Ops Manager',
  'Product Owner',
] as const;

type ContributorRole = typeof CONTRIBUTOR_ROLES[number];

interface ContributorFormData {
  name: string;
  role: ContributorRole | '';
}

interface MilestoneFormData {
  title: string;
  description: string;
  expectedDate: string;
  completed: boolean;
}

interface MediaUrlFormData {
  id?: string;
  url: string;
  label: string;
}
const projectSchema = z.object({
  name: z.string().min(1, { error: 'Project name is required' }),
  problemStatement: z.string().min(10, { error: 'Problem statement must be at least 10 characters' }),
  projectType: z.enum(['ASSET', 'DST'], { error: 'Select a solution type' }),
  proposedSolution: z.string().min(1, { error: 'Proposed solution is required' }),
  expectedBenefits: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  manHoursSaved: z.number().optional().nullable(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: AISProjectManager | null;
  defaultStatus?: AISProjectManagerStatusKey;
}

export function CreateProjectDialog({ open, onOpenChange, project, defaultStatus }: CreateProjectDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(true);
  const [mediaUrlsOpen, setMediaUrlsOpen] = useState(true);
  const [milestones, setMilestones] = useState<MilestoneFormData[]>([]);
  const [mediaUrls, setMediaUrls] = useState<MediaUrlFormData[]>([]);
  const [contributors, setContributors] = useState<ContributorFormData[]>([{ name: '', role: '' }]);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [milestoneEddOpen, setMilestoneEddOpen] = useState<number | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>(null);
  const [manHoursInput, setManHoursInput] = useState<string>('');
  
  const createProject = useCreateAISProjectManager();
  const updateProject = useUpdateAISProjectManager();
  const deleteProject = useDeleteAISProjectManager();
  const { data: existingMediaUrls } = useProjectMediaURLList();
  const createMediaUrl = useCreateProjectMediaURL();
  const updateMediaUrl = useUpdateProjectMediaURL();
  const { setPriority, getPriority } = useProjectPriorities();
  const deleteMediaUrl = useDeleteProjectMediaURL();
  const queryClient = useQueryClient();
  
  const isEditMode = !!project;
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      problemStatement: '',
      projectType: undefined,
      proposedSolution: '',
      expectedBenefits: '',
      startDate: '',
      dueDate: '',
    },
  });

  // Populate form when project changes (edit mode)
  useEffect(() => {
    if (project && open) {
      const projectType = project.projecttypeKey === 'ProjecttypeKey0' ? 'ASSET' : 'DST';
      
      reset({
        name: project.projectname || '',
        problemStatement: project.problemstatement || '',
        projectType: projectType as 'ASSET' | 'DST',
        proposedSolution: project.proposedsolution || '',
        expectedBenefits: project.expectedbenefits || '',
        startDate: project.startdate || '',
        dueDate: project.duedate || '',
        manHoursSaved: project.estimatedmanhourssaved ?? undefined,
      });
      
      // Load priority from localStorage
      setSelectedPriority(getPriority(project.id));
      setManHoursInput(project.estimatedmanhourssaved !== undefined && project.estimatedmanhourssaved !== null ? String(project.estimatedmanhourssaved) : '');
      
      // Load contributors from JSON in contributorsjsondata field
      if (project.contributorsjsondata) {
        try {
          const parsedContributors = JSON.parse(project.contributorsjsondata) as ContributorFormData[];
          if (Array.isArray(parsedContributors) && parsedContributors.length > 0) {
            // Normalize to ensure name and role are strings
            setContributors(parsedContributors.map((c: ContributorFormData) => ({
              name: c.name || '',
              role: (c.role || '') as ContributorRole | ''
            })));
          } else {
            setContributors([{ name: '', role: '' }]);
          }

        } catch {
          // Legacy: single contributor stored as plain text
          setContributors([{
            name: project.contributorsjsondata,
            role: ''
          }]);
        }
      } else {
        setContributors([{ name: '', role: '' }]);
      }
      if (project.milestonesjsondata) {
        try {
          const parsedMilestones = JSON.parse(project.milestonesjsondata) as MilestoneFormData[];
          setMilestones(parsedMilestones);
        } catch {
          setMilestones([]);
        }
      } else {
        setMilestones([]);
      }
      
      // Load media URLs from in-memory table
      if (existingMediaUrls) {
        const projectMediaUrls = existingMediaUrls.filter(
          (m) => m.projectid === project.id
        );
        // Parse the url_json_data to get individual URLs
        const loadedUrls: MediaUrlFormData[] = [];
        projectMediaUrls.forEach((m) => {
          if (m.urljsondata) {
            try {
              const parsed = JSON.parse(m.urljsondata) as Array<{ url: string; label: string }>;
              parsed.forEach((item: { url: string; label: string }) => {
                loadedUrls.push({
                  id: m.id, // Use the record id for reference
                  url: item.url || '',
                  label: item.label || ''
                });
              });
            } catch {
              // Skip invalid JSON
            }
          }
        });
        setMediaUrls(loadedUrls);
      } else {
        setMediaUrls([]);
      }
    } else if (!project && open) {
      reset({
        name: '',
        problemStatement: '',
        projectType: undefined,
        proposedSolution: '',
        expectedBenefits: '',
        startDate: '',
        dueDate: '',
      });
      setSelectedPriority(null);
      setMilestones([]);
      setContributors([{ name: '', role: '' }]);
      setMediaUrls([]);
      setManHoursInput('');
    }
  }, [project, open, reset, existingMediaUrls]);

  const selectedType = watch('projectType');

  const addMilestone = () => {
    setMilestones([...milestones, {
      title: '',
      description: '',
      expectedDate: '',
      completed: false,
    }]);
  };

  const updateMilestoneField = (index: number, field: keyof MilestoneFormData, value: string | boolean) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_: MilestoneFormData, i: number) => i !== index));
  };

  const addMediaUrl = () => {
    setMediaUrls([...mediaUrls, { url: '', label: '' }]);
  };

  const updateMediaUrlField = (index: number, field: keyof MediaUrlFormData, value: string) => {
    const updated = [...mediaUrls];
    updated[index] = { ...updated[index], [field]: value };
    setMediaUrls(updated);
  };
  const removeMediaUrl = (index: number) => {
    // Just remove from local state - the actual record will be deleted
    // and recreated with updated JSON in onSubmit
    setMediaUrls(mediaUrls.filter((_: MediaUrlFormData, i: number) => i !== index));
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      const typeKey: AISProjectManagerProjecttypeKey = data.projectType === 'ASSET' ? 'ProjecttypeKey0' : 'ProjecttypeKey1';

      // Validate that at least one contributor has name and role
      const validContributors = contributors.filter((c: ContributorFormData) => (c.name || '').trim() && c.role);
      if (validContributors.length === 0) {
        toast.error('Please add at least one contributor with name and role');
        setIsSubmitting(false);
        return;
      }

      // Serialize contributors to JSON
      const contributorsJson = JSON.stringify(validContributors);

      // Serialize milestones to JSON
      const milestonesJson = JSON.stringify(milestones);

      if (isEditMode && project) {
        // Handle media URLs - use update if record exists, otherwise create
        const existingRecord = existingMediaUrls?.find((m) => m.projectid === project.id);
        const validMediaUrls = mediaUrls.filter((m: MediaUrlFormData) => m.url.trim() && m.label.trim());
        const urlJsonData = validMediaUrls.length > 0
          ? JSON.stringify(validMediaUrls.map((m: MediaUrlFormData) => ({ url: m.url, label: m.label })))
          : '[]';
        
        if (existingRecord && existingRecord.id) {
          // Update existing record
          await updateMediaUrl.mutateAsync({
            id: existingRecord.id,
            changedFields: {
              urljsondata: urlJsonData,
            },
          });
        } else if (validMediaUrls.length > 0) {
          // Create new record only if we have URLs to save
          await createMediaUrl.mutateAsync({
            projectid: project.id,
            urljsondata: urlJsonData,
          });
        }
        
        // Invalidate cache to refresh data
        await queryClient.invalidateQueries({ queryKey: ['projectMediaURL-list'] });

        // Update existing project
        await updateProject.mutateAsync({
          id: project.id,
          changedFields: {
            projectname: data.name,
            projecttypeKey: typeKey,
            problemstatement: data.problemStatement,
            proposedsolution: data.proposedSolution || undefined,
            expectedbenefits: data.expectedBenefits || undefined,
            contributorsjsondata: contributorsJson,
            startdate: data.startDate === '' ? '' : (data.startDate || undefined),
            duedate: data.dueDate === '' ? '' : (data.dueDate || undefined),
            estimatedmanhourssaved: manHoursInput === '' ? null : (data.manHoursSaved !== undefined && data.manHoursSaved !== null && !isNaN(data.manHoursSaved) ? data.manHoursSaved : null),
            milestonesjsondata: milestonesJson,
          },
        });

        // Save priority to localStorage
        if (selectedPriority !== null) {
          setPriority(project.id, selectedPriority);
        } else {
          setPriority(project.id, null);
        }
      } else {
        // Create new project - use defaultStatus if provided, otherwise Ideation
        const statusKey = (defaultStatus || 'StatusKey0') as AISProjectManagerStatusKey; // Ideation is fallback
        
        const newProject = await createProject.mutateAsync({
          projectname: data.name,
          projecttypeKey: typeKey,
          statusKey: statusKey,
          problemstatement: data.problemStatement,
          proposedsolution: data.proposedSolution || undefined,
          expectedbenefits: data.expectedBenefits || undefined,
          contributorsjsondata: contributorsJson,
          milestonesjsondata: milestonesJson,
          startdate: data.startDate || undefined,
          duedate: data.dueDate || undefined,
          estimatedmanhourssaved: data.manHoursSaved !== undefined && data.manHoursSaved !== null && !isNaN(data.manHoursSaved) ? data.manHoursSaved : undefined,
        });

        // Save priority for new project
        if (selectedPriority !== null) {
          setPriority(newProject.id, selectedPriority);
        }

        // Save media URLs for new project as JSON
        const validMediaUrls = mediaUrls.filter((m: MediaUrlFormData) => m.url.trim() && m.label.trim());
        if (validMediaUrls.length > 0) {
          const urlJsonData = JSON.stringify(validMediaUrls.map((m: MediaUrlFormData) => ({ url: m.url, label: m.label })));
          await createMediaUrl.mutateAsync({
            projectid: newProject.id,
            urljsondata: urlJsonData,
          });
        }
      }

      toast.success(isEditMode ? 'Project updated successfully!' : 'Project created successfully!');
      reset();
      setMilestones([]);
      setContributors([{ name: '', role: '' }]);
      setMediaUrls([]);
      setManHoursInput('');
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Project creation/update error:', error);
      let errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} project`;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    
    setIsDeleting(true);
    try {
      // First, delete associated media URLs
      const projectMediaUrl = existingMediaUrls?.find(
        (m: ProjectMediaURL) => m.projectid === project.id
      );
      if (projectMediaUrl) {
        await deleteMediaUrl.mutateAsync(projectMediaUrl.id);
      }
      
      // Then delete the project
      await deleteProject.mutateAsync(project.id);
      toast.success('Project deleted successfully!');
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(newOpen: boolean) => { if (!newOpen) { reset(); setMilestones([]); setContributors([{ name: '', role: '' }]); setMediaUrls([]); setManHoursInput(''); setSelectedPriority(null); } onOpenChange(newOpen); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEditMode ? 'Edit Project' : 'Create New Project'}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the project details below.' 
              : 'Add a new engineering project to track. All fields marked with * are required.'}
          </DialogDescription>
        </DialogHeader>

        <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Automated Assembly Line v3"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Contributors */}
          <div className="space-y-3">
            <Label>Contributor(s) *</Label>
            <div className="space-y-2">
              {contributors.map((contributor: ContributorFormData, index: number) => (
                <div key={index} className="border border-border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Personnel name"
                      value={contributor.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const updated = [...contributors];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setContributors(updated);
                      }}
                      className="flex-1"
                    />
                    <Select
                      value={contributor.role}
                      onValueChange={(value: string) => {
                        const updated = [...contributors];
                        updated[index] = { ...updated[index], role: value as ContributorRole };
                        setContributors(updated);
                      }}
                    >
                      <SelectTrigger className={cn("w-[160px]", !contributor.role && "text-muted-foreground")}>
                        <SelectValue placeholder="Select role *" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRIBUTOR_ROLES.map((role: ContributorRole) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {contributors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setContributors(contributors.filter((_: ContributorFormData, i: number) => i !== index));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContributors([...contributors, { name: '', role: '' }])}
                disabled={!contributors.every((c: ContributorFormData) => (c.name || '').trim() && c.role)}

              >
                <Plus className="w-4 h-4" />
                Add Contributor
              </Button>
            </div>
          </div>

          {/* Problem Statement */}
          <div className="space-y-2">
            <Label htmlFor="problemStatement">Problem Statement *</Label>
            <Textarea
              id="problemStatement"
              placeholder="Describe the problem this project aims to solve..."
              rows={3}
              {...register('problemStatement')}
            />
            {errors.problemStatement && (
              <p className="text-xs text-destructive">{errors.problemStatement.message}</p>
            )}
          </div>

          {/* Solution Type */}
          <div className="space-y-2">
            <Label>Solution Type *</Label>
            <Select
              value={selectedType || ''}
              onValueChange={(value: string) => setValue('projectType', value as 'ASSET' | 'DST')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSET">ASSET</SelectItem>
                <SelectItem value="DST">DST</SelectItem>
              </SelectContent>
            </Select>
            {errors.projectType && (
              <p className="text-xs text-destructive">{errors.projectType.message}</p>
            )}
          </div>

          {/* Priority Level */}
          <div className="space-y-2">
            <Label>Priority Level</Label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((level) => {
                const style = getPriorityStyle(level);
                const isSelected = selectedPriority === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedPriority(isSelected ? null : level)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                      isSelected
                        ? `${style.bg} ${style.text} ${style.border} border-2`
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      <span>P{level}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. P1 is highest priority, P3 is lowest.
            </p>
          </div>

          {/* Proposed Solution */}
          <div className="space-y-2">
            <Label htmlFor="proposedSolution">Proposed Solution *</Label>
            <Textarea
              id="proposedSolution"
              placeholder="Describe the proposed solution..."
              rows={3}
              {...register('proposedSolution')}
            />
            {errors.proposedSolution && (
              <p className="text-xs text-destructive">{errors.proposedSolution.message}</p>
            )}
          </div>

          {/* Expected Benefits */}
          <div className="space-y-2">
            <Label htmlFor="expectedBenefits">Expected Benefits</Label>
            <Textarea
              id="expectedBenefits"
              placeholder="What outcomes/improvements are expected?"
              rows={3}
              {...register('expectedBenefits')}
            />
          </div>

          {/* Project Start Date & Target Completion Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Start Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watch('startDate') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('startDate') ? formatDisplayDate(watch('startDate')) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('startDate') ? new Date(watch('startDate') as string) : undefined}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setValue('startDate', `${year}-${month}-${day}`);
                      } else {
                        setValue('startDate', '');
                      }
                      setStartDateOpen(false);
                    }}
                    initialFocus
                  />
                  <div className="flex items-center justify-between border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setValue('startDate', '');
                        setStartDateOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        setValue('startDate', `${year}-${month}-${day}`);
                        setStartDateOpen(false);
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Target Completion Date</Label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watch('dueDate') && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watch('dueDate') ? formatDisplayDate(watch('dueDate')) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watch('dueDate') ? new Date(watch('dueDate') as string) : undefined}
                    onSelect={(date: Date | undefined) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setValue('dueDate', `${year}-${month}-${day}`);
                      } else {
                        setValue('dueDate', '');
                      }
                      setDueDateOpen(false);
                    }}
                    initialFocus
                  />
                  <div className="flex items-center justify-between border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setValue('dueDate', '');
                        setDueDateOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        setValue('dueDate', `${year}-${month}-${day}`);
                        setDueDateOpen(false);
                      }}
                    >
                      Today
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Est. Man-Hours Savings */}
          <div className="space-y-2">
            <Label htmlFor="manHoursSaved">Est. Man-Hours Savings</Label>
            <Input
              id="manHoursSaved"
              type="text"
              inputMode="numeric"
              placeholder="e.g., 500"
              value={manHoursInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                // Allow empty or valid numeric input
                if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  setManHoursInput(val);
                  if (val === '') {
                    setValue('manHoursSaved', null);
                  } else {
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                      setValue('manHoursSaved', num);
                    }
                  }
                }
              }}
            />
          </div>

          {/* Milestone Plannings Section */}
          <Collapsible open={milestonesOpen} onOpenChange={setMilestonesOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <span>Milestone Plannings</span>
                {milestonesOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {milestones.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No milestones added yet.</p>
              )}
              
              {milestones.map((milestone: MilestoneFormData, index: number) => (
                <div key={index} className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Milestone Title</Label>
                        <Input
                          placeholder="Enter milestone title"
                          value={milestone.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMilestoneField(index, 'title', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">EDD</Label>
                        <Popover open={milestoneEddOpen === index} onOpenChange={(open: boolean) => setMilestoneEddOpen(open ? index : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal h-9",
                                !milestone.expectedDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {milestone.expectedDate ? formatDisplayDate(milestone.expectedDate) : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={milestone.expectedDate ? new Date(milestone.expectedDate) : undefined}
                              onSelect={(date: Date | undefined) => {
                                if (date) {
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  updateMilestoneField(index, 'expectedDate', `${year}-${month}-${day}`);
                                } else {
                                  updateMilestoneField(index, 'expectedDate', '');
                                }
                                setMilestoneEddOpen(null);
                              }}
                              initialFocus
                            />
                            <div className="flex items-center justify-between border-t p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  updateMilestoneField(index, 'expectedDate', '');
                                  setMilestoneEddOpen(null);
                                }}
                              >
                                Clear
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const today = new Date();
                                  const year = today.getFullYear();
                                  const month = String(today.getMonth() + 1).padStart(2, '0');
                                  const day = String(today.getDate()).padStart(2, '0');
                                  updateMilestoneField(index, 'expectedDate', `${year}-${month}-${day}`);
                                  setMilestoneEddOpen(null);
                                }}
                              >
                                Today
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive mt-5"
                      onClick={() => removeMilestone(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Milestone Description</Label>
                    <Textarea
                      placeholder="Describe this milestone..."
                      rows={2}
                      value={milestone.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateMilestoneField(index, 'description', e.target.value)}
                    />
                  </div>
                  {/* Completed Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`milestone-completed-${index}`}
                      checked={milestone.completed}
                      onCheckedChange={(checked: boolean | "indeterminate") => updateMilestoneField(index, 'completed', checked === true)}
                    />
                    <Label htmlFor={`milestone-completed-${index}`} className="text-sm font-normal cursor-pointer">
                      Completed
                    </Label>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                className="w-full gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Milestone
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Media URLs Section */}
          <Collapsible open={mediaUrlsOpen} onOpenChange={setMediaUrlsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Media URLs
                </span>
                {mediaUrlsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {mediaUrls.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No media URLs added yet.</p>
              )}
              
              {mediaUrls.map((mediaUrl: MediaUrlFormData, index: number) => (
                <div key={index} className="border border-border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter URL (e.g., https://...)"
                      value={mediaUrl.url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMediaUrlField(index, 'url', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Label (e.g., Demo Video)"
                      value={mediaUrl.label}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMediaUrlField(index, 'label', e.target.value)}
                      className="w-[160px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMediaUrl(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMediaUrl}
                disabled={mediaUrls.length > 0 && (!mediaUrls[mediaUrls.length - 1]?.url.trim() || !mediaUrls[mediaUrls.length - 1]?.label.trim())}
                className="w-full gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Media
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </form>

        <DialogFooter className="pt-4">
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              {isEditMode && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting || isDeleting}
                  className="gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => { reset(); setMilestones([]); setContributors([{ name: '', role: '' }]); setMediaUrls([]); setManHoursInput(''); setSelectedPriority(null); onOpenChange(false); }}
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </Button>
            </div>
            <Button
              type="button"
              disabled={isSubmitting || isDeleting}
              onClick={async () => {
                // Manually trigger form validation and submission
                const isValid = await handleSubmit(onSubmit)();
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Update Project' : 'Create Project'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{project?.projectname}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Project'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
