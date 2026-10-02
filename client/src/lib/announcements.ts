export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  authorName: string;
}

const STORAGE_KEY = "beehub-announcements";

let fallbackAnnouncements: AnnouncementRecord[] = [];

const safeLocalStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function readAnnouncements(): AnnouncementRecord[] {
  const storage = safeLocalStorage();

  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as AnnouncementRecord[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("Failed to read announcements from storage", error);
      storage.removeItem(STORAGE_KEY);
    }
  }

  return fallbackAnnouncements;
}

function writeAnnouncements(announcements: AnnouncementRecord[]) {
  const storage = safeLocalStorage();

  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(announcements));
  } else {
    fallbackAnnouncements = announcements;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("beehub-announcements-updated", { detail: announcements }));
  }
}

export function getAnnouncements(): AnnouncementRecord[] {
  return [...readAnnouncements()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createAnnouncementRecord({
  title,
  message,
  authorName,
}: {
  title: string;
  message: string;
  authorName: string;
}): AnnouncementRecord {
  const trimmedTitle = title.trim();
  const trimmedMessage = message.trim();

  if (!trimmedTitle || !trimmedMessage) {
    throw new Error("Announcement title and message are required.");
  }

  const nextAnnouncement: AnnouncementRecord = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    message: trimmedMessage,
    createdAt: new Date().toISOString(),
    authorName: authorName.trim() || "System",
  };

  const announcements = [nextAnnouncement, ...readAnnouncements()];
  writeAnnouncements(announcements);
  return nextAnnouncement;
}

export function resetAnnouncements() {
  const storage = safeLocalStorage();
  fallbackAnnouncements = [];

  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("beehub-announcements-updated", { detail: [] }));
  }
}
