import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectProjectIds } from './projectAccess.js';

const req = (parts: { headers?: any; query?: any; body?: any; path?: string }) =>
  ({ headers: {}, query: {}, body: {}, path: '/', ...parts }) as any;

describe('collectProjectIds', () => {
  it('collects every place a client can name a project', () => {
    assert.deepEqual(collectProjectIds(req({ headers: { 'x-project-id': 'p1' } })), ['p1']);
    assert.deepEqual(collectProjectIds(req({ query: { project_id: 'p1' } })), ['p1']);
    assert.deepEqual(collectProjectIds(req({ query: { projectId: 'p1' } })), ['p1']);
    assert.deepEqual(collectProjectIds(req({ body: { project_id: 'p1' } })), ['p1']);
    assert.deepEqual(collectProjectIds(req({ body: { projectId: 'p1' } })), ['p1']);
    assert.deepEqual(collectProjectIds(req({ path: '/projects/p1/sync-inbox' })), ['p1']);
  });

  it('dedupes the same project and exposes conflicting ones', () => {
    assert.deepEqual(collectProjectIds(req({ headers: { 'x-project-id': 'p1' }, body: { project_id: 'p1' } })), ['p1']);
    assert.deepEqual(
      collectProjectIds(req({ headers: { 'x-project-id': 'mine' }, body: { project_id: 'victim' } })).sort(),
      ['mine', 'victim']
    );
  });

  it('ignores empty and non-string values', () => {
    assert.deepEqual(collectProjectIds(req({ headers: { 'x-project-id': '' }, query: { project_id: ['a', 'b'] } })), []);
  });
});
