import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewScopes, normalizeReviewDraft, reviewDraftIssues, reviewRecordLane } from '../scripts/content-review-workflow.mjs';

const review = {
  archiveSha256: 'a'.repeat(64),
  entries: [
    { id: 'shared', text: 'Close', category: 'Inline runtime text and code literals', occurrences: [
      { path: 'src/a.mjs', location: 'L1:1' }, { path: 'src/a.mjs', location: 'L2:1' }, { path: 'src/b.mjs', location: 'L1:1' },
    ] },
    { id: 'prose', text: 'Read the result', category: 'Inline runtime text and code literals', occurrences: [{ path: 'src/a.mjs', location: 'L3:1' }] },
    { id: 'word', text: 'Close', category: 'English interface', occurrences: [{ path: 'lang/en.json', location: '/close' }] },
  ],
  humanGates: [{ id: 'maintainability' }],
};
const input = (extra = {}) => ({ archiveSha256: review.archiveSha256, reviewer: 'The User', entries: {}, ...extra });

test('unfinished legacy drafts remain exportable without losing listing, gate answers or decisions', () => {
  const draft = normalizeReviewDraft(review, input({ listingText: 'The human listing', humanGates: { maintainability: 'correct' },
    entries: { word: { decision: 'human-origin', evidence: '', replacement: '' } }, submissionReady: true }));
  assert.equal(draft.listingText, 'The human listing');
  assert.equal(draft.humanGates.maintainability, 'correct');
  assert.equal(draft.entries.word.decision, 'human-origin');
  assert.equal(draft.submissionReady, false);
  const issues = reviewDraftIssues(review, draft);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].entryId, 'word');
  assert.match(issues[0].message, /lang\/en\.json.*evidence/i);
});

test('scope review groups by file and category without classifying single words or code as human-authored', () => {
  const scopes = reviewScopes(review);
  assert.equal(scopes.length, 3);
  assert.deepEqual(scopes.find(scope => scope.path === 'src/a.mjs').entryIds, ['shared', 'prose']);
  assert.ok(scopes.find(scope => scope.path === 'lang/en.json').entryIds.includes('word'));
  assert.ok(scopes.every(scope => !('decision' in scope)));
});

test('source evidence is recorded once without manufacturing individual decisions or submission approval', () => {
  const scope = reviewScopes(review).find(scope => scope.path === 'lang/en.json');
  const draft = normalizeReviewDraft(review, input({ scopeReviews: { [scope.id]: {
    state: 'evidence-recorded', reviewer: 'The User', evidence: 'Original interface catalogue history at commit abc; edited by the human maintainer.',
  } } }));
  assert.deepEqual(draft.entries, {});
  assert.equal(draft.scopeReviews[scope.id].state, 'evidence-recorded');
  assert.equal(draft.submissionReady, false);
  assert.deepEqual(reviewDraftIssues(review, draft), []);
});

test('shared evidence covers all occurrences before satisfying a per-record missing-evidence check', () => {
  const scopes = reviewScopes(review), scopeReviews = {};
  const draft = input({ entries: { shared: { decision: 'human-origin', evidence: '' } }, scopeReviews });
  for (const path of ['src/a.mjs', 'src/b.mjs']) {
    const scope = scopes.find(scope => scope.path === path);
    scopeReviews[scope.id] = { state: 'evidence-recorded', reviewer: 'The User', evidence: 'Same original human-written label is used in this source.' };
    assert.equal(reviewDraftIssues(review, draft).length, path === 'src/a.mjs' ? 1 : 0);
  }
});

test('scope evidence cannot erase an explicit rewrite decision or replacement', () => {
  const scope = reviewScopes(review).find(scope => scope.path === 'lang/en.json');
  const draft = normalizeReviewDraft(review, input({ entries: { word: { decision: 'rewrite-required', evidence: 'Unknown original source', replacement: 'Dismiss' } },
    scopeReviews: { [scope.id]: { state: 'evidence-recorded', reviewer: 'The User', evidence: 'Source review with per-entry exceptions' } } }));
  assert.equal(draft.entries.word.decision, 'rewrite-required');
  assert.equal(draft.entries.word.replacement, 'Dismiss');
});

test('structural validation still rejects other archives, unknown entries, decisions and source scopes', () => {
  for (const bad of [
    input({ archiveSha256: 'b'.repeat(64) }),
    input({ entries: { unknown: { decision: 'pending' } } }),
    input({ entries: { word: { decision: 'approve-ai-text' } } }),
    input({ scopeReviews: { unknown: { state: 'evidence-recorded', evidence: 'A note' } } }),
  ]) assert.throws(() => normalizeReviewDraft(review, bad));
});

test('unfinished source notes remain drafts and named source evidence remains mandatory for recording', () => {
  const scope = reviewScopes(review)[0];
  const draft = normalizeReviewDraft(review, input({ scopeReviews: { [scope.id]: { state: 'evidence-recorded', reviewer: '', evidence: '' } } }));
  assert.equal(reviewDraftIssues(review, draft)[0].scopeId, scope.id);
  draft.scopeReviews[scope.id].state = 'pending';
  assert.deepEqual(reviewDraftIssues(review, draft), []);
});

