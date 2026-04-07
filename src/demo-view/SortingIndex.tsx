
import * as THREE from 'three';
import { Text } from '@react-three/drei';

import { type Variable } from '../pyodide/code-analysis/codeAnalysis.ts';

import { JETBRAINS_MONO_FONT_PATH } from './fonts.ts';

export type SortingIndexProps = {
	variable: Variable,
	valueGetter: () => number,
	level: number,
	variableCount: number
};

export default function SortingIndex(props: SortingIndexProps) {
	let value: number;

	try {
		value = props.valueGetter();
	} catch (error) {
		return null;
	}

	const color: string = levelColor(props.level, props.variableCount);
	return (
		<group
			position={[value, 0.5 - props.level * 1.2, 0]}
		>
			<mesh
				rotation={[0, 0, Math.PI / 2]}
				scale={[0.4, 0.3, 0.3]}
			>
				<circleGeometry args={[0.5, 3]} />
				<meshBasicMaterial color={color} side={THREE.DoubleSide} />
			</mesh>
			<Text
				position={[0, -0.5, 0]}
				font={JETBRAINS_MONO_FONT_PATH}
				fontSize={0.4}
				color={color}
			>{props.variable.name} = {value}</Text>
		</group>
	);
}

function levelColor(level: number, variableCount: number): string {
	const hue = ((level - 1) / variableCount) * 360;
	return `hsl(${hue}, 50%, 25%)`;
}
