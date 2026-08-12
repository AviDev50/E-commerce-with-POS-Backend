import sanitizeHtml from "sanitize-html";

export function sanitizePageContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "b", "i", "strong", "em", "u", "s",
      "ul", "ol", "li",
      "a", "span", "div",
      "table", "thead", "tbody", "tr", "th", "td",
      "blockquote",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      div: ["style"],
      p: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-weight": [/^bold$/],
      },
    },
  });
}