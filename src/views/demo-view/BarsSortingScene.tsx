
import { type RefObject, useCallback, useEffect, useRef } from 'react';
import * as React from 'react';

import { shallow } from 'zustand/shallow';

import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { type ExecutionOperationState } from '../../state/ApplicationState.ts';
import { useApplicationStore } from '../../state/useApplicationStore.ts';
import type { SortingElement, SortingList, SortingListBounds } from '../../state/SortingList.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import { type CodeAnalysisResult } from '../../code-analysis/codeAnalysis.ts';

import {
	type ActiveSortingListComparison,
	STABILIZATION_THRESHOLD,
	getActiveComparison
} from './sortingSceneUtilities.ts';

type Bar = {
	identifier: number,
	groupElement: THREE.Group
};

type SimulationState = {
	bars: { [identifier: number]: Bar },
	targetPositions: { [identifier: number]: THREE.Vector3 },
	targetOpacities: { [identifier: number]: number }
};

type BarAndLabelColors = {
	bar: string,
	label: string
};

export default function BarsSortingScene() {
	const sortingList: SortingList = useApplicationStore(state => state.sortingList);
	const sortingListBounds: SortingListBounds | null = useApplicationStore(state => state.sortingListBounds);
	const barsColored: boolean = useApplicationStore(state => state.barsColored);

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
				state.executionOperationState
			] as const,
			([sortingList, executionOperationState]) => {
				handleStateChangeExecutionStopped(
					simulationStateRef.current,
					sortingList,
					executionOperationState
				)
			}
		);
		return unsubscribe;
	}, []);

	useFrame((_, delta) => {
		handleFrame(simulationStateRef.current, delta);
	});

	return sortingListBounds == null ? null : (
		<group>
			{sortingList.map((element, index) =>
				createBar(registerBar, element, index, sortingListBounds, barsColored)
			)}
		</group>
	);
}

function createBar(
	registerBar: (identifier: number, barGroup: THREE.Group) => void,
	element: SortingElement,
	index: number,
	sortingListBounds: SortingListBounds,
	colored: boolean
): React.JSX.Element {
	const value: number = element.value as number;
	const colors: BarAndLabelColors =
		barAndLabelColors(value, sortingListBounds, colored);

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
					color={colors.bar}
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
					color={colors.label}
					transparent={true}
					opacity={1}
				/>
			</Text>
		</group>
	);
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
	executionOperationState: ExecutionOperationState
): void {
	if (executionOperationState !== 'stopped') {
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
		const barGroup: THREE.Group = simulationState.bars[identifier]?.groupElement;
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
		const barGroup: THREE.Group = simulationState.bars[identifier]?.groupElement;
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

function barIsFocused(
	barIdentifier: number,
	activeComparison: ActiveSortingListComparison
): boolean {
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

function barAndLabelColors(
	value: number,
	sortingListBounds: SortingListBounds,
	colored: boolean
): BarAndLabelColors {
	const rangeLength = sortingListBounds.maximum - sortingListBounds.minimum + 1;
	const hue = ((value - sortingListBounds.minimum) / rangeLength) * 360;

	const barSaturation   = colored ? 100 : 0;
	const labelSaturation = colored ?  80 : 0;

	return {
		bar:   `hsl(${hue}, ${barSaturation}%,   65%)`,
		label: `hsl(${hue}, ${labelSaturation}%, 40%)`
	};
}
