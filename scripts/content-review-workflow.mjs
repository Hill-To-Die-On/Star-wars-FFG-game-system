/** Machine fields are identified by their role, not by the spelling/length of a value. */
export function isTechnicalReviewField(field) {
  return /^(?:_?id|uuid|format|schema|schemaVersion|version|sha256|hash|checksum|slug|path|src|img|icon|type|kind|status|key|pack|collection|documentType|documentName|isbn|mimeType|url)$/i.test(field) ||
    /(?:Id|Ids|UUID|Uuid|Hash|Checksum|Key|Path|Format|Schema|Url|URL)$/.test(field);
}

/** Review purpose follows content and source context, never word count or an approval. */
export function reviewRecordLane(entry) {
  if (['English interface', 'Listing and manifest'].includes(entry.category)) return 'prepared';
  if (entry.category === 'Documentation') {
    return entry.occurrences.some(source => /(?:^|\/)(?:lore|adventures?|stories|journals?)(?:\/|\.)/i.test(source.path)) ? 'prepared' : 'maintenance';
  }
  if (entry.occurrences.length && entry.occurrences.every(source => source.reviewRole === 'technical' ||
    (/\.json$/i.test(source.path) && isTechnicalReviewField((source.location ?? '').split('/').at(-1).replace(/~1/g, '/').replace(/~0/g, '~'))))) return 'maintenance';
  if (entry.category === 'Configuration and schema text') return 'maintenance';
  if (entry.category === 'Inline runtime text and code literals') {
    return entry.occurrences.length && entry.occurrences.every(source => source.reviewRole === 'technical') ? 'maintenance' : 'prepared';
  }
  if (entry.category === 'Licences and attribution') return 'rights';
  if (entry.category === 'Reference data and source metadata') {
    return entry.occurrences.some(source => /\/(?:content|description|summary|guidance|explanation|warning|note|effect|prompt|text)(?:\/|$)/i.test(source.location)) ? 'prepared' : 'rights';
  }
  return 'prepared';
}

