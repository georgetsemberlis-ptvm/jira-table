import React, { useState } from 'react';
import ForgeReconciler, {
  CustomFieldEdit,
  DynamicTable,
  Link,
  Lozenge,
  SectionMessage,
  Text,
  TextArea,
  useProductContext,
} from '@forge/react';
import { parsePayload, statusAppearance } from './payload';

const head = {
  cells: [
    { key: 'id', content: 'WO ID' },
    { key: 'name', content: 'Work Order' },
    { key: 'designer', content: 'Designer' },
    { key: 'status', content: 'Status' },
    { key: 'dueDate', content: 'Due' },
  ],
};

const toRows = (workOrders) =>
  workOrders.map((wo, i) => ({
    key: `wo-${wo.id || i}`,
    cells: [
      { key: 'id', content: wo.id ? `WO-${wo.id}` : '' },
      { key: 'name', content: wo.url ? <Link href={wo.url} openNewTab>{wo.name || wo.id}</Link> : wo.name },
      { key: 'designer', content: wo.designer },
      { key: 'status', content: wo.status ? <Lozenge appearance={statusAppearance(wo.status)}>{wo.status}</Lozenge> : '' },
      { key: 'dueDate', content: wo.dueDate },
    ],
  }));

const View = ({ value }) => {
  const result = parsePayload(value);
  if (!result.ok) {
    return <SectionMessage appearance="error" title="Work Orders payload is invalid"><Text>{result.error}</Text></SectionMessage>;
  }
  if (result.workOrders.length === 0) return <Text>No related work orders.</Text>;
  return (
    <>
      <DynamicTable head={head} rows={toRows(result.workOrders)} />
      {result.truncated && <Text>Showing first {result.workOrders.length} work orders.</Text>}
      {result.updated && <Text>Last synced: {result.updated}</Text>}
    </>
  );
};

const Edit = ({ initial }) => {
  const [text, setText] = useState(initial || '');
  const result = parsePayload(text);
  return (
    <CustomFieldEdit onSubmit={() => (result.ok ? text.trim() : initial)} hideActionButtons={!result.ok}>
      <TextArea value={text} onChange={(e) => setText(e.target.value)} />
      {!result.ok && <Text>{result.error}</Text>}
    </CustomFieldEdit>
  );
};

const App = () => {
  const context = useProductContext();
  if (!context) return <Text>Loading…</Text>;
  const { fieldValue, isEditing } = context.extension;
  const value = typeof fieldValue === 'string' ? fieldValue : '';
  return context.extension.renderContext === 'edit' || isEditing ? <Edit initial={value} /> : <View value={value} />;
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
