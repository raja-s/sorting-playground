
import { type ASTNodeUnion, type Assign, parse } from 'py-ast';

import SourceCode from './SourceCode.ts';

import BaseNodeVisitor from './BaseNodeVisitor.ts';
import NodeEndsSetterVisitor from './NodeEndsSetterVisitor.ts';

import SimulationAnnotation, { type ModifierKind, Modifier } from './SimulationAnnotation.ts';

import { type LineNumberRange } from './common.ts';
import { type InstrumentationResult, instrumentCode } from './instrumentation.ts';

export type ExecutionCheckpointInstruction = {
	lineNumberRange: LineNumberRange,
	syncWithController: boolean
};

export type ExecutionCheckpointInstructions = {
	[lineNumber: number]: ExecutionCheckpointInstruction
};

export type NestedElifLinesExtraLevels = {
	[lineNumber: number]: number
};

export type Variable = {
	identifier: string,
	name: string,
	definitionLineNumberRange: LineNumberRange
};

export type LineNumberVariableMap = {
	[definitionStartLineNumber: number]: Variable[]
};

export type VisualizedVariablesConfiguration = {
	variableCount: number,
	levelDistribution: {
		[variableIdentifier: string]: number
	}
};

export type SortingListComparison = {
	operator: string,
	leftHandSide: string,
	leftHandSideSortingListIndexExpression?: string,
	rightHandSide: string,
	rightHandSideSortingListIndexExpression?: string
};

export type SortingListComparisonMap = {
	[lineNumber: number]: SortingListComparison
};

export type CodeAnalysisResult = {
	trackedVariableMap: LineNumberVariableMap,
	visualizedVariableMap: LineNumberVariableMap,
	visualizedVariablesConfiguration: VisualizedVariablesConfiguration,
	comparisonMap: SortingListComparisonMap,
	instrumentationResult: InstrumentationResult
};

type VisualizedVariable = {
	variable: Variable,
	level: number | null
};

type LineNumberSimulationAnnotationMapping = {
	[lineNumber: number]: SimulationAnnotation
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

	public executionCheckpointInstructions: ExecutionCheckpointInstructions = {};

	public nestedElifLinesExtraLevels: NestedElifLinesExtraLevels = {};

	private trackedVariablesStack: Variable[][] = [ [] ];
	public trackedVariableMap: LineNumberVariableMap = {};

	public visualizedVariables: VisualizedVariable[] = [];
	private visualizedVariablesStack: Variable[][] = [ [] ];
	public visualizedVariableMap: LineNumberVariableMap = {};

	public comparisonMap: SortingListComparisonMap = {};

	private readonly lineNumberSimulationAnnotationMapping: LineNumberSimulationAnnotationMapping = {};

	private syncWithControllerOnCheckpoints: boolean = true;

	constructor(
		sourceCode: SourceCode,
		sortingListVariableName: string,
		simulationAnnotations: SimulationAnnotation[]
	) {
		super(sourceCode);

		this.sortingListVariableName = sortingListVariableName;

		for (const annotation of simulationAnnotations) {
			this.lineNumberSimulationAnnotationMapping[annotation.lineNumber] = annotation;
		}
	}

	visit(node: ASTNodeUnion): void {
		const lineNumber: number = node.lineno as number
		if (!(lineNumber in this.trackedVariableMap)) {
			this.trackedVariableMap[lineNumber] = this.trackedVariablesStackHead().slice();
		}
		if (!(lineNumber in this.visualizedVariableMap)) {
			this.visualizedVariableMap[lineNumber] = this.visualizedVariablesStackHead().slice();
		}

		if (SAVE_EXECUTION_CHECKOINT_NODE_TYPES.has(node.nodeType) && !node.isElif) {
			this.executionCheckpointInstructions[lineNumber] = {
				lineNumberRange: {
					start: lineNumber,
					end: node.end_lineno as number
				},
				syncWithController:
					this.syncWithControllerOnCheckpoints && !this.nodeHasModifier(node, 'skip')
			};
		}

		super.visit(node);
	}

	visitAssign(assignNode: Assign): void {
		const eligibleVariableNodes: ASTNodeUnion[] =
			flattenTuplesAmongNames(assignNode.targets)
				.filter((node: ASTNodeUnion) => node.id !== this.sortingListVariableName);

		this.trackedVariablesStackHead().push(
			...eligibleVariableNodes
				.filter((node: ASTNodeUnion) =>
					!this.trackedVariablesStackHead().some(variable => node.id === variable.name))
				.filter((node: ASTNodeUnion) => this.variableIsTracked(node, node.id))
				.map((node: ASTNodeUnion) => createVariable(node, node.id))
		);

		this.registerAndPushVisualizedVariables(
			eligibleVariableNodes
				.filter((node: ASTNodeUnion) =>
					!this.visualizedVariablesStackHead().some(variable => node.id === variable.name))
				.map((node: ASTNodeUnion) => this.getVisualizedVariable(node, node.id))
		);

		this.genericVisit(assignNode);
	}

	visitAnnAssign(assignNode: Assign): void {
		this.visitAssign(assignNode);
	}

	visitFor(forNode: ASTNodeUnion): void {
		const variableNodes: ASTNodeUnion[] = flattenTuplesAmongNames([ forNode.target ]);

		this.trackedVariablesStackHead().push(
			...variableNodes
				.filter((node: ASTNodeUnion) =>
					!this.trackedVariablesStackHead().some(variable => node.id === variable.name))
				.filter((node: ASTNodeUnion) => this.variableIsTracked(node, node.id))
				.map((node: ASTNodeUnion) => createVariable(node, node.id))
		);

		this.registerAndPushVisualizedVariables(
			variableNodes
				.filter((node: ASTNodeUnion) =>
					!this.visualizedVariablesStackHead().some(variable => node.id === variable.name))
				.map((node: ASTNodeUnion) => this.getVisualizedVariable(node, node.id))
		);

		this.genericVisit(forNode);
	}

	visitFunctionDef(defNode: ASTNodeUnion): void {
		this.trackedVariablesStack.push([]);
		this.visualizedVariablesStack.push([]);

		this.trackedVariablesStackHead().push(
			...defNode.args.args
				.filter((parameter: ASTNodeUnion) => this.variableIsTracked(parameter, parameter.arg))
				.map((parameter: ASTNodeUnion) => createVariable(parameter, parameter.arg))
		);

		this.registerAndPushVisualizedVariables(
			defNode.args.args
				.map((parameter: ASTNodeUnion) => this.getVisualizedVariable(parameter, parameter.arg))
		);

		const previousSyncWithControllerOnCheckpoints: boolean =
			this.syncWithControllerOnCheckpoints;

		if (this.nodeHasModifier(defNode, 'skip')) {
			this.syncWithControllerOnCheckpoints = false;
		}

		this.genericVisit(defNode);

		this.syncWithControllerOnCheckpoints = previousSyncWithControllerOnCheckpoints;
		this.trackedVariablesStack.pop();
		this.visualizedVariablesStack.pop();
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: ASTNodeUnion): void {
		const lineNumber: number = ifNode.lineno as number;

		this.addSortingListComparison(ifNode);

		if (!('isElif' in ifNode)) {
			ifNode.isElif = false;
		}

		let orElseNodeIsElif: boolean = false;

		if (ifNode.orelse.length === 1) {
			const orElseNode: ASTNodeUnion = ifNode.orelse[0];

			if (
				orElseNode.nodeType === 'If' &&
					this.sourceCode.lines[orElseNode.lineno - 1]
						.slice(orElseNode.col_offset).startsWith('elif')
			) {
				orElseNodeIsElif = true;
				orElseNode.isElif = true;
				orElseNode.elifLevel = !ifNode.isElif ? 1 : ifNode.elifLevel + 1;
			}
		}

		this.genericVisit(ifNode);

		if (ifNode.isElif) {
			this.executionCheckpointInstructions[lineNumber] = {
				lineNumberRange: {
					start: lineNumber,
					end: ifNode.end_lineno as number
				},
				syncWithController:
					this.syncWithControllerOnCheckpoints && !this.nodeHasModifier(ifNode, 'skip')
			};

			const lastLineNumber: number = ifNode.body[ifNode.body.length - 1].end_lineno;

			for (let i = lineNumber ; i <= lastLineNumber ; i++) {
				if (!(i in this.nestedElifLinesExtraLevels)) {
					this.nestedElifLinesExtraLevels[i] = 0;
				}
				this.nestedElifLinesExtraLevels[i] += ifNode.elifLevel;
			}
		}

		if (!orElseNodeIsElif && ifNode.orelse.length > 0) {
			const firstLineNumber: number = ifNode.body[ifNode.body.length - 1].end_lineno + 1;
			const lastLineNumber: number = ifNode.orelse[ifNode.orelse.length - 1].end_lineno;

			for (let i = firstLineNumber ; i <= lastLineNumber ; i++) {
				if (!(i in this.nestedElifLinesExtraLevels)) {
					this.nestedElifLinesExtraLevels[i] = 0;
				}
				this.nestedElifLinesExtraLevels[i] += ifNode.elifLevel;
			}
		}
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

	private trackedVariablesStackHead(): Variable[] {
		return this.trackedVariablesStack[this.trackedVariablesStack.length - 1];
	}

	private visualizedVariablesStackHead(): Variable[] {
		return this.visualizedVariablesStack[this.visualizedVariablesStack.length - 1];
	}

	private registerAndPushVisualizedVariables(variables: (VisualizedVariable | null)[]): void {
		const nonNullVariables: VisualizedVariable[] =
			variables.filter((variable: VisualizedVariable | null) => variable != null);

		this.visualizedVariables.push(...nonNullVariables);

		this.visualizedVariablesStackHead().push(
			...nonNullVariables.map((visualizedVariable: VisualizedVariable) => visualizedVariable.variable)
		);
	}

	private variableIsTracked(variableNode: ASTNodeUnion, variableName: string): boolean {
		const modifier: Modifier | null = this.getModifierOnNode(variableNode, 'track');

		return modifier != null && (
			modifier.modifierArguments.length === 0 ||
			modifier.modifierArguments.includes(variableName)
		);
	}

	private getVisualizedVariable(
		variableNode: ASTNodeUnion,
		variableName: string
	): VisualizedVariable | null {
		const modifier: Modifier | null = this.getModifierOnNode(variableNode, 'visualize');

		if (modifier == null) {
			return null;
		}

		const variable: VisualizedVariable = {
			variable: createVariable(variableNode, variableName),
			level: null
		};

		if (modifier.modifierArguments.length === 0) {
			return variable;
		} else if (modifier.modifierArguments.length === 1) {
			const argument: string = modifier.modifierArguments[0];

			if (isInteger(argument)) {
				variable.level = parseInt(argument);
				return variable;
			}
		}

		for (const argument of modifier.modifierArguments) {
			const parts: string[] = argument.split(':');

			if (parts[0] === variableName && isInteger(parts[1])) {
				variable.level = parseInt(parts[1]);
				return variable;
			}
		}

		return null;
	}

	private nodeHasModifier(node: ASTNodeUnion, kind: ModifierKind): boolean {
		return this.getModifierOnNode(node, kind) != null;
	}

	private getModifierOnNode(node: ASTNodeUnion, kind: ModifierKind): Modifier | null {
		const annotation: SimulationAnnotation | null =
			this.getAnnotationOnNode(node);

		if (annotation == null) {
			return null;
		}

		return annotation.modifiers.find((modifier: Modifier) => modifier.kind === kind) || null;
	}

	private getAnnotationOnNode(node: ASTNodeUnion): SimulationAnnotation | null {
		for (let i = node.lineno as number ; i <= (node.end_lineno as number) ; i++) {
			if (i in this.lineNumberSimulationAnnotationMapping) {
				return this.lineNumberSimulationAnnotationMapping[i];
			}
		}

		return null;
	}

	private sliceSourceCode(node: ASTNodeUnion): string {
		const nodeStartLineNumber: number = node.lineno as number;
		const nodeEndLineNumber: number = node.end_lineno as number;

		if (node.lineno === node.end_lineno) {
			return this.sourceCode.lines[nodeStartLineNumber - 1]
				.slice(node.col_offset, node.end_col_offset);
		}

		let nodeSourceCode: string =
			this.sourceCode.lines[nodeStartLineNumber - 1].slice(node.col_offset);

		for (let i = nodeStartLineNumber ; i < nodeEndLineNumber - 1 ; i++) {
			nodeSourceCode += `\n${this.sourceCode.lines[i]}`;
		}

		nodeSourceCode += `\n${
			this.sourceCode.lines[nodeEndLineNumber - 1].slice(0, node.end_col_offset)}`;

		return nodeSourceCode;
	}

}

function createVariable(node: ASTNodeUnion, name: string): Variable {
	return {
		identifier: `${node.lineno}_${name}`,
		name,
		definitionLineNumberRange: {
			start: node.lineno as number,
			end: node.end_lineno as number
		}
	};
}

function flattenTuplesAmongNames(array: ASTNodeUnion[]): ASTNodeUnion[] {
	const flattenedArray: ASTNodeUnion[] = [];

	for (const node of array) {
		if (node.nodeType === 'Name') {
			flattenedArray.push(node);
		} else if (node.nodeType === 'Tuple') {
			flattenedArray.push(...flattenTuplesAmongNames(node.elts));
		}
	}

	return flattenedArray;
}

function isInteger(value: string): boolean {
	return !isNaN(value) && /^\d/.test(value) && Number.isInteger(Number(value));
}

function distributeVariables(variables: VisualizedVariable[]): VisualizedVariablesConfiguration {
	const configuration: VisualizedVariablesConfiguration = {
		variableCount: 0,
		levelDistribution: {}
	};

	const reverseDistribution: { [level: number]: string } = {};

	for (const visualizedVariable of variables) {
		if (
			visualizedVariable.level == null ||
			visualizedVariable.level in reverseDistribution
		) {
			continue;
		}

		reverseDistribution[visualizedVariable.level] = visualizedVariable.variable.identifier;
		configuration.variableCount++;
	}

	let level: number = 1;

	for (const visualizedVariable of variables) {
		if (visualizedVariable.level != null) {
			continue;
		}

		while (level in reverseDistribution) {
			level++;
		}

		reverseDistribution[level] = visualizedVariable.variable.identifier;
		configuration.variableCount++;
	}

	for (const level in reverseDistribution) {
		configuration.levelDistribution[reverseDistribution[level]] = Number(level);
	}

	return configuration;
}

export function analyzePythonCode(
	sourceCodeContent: string,
	sortingListVariableName: string
): CodeAnalysisResult {
	const ast = parse(sourceCodeContent);

	const sourceCode: SourceCode = new SourceCode(sourceCodeContent);

	const analyzer = new PythonCodeAnalyzer(
		sourceCode,
		sortingListVariableName,
		SimulationAnnotation.extractAll(sourceCode)
	);

	new NodeEndsSetterVisitor(sourceCode).visit(ast);

	analyzer.visit(ast);

	const instrumentationResult: InstrumentationResult =
		instrumentCode(
			sourceCode,
			sortingListVariableName,
			analyzer.executionCheckpointInstructions,
			analyzer.nestedElifLinesExtraLevels
		);

	return {
		trackedVariableMap: analyzer.trackedVariableMap,
		visualizedVariableMap: analyzer.visualizedVariableMap,
		visualizedVariablesConfiguration: distributeVariables(analyzer.visualizedVariables),
		comparisonMap: analyzer.comparisonMap,
		instrumentationResult
	};
}
