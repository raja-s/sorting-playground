
import { type PyodideInterface, loadPyodide } from 'pyodide';

import pyodidePackage from 'pyodide/package.json';

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

	Atomics.store(interruptBuffer, 0, INTERRUPT_BUFFER_VALUES.continue);

	pyodide.setInterruptBuffer(interruptBuffer);

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

//	console.log(payload.instrumentedCode);

	const isolatedNamespace = pyodide.globals.get("dict")();

	try {
		await pyodide.runPythonAsync(payload.instrumentedCode, { globals: isolatedNamespace });
	} catch (error: Error) {
		self.postMessage({ type: MESSAGE_TYPES.errorOutput, output: error.message });
	} finally {
		isolatedNamespace.destroy();
	}

	const controlBufferValue: number = Atomics.load(controlBuffer, 0);
	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
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

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset the control buffer
	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);
	const controlBufferValue: number = Atomics.load(controlBuffer, 0);

	pyodide.FS.unlink(CHECKPOINT_FILE_PATH);

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		return '';
	}

	return '';
}

function takeInputForPython(
	controlBuffer: Int32Array,
	dataBuffer: Uint8Array
): string {
	self.postMessage({ type: MESSAGE_TYPES.waitingForInput });

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData); // Reset the control buffer
	Atomics.wait(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);
	const controlBufferValue: number = Atomics.load(controlBuffer, 0);

	if (controlBufferValue === CONTROL_BUFFER_VALUES.stopExecution) {
		return '';
	}

	const decoder: TextDecoder = new TextDecoder();
	return decoder.decode(Uint8Array.from(dataBuffer)).replace(/\0/g, '');
}
