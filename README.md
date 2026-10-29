# Work Orders Table (Jira Forge custom field)

A Jira custom field that displays related Airtable Work Orders as a table on an issue (WO ID, name linked to the
Airtable interface, designer, status, due date). It does not depend on linked Jira issues. The field stores a JSON
string; an Airtable automation keeps it up to date.

```
Airtable "Work Orders 🟪"  --(automation script, Jira REST PUT)-->  Jira PT epic field "Work Orders Table"
                                                                      (rendered by this Forge app)
```

## 1. Deploy the Forge app

Needs Node 20+/22 and a Jira site admin for the install step.

```bash
npm install -g @forge/cli
forge login          # Atlassian email + API token from https://id.atlassian.com/manage-profile/security/api-tokens
npm install
forge register       # names the app and writes the real app id into manifest.yml (commit that change)
forge lint
forge deploy -e development
forge install -e development --site cbsmarketing.atlassian.net --product jira
```

For production, repeat the last two commands with `-e production`. This is an internal single-site app, so it needs no
Marketplace listing. After installing, in Jira: Settings -> Issues -> Custom fields, add/confirm "Work Orders Table",
associate it with the PT project's context and issue screens, and note its id (`customfield_NNNNN`).

## 2. Set up the Airtable automation

1. In the Airtable base, create an automation on `Work Orders 🟪`: trigger "When a record is created or updated",
   watching `Work Order ID`, `Name`, `Assignee`, `Work Order Status`, `Due Date`, `PT Epic Key (Effective)`.
2. Add a "Run script" action, paste `airtable/sync-work-orders-to-jira.js`, set input variable `recordId` to the
   triggering record, and add secrets `JIRA_EMAIL` and `JIRA_API_TOKEN`.
3. Set `JIRA_FIELD_ID` at the top of the script. Test with `DRY_RUN = true` first, then set it to `false`.

Field mapping: `id` = Work Order ID, `name` = Name, `url` = Work Order Interface URL, `designer` = Assignee (text),
`status` = Work Order Status, `dueDate` = Due Date. The epic is `PT Epic Key (Effective)`.

## Payload

```json
{ "version": 1, "updated": "2026-10-28T16:00:00Z",
  "workOrders": [ { "id": 28133, "name": "…(WO-28133)", "url": "https://airtable.com/…",
                    "designer": "Michael Aguila", "status": "Active", "dueDate": "2026-11-20" } ] }
```

Max 100 rows and about 30k characters (Jira string-field limit); rows are sorted by due date and the script drops the latest-due rows if needed to fit.

## Notes for admin review

- **Forge app permissions:** none. `permissions.scopes` is empty, there are no backend functions and no external
  egress. The app only renders the string already stored in the field. Links are restricted to `https`.
- **Data flow:** Airtable -> Jira REST API (HTTPS). Nothing goes to any third party. Data written is limited to the
  six fields above, per work order.
- **Credential:** `JIRA_API_TOKEN` is the only secret. It lives in Airtable automation secrets, never in this repo.
  Recommend a dedicated service account (not a person's) with only "Edit issues" on the PT project, so the token
  cannot touch other projects. Rotate it on the normal schedule.
- **Blast radius:** the script issues one `PUT /rest/api/3/issue/{PT epic}` that sets a single custom field. It skips
  records without a valid epic key and throws (visible in automation run history) if Jira rejects the update.
- **Rollback:** disable the Airtable automation; run `forge uninstall` to remove the app; delete the custom field.

## Tests

```bash
npm test
```

Covers payload parsing and an end-to-end run of the Airtable script against a mocked Airtable and Jira.
