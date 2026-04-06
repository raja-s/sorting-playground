
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import { URL_FRAGMENT_STATE_VARIABLE_NAME, compressDataIntoUrl, urlStorage } from './urlStorage.ts';

import {
	MESSAGE_TYPES,
	CONTROL_BUFFER_VALUES,
	INTERRUPT_BUFFER_VALUES
} from '../pyodide/pyodideExecutionWorkerApi.ts';

import SimulationAnnotation from '../pyodide/code-analysis/SimulationAnnotation.ts';
import { analyzePythonCode } from '../pyodide/code-analysis/codeAnalysis.ts';

import type ApplicationState from './ApplicationState.ts';
import { type ExecutionState } from './ApplicationState.ts';
import { type ExecutionCheckpoint } from './ExecutionCheckpoint.ts';

export type ConsoleContentType = 'standard_output' | 'error';

export type ConsoleContent = {
	text: string,
	type: ConsoleContentType
};

type GetState = () => ApplicationState;

type SetState = (
	nextStateOrUpdater:
		Partial<ApplicationState> |
		((state: ApplicationState) => Partial<ApplicationState>)
) => void;

const controlBuffer: Int32Array = new Int32Array(new SharedArrayBuffer(4));
const dataBuffer: Uint8Array = new Uint8Array(new SharedArrayBuffer(4096));
const interruptBuffer: Uint8Array = new Uint8Array(new SharedArrayBuffer(1));

let resumeExecutionTimeoutIdentifier: number = -1;

export const useApplicationStore =
	create<ApplicationState>()(
		subscribeWithSelector(
			persist(
				(setState: SetState, getState: GetState) => ({
					sortingListVariableName: '',
					sortingList: [],

					setSortingListData: (name: string, list: number[]) => {
						setState({
							sortingListVariableName: name,
							sortingList: list.map((value, index) => ({
								identifier: index,
								value
							}))
						});
						reassessReadyToExecuteCode(setState);
					},

					pythonExecutionWorkerReady: false,
					pythonExecutionWorker: initializePythonExecutionWorker(getState, setState),

					readyToExecuteCode: false,

					activePythonCode: '',
					annotatedActivePythonCode: '',
					setActivePythonCode: (code: string) => { setState({ activePythonCode: code }); },

					editorReloadCodeTriggerValue: 0,
					bumpEditorReloadCodeTriggerValue: () => {
						setState((state: ApplicationState) => ({
							editorReloadCodeTriggerValue: state.editorReloadCodeTriggerValue + 1
						}));
					},

					consoleContent: [],
					appendToConsole: (content: ConsoleContent) => {
						setState((state: ApplicationState) => ({
							consoleContent: state.consoleContent.concat([ content ])
						}));
					},

					pythonCodeAnalysisResult: {
						trackedVariableMap: {},
						visualizedVariableMap: {},
						visualizedVariablesConfiguration: {
							variableCount: 0,
							levelDistribution: {}
						},
						comparisonMap: {},
						instrumentationResult: {
							instrumentedCode: '',
							lineNumberMapping: {}
						}
					},

					executionHistory: [],
					executionHistoryPosition: 0,

					executionSpeed: 5,
					setExecutionSpeed: (speed: number) => {
						setExecutionSpeed(speed, getState, setState);
					},

					executionState: 'stopped',
					runExecution: () => { runExecution(getState, setState); },
					pauseExecution: () => { pauseExecution(setState); },
					stopExecution: () => { stopExecution(setState); },
					resetExecution: () => { resetExecution(setState); },

					stepBackward: () => { stepBackward(setState); },
					stepForward: () => { stepForward(getState, setState); },

					barsColored: true,
					toggleBarsColored: () => {
						setState((state: ApplicationState) => ({ barsColored: !state.barsColored }));
					},

					focusComparedBars: true,
					toggleFocusComparedBars: () => {
						setState((state: ApplicationState) => ({ focusComparedBars: !state.focusComparedBars }));
					},

					generateShareLink: () => {
						const state: ApplicationState = getState();

						const dataToCompress: Partial<ApplicationState> = {
							sortingListVariableName: state.sortingListVariableName,
							sortingList:             state.sortingList,
							activePythonCode:        state.activePythonCode,
							executionSpeed:          state.executionSpeed,
							barsColored:             state.barsColored,
							focusComparedBars:       state.focusComparedBars
						};

						const persistentWrapper = {
							state: dataToCompress,
							version: 0
						};

						return compressDataIntoUrl(JSON.stringify(persistentWrapper));
					}
				}),
				{
					name: URL_FRAGMENT_STATE_VARIABLE_NAME,
					storage: createJSONStorage(() => urlStorage),

					partialize: (state: ApplicationState): Partial<ApplicationState> => ({
						sortingListVariableName: state.sortingListVariableName,
						sortingList:             state.sortingList,
						activePythonCode:        state.activePythonCode,
						executionSpeed:          state.executionSpeed,
						barsColored:             state.barsColored,
						focusComparedBars:       state.focusComparedBars
					})
				}
			)
		)
	);

