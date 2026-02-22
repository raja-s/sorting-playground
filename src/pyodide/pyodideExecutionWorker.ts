
import { type PyodideInterface, loadPyodide } from 'pyodide';

import pyodidePackage from 'pyodide/package.json';

import { MESSAGE_TYPES, CONTROL_BUFFER_VALUES } from './pyodideExecutionWorkerApi.ts';

import basePythonUrl from './base.py?url';

const EXECUTION_CONTROL_DIRECTORY_PATH: string = '/execution-control';
const CHECKPOINT_FILE_PATH: string = `${EXECUTION_CONTROL_DIRECTORY_PATH}/checkpoint.json`;

const pyodideVersion = pyodidePackage.version;
const pyodideUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

const pyodide: PyodideInterface = await initializePyodide();

console.log('Pyodide ready 🔥');

self.postMessage({ type: MESSAGE_TYPES.environmentInitialized });

const basePython: Response = await fetch(basePythonUrl);
const basePythonCode: string = await basePython.text();

self.onmessage = async (event) => {
	switch (event.data.type) {
		case MESSAGE_TYPES.executePythonCode:
			await executePythonCode(event.data);
			break;
	}
};

async function initializePyodide(): Promise<PyodideInterface> {
	const pyodide: PyodideInterface =
		await loadPyodide({ indexURL: pyodideUrl });

	pyodide.FS.mkdir(EXECUTION_CONTROL_DIRECTORY_PATH);

	return pyodide;
}

async function executePythonCode(payload): Promise<void> {
	const controlBuffer: Int32Array = payload.controlBuffer;
	const dataBuffer: Uint8Array = payload.dataBuffer;

	pyodide.setStdin({
		stdin: () => handlePythonInput(controlBuffer, dataBuffer)
	});

	pyodide.setStdout({
		batched: output => {
			self.postMessage({ type: MESSAGE_TYPES.standardOutput, output });
		}
	});

	pyodide.setStderr({
		batched: output => {
			self.postMessage({ type: MESSAGE_TYPES.errorOutput, output });
		}
	});

	const instrumentedCode: string = instrumentCode(payload);

//	console.log(instrumentedCode);

	const isolatedNamespace = pyodide.globals.get("dict")();

	let executionStopped: boolean = false;

	try {
		await pyodide.runPythonAsync(instrumentedCode, { globals: isolatedNamespace });
	} catch (error: Error) {
		executionStopped =
			error.message.includes('line 35, in save_execution_checkpoint_and_pause') &&
			error.message.includes('I/O error');
	} finally {
		isolatedNamespace.destroy();
	}

	if (executionStopped) {
		return;
	}

	self.postMessage({ type: MESSAGE_TYPES.executionFinished });
}

function handlePythonInput(
	controlBuffer: Int32Array,
	dataBuffer: Uint8Array
): string {
	const fileInfo = pyodide.FS.analyzePath(CHECKPOINT_FILE_PATH);

	if (fileInfo.exists) {
		return sendCheckpointAndPauseExecution(controlBuffer);
	} else {
		return takeInputForPython(controlBuffer, dataBuffer);
	}
}

function sendCheckpointAndPauseExecution(
	controlBuffer: Int32Array
): string {
	const checkpoint = JSON.parse(pyodide.FS.readFile(CHECKPOINT_FILE_PATH, { encoding: 'utf8' }));

	self.postMessage({
		type: MESSAGE_TYPES.executionCheckpoint,
		checkpoint
	});

	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);
	const controlBufferValue: number = Atomics.load(controlBuffer, 0);
	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset it for next time...

	pyodide.FS.unlink(CHECKPOINT_FILE_PATH);

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		throw new Error('Execution stopped.');
	}

	return '';
}

function takeInputForPython(
	controlBuffer: Int32Array,
	dataBuffer: Uint8Array
): string {
	self.postMessage({ type: MESSAGE_TYPES.waitingForInput });

	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);
	const controlBufferValue: number = Atomics.load(controlBuffer, 0);
	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset it for next time...

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		throw new Error('Execution stopped.');
	}

	const decoder: TextDecoder = new TextDecoder();
	return decoder.decode(Uint8Array.from(dataBuffer)).replace(/\0/g, '');
}

function instrumentCode(payload): string {
	let instrumentedCode: string =
		basePythonCode.replaceAll('SORTING_LIST_VARIABLE_NAME', payload.sortingListVariableName);

	const userPythonCode: string =
		payload.pythonCode.slice(0, payload.sortingListSourceCodeStart) +
		'enrich_list(' +
		payload.pythonCode.slice(payload.sortingListSourceCodeStart, payload.sortingListSourceCodeEnd) +
		')' +
		payload.pythonCode.slice(payload.sortingListSourceCodeEnd);

	const codeLines: string[] = userPythonCode.split('\n');

	for (let i = 0 ; i < codeLines.length ; i++) {
		const codeLine: string = codeLines[i];
		const trimmedCodeLine: string = codeLine.trim();

		if (
			trimmedCodeLine !== '' &&
			!trimmedCodeLine.startsWith('#') &&
			!trimmedCodeLine.startsWith('def ') &&
			!/^else *:/.test(trimmedCodeLine)
		) {
			const indentationSize: number =
				(codeLine.match(/^ */) as RegExpMatchArray)[0].length;
			instrumentedCode +=
				`\n${' '.repeat(indentationSize)}save_execution_checkpoint_and_pause(${i + 1}, locals())`;
		}

		if (trimmedCodeLine.startsWith('if ') || trimmedCodeLine.startsWith('elif ')) {
			let adaptedCodeLine: string = '';

			const handle = ` ${payload.sortingListVariableName}[`;

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
			instrumentedCode += `\n${adaptedCodeLine}`;
		} else {
			instrumentedCode += `\n${codeLine}`;
		}
	}

	if (!instrumentedCode.endsWith('\n')) {
		instrumentedCode += '\n';
	}

	instrumentedCode += 'save_execution_checkpoint_and_pause(-1, locals())\n'

	return instrumentedCode;
}
