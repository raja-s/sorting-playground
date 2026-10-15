
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

export type SortingIndicesProps = {
	frameRef: RefObject<THREE.Object3D>
};

export default function SortingIndices(props: SortingIndicesProps) {
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
	const highestLevel: number = Math.max(...Object.values(configuration.levelDistribution));

	const frameHeight: number =
		variableCount === 0 ? 0 : 0.5 + highestLevel * 1.2;

	return (
		<group>
			{/* The frame's x position and x scale are set to 0. It would be too much extra work (and with
				extra performance cost for no added benefit) to subscribe to changes to the sorting list
				from the application state and scale the frame accordingly in realtime. The frame's width
				will (should) never become greater than that of the sorting scene anyways, and the smooth
				camera component computes the bounding box based on both the sorting scene and the indices,
				so we only really care about the y axis here. */}
			<mesh
				ref={props.frameRef}
				position={[ 0, - frameHeight / 2, -1 ]}
				scale={[ 0, frameHeight, 0 ]}
				visible={false}
			>
				<planeGeometry args={[ 1, 1 ]} />
			</mesh>
			<group>
				{
					executionCheckpoint.squashExecutionStack().flatMap((checkpoint: ExecutionCheckpoint) =>
						pythonCodeAnalysisResult.visualizedVariableMap[checkpoint.lineRange?.start || -1]
							.filter((variable: Variable) => variable.identifier in configuration.levelDistribution)
							.map((variable: Variable) =>
								createSortingIndex(variable, checkpoint, configuration, variableCount))
					)
				}
			</group>
		</group>
	);
}

function createSortingIndex(
	variable: Variable,
	checkpoint: ExecutionCheckpoint,
	configuration: VisualizedVariablesConfiguration,
	variableCount: number
): React.JSX.Element | null {
	let value: number;

	try {
		value = parseInt(checkpoint.scopeLocals[variable.name] as string);
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
