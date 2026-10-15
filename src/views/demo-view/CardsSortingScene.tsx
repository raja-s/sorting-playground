
import { type RefObject, useEffect, useMemo, useRef } from 'react';
import * as React from 'react';

import { shallow, useShallow } from 'zustand/shallow';

import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { type ExecutionOperationState } from '../../state/ApplicationState.ts';
import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type SortingElement, type SortingList } from '../../state/SortingList.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../state/ExecutionCheckpoint.ts';

import { type CodeAnalysisResult } from '../../code-analysis/codeAnalysis.ts';

import {
	type ActiveSortingListComparison,
	STABILIZATION_THRESHOLD,
	getActiveComparison
} from './sortingSceneUtilities.ts';

import cardBackUrl from '../../assets/cards/back.png';

import cardClubsAceUrl   from '../../assets/cards/c_a.png';
import cardClubsTwoUrl   from '../../assets/cards/c_2.png';
import cardClubsThreeUrl from '../../assets/cards/c_3.png';
import cardClubsFourUrl  from '../../assets/cards/c_4.png';
import cardClubsFiveUrl  from '../../assets/cards/c_5.png';
import cardClubsSixUrl   from '../../assets/cards/c_6.png';
import cardClubsSevenUrl from '../../assets/cards/c_7.png';
import cardClubsEightUrl from '../../assets/cards/c_8.png';
import cardClubsNineUrl  from '../../assets/cards/c_9.png';
import cardClubsTenUrl   from '../../assets/cards/c_10.png';
import cardClubsJackUrl  from '../../assets/cards/c_j.png';
import cardClubsQueenUrl from '../../assets/cards/c_q.png';
import cardClubsKingUrl  from '../../assets/cards/c_k.png';

import cardDiamondsAceUrl   from '../../assets/cards/d_a.png';
import cardDiamondsTwoUrl   from '../../assets/cards/d_2.png';
import cardDiamondsThreeUrl from '../../assets/cards/d_3.png';
import cardDiamondsFourUrl  from '../../assets/cards/d_4.png';
import cardDiamondsFiveUrl  from '../../assets/cards/d_5.png';
import cardDiamondsSixUrl   from '../../assets/cards/d_6.png';
import cardDiamondsSevenUrl from '../../assets/cards/d_7.png';
import cardDiamondsEightUrl from '../../assets/cards/d_8.png';
import cardDiamondsNineUrl  from '../../assets/cards/d_9.png';
import cardDiamondsTenUrl   from '../../assets/cards/d_10.png';
import cardDiamondsJackUrl  from '../../assets/cards/d_j.png';
import cardDiamondsQueenUrl from '../../assets/cards/d_q.png';
import cardDiamondsKingUrl  from '../../assets/cards/d_k.png';

import cardSpadesAceUrl   from '../../assets/cards/s_a.png';
import cardSpadesTwoUrl   from '../../assets/cards/s_2.png';
import cardSpadesThreeUrl from '../../assets/cards/s_3.png';
import cardSpadesFourUrl  from '../../assets/cards/s_4.png';
import cardSpadesFiveUrl  from '../../assets/cards/s_5.png';
import cardSpadesSixUrl   from '../../assets/cards/s_6.png';
import cardSpadesSevenUrl from '../../assets/cards/s_7.png';
import cardSpadesEightUrl from '../../assets/cards/s_8.png';
import cardSpadesNineUrl  from '../../assets/cards/s_9.png';
import cardSpadesTenUrl   from '../../assets/cards/s_10.png';
import cardSpadesJackUrl  from '../../assets/cards/s_j.png';
import cardSpadesQueenUrl from '../../assets/cards/s_q.png';
import cardSpadesKingUrl  from '../../assets/cards/s_k.png';

import cardHeartsAceUrl   from '../../assets/cards/h_a.png';
import cardHeartsTwoUrl   from '../../assets/cards/h_2.png';
import cardHeartsThreeUrl from '../../assets/cards/h_3.png';
import cardHeartsFourUrl  from '../../assets/cards/h_4.png';
import cardHeartsFiveUrl  from '../../assets/cards/h_5.png';
import cardHeartsSixUrl   from '../../assets/cards/h_6.png';
import cardHeartsSevenUrl from '../../assets/cards/h_7.png';
import cardHeartsEightUrl from '../../assets/cards/h_8.png';
import cardHeartsNineUrl  from '../../assets/cards/h_9.png';
import cardHeartsTenUrl   from '../../assets/cards/h_10.png';
import cardHeartsJackUrl  from '../../assets/cards/h_j.png';
import cardHeartsQueenUrl from '../../assets/cards/h_q.png';
import cardHeartsKingUrl  from '../../assets/cards/h_k.png';

