import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAnnouncementRecord, getAnnouncements, resetAnnouncements } from './announcements';

describe('announcement store', () => {
  it('creates and lists announcements in newest-first order', () => {
    resetAnnouncements();

    const first = createAnnouncementRecord({
      title: 'Welcome',
      message: 'Hello students',
      authorName: 'Admin Team',
    });

    const second = createAnnouncementRecord({
      title: 'Reminder',
      message: 'Please review the new materials.',
      authorName: 'Teacher',
    });

    const announcements = getAnnouncements();

    assert.equal(announcements.length, 2);
    assert.equal(announcements[0].id, second.id);
    assert.equal(announcements[1].id, first.id);
    assert.equal(announcements[0].title, 'Reminder');
    assert.equal(announcements[0].message, 'Please review the new materials.');
  });
});
