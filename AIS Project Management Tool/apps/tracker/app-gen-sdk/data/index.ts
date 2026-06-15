/*!
 * app-gen-sdk compatibility / mapping layer for the AIS Precision Engineering Tracker.
 *
 * The generated services in `src/generated/services` were authored against an
 * earlier code-generator that emitted *friendly* field names (e.g. `projectname`,
 * `statusKey`) and addressed tables by their schema names (`AISProjectManager`).
 *
 * The shipping Power Apps Code Apps runtime (`@microsoft/power-apps/data`) talks to
 * Dataverse natively using the **entity set name** as the table identifier and the
 * raw `crd49_*` logical column names. This module bridges the two without requiring
 * any change to the existing application or generated-service code: it
 *   1. routes each call through the official `getClient(dataSourcesInfo)`,
 *   2. translates the schema name -> entity set name,
 *   3. maps friendly columns <-> `crd49_*` logical columns, and
 *   4. converts choice keys (`StatusKey0`) <-> Dataverse option values (839560000).
 */
import { getClient as getOfficialClient } from '@microsoft/power-apps/data';
import type { IOperationOptions, IOperationResult } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';

interface ChoiceMap {
  logical: string;
  /** friendly key -> Dataverse option value */
  toValue: Record<string, number>;
  /** Dataverse option value -> friendly key */
  toKey: Record<number, string>;
}

interface EntityMap {
  /** Dataverse entity set name used as the runtime table identifier. */
  entitySet: string;
  /** Logical name of the primary key column (mapped to the friendly `id`). */
  primaryId: string;
  /** friendly column name -> `crd49_*` logical name (non-choice scalar columns). */
  fields: Record<string, string>;
  /** friendly choice column name -> choice mapping. */
  choices: Record<string, ChoiceMap>;
}

const choice = (logical: string, prefix: string, base: number, count: number): ChoiceMap => {
  const toValue: Record<string, number> = {};
  const toKey: Record<number, string> = {};
  for (let i = 0; i < count; i++) {
    const key = `${prefix}${i}`;
    const value = base + i;
    toValue[key] = value;
    toKey[value] = key;
  }
  return { logical, toValue, toKey };
};

// Mapping config keyed by the schema name the generated services pass in.
const ENTITIES: Record<string, EntityMap> = {
  AISProjectManager: {
    entitySet: 'crd49_aisprojectmanagers',
    primaryId: 'crd49_aisprojectmanagerid',
    fields: {
      projectname: 'crd49_projectname',
      contributorsjsondata: 'crd49_contributornames',
      duedate: 'crd49_duedate',
      estimatedmanhourssaved: 'crd49_estimatedmanhourssaved',
      expectedbenefits: 'crd49_expectedbenefits',
      milestonesjsondata: 'crd49_milestonesjsondata',
      problemstatement: 'crd49_problemstatement',
      proposedsolution: 'crd49_proposedsolution',
      startdate: 'crd49_startdate',
    },
    choices: {
      projecttypeKey: choice('crd49_projecttype', 'ProjecttypeKey', 839560000, 2),
      statusKey: choice('crd49_status', 'StatusKey', 839560000, 5),
    },
  },
  ProjectMediaURL: {
    entitySet: 'crd49_projectmediaurls',
    primaryId: 'crd49_projectmediaurlid',
    fields: {
      projectid: 'crd49_projectid',
      urljsondata: 'crd49_urljsondata',
    },
    choices: {},
  },
};

function entityFor(name: string): EntityMap {
  const meta = ENTITIES[name];
  if (!meta) {
    throw new Error(`app-gen-sdk: unknown data source "${name}"`);
  }
  return meta;
}

/** Convert a friendly app record into a Dataverse (`crd49_*`) payload. */
function toDataverse(name: string, record: Record<string, unknown>): Record<string, unknown> {
  const meta = entityFor(name);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    if (value === undefined) continue;
    if (key === 'id') {
      out[meta.primaryId] = value;
    } else if (meta.fields[key]) {
      out[meta.fields[key]] = value;
    } else if (meta.choices[key]) {
      const c = meta.choices[key];
      out[c.logical] = value === null ? null : c.toValue[value as string] ?? value;
    } else {
      // Pass through any already-logical or system column untouched.
      out[key] = value;
    }
  }
  return out;
}

/** Convert a Dataverse record back into the friendly app shape. */
function fromDataverse(name: string, record: Record<string, unknown>): Record<string, unknown> {
  const meta = entityFor(name);
  const out: Record<string, unknown> = {};
  out.id = record[meta.primaryId];
  for (const [friendly, logical] of Object.entries(meta.fields)) {
    if (logical in record) out[friendly] = record[logical];
  }
  for (const [friendly, c] of Object.entries(meta.choices)) {
    const raw = record[c.logical];
    if (raw === null || raw === undefined) {
      out[friendly] = undefined;
    } else {
      out[friendly] = c.toKey[raw as number] ?? raw;
    }
  }
  return out;
}

function mapResult<T>(name: string, result: IOperationResult<unknown>): IOperationResult<T> {
  if (!result.success || result.data == null) {
    return result as IOperationResult<T>;
  }
  const data = Array.isArray(result.data)
    ? result.data.map((r) => fromDataverse(name, r as Record<string, unknown>))
    : fromDataverse(name, result.data as Record<string, unknown>);
  return { ...result, data } as IOperationResult<T>;
}

/**
 * Returns a data client that mirrors the original app-gen-sdk surface
 * (`getClient().createRecordAsync(...)`, etc.) while delegating to the official
 * Power Apps Code Apps runtime and applying the field/choice mapping above.
 */
export function getClient() {
  const client = getOfficialClient(dataSourcesInfo as never);
  return {
    async createRecordAsync<TResult = unknown>(name: string, record: Record<string, unknown>) {
      const meta = entityFor(name);
      const result = await client.createRecordAsync(meta.entitySet, toDataverse(name, record));
      return mapResult<TResult>(name, result);
    },
    async updateRecordAsync<TResult = unknown>(
      name: string,
      id: string,
      changedFields: Record<string, unknown>
    ) {
      const meta = entityFor(name);
      const result = await client.updateRecordAsync(meta.entitySet, id, toDataverse(name, changedFields));
      return mapResult<TResult>(name, result);
    },
    async deleteRecordAsync(name: string, id: string) {
      const meta = entityFor(name);
      return client.deleteRecordAsync(meta.entitySet, id);
    },
    async retrieveRecordAsync<TResult = unknown>(name: string, id: string, options?: IOperationOptions) {
      const meta = entityFor(name);
      const result = await client.retrieveRecordAsync(meta.entitySet, id, options);
      return mapResult<TResult>(name, result);
    },
    async retrieveMultipleRecordsAsync<TResult = unknown>(name: string, options?: IOperationOptions) {
      const meta = entityFor(name);
      const result = await client.retrieveMultipleRecordsAsync(meta.entitySet, options);
      return mapResult<TResult>(name, result);
    },
  };
}

export type { IOperationOptions, IOperationResult } from '@microsoft/power-apps/data';
