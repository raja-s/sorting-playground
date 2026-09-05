
import { type PyodideInterface, loadPyodide } from 'pyodide';

import pyodidePackage from 'pyodide/package.json';

import { type InstrumentationResult } from '../code-analysis/instrumentation.ts';

import {
	MESSAGE_TYPES,
	CONTROL_BUFFER_VALUES,
	INTERRUPT_BUFFER_VALUES
} from './pyodideExecutionWorkerApi.ts';

const EXECUTION_CONTROL_DIRECTORY_PATH: string = '/execution-control';
const CHECKPOINT_FILE_PATH: string = `${EXECUTION_CONTROL_DIRECTORY_PATH}/checkpoint.json`;

const pyodideVersion = pyodidePackage.version;
const pyodideUrl = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

const pyodide: PyodideInterface = await initializePyodide();

console.log('Pyodide ready 🔥');

self.postMessage({ type: MESSAGE_TYPES.environmentInitialized });

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
	const interruptBuffer: Uint8Array = payload.interruptBuffer;

	const outputDecoder = new TextDecoder('utf-8');

	Atomics.store(interruptBuffer, 0, INTERRUPT_BUFFER_VALUES.continue);

	pyodide.setInterruptBuffer(interruptBuffer);

	pyodide.setStdin({
		stdin: () => handlePythonInput(controlBuffer, dataBuffer)
	});

	pyodide.setStdout({
		write: buffer => {
			const output = outputDecoder.decode(buffer, { stream: true });
			self.postMessage({ type: MESSAGE_TYPES.standardOutput, output });
			return buffer.length;
		}
	});

	pyodide.setStderr({
		batched: output => {
			self.postMessage({
				type: MESSAGE_TYPES.errorOutput,
				output: cleanUpError(output, payload.instrumentationResult)
			});
		}
	});

	self.processCheckpoint = () => {
		sendCheckpointAndPauseExecution(controlBuffer);
	};

	self.setIncomingInputPrompt = (prompt: string) => {
		self.postMessage({ type: MESSAGE_TYPES.incomingInputPrompt, prompt });
	};

	const isolatedNamespace = pyodide.globals.get("dict")();

	try {
		await pyodide.runPythonAsync(
			payload.instrumentationResult.instrumentedCode,
			{ globals: isolatedNamespace }
		);
	} catch (error: Error) {
		self.postMessage({
			type: MESSAGE_TYPES.errorOutput,
			output: cleanUpError(error.message, payload.instrumentationResult)
		});
	} finally {
		isolatedNamespace.destroy();
	}

	const controlBufferValue: number = Atomics.load(controlBuffer, 0);
	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		return;
	}

	self.postMessage({ type: MESSAGE_TYPES.executionFinished });
}

function sendCheckpointAndPauseExecution(controlBuffer: Int32Array): void {
	const checkpoint: object =
		JSON.parse(pyodide.FS.readFile(CHECKPOINT_FILE_PATH, { encoding: 'utf8' }));

	self.postMessage({
		type: MESSAGE_TYPES.executionCheckpoint,
		checkpoint
	});

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset the control buffer
	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);

	pyodide.FS.unlink(CHECKPOINT_FILE_PATH);
}

function handlePythonInput(
	controlBuffer: Int32Array,
	dataBuffer: Uint8Array
): string {
	let controlBufferValue: number = Atomics.load(controlBuffer, 0);

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		return '';
	}

	self.postMessage({ type: MESSAGE_TYPES.waitingForInput });

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset the control buffer
	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);
	controlBufferValue = Atomics.load(controlBuffer, 0);

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		return '';
	}

	const decoder: TextDecoder = new TextDecoder();
	return decoder.decode(Uint8Array.from(dataBuffer)).replace(/\0/g, '');
}

function cleanUpError(
	text: string,
	instrumentationResult: InstrumentationResult
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
				mapLineNumber(line, instrumentationResult)
		);
	}

	return cleanedUpErrorTextLines.join('\n');
}

function mapLineNumber(
	line: string,
	instrumentationResult: InstrumentationResult
): string {
	const regex: RegExp = /(File "<exec>", line )(\d+)/;
	const matches: RegExpExecArray | null = regex.exec(line);

	if (matches == null) {
		return line;
	}

	const lineNumber: number = parseInt(matches[2]);

	const correctedLineNumber: number =
		instrumentationResult.lineNumberMapping[lineNumber];

	return line.replace(regex, `$1${correctedLineNumber}`);
}
