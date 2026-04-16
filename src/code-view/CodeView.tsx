
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import CodeEditor from './code-editor/CodeEditor.tsx';
import Console from './Console.tsx';

export function CodeView() {
	return (
		<Grid
			size={6}
			position='relative'
			overflow='hidden'
		>
			<Stack
				justifyContent='center'
				padding='30px'
				rowGap={2}
				sx={{
					position: 'absolute',
					inset: 0
				}}
			>
				<CodeEditor />
				<Console />
			</Stack>
		</Grid>
	);
}
