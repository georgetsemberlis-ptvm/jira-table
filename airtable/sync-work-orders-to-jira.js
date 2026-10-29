// Airtable automation "Run script" action.
//
// Trigger: Work Orders 🟪 -> "When a record is created or updated" (watch the fields mapped below).
// Input variables (Configure -> Input variables):
//   recordId  = Airtable record ID of the triggering Work Order
// Secrets (Configure -> Secrets): JIRA_EMAIL, JIRA_API_TOKEN
//
// What it does: finds the Work Order's PT Epic, collects ALL Work Orders for that epic, and writes one
// JSON payload (see src/frontend/payload.js) to the "Work Orders Table" Forge field on the epic.

const JIRA_SITE = 'https://cbsmarketing.atlassian.net';
const JIRA_FIELD_ID = 'customfield_XXXXX'; // TODO: id of the "Work Orders Table" field (Jira admin -> Custom fields)
const TABLE = 'Work Orders 🟪';
const F = {
  epicKey: 'PT Epic Key (Effective)',
  id: 'Work Order ID',
  name: 'Name',
  url: 'Work Order Interface URL',
  designer: 'Assignee',
  status: 'Work Order Status',
  dueDate: 'Due Date',
};
const MAX_ROWS = 100;            // keep in sync with MAX_ROWS in src/frontend/payload.js
const MAX_PAYLOAD_CHARS = 30000; // Jira string custom fields are capped near 32k characters

const DRY_RUN = false; // true: build and log the payload but do not call Jira

function buildPayload(rows, now) {
  const sorted = [...rows].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.id - b.id);
  let list = sorted.slice(0, MAX_ROWS);
  let json = JSON.stringify({ version: 1, updated: now, workOrders: list });
  while (json.length > MAX_PAYLOAD_CHARS && list.length > 1) {
    list = list.slice(0, Math.max(1, list.length - 5));
    json = JSON.stringify({ version: 1, updated: now, workOrders: list });
  }
  return { json, count: list.length, total: rows.length };
}

const { recordId } = input.config();
const jiraEmail = input.secret('JIRA_EMAIL');
const jiraToken = input.secret('JIRA_API_TOKEN');

const table = base.getTable(TABLE);
const query = await table.selectRecordsAsync({ fields: Object.values(F) });

const trigger = query.getRecord(recordId);
if (!trigger) throw new Error(`Work Order record ${recordId} not found`);
const epicKey = trigger.getCellValueAsString(F.epicKey).trim();
if (!/^[A-Z][A-Z0-9]+-\d+$/.test(epicKey)) {
  output.set('result', `Skipped: no valid PT Epic key (got "${epicKey}")`);
} else {
  const rows = query.records
    .filter((r) => r.getCellValueAsString(F.epicKey).trim() === epicKey)
    .map((r) => ({
      id: r.getCellValue(F.id),
      name: r.getCellValueAsString(F.name),
      url: r.getCellValueAsString(F.url),
      designer: r.getCellValueAsString(F.designer),
      status: r.getCellValueAsString(F.status),
      dueDate: r.getCellValueAsString(F.dueDate),
    }));
  const { json, count, total } = buildPayload(rows, new Date().toISOString());

  if (DRY_RUN) {
    console.log(json);
    output.set('result', `DRY RUN: ${count}/${total} work orders for ${epicKey}`);
  } else {
    const res = await fetch(`${JIRA_SITE}/rest/api/3/issue/${epicKey}`, {
      method: 'PUT',
      headers: {
        Authorization: 'Basic ' + btoa(`${jiraEmail}:${jiraToken}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { [JIRA_FIELD_ID]: json } }),
    });
    if (!res.ok) throw new Error(`Jira update of ${epicKey} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    output.set('result', `Updated ${epicKey} with ${count}/${total} work orders`);
  }
}