if (useApplicationStore.persist.hasHydrated()) {
	handleHydrationFromUrlComplete(useApplicationStore.getState());
} else {
	useApplicationStore.persist.onFinishHydration((state: ApplicationState) => {
		handleHydrationFromUrlComplete(state);
	});
}

function handleHydrationFromUrlComplete(state: ApplicationState): void {
	state.bumpEditorReloadCodeTriggerValue();
}

function reassessReadyToExecuteCode(setState: SetState): void {
	setState((state: ApplicationState) => ({
		readyToExecuteCode:
			state.sortingListVariableName !== '' &&
			state.pythonExecutionWorkerReady
	}));
}

function delayForExecutionSpeed(speed: number): number {
	switch (speed) {
		case 10: return    25;
		case  9: return    50;
		case  8: return   150;
		case  7: return   500;
		case  6: return  1000;
		case  5: return  3000;
		case  4: return  5000;
		case  3: return  8000;
		case  2: return 20000;
		case  1: return 60000;
		default: return  3000;
	}
}

function initializePythonExecutionWorker(
	getState: GetState,
	setState: SetState
): Worker {
	const pythonExecutionWorker: Worker = new Worker(
		new URL('../pyodide/pyodideExecutionWorker.ts', import.meta.url),
		{ type: 'module' }
	);

	pythonExecutionWorker.onmessage = event => {
		switch (event.data.type) {
			case MESSAGE_TYPES.environmentInitialized:
				handleEnvironmentInitialized(setState);
				break;
			case MESSAGE_TYPES.standardOutput:
				handleStandardOutput(getState, event.data.output);
				break;
			case MESSAGE_TYPES.errorOutput:
				handleErrorOutput(getState, event.data.output);
				break;
			case MESSAGE_TYPES.executionFinished:
				handleExecutionFinished(setState);
				break;
			case MESSAGE_TYPES.executionCheckpoint:
				handleExecutionCheckpoint(
					event.data.checkpoint,
					getState,
					setState
				);
				break;
			case MESSAGE_TYPES.waitingForInput:
				handleExecutionWaitingForInput();
				break;
		}
	};

	return pythonExecutionWorker;
}

function handleEnvironmentInitialized(setState: SetState) {
	setState({ pythonExecutionWorkerReady: true });
	reassessReadyToExecuteCode(setState);
}

function handleStandardOutput(getState: GetState, output: string) {
	getState().appendToConsole({
		text: output,
		type: 'standard_output'
	});
}

function handleErrorOutput(getState: GetState, output: string) {
	getState().appendToConsole({
		text: output,
		type: 'error'
	});
}

function handleExecutionFinished(setState: SetState) {
	setState({ executionState: 'finished' });
}

function handleExecutionCheckpoint(
	checkpoint: ExecutionCheckpoint,
	getState: GetState,
	setState: SetState
): void {
	if (getState().executionState === 'stopped') {
		return;
	}

	setState((state: ApplicationState) => {
		if (state.executionHistory.length === 0) {
			checkpoint.stackLevel = 0;
			checkpoint.parentCheckpoint = null;
		} else {
			let i: number = state.executionHistory.length - 1;

			while (i >= 0) {
				if (checkpoint.frameIdentifier === state.executionHistory[i].frameIdentifier) {
					checkpoint.stackLevel = state.executionHistory[i].stackLevel;
					checkpoint.parentCheckpoint = state.executionHistory[i].parentCheckpoint;
					break;
				} else if (checkpoint.parentFrameIdentifier === state.executionHistory[i].frameIdentifier) {
					checkpoint.stackLevel = state.executionHistory[i].stackLevel + 1;
					checkpoint.parentCheckpoint = state.executionHistory[i];
					break;
				}

				i--;
			}
		}

		return {
			executionHistory: state.executionHistory.concat([ checkpoint ]),
			executionHistoryPosition: state.executionHistoryPosition + 1
		};
	});

	if (getState().executionState === 'running') {
		resumeAfterDelay(getState, setState);
	}
}

