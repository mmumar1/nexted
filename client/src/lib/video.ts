export function normalizeYouTubeEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();

  if (!trimmed) return null;

  const blockedPrefixes = ["javascript:", "data:", "vbscript:"];
  if (blockedPrefixes.some((prefix) => trimmed.toLowerCase().startsWith(prefix))) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();
    const allowedHosts = new Set([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtu.be",
      "youtube-nocookie.com",
      "www.youtube-nocookie.com",
    ]);

    if (!allowedHosts.has(hostname)) {
      return null;
    }

    const videoIdFromQuery = url.searchParams.get("v");
    if (videoIdFromQuery) {
      return `https://www.youtube.com/embed/${videoIdFromQuery}?rel=0&modestbranding=1`;
    }

    const path = url.pathname.replace(/^\/+/, "");
    if (hostname === "youtu.be" && path) {
      return `https://www.youtube.com/embed/${path.split("/")[0]}?rel=0&modestbranding=1`;
    }

    const embedMatch = path.match(/^embed\/(.+)$/);
    if (embedMatch?.[1]) {
      return `https://www.youtube.com/embed/${embedMatch[1]}?rel=0&modestbranding=1`;
    }

    return null;
  } catch {
    return null;
  }
}
