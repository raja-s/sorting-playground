
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary, {
	accordionSummaryClasses
} from '@mui/material/AccordionSummary';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { useTranslation } from 'react-i18next';

import AnnotationExplanationLine from './AnnotationExplanationLine.tsx';

export type AnnotationReferenceDialog = {
	isOpen: boolean,
	onClose: () => void
};

export default function AnnotationReferenceDialog(props: AnnotationReferenceDialog) {
	const translate = useTranslation().t;

	return (
		<Dialog
			fullWidth
			maxWidth='lg'
			open={props.isOpen}
			onClose={props.onClose}
			slotProps={{
				paper: {
					sx: {
						borderRadius: '30px',
						paddingY: 2,
						backgroundColor: '#f8faff'
					}
				}
			}}
		>
			<DialogTitle
				textAlign='center'
				variant='h4'
				color='secondary'
			>{translate('annotation_reference.title')}</DialogTitle>
			<DialogContent>
				<DialogContentText
					marginX={8}
					marginY={1}
					fontSize='1.2rem'
				>{
					translate('annotation_reference.general_explanation')
				}</DialogContentText>
				<Divider
					sx={{
						marginX: 6,
						marginY: 3
					}}
				/>
				<Stack
					marginX={3}
					gap={3}
				>
					<AnnotationExplanationLine
						annotationContent='l'
						translationKey='annotation_reference.annotation_explanations.list'
						shortAnnotation
					/>
					<AnnotationExplanationLine
						annotationContent='t'
						translationKey='annotation_reference.annotation_explanations.track'
						shortAnnotation
					/>
					<AnnotationExplanationLine
						annotationContent='v'
						translationKey='annotation_reference.annotation_explanations.visualize'
						shortAnnotation
					/>
					<AnnotationExplanationLine
						annotationContent='s'
						translationKey='annotation_reference.annotation_explanations.skip'
						shortAnnotation
					/>
					<AnnotationExplanationLine
						annotationContent='tv'
						translationKey='annotation_reference.annotation_explanations.combined_annotations'
						shortAnnotation
					/>
				</Stack>
				<Accordion
					elevation={0}
					sx={{
						marginTop: 3,
						backgroundColor: 'transparent',
						'&::before': { display: 'none' }
					}}
				>
					<AccordionSummary
						expandIcon={<NavigateNextIcon />}
						sx={{
							flexDirection: 'row-reverse',
							[`& .${accordionSummaryClasses.content}, .${
									accordionSummaryClasses.content}.${
										accordionSummaryClasses.expanded}`
							]: {
								marginLeft: 1
							},
							[`& .${accordionSummaryClasses.expandIconWrapper}.${
								accordionSummaryClasses.expanded}`]:
							{
								transform: 'rotate(90deg)'
							}
						}}
					>
						<Typography
							fontSize='1.5rem'
							color='secondary.main'
						>{
							translate('annotation_reference.advanced_annotations_label')
						}</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<Stack gap={3}>
							<AnnotationExplanationLine
								annotationContent='t(x,z)'
								translationKey='annotation_reference.annotation_explanations.track_with_variable_names'
							/>
							<AnnotationExplanationLine
								annotationContent='v(2)'
								translationKey='annotation_reference.annotation_explanations.visualize_with_level'
							/>
							<AnnotationExplanationLine
								annotationContent='v(x:2,y:1)'
								translationKey='annotation_reference.annotation_explanations.visualize_with_variable_level_mapping'
							/>
							<AnnotationExplanationLine
								annotationContent='d(k-l)'
								translationKey='annotation_reference.annotation_explanations.divide'
							/>
							<AnnotationExplanationLine
								annotationContent='d(k-l,m-n)'
								translationKey='annotation_reference.annotation_explanations.divide_multiple_ranges'
							/>
						</Stack>
					</AccordionDetails>
				</Accordion>
			</DialogContent>
			<IconButton
				sx={{
					position: 'absolute',
					top: '20px',
					right: '20px'
				}}
				onClick={props.onClose}
			>
				<CloseIcon fontSize='large' />
			</IconButton>
		</Dialog>
	);
}
