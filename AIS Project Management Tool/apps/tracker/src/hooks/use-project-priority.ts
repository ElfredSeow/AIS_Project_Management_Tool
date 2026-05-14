import { useState, useEffect, useCallback } from 'react';

export type PriorityLevel = 1 | 2 | 3 | null;

interface ProjectPriorities {
  [projectId: string]: PriorityLevel;
}

const STORAGE_KEY = 'project-priorities';

function loadPriorities(): ProjectPriorities {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePriorities(priorities: ProjectPriorities): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(priorities));
}

export function useProjectPriorities() {
  const [priorities, setPrioritiesState] = useState<ProjectPriorities>(loadPriorities);

  // Sync with localStorage changes from other tabs/components
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setPrioritiesState(loadPriorities());
      }
    };
    // Also listen for custom event for same-tab updates
    const handlePriorityUpdate = () => {
      setPrioritiesState(loadPriorities());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('priority-updated', handlePriorityUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('priority-updated', handlePriorityUpdate);
    };
  }, []);

  const getPriority = useCallback((projectId: string): PriorityLevel => {
    return priorities[projectId] ?? null;
  }, [priorities]);

  const setPriority = useCallback((projectId: string, priority: PriorityLevel) => {
    const newPriorities = { ...loadPriorities() };
    if (priority === null) {
      delete newPriorities[projectId];
    } else {
      newPriorities[projectId] = priority;
    }
    savePriorities(newPriorities);
    setPrioritiesState(newPriorities);
    // Dispatch custom event to notify other components in the same tab
    window.dispatchEvent(new CustomEvent('priority-updated'));
  }, []);

  const getAllPriorities = useCallback((): ProjectPriorities => {
    return { ...priorities };
  }, [priorities]);

  return {
    getPriority,
    setPriority,
    getAllPriorities,
  };
}

export function getPriorityLabel(priority: PriorityLevel): string {
  if (priority === null) return '';
  return `P${priority}`;
}

export function getPriorityStyle(priority: PriorityLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (priority) {
    case 1:
      return {
        bg: 'bg-red-500/15',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-500/50',
      };
    case 2:
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-500/50',
      };
    case 3:
      return {
        bg: 'bg-blue-500/15',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-500/50',
      };
    default:
      return {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-border',
      };
  }
}
