
import { useState } from 'react';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

import Spotlight from './Spotlight.tsx';
import ExplanationBubble, { type BubblePlacementParameters } from './ExplanationBubble.tsx';

import { useTranslation } from 'react-i18next';

export type GuidedTourProps = {
	isOn: boolean,
	onEnd: () => void
};

type TourStep = {
	getTargetElement: () => Element | undefined,
	translationIdentifiers: {
		title: string,
		explanation: string
	}
};

const TARGET_ELEMENT_ATTRIBUTE = 'data-guided-tour-target-element';

const tourSteps: TourStep[] = [
	{
		getTargetElement: () => document.querySelector(
			`[${TARGET_ELEMENT_ATTRIBUTE}=code-editor]`) || undefined,
		translationIdentifiers: {
			title: 'guided_tour.steps.code_editor.title',
			explanation: 'guided_tour.steps.code_editor.explanation'
		}
	},
	{
		getTargetElement: () => document.querySelector(
			`[${TARGET_ELEMENT_ATTRIBUTE}=demo-view]`) || undefined,
		translationIdentifiers: {
			title: 'guided_tour.steps.demo_view.title',
			explanation: 'guided_tour.steps.demo_view.explanation'
		}
	},
	{
		getTargetElement: () => document.querySelector(
			`[${TARGET_ELEMENT_ATTRIBUTE}=control-bar]`) || undefined,
		translationIdentifiers: {
			title: 'guided_tour.steps.control_bar.title',
			explanation: 'guided_tour.steps.control_bar.explanation'
		}
	},
	{
		getTargetElement: () => Array.from(document.querySelectorAll('span'))
			.find(element => element.innerHTML === '#l#'),
		translationIdentifiers: {
			title: 'guided_tour.steps.list_annotation.title',
			explanation: 'guided_tour.steps.list_annotation.explanation'
		}
	},
	{
		getTargetElement: () => document.querySelector(
			`[${TARGET_ELEMENT_ATTRIBUTE}=annotation-reference-button]`) || undefined,
		translationIdentifiers: {
			title: 'guided_tour.steps.annotation_reference_button.title',
			explanation: 'guided_tour.steps.annotation_reference_button.explanation'
		}
	},
	{
		getTargetElement: () => document.querySelector(
			`[${TARGET_ELEMENT_ATTRIBUTE}=guided-tour-button]`) || undefined,
		translationIdentifiers: {
			title: 'guided_tour.steps.guided_tour_button.title',
			explanation: 'guided_tour.steps.guided_tour_button.explanation'
		}
	}
];

const initialBubblePlacementParameters: BubblePlacementParameters = {
	targetPoint: { x: 0, y: 0 },
	direction: 'down'
};

type State = {
	currentStepIndex: number,
	lastStepIndex: number
}

const INITIAL_STATE: State = {
	currentStepIndex: 0,
	lastStepIndex: 0
};

export default function GuidedTour(props: GuidedTourProps) {
	const translate = useTranslation().t;

	const [ state, setState ] = useState<State>(INITIAL_STATE);

	const [ bubblePlacementParameters, setBubblePlacementParameters ] =
		useState<BubblePlacementParameters>(initialBubblePlacementParameters);

	if (!props.isOn) {
		return null;
	}

	const tourStep: TourStep = tourSteps[state.currentStepIndex];
	const targetElement: Element | undefined = tourStep.getTargetElement();

	if (targetElement == null) {
		if (state.lastStepIndex <= state.currentStepIndex) {
			setState({
				currentStepIndex: state.currentStepIndex + 1,
				lastStepIndex: state.lastStepIndex
			});
		} else {
			setState({
				currentStepIndex: state.currentStepIndex - 1,
				lastStepIndex: state.lastStepIndex
			});
		}
		return null;
	}

	return (
		<>
			<Box
				sx={{
					position: 'fixed',
					top: 0,
					left: 0,
					width: '100vw',
					height: '100vh',
					zIndex: 100,
					backgroundColor: 'transparent'
				}}
			/>
			<Spotlight
				targetElement={tourStep.getTargetElement()}
				setNewBubblePlacementParameters={
					(parameters: BubblePlacementParameters) => {
						setBubblePlacementParameters(parameters);
					}
				}
			/>
			<ExplanationBubble
				placementParameters={bubblePlacementParameters}
				titleTranslationIdentifier={tourStep.translationIdentifiers.title}
				explanationTranslationIdentifier={tourStep.translationIdentifiers.explanation}
				stepNumber={state.currentStepIndex + 1}
				totalSteps={tourSteps.length}
				moveToPreviousStep={() => {
					if (state.currentStepIndex > 0) {
						setState(previousState => ({
							currentStepIndex: previousState.currentStepIndex - 1,
							lastStepIndex: previousState.currentStepIndex
						}));
					}
				}}
				moveToNextStep={() => {
					if (state.currentStepIndex === tourSteps.length - 1) {
						props.onEnd();
						setState(INITIAL_STATE);
					} else {
						setState(previousState => ({
							currentStepIndex: previousState.currentStepIndex + 1,
							lastStepIndex: previousState.currentStepIndex
						}));
					}
				}}
			/>
			<Box
				sx={{
					position: 'fixed',
					right: 0,
					margin: 5,
					zIndex: 102,
					borderRadius: '100px',
					backgroundColor: 'white',
					boxShadow: '0 0 50px #a0a0a0'
				}}
			>
				<Tooltip
					placement='auto'
					title={translate('guided_tour.leave_button')}
				>
					<IconButton
						onClick={() => {
							props.onEnd();
							setState(INITIAL_STATE);
						}}
					>
						<MeetingRoomIcon fontSize='large' />
					</IconButton>
				</Tooltip>
			</Box>
		</>
	);
}
