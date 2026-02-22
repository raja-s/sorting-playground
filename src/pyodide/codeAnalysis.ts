
import { type ASTNodeUnion, NodeVisitor, iterChildNodes, parse } from 'py-ast';

export type TrackedVariable = {
	name: string,
	definitionLineNumber: number,
	loopIterator: boolean
};

export type SortingListComparison = {
	operator: string,
	leftHandSide: string,
	leftHandSideSortingListIndexExpression?: string,
	rightHandSide: string,
	rightHandSideSortingListIndexExpression?: string
}

export type TrackedVariableMap = {
	[lineNumber: number]: TrackedVariable[]
};

export type SortingListComparisonMap = {
	[lineNumber: number]: SortingListComparison
};

export type CodeAnalysisResult = {
	trackedVariableMap: TrackedVariableMap,
	comparisonMap: SortingListComparisonMap
};

class NodeEndsSetterVisitor extends NodeVisitor {

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

class PythonCodeAnalyzer extends NodeVisitor {

	private readonly sourceCodeLines: string[];
	private readonly sortingListVariableName: string;

//	private readonly nodeEndsSetterVisitor: NodeEndsSetterVisitor;

	private trackedVariables: TrackedVariable[] = [];
	public trackedVariableMap: TrackedVariableMap = {};

	public comparisonMap: SortingListComparisonMap = {};

	constructor(sourceCode: string, sortingListVariableName: string) {
		super();
		this.sourceCodeLines = sourceCode.split('\n');
		this.sortingListVariableName = sortingListVariableName;
//		this.nodeEndsSetterVisitor = new NodeEndsSetterVisitor(sourceCode);
	}

	visit(node: ASTNodeUnion): void {
		const lineNumber: number = node.lineno as number
		if (!(lineNumber in this.trackedVariableMap)) {
			this.trackedVariableMap[lineNumber] = this.trackedVariables.slice();
		}
		super.visit(node);
	}

	visitFor(forNode: ASTNodeUnion): void {
		let definedVariableCount: number;

		if ('id' in forNode.target) {
			this.trackedVariables.push({
				name: forNode.target.id,
				definitionLineNumber: forNode.lineno as number,
				loopIterator: true
			});
			definedVariableCount = 1;
		} else {
			forNode.target.elts.forEach((element: ASTNodeUnion) => {
				this.trackedVariables.push({
					name: element.id,
					definitionLineNumber: element.lineno as number,
					loopIterator: true
				});
			});
			definedVariableCount = forNode.target.elts.length;
		}

		this.genericVisit(forNode);

		this.trackedVariables.splice(-definedVariableCount);
	}

	visitFunctionDef(defNode: ASTNodeUnion): void {
		defNode.args.args.forEach((parameter: ASTNodeUnion) => {
			this.trackedVariables.push({
				name: parameter.arg,
				definitionLineNumber: parameter.lineno as number,
				loopIterator: false
			});
		});

		this.genericVisit(defNode);

		this.trackedVariables.splice(-defNode.args.args.length);
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: ASTNodeUnion): void {
		this.addSortingListComparison(ifNode);

		this.genericVisit(ifNode);
	}

	private addSortingListComparison(ifNode: ASTNodeUnion): void {
		if (
			ifNode.test.nodeType !== 'Compare' ||
			ifNode.test.ops.length !== 1 || (
				!this.isSortingListAccess(ifNode.test.left) && (
					ifNode.test.comparators.length !== 1 ||
					!this.isSortingListAccess(ifNode.test.comparators[0])
				)
			)
		) {
			return;
		}

		const comparison: Partial<SortingListComparison> = {};

		switch (ifNode.test.ops[0].nodeType) {
			case 'Eq': comparison.operator = '=='; break;
			case 'NotEq': comparison.operator = '!='; break;
			case 'Gt': comparison.operator = '>'; break;
			case 'Lt': comparison.operator = '<'; break;
			case 'GtE': comparison.operator = '>='; break;
			case 'LtE': comparison.operator = '<='; break;
		}

		this.setOperandAndIndex(ifNode.test.left, comparison, true);
		this.setOperandAndIndex(ifNode.test.comparators[0], comparison, false);

		const lineNumber: number = ifNode.lineno as number
		this.comparisonMap[lineNumber] = comparison as SortingListComparison;
	}

	private isSortingListAccess(node: ASTNodeUnion): boolean {
		return node.nodeType === 'Subscript' &&
			node.value.nodeType === 'Name' &&
			node.value.id === this.sortingListVariableName;
	}

	private setOperandAndIndex(
		operandNode: ASTNodeUnion,
		comparison: Partial<SortingListComparison>,
		leftHandSide: boolean
	): void {
		const [ operandKey, operandSortingListIndexExpressionKey ] =
			leftHandSide ? [ 'leftHandSide', 'leftHandSideSortingListIndexExpression' ] :
				[ 'rightHandSide', 'rightHandSideSortingListIndexExpression' ];

		// @ts-expect-error Access key is not recognized
		comparison[operandKey] = this.sliceSourceCode(operandNode);

		if (operandNode.nodeType === 'Subscript' &&
			operandNode.value.nodeType === 'Name' &&
			operandNode.value.id === this.sortingListVariableName)
		{
			// @ts-expect-error Access key is not recognized
			comparison[operandSortingListIndexExpressionKey] =
				this.sliceSourceCode(operandNode.slice);
		}

	}

	private sliceSourceCode(node: ASTNodeUnion): string {
		const nodeStartLineNumber: number = node.lineno as number;
		const nodeEndLineNumber: number = node.end_lineno as number;

		if (node.lineno === node.end_lineno) {
			return this.sourceCodeLines[nodeStartLineNumber - 1]
				.slice(node.col_offset, node.end_col_offset);
		}

		let nodeSourceCode: string =
			this.sourceCodeLines[nodeStartLineNumber - 1].slice(node.col_offset);

		for (let i = nodeStartLineNumber ; i < nodeEndLineNumber - 1 ; i++) {
			nodeSourceCode += `\n${this.sourceCodeLines[i]}`;
		}

		nodeSourceCode += `\n${
			this.sourceCodeLines[nodeEndLineNumber - 1].slice(0, node.end_col_offset)}`;

		return nodeSourceCode;
	}

}

export function analyzePythonCode(
	sourceCode: string,
	sortingListVariableName: string
): CodeAnalysisResult {
	const ast = parse(sourceCode);
	const analyzer = new PythonCodeAnalyzer(sourceCode, sortingListVariableName);

	new NodeEndsSetterVisitor(sourceCode).visit(ast);

	analyzer.visit(ast);

	return {
		trackedVariableMap: analyzer.trackedVariableMap,
		comparisonMap: analyzer.comparisonMap
	};
}
