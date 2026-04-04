
import { type ASTNodeUnion, NodeVisitor } from 'py-ast';

export default class BaseNodeVisitor extends NodeVisitor {

	protected readonly sourceCode: string;
	protected readonly sourceCodeLines: string[];

	constructor(sourceCode: string) {
		super();
		this.sourceCode = sourceCode;
		this.sourceCodeLines = sourceCode.split('\n');
	}

	getAbsolutePosition(lineNumber: number, columnOffset: number): number {
		const lineStartAbsolutePosition: number =
			this.sourceCodeLines.slice(0, lineNumber - 1)
				.map(line => line.length + 1)
				.reduce((sum, lineLength) => sum + lineLength, 0)

		return lineStartAbsolutePosition + columnOffset;
	}

}
