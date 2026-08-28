// The collection query params from docs/api-contract.md §2, in one place so
// every list endpoint behaves identically. Callers declare which fields are
// searchable and sortable; anything else in the query string is ignored rather
// than handed to Mongo.

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Search text ends up in a RegExp, so metacharacters must stay literal.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSort(raw, fallback, sortable) {
  let wanted = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
  // Unknown sort field falls back to the default instead of erroring.
  if (sortable.length && !sortable.includes(wanted.replace(/^-/, ''))) wanted = fallback;
  return { [wanted.replace(/^-/, '')]: wanted.startsWith('-') ? -1 : 1 };
}

export function parseListParams(query = {}, options = {}) {
  const {
    searchFields = [],
    sortable = [],
    defaultSort = '-createdAt',
    dateField = 'createdAt',
  } = options;

  const page = Math.max(1, toInt(query.page, 1));
  // Capped here regardless of what the client asks for.
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, toInt(query.perPage, DEFAULT_PER_PAGE)));

  const filter = {};

  if (query.search && searchFields.length) {
    const rx = new RegExp(escapeRegex(String(query.search)), 'i');
    filter.$or = searchFields.map((field) => ({ [field]: rx }));
  }

  // Repeatable: ?status=draft&status=sent arrives as an array, one value as a string.
  const statuses = [].concat(query.status ?? []).filter((s) => typeof s === 'string' && s);
  if (statuses.length) filter.status = { $in: statuses };

  // Inclusive both ends, so dateTo covers the whole of that day.
  const range = {};
  if (DATE_ONLY.test(query.dateFrom ?? '')) range.$gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
  if (DATE_ONLY.test(query.dateTo ?? '')) range.$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  if (Object.keys(range).length) filter[dateField] = range;

  return {
    page,
    perPage,
    skip: (page - 1) * perPage,
    filter,
    sort: parseSort(query.sort, defaultSort, sortable),
  };
}

// Runs the query and returns the §1 collection envelope, ready for res.json().
export async function paginate(model, query, options = {}) {
  const { page, perPage, skip, filter, sort } = parseListParams(query, options);

  // baseFilter is the caller's non-negotiable scope (e.g. "records this user may
  // see"). $and keeps a client-supplied filter from overwriting it.
  const where = options.baseFilter ? { $and: [filter, options.baseFilter] } : filter;

  const [data, total] = await Promise.all([
    model.find(where).sort(sort).skip(skip).limit(perPage),
    model.countDocuments(where),
  ]);

  return { data, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
}
