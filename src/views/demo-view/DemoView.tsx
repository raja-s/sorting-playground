
import { type RefObject, Suspense, useRef } from 'react';
import * as React from 'react';

import Grid from '@mui/material/Grid';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Text, useFont } from '@react-three/drei';

import { useApplicationStore } from '../../state/useApplicationStore.ts';
import type { DemoViewMode } from '../../state/ApplicationState.ts';

import BarsSortingScene from './BarsSortingScene.tsx';
import CardsSortingScene from './CardsSortingScene.tsx';
import SmoothCamera from './SmoothCamera.tsx';
import SortingIndices from './SortingIndices.tsx';

import { JETBRAINS_MONO_FONT_PATH } from './fonts.ts';

useFont.preload(JETBRAINS_MONO_FONT_PATH);

function DemoView() {
	const demoViewMode: DemoViewMode = useApplicationStore(state => state.demoViewMode);

	const sortingSceneFrameRef: RefObject<THREE.Object3D> = useRef(new THREE.Object3D());
	const sortingIndicesFrameRef: RefObject<THREE.Object3D> = useRef(new THREE.Object3D());

	return (
		<Grid
			size={6}
			sx={{ backgroundColor: '#f8faff' }}
		>
			<Canvas
				data-guided-tour-target-element='demo-view'
				orthographic
			>
				<Suspense fallback={null}>
					<SmoothCamera
						sortingSceneFrameRef={sortingSceneFrameRef}
						sortingIndicesFrameRef={sortingIndicesFrameRef}
					/>
					<ambientLight />
					<group>
						{demoViewMode === 'bars' &&
							<BarsSortingScene
								frameRef={sortingSceneFrameRef}
							/>
						}
						{demoViewMode === 'cards' &&
							<CardsSortingScene
								frameRef={sortingSceneFrameRef}
							/>
						}
						<SortingIndices frameRef={sortingIndicesFrameRef} />
					</group>
					{getDummyText()}
				</Suspense>
			</Canvas>
		</Grid>
	);
}

export default React.memo(DemoView);

function getDummyText() {
	// A hack to avoid flickering when the first text appears
	return (
		<Text
			font={JETBRAINS_MONO_FONT_PATH}
			visible={false}
		>0123456789= abcdefghijklmnopqrstuvwxyz</Text>
	);
}
