
import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';

import { type BubblePlacementParameters } from './ExplanationBubble.tsx';

export type SpotlightProps = {
	targetElement?: Element,
	setNewBubblePlacementParameters: (props: BubblePlacementParameters) => void
};

type Coordinates = {
	top: number,
	left: number,
	width: number,
	height: number
};

const initialCoordinates = { top: 0, left: 0, width: 0, height: 0 };

const SPOTLIGHT_PADDING = 25;

export default function Spotlight(props: SpotlightProps) {
	const [ coordinates, setCoordinates ] = useState<Coordinates>(initialCoordinates);

	useEffect(() => {
		const listener = () => {
			recomputeCoordinatesAndFreeSpace(props, setCoordinates);
		};

		listener();
		window.addEventListener('resize', listener);

		return () => {
			window.removeEventListener('resize', listener);
		};
	}, [ props.targetElement ]);

	if (props.targetElement == null) {
		return;
	}

	return (
		<Box
			id='spotlight'
			sx={{
				position: 'fixed',
				zIndex: 101,
				borderRadius: '25px',

				top: coordinates.top,
				left: coordinates.left,
				width: coordinates.width,
				height: coordinates.height,

				backgroundColor: 'transparent',
				boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',

				transition: 'all 0.3s'
			}}
		/>
	);
}

function recomputeCoordinatesAndFreeSpace(
	props: SpotlightProps,
	setCoordinates
): void {
	if (props.targetElement == null) {
		return;
	}

	const rectangle = props.targetElement.getBoundingClientRect();

	const coordinates: Coordinates = {
		top    : rectangle.top  - SPOTLIGHT_PADDING,
		left   : rectangle.left - SPOTLIGHT_PADDING,
		width  : rectangle.width  + SPOTLIGHT_PADDING * 2,
		height : rectangle.height + SPOTLIGHT_PADDING * 2
	};

	setCoordinates(coordinates);

	type Space = {
		size: number,
		placementParameters: BubblePlacementParameters
	};

	const spaces: Space[] = [
		// Above
		{
			size : coordinates.top,
			placementParameters : {
				targetPoint : {
					x : coordinates.left + coordinates.width / 2,
					y : coordinates.top
				},
				direction : 'up'
			}
		},
		// Below
		{
			size : window.innerHeight - coordinates.top - coordinates.height,
			placementParameters : {
				targetPoint : {
					x : coordinates.left + coordinates.width / 2,
					y : coordinates.top + coordinates.height
				},
				direction: 'down'
			}
		},
		// To the left
		{
			size : coordinates.left,
			placementParameters : {
				targetPoint : {
					x : coordinates.left,
					y : coordinates.top + coordinates.height / 2
				},
				direction : 'left'
			}
		},
		// To the right
		{
			size : window.innerWidth - coordinates.left - coordinates.width,
			placementParameters : {
				targetPoint : {
					x : coordinates.left + coordinates.width,
					y : coordinates.top + coordinates.height / 2
				},
				direction: 'right'
			}
		}
	];

	spaces.sort((space1, space2) => space2.size - space1.size);

	props.setNewBubblePlacementParameters(spaces[0].placementParameters);
}