/** Bundle short interface wording for shared evidence; word count is not an exemption. */
export function isShortInterfaceLabel(entry) {
  if (reviewRecordLane(entry) !== 'prepared') return false;
  const labelSource = ['English interface', 'CSS interface labels', 'SVG accessible text'].includes(entry.category) ||
    (entry.category === 'Inline runtime text and code literals' && entry.occurrences.some(source => source.reviewRole === 'interface-label'));
  const text = entry.text?.trim() ?? '';
  return Boolean(labelSource && text && !/[\r\n]/u.test(text) && text.split(/\s+/u).length <= 2 &&
    /\p{L}/u.test(text) && /^[\p{L}\p{M}\p{N}\s'’&()/+:%–—-]+$/u.test(text));
}

export function reviewLabelGroup(review) {
  return { id: 'short-interface-labels', title: 'Single- and two-word interface labels',
    entryIds: review.entries.filter(isShortInterfaceLabel).map(entry => entry.id) };
}

/** Explicit rewrites, replacements and other classifications remain individual exceptions. */
export function hasIndividualLabelException(value) {
  return Boolean(value && ((value.decision !== 'pending' && value.decision !== 'human-origin') || value.replacement?.trim()));
}

/** Source scopes preserve every occurrence; grouping is not an authorship decision. */
export function reviewScopes(review) {
  const groups = new Map();
  for (const entry of review.entries) for (const occurrence of entry.occurrences) {
    const id = JSON.stringify([occurrence.path, entry.category]);
    if (!groups.has(id)) groups.set(id, { id, path: occurrence.path, category: entry.category, entryIds: new Set() });
    groups.get(id).entryIds.add(entry.id);
  }
  return [...groups.values()].map(group => ({ ...group, entryIds: [...group.entryIds] }));
}

/** Drafts may be unfinished. Identity and structural checks still apply. */
export function normalizeReviewDraft(review, input) {
  if (!input || input.archiveSha256 !== review.archiveSha256) throw Error('Review decisions belong to a different archive.');
  const allowed = new Set(['pending', 'human-origin', 'third-party-rights', 'technical-only', 'rewrite-required']);
  const ids = new Set(review.entries.map(entry => entry.id));
  const scopes = new Set(reviewScopes(review).map(scope => scope.id));
  const object = (value, label) => {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid ' + label + '.');
    return value;
  };
  const entries = Object.fromEntries(Object.entries(object(input.entries, 'entry decisions')).map(([id, value]) => {
    if (!ids.has(id) || !value || !allowed.has(value.decision)) throw Error('Unknown review entry or decision.');
    return [id, { decision: value.decision, evidence: String(value.evidence ?? ''), replacement: String(value.replacement ?? '') }];
  }));
  const scopeReviews = Object.fromEntries(Object.entries(object(input.scopeReviews, 'source reviews')).map(([id, value]) => {
    if (!scopes.has(id) || !value || !['pending', 'evidence-recorded'].includes(value.state)) throw Error('Unknown source scope or review state.');
    return [id, { state: value.state, reviewer: String(value.reviewer ?? ''), evidence: String(value.evidence ?? '') }];
  }));
  const gates = object(input.humanGates, 'human gates');
  const gateIds = new Set(review.humanGates.map(gate => gate.id));
  for (const id of Object.keys(gates)) if (!gateIds.has(id)) throw Error('Unknown human gate.');
  const group = reviewLabelGroup(review), groupIds = new Set(group.entryIds), label = object(input.labelReview, 'short-label review');
  const state = label.state ?? 'pending';
  if (!['pending', 'evidence-recorded'].includes(state)) throw Error('Unknown short-label review state.');
  if ((state === 'evidence-recorded' || label.entryIds !== undefined) &&
    (!Array.isArray(label.entryIds) || label.entryIds.length !== group.entryIds.length ||
      new Set(label.entryIds).size !== group.entryIds.length || label.entryIds.some(id => !groupIds.has(id)))) {
    throw Error('Short-label review coverage does not match this archive inventory.');
  }
  return {
    schemaVersion: 1, archiveSha256: review.archiveSha256, reviewer: String(input.reviewer ?? ''),
    listingText: String(input.listingText ?? ''), releasePhase: review.releasePhase ?? input.releasePhase ?? 'Beta', entries, scopeReviews,
    humanGates: Object.fromEntries(Object.entries(gates).map(([id, value]) => [id, String(value ?? '')])),
    labelReview: { state, reviewer: String(label.reviewer ?? ''), evidence: String(label.evidence ?? ''), entryIds: group.entryIds },
    submissionReady: false,
  };
}

/** Explain incomplete changed decisions without blocking a backup or creating approval. */
export function reviewDraftIssues(review, input) {
  const draft = normalizeReviewDraft(review, input), issues = [];
  const byId = new Map(review.entries.map(entry => [entry.id, entry]));
  const labels = new Set(draft.labelReview.entryIds), labelEvidence = draft.labelReview.state === 'evidence-recorded' &&
    draft.labelReview.reviewer.trim() && draft.labelReview.evidence.trim();
  for (const [id, value] of Object.entries(draft.entries)) {
    if (value.decision === 'pending') continue;
    const entry = byId.get(id);
    // Code/metadata and reference permissions use maintenance/source gates,
    // not individual authorship checks. Retain all their old answers in the draft.
    if (reviewRecordLane(entry) !== 'prepared') continue;
    const sourceEvidence = entry.occurrences.every(occurrence => {
      const source = draft.scopeReviews[JSON.stringify([occurrence.path, entry.category])];
      return source?.state === 'evidence-recorded' && source.reviewer.trim() && source.evidence.trim();
    });
    const bundledEvidence = labelEvidence && labels.has(id) && !hasIndividualLabelException(value);
    if (!draft.reviewer.trim() || (!value.evidence.trim() && !sourceEvidence && !bundledEvidence)) {
      const missing = [!draft.reviewer.trim() && 'reviewer identity', !value.evidence.trim() && !sourceEvidence && !bundledEvidence && 'authorship or classification evidence'].filter(Boolean);
      issues.push({ kind: 'entry-evidence', entryId: id, path: entry.occurrences[0].path,
        message: entry.occurrences[0].path + ' — ' + entry.text.slice(0, 100) + ': missing ' + missing.join(' and ') + '.' });
    }
  }
  if (draft.labelReview.state === 'evidence-recorded' && !labelEvidence) {
    issues.push({ kind: 'label-evidence', groupId: 'short-interface-labels', message: 'The shared short-label statement needs a named reviewer and provenance evidence.' });
  }
  const sourceScopes = new Map(reviewScopes(review).map(source => [source.id, source]));
  for (const [id, value] of Object.entries(draft.scopeReviews)) {
    const scope = sourceScopes.get(id);
    if (scope.entryIds.every(entryId => reviewRecordLane(byId.get(entryId)) === 'maintenance')) continue;
    if (value.state === 'evidence-recorded' && (!value.reviewer.trim() || !value.evidence.trim())) {
      issues.push({ kind: 'scope-evidence', scopeId: id, message: JSON.parse(id)[0] + ': recorded source evidence needs a named reviewer and evidence note.' });
    }
  }
  return issues;
}
