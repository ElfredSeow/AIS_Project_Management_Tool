import { z } from 'zod';

/**
 * Zod schema for AISProjectManager validation
 */
export const AISProjectManagerSchema = z.object({
  id: z.string().uuid(),
  projectname: z.string().min(1, { message: "Project Name is required" }),
  contributorsjsondata: z.string().optional(),
  duedate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  estimatedmanhourssaved: z.number().int().optional(),
  expectedbenefits: z.string().optional(),
  milestonesjsondata: z.string().optional(),
  problemstatement: z.string().optional(),
  projecttypeKey: z.enum(['ProjecttypeKey0', 'ProjecttypeKey1']),
  proposedsolution: z.string().optional(),
  startdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  statusKey: z.enum(['StatusKey0', 'StatusKey1', 'StatusKey2', 'StatusKey3', 'StatusKey4']),
});

/**
 * Schema for creating a new AISProjectManager (omits system-generated ID)
 */
export const CreateAISProjectManagerSchema = AISProjectManagerSchema.omit({ id: true });

/**
 * Schema for updating an existing AISProjectManager
 */
export const UpdateAISProjectManagerSchema = AISProjectManagerSchema;

export type AISProjectManagerInput = z.infer<typeof AISProjectManagerSchema>;
export type CreateAISProjectManagerInput = z.infer<typeof CreateAISProjectManagerSchema>;
export type UpdateAISProjectManagerInput = z.infer<typeof UpdateAISProjectManagerSchema>;