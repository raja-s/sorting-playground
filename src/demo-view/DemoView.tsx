
import { type RefObject, Suspense, useRef } from 'react';

import Grid from '@mui/material/Grid';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Text, useFont } from '@react-three/drei';

import { BarsSortingScene } from './BarsSortingScene.tsx';
import { SmoothCamera } from './SmoothCamera.tsx';
import { SortingIndices } from './SortingIndices.tsx';

import { JETBRAINS_MONO_FONT_PATH } from './fonts.ts';

useFont.preload(JETBRAINS_MONO_FONT_PATH);

export function DemoView() {
	const groupRef: RefObject<THREE.Group> = useRef<THREE.Group>();

	return (
		<Grid
			size={6}
			sx={{ backgroundColor: '#f8faff' }}
		>
			<Canvas orthographic>
				<Suspense fallback={null}>
					<SmoothCamera sceneGroupRef={groupRef} />
					<ambientLight />
					<group ref={groupRef}>
						<BarsSortingScene />
					</group>
					<SortingIndices />
					{getDummyText()}
				</Suspense>
			</Canvas>
		</Grid>
	);
}

function getDummyText() {
	// A hack to avoid flickering when the first text appears
	return (
		<Text
			font={JETBRAINS_MONO_FONT_PATH}
			visible={false}
		>0123456789= abcdefghijklmnopqrstuvwxyz</Text>
	);
}
