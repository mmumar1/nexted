import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeMathDelimiters } from "./quiz-markdown";
import { QuizMarkdownContent } from "@/components/quiz/quiz-markdown";

describe("quiz markdown math delimiters", () => {
  it("converts pasted LaTeX inline delimiters", () => {
    assert.equal(normalizeMathDelimiters("Energy: \\(E=mc^2\\)"), "Energy: $E=mc^2$");
  });

  it("converts pasted LaTeX display delimiters", () => {
    assert.equal(normalizeMathDelimiters("\\[\\frac{1}{2}\\]"), "$$\n\\frac{1}{2}\n$$");
  });

  it("renders legacy HTML lists safely", () => {
    const html = renderToStaticMarkup(createElement(QuizMarkdownContent, {
      source: "<h3>Lesson</h3><ul><li>First</li><li>Second</li></ul>",
    }));

    assert.match(html, /<ul>/);
    assert.match(html, /<li>First<\/li>/);
    assert.match(html, /<li>Second<\/li>/);
  });

  it("sanitizes active HTML", () => {
    const html = renderToStaticMarkup(createElement(QuizMarkdownContent, {
      source: "<script>alert('x')</script><img src=x onerror=alert(1)>",
    }));

    assert.doesNotMatch(html, /<script|onerror/);
  });

  it("renders display math as KaTeX", () => {
    const html = renderToStaticMarkup(createElement(QuizMarkdownContent, {
      source: "$$\nE=mc^2\n$$",
    }));

    assert.match(html, /class="katex"/);
  });
});