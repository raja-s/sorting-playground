
import {
	type SaveExecutionCheckpointLineNumberRanges,
	type NestedElifLinesExtraLevels
} from './codeAnalysis.ts';

import basePythonUrl from '../base.py?url';

export type LineNumberMapping = {
	[instrumentedCodeLineNumber: number]: number
};

export type InstrumentationResult = {
	instrumentedCode: string,
	lineNumberMapping: LineNumberMapping
};

const basePython: Response = await fetch(basePythonUrl);
const basePythonCode: string = await basePython.text();

export function instrumentCode(
	userPythonCode: string,
	sortingListVariableName: string,
	saveExecutionCheckpointLineNumberRanges: SaveExecutionCheckpointLineNumberRanges,
	nestedElifLinesExtraLevels: NestedElifLinesExtraLevels
): InstrumentationResult {
	const basePythonCodeParts = basePythonCode.split('#USER_CODE_INSERTION_HANDLE#');

	let instrumentedCode: string =
		basePythonCodeParts[0].trimEnd()
			.replaceAll('SORTING_LIST_VARIABLE_NAME', sortingListVariableName);

	let instrumentedCodeLineCount = instrumentedCode.split('\n').length;

	const lineNumberMapping: LineNumberMapping = {};

	const codeLines: string[] = userPythonCode.split('\n');

	for (let i = 0 ; i < codeLines.length ; i++) {
		const lineNumber: number = i + 1;
		const codeLine: string = codeLines[i];
		const trimmedCodeLine: string = codeLine.trim();

		const baseIndentationSize: number = 4;

		if (
			lineNumber in saveExecutionCheckpointLineNumberRanges &&
			!trimmedCodeLine.startsWith('elif ')
		) {
			const indentationSize: number =
				baseIndentationSize + (codeLine.match(/^ */) as RegExpMatchArray)[0].length +
					(nestedElifLinesExtraLevels[lineNumber] | 0) * 4;

			const range = saveExecutionCheckpointLineNumberRanges[lineNumber];

			instrumentedCode +=
				`\n${' '.repeat(indentationSize)}save_execution_checkpoint_and_pause(${
					range.start}, ${range.end}, locals())`;
			instrumentedCodeLineCount++;
		}

		if (
			lineNumber in saveExecutionCheckpointLineNumberRanges &&
			trimmedCodeLine.startsWith('elif ')
		) {
			const indentationSize: number =
				baseIndentationSize + (codeLine.match(/^ */) as RegExpMatchArray)[0].length;
			const elseIndentationSize: number =
				indentationSize + (nestedElifLinesExtraLevels[lineNumber] - 1) * 4;
			const elseBodyIndentationSize: number = elseIndentationSize + 4;

			const range = saveExecutionCheckpointLineNumberRanges[lineNumber];

			instrumentedCode += `\n${' '.repeat(elseIndentationSize)}else:` +
				`\n${' '.repeat(elseBodyIndentationSize)}save_execution_checkpoint_and_pause(${
					range.start}, ${range.end}, locals())` +
				`\n${' '.repeat(elseBodyIndentationSize)}if ${trimmedCodeLine.slice(5)}`;
			instrumentedCodeLineCount += 2;
		} else {
			const extraLevels: number = nestedElifLinesExtraLevels[lineNumber] | 0;
			instrumentedCode += `\n${' '.repeat(baseIndentationSize + extraLevels * 4)}${codeLine}`;
			instrumentedCodeLineCount++;
		}

		if (trimmedCodeLine !== '' && !trimmedCodeLine.startsWith('#')) {
			lineNumberMapping[instrumentedCodeLineCount] = lineNumber;
		}
	}

	if (!instrumentedCode.endsWith('\n')) {
		instrumentedCode += '\n';
	}

	instrumentedCode += '    save_execution_checkpoint_and_pause(None, None, locals())\n'

	instrumentedCode += basePythonCodeParts[1].trimStart();

	return { instrumentedCode, lineNumberMapping };
}
