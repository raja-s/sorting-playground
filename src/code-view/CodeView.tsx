
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { useTranslation } from 'react-i18next';

import { CodeEditor } from './CodeEditor.tsx';

const startingList: number[] = [1, 8, 2, 5, 3, 9, 6, 4, 7];

export function CodeView() {
	const translate = useTranslation().t;

	const startingListVariableName: string = translate('code.starting_list_variable_name');
	const startingCode: string = `${translate('code.list_variable_comment')}
${startingListVariableName} = [${startingList.join(', ')}]

${translate('code.to_do_comment')}
	`;

	const startingCodeLines: string[] = startingCode.split('\n');

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
				<CodeEditor
					startingList={startingList}
					startingListVariableName={startingListVariableName}
					startingCode={startingCode}
					startingCodeLines={startingCodeLines}
				/>
			</Stack>
		</Grid>
	);
}
