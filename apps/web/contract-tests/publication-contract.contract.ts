import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionAccountLinkChallenge,
  canTransitionGardenPlantVisibility,
  canTransitionPublicationSubmission,
} from '@plant/plant-core/publication';

test('account-link challenges have terminal consumed, expired, and cancelled states', () => {
  assert.equal(canTransitionAccountLinkChallenge('pending', 'claimed'), true);
  assert.equal(canTransitionAccountLinkChallenge('claimed', 'consumed'), true);
  assert.equal(canTransitionAccountLinkChallenge('consumed', 'pending'), false);
  assert.equal(canTransitionAccountLinkChallenge('expired', 'claimed'), false);
});

test('publication submission outcomes are terminal', () => {
  for (const outcome of ['accepted', 'rejected', 'duplicate'] as const) {
    assert.equal(canTransitionPublicationSubmission('pending', outcome), true);
    assert.equal(canTransitionPublicationSubmission(outcome, 'pending'), false);
  }
});

test('garden removal is terminal while hiding is reversible', () => {
  assert.equal(canTransitionGardenPlantVisibility('public', 'hidden'), true);
  assert.equal(canTransitionGardenPlantVisibility('hidden', 'public'), true);
  assert.equal(canTransitionGardenPlantVisibility('public', 'removed'), true);
  assert.equal(canTransitionGardenPlantVisibility('removed', 'public'), false);
});
