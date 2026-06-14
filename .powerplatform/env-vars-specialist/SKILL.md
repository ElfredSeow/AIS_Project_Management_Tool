---
name: codeapps-env-vars-specialist
description: Make a code app's data sources portable across Dev/Test/Prod by replacing hardcoded dataset/table names with Power Platform environment variable references (@envvar: syntax). NOT for Vite .env / import.meta.env — those are build-time browser constants, not Power Platform.
license: MIT
compatibility: Requires Power Platform CLI (pac). App must already be initialized (power.config.json exists) and the target environment variables must exist as solution components.
metadata:
  author: powerplatform
  version: "1.0"
---

Replace hardcoded `--dataset` / `--table` arguments in `pac code add-data-source` with `@envvar:` references so the app resolves the correct values per environment at runtime — no rebuild required.

**Source of truth**: https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/use-environment-variables

---

## What this is (and isn't)

**Is**: binding the `--dataset` and `--table` arguments of `pac code add-data-source` to Power Platform environment variables defined in a solution. The reference is stored in `power.config.json` verbatim and resolved at runtime by the platform.

**Isn't**: Vite `.env` files or `import.meta.env.VITE_*`. Those are build-time bundle constants in the browser — useful for feature flags or public API base URLs, but they have no link to Power Platform.

If the user asks about **secrets in the browser bundle** — push back: anything in `.env` shipped to the client is public. Route them to a connector, Dataverse, or a server-side flow instead.

---

## Step 1 — Verify prereqs

1. App initialized: `power.config.json` exists.
2. The connection exists in Power Apps ([make.powerapps.com](https://make.powerapps.com)).
3. The environment variables exist as solution components in the Dataverse environment. Schema names look like `<publisherprefix>_<Name>`, e.g. `crd1b_SharepointSiteVar`.

If env vars don't exist yet, direct the user to create them in the solution first: **Power Apps maker → Solutions → (your solution) → New → Environment variable**.

---

## Step 2 — Add the data source with @envvar: references

Prefix the schema name with `@envvar:` for `--dataset` and `--table`:

```powershell
pac code add-data-source `
  --apiid shared_sharepointonline `
  --connectionId <your_connection_id> `
  --dataset "@envvar:crd1b_SharepointSiteVar" `
  --table   "@envvar:crd1b_sharepointList"
```

Here:

- `crd1b_SharepointSiteVar` = schema name of env var holding the SharePoint site URL (dataset)
- `crd1b_sharepointList` = schema name of env var holding the list name (table)

---

## Step 3 — Verify

Open `power.config.json` and confirm the data source stores the `@envvar:` reference verbatim — not a resolved value:

```json
{
  "dataSources": {
    "<name>": {
      "dataset": "@envvar:crd1b_SharepointSiteVar",
      "table": "@envvar:crd1b_sharepointList"
    }
  }
}
```

When deployed to another environment, Power Platform substitutes the env var values configured there.

---

## What you can / can't bind with @envvar:

- ✅ Tabular `--dataset`
- ✅ Tabular `--table`
- ❌ API ID and Connection ID are not env-var-bindable. For connection portability across environments, use **connection references** instead — route to `powerapps-connector-integrator` (`-cr` flag) and `powerapps-alm-engineer`.

---

## Common confusion: Power Platform env vars vs Vite .env

| Scenario                                                | Answer                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Dataset/table that varies per environment               | `@envvar:` references via solution env vars — this skill                                  |
| Build-time constant in the browser (e.g., feature flag) | Vite `.env` + `import.meta.env.VITE_*` — not this skill                                   |
| True secret                                             | Don't put it in the browser bundle — use a connector, Dataverse, or a Power Automate flow |

---

## Handoffs

| Topic                                                  | Route to                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| Adding the data source itself                          | `powerapps-connector-integrator` or `powerapps-dataverse-specialist` |
| Solutions, connection references, deployment pipelines | `powerapps-alm-engineer`                                             |
