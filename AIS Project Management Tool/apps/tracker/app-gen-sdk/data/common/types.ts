/*!
 * app-gen-sdk compatibility layer.
 * Re-exports the operation option/result contracts from the official
 * Power Apps Code Apps data SDK so the generated services keep compiling
 * unchanged against `../../../app-gen-sdk/data/common/types`.
 */
export type { IOperationOptions, IOperationResult } from '@microsoft/power-apps/data';
