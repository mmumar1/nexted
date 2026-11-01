import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lessonMarkdownToSpeechText, splitSpeechText } from "./lesson-speech.js";

describe("lesson speech text", () => {
  it("removes markdown formatting while preserving readable lesson text", () => {
    const speech = lessonMarkdownToSpeechText(
      "# Intro\n\nRead **this** [helpful guide](https://example.com).\n\n- First item\n- Second item",
    );
    assert.equal(speech, "Intro. Read this helpful guide. First item Second item");
  });

  it("converts common math markup into simple spoken phrases", () => {
    const speech = lessonMarkdownToSpeechText("The answer is $\\frac{3}{4}$ and $\\sqrt{x}$.");
    assert.equal(speech, "The answer is 3 divided by 4 and square root of x.");
  });

  it("does not include script or style contents in narration", () => {
    const speech = lessonMarkdownToSpeechText("Lesson text <script>alert('hidden')</script><style>.secret {}</style> continues.");
    assert.equal(speech, "Lesson text continues.");
  });

  it("splits long lesson text into bounded chunks without dropping words", () => {
    const text = `${"First sentence. ".repeat(20)}${"word ".repeat(150)}`;
    const chunks = splitSpeechText(text, 120);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 120));
    assert.equal(chunks.join(" ").replace(/\s+/g, " ").trim(), text.replace(/\s+/g, " ").trim());
  });

  it("returns no speech chunks for empty content and rejects unsafe chunk sizes", () => {
    assert.deepEqual(splitSpeechText(""), []);
    assert.throws(() => splitSpeechText("Some text", 20), /at least 100 characters/);
  });
});
