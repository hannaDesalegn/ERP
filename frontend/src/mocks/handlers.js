/**
 * Handler collection — owned by A.
 *
 * Collects each module's handlers from the registry. B and C write handlers in
 * their own folder and never touch this file.
 */

import { moduleHandlers } from '@/app/registry';

// TODO(A): add A's own handlers (auth, dashboard, users, roles, settings).
const foundationHandlers = [];

export const handlers = [...foundationHandlers, ...moduleHandlers];
