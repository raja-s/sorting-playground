
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { CodeEditor } from './CodeEditor.tsx';

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
				sx={{
					position: 'absolute',
					inset: 0
				}}
			>
				<CodeEditor />
			</Stack>
		</Grid>
	);
}