import cardJokerUrl   from '../../assets/cards/joker.png';

export type CardsSortingSceneProps = {
	frameRef: RefObject<THREE.Object3D>
};

type Materials = { [key: string]: THREE.Material };

type Card = {
	identifier: number,
	groupElement: THREE.Group,
	materials: {
		face: THREE.Material,
		back: THREE.Material
	}
};

type SimulationState = {
	// All arrays here are indexed by
	// sorting elements' identifiers
	cards: (Card | null)[],
	targetPositions: THREE.Vector3[],
	targetOpacities: number[],
	targetRotations: number[],
	currentRotations: number[],
	positionsConverged: boolean[],
	opacitiesConverged: boolean[],
	rotationsConverged: boolean[]
};

const CARD_WIDTH = 2;
const CARD_HEIGHT = 3;
const CARD_THICKNESS = 0.01;

const RANKS = [
	'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
	'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King',
];

const cardTextureUrls = {
	back : cardBackUrl,

	clubsAce   : cardClubsAceUrl,
	clubsTwo   : cardClubsTwoUrl,
	clubsThree : cardClubsThreeUrl,
	clubsFour  : cardClubsFourUrl,
	clubsFive  : cardClubsFiveUrl,
	clubsSix   : cardClubsSixUrl,
	clubsSeven : cardClubsSevenUrl,
	clubsEight : cardClubsEightUrl,
	clubsNine  : cardClubsNineUrl,
	clubsTen   : cardClubsTenUrl,
	clubsJack  : cardClubsJackUrl,
	clubsQueen : cardClubsQueenUrl,
	clubsKing  : cardClubsKingUrl,

	diamondsAce   : cardDiamondsAceUrl,
	diamondsTwo   : cardDiamondsTwoUrl,
	diamondsThree : cardDiamondsThreeUrl,
	diamondsFour  : cardDiamondsFourUrl,
	diamondsFive  : cardDiamondsFiveUrl,
	diamondsSix   : cardDiamondsSixUrl,
	diamondsSeven : cardDiamondsSevenUrl,
	diamondsEight : cardDiamondsEightUrl,
	diamondsNine  : cardDiamondsNineUrl,
	diamondsTen   : cardDiamondsTenUrl,
	diamondsJack  : cardDiamondsJackUrl,
	diamondsQueen : cardDiamondsQueenUrl,
	diamondsKing  : cardDiamondsKingUrl,

	spadesAce   : cardSpadesAceUrl,
	spadesTwo   : cardSpadesTwoUrl,
	spadesThree : cardSpadesThreeUrl,
	spadesFour  : cardSpadesFourUrl,
	spadesFive  : cardSpadesFiveUrl,
	spadesSix   : cardSpadesSixUrl,
	spadesSeven : cardSpadesSevenUrl,
	spadesEight : cardSpadesEightUrl,
	spadesNine  : cardSpadesNineUrl,
	spadesTen   : cardSpadesTenUrl,
	spadesJack  : cardSpadesJackUrl,
	spadesQueen : cardSpadesQueenUrl,
	spadesKing  : cardSpadesKingUrl,

	heartsAce   : cardHeartsAceUrl,
	heartsTwo   : cardHeartsTwoUrl,
	heartsThree : cardHeartsThreeUrl,
	heartsFour  : cardHeartsFourUrl,
	heartsFive  : cardHeartsFiveUrl,
	heartsSix   : cardHeartsSixUrl,
	heartsSeven : cardHeartsSevenUrl,
	heartsEight : cardHeartsEightUrl,
	heartsNine  : cardHeartsNineUrl,
	heartsTen   : cardHeartsTenUrl,
	heartsJack  : cardHeartsJackUrl,
	heartsQueen : cardHeartsQueenUrl,
	heartsKing  : cardHeartsKingUrl,

	Joker : cardJokerUrl
};

