
import basePythonUrl from '../base.py?url';

export type LineNumberMapping = {
	[instrumentedCodeLineNumber: number]: number
};

export type InstrumentationResult = {
	instrumentedCode: string,
	lineNumberMapping: LineNumberMapping
}

const basePython: Response = await fetch(basePythonUrl);
const basePythonCode: string = await basePython.text();

export function instrumentCode(
	userPythonCode: string,
	sortingListVariableName: string,
	sortingListSourceCodeStart: number,
	sortingListSourceCodeEnd: number
): InstrumentationResult {
	const basePythonCodeParts = basePythonCode.split('#USER_CODE_INSERTION_HANDLE#');

	let instrumentedCode: string =
		basePythonCodeParts[0].trimEnd()
			.replaceAll('SORTING_LIST_VARIABLE_NAME', sortingListVariableName);

	let instrumentedCodeLineNumber = instrumentedCode.split('\n').length;

	const lineNumberMapping: LineNumberMapping = {};

	const modifiedUserPythonCode: string =
		userPythonCode.slice(0, sortingListSourceCodeStart) +
		'enrich_list(' +
		userPythonCode.slice(sortingListSourceCodeStart, sortingListSourceCodeEnd) +
		')' +
		userPythonCode.slice(sortingListSourceCodeEnd);

	const codeLines: string[] = modifiedUserPythonCode.split('\n');

	for (let i = 0 ; i < codeLines.length ; i++) {
		const lineNumber: number = i + 1;
		const codeLine: string = codeLines[i];
		const trimmedCodeLine: string = codeLine.trim();

		if (
			trimmedCodeLine !== '' &&
			!trimmedCodeLine.startsWith('#') &&
			!trimmedCodeLine.startsWith('def ') &&
			!/^else *:/.test(trimmedCodeLine)
		) {
			const indentationSize: number =
				(codeLine.match(/^ */) as RegExpMatchArray)[0].length + 4;
			instrumentedCode +=
				`\n${' '.repeat(indentationSize)}save_execution_checkpoint_and_pause(${lineNumber}, locals())`;
			instrumentedCodeLineNumber++;
		}

		if (trimmedCodeLine.startsWith('if ') || trimmedCodeLine.startsWith('elif ')) {
			let adaptedCodeLine: string = '';

			const handle = ` ${sortingListVariableName}[`;

			let position = 0;
			let handleStartPosition = codeLine.indexOf(handle, position);

			while (handleStartPosition !== -1) {
				const closingBracketPosition = codeLine.indexOf(']', handleStartPosition + handle.length);

				if (closingBracketPosition !== -1) {
					adaptedCodeLine += codeLine.slice(position, closingBracketPosition + 1);
					adaptedCodeLine += '[\'value\']';
					position = closingBracketPosition + 1;
				} else {
					adaptedCodeLine += codeLine.slice(position, handleStartPosition + handle.length);
					position = handleStartPosition + handle.length;
				}

				handleStartPosition = codeLine.indexOf(handle, position);
			}

			adaptedCodeLine += codeLine.slice(position);
			instrumentedCode += `\n    ${adaptedCodeLine}`;
		} else {
			instrumentedCode += `\n    ${codeLine}`;
		}

		instrumentedCodeLineNumber++;
		if (trimmedCodeLine !== '' && !trimmedCodeLine.startsWith('#')) {
			lineNumberMapping[instrumentedCodeLineNumber] = lineNumber;
		}
	}

	if (!instrumentedCode.endsWith('\n')) {
		instrumentedCode += '\n';
	}

	instrumentedCode += '    save_execution_checkpoint_and_pause(-1, locals())\n'

	instrumentedCode += basePythonCodeParts[1].trimStart();

	return { instrumentedCode, lineNumberMapping };
}
