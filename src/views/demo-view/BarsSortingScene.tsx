
import { type RefObject, useEffect, useRef } from 'react';
import * as React from 'react';

import { shallow, useShallow } from 'zustand/shallow';

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

export type BarsSortingSceneProps = {
	frameRef: RefObject<THREE.Object3D>
};

type Bar = {
	identifier: number,
	groupElement: THREE.Group
};

type SimulationState = {
	// All arrays here are indexed by
	// sorting elements' identifiers
	bars: (Bar | null)[],
	targetPositions: THREE.Vector3[],
	targetOpacities: number[],
	positionsConverged: boolean[],
	opacitiesConverged: boolean[]
};

type BarAndLabelColors = {
	bar: string,
	label: string
};

function BarsSortingScene(props: BarsSortingSceneProps) {
	const {
		sortingList,
		sortingListBounds
	}: {
		sortingList: SortingList,
		sortingListBounds: SortingListBounds | null
	} = useApplicationStore(
		useShallow(state => ({
			sortingList : state.sortingList,
			sortingListBounds : state.sortingListBounds
		}))
	);

	const barsColored: boolean = useApplicationStore(state => state.barsColored);

	const simulationStateRef: RefObject<SimulationState> = useRef({
		bars : [],
		targetPositions : [],
		targetOpacities : [],
		positionsConverged : [],
		opacitiesConverged : []
	});

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
					props.frameRef.current,
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
					props.frameRef.current,
					sortingList,
					executionOperationState
				)
			},
			{ equalityFn: shallow }
		);
		return unsubscribe;
	}, []);

	useFrame((_, delta) => {
		handleFrame(simulationStateRef.current, delta);
	});

	return sortingListBounds == null ? null : (
		<group>
			<mesh
				ref={props.frameRef}
				position={[
					(sortingList.length - 1) / 2,
					sortingListBounds.maximum / 2,
					-1
				]}
				scale={[
					sortingList.length,
					sortingListBounds.maximum,
					0
				]}
				visible={false}
			>
				<planeGeometry args={[ 1, 1 ]} />
			</mesh>
			<group>
				{sortingList.map((element: SortingElement, index: number) =>
					createBar(
						element,
						index,
						sortingListBounds,
						barsColored,
						simulationStateRef
					)
				)}
			</group>
		</group>
	);
}

export default React.memo(BarsSortingScene);

function createBar(
	element: SortingElement,
	index: number,
	sortingListBounds: SortingListBounds,
	colored: boolean,
	simulationStateRef: RefObject<SimulationState>
): React.JSX.Element {
	const colors: BarAndLabelColors =
		barAndLabelColors(element.value, sortingListBounds, colored);

	return (
		<group
			key={element.identifier}
			ref={(barGroup: THREE.Group) => {
				registerBar(
					element.identifier,
					index,
					barGroup,
					simulationStateRef
				);
			}}
			position={[index, 0, 0]}
		>
			<mesh position={[0, element.value / 2, 0]}>
				<planeGeometry args={[0.9, element.value]} />
				<meshBasicMaterial
					toneMapped={false}
					color={colors.bar}
					transparent={true}
					opacity={1}
				/>
			</mesh>
			<Text
				position={[0, element.value - 0.1, 0.01]}
				fontSize={0.5}
				anchorY='top'
			>
				{element.value}
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

function registerBar(
	identifier: number,
	index: number,
	barGroup: THREE.Group,
	simulationStateRef: RefObject<SimulationState>
): void {
	const simulationState: SimulationState = simulationStateRef.current;

	if (barGroup == null) {
		simulationState.bars[identifier] = null;
	} else {
		simulationState.bars[identifier] = {
			identifier,
			groupElement : barGroup
		};

		if (simulationState.targetPositions[identifier] != null) {
			simulationState.targetPositions[identifier].set(index, 0, 0);
		} else {
			simulationState.targetPositions[identifier] = new THREE.Vector3(index, 0, 0);
		}

		simulationState.targetOpacities[identifier] = 1;

		simulationState.positionsConverged[identifier] = false;
		simulationState.opacitiesConverged[identifier] = false;
	}
}

function handleStateChangeExecutionRunning(
	simulationState: SimulationState,
	frame: THREE.Object3D,
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

	for (let identifier = 0 ; identifier < simulationState.bars.length ; identifier++) {
		if (simulationState.bars[identifier] == null) {
			continue;
		}

		simulationState.targetPositions[identifier]
			.copy(simulationState.bars[identifier].groupElement.position);

		simulationState.targetPositions[identifier].setY(1);
		simulationState.targetOpacities[identifier] = 0;

		simulationState.positionsConverged[identifier] = false;
		simulationState.opacitiesConverged[identifier] = false;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[executionHistoryPosition - 1];

	const activeComparison: ActiveSortingListComparison | null =
		getActiveComparison(pythonCodeAnalysisResult, executionCheckpoint);

	const maximumValue: number = Math.max(
		...executionCheckpoint.sortingList
			.map((element: SortingElement) => element.value)
	);

	frame.position.x = (executionCheckpoint.sortingList.length - 1) / 2;
	frame.position.y = maximumValue / 2;
	frame.scale.x = executionCheckpoint.sortingList.length;
	frame.scale.y = maximumValue;

	executionCheckpoint.sortingList.forEach(
		(element: SortingElement, index: number) => {
			simulationState.targetPositions[element.identifier]
				.set(index, executionCheckpoint.sortingElementLevels[index], 0);

			simulationState.targetOpacities[element.identifier] =
				1 / (executionCheckpoint.sortingElementLevels[index] + 1);

			if (
				focusComparedBars &&
				activeComparison != null &&
				!barIsFocused(element.identifier, activeComparison)
			) {
				simulationState.targetOpacities[element.identifier] /= 4;
			}

			simulationState.positionsConverged[element.identifier] = false;
			simulationState.opacitiesConverged[element.identifier] = false;
		}
	);
}

function handleStateChangeExecutionStopped(
	simulationState: SimulationState,
	frame: THREE.Object3D,
	sortingList: SortingList,
	executionOperationState: ExecutionOperationState
): void {
	if (executionOperationState !== 'stopped') {
		return;
	}

	const maximumValue: number = Math.max(
		...sortingList
			.map((element: SortingElement) => element.value)
	);

	frame.position.x = (sortingList.length - 1) / 2;
	frame.position.y = maximumValue / 2;
	frame.scale.x = sortingList.length;
	frame.scale.y = maximumValue;

	sortingList.forEach((element: SortingElement, index: number) => {
		if (simulationState.targetPositions[element.identifier] == null) {
			simulationState.targetPositions[element.identifier] =
				new THREE.Vector3(index, 0, 0);
		} else {
			simulationState.targetPositions[element.identifier].set(index, 0, 0);
		}

		simulationState.positionsConverged[element.identifier] = false;

		if (simulationState.bars[element.identifier] != null) {
			simulationState.targetOpacities[element.identifier] = 1;
			simulationState.opacitiesConverged[element.identifier] = false;
		}
	});
}

function handleFrame(simulationState: SimulationState, delta: number): void {
	const alpha = 1 - Math.exp(-8 * delta);

	for (let identifier = 0 ; identifier < simulationState.bars.length ; identifier++) {
		if (simulationState.bars[identifier] == null) {
			unregisterBar(simulationState, identifier);
			continue;
		}

		const barGroup: THREE.Group = simulationState.bars[identifier].groupElement;

		if (!simulationState.positionsConverged[identifier]) {
			const targetPosition: THREE.Vector3 = simulationState.targetPositions[identifier];

			if (targetPosition.distanceTo(barGroup.position) < STABILIZATION_THRESHOLD) {
				barGroup.position.copy(targetPosition);
				simulationState.positionsConverged[identifier] = true;
			} else {
				barGroup.position.lerp(targetPosition, alpha);
			}
		}

		if (!simulationState.opacitiesConverged[identifier]) {
			const targetOpacity: number = simulationState.targetOpacities[identifier];
			const barGroupOpacity: number = getBarOpacity(barGroup);

			if (Math.abs(targetOpacity - barGroupOpacity) < STABILIZATION_THRESHOLD) {
				setBarOpacity(barGroup, targetOpacity);
				simulationState.opacitiesConverged[identifier] = true;
			} else {
				setBarOpacity(barGroup, THREE.MathUtils.lerp(barGroupOpacity, targetOpacity, alpha));
			}
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

function unregisterBar(simulationState: SimulationState, identifier: number): void {
	simulationState.bars[identifier] = null;
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
