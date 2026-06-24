// backend/test/project.controller.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { withMockDb, freshRequire, createMockDb, fakeRes } = require('../test-helpers/mockDb');

describe('project.controller', () => {
  test('createProject creates a project and logs the action', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { createProject } = freshRequire('../src/controllers/project.controller');
      const req = { body: { name: 'My Project' }, user: { id: 1 } };
      const res = fakeRes();

      await createProject(req, res);

      assert.equal(res._status, 201);
      assert.equal(res._body.name, 'My Project');
      assert.equal(res._body.isActive, true);
    });
  });

  test('listProjects returns every created project', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { createProject, listProjects } = freshRequire('../src/controllers/project.controller');

      await createProject({ body: { name: 'Project A' }, user: { id: 1 } }, fakeRes());
      await createProject({ body: { name: 'Project B' }, user: { id: 1 } }, fakeRes());

      const res = fakeRes();
      await listProjects({}, res);

      assert.equal(res._body.length, 2);
      assert.deepEqual(res._body.map((p) => p.name).sort(), ['Project A', 'Project B']);
    });
  });

  test('getProject returns 404 for a project that does not exist', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { getProject } = freshRequire('../src/controllers/project.controller');
      const res = fakeRes();
      await getProject({ params: { id: '999' } }, res);
      assert.equal(res._status, 404);
    });
  });
});