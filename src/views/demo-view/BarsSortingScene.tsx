
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { shallow } from 'zustand/shallow';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type SortingElement, type SortingList } from '../../state/SortingList.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import { type CodeAnalysisResult, type SortingListComparison } from '../../code-analysis/codeAnalysis.ts';

import { Bar } from './Bar.tsx';

type Bounds = {
	minimum: number,
	maximum: number
};

type MountedBars = {
	[identifier: number]: THREE.Group
};

type Position = {
	x: number,
	y: number,
	z: number
};

type TargetPositions = {
	[identifier: number]: Position
};

type ActiveSortingListComparison = {
	leftHandSideSortingListIdentifier?: number,
	rightHandSideSortingListIdentifier?: number
} | null;

const STABILIZATION_THRESHOLD: number = 10e-4;

export function BarsSortingScene() {
	const sortingList: SortingList = useApplicationStore(state => state.sortingList);
	const barsColored: boolean = useApplicationStore(state => state.barsColored);
	const focusComparedBars: boolean = useApplicationStore(state => state.focusComparedBars);

	const [activeComparison, setActiveComparison]:
		[ActiveSortingListComparison, React.Dispatch<React.SetStateAction<ActiveSortingListComparison>>] =
			useState<ActiveSortingListComparison>(null);

	const bounds: Bounds | null = determineBounds(sortingList);

	const mountedBarsRef: RefObject<MountedBars> = useRef({});
	const targetPositionsRef: RefObject<TargetPositions> = useRef({});

	const registerBar = useCallback((identifier: number, barGroup: THREE.Group) => {
		if (barGroup === null) {
			delete mountedBarsRef.current[identifier];
		} else {
			mountedBarsRef.current[identifier] = barGroup;
		}
	}, []);

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
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

				for (const identifier in mountedBarsRef.current) {
					mountedBarsRef.current[identifier].visible = false;
				}

				const executionCheckpoint: ExecutionCheckpoint =
					executionHistory[executionHistoryPosition - 1];

				executionCheckpoint.sortingList.forEach(
					(element: SortingElement, index: number) => {
						mountedBarsRef.current[element.identifier].visible = true;
						targetPositionsRef.current[element.identifier] = {
							x: index,
							y: executionCheckpoint.sortingElementLevels[index],
							z: 0
						};
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
		const unsubscribe = useApplicationStore.subscribe(
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
					if (element.identifier in mountedBarsRef.current) {
						mountedBarsRef.current[element.identifier].visible = true;
					}
					targetPositionsRef.current[element.identifier] = {
						x: index,
						y: 0,
						z: 0
					};
				});
			}
		);
		return unsubscribe;
	}, []);

	useFrame((state, delta) => {
		const alpha = 1 - Math.exp(-8 * delta);

		for (const identifier in targetPositionsRef.current) {
			const barGroup = mountedBarsRef.current[identifier];
			const targetPosition = targetPositionsRef.current[identifier];

			if (barGroup == null) {
				delete mountedBarsRef.current[identifier];
				delete targetPositionsRef.current[identifier];
				continue;
			}

			if (
				Math.abs(targetPosition.x - barGroup.position.x) < STABILIZATION_THRESHOLD &&
				Math.abs(targetPosition.y - barGroup.position.y) < STABILIZATION_THRESHOLD &&
				Math.abs(targetPosition.z - barGroup.position.z) < STABILIZATION_THRESHOLD
			) {
				barGroup.position.x = targetPosition.x;
				barGroup.position.y = targetPosition.y;
				barGroup.position.z = targetPosition.z;
				delete targetPositionsRef.current[identifier];
			} else {
				barGroup.position.x = THREE.MathUtils.lerp(barGroup.position.x, targetPosition.x, alpha);
				barGroup.position.y = THREE.MathUtils.lerp(barGroup.position.y, targetPosition.y, alpha);
				barGroup.position.z = THREE.MathUtils.lerp(barGroup.position.z, targetPosition.z, alpha);
			}
		}
	});

	return bounds == null ? null : (
		<group>
			{sortingList.map((element, index) =>
				<Bar
					ref={(barGroup: THREE.Group) => {
						registerBar(element.identifier, barGroup);
					}}

					key={element.identifier}
					position={index}
					value={element.value as number}
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

function checkAndSetActiveComparison(
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number,
	setActiveComparison: React.Dispatch<React.SetStateAction<ActiveSortingListComparison>>
): void {
	if (executionHistoryPosition === 0) {
		setActiveComparison(null);
		return;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[executionHistoryPosition - 1];

	if (
		executionCheckpoint.lineRange == null ||
		!(executionCheckpoint.lineRange.start in pythonCodeAnalysisResult.comparisonMap)
	) {
		setActiveComparison(null);
		return;
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
