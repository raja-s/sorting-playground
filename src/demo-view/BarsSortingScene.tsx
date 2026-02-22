
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { shallow } from 'zustand/shallow';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
	type ExecutionCheckpoint,
	type ExecutionState,
	type SortingElement,
	useControlStore
} from '../state/useControlStore.ts';
import { type CodeAnalysisResult, type SortingListComparison } from '../pyodide/codeAnalysis.ts';

import { Bar } from './Bar.tsx';

/*type Movement = {
	identifier: number,
	oldPosition: number,
	newPosition: number
};*/

// TODO: Is this really necessary?! Is TargetPositions enough after all?
/*type SortingListMovementSet = {
	targetSortingList: SortingElement[],
	movements: { [identifier: number]: Movement }
};*/

type MountedBars = {
	[identifier: number]: THREE.Mesh
};

type TargetPositions = {
	[identifier: number]: number
};

type ActiveSortingListComparison = {
	leftHandSideSortingListIdentifier?: number,
	rightHandSideSortingListIdentifier?: number
} | null;

const STABILIZATION_THRESHOLD: number = 10e-4;

export function BarsSortingScene() {
	const sortingList: SortingElement[] = useControlStore(state => state.sortingList);
	const barsColored: boolean = useControlStore(state => state.barsColored);
	const focusComparedBars: boolean = useControlStore(state => state.focusComparedBars);

	const [activeComparison, setActiveComparison]:
		[ActiveSortingListComparison, React.Dispatch<React.SetStateAction<ActiveSortingListComparison>>] =
			useState<ActiveSortingListComparison>(null);

	const bounds = determineBounds(sortingList);

	const mountedBarsRef: RefObject<MountedBars> = useRef({});
	/*const sortingListMovementSetRef: RefObject<SortingListMovementSet> = useRef({
		targetSortingList: sortingList,
		movements: {}
	});*/
	const targetPositionsRef: RefObject<TargetPositions> = useRef({});

	const registerBar = useCallback((identifier: number, barMesh: THREE.Mesh) => {
		if (barMesh === null) {
			delete mountedBarsRef.current[identifier];
		} else {
			mountedBarsRef.current[identifier] = barMesh;
		}
	}, []);

	/*useEffect(() => {
		sortingListMovementSetRef.current = {
			targetSortingList: sortingList,
			movements: {}
		};
	}, [sortingList]);*/

	useEffect(() => {
		const unsubscribe = useControlStore.subscribe(
			state => [
				state.pythonCodeAnalysisResult,
				state.executionHistory,
				state.executionHistoryPosition
			] as const,
			([
				pythonCodeAnalysisResult,
				executionHistory,
				executionHistoryPosition
			]) => {
				if (executionHistoryPosition === 0 ||
					executionHistory[executionHistoryPosition - 1].sortingList == null)
				{
					return;
				}

				/*sortingListMovementSetRef.current =
					computeSortingListMovementSet(
						sortingListMovementSetRef.current,
						executionHistory[executionHistoryPosition - 1].sortingList,
						targetPositionsRef.current
					);*/
				executionHistory[executionHistoryPosition - 1].sortingList.forEach(
					(element: SortingElement, index: number) => {
						targetPositionsRef.current[element.identifier] = index;
					}
				);

				checkAndSetActiveComparison(
					pythonCodeAnalysisResult,
					executionHistory,
					executionHistoryPosition,
					setActiveComparison
				);
			},
			{ equalityFn: shallow }
		);
		return unsubscribe;
	}, []);

	useEffect(() => {
		const unsubscribe = useControlStore.subscribe(
			state => [
				state.sortingList,
				state.executionState
			] as const,
			([sortingList, executionState]) => {
				if (executionState !== 'stopped') {
					return;
				}

				setActiveComparison(null);

				targetPositionsRef.current = {};
				sortingList.forEach((element: SortingElement, index: number) => {
					targetPositionsRef.current[element.identifier] = index;
				});
			}
		);
		return unsubscribe;
	}, []);

	useFrame((state, delta) => {
//		const sortingListMovementSet: SortingListMovementSet =
//			sortingListMovementSetRef.current;

		const alpha = 1 - Math.exp(-8 * delta);

//		for (const identifier in sortingListMovementSet.movements) {
		for (const identifier in targetPositionsRef.current) {
			const barMesh = mountedBarsRef.current[identifier];
//			const targetPosition = sortingListMovementSet.movements[identifier].newPosition;
			const targetPosition = targetPositionsRef.current[identifier];

			if (barMesh == null) {
				continue;
			}

			if (Math.abs(targetPosition - barMesh.position.x) < STABILIZATION_THRESHOLD) {
				barMesh.position.x = targetPosition;
				delete targetPositionsRef.current[identifier];
			} else {
				barMesh.position.x = THREE.MathUtils.lerp(
					barMesh.position.x,
					targetPosition,
					alpha
				);
			}
		}
	});

	return (
		<group>
			{sortingList.map((element, index) =>
				<Bar
					ref={(barMesh: THREE.Mesh) => {
						registerBar(element.identifier, barMesh);
					}}

					key={element.identifier}
					position={index}
					value={element.value}
					minimumValue={bounds.minimum}
					maximumValue={bounds.maximum}
					focused={
						!focusComparedBars ||
						activeComparison == null ||
						element.identifier === activeComparison.leftHandSideSortingListIdentifier ||
						element.identifier === activeComparison.rightHandSideSortingListIdentifier
					}
					colored={barsColored}
				/>
			)}
		</group>
	)
}

function determineBounds(sortingList: SortingElement[]) {
	if (sortingList.length === 0) {
		return { minimum : 0 , maximum : 0 };
	}

	let minimum: number = sortingList[0].value;
	let maximum: number = sortingList[0].value;

	for (const element of sortingList) {
		if (element.value < minimum) {
			minimum = element.value;
		}
		if (element.value > maximum) {
			maximum = element.value;
		}
	}

	return { minimum , maximum };
}

function checkAndSetActiveComparison(
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionHistory: ExecutionCheckpoint[],
	executionHistoryPosition: number,
	setActiveComparison: React.Dispatch<React.SetStateAction<ActiveSortingListComparison>>
): void {
	if (executionHistoryPosition === 0) {
		setActiveComparison(null);
		return;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[executionHistoryPosition - 1];

	const lineNumber = executionCheckpoint.lineNumber;

	if (!(lineNumber in pythonCodeAnalysisResult.comparisonMap)) {
		setActiveComparison(null);
		return;
	}

	const comparison: SortingListComparison = pythonCodeAnalysisResult.comparisonMap[lineNumber];

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

	setActiveComparison(activeComparison);
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

/*function computeSortingListMovementSet(
	movementSet: SortingListMovementSet,
	newSortingList: SortingElement[],
	targetPositions: TargetPositions
): SortingListMovementSet {
	const newMovementSet: SortingListMovementSet = {
		targetSortingList: newSortingList,
		movements: {}
	};

	newSortingList.forEach((element, index) => {
		if (movementSet.targetSortingList[index].identifier !== element.identifier) {
			newMovementSet.movements[element.identifier] = {
				identifier: element.identifier,
				oldPosition: -1,
				newPosition: index
			};
		}
		targetPositions[element.identifier] = index;
	});

//	movementSet.targetSortingList.forEach((element, index) => {
//		if (element.identifier in newMovementSet.movements) {
//			newMovementSet.movements[element.identifier].oldPosition = index;
//		}
//	});

	return newMovementSet;
}*/
