import ts from "typescript";

function jsxTagName(tagName, sourceFile) {
  return tagName.getText(sourceFile);
}

function jsxAttributes(attributes, sourceFile) {
  return Object.fromEntries(
    attributes.properties.flatMap((property) => {
      if (!ts.isJsxAttribute(property)) return [];
      const name = property.name.getText(sourceFile);
      const initializer = property.initializer;
      if (!initializer) return [[name, true]];
      if (ts.isStringLiteral(initializer)) return [[name, initializer.text]];
      if (
        ts.isJsxExpression(initializer) &&
        initializer.expression &&
        (ts.isStringLiteral(initializer.expression) ||
          ts.isNoSubstitutionTemplateLiteral(initializer.expression))
      ) {
        return [[name, initializer.expression.text]];
      }
      return [[name, "expression"]];
    }),
  );
}

function directChildTagNames(node, sourceFile) {
  return node.children.flatMap((child) => {
    if (ts.isJsxElement(child)) {
      return [jsxTagName(child.openingElement.tagName, sourceFile)];
    }
    if (ts.isJsxSelfClosingElement(child)) {
      return [jsxTagName(child.tagName, sourceFile)];
    }
    return [];
  });
}

export function inspectReviewDecisionCard(source, fileName, expectedId) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const matches = [];

  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      jsxTagName(node.openingElement.tagName, sourceFile) ===
        "AdminEntityReviewDecisionCard"
    ) {
      const rootAttributes = jsxAttributes(
        node.openingElement.attributes,
        sourceFile,
      );
      if (rootAttributes.id === expectedId) {
        const elements = [];
        function collect(child) {
          if (child !== node && ts.isJsxElement(child)) {
            elements.push({
              tagName: jsxTagName(child.openingElement.tagName, sourceFile),
              attributes: jsxAttributes(
                child.openingElement.attributes,
                sourceFile,
              ),
              start: child.getStart(sourceFile),
            });
          } else if (ts.isJsxSelfClosingElement(child)) {
            elements.push({
              tagName: jsxTagName(child.tagName, sourceFile),
              attributes: jsxAttributes(child.attributes, sourceFile),
              start: child.getStart(sourceFile),
            });
          }
          ts.forEachChild(child, collect);
        }
        ts.forEachChild(node, collect);
        matches.push({
          id: expectedId,
          title: rootAttributes.title,
          hasBadge: Object.hasOwn(rootAttributes, "badge"),
          directChildTagNames: directChildTagNames(node, sourceFile),
          elements,
          sourceText: node.getText(sourceFile),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (matches.length !== 1) {
    throw new Error(
      `${fileName} must contain exactly one ${expectedId} Review decision card; found ${matches.length}.`,
    );
  }
  return matches[0];
}

export function decisionCardElementCount(card, tagName) {
  return card.elements.filter((element) => element.tagName === tagName).length;
}

export function decisionCardElement(card, tagName, attributes = {}) {
  return card.elements.find(
    (element) =>
      element.tagName === tagName &&
      Object.entries(attributes).every(
        ([name, value]) => element.attributes[name] === value,
      ),
  );
}
