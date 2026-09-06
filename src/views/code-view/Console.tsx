
import { useEffect, useRef } from 'react';

import { useApplicationStore } from '../../state/useApplicationStore.ts';
import {
	type ConsoleContent,
	type ConsoleContentType
} from '../../state/ApplicationState.ts';

import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

const COLORS: Record<ConsoleContentType, string> = {
	'standard_output': '#757575',
	'line_break': '',
	'prompt_text': '#757575',
	'user_input': '#216bfa',
	'error': '#d32f2f'
};

export default function Console() {
	const consoleContent = useApplicationStore(state => state.consoleContent);
	const executionIsWaitingForInput = useApplicationStore(state => state.executionIsWaitingForInput);
	const submitConsoleInput = useApplicationStore(state => state.submitConsoleInput);
	const executionHistory = useApplicationStore(state => state.executionHistory);
	const executionHistoryPosition = useApplicationStore(state => state.executionHistoryPosition);

	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (executionIsWaitingForInput && inputRef.current != null) {
			inputRef.current.focus();
		}
	}, [ executionIsWaitingForInput ]);

	const consoleContentLines: ConsoleContent[][] = [ [] ];

	for (const content of consoleContent) {
		if (
			content.executionHistoryPosition > executionHistoryPosition ||
			content.executionHistoryPosition === executionHistoryPosition &&
			content.type !== 'error' && content.type !== 'line_break' && (
				content.type !== 'prompt_text' || executionHistory.length > executionHistoryPosition
			)
		) {
			break;
		}

		if (content.type === 'line_break') {
			consoleContentLines.push([]);
			continue;
		}

		consoleContentLines[consoleContentLines.length - 1].push(content);
	}

	if (consoleContentLines.length === 1 && consoleContentLines[0].length === 0) {
		return null;
	}

	return (
		<Stack
			height='200px'
			flexGrow={0}
			flexShrink={0}
			padding={2}
			borderRadius='15px'
			sx={{
				backgroundColor: '#f8faff',
				overflowX: 'auto'
			}}
		>
			{consoleContentLines.map((contentLine: ConsoleContent[], lineIndex: number) =>
				<Stack
					key={lineIndex}
					direction='row'
					sx={{
						width: 'max-content',
						minWidth: '100%',
						alignItems: 'center'
					}}
				>
					{contentLine.map((content: ConsoleContent, index: number) =>
						<Typography
							key={index}
							fontFamily='"JetBrains Mono", monospace'
							fontSize='1.2rem'
							color={COLORS[content.type]}
							sx={{ whiteSpace: 'pre' }}
						>{content.text || '\u200B'}</Typography>
					)}
					{lineIndex === consoleContentLines.length - 1 && executionIsWaitingForInput && (
						<TextField
							variant='standard'
							inputRef={inputRef}
							slotProps={{
								input: {
									disableUnderline: true
								}
							}}
							sx={{
								flexGrow: 1,
								border: 'none',
								boxShadow: 'none',
								backgroundColor: 'transparent',
								'& .MuiInput-input': {
									padding: 0,
									boxShadow: 'none',
									fontFamily: '"JetBrains Mono", monospace',
									fontSize: '1.2rem',
									color: COLORS['user_input'],
									'&:focus': {
										boxShadow: 'none'
									}
								}
							}}
							onKeyDown={event => {
								if (event.key !== 'Enter') {
									return;
								}

								event.preventDefault();
								submitConsoleInput(event.target.value);
							}}
						/>
					)}
				</Stack>
			)}
		</Stack>
	);
}
