
import { type ForwardedRef, forwardRef } from 'react';

import * as THREE from 'three';
import { Text } from '@react-three/drei';

type BarProps = {
	position: number,
	value: number,
	minimumValue: number,
	maximumValue: number,
	focused: boolean,
	colored?: boolean
};

export const Bar = forwardRef<THREE.Group, BarProps>(
	function Bar(props: BarProps, ref: ForwardedRef<THREE.Group>) {
		return (
			<group
				ref={ref}
				position={[props.position, 0, 0]}
			>
				<mesh position={[0, props.value / 2, 0]}>
					<planeGeometry args={[0.9, props.value]} />
					<meshBasicMaterial toneMapped={false} color={barColor(props)} />
				</mesh>
				<Text
					position={[0, props.value - 0.1, 0]}
					fontSize={0.5}
					anchorY='top'
					color={labelColor(props)}
				>{props.value}</Text>
			</group>
		);
	}
);

function barColor(props: BarProps): string {
	const hue = ((props.value - 1) / props.maximumValue) * 360;
	const saturation = props.colored ? 100 : 0;
	const lightness = props.focused ? 65 : 90;
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function labelColor(props: BarProps): string {
	const hue = ((props.value - 1) / props.maximumValue) * 360;
	const saturation = props.colored ? 80 : 0;
	const lightness = props.focused ? 40 : 80;
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
