
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import MenuBookIcon from '@mui/icons-material/MenuBook';
import TagIcon from '@mui/icons-material/Tag';

import { useApplicationStore } from '../../state/useApplicationStore.ts';
import { type ExecutionOperationState } from '../../state/ApplicationState.ts';

import CodeEditor from './code-editor/CodeEditor.tsx';
import Console from './Console.tsx';

import TooltipIconButton from '../common/TooltipIconButton.tsx';

export type CodeViewProps = {
	onGuidedTourButtonClick: () => void,
	onAnnotationReferenceButtonClick: () => void
};

export default function CodeView(props: CodeViewProps) {
	const executionOperationState: ExecutionOperationState =
		useApplicationStore(state => state.executionOperationState);

	return (
		<Grid
			size={6}
			position='relative'
			display='flex'
			flexDirection='column'
		>
			<Stack
				height='100%'
				flexGrow={1}
				justifyContent='flex-start'
				sx={{
					position: 'absolute',
					inset: 0
				}}
			>
				<Stack
					direction='row'
					paddingTop={1}
					paddingLeft={1.5}
					gap={0.5}
				>
					<TooltipIconButton
						tooltipTranslationIdentifier='top_buttons.guided_tour'
						disabled={executionOperationState !== 'stopped'}
						onClick={() => { props.onGuidedTourButtonClick(); }}
						guidedTourTargetElementAttributeValue='guided-tour-button'
					>
						<MenuBookIcon fontSize='large' />
					</TooltipIconButton>
					<TooltipIconButton
						tooltipTranslationIdentifier='top_buttons.annotation_reference'
						disabled={executionOperationState !== 'stopped'}
						onClick={() => { props.onAnnotationReferenceButtonClick(); }}
						guidedTourTargetElementAttributeValue='annotation-reference-button'
					>
						<TagIcon fontSize='large' />
					</TooltipIconButton>
				</Stack>
				<Stack
					flexGrow={1}
					justifyContent='center'
					padding='30px'
					rowGap={2}
					sx={{ minHeight: 0 }}
				>
					<CodeEditor />
					<Console />
				</Stack>
			</Stack>
		</Grid>
	);
}
