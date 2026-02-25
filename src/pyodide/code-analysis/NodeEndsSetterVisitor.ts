
import { type ASTNodeUnion, NodeVisitor, iterChildNodes } from 'py-ast';

export default class NodeEndsSetterVisitor extends NodeVisitor {

	private readonly sourceCodeLines: string[];

	constructor(sourceCode: string) {
		super();
		this.sourceCodeLines = sourceCode.split('\n');
	}

	visit(node: ASTNodeUnion): void {
		super.visit(node);

		let endLineNumber: number = node.lineno || -1;
		let endColumnOffset: number = node.col_offset || -1;

		if (node.nodeType === 'Name') {
			endColumnOffset += node.id.length;
		} else if (node.nodeType === 'Constant') {
			endColumnOffset += node.value.toString().length;
		}

		for (const child of iterChildNodes(node)) {
			if (child.end_lineno != null && child.end_lineno > endLineNumber) {
				endLineNumber = child.end_lineno;
			}
			if (child.end_col_offset != null && child.end_col_offset > endColumnOffset) {
				endColumnOffset = child.end_col_offset;
			}
		}

		let correctEndColumnOffset = false;
		let endColumnOffsetHandle = '';

		if (node.nodeType === 'Subscript') {
			correctEndColumnOffset = true;
			endColumnOffsetHandle = ']';
		} else if (node.nodeType === 'Call') {
			correctEndColumnOffset = true;
			endColumnOffsetHandle = ')';
		}

		if (correctEndColumnOffset) {
			let endColumnOffsetLine = this.sourceCodeLines[endLineNumber - 1];
			let indexOfHandle = endColumnOffsetLine.indexOf(endColumnOffsetHandle, endColumnOffset);
			// WARNING: This may be dangerous (it's a bit clumsy at least).
			while (indexOfHandle === -1 && endLineNumber < this.sourceCodeLines.length) {
				endLineNumber++;
				endColumnOffsetLine = this.sourceCodeLines[endLineNumber - 1];
				indexOfHandle = endColumnOffsetLine.indexOf(endColumnOffsetHandle);
			}
			if (indexOfHandle !== -1) {
				endColumnOffset = indexOfHandle + 1;
			}
			// Otherwise, we set incorrect ends, but in that case
			// there is probably a syntax error anyways...
		}

		node.end_lineno = endLineNumber;
		node.end_col_offset = endColumnOffset;
	}

}
