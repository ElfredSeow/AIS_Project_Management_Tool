import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AISProjectManagerService } from "../services/aisproject-manager-service";
import type { AISProjectManager } from "../models/aisproject-manager-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all AISProjectManager records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, projectname, contributorsjsondata, duedate, estimatedmanhourssaved, expectedbenefits, milestonesjsondata, problemstatement, projecttypeKey, proposedsolution, startdate, statusKey
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useAISProjectManagerList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["aISProjectManager-list", options],
    queryFn: () => AISProjectManagerService.getAll(options),
  });
}

/**
 * Retrieve a single AISProjectManager record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useAISProjectManager(id: string) {
  return useQuery({
    queryKey: ["aISProjectManager", id],
    queryFn: () => AISProjectManagerService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new AISProjectManager record.
 */
export function useCreateAISProjectManager() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AISProjectManager, "id">) => AISProjectManagerService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["aISProjectManager-list"] });
    },
  });
}

/**
 * Update an existing AISProjectManager record.
 */
export function useUpdateAISProjectManager() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<AISProjectManager, "id">>;
    }) => AISProjectManagerService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["aISProjectManager-list"] });
      client.invalidateQueries({ queryKey: ["aISProjectManager", variables.id] });
    },
  });
}

/**
 * Delete a AISProjectManager record by its unique identifier.
 */
export function useDeleteAISProjectManager() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AISProjectManagerService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["aISProjectManager-list"] });
      client.invalidateQueries({ queryKey: ["aISProjectManager", id] });
    },
  });
}