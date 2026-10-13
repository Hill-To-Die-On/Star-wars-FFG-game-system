import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewScopes, normalizeReviewDraft, reviewDraftIssues, reviewRecordLane, isShortInterfaceLabel, reviewLabelGroup, restoreStoredReviewDraft, reviewTextGroups, reviewGroupState } from '../scripts/content-review-workflow.mjs';

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

test('one bundle contains single- and two-word interface labels without exempting short prose or code', () => {
  const label = (text, extra = {}) => ({ id: text, text, category: 'English interface', occurrences: [{ path: 'lang/en.json', location: '/label' }], ...extra });
  for (const text of ['Submit', 'Apply', 'Back', 'Save Changes', 'Ranged (Light)', 'Force-sensitive', 'Slot 1', 'Élan', 'Career ·', '· Manual:', 'Choose career…', 'Choose species...', 'Save & Close']) assert.equal(isShortInterfaceLabel(label(text)), true, text);
  for (const text of ['Save all changes', 'Read carefully.', '${name}', '{{name}}', '<b>Apply</b>', '.sf-control', 'SWFFG.Apply', '1']) assert.equal(isShortInterfaceLabel(label(text)), false, text);
  for (const category of ['Listing and manifest', 'Prepared guidance and rules text', 'Reference data and source metadata', 'Documentation']) assert.equal(isShortInterfaceLabel(label('Apply', { category })), false, category);
  assert.equal(isShortInterfaceLabel(label('Back', { category: 'Inline runtime text and code literals', occurrences: [{ path: 'src/dialog.mjs', reviewRole: 'interface-label' }] })), true);
  assert.equal(isShortInterfaceLabel(label('Back', { category: 'Inline runtime text and code literals', occurrences: [{ path: 'src/dialog.mjs', reviewRole: 'interface-label' }, { path: 'src/phrases.mjs', reviewRole: 'prepared-candidate' }] })), true, 'a known label retains all of its shared source occurrences in the bundle');
  assert.equal(isShortInterfaceLabel(review.entries[0]), false, 'an unknown runtime literal is not assumed to be a label');
  assert.deepEqual(reviewLabelGroup(review).entryIds, ['shared', 'word'], 'identical runtime copies join a known interface label');
});

test('one label statement covers its exact members while retaining individual decisions and longer copy', () => {
  const group = reviewLabelGroup(review);
  const entries = { word: { decision: 'human-origin', evidence: '', replacement: '' }, prose: { decision: 'human-origin', evidence: '', replacement: '' } };
  const draft = normalizeReviewDraft(review, input({ entries, labelReview: { state: 'evidence-recorded', reviewer: 'The User', evidence: 'Human interface catalogue history covers the included labels.', entryIds: group.entryIds } }));
  assert.deepEqual(draft.entries, entries);
  assert.deepEqual(draft.labelReview.entryIds, ['shared', 'word']);
  assert.deepEqual(reviewDraftIssues(review, draft).map(issue => issue.entryId), ['prose']);
  assert.equal(draft.submissionReady, false);
});

test('legacy drafts acquire an unfinished label bundle without inventing human evidence', () => {
  const entries = { word: { decision: 'rewrite-required', evidence: 'Unknown origin', replacement: 'Dismiss' } };
  const draft = normalizeReviewDraft(review, input({ entries }));
  assert.deepEqual(draft.entries, entries);
  assert.deepEqual(draft.labelReview, { state: 'pending', reviewer: '', evidence: '', entryIds: ['shared', 'word'] });
  assert.equal(draft.submissionReady, false);
});

test('a recorded label statement requires identity and evidence and cannot silently change coverage', () => {
  const labelReview = { state: 'evidence-recorded', reviewer: '', evidence: '', entryIds: reviewLabelGroup(review).entryIds };
  assert.equal(reviewDraftIssues(review, input({ labelReview }))[0].kind, 'label-evidence');
  for (const extra of [{ entryIds: [] }, { entryIds: ['word', 'prose'] }, { entryIds: ['word', 'word'] }, { state: 'approved-by-ai' }]) {
    assert.throws(() => normalizeReviewDraft(review, input({ labelReview: { ...labelReview, ...extra } })), /label/i);
  }
});

test('shared label evidence does not swallow a rewrite decision or a replacement that needs individual evidence', () => {
  const labelReview = { state: 'evidence-recorded', reviewer: 'The User', evidence: 'Human source for the other labels.', entryIds: reviewLabelGroup(review).entryIds };
  for (const value of [{ decision: 'rewrite-required', replacement: '' }, { decision: 'human-origin', replacement: 'Dismiss' }, { decision: 'third-party-rights', replacement: '' }]) {
    const draft = normalizeReviewDraft(review, input({ labelReview, entries: { word: { ...value, evidence: '' } } }));
    assert.equal(reviewDraftIssues(review, draft)[0].entryId, 'word');
    assert.equal(draft.entries.word.decision, value.decision);
    assert.equal(draft.entries.word.replacement, value.replacement);
  }
});

test('an expanded stored label bundle preserves all answers and its earlier statement as pending', () => {
  const previous = normalizeReviewDraft(review, input({ listingText: 'Human listing retained', entries: { word: { decision: 'rewrite-required', evidence: 'Original exception', replacement: 'Dismiss' } }, labelReview: { state: 'evidence-recorded', reviewer: 'The User', evidence: 'Original shared statement', entryIds: reviewLabelGroup(review).entryIds } }));
  const expanded = { ...review, entries: [...review.entries, { id: 'another-label', text: 'Choose career…', category: 'English interface', occurrences: [{ path: 'lang/en.json', location: '/career' }] }] };
  const restored = restoreStoredReviewDraft(expanded, previous);
  assert.equal(restored.coverageChanged, true);
  assert.deepEqual(restored.draft.entries, previous.entries);
  assert.equal(restored.draft.listingText, previous.listingText);
  assert.equal(restored.draft.labelReview.evidence, previous.labelReview.evidence);
  assert.equal(restored.draft.labelReview.state, 'pending');
  assert.deepEqual(restored.draft.labelReview.entryIds, ['shared', 'word', 'another-label']);
  assert.equal(restored.draft.submissionReady, false);
  for (const bad of [{ ...previous, archiveSha256: 'b'.repeat(64) }, { ...previous, labelReview: { ...previous.labelReview, entryIds: ['unknown'] } }]) assert.throws(() => restoreStoredReviewDraft(expanded, bad));
});

test('identical text forms one group across categories while preserving every original ID and occurrence', () => {
  const groups = reviewTextGroups(review.entries);
  const close = groups.find(group => group.text === 'Close');
  assert.deepEqual(close.entryIds, ['shared', 'word']);
  assert.equal(close.occurrences.length, 4);
  assert.deepEqual(close.categories, ['Inline runtime text and code literals', 'English interface']);
  assert.equal(reviewTextGroups([...review.entries, { ...review.entries[1], id: 'different-case', text: 'read the result' }, { ...review.entries[1], id: 'different-space', text: 'Read the result ' }]).length, 4, 'case and whitespace are not silently normalized');
  assert.deepEqual(review.entries[0].occurrences[0], { path: 'src/a.mjs', location: 'L1:1' }, 'inventory objects are not mutated');
});

test('one shared answer targets prepared copies and never technical or rights records', () => {
  const technical = { id: 'machine', text: 'Close', category: 'Reference data and source metadata', occurrences: [{ path: 'data/schema.json', location: '/format' }] };
  const rights = { ...technical, id: 'rights', occurrences: [{ path: 'data/reference.json', location: '/items/0/name' }] };
  const group = reviewTextGroups([...review.entries, technical, rights]).find(group => group.text === 'Close');
  const state = reviewGroupState(group, {});
  assert.deepEqual(state.targetIds, ['shared', 'word']);
  assert.deepEqual(state.conflicts, []);
  assert.deepEqual(state.value, { decision: 'human-origin', evidence: '', replacement: '' });
  const existing = { word: { decision: 'human-origin', evidence: 'Original shared human source', replacement: '' } };
  assert.deepEqual(reviewGroupState(group, existing).value, existing.word);
  assert.deepEqual(existing, { word: { decision: 'human-origin', evidence: 'Original shared human source', replacement: '' } }, 'grouping itself does not fill pending copies');
});

test('conflicting existing answers remain individual while unanswered identical copies can share one answer', () => {
  const another = { ...review.entries[1], id: 'another', text: 'Close' };
  const group = reviewTextGroups([...review.entries, another]).find(group => group.text === 'Close');
  const entries = { shared: { decision: 'human-origin', evidence: 'Original source', replacement: '' }, word: { decision: 'rewrite-required', evidence: 'Unknown origin', replacement: 'Dismiss' } };
  const state = reviewGroupState(group, entries);
  assert.deepEqual(state.targetIds, ['another']);
  assert.deepEqual(state.conflicts.map(entry => entry.id), ['shared', 'word']);
  assert.equal(entries.word.replacement, 'Dismiss');
  assert.deepEqual(reviewGroupState(group, { word: entries.word }).targetIds, ['shared', 'another'], 'an existing isolated rewrite is not spread to other copies');
});

test('human-origin is a scan default without inventing individual answers or completed sign-off', () => {
  const draft = normalizeReviewDraft(review, input());
  assert.equal(draft.defaultDecision, 'human-origin');
  assert.equal(draft.defaultSelectionIsSignOff, false);
  assert.deepEqual(draft.entries, {});
  assert.equal(draft.submissionReady, false);
});

test('an existing needs-review flag is retained instead of being replaced by the scan default', () => {
  const group = reviewTextGroups(review.entries).find(group => group.text === 'Close');
  const answers = { word: { decision: 'pending', evidence: '', replacement: '' } };
  const state = reviewGroupState(group, answers);
  assert.deepEqual(state.conflicts.map(entry => entry.id), ['word']);
  assert.deepEqual(state.targetIds, ['shared']);
  assert.equal(state.value.decision, 'human-origin');
  assert.equal(answers.word.decision, 'pending');
});

test('short-label duplicate coverage does not absorb marketing, rules prose or audit-only names', () => {
  const source={path:'data/reference.json',location:'/items/0/name'};
  const extended={...review,entries:[...review.entries,
    {id:'marketing',text:'Close',category:'Listing and manifest',occurrences:[{path:'system.json',location:'/title'}]},
    {id:'rule',text:'Close',category:'Prepared guidance and rules text',occurrences:[{path:'data/rules.json',location:'/description'}]},
    {id:'reference',text:'Close',category:'Reference data and source metadata',occurrences:[source]},
    {id:'case-sensitive',text:'close',category:'Inline runtime text and code literals',occurrences:[{path:'src/case.mjs',location:'L1:1'}]},
  ]};
  assert.deepEqual(reviewLabelGroup(extended).entryIds,['shared','word']);
});
