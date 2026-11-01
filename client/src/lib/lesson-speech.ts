const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

function stripHtmlEntities(text: string): string {
  return text.replace(/&(#x?[a-f\d]+|[a-z]+);/gi, (entity, value: string) => {
    if (value.startsWith("#")) {
      const isHex = value[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(value.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return htmlEntities[value.toLowerCase()] ?? entity;
  });
}

export function lessonMarkdownToSpeechText(markdown: string): string {
  return stripHtmlEntities(markdown)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/```[\w-]*\s*([\s\S]*?)```/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "$1 divided by $2")
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "square root of $1")
    .replace(/\\(?:times|cdot)/g, " times ")
    .replace(/\\(?:div|over)/g, " divided by ")
    .replace(/\\(?:leq|le)/g, " less than or equal to ")
    .replace(/\\(?:geq|ge)/g, " greater than or equal to ")
    .replace(/\\neq/g, " not equal to ")
    .replace(/\\pi\b/g, " pi ")
    .replace(/\\infty\b/g, " infinity ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\\([{}_$%&#])/g, "$1")
    .replace(/\$\$?([^$]+)\$\$?/g, "$1")
    .replace(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g, (math) => math.replace(/\\[()[\]]/g, ""))
    .replace(/^\s{0,3}(?:#{1,6}\s*|>\s*)/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~`|]/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSpeechText(text: string, maxLength = 1800): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 100) {
    throw new Error("Speech chunk length must be an integer of at least 100 characters.");
  }
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
  const chunks: string[] = [];
  let current = "";

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (sentence.length > maxLength) {
      if (current) chunks.push(current);
      current = "";
      const words = sentence.split(/\s+/);
      let wordChunk = "";
      for (const word of words) {
        if (word.length > maxLength) {
          if (wordChunk) chunks.push(wordChunk);
          for (let offset = 0; offset < word.length - maxLength; offset += maxLength) {
            chunks.push(word.slice(offset, offset + maxLength));
          }
          wordChunk = word.slice(Math.floor((word.length - 1) / maxLength) * maxLength);
          continue;
        }
        if (wordChunk && `${wordChunk} ${word}`.length > maxLength) {
          chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
        }
      }
      current = wordChunk;
      continue;
    }
    const combined = current ? `${current} ${sentence}` : sentence;
    if (combined.length > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = combined;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
