import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('personal profile produces standalone private device builds', () => {
  const config = JSON.parse(readFileSync('eas.json', 'utf8'));
  assert.equal(config.build.personal.distribution, 'internal');
  assert.equal(config.build.personal.android.buildType, 'apk');
  assert.equal(config.build.personal.ios.simulator, false);
  assert.notEqual(config.build.personal.developmentClient, true);
  assert.equal(config.submit, undefined);
});

test('cloud build is manual and does not submit or publish financial data', () => {
  const workflow = readFileSync('.github/workflows/personal-build.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /--profile personal --non-interactive/);
  assert.doesNotMatch(workflow, /--auto-submit|eas submit|eas update|upload-artifact/);
});
