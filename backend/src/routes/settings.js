import { Router } from 'express';
import { z } from 'zod';

import Settings from '../models/Settings.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { validateBody } from '../utils/validate.js';

const router = Router();

router.use(requireAuth);

// ── Validation ───────────────────────────────────────────────────────────────
// Mirrors settingsSchema in frontend/src/pages/SettingsPage.jsx. updatedAt is
// absent on purpose — it is server-managed, and validateBody strips anything not
// declared here, so a client cannot set it.

/** What the server supports, not what the select happens to offer today. */
const SUPPORTED_CURRENCIES = ['ETB', 'USD', 'EUR'];

/**
 * Optional address lines are null, never "" — entities.md § Address.
 *
 * The frontend spells this as `.nullable().or(z.literal('').transform(...))`,
 * where the left branch of the union already accepts "" and returns it, so the
 * transform never runs and an emptied input is stored as "". Written as a
 * transform on the one schema it cannot be short-circuited, so "" and null both
 * land as null the way the typedef says.
 */
const optionalLine = z
  .string()
  .trim()
  .max(255, 'Too long.')
  .nullable()
  .transform((value) => (value === null || value === '' ? null : value));

const settingsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, 'Enter a company name.')
    .max(255, 'Name is too long.'),

  // Nested keys come back dotted — "companyAddress.city" — because Zod's issue
  // paths join that way and that is exactly what React Hook Form's setError
  // takes for a nested field. The page maps fields onto inputs untranslated.
  companyAddress: z.object({
    line1: z.string().trim().min(1, 'Enter the first address line.').max(255),
    line2: optionalLine,
    city: z.string().trim().min(1, 'Enter a city.').max(255),
    region: optionalLine,
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Use the two-letter country code, e.g. ET.'),
    postalCode: optionalLine,
  }),

  // The form's select is the menu; this is the rule. The frontend only checks
  // that something was chosen, so an unsupported currency is caught here.
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES, 'Choose a currency.'),

  defaultPaymentTermsDays: z
    .number({ error: 'Enter a whole number of days.' })
    .int('Enter a whole number of days.')
    .min(0, 'Must be zero or greater.')
    .max(365, 'Must be 365 days or fewer.'),

  invoiceNumberPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}$/, 'Two to five capital letters, e.g. INV.'),

  defaultReorderLevel: z
    .number({ error: 'Enter a whole number.' })
    .int('Enter a whole number.')
    .min(0, 'Must be zero or greater.'),
});

/**
 * PATCH: same rules, every top-level field optional.
 *
 * .partial() is shallow, which is what this endpoint wants — companyAddress may
 * be omitted, but a companyAddress that is present must be a whole address. See
 * the note on replacement below.
 */
const settingsUpdateSchema = settingsSchema.partial();

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/settings — a singleton, not a collection: one resource, so the
 * envelope is { data } with no meta, and there is no id in the path or the body.
 *
 * load() creates the document on first read, so this answers before anyone has
 * ever saved the page.
 */
router.get('/', requirePermission('settings.view'), async (req, res, next) => {
  try {
    res.json({ data: await Settings.load() });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/settings — partial, 200 with the updated resource. */
router.patch(
  '/',
  requirePermission('settings.edit'),
  validateBody(settingsUpdateSchema),
  async (req, res, next) => {
    try {
      const settings = await Settings.load();
      const patch = req.body;

      // Assigned field by field rather than by spreading the body — the same
      // reason as everywhere else, though here the schema has already stripped
      // anything unrecognised.
      for (const field of [
        'companyName',
        'defaultCurrency',
        'defaultPaymentTermsDays',
        'invoiceNumberPrefix',
        'defaultReorderLevel',
      ]) {
        if (patch[field] !== undefined) settings[field] = patch[field];
      }

      // companyAddress is replaced wholesale rather than deep-merged: the form
      // always sends all six fields, and a half-merged address — a new city
      // sitting above the old postcode — is worse than an obviously replaced
      // one. The schema enforces that half an address cannot be sent at all.
      if (patch.companyAddress !== undefined) {
        settings.companyAddress = patch.companyAddress;
      }

      // timestamps:true moves updatedAt, which is the field the page displays.
      await settings.save();

      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
