
import { type RefObject, useEffect } from 'react';
import * as React from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type SmoothCameraProps = {
	sortingSceneFrameRef: RefObject<THREE.Object3D>,
	sortingIndicesFrameRef: RefObject<THREE.Object3D>
};

const HORIZONTAL_PADDING = 2;
const VERTICAL_PADDING_FACTOR = 1.25;
const MAXIMUM_ZOOM = 150;

const frameBox = new THREE.Box3();
const frameSize = new THREE.Vector3();
const sortingIndicesFrameCenter = new THREE.Vector3();
const sortingSceneFrameCenter = new THREE.Vector3();
const targetPosition = new THREE.Vector3(0, 0, 100);

function SmoothCamera(props: SmoothCameraProps) {
	const { camera, size: canvasSize } = useThree();

	useEffect(() => {
		camera.rotation.set(0, 0, 0);
		camera.up.set(0, 1, 0);
	}, [camera]);

	useFrame((state, delta) => {
		if (props.sortingSceneFrameRef.current == null) {
			return;
		}

		const alpha = 1 - Math.exp(-5 * delta);

		// Camera position

		frameBox.setFromObject(props.sortingSceneFrameRef.current);
		frameBox.getCenter(sortingSceneFrameCenter);

		if (isNaN(sortingSceneFrameCenter.x)) {
			return;
		}

		if (props.sortingIndicesFrameRef.current != null) {
			frameBox.setFromObject(props.sortingIndicesFrameRef.current);
			frameBox.getCenter(sortingIndicesFrameCenter);

			frameBox.expandByObject(props.sortingSceneFrameRef.current);
		}

		targetPosition.x = sortingSceneFrameCenter.x;

		if (props.sortingIndicesFrameRef.current == null) {
			targetPosition.y = sortingSceneFrameCenter.y;
		} else {
			targetPosition.y =
				(sortingSceneFrameCenter.y * 9 + sortingIndicesFrameCenter.y) / 10;
		}

		state.camera.position.lerp(targetPosition, alpha);

		// Camera zoom

		frameBox.getSize(frameSize);

		const boundedWidth = frameSize.x + HORIZONTAL_PADDING;
		const boundedHeight = frameSize.y * VERTICAL_PADDING_FACTOR;

		const horizontalFitZoom = canvasSize.width / boundedWidth;
		const verticalFitZoom = canvasSize.height / boundedHeight;

		const targetZoom = Math.min(
			horizontalFitZoom,
			verticalFitZoom,
			MAXIMUM_ZOOM
		);

		state.camera.zoom = THREE.MathUtils.lerp(
			state.camera.zoom,
			targetZoom,
			alpha
		);

		state.camera.updateProjectionMatrix();
	});

	return null;
}

export default React.memo(SmoothCamera);
