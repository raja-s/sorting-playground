
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';

import { useTranslation } from 'react-i18next';

import { CodeEditor } from './CodeEditor.tsx';
import { Console } from './Console.tsx';

const startingList: number[] = [3, 7, 1, 5, 2, 8, 9, 4, 6];

export function CodeView() {
	const translate = useTranslation().t;

	const startingListVariableName: string = translate('code.starting_list_variable_name');
	const startingCode: string = `${translate('code.list_variable_comment')}
${startingListVariableName} = [${startingList.join(', ')}]

n = len(${startingListVariableName})

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
				rowGap={2}
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
				<Console />
			</Stack>
		</Grid>
	);
}
