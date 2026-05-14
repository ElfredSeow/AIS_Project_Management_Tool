import { z } from 'zod';

/**
 * Zod schema for ProjectMediaURL validation
 */
export const ProjectMediaURLSchema = z.object({
  id: z.string().uuid(),
  projectid: z.string().min(1, { message: "Project ID is required" }),
  urljsondata: z.string().min(1, { message: "URL JSON Data is required" }),
});

/**
 * Schema for creating a new ProjectMediaURL (omits system-generated ID)
 */
export const CreateProjectMediaURLSchema = ProjectMediaURLSchema.omit({ id: true });

/**
 * Schema for updating an existing ProjectMediaURL
 */
export const UpdateProjectMediaURLSchema = ProjectMediaURLSchema;

export type ProjectMediaURLInput = z.infer<typeof ProjectMediaURLSchema>;
export type CreateProjectMediaURLInput = z.infer<typeof CreateProjectMediaURLSchema>;
export type UpdateProjectMediaURLInput = z.infer<typeof UpdateProjectMediaURLSchema>;