
import * as THREE from 'three';
import { Text } from '@react-three/drei';

import {
	type ExecutionCheckpoint,
	type ExecutionState,
	useControlStore
} from '../state/useControlStore.ts';
import { type CodeAnalysisResult, type TrackedVariable } from '../pyodide/codeAnalysis.ts';

export function SortingIndices() {
	const pythonCodeAnalysisResult: CodeAnalysisResult = useControlStore(state => state.pythonCodeAnalysisResult);
	const executionHistory: ExecutionCheckpoint[] = useControlStore(state => state.executionHistory);
	const executionHistoryPosition: number = useControlStore(state => state.executionHistoryPosition);
	const executionState: ExecutionState = useControlStore(state => state.executionState);

	if (executionState === 'stopped' || executionHistory.length === 0) {
		return null;
	}

	const executionCheckpoint = executionHistory[Math.max(executionHistoryPosition - 1, 0)];

	if (executionCheckpoint.lineNumber === -1) {
		return null;
	}

	return (
		<group>
			{
				pythonCodeAnalysisResult.trackedVariableMap[executionCheckpoint.lineNumber]
					.filter((variable: TrackedVariable) => variable.loopIterator)
					.map((variable: TrackedVariable, index: number, array: TrackedVariable[]) => {
						const value: number = executionCheckpoint.scopeLocals[variable.name] as number;
						const color: string = indexColor(index, array.length);
						return (
							<group
								key={index}
								position={[value, -0.7 - index * 1.2, 0]}
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
									font='/fonts/JetBrainsMono-VariableFont_wght.ttf'
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

function indexColor(index: number, indexCount: number): string {
	const hue = (index / indexCount) * 360;
	return `hsl(${hue}, 50%, 25%)`;
}
