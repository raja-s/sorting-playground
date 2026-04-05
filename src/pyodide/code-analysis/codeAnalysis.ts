
import { type ASTNodeUnion, type Assign, parse } from 'py-ast';

import BaseNodeVisitor from './BaseNodeVisitor.ts';
import NodeEndsSetterVisitor from './NodeEndsSetterVisitor.ts';

import { type LineNumberRange } from './common.ts';
import { type InstrumentationResult, instrumentCode } from './instrumentation.ts';

export type SaveExecutionCheckpointLineNumberRanges = {
	[lineNumber: number]: LineNumberRange
};

export type NestedElifLinesExtraLevels = {
	[lineNumber: number]: number
};

export type TrackedVariable = {
	name: string,
	definitionLineNumberRange: LineNumberRange,
	loopIterator: boolean
};

export type SortingListComparison = {
	operator: string,
	leftHandSide: string,
	leftHandSideSortingListIndexExpression?: string,
	rightHandSide: string,
	rightHandSideSortingListIndexExpression?: string
};

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

const SAVE_EXECUTION_CHECKOINT_NODE_TYPES = new Set([
	'Assign',
	'For',
	'While',
	'If',
	'Expr',
	'Break',
	'Continue',
	'Delete',
	'Pass',
	'Match',
	'Raise',
	'Return',
	'With'
]);

class PythonCodeAnalyzer extends BaseNodeVisitor {

	private readonly sortingListVariableName: string;

	public saveExecutionCheckpointLineNumberRanges: SaveExecutionCheckpointLineNumberRanges = {};

	public nestedElifLinesExtraLevels: NestedElifLinesExtraLevels = {};

	private trackedVariablesStack: TrackedVariable[][] = [ [] ];
	public trackedVariableMap: TrackedVariableMap = {};

	public comparisonMap: SortingListComparisonMap = {};

	constructor(sourceCode: string, sortingListVariableName: string) {
		super(sourceCode);
		this.sortingListVariableName = sortingListVariableName;
	}

	visit(node: ASTNodeUnion): void {
		const lineNumber: number = node.lineno as number
		if (!(lineNumber in this.trackedVariableMap)) {
			this.trackedVariableMap[lineNumber] = this.trackedVariablesStackHead().slice();
		}

		if (
			SAVE_EXECUTION_CHECKOINT_NODE_TYPES.has(node.nodeType) &&
			!node.isElif
		) {
			this.saveExecutionCheckpointLineNumberRanges[lineNumber] = {
				start: lineNumber,
				end: node.end_lineno
			};
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
					definitionLineNumberRange: {
						start: assignNode.lineno,
						end: assignNode.end_lineno
					},
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
				definitionLineNumberRange: {
					start: forNode.lineno as number,
					end: forNode.lineno as number
				},
				loopIterator: true
			});
		} else {
			this.trackedVariablesStackHead().push(
				...forNode.target.elts.map((element: ASTNodeUnion) => ({
					name: element.id,
					definitionLineNumberRange: {
						start: element.lineno as number,
						end: element.lineno as number
					},
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
				definitionLineNumberRange: {
					start: parameter.lineno as number,
					end: parameter.lineno as number
				},
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

		if (!('isElif' in ifNode)) {
			ifNode.isElif = false;
		}

		let orElseNodeIsElif: boolean = false;

		if (ifNode.orelse.length === 1) {
			const orElseNode: ASTNodeUnion = ifNode.orelse[0];

			if (
				orElseNode.nodeType === 'If' &&
					this.sourceCodeLines[orElseNode.lineno - 1]
						.slice(orElseNode.col_offset).startsWith('elif')
			) {
				orElseNodeIsElif = true;
				orElseNode.isElif = true;
				orElseNode.elifLevel = !ifNode.isElif ? 1 : ifNode.elifLevel + 1;
			}
		}

		this.genericVisit(ifNode);

		if (ifNode.isElif) {
			this.saveExecutionCheckpointLineNumberRanges[ifNode.lineno] = {
				start: ifNode.lineno,
				end: ifNode.end_lineno
			};

			const lastLineNumber: number = ifNode.body[ifNode.body.length - 1].end_lineno;

			for (let lineNumber = ifNode.lineno ; lineNumber <= lastLineNumber ; lineNumber++) {
				if (!(lineNumber in this.nestedElifLinesExtraLevels)) {
					this.nestedElifLinesExtraLevels[lineNumber] = 0;
				}
				this.nestedElifLinesExtraLevels[lineNumber] += ifNode.elifLevel;
			}
		}

		if (!orElseNodeIsElif && ifNode.orelse.length > 0) {
			const firstLineNumber: number = ifNode.body[ifNode.body.length - 1].end_lineno + 1;
			const lastLineNumber: number = ifNode.orelse[ifNode.orelse.length - 1].end_lineno;

			for (let lineNumber = firstLineNumber ; lineNumber <= lastLineNumber ; lineNumber++) {
				if (!(lineNumber in this.nestedElifLinesExtraLevels)) {
					this.nestedElifLinesExtraLevels[lineNumber] = 0;
				}
				this.nestedElifLinesExtraLevels[lineNumber] += ifNode.elifLevel;
			}
		}
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
	sortingListVariableName: string
): CodeAnalysisResult {
	const ast = parse(sourceCode);
	const analyzer = new PythonCodeAnalyzer(sourceCode, sortingListVariableName);

	new NodeEndsSetterVisitor(sourceCode).visit(ast);

	analyzer.visit(ast);

	const instrumentationResult: InstrumentationResult =
		instrumentCode(
			sourceCode,
			sortingListVariableName,
			analyzer.saveExecutionCheckpointLineNumberRanges,
			analyzer.nestedElifLinesExtraLevels
		);

	return {
		trackedVariableMap: analyzer.trackedVariableMap,
		comparisonMap: analyzer.comparisonMap,
		instrumentationResult
	};
}
