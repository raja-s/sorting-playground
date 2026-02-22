
import { type RefObject, useEffect, useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type SmoothCameraProps = {
	sceneGroupRef: RefObject<THREE.Group>
};

export function SmoothCamera(props: SmoothCameraProps) {
	const { camera } = useThree();

	useEffect(() => {
		camera.rotation.set(0, 0, 0);
		camera.up.set(0, 1, 0);
	}, [camera]);

	useFrame((state, delta) => {
		if (props.sceneGroupRef.current == null) {
			return
		}

		const box = new THREE.Box3().setFromObject(props.sceneGroupRef.current);

		const groupSize = new THREE.Vector3();
		box.getSize(groupSize);

		const groupCenter = new THREE.Vector3();
		box.getCenter(groupCenter);

		const targetPosition = new THREE.Vector3(groupCenter.x, groupCenter.y - 1, 1);
		const targetZoom = Math.min(600 / Math.max(groupSize.x, groupSize.y), 100);

		const alpha = 1 - Math.exp(-5 * delta);

		state.camera.position.lerp(targetPosition, alpha);
		state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, targetZoom, alpha);

		state.camera.updateProjectionMatrix();
	});

	return null;
}
