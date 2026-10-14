
import * as React from 'react';

import { useShallow } from 'zustand/shallow';

import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type ExecutionOperationState } from '../../state/ApplicationState.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import {
	type CodeAnalysisResult,
	type Variable,
	type VisualizedVariablesConfiguration
} from '../../code-analysis/codeAnalysis.ts';

import SortingIndex from './SortingIndex.tsx';

export default function SortingIndices() {
	const {
		pythonCodeAnalysisResult,
		executionHistory
	}: {
		pythonCodeAnalysisResult: CodeAnalysisResult
		executionHistory: ExecutionHistory
	} = useApplicationStore(
		useShallow(state => ({
			pythonCodeAnalysisResult : state.pythonCodeAnalysisResult,
			executionHistory : state.executionHistory
		}))
	);

	const executionHistoryPosition: number = useApplicationStore(state => state.executionHistoryPosition);
	const executionOperationState: ExecutionOperationState = useApplicationStore(state => state.executionOperationState);

	if (executionOperationState === 'stopped' || executionHistory.length === 0) {
		return null;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[Math.max(executionHistoryPosition - 1, 0)];

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
					pythonCodeAnalysisResult.visualizedVariableMap[checkpoint.lineRange?.start || -1]
						.filter((variable: Variable) => variable.identifier in configuration.levelDistribution)
						.map((variable: Variable) =>
							createSortingIndex(variable, checkpoint, configuration, variableCount))
				)
			}
		</group>
	);
}

function createSortingIndex(
	variable: Variable,
	checkpoint: ExecutionCheckpoint,
	configuration: VisualizedVariablesConfiguration,
	variableCount: number
): SortingIndex | null {
	let value: number;

	try {
		value = parseInt(checkpoint.scopeLocals[variable.name]);
	} catch (error) {
		return null;
	}

	return (
		<SortingIndex
			key={variable.identifier}
			variable={variable}
			value={value}
			level={configuration.levelDistribution[variable.identifier]}
			variableCount={variableCount}
		/>
	);
}
