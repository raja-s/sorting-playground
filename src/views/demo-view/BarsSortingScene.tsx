
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import * as React from 'react';

import { shallow } from 'zustand/shallow';

import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { type ExecutionState } from '../../state/ApplicationState.ts';
import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type SortingElement, type SortingList } from '../../state/SortingList.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import { type CodeAnalysisResult, type SortingListComparison } from '../../code-analysis/codeAnalysis.ts';

type Bounds = {
	minimum: number,
	maximum: number
};

type Bar = {
	identifier: number,
	groupElement: THREE.Group
};

type ActiveSortingListComparison = {
	leftHandSideSortingListIdentifier?: number,
	rightHandSideSortingListIdentifier?: number
};

type SimulationState = {
	bars: { [identifier: number]: Bar },
	targetPositions: { [identifier: number]: THREE.Vector3 },
	targetOpacities: { [identifier: number]: number }
};

const STABILIZATION_THRESHOLD: number = 10e-4;

export function BarsSortingScene() {
	const sortingList: SortingList = useApplicationStore(state => state.sortingList);
	const barsColored: boolean = useApplicationStore(state => state.barsColored);

	const bounds: Bounds | null = determineBounds(sortingList);

	const simulationStateRef: RefObject<SimulationState> = useRef({
		bars: {},
		targetPositions: {},
		targetOpacities: {}
	});

	const registerBar = useCallback((identifier: number, barGroup: THREE.Group) => {
		if (barGroup == null) {
			delete simulationStateRef.current.bars[identifier];
		} else {
			simulationStateRef.current.bars[identifier] = {
				identifier,
				groupElement: barGroup
			};
		}
	}, []);

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
			state => [
				state.pythonCodeAnalysisResult,
				state.executionHistory,
				state.executionHistoryPosition,
				state.focusComparedBars
			] as const,
			([
				pythonCodeAnalysisResult,
				executionHistory,
				executionHistoryPosition,
				focusComparedBars
			]) => {
				handleStateChangeExecutionRunning(
					simulationStateRef.current,
					pythonCodeAnalysisResult,
					executionHistory,
					executionHistoryPosition,
					focusComparedBars
				);
			},
			{ equalityFn: shallow }
		);
		return unsubscribe;
	}, []);

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
			state => [
				state.sortingList,
				state.executionState
			] as const,
			([sortingList, executionState]) => {
				handleStateChangeExecutionStopped(
					simulationStateRef.current,
					sortingList,
					executionState
				)
			}
		);
		return unsubscribe;
	}, []);

	useFrame((_, delta) => {
		handleFrame(simulationStateRef.current, delta);
	});

	return bounds == null ? null : (
		<group>
			{sortingList.map((element, index) =>
				createBar(registerBar, element, index, bounds.maximum, barsColored)
			)}
		</group>
	)
}

function createBar(
	registerBar: (identifier: number, barGroup: THREE.Group) => void,
	element: SortingElement,
	index: number,
	maximumValue: number,
	colored: boolean
): React.JSX.Element {
	const value: number = element.value as number;

	return (
		<group
			key={element.identifier}
			ref={(barGroup: THREE.Group) => {
				registerBar(element.identifier, barGroup);
			}}
			position={[index, 0, 0]}
		>
			<mesh position={[0, value / 2, 0]}>
				<planeGeometry args={[0.9, value]} />
				<meshBasicMaterial
					toneMapped={false}
					color={barColor(value, maximumValue, colored)}
					transparent={true}
					opacity={1}
				/>
			</mesh>
			<Text
				position={[0, value - 0.1, 0.01]}
				fontSize={0.5}
				anchorY='top'
			>
				{value}
				<meshBasicMaterial
					toneMapped={false}
					color={labelColor(value, maximumValue, colored)}
					transparent={true}
					opacity={1}
				/>
			</Text>
		</group>
	);
}

function determineBounds(sortingList: SortingList): Bounds | null {
	if (sortingList.length === 0) {
		return { minimum : 0 , maximum : 0 };
	}

	if (!Number.isFinite(sortingList[0].value)) {
		return null;
	}

	let minimum: number = sortingList[0].value as number;
	let maximum: number = sortingList[0].value as number;

	for (const element of sortingList) {
		if (!Number.isFinite(element.value)) {
			return null;
		}

		const value: number = element.value as number;

		if (value < minimum) {
			minimum = value;
		}
		if (value > maximum) {
			maximum = value;
		}
	}

	return { minimum , maximum };
}

