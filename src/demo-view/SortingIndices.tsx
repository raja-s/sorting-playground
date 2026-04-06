
import * as THREE from 'three';
import { Text } from '@react-three/drei';

import { useApplicationStore } from '../state/useApplicationStore.ts';
import { type ExecutionState } from '../state/ApplicationState.ts';
import { type ExecutionCheckpoint, type ExecutionHistory } from '../state/ExecutionCheckpoint.ts';

import { type CodeAnalysisResult, type Variable } from '../pyodide/code-analysis/codeAnalysis.ts';

import { JETBRAINS_MONO_FONT_PATH } from './fonts.ts';

export function SortingIndices() {
	const pythonCodeAnalysisResult: CodeAnalysisResult = useApplicationStore(state => state.pythonCodeAnalysisResult);
	const executionHistory: ExecutionHistory = useApplicationStore(state => state.executionHistory);
	const executionHistoryPosition: number = useApplicationStore(state => state.executionHistoryPosition);
	const executionState: ExecutionState = useApplicationStore(state => state.executionState);

	if (executionState === 'stopped' || executionHistory.length === 0) {
		return null;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[Math.max(executionHistoryPosition - 1, 0)];

	if (executionCheckpoint.startLineNumber == null) {
		return null;
	}

	const variableCount: number =
		pythonCodeAnalysisResult.visualizedVariablesConfiguration.variableCount;

	return (
		<group>
			{
				pythonCodeAnalysisResult.visualizedVariableMap[executionCheckpoint.startLineNumber]
					.filter((variable: Variable) => variable.identifier in
						pythonCodeAnalysisResult.visualizedVariablesConfiguration.levelDistribution)
					.map((variable: Variable) => {
						let value: number;

						try {
							value = parseInt(executionCheckpoint.scopeLocals[variable.name]);
						} catch (error) {
							return null;
						}

						const level: number = pythonCodeAnalysisResult
							.visualizedVariablesConfiguration.levelDistribution[variable.identifier];

						const color: string = levelColor(level, variableCount);
						return (
							<group
								key={level}
								position={[value, 0.5 - level * 1.2, 0]}
							>
								<mesh
									rotation={[0, 0, Math.PI / 2]}
									scale={[0.4, 0.3, 0.3]}
								>
									<circleGeometry args={[0.5, 3]} />
									<meshBasicMaterial color={color} side={THREE.DoubleSide} />
								</mesh>
								<Text
									position={[0, -0.5, 0]}
									font={JETBRAINS_MONO_FONT_PATH}
									fontSize={0.4}
									color={color}
								>{variable.name} = {value}</Text>
							</group>
						);
					})
			}
		</group>
	);
}

function levelColor(level: number, variableCount: number): string {
	const hue = ((level - 1) / variableCount) * 360;
	return `hsl(${hue}, 50%, 25%)`;
}