test('the complete inventory is not a mandatory row-by-row checklist', () => {
  const draft = normalizeReviewDraft(review, input());
  assert.deepEqual(reviewDraftIssues(review, draft), []);
  assert.equal(draft.submissionReady, false);
});

test('technical package documents and code do not require prepared-copy authorship checks', () => {
  const doc = { id: 'changelog', category: 'Documentation', text: '# Changelog', occurrences: [{ path: 'CHANGELOG.md', location: 'complete file' }] };
  const code = { id: 'selector', category: 'Inline runtime text and code literals', text: '.button', occurrences: [{ path: 'src/a.mjs', location: 'L1:1', reviewRole: 'technical' }] };
  assert.equal(reviewRecordLane(doc), 'maintenance');
  assert.equal(reviewRecordLane(code), 'maintenance');
  const extended = { ...review, entries: [...review.entries, doc, code] };
  const draft = normalizeReviewDraft(extended, input({ entries: { changelog: { decision: 'human-origin', evidence: '' }, selector: { decision: 'technical-only', evidence: '' } } }));
  assert.deepEqual(reviewDraftIssues(extended, draft), []);
  assert.equal(draft.entries.changelog.decision, 'human-origin', 'previous answers are retained even when outside the authorship queue');
});

test('short labels and inline prepared copy remain content even alongside technical occurrences', () => {
  assert.equal(reviewRecordLane(review.entries.find(entry => entry.id === 'word')), 'prepared');
  assert.equal(reviewRecordLane({ ...review.entries[0], occurrences: [
    { path: 'src/a.mjs', reviewRole: 'technical' }, { path: 'src/b.mjs' },
  ] }), 'prepared');
  assert.equal(reviewRecordLane({ category: 'Listing and manifest', occurrences: [{ path: 'system.json' }] }), 'prepared');
  assert.equal(reviewRecordLane({ category: 'Documentation', occurrences: [{ path: 'docs/lore/story.md' }] }), 'prepared');
});

test('dataset permissions are grouped while rendered journal content remains in the authorship queue', () => {
  assert.equal(reviewRecordLane({ category: 'Reference data and source metadata', occurrences: [{ path: 'data/reference.json', location: '/items/0/_id' }] }), 'maintenance');
  assert.equal(reviewRecordLane({ category: 'Reference data and source metadata', occurrences: [{ path: 'data/reference.json', location: '/items/0/name' }] }), 'rights');
  assert.equal(reviewRecordLane({ category: 'Reference data and source metadata', occurrences: [{ path: 'data/reference.json', location: '/items/0/pages/0/text/content' }] }), 'prepared');
  assert.equal(reviewRecordLane({ category: 'Prepared guidance and rules text', occurrences: [{ path: 'data/guidance.json', location: '/entries/0/summary' }] }), 'prepared');
});

test('schema identifiers and record IDs from the reported screenshot are audit metadata', () => {
  for (const [text, location] of [['star-wars-ffg-advancement-trees', '/format'], ['14b710c863b5df75', '/items/0/_id']]) {
    const entry = { id: location, text, category: 'Reference data and source metadata', occurrences: [{ path: 'data/advancement-trees.json', location }] };
    assert.equal(reviewRecordLane(entry), 'maintenance', text);
    const inventory = { ...review, entries: [entry] };
    assert.deepEqual(reviewDraftIssues(inventory, input({ entries: { [entry.id]: { decision: 'human-origin', evidence: '' } } })), []);
  }
});

test('metadata field context never exempts a displayed label with the same text', () => {
  const text = '14b710c863b5df75';
  assert.equal(reviewRecordLane({ text, category: 'English interface', occurrences: [{ path: 'lang/en.json', location: '/id' }] }), 'prepared');
  assert.equal(reviewRecordLane({ text, category: 'Reference data and source metadata', occurrences: [{ path: 'data/reference.json', location: '/items/0/name' }] }), 'rights');
  assert.equal(reviewRecordLane({ text, category: 'Prepared guidance and rules text', occurrences: [{ path: 'data/rules.json', location: '/effects/0/type' }] }), 'maintenance');
  assert.equal(reviewRecordLane({ text: 'Apply one Boost die.', category: 'Prepared guidance and rules text', occurrences: [{ path: 'data/rules.json', location: '/effects/0/description' }] }), 'prepared');
});

test('reference rights use source evidence rather than per-record authorship requirements', () => {
  const entry = { id: 'catalogue-name', text: 'Investigator', category: 'Reference data and source metadata', occurrences: [{ path: 'data/reference.json', location: '/items/0/name' }] };
  const inventory = { ...review, entries: [entry] };
  const draft = normalizeReviewDraft(inventory, input({ entries: { [entry.id]: { decision: 'third-party-rights', evidence: '', replacement: 'Legacy note retained' } } }));
  assert.deepEqual(reviewDraftIssues(inventory, draft), []);
  assert.equal(draft.entries[entry.id].replacement, 'Legacy note retained');
  assert.equal(draft.submissionReady, false);
});
