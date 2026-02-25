
import Box from '@mui/material/Box';

import { useControlStore } from '../state/useControlStore.ts';
import { type CodeAnalysisResult } from '../pyodide/code-analysis/codeAnalysis.ts';

import Typography from '@mui/material/Typography';

export function Console() {
	const consoleContent = useControlStore(state => state.consoleContent);
	const pythonCodeAnalysisResult = useControlStore(state => state.pythonCodeAnalysisResult);

	return (
		<Box>
			{consoleContent.map((content, index) =>
				<Typography
					key={index}
					sx={{ whiteSpace: 'pre' }}
					fontFamily='"JetBrains Mono", monospace'
					color={content.type === 'error' ? 'error' : 'secondary'}
				>{
					content.type === 'error' ?
						cleanUpError(content.text, pythonCodeAnalysisResult) : content.text
				}</Typography>
			)}
		</Box>
	);
}

function cleanUpError(
	text: string,
	pythonCodeAnalysisResult: CodeAnalysisResult
): string {
	const textLines: string[] = text.split('\n');

	const cleanedUpErrorTextLines: string[] = [];

	let skipping = false;

	for (const line of textLines) {
		if (line.startsWith('  File ')) {
			skipping = !line.startsWith('  File "<exec>"');
		}

		if (skipping) {
			continue;
		}

		cleanedUpErrorTextLines.push(
			!line.startsWith('  File "<exec>"') ? line :
				mapLineNumber(line, pythonCodeAnalysisResult)
		);
	}

	return cleanedUpErrorTextLines.join('\n');
}

function mapLineNumber(
	line: string,
	pythonCodeAnalysisResult: CodeAnalysisResult
): string {
	const regex: RegExp = /(File "<exec>", line )(\d+)/;
	const matches: RegExpExecArray | null = regex.exec(line);

	if (matches == null) {
		return line;
	}

	const lineNumber: number = parseInt(matches[2]);

	const correctedLineNumber: number =
		pythonCodeAnalysisResult.instrumentationResult.lineNumberMapping[lineNumber];

	return line.replace(regex, `$1${correctedLineNumber}`);
}
