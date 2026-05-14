import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectMediaURLService } from "../services/project-media-url-service";
import type { ProjectMediaURL } from "../models/project-media-url-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all ProjectMediaURL records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, projectid, urljsondata
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useProjectMediaURLList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["projectMediaURL-list", options],
    queryFn: () => ProjectMediaURLService.getAll(options),
  });
}

/**
 * Retrieve a single ProjectMediaURL record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useProjectMediaURL(id: string) {
  return useQuery({
    queryKey: ["projectMediaURL", id],
    queryFn: () => ProjectMediaURLService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new ProjectMediaURL record.
 */
export function useCreateProjectMediaURL() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ProjectMediaURL, "id">) => ProjectMediaURLService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["projectMediaURL-list"] });
    },
  });
}

/**
 * Update an existing ProjectMediaURL record.
 */
export function useUpdateProjectMediaURL() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<ProjectMediaURL, "id">>;
    }) => ProjectMediaURLService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["projectMediaURL-list"] });
      client.invalidateQueries({ queryKey: ["projectMediaURL", variables.id] });
    },
  });
}

/**
 * Delete a ProjectMediaURL record by its unique identifier.
 */
export function useDeleteProjectMediaURL() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ProjectMediaURLService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["projectMediaURL-list"] });
      client.invalidateQueries({ queryKey: ["projectMediaURL", id] });
    },
  });
}