
import { type RefObject, useEffect } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type SmoothCameraProps = {
	sceneGroupRef: RefObject<THREE.Group>,
	sortingSceneGroupRef: RefObject<THREE.Group>
};

export function SmoothCamera(props: SmoothCameraProps) {
	const { camera, size: canvasSize } = useThree();

	const aspectRatio = canvasSize.width / canvasSize.height;

	useEffect(() => {
		camera.rotation.set(0, 0, 0);
		camera.up.set(0, 1, 0);
	}, [camera]);

	useFrame((state, delta) => {
		if (
			props.sceneGroupRef.current == null ||
			props.sortingSceneGroupRef.current == null
		) {
			return
		}

		const sceneBox = new THREE.Box3().setFromObject(props.sceneGroupRef.current);
		const sortingSceneBox = new THREE.Box3().setFromObject(props.sortingSceneGroupRef.current);

		const sceneGroupSize = new THREE.Vector3();
		sceneBox.getSize(sceneGroupSize);

		const sceneGroupCenter = new THREE.Vector3();
		sceneBox.getCenter(sceneGroupCenter);

		const sortingSceneGroupSize = new THREE.Vector3();
		sortingSceneBox.getSize(sortingSceneGroupSize);

		const sortingSceneGroupCenter = new THREE.Vector3();
		sortingSceneBox.getCenter(sortingSceneGroupCenter);

		const targetPosition = new THREE.Vector3(
			sortingSceneGroupCenter.x,
			(sortingSceneGroupCenter.y + 2 * sceneGroupCenter.y) / 3,
			1
		);
		const targetZoom = Math.min(900 / Math.max(sortingSceneGroupSize.x / aspectRatio, sceneGroupSize.y), 75);

		const alpha = 1 - Math.exp(-5 * delta);

		state.camera.position.lerp(targetPosition, alpha);
		state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, targetZoom, alpha);

		state.camera.updateProjectionMatrix();
	});

	return null;
}
