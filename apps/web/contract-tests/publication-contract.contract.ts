import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionAccountLinkChallenge,
  canTransitionGardenPlantVisibility,
  canTransitionPublicationSubmission,
  validatePublicationAuthorizationRequest,
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

test('publication authorization accepts only identity metadata and versions', () => {
  const request = { publicationIntentId: 'publication-completed-12345678', completedPlantId: 'completed-plant-12345678', localPlantId: 'plant-12345678', installationId: `inst_${'a'.repeat(48)}`, contractVersion: 1, snapshotVersion: 1 };
  assert.deepEqual(validatePublicationAuthorizationRequest(request), request);
  assert.throws(() => validatePublicationAuthorizationRequest({ ...request, firstName: 'untrusted' }), /Invalid publication intent/);
  assert.throws(() => validatePublicationAuthorizationRequest({ ...request, completedPlantId: 'short' }), /completedPlantId/);
});
