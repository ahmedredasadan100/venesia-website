/**
 * Demotes stored Article Markdown headings beneath the page-level title while
 * retaining their source level for unchanged visual styling.
 */
export function demoteArticleHeadingHierarchy(html: string) {
  return html.replace(
    /<h([1-3])>([\s\S]*?)<\/h\1>/giu,
    (_match, sourceLevel: string, content: string) => {
      const level = Number(sourceLevel);
      const semanticLevel = level + 1;
      return `<h${semanticLevel} data-article-heading-level="${level}">${content}</h${semanticLevel}>`;
    },
  );
}
