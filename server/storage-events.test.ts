import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const { MemStorage } = await import("./storage.js");

describe("event storage", () => {
  it("keeps drafts private and creates per-student notifications across event revisions", async () => {
    const storage = new MemStorage();
    const event = await storage.createEvent({
      title: "Student orientation",
      description: "Welcome session",
      startsAt: new Date("2030-01-02T10:00:00.000Z"),
      endsAt: new Date("2030-01-02T11:00:00.000Z"),
      timezone: "Africa/Lagos",
    }, "admin-local");

    assert.equal((await storage.getEventsForStudent("student-demo")).length, 0);

    const published = await storage.updateEvent(event.id, {
      status: "published",
      revision: 1,
      publishedAt: new Date("2030-01-01T10:00:00.000Z"),
    });
    assert.equal(published?.status, "published");
    assert.equal((await storage.getEventsForStudent("student-demo")).length, 1);

    const firstNotifications = await storage.getEventNotifications("student-demo");
    assert.equal(firstNotifications.length, 1);
    assert.equal(firstNotifications[0].revision, 1);
    assert.equal(await storage.markEventNotificationRead(firstNotifications[0].id, "subscriber-demo"), false);
    assert.equal(await storage.markEventNotificationRead(firstNotifications[0].id, "student-demo"), true);

    await storage.updateEvent(event.id, { revision: 2, title: "Updated student orientation" });
    await storage.updateEvent(event.id, { revision: 2, title: "Updated student orientation" });
    const updatedNotifications = await storage.getEventNotifications("student-demo");
    assert.equal(updatedNotifications.length, 2);
    const revisionTwoNotification = updatedNotifications.find((notification) => notification.revision === 2);
    assert.equal(revisionTwoNotification?.title, "Updated student orientation");
  });

  it("tracks RSVP status and only allows draft deletion", async () => {
    const storage = new MemStorage();
    const event = await storage.createEvent({
      title: "Study group",
      description: "Prepare together",
      startsAt: new Date("2030-01-02T10:00:00.000Z"),
      endsAt: new Date("2030-01-02T11:00:00.000Z"),
      timezone: "Africa/Lagos",
    }, "admin-local");

    await storage.updateEvent(event.id, { status: "published", revision: 1 });
    await storage.setEventRsvp(event.id, "student-demo", "attending");
    assert.equal((await storage.getEvent(event.id, "student-demo"))?.rsvpCount, 1);
    assert.equal((await storage.getEvent(event.id, "student-demo"))?.rsvpStatus, "attending");
    assert.equal(await storage.deleteEvent(event.id), false);

    const draft = await storage.createEvent({
      title: "Draft",
      description: "Not published",
      startsAt: new Date("2030-01-03T10:00:00.000Z"),
      endsAt: new Date("2030-01-03T11:00:00.000Z"),
      timezone: "Africa/Lagos",
    }, "admin-local");
    assert.equal(await storage.deleteEvent(draft.id), true);
  });
});
