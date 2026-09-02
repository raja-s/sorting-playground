
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { motion } from 'framer-motion';

import {
	type Sorter,
	type SorterCreator,
	createBubbleSorter,
	createSelectionSorter,
	createInsertionSorter,
	createQuickSorter
} from './sortingAlgorithms.ts';

type CharacterEntry = {
	index: number,
	character: string,
	color: string
};

type SorterConfiguration = {
	sorterCreator: SorterCreator<CharacterEntry>,
	pauseDuration: number,
	stiffness: number,
	damping: number
};

type State = {
	sorterConfiguration: SorterConfiguration,
	sorter: Sorter<CharacterEntry>,
	characterEntries: CharacterEntry[],
	step: number,
	done: boolean
};

export type DynamicLogoProps = {
	fontSize: string,
	reanimateOnClick?: boolean
};

const LOGO_TEXT = 'sorting-playground';

const COLORS = [
	'#ff4d4d', '#ff884d', '#ffc34d', '#ffff4d', '#c4ff4d', '#88ff4d',
	'#4dff4d', '#4dff88', '#4dffc3', '#4dffff', '#4dc3ff', '#4d88ff',
	'#4d4dff', '#884dff', '#c44dff', '#ff4dff', '#ff4dc4', '#ff4d88'
];

const SORTER_CONFIGURATIONS: SorterConfiguration[] = [
	{
		sorterCreator: createBubbleSorter<CharacterEntry>,
		pauseDuration: 40,
		stiffness: 2000,
		damping: 150
	},
	{
		sorterCreator: createSelectionSorter<CharacterEntry>,
		pauseDuration: 175,
		stiffness: 1500,
		damping: 130
	},
	{
		sorterCreator: createInsertionSorter<CharacterEntry>,
		pauseDuration: 100,
		stiffness: 2000,
		damping: 150
	},
	{
		sorterCreator: createQuickSorter<CharacterEntry>,
		pauseDuration: 25,
		stiffness: 2500,
		damping: 180
	}
];

export default function DynamicLogo(props: DynamicLogoProps) {
	const [state, setState] = useState<State>(getInitialState());

	useEffect(() => {
		if (state.done) {
			return;
		}

		const identifier = setTimeout(() => {
			const status = state.sorter.next();

			setState(previousState => {
				if (status.done) {
					return {
						...previousState,
						step: previousState.step + 1,
						done: true
					};
				}

				return {
					...previousState,
					characterEntries: status.value,
					step: previousState.step + 1,
					done: false
				};
			});
		}, state.sorterConfiguration.pauseDuration);

		return () => { clearTimeout(identifier); };
	}, [ state.step, state.done ]);

	return (
		<Typography
			fontFamily='DynaPuff'
			fontSize={props.fontSize}
			fontWeight='500'
			sx={{
				textShadow: '0px 0px 5px rgba(30, 30, 30, 0.15)',
				WebkitUserSelect: 'none',
				MozUserSelect: 'none',
				msUserSelect: 'none',
				userSelect: 'none'
			}}
			onClick={() => {
				if (props.reanimateOnClick) {
					setState(getInitialState());
				}
			}}
		>{state.characterEntries.map(entry => (
			<Box
				key={entry.index}
				component={motion.span}
				layout
				transition={{
					type: 'spring',
					stiffness: state.sorterConfiguration.stiffness,
					damping: state.sorterConfiguration.damping
				}}
				color={entry.color}
				sx={{
					display: 'inline-block',
					whiteSpace: 'pre'
				}}
			>
				{entry.character}
			</Box>
		))}</Typography>
	);
}

function getInitialState(): State {
	const initialCharacterEntries: CharacterEntry[] =
		Array.from(LOGO_TEXT)
			.map((character, index) => ({
				index,
				character,
				color: COLORS[index]
			}))
			.toSorted(() => Math.random() - 0.5);

	const sorterConfiguration: SorterConfiguration =
		SORTER_CONFIGURATIONS[Math.floor(Math.random() * SORTER_CONFIGURATIONS.length)];

	return {
		sorterConfiguration,
		sorter: sorterConfiguration.sorterCreator(
			initialCharacterEntries,
			entry => entry.index
		),
		characterEntries: initialCharacterEntries,
		step: 0,
		done: false
	};
}
