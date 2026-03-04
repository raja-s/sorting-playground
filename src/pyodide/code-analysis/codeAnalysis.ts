
import { type ASTNodeUnion, type Assign, NodeVisitor, parse } from 'py-ast';

import NodeEndsSetterVisitor from './NodeEndsSetterVisitor.ts';

import { type InstrumentationResult, instrumentCode } from './instrumentation.ts';

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
	comparisonMap: SortingListComparisonMap,
	instrumentationResult: InstrumentationResult
};

class PythonCodeAnalyzer extends NodeVisitor {

	private readonly sourceCodeLines: string[];
	private readonly sortingListVariableName: string;

	private trackedVariablesStack: TrackedVariable[][] = [ [] ];
	public trackedVariableMap: TrackedVariableMap = {};

	public comparisonMap: SortingListComparisonMap = {};

	constructor(sourceCode: string, sortingListVariableName: string) {
		super();
		this.sourceCodeLines = sourceCode.split('\n');
		this.sortingListVariableName = sortingListVariableName;
	}

	visit(node: ASTNodeUnion): void {
		const lineNumber: number = node.lineno as number
		if (!(lineNumber in this.trackedVariableMap)) {
			this.trackedVariableMap[lineNumber] = this.trackedVariablesStackHead().slice();
		}
		super.visit(node);
	}

	visitAssign(assignNode: Assign): void {
		this.trackedVariablesStackHead().push(
			...assignNode.targets
				.filter(target => target.nodeType === 'Name')
				.filter(target => target.id !== this.sortingListVariableName)
				.filter(target =>
					!this.trackedVariablesStackHead().some(variable => target.id === variable.name))
				.map(target => ({
					name: target.id,
					definitionLineNumber: target.lineno,
					loopIterator: false
				}))
		);

		this.genericVisit(assignNode);

	}

	visitAnnAssign(assignNode: Assign): void {
		this.visitAssign(assignNode);
	}

	visitFor(forNode: ASTNodeUnion): void {
		if ('id' in forNode.target) {
			this.trackedVariablesStackHead().push({
				name: forNode.target.id,
				definitionLineNumber: forNode.lineno as number,
				loopIterator: true
			});
		} else {
			this.trackedVariablesStackHead().push(
				...forNode.target.elts.map((element: ASTNodeUnion) => ({
					name: element.id,
					definitionLineNumber: element.lineno as number,
					loopIterator: true
				}))
			);
		}

		this.genericVisit(forNode);
	}

	visitFunctionDef(defNode: ASTNodeUnion): void {
		this.trackedVariablesStack.push([]);

		this.trackedVariablesStackHead().push(
			...defNode.args.args.map((parameter: ASTNodeUnion) => ({
				name: parameter.arg,
				definitionLineNumber: parameter.lineno as number,
				loopIterator: false
			}))
		);

		this.genericVisit(defNode);

		this.trackedVariablesStack.pop();
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: ASTNodeUnion): void {
		this.addSortingListComparison(ifNode);

		this.genericVisit(ifNode);
	}

	private trackedVariablesStackHead(): TrackedVariable[] {
		return this.trackedVariablesStack[this.trackedVariablesStack.length - 1];
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
	sortingListVariableName: string,
	sortingListSourceCodeStart: number,
	sortingListSourceCodeEnd: number
): CodeAnalysisResult {
	const ast = parse(sourceCode);
	const analyzer = new PythonCodeAnalyzer(sourceCode, sortingListVariableName);

	new NodeEndsSetterVisitor(sourceCode).visit(ast);

	analyzer.visit(ast);

	const instrumentationResult: InstrumentationResult =
		instrumentCode(
			sourceCode,
			sortingListVariableName,
			sortingListSourceCodeStart,
			sortingListSourceCodeEnd
		);

	return {
		trackedVariableMap: analyzer.trackedVariableMap,
		comparisonMap: analyzer.comparisonMap,
		instrumentationResult
	};
}
