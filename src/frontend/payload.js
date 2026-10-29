// Payload contract (stored as a JSON string in the Jira field):
//   { "version": 1, "updated": "<ISO timestamp>", "workOrders": [ { id, name, url, designer, status, dueDate } ] }
// A bare array of work orders is also accepted.

export const MAX_ROWS = 100;

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

const safeUrl = (v) => {
  const s = str(v);
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

export function normalizeWorkOrder(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id && !name) return null;
  return {
    id,
    name,
    url: safeUrl(raw.url),
    designer: str(raw.designer),
    status: str(raw.status),
    dueDate: str(raw.dueDate),
  };
}

// Returns { ok, workOrders, updated, truncated, error }.
export function parsePayload(value) {
  if (value === null || value === undefined || str(value) === '') {
    return { ok: true, workOrders: [], updated: '', truncated: false };
  }
  let data;
  try {
    data = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
  const list = Array.isArray(data) ? data : data && data.workOrders;
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Expected an array or an object with a "workOrders" array.' };
  }
  const rows = list.map(normalizeWorkOrder).filter(Boolean);
  return {
    ok: true,
    workOrders: rows.slice(0, MAX_ROWS),
    updated: Array.isArray(data) ? '' : str(data.updated),
    truncated: rows.length > MAX_ROWS,
  };
}

const STATUS_APPEARANCE = {
  completed: 'success',
  complete: 'success',
  done: 'success',
  active: 'inprogress',
  'in progress': 'inprogress',
  blocked: 'removed',
  cancelled: 'removed',
  canceled: 'removed',
  new: 'new',
};

export const statusAppearance = (status) => STATUS_APPEARANCE[status.toLowerCase()] || 'default';