function handleExecutionWaitingForInput(): void {
	const input: string = prompt('Input:') || '';

	const encoder: TextEncoder = new TextEncoder();
	const encodedData: Uint8Array = encoder.encode(input);

	dataBuffer.fill(0);
	dataBuffer.set(encodedData);

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.dataAvailable);
	Atomics.notify(controlBuffer, 0);
}

function setExecutionSpeed(speed: number, getState: GetState, setState: SetState): void {
	setState({ executionSpeed: speed });

	if (getState().executionState !== 'running') {
		return;
	}

	clearTimeout(resumeExecutionTimeoutIdentifier);
	resumeAfterDelay(getState, setState);
}

function runExecution(getState: GetState, setState: SetState): void {
	const state: ExecutionState = getState().executionState;

	setState({ executionState: 'running' });

	if (state === 'stopped') {
		startExecution(getState, setState);
	} else if (state === 'paused' || state === 'finished') {
		resumeExecution(getState, setState);
	}
}

function startExecution(getState: GetState, setState: SetState): void {
	try {
		setState((state: ApplicationState) => ({
			annotatedActivePythonCode: state.activePythonCode,
			pythonCodeAnalysisResult: analyzePythonCode(
				state.activePythonCode,
				state.sortingListVariableName
			)
		}));
	} catch (error) {
		console.error(error);
		setState({
			consoleContent: [{
				text: error.message,
				type: 'error'
			}],
			executionState: 'finished'
		});
		return;
	}

	getState().setActivePythonCode(
		SimulationAnnotation.stripAll(getState().activePythonCode));
	getState().bumpEditorReloadCodeTriggerValue();

	Atomics.store(interruptBuffer, 0, INTERRUPT_BUFFER_VALUES.continue);
	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.waitingForData);

	const state: ApplicationState = getState();

	state.pythonExecutionWorker.postMessage({
		type: MESSAGE_TYPES.executePythonCode,
		controlBuffer,
		dataBuffer,
		interruptBuffer,
		instrumentedCode: state.pythonCodeAnalysisResult.instrumentationResult.instrumentedCode
	});
}

function resumeAfterDelay(getState: GetState, setState: SetState): void {
	resumeExecutionTimeoutIdentifier = setTimeout(() => {
		resumeExecution(getState, setState);
	}, delayForExecutionSpeed(getState().executionSpeed));
}

function resumeExecution(getState: GetState, setState: SetState): void {
	if (getState().executionHistoryPosition === getState().executionHistory.length) {
		Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.dataAvailable);
		Atomics.notify(controlBuffer, 0);
	} else {
		setState((state: ApplicationState) => ({
			executionHistoryPosition: state.executionHistoryPosition + 1
		}));

		if (getState().executionState === 'running') {
			resumeAfterDelay(getState, setState);
		}
	}
}

function pauseExecution(setState: SetState): void {
	clearTimeout(resumeExecutionTimeoutIdentifier);
	setState({ executionState: 'paused' });
}

function stopExecution(setState: SetState): void {
	resetExecution(setState);

	Atomics.store(interruptBuffer, 0, INTERRUPT_BUFFER_VALUES.interrupt);

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.stopExecution);
	Atomics.notify(controlBuffer, 0);
}

function resetExecution(setState: SetState): void {
	clearTimeout(resumeExecutionTimeoutIdentifier);

	setState((state: ApplicationState) => ({
		activePythonCode: state.annotatedActivePythonCode,
		consoleContent: [],
		executionHistory: [],
		executionHistoryPosition: 0,
		executionState: 'stopped'
	}));
}

function stepBackward(setState: SetState): void {
	setState((state: ApplicationState) => ({
		executionHistoryPosition: state.executionHistoryPosition - 1
	}));
}

function stepForward(getState: GetState, setState: SetState): void {
	const state: ExecutionState = getState().executionState;

	setState((state: ApplicationState) => ({
		executionState: state.executionState === 'stopped' ?
			'paused' : state.executionState
	}));

	if (state === 'stopped') {
		startExecution(getState, setState);
	} else if (state === 'paused' || state === 'finished') {
		resumeExecution(getState, setState);
	}
}
