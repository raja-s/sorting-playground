
import { useRef } from 'react';

import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import DoneIcon from '@mui/icons-material/Done';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { useTranslation } from 'react-i18next';

export type ExplanationBubbleProps = {
	placementParameters: BubblePlacementParameters,
	titleTranslationIdentifier: string,
	explanationTranslationIdentifier: string,
	stepNumber: number,
	totalSteps: number,
	moveToPreviousStep: () => void
	moveToNextStep: () => void
};

export type BubblePlacementParameters = {
	targetPoint: { x: number, y: number },
	direction: 'up' | 'down' | 'left' | 'right'
};

const BUBBLE_WIDTH = 620;
const SPOTLIGHT_BUBBLE_HEAD_PADDING = 8;
const SCREEN_EDGE_SAFE_DISTANCE = 10;

export default function ExplanationBubble(props: ExplanationBubbleProps) {
	const translate = useTranslation().t;

	const bubbleRef = useRef(null);

	const isLastStep: boolean = props.stepNumber === props.totalSteps;

	return (
		<Card
			ref={bubbleRef}
			sx={{
				position: 'fixed',
				top: getBubbleTop(props.placementParameters, bubbleRef.current),
				left: getBubbleLeft(props.placementParameters),
				width: BUBBLE_WIDTH,
				maxWidth: '100%',
				borderRadius: '25px',
				backgroundColor: '#f8faff',
				padding: 1,
				zIndex: 102,
				transition: 'all 0.3s'
			}}
		>
			<CardContent
				sx={{ paddingBottom: 0 }}
			>
				<Typography
					variant='h4'
					marginBottom={1}
					color='primary'
				>{translate(props.titleTranslationIdentifier)}</Typography>
				<Typography
					fontSize='1.1rem'
				>{translate(props.explanationTranslationIdentifier)}</Typography>
			</CardContent>
			<CardActions
				sx={{
					justifyContent: 'flex-end',
					paddingX: '12px'
				}}
			>
				{props.stepNumber > 1 && (
					<Tooltip title={translate('guided_tour.previous_button')}>
						<IconButton
							onClick={() => { props.moveToPreviousStep(); }}
						>
							<NavigateBeforeIcon fontSize='large' />
						</IconButton>
					</Tooltip>
				)}
				<Typography
					marginTop='3px'
					fontSize='1.8rem'
					color='secondary'
					paddingX={1}
					sx={{
						WebkitUserSelect: 'none',
						MozUserSelect: 'none',
						msUserSelect: 'none',
						userSelect: 'none'
					}}
				>{props.stepNumber} / {props.totalSteps}</Typography>
				<Tooltip
					title={translate(isLastStep ?
						'guided_tour.finish_button' : 'guided_tour.next_button')}
				>
					<IconButton
						onClick={() => { props.moveToNextStep(); }}
					>{isLastStep ?
						<DoneIcon fontSize='large' color='primary' /> :
						<NavigateNextIcon fontSize='large' />
					}</IconButton>
				</Tooltip>
			</CardActions>
		</Card>
	);
}

function getBubbleTop(
	placementParameters: BubblePlacementParameters,
	bubbleElement: HTMLElement | null
): number {
	const bubbleHeight = bubbleElement == null ? BUBBLE_WIDTH * 0.6 :
		bubbleElement.getBoundingClientRect().height;

	let bubbleTop: number;

	switch (placementParameters.direction) {
		case 'left':
		case 'right': {
			bubbleTop = placementParameters.targetPoint.y - bubbleHeight / 2;
			break;
		}
		case 'up': {
			bubbleTop = placementParameters.targetPoint.y - SPOTLIGHT_BUBBLE_HEAD_PADDING - bubbleHeight;
			break;
		}
		case 'down': {
			bubbleTop = placementParameters.targetPoint.y + SPOTLIGHT_BUBBLE_HEAD_PADDING;
			break;
		}
	}

	if (bubbleTop < SCREEN_EDGE_SAFE_DISTANCE) {
		bubbleTop = SCREEN_EDGE_SAFE_DISTANCE;
	} else if (bubbleTop > window.innerHeight - bubbleHeight - SCREEN_EDGE_SAFE_DISTANCE) {
		bubbleTop = window.innerHeight - bubbleHeight - SCREEN_EDGE_SAFE_DISTANCE;
	}

	return bubbleTop;
}

function getBubbleLeft(placementParameters: BubblePlacementParameters): number {
	let bubbleLeft: number;

	switch (placementParameters.direction) {
		case 'up':
		case 'down': {
			bubbleLeft = placementParameters.targetPoint.x - BUBBLE_WIDTH / 2;
			break;
		}
		case 'left': {
			bubbleLeft = placementParameters.targetPoint.x - SPOTLIGHT_BUBBLE_HEAD_PADDING - BUBBLE_WIDTH;
			break;
		}
		case 'right': {
			bubbleLeft = placementParameters.targetPoint.x + SPOTLIGHT_BUBBLE_HEAD_PADDING;
			break;
		}
	}

	if (bubbleLeft < SCREEN_EDGE_SAFE_DISTANCE) {
		bubbleLeft = SCREEN_EDGE_SAFE_DISTANCE;
	} else if (bubbleLeft > window.innerWidth - BUBBLE_WIDTH - SCREEN_EDGE_SAFE_DISTANCE) {
		bubbleLeft = window.innerWidth - BUBBLE_WIDTH - SCREEN_EDGE_SAFE_DISTANCE;
	}

	return bubbleLeft;
}
