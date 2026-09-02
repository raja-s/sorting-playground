
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import MenuBookIcon from '@mui/icons-material/MenuBook';
import TagIcon from '@mui/icons-material/Tag';

import { useTranslation } from 'react-i18next';

import CodeEditor from './code-editor/CodeEditor.tsx';
import Console from './Console.tsx';

export type CodeViewProps = {
	onGuidedTourButtonClick: () => void,
	onAnnotationReferenceButtonClick: () => void
};

export function CodeView(props: CodeViewProps) {
	const translate = useTranslation().t;

	return (
		<Grid
			size={6}
			position='relative'
			overflow='hidden'
		>
			<Stack
				sx={{
					position: 'absolute',
					inset: 0
				}}
				overflow='hidden'
			>
				<Stack
					direction='row'
					paddingTop={1}
					paddingLeft={1.5}
					gap={0.5}
				>
					<Tooltip
						title={translate('top_buttons.guided_tour')}
					>
						<IconButton
							data-guided-tour-target-element='guided-tour-button'
							onClick={() => { props.onGuidedTourButtonClick(); }}
						>
							<MenuBookIcon fontSize='large' />
						</IconButton>
					</Tooltip>
					<Tooltip title={translate('top_buttons.annotation_reference')}>
						<IconButton
							data-guided-tour-target-element='annotation-reference-button'
							onClick={() => { props.onAnnotationReferenceButtonClick(); }}
						>
							<TagIcon fontSize='large' />
						</IconButton>
					</Tooltip>
				</Stack>
				<Stack
					flexGrow={1}
					justifyContent='center'
					padding='30px'
					rowGap={2}
					overflow='hidden'
				>
					<CodeEditor />
					<Console />
				</Stack>
			</Stack>
		</Grid>
	);
}
