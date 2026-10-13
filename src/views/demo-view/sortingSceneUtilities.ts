
import ExecutionCheckpoint from '../../state/ExecutionCheckpoint.ts';
import {
	type CodeAnalysisResult,
	type SortingListComparison
} from '../../code-analysis/codeAnalysis.ts';

export type ActiveSortingListComparison = {
	leftHandSideSortingListIdentifier?: number,
	rightHandSideSortingListIdentifier?: number
};

export const STABILIZATION_THRESHOLD: number = 10e-4;

export function getActiveComparison(
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionCheckpoint: ExecutionCheckpoint
): ActiveSortingListComparison | null {
	if (
		executionCheckpoint.lineRange == null ||
		!(executionCheckpoint.lineRange.start in pythonCodeAnalysisResult.comparisonMap)
	) {
		return null;
	}

	const comparison: SortingListComparison =
		pythonCodeAnalysisResult.comparisonMap[executionCheckpoint.lineRange.start];

	const activeComparison: Partial<ActiveSortingListComparison> = {};

	if (comparison.leftHandSideSortingListIndexExpression != null) {
		const leftHandSideSortingListIndex =
			evaluateIndexExpression(
				executionCheckpoint,
				comparison.leftHandSideSortingListIndexExpression
			);
		activeComparison.leftHandSideSortingListIdentifier =
			executionCheckpoint.sortingList[leftHandSideSortingListIndex].identifier;
	}
	if (comparison.rightHandSideSortingListIndexExpression != null) {
		const rightHandSideSortingListIndex =
			evaluateIndexExpression(
				executionCheckpoint,
				comparison.rightHandSideSortingListIndexExpression
			);
		activeComparison.rightHandSideSortingListIdentifier =
			executionCheckpoint.sortingList[rightHandSideSortingListIndex].identifier;
	}

	return activeComparison;
}

function evaluateIndexExpression(
	executionCheckpoint: ExecutionCheckpoint,
	indexExpression: string
) {
	let evaluationCode = '';

	for (const variable in executionCheckpoint.scopeLocals) {
		evaluationCode += `let ${variable} = ${JSON.stringify(executionCheckpoint.scopeLocals[variable])};\n`;
	}

	evaluationCode += indexExpression;

	return eval(evaluationCode);
}
