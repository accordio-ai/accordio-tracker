/**
 * Tool result → clickable artifact. Pins the result shapes of
 * `Accordio/lib/brain-tools.ts` that the menubar chat depends on: if the web
 * app renames `contract.editUrl` or `invoice.viewUrl`, the card must still
 * open from the id, and a failed call must never produce a card.
 */

import { section, expect, report } from './harness';
import { resolveArtifact, artifactHref } from '../src/renderer/lib/chat/artifacts';

section('createContract');
{
  const a = resolveArtifact(
    'createContract',
    {
      success: true,
      contract: { id: 'c1', title: 'Website redesign', status: 'draft', amount: '$4,500', editUrl: '/contracts/c1' },
      message: 'Contract created',
    },
    { clientName: 'Acme', projectDescription: 'Redesign of acme.com', paymentTerms: '50% upfront' }
  );
  expect('kind', a?.kind, 'contract');
  expect('path from editUrl', a?.path, '/contracts/c1');
  expect('title', a?.title, 'Website redesign');
  expect('subtitle', a?.subtitle, '$4,500 · Acme · Draft');
  expect('sheet lines', a?.sheet?.lines?.join('|'), 'Redesign of acme.com|50% upfront');
}
{
  const a = resolveArtifact('createContract', { success: true, contract: { id: 'c 2', title: 'T' } });
  expect('path falls back to id, encoded', a?.path, '/contracts/c%202');
  expect('status defaults to Draft', a?.subtitle, 'Draft');
}
expect('no contract id → no card', resolveArtifact('createContract', { success: true, contract: { title: 'T' } }), null);
expect('error → no card', resolveArtifact('createContract', { error: 'Failed to create contract' }), null);
expect('success:false → no card', resolveArtifact('createContract', { success: false, contract: { id: 'x' } }), null);

section('createInvoice');
{
  const a = resolveArtifact(
    'createInvoice',
    {
      success: true,
      invoice: { id: 'i1', number: 'INV-0007', amount: '$1,200', status: 'draft', dueDate: '2026-09-30', viewUrl: '/invoices/i1' },
    },
    { clientName: 'Acme', description: 'August retainer' }
  );
  expect('kind', a?.kind, 'invoice');
  expect('path', a?.path, '/invoices/i1');
  expect('title from number', a?.title, 'Invoice INV-0007');
  expect('subtitle', a?.subtitle, '$1,200 · Acme · Draft');
  expect('sheet lines', a?.sheet?.lines?.join('|'), 'August retainer|Due 2026-09-30');
}
{
  const a = resolveArtifact('createInvoice', { success: true, invoice: { id: 'i2', viewUrl: 'https://app.accordio.ai/invoices/i2' } });
  expect('absolute viewUrl reduced to path', a?.path, '/invoices/i2');
  expect('title without number', a?.title, 'Invoice');
}

section('createClient');
{
  const a = resolveArtifact('createClient', { success: true, client: { id: 'k1', company_name: 'Acme Ltd' }, viewUrl: '/clients/k1' });
  expect('kind', a?.kind, 'client');
  expect('path', a?.path, '/clients/k1');
  expect('title', a?.title, 'Acme Ltd');
  expect('subtitle', a?.subtitle, 'Added to clients');
}
{
  const a = resolveArtifact('createClient', { alreadyExists: true, client: { id: 'k2', contact_name: 'Jo' } });
  expect('existing client still opens', a?.path, '/clients/k2');
  expect('existing client subtitle', a?.subtitle, 'Already in your clients');
}

section('other tools');
expect('read tool → no card', resolveArtifact('listTasks', { tasks: [] }), null);
expect('non-object → no card', resolveArtifact('createContract', 'ok'), null);
expect('null → no card', resolveArtifact('createContract', null), null);
{
  const a = resolveArtifact('someFutureTool', { redirectUrl: '/projects/p1', title: 'Project' });
  expect('redirectUrl → link row', a?.kind, 'link');
  expect('link path', a?.path, '/projects/p1');
}
expect('external redirectUrl host is dropped', resolveArtifact('x', { redirectUrl: 'https://evil.example/phish' })?.path, '/phish');

section('artifactHref');
expect('joins', artifactHref('https://app.accordio.ai', '/contracts/c1'), 'https://app.accordio.ai/contracts/c1');
expect('strips trailing slash', artifactHref('http://localhost:3000/', '/invoices/i1'), 'http://localhost:3000/invoices/i1');

report();
