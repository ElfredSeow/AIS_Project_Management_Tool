import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Upload, FileUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { AISProjectManager } from '@/generated/models/aisproject-manager-model';
import { useCreateAISProjectManager, useUpdateAISProjectManager } from '@/generated/hooks/use-aisproject-manager';
import { parseProjectsXlsx, type ImportedRow, type ImportError } from '@/lib/excel-import';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { toast } from 'sonner';

interface ImportProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: AISProjectManager[];
}

type PlannedRow =
  | { kind: 'create'; row: ImportedRow }
  | { kind: 'update'; row: ImportedRow; projectId: string };

type ExecutionResult = { row: ImportedRow; kind: 'create' | 'update'; success: boolean; error?: string };

function toPayload(row: ImportedRow): Omit<AISProjectManager, 'id'> {
  return {
    projectname: row.projectname,
    statusKey: row.statusKey as AISProjectManager['statusKey'],
    projecttypeKey: row.projecttypeKey as AISProjectManager['projecttypeKey'],
    problemstatement: row.problemstatement,
    proposedsolution: row.proposedsolution,
    expectedbenefits: row.expectedbenefits,
    contributorsjsondata: row.contributorsjsondata,
    startdate: row.startdate,
    duedate: row.duedate,
    estimatedmanhourssaved: row.estimatedmanhourssaved,
    milestonesjsondata: row.milestonesjsondata,
  };
}

export function ImportProjectsDialog({ open, onOpenChange, projects }: ImportProjectsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createProject = useCreateAISProjectManager();
  const updateProject = useUpdateAISProjectManager();

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ImportError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ExecutionResult[] | null>(null);

  const existingIds = useMemo(() => new Set(projects.map((p: AISProjectManager) => p.id)), [projects]);

  // Classify parsed rows against existing projects: unknown Project IDs are errors, not silent creates.
  const { plan, unknownIdErrors } = useMemo(() => {
    const plan: PlannedRow[] = [];
    const unknownIdErrors: ImportError[] = [];
    for (const row of parsedRows) {
      if (row.projectId === null) {
        plan.push({ kind: 'create', row });
      } else if (existingIds.has(row.projectId)) {
        plan.push({ kind: 'update', row, projectId: row.projectId });
      } else {
        unknownIdErrors.push({ sheetRow: row.sheetRow, message: `Project ID "${row.projectId}" does not match any existing project.` });
      }
    }
    return { plan, unknownIdErrors };
  }, [parsedRows, existingIds]);

  const allErrors = [...parseErrors, ...unknownIdErrors].sort((a: ImportError, b: ImportError) => a.sheetRow - b.sheetRow);
  const createCount = plan.filter((p: PlannedRow) => p.kind === 'create').length;
  const updateCount = plan.filter((p: PlannedRow) => p.kind === 'update').length;

  const reset = () => {
    setFileName(null);
    setParsedRows([]);
    setParseErrors([]);
    setResults(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResults(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors } = parseProjectsXlsx(buffer);
      setParsedRows(rows);
      setParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        toast.error('No data rows found in the file');
      }
    } catch (error: unknown) {
      console.error('Excel import parse error:', error);
      toast.error('Failed to read the file. Make sure it is a valid .xlsx export.');
      setParsedRows([]);
      setParseErrors([]);
    }
  };

  const handleImport = async () => {
    if (plan.length === 0) return;
    setIsImporting(true);
    setProgress(0);

    const outcomes: ExecutionResult[] = [];

    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      try {
        if (item.kind === 'create') {
          await createProject.mutateAsync(toPayload(item.row));
        } else {
          await updateProject.mutateAsync({ id: item.projectId, changedFields: toPayload(item.row) });
        }
        outcomes.push({ row: item.row, kind: item.kind, success: true });
      } catch (error: unknown) {
        outcomes.push({
          row: item.row,
          kind: item.kind,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      setProgress(Math.round(((i + 1) / plan.length) * 100));
    }

    setIsImporting(false);
    setResults(outcomes);

    const succeeded = outcomes.filter((o: ExecutionResult) => o.success).length;
    const failed = outcomes.length - succeeded;
    if (failed === 0) {
      toast.success(`Imported ${succeeded} project${succeeded === 1 ? '' : 's'}`);
    } else {
      toast.error(`Imported ${succeeded}, failed ${failed}. See details below.`);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next: boolean) => !next && handleClose()}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Projects
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4 py-4">
            {!fileName && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
                <FileUp className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select an .xlsx file exported from this app (or edited and re-saved in Excel)
                </p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {fileName && !results && (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-foreground truncate">{fileName}</span>
                  <Button variant="ghost" size="sm" onClick={reset} disabled={isImporting}>
                    Change File
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="text-2xl font-bold text-foreground">{createCount}</p>
                    <p className="text-xs text-muted-foreground">to create</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-2xl font-bold text-foreground">{updateCount}</p>
                    <p className="text-xs text-muted-foreground">to update</p>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <p className="text-2xl font-bold text-foreground">{allErrors.length}</p>
                    <p className="text-xs text-muted-foreground">errors (skipped)</p>
                  </div>
                </div>

                {allErrors.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Row errors
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {allErrors.map((err: ImportError, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          Row {err.sheetRow}: {err.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-xs text-muted-foreground text-center">Importing… {progress}%</p>
                  </div>
                )}
              </>
            )}

            {results && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Import results</p>
                {results.map((r: ExecutionResult, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                      r.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
                    )}
                  >
                    {r.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    )}
                    <span className="text-foreground">
                      Row {r.row.sheetRow} ({r.kind}) — {r.row.projectname}
                      {!r.success && r.error && <span className="text-rose-500"> — {r.error}</span>}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border pt-4 mt-auto">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {fileName && !results && (
            <Button
              onClick={handleImport}
              disabled={plan.length === 0 || isImporting}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importing…' : `Import ${plan.length > 0 ? `(${plan.length})` : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