function getActiveComparison(
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

function handleStateChangeExecutionRunning(
	simulationState: SimulationState,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number,
	focusComparedBars: boolean
): void {
	if (
		executionHistoryPosition === 0 ||
		executionHistory[executionHistoryPosition - 1].sortingList == null
	) {
		return;
	}

	for (const identifier in simulationState.bars) {
		simulationState.targetPositions[identifier] =
			simulationState.bars[identifier].groupElement.position.clone();
		simulationState.targetPositions[identifier].setY(1);

		simulationState.targetOpacities[identifier] = 0;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[executionHistoryPosition - 1];

	const activeComparison: ActiveSortingListComparison | null =
		getActiveComparison(pythonCodeAnalysisResult, executionCheckpoint);

	executionCheckpoint.sortingList.forEach(
		(element: SortingElement, index: number) => {
			simulationState.targetPositions[element.identifier] =
				new THREE.Vector3(index, executionCheckpoint.sortingElementLevels[index], 0);

			simulationState.targetOpacities[element.identifier] =
				1 / (executionCheckpoint.sortingElementLevels[index] + 1);

			if (
				focusComparedBars &&
				activeComparison != null &&
				!barIsFocused(element.identifier, activeComparison)
			) {
				simulationState.targetOpacities[element.identifier] /= 4;
			}
		}
	);
}

function handleStateChangeExecutionStopped(
	simulationState: SimulationState,
	sortingList: SortingList,
	executionState: ExecutionState
): void {
	if (executionState !== 'stopped') {
		return;
	}

	simulationState.targetPositions = {};
	sortingList.forEach((element: SortingElement, index: number) => {
		simulationState.targetPositions[element.identifier] =
			new THREE.Vector3(index, 0, 0);

		if (element.identifier in simulationState.bars) {
			simulationState.targetOpacities[element.identifier] = 1;
		}
	});
}

function handleFrame(simulationState: SimulationState, delta: number): void {
	const alpha = 1 - Math.exp(-8 * delta);

	for (const identifier in simulationState.targetPositions) {
		const barGroup: THREE.Group = simulationState.bars[identifier].groupElement;
		const targetPosition = simulationState.targetPositions[identifier];

		if (barGroup == null) {
			delete simulationState.bars[identifier];
			delete simulationState.targetPositions[identifier];
			delete simulationState.targetOpacities[identifier];
			continue;
		}

		if (targetPosition.distanceTo(barGroup.position) < STABILIZATION_THRESHOLD) {
			barGroup.position.x = targetPosition.x;
			barGroup.position.y = targetPosition.y;
			barGroup.position.z = targetPosition.z;
			delete simulationState.targetPositions[identifier];
		} else {
			barGroup.position.x = THREE.MathUtils.lerp(barGroup.position.x, targetPosition.x, alpha);
			barGroup.position.y = THREE.MathUtils.lerp(barGroup.position.y, targetPosition.y, alpha);
			barGroup.position.z = THREE.MathUtils.lerp(barGroup.position.z, targetPosition.z, alpha);
		}
	}

	for (const identifier in simulationState.targetOpacities) {
		const barGroup: THREE.Group = simulationState.bars[identifier].groupElement;
		const targetOpacity = simulationState.targetOpacities[identifier];

		if (barGroup == null) {
			delete simulationState.bars[identifier];
			delete simulationState.targetPositions[identifier];
			delete simulationState.targetOpacities[identifier];
			continue;
		}

		const barGroupOpacity: number = getBarOpacity(barGroup);

		if (Math.abs(targetOpacity - barGroupOpacity) < STABILIZATION_THRESHOLD) {
			setBarOpacity(barGroup, targetOpacity);
			delete simulationState.targetOpacities[identifier];
		} else {
			setBarOpacity(barGroup, THREE.MathUtils.lerp(barGroupOpacity, targetOpacity, alpha));
		}
	}
}

function barIsFocused(barIdentifier: number, activeComparison: ActiveSortingListComparison): boolean {
	return barIdentifier === activeComparison.leftHandSideSortingListIdentifier ||
		barIdentifier === activeComparison.rightHandSideSortingListIdentifier;
}

function getBarOpacity(barGroup: THREE.Group): number {
	return ((barGroup.children[0] as THREE.Mesh).material as THREE.Material).opacity;
}

function setBarOpacity(barGroup: THREE.Group, opacity: number): void {
	((barGroup.children[0] as THREE.Mesh).material as THREE.Material).opacity = opacity;
	((barGroup.children[1] as THREE.Mesh).material as THREE.Material).opacity = opacity;
}

function barColor(
	value: number,
	maximumValue: number,
	colored: boolean
): string {
	const hue = ((value - 1) / maximumValue) * 360;
	const saturation = colored ? 100 : 0;
	return `hsl(${hue}, ${saturation}%, 65%)`;
}

function labelColor(
	value: number,
	maximumValue: number,
	colored: boolean
): string {
	const hue = ((value - 1) / maximumValue) * 360;
	const saturation = colored ? 80 : 0;
	return `hsl(${hue}, ${saturation}%, 40%)`;
}
