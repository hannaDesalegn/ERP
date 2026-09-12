/**
 * Audit log read endpoint — added by C with the team's agreement.
 *
 * An audit trail nobody can read is only half of the control. This exposes it
 * to administrators, filterable by resource, record and person, so "who
 * approved this order" is answerable without a database client.
 *
 * Read only, deliberately. There is no endpoint that edits or deletes an entry,
 * and there should never be one: a log a user can rewrite is not evidence.
 */

import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import AuditLog from '../models/AuditLog.js';
import { paginate } from '../utils/paginate.js';

const router = express.Router();

// Every route below requires a signed-in administrator.
router.use(requireAuth, requirePermission('audit.view'));

/**
 * GET /api/audit-logs
 *
 * Standard collection parameters from docs/api-contract.md §2, plus the
 * module-specific filters that make a log usable: resource, recordId, userId,
 * action and outcome.
 */
router.get('/', async (req, res, next) => {
  try {
    // These are the log's own filters, applied on top of whatever the shared
    // helper builds from the standard parameters.
    const baseFilter = {};
    for (const key of ['resource', 'recordId', 'action', 'outcome']) {
      if (req.query[key]) baseFilter[key] = String(req.query[key]);
    }
    if (req.query.userId) baseFilter.userId = String(req.query.userId);

    const result = await paginate(AuditLog, req.query, {
      searchFields: ['userEmail', 'path', 'resource', 'action'],
      sortable: ['createdAt', 'resource', 'action', 'statusCode'],
      defaultSort: '-createdAt',
      baseFilter: Object.keys(baseFilter).length ? baseFilter : undefined,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/record/:resource/:recordId
 *
 * The history of one record, oldest first, which is how a dispute is actually
 * read: what happened to this purchase order, in order.
 */
router.get('/record/:resource/:recordId', async (req, res, next) => {
  try {
    const entries = await AuditLog.find({
      resource: req.params.resource,
      recordId: req.params.recordId,
    }).sort({ createdAt: 1 });

    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

export default router;
