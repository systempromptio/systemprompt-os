export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Disallow blank lines between class properties',
      category: 'Stylistic Issues',
      recommended: true,
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      noBlankLinesBetweenProperties: 'Remove blank line between class properties',
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode();

    /**
     * Check if node is a property-like declaration
     * @param {object} node - AST node
     * @returns {boolean} True if property-like
     */
    function isPropertyLike(node) {
      return (
        node.type === 'PropertyDefinition' ||
        node.type === 'TSPropertySignature' ||
        node.type === 'Property' ||
        node.type === 'TSIndexSignature' ||
        (node.type === 'MethodDefinition' && (node.kind === 'get' || node.kind === 'set'))
      );
    }

    /**
     * Check if there are blank lines between two nodes
     * @param {object} prev - Previous node
     * @param {object} curr - Current node
     * @returns {boolean} True if blank lines exist
     */
    function hasBlankLinesBetween(prev, curr) {
      const prevEndLine = prev.loc.end.line;
      const currStartLine = curr.loc.start.line;
      
      // Check if there's more than one line between them
      return currStartLine - prevEndLine > 1;
    }

    /**
     * Get the fix range for removing blank lines
     * @param {object} prev - Previous node
     * @param {object} curr - Current node
     * @returns {number[]} Range to fix
     */
    function getFixRange(prev, curr) {
      const prevEndLine = prev.loc.end.line;
      const currStartLine = curr.loc.start.line;
      
      // Get the text of the line to find its actual length
      const lines = sourceCode.lines;
      const prevLineText = lines[prevEndLine - 1];
      
      // Get the actual positions in the source
      const prevEndIndex = sourceCode.getIndexFromLoc({ line: prevEndLine, column: prevLineText.length });
      const currStartIndex = sourceCode.getIndexFromLoc({ line: currStartLine, column: 0 });
      
      return [prevEndIndex, currStartIndex];
    }

    return {
      ClassBody(node) {
        const properties = node.body.filter(isPropertyLike);
        
        for (let i = 1; i < properties.length; i++) {
          const prev = properties[i - 1];
          const curr = properties[i];
          
          if (hasBlankLinesBetween(prev, curr)) {
            context.report({
              node: curr,
              messageId: 'noBlankLinesBetweenProperties',
              fix(fixer) {
                const [start, end] = getFixRange(prev, curr);
                const indent = sourceCode.getText(curr).match(/^(\s*)/)?.[1] || '';
                // Replace all whitespace between properties with single newline + proper indent
                return fixer.replaceTextRange([start, end], '\n' + indent);
              },
            });
          }
        }
      },
    };
  },
};