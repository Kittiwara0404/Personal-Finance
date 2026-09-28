// Extension registry. To add a feature module (e.g. budgeting, debt planner):
//   1. create src/modules/<id>/index.js exporting a FinanceModule
//   2. add it to MODULES below
// It gets an encrypted per-user store, its own /api/modules/<id> router, optional API-key
// routes under /api/v1/modules/<id>, and can contribute anonymized context to the AI advisor.

import { moduleStore } from './store.js';
import portfolio from './portfolio/index.js';

/**
 * @typedef {object} FinanceModule
 * @property {string} id
 * @property {string} name
 * @property {'stable'|'beta'|'planned'} status
 * @property {Record<string,string>} [scopes]           extra API-key scopes this module defines
 * @property {(ctx) => import('express').Router} register  browser (session) routes
 * @property {(ctx) => import('express').Router} [apiRoutes] API-key routes
 * @property {(ctx) => string|null} [advisorContext]      anonymized summary for the AI advisor
 * @property {(ctx) => object} [exportData]               included in the PDPA data export
 */

export const MODULES = [portfolio];

export function mountModules(app, { requireSession, requireApiKey }) {
  for (const mod of MODULES) {
    const store = moduleStore(mod.id);
    app.use(`/api/modules/${mod.id}`, mod.register({ store, requireSession }));
    if (mod.apiRoutes) app.use(`/api/v1/modules/${mod.id}`, mod.apiRoutes({ store, requireApiKey }));
  }
}

export function modulesAdvisorContext(userId) {
  return MODULES.map((m) => m.advisorContext?.({ store: moduleStore(m.id), userId })).filter(Boolean);
}

export function modulesExport(userId) {
  return Object.fromEntries(MODULES.filter((m) => m.exportData).map((m) => [m.id, m.exportData({ store: moduleStore(m.id), userId })]));
}

export const moduleScopes = () => Object.assign({}, ...MODULES.map((m) => m.scopes ?? {}));

export const moduleList = () => MODULES.map(({ id, name, status }) => ({ id, name, status }));
