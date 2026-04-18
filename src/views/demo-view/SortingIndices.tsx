
import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type ExecutionState } from '../../state/ApplicationState.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import {
	type CodeAnalysisResult,
	type Variable,
	type VisualizedVariablesConfiguration
} from '../../code-analysis/codeAnalysis.ts';

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

	if (executionCheckpoint.lineRange == null) {
		if (executionHistoryPosition < 2) {
			return null;
		} else {
			executionCheckpoint = executionHistory[executionHistoryPosition - 2];
		}
	}


	const configuration: VisualizedVariablesConfiguration = pythonCodeAnalysisResult.visualizedVariablesConfiguration;

	const variableCount: number = configuration.variableCount;
	const invisibleGeometryYPosition: number =
		variableCount === 0 ? 0 : -0.5 - variableCount * 1.2;

	return (
		<group>
			<mesh visible={false} position={[-1, invisibleGeometryYPosition, 0]}>
				<boxGeometry args={[1, 0, 0]} />
			</mesh>
			{
				executionCheckpoint.squashExecutionStack().flatMap((checkpoint: ExecutionCheckpoint) =>
					pythonCodeAnalysisResult.visualizedVariableMap[checkpoint.lineRange.start]
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