useTexture.preload(Object.values(cardTextureUrls));

function CardsSortingScene(props: CardsSortingSceneProps) {
	const sortingList: SortingList = useApplicationStore(useShallow(state => state.sortingList));

	const simulationStateRef: RefObject<SimulationState> = useRef({
		cards : [],
		targetPositions : [],
		targetOpacities : [],
		targetRotations : [],
		currentRotations : [],
		positionsConverged : [],
		opacitiesConverged : [],
		rotationsConverged : []
	});

	const gl = useThree(state => state.gl);

	const textures: { [name: string]: THREE.Texture } = useTexture(cardTextureUrls);

	useEffect(() => {
		Object.values(textures).forEach((texture: THREE.Texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.minFilter = THREE.LinearMipMapLinearFilter;
			texture.magFilter = THREE.LinearFilter;
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.premultiplyAlpha = true;
			texture.anisotropy = gl.capabilities.getMaxAnisotropy();
			texture.generateMipmaps = true;
			texture.needsUpdate = true;
		});
	}, [ textures, gl ]);

	const materials: Materials = useMemo(() => {
		const materialsObject: Materials = {};

		for (const key in textures) {
			materialsObject[key] = new THREE.MeshBasicMaterial({
				map : textures[key],
				transparent : true,
				toneMapped : false,
				blending : THREE.CustomBlending,
				blendEquation : THREE.AddEquation,
				blendSrc : THREE.SrcAlphaFactor,
				blendDst : THREE.OneMinusSrcAlphaFactor,
				premultipliedAlpha: false,
				color : '#ffffff'
			});
		}

		return materialsObject;
	}, [ textures ]);

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
			state => [
				state.pythonCodeAnalysisResult,
				state.executionHistory,
				state.executionHistoryPosition,
				state.executionOperationState,
				state.onlyRevealComparedCards
			] as const,
			([
				pythonCodeAnalysisResult,
				executionHistory,
				executionHistoryPosition,
				executionOperationState,
				onlyRevealComparedCards
			]) => {
				handleStateChangeExecutionRunning(
					simulationStateRef.current,
					props.frameRef.current,
					pythonCodeAnalysisResult,
					executionHistory,
					executionHistoryPosition,
					executionOperationState,
					onlyRevealComparedCards
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

	return (
		<group>
			<mesh
				ref={props.frameRef}
				position={[
					(sortingList.length - 1) * CARD_WIDTH / 4,
					CARD_HEIGHT / 2,
					-1
				]}
				scale={[
					(sortingList.length + 1) * CARD_WIDTH / 2,
					CARD_HEIGHT,
					0
				]}
				visible={false}
			>
				<planeGeometry args={[ 1, 1 ]} />
			</mesh>
			<group>
				{sortingList.map((element: SortingElement, index: number) =>
					createCard(element, index, materials, simulationStateRef))}
			</group>
		</group>
	);
}

export default React.memo(CardsSortingScene);

function createCard(
	element: SortingElement,
	index: number,
	materials: Materials,
	simulationStateRef: RefObject<SimulationState>
): React.JSX.Element {
	const faceMaterial: THREE.Material = materials[mapValueToCardKey(element.value)].clone();
	const backMaterial: THREE.Material = materials.back.clone();

	return (
		<group
			key={element.identifier}
			ref={(cardGroup: THREE.Group) => {
				registerCard(
					element.identifier,
					index,
					cardGroup,
					faceMaterial,
					backMaterial,
					simulationStateRef
				);
			}}
			position={[ index, 0, CARD_THICKNESS * index * 2 ]}
		>
			<mesh
				position={[ 0, CARD_HEIGHT / 2, 0 ]}
				material={faceMaterial}
			>
				<planeGeometry args={[ CARD_WIDTH, CARD_HEIGHT ]} />
			</mesh>
		</group>
	);
}

function registerCard(
	identifier: number,
	index: number,
	cardGroup: THREE.Group,
	faceMaterial: THREE.Material,
	backMaterial: THREE.Material,
	simulationStateRef: RefObject<SimulationState>
): void {
	const simulationState: SimulationState = simulationStateRef.current;

	if (cardGroup != null) {
		simulationState.cards[identifier] = {
			identifier,
			groupElement : cardGroup,
			materials : {
				face : faceMaterial,
				back : backMaterial
			}
		};

		if (simulationState.targetPositions[identifier] != null) {
			simulationState.targetPositions[identifier]
				.set(index, 0, CARD_THICKNESS * index * 2);
		} else {
			simulationState.targetPositions[identifier] =
				new THREE.Vector3(index, 0, CARD_THICKNESS * index * 2);
		}

		simulationState.targetOpacities[identifier] = 1;
		simulationState.targetRotations[identifier] = 0;
		simulationState.currentRotations[identifier] = 0;

		simulationState.positionsConverged[identifier] = false;
		simulationState.opacitiesConverged[identifier] = false;
		simulationState.rotationsConverged[identifier] = false;
	} else if (simulationState.cards[identifier] != null) {
		simulationState.cards[identifier].materials.face.dispose();
		simulationState.cards[identifier].materials.back.dispose();
		simulationState.cards[identifier] = null;
	}
}

function handleStateChangeExecutionRunning(
	simulationState: SimulationState,
	frame: THREE.Object3D,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number,
	executionOperationState: ExecutionOperationState,
	onlyRevealComparedCards: boolean
): void {
	if (
		executionHistoryPosition === 0 ||
		executionHistory[executionHistoryPosition - 1].sortingList == null
	) {
		return;
	}

	for (let identifier = 0 ; identifier < simulationState.cards.length ; identifier++) {
		if (simulationState.cards[identifier] == null) {
			continue;
		}

		simulationState.targetPositions[identifier]
			.copy(simulationState.cards[identifier].groupElement.position);

		simulationState.targetPositions[identifier].setY(1);
		simulationState.targetOpacities[identifier] = 0;
		simulationState.targetRotations[identifier] =
			!onlyRevealComparedCards || executionOperationState === 'finished' &&
				executionHistoryPosition === executionHistory.length ? 0 : Math.PI;

		simulationState.positionsConverged[identifier] = false;
		simulationState.opacitiesConverged[identifier] = false;
		simulationState.rotationsConverged[identifier] = false;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[executionHistoryPosition - 1];

	const activeComparison: ActiveSortingListComparison | null =
		getActiveComparison(pythonCodeAnalysisResult, executionCheckpoint);

	frame.position.x = (executionCheckpoint.sortingList.length - 1) * CARD_WIDTH / 4;
	frame.scale.x = (executionCheckpoint.sortingList.length + 1) * CARD_WIDTH / 2;

	executionCheckpoint.sortingList.forEach(
		(element: SortingElement, index: number) => {
			simulationState.targetPositions[element.identifier].set(
				index,
				executionCheckpoint.sortingElementLevels[index],
				CARD_THICKNESS * index * 2
			);

			simulationState.targetOpacities[element.identifier] =
				1 / (executionCheckpoint.sortingElementLevels[index] + 1);

			if (
				onlyRevealComparedCards &&
				activeComparison != null &&
				cardIsRevealed(element.identifier, activeComparison)
			) {
				simulationState.targetRotations[element.identifier] = 0;
				simulationState.rotationsConverged[element.identifier] = false;
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

	frame.position.x = (sortingList.length - 1) * CARD_WIDTH / 4;
	frame.scale.x = (sortingList.length + 1) * CARD_WIDTH / 2;

	sortingList.forEach((element: SortingElement, index: number) => {
		if (simulationState.targetPositions[element.identifier] == null) {
			simulationState.targetPositions[element.identifier] =
				new THREE.Vector3(index, 0, CARD_THICKNESS * index * 2);
		} else {
			simulationState.targetPositions[element.identifier]
				.set(index, 0, CARD_THICKNESS * index * 2);
		}

		simulationState.positionsConverged[element.identifier] = false;

		if (simulationState.cards[element.identifier] != null) {
			simulationState.targetOpacities[element.identifier] = 1;
			simulationState.targetRotations[element.identifier] = 0;
			simulationState.opacitiesConverged[element.identifier] = false;
			simulationState.rotationsConverged[element.identifier] = false;
		}
	});
}

function handleFrame(simulationState: SimulationState, delta: number): void {
	const alpha = 1 - Math.exp(-8 * delta);

	for (let identifier = 0 ; identifier < simulationState.cards.length ; identifier++) {
		if (simulationState.cards[identifier] == null) {
			unregisterCard(simulationState, identifier);
			continue;
		}

		const cardGroup: THREE.Group = simulationState.cards[identifier].groupElement;

		if (!simulationState.positionsConverged[identifier]) {
			const targetPosition: THREE.Vector3 = simulationState.targetPositions[identifier];

			if (targetPosition.distanceTo(cardGroup.position) < STABILIZATION_THRESHOLD) {
				cardGroup.position.copy(targetPosition);
				simulationState.positionsConverged[identifier] = true;
			} else {
				cardGroup.position.lerp(targetPosition, alpha);
			}
		}

		if (!simulationState.opacitiesConverged[identifier]) {
			const targetOpacity: number = simulationState.targetOpacities[identifier];
			const currentOpacity: number = getCardOpacity(simulationState, identifier);

			if (Math.abs(targetOpacity - currentOpacity) < STABILIZATION_THRESHOLD) {
				setCardOpacity(simulationState, identifier, targetOpacity);
				simulationState.opacitiesConverged[identifier] = true;
			} else {
				setCardOpacity(
					simulationState,
					identifier,
					THREE.MathUtils.lerp(currentOpacity, targetOpacity, alpha)
				);
			}
		}

		if (!simulationState.rotationsConverged[identifier]) {
			const targetRotation: number = simulationState.targetRotations[identifier];

			if (Math.abs(targetRotation - simulationState.currentRotations[identifier])
				< STABILIZATION_THRESHOLD)
			{
				simulationState.currentRotations[identifier] = targetRotation;
				simulationState.rotationsConverged[identifier] = true;
			} else {
				simulationState.currentRotations[identifier] =
					THREE.MathUtils.lerp(
						simulationState.currentRotations[identifier],
						targetRotation,
						alpha
					);
			}

			const cardMesh: THREE.Mesh = cardGroup.children[0] as THREE.Mesh;

			cardMesh.scale.x = Math.abs(Math.cos(
				simulationState.currentRotations[identifier]));

			if (simulationState.currentRotations[identifier] >= Math.PI / 2) {
				cardMesh.material = simulationState.cards[identifier].materials.back;
			} else {
				cardMesh.material = simulationState.cards[identifier].materials.face;
			}
		}
	}
}

function cardIsRevealed(
	cardIdentifier: number,
	activeComparison: ActiveSortingListComparison
): boolean {
	return cardIdentifier === activeComparison.leftHandSideSortingListIdentifier ||
		cardIdentifier === activeComparison.rightHandSideSortingListIdentifier;
}

function unregisterCard(simulationState: SimulationState, identifier: number): void {
	if (simulationState.cards[identifier] == null) {
		return;
	}

	simulationState.cards[identifier].materials.face.dispose();
	simulationState.cards[identifier].materials.back.dispose();
	simulationState.cards[identifier] = null;
}

function getCardOpacity(simulationState: SimulationState, identifier: number): number {
	return simulationState.cards[identifier]!.materials.face.opacity;
}

function setCardOpacity(
	simulationState: SimulationState,
	identifier: number,
	opacity: number
): void {
	simulationState.cards[identifier]!.materials.face.opacity = opacity;
	simulationState.cards[identifier]!.materials.back.opacity = opacity;

	(simulationState.cards[identifier]!.materials.face as THREE.MeshBasicMaterial).color
		.setRGB(opacity, opacity, opacity, THREE.SRGBColorSpace);
	(simulationState.cards[identifier]!.materials.back as THREE.MeshBasicMaterial).color
		.setRGB(opacity, opacity, opacity, THREE.SRGBColorSpace);
}

function mapValueToCardKey(value: number): string {
	const suit: string =
		value >=  1 && value <= 13 ? 'clubs' :
		value >= 14 && value <= 26 ? 'diamonds' :
		value >= 27 && value <= 39 ? 'spades' :
		value >= 40 && value <= 52 ? 'hearts' : '';

	const rank: string =
		suit === 'clubs'    ? RANKS[value -  1] :
		suit === 'diamonds' ? RANKS[value - 14] :
		suit === 'spades'   ? RANKS[value - 27] :
		suit === 'hearts'   ? RANKS[value - 40] : 'Joker';

	return `${suit}${rank}`;
}
