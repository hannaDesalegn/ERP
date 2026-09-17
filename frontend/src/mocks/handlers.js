/**
 * Handler collection.
 *
 * Collects each module's handlers from the registry. Handlers live in their own
 * module folder and are exported from `modules/<name>/index.js`, so adding a
 * module does not require editing this file.
 */

import { moduleHandlers } from '@/app/registry';

import { authHandlers } from './authHandlers';
import { dashboardHandlers } from './dashboardHandlers';
import { settingsHandlers } from './settingsHandlers';
import { roleHandlers, userHandlers } from './userHandlers';

const foundationHandlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...userHandlers,
  ...roleHandlers,
  ...settingsHandlers,
];

export const handlers = [...foundationHandlers, ...moduleHandlers];
