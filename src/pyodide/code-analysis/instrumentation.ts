
import SourceCode from './SourceCode.ts';

import {
	type ExecutionCheckpointInstruction,
	type ExecutionCheckpointInstructions,
	type NestedElifLinesExtraLevels
} from './codeAnalysis.ts';
import { countOccurrences } from './common.ts';

import basePythonUrl from './base.py?url';

export type LineNumberMapping = {
	[instrumentedCodeLineNumber: number]: number
};

export type InstrumentationResult = {
	instrumentedCode: string,
	lineNumberMapping: LineNumberMapping
};

const basePython: Response = await fetch(basePythonUrl);
const basePythonCode: string = await basePython.text();

const startingInstrumentedCodeLineCount: number =
	countOccurrences(
		'\n',
		basePythonCode.split('#USER_CODE_INSERTION_HANDLE#')[0].trimEnd()
	) + 1;

export function instrumentCode(
	userPythonCode: SourceCode,
	sortingListVariableName: string,
	executionCheckpointInstructions: ExecutionCheckpointInstructions,
	nestedElifLinesExtraLevels: NestedElifLinesExtraLevels
): InstrumentationResult {
	const basePythonCodeParts: string[] = basePythonCode.split('#USER_CODE_INSERTION_HANDLE#');

	let instrumentedCode: string =
		basePythonCodeParts[0].trimEnd()
			.replaceAll('SORTING_LIST_VARIABLE_NAME', sortingListVariableName);

	let instrumentedCodeLineCount: number = startingInstrumentedCodeLineCount;

	const lineNumberMapping: LineNumberMapping = {};

	for (let i = 0 ; i < userPythonCode.lines.length ; i++) {
		const lineNumber: number = i + 1;
		const codeLine: string = userPythonCode.lines[i];
		const trimmedCodeLine: string = codeLine.trim();

		const baseIndentationSize: number = 4;

		if (
			lineNumber in executionCheckpointInstructions &&
			!trimmedCodeLine.startsWith('elif ')
		) {
			const indentationSize: number =
				baseIndentationSize + (codeLine.match(/^ */) as RegExpMatchArray)[0].length +
					(nestedElifLinesExtraLevels[lineNumber] | 0) * 4;

			const instruction = executionCheckpointInstructions[lineNumber];

			instrumentedCode +=
				`\n${' '.repeat(indentationSize)}${createExecutionCheckpointCall(instruction)}`;
			instrumentedCodeLineCount++;
		}

		if (
			lineNumber in executionCheckpointInstructions &&
			trimmedCodeLine.startsWith('elif ')
		) {
			const indentationSize: number =
				baseIndentationSize + (codeLine.match(/^ */) as RegExpMatchArray)[0].length;
			const elseIndentationSize: number =
				indentationSize + (nestedElifLinesExtraLevels[lineNumber] - 1) * 4;
			const elseBodyIndentationSize: number = elseIndentationSize + 4;

			const instruction = executionCheckpointInstructions[lineNumber];

			instrumentedCode += `\n${' '.repeat(elseIndentationSize)}else:` +
				`\n${' '.repeat(elseBodyIndentationSize)}${createExecutionCheckpointCall(instruction)}` +
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

	instrumentedCode += '    _execution_checkpoint(True, None, locals(), inspect.stack())\n'

	instrumentedCode += basePythonCodeParts[1].trimStart();

	return { instrumentedCode, lineNumberMapping };
}

function createExecutionCheckpointCall(
	instruction: ExecutionCheckpointInstruction
): string {
	return `_execution_checkpoint(${toPythonBoolean(instruction.syncWithController)
		}, (${instruction.lineNumberRange.start}, ${instruction.lineNumberRange.end
		}), locals(), inspect.stack())`;
}

function toPythonBoolean(value: boolean): string {
	return value ? 'True' : 'False';
}
