import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedCheckPool } from '../src/dice/builder.mjs';

test('requested opposition seeds exact dice before passive talent effects', () => {
  const dice = ["ability", "proficiency", "boost", "difficulty", "challenge", "setback", "force"];
  const zero = Object.fromEntries(dice.map(key => [key, 0]));
  const rules = { pool: {add: {...zero, boost: 1}, remove: zero} };
  const result = requestedCheckPool({ characteristic: 3, rank: 2, opposition: { difficulty: 1, challenge: 2, setback: 1 }, boost: 1, setback: 1, talentRules: rules });
  assert.deepEqual(result.basePool, { ability: 1, proficiency: 2, boost: 1, difficulty: 1, challenge: 2, setback: 2, force: 0 });
  assert.deepEqual(result.pool, {...result.basePool, boost: 2});
});

test('requested opposition rejects missing, fractional and excessive dice', () => {
  for (const opposition of [undefined, {difficulty: 1}, {difficulty: 1.5, challenge: 0, setback: 0}, {difficulty: 9, challenge: 0, setback: 0}])
    assert.throws(() => requestedCheckPool({characteristic: 3, rank: 1, opposition}));
});
