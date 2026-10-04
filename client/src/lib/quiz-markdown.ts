export function normalizeMathDelimiters(markdown: string) {
  return markdown
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, expression: string) => `$$\n${expression.trim()}\n$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, expression: string) => `$${expression.trim()}$`);
}