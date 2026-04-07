
import { useApplicationStore } from '../state/useApplicationStore.ts';
import { type ExecutionState } from '../state/ApplicationState.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../state/ExecutionCheckpoint.ts';

import {
	type CodeAnalysisResult,
	type Variable,
	type VisualizedVariablesConfiguration
} from '../pyodide/code-analysis/codeAnalysis.ts';

import SortingIndex from './SortingIndex.tsx';

export default function SortingIndices() {
	const pythonCodeAnalysisResult: CodeAnalysisResult = useApplicationStore(state => state.pythonCodeAnalysisResult);
	const executionHistory: ExecutionHistory = useApplicationStore(state => state.executionHistory);
	const executionHistoryPosition: number = useApplicationStore(state => state.executionHistoryPosition);
	const executionState: ExecutionState = useApplicationStore(state => state.executionState);

	if (executionState === 'stopped' || executionHistory.length === 0) {
		return null;
	}

	let executionCheckpoint: ExecutionCheckpoint =
		executionHistory[Math.max(executionHistoryPosition - 1, 0)];

	if (executionCheckpoint.startLineNumber == null) {
		if (executionHistoryPosition < 2) {
			return null;
		} else {
			executionCheckpoint = executionHistory[executionHistoryPosition - 2];
		}
	}


	const configuration: VisualizedVariablesConfiguration = pythonCodeAnalysisResult.visualizedVariablesConfiguration;

	const variableCount: number = configuration.variableCount;

	return (
		<group>
			{
				executionCheckpoint.squashExecutionStack().flatMap((checkpoint: ExecutionCheckpoint) =>
					pythonCodeAnalysisResult.visualizedVariableMap[checkpoint.startLineNumber]
						.filter((variable: Variable) => variable.identifier in configuration.levelDistribution)
						.map((variable: Variable) =>
							<SortingIndex
								key={variable.identifier}
								variable={variable}
								valueGetter={() => parseInt(checkpoint.scopeLocals[variable.name])}
								level={configuration.levelDistribution[variable.identifier]}
								variableCount={variableCount}
							/>
						)
				)
			}
		</group>
	);
}
