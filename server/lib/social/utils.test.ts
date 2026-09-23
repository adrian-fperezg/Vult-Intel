import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isVideoUrl, mimeTypeFromUrl, parseJsonObject, normalizeContentType, getLinkedInVersion,
  getLinkedInAuthorUrn, mapTwitterReplySettings, mapThreadsReplyControl, youtubeTitleFrom,
  linkedInPollDuration, tiktokChunkPlan,
} from './utils.js';

const SIGNED = '?GoogleAccessId=svc%40app.iam.gserviceaccount.com&Expires=4102444800&Signature=abc';

describe('social utils', () => {
  describe('isVideoUrl', () => {
    it('detects videos behind signed-URL query strings', () => {
      assert.equal(isVideoUrl(`https://storage.googleapis.com/b/social_media/social_1.mp4${SIGNED}`), true);
      assert.equal(isVideoUrl(`https://storage.googleapis.com/b/social_media/social_1.MOV${SIGNED}`), true);
    });

    it('returns false for images and non-strings', () => {
      assert.equal(isVideoUrl(`https://storage.googleapis.com/b/social_media/social_1.jpg${SIGNED}`), false);
      assert.equal(isVideoUrl('https://example.com/video.mp4.jpg'), false);
      assert.equal(isVideoUrl(undefined as any), false);
    });
  });

  it('mimeTypeFromUrl ignores the query string', () => {
    assert.equal(mimeTypeFromUrl(`https://x/a.png${SIGNED}`), 'image/png');
    assert.equal(mimeTypeFromUrl(`https://x/a.mov${SIGNED}`), 'video/quicktime');
    assert.equal(mimeTypeFromUrl('https://x/a'), 'image/jpeg');
  });

  it('parseJsonObject accepts objects, JSON strings and junk', () => {
    assert.deepEqual(parseJsonObject({ a: 1 }), { a: 1 });
    assert.deepEqual(parseJsonObject('{"contentType":"Reel"}'), { contentType: 'Reel' });
    assert.deepEqual(parseJsonObject('not json'), {});
    assert.deepEqual(parseJsonObject(null), {});
  });

  it('normalizeContentType maps UI types to publisher types', () => {
    assert.equal(normalizeContentType('Reel'), 'REEL');
    assert.equal(normalizeContentType('Story'), 'STORY');
    assert.equal(normalizeContentType('Carousel'), 'POST');
    assert.equal(normalizeContentType(undefined), 'POST');
  });

  it('getLinkedInVersion returns YYYYMM two months back (and honors the env override)', () => {
    const prev = process.env.LINKEDIN_API_VERSION;
    delete process.env.LINKEDIN_API_VERSION;
    assert.equal(getLinkedInVersion(new Date(Date.UTC(2026, 8, 22))), '202607');
    assert.equal(getLinkedInVersion(new Date(Date.UTC(2026, 0, 5))), '202511');
    process.env.LINKEDIN_API_VERSION = '202601';
    assert.equal(getLinkedInVersion(), '202601');
    if (prev === undefined) delete process.env.LINKEDIN_API_VERSION; else process.env.LINKEDIN_API_VERSION = prev;
  });

  it('getLinkedInAuthorUrn posts as the organization for company pages', () => {
    assert.equal(getLinkedInAuthorUrn({ account_id: 'abc', channel_id: '' }), 'urn:li:person:abc');
    assert.equal(getLinkedInAuthorUrn({ account_id: '123', channel_id: 'urn:li:organization:123' }), 'urn:li:organization:123');
  });

  it('maps reply settings to each API', () => {
    assert.equal(mapTwitterReplySettings('everyone'), undefined);
    assert.equal(mapTwitterReplySettings('followers'), 'following');
    assert.equal(mapTwitterReplySettings('mentioned'), 'mentionedUsers');
    assert.equal(mapThreadsReplyControl('following'), 'accounts_you_follow');
    assert.equal(mapThreadsReplyControl('mentioned'), 'mentioned_only');
    assert.equal(mapThreadsReplyControl(undefined), 'everyone');
  });

  it('youtubeTitleFrom prefers the explicit title and respects YouTube limits', () => {
    assert.equal(youtubeTitleFrom('Body line', 'My <Title>'), 'My Title');
    assert.equal(youtubeTitleFrom('\n  First line  \nsecond'), 'First line');
    assert.equal(youtubeTitleFrom('x'.repeat(150)).length, 100);
    assert.equal(youtubeTitleFrom(''), 'Untitled video');
  });

  it('linkedInPollDuration rounds up to a supported duration', () => {
    assert.equal(linkedInPollDuration(1), 'ONE_DAY');
    assert.equal(linkedInPollDuration(3), 'THREE_DAYS');
    assert.equal(linkedInPollDuration(7), 'SEVEN_DAYS');
    assert.equal(linkedInPollDuration(14), 'FOURTEEN_DAYS');
  });

  it('tiktokChunkPlan follows the FILE_UPLOAD chunk rules', () => {
    const MB = 1024 * 1024;
    assert.deepEqual(tiktokChunkPlan(3 * MB), { chunkSize: 3 * MB, totalChunks: 1 });
    assert.deepEqual(tiktokChunkPlan(64 * MB), { chunkSize: 64 * MB, totalChunks: 1 });
    const plan = tiktokChunkPlan(95 * MB);
    assert.equal(plan.chunkSize, 10 * MB);
    assert.equal(plan.totalChunks, 9);
    // last chunk absorbs the remainder and stays under TikTok's 128MB cap
    assert.ok(95 * MB - plan.chunkSize * (plan.totalChunks - 1) <= 128 * MB);
  });
});
