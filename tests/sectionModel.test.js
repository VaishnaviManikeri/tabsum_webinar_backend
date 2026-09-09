const test = require('node:test');
const assert = require('node:assert/strict');
const SectionModel = require('../models/sectionModel');

test('SectionModel.parse accepts JSON objects already returned by MySQL', () => {
  const parsed = SectionModel.parse({
    id: 1,
    slug: 'speaker',
    content: { badge: 'Hello', title: 'World' },
    created_at: '2024-01-01',
    updated_at: '2024-01-02'
  });

  assert.deepEqual(parsed, {
    id: 1,
    slug: 'speaker',
    badge: 'Hello',
    title: 'World',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  });
});
