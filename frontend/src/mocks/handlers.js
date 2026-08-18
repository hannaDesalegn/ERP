/**
 * Handler collection — owned by A.
 *
 * Collects each module's handlers from the registry. B and C write handlers in
 * their own folder and export them from `modules/<name>/index.js`; they never
 * edit this file.
 */

import { moduleHandlers } from '@/app/registry';

import { authHandlers } from './authHandlers';
import { dashboardHandlers } from './dashboardHandlers';

// TODO(A): users, roles, settings still to come.
const foundationHandlers = [...authHandlers, ...dashboardHandlers];

export const handlers = [...foundationHandlers, ...moduleHandlers];
