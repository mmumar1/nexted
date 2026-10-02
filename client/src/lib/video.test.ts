import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeYouTubeEmbedUrl } from './video';

describe('normalizeYouTubeEmbedUrl', () => {
  it('converts a standard YouTube watch URL to an embed URL', () => {
    assert.equal(
      normalizeYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    );
  });

  it('converts a shortened youtu.be URL to an embed URL', () => {
    assert.equal(
      normalizeYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1',
    );
  });

  it('rejects non-YouTube or unsafe URLs', () => {
    assert.equal(normalizeYouTubeEmbedUrl('https://evil.example/video'), null);
    assert.equal(normalizeYouTubeEmbedUrl('javascript:alert(1)'), null);
    assert.equal(normalizeYouTubeEmbedUrl('data:text/html;base64,AAA'), null);
  });
});
