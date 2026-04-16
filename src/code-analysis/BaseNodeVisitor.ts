
import { NodeVisitor } from 'py-ast';

import SourceCode from './SourceCode.ts';

export default class BaseNodeVisitor extends NodeVisitor {

	protected readonly sourceCode: SourceCode;

	constructor(sourceCode: SourceCode) {
		super();
		this.sourceCode = sourceCode;
	}

	getAbsolutePosition(lineNumber: number, columnOffset: number): number {
		const lineStartAbsolutePosition: number =
			this.sourceCode.lines.slice(0, lineNumber - 1)
				.map(line => line.length + 1)
				.reduce((sum, lineLength) => sum + lineLength, 0)

		return lineStartAbsolutePosition + columnOffset;
	}

}
