
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import { MESSAGE_TYPES, CONTROL_BUFFER_VALUES } from '../pyodide/pyodideExecutionWorkerApi.ts';

import { type CodeAnalysisResult, analyzePythonCode } from '../pyodide/codeAnalysis.ts';

export type SortingElement = {
	identifier: number,
	value: any
};

export type ExecutionCheckpoint = {
	lineNumber: number,
	scopeLocals: object,
	sortingList: SortingElement[]
};

export type ExecutionState = 'stopped' | 'paused' | 'running' | 'finished';

export interface ControlState {
	sortingListVariableName: string;
	sortingListSourceCodeStart: number,
	sortingListSourceCodeEnd: number,
	sortingList: SortingElement[];
	setSortingListData: (
		name: string,
		start: number,
		end: number,
		list: number[]
	) => void;

	pythonExecutionWorkerReady: boolean;
	pythonExecutionWorker: Worker;

	readyToExecuteCode: boolean;

	activePythonCode: string;
	setActivePythonCode: (code: string) => void;

	pythonCodeAnalysisResult: CodeAnalysisResult;

	executionHistory: ExecutionCheckpoint[];
	executionHistoryPosition: number;

	executionSpeed: number;
	setExecutionSpeed: (speed: number) => void;

	executionState: ExecutionState;
	runExecution: () => void;
	pauseExecution: () => void;
	stopExecution: () => void;
	resetExecution: () => void;

	stepBackward: () => void;
	stepForward: () => void;

	barsColored: boolean;
	toggleBarsColored: () => void;

	focusComparedBars: boolean;
	toggleFocusComparedBars: () => void;
}

type GetState = () => ControlState;

type SetState = (
	nextStateOrUpdater:
		Partial<ControlState> |
		((state: ControlState) => Partial<ControlState>)
) => void;

const controlBuffer: Int32Array = new Int32Array(new SharedArrayBuffer(4));
const dataBuffer: Uint8Array = new Uint8Array(new SharedArrayBuffer(4096));

let resumeExecutionTimeoutIdentifier: number = -1;

export const useControlStore =
	create(
		subscribeWithSelector<ControlState>((setState: SetState, getState: GetState) => ({
			sortingListVariableName: '',
			sortingListSourceCodeStart: -1,
			sortingListSourceCodeEnd: -1,
			sortingList: [],

			setSortingListData: (
				name: string,
				start: number,
				end: number,
				list: number[]
			) => {
				setState({
					sortingListVariableName: name,
					sortingListSourceCodeStart: start,
					sortingListSourceCodeEnd: end,
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
			setActivePythonCode: (code: string) => { setState({ activePythonCode: code }); },

			pythonCodeAnalysisResult: {
				trackedVariableMap: {},
				comparisonMap: {}
			},

			executionHistory: [],
			executionHistoryPosition: 0,

			executionSpeed: 6,
			setExecutionSpeed: (speed: number) => { setState({ executionSpeed: speed }); },

			executionState: 'stopped',
			runExecution: () => { runExecution(getState, setState); },
			pauseExecution: () => { pauseExecution(setState); },
			stopExecution: () => { stopExecution(setState); },
			resetExecution: () => { resetExecution(setState); },

			stepBackward: () => { stepBackward(setState); },
			stepForward: () => { stepForward(getState, setState); },

			barsColored: true,
			toggleBarsColored: () => {
				setState((state: ControlState) => ({ barsColored: !state.barsColored }));
			},

			focusComparedBars: true,
			toggleFocusComparedBars: () => {
				setState((state: ControlState) => ({ focusComparedBars: !state.focusComparedBars }));
			}
		}))
	);

function reassessReadyToExecuteCode(setState: SetState): void {
	setState((state: ControlState) => ({
		readyToExecuteCode:
			state.sortingListVariableName !== '' &&
			state.sortingListSourceCodeStart !== -1 &&
			state.sortingListSourceCodeEnd !== -1 &&
			state.pythonExecutionWorkerReady
	}));
}

function delayForExecutionSpeed(speed: number): number {
	switch (speed) {
		case 10: return    50;
		case  9: return   150;
		case  8: return   500;
		case  7: return  1000;
		case  6: return  3000;
		case  5: return  5000;
		case  4: return 10000;
		case  3: return 15000;
		case  2: return 30000;
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
				handleStandardOutput(event.data.output);
				break;
			case MESSAGE_TYPES.errorOutput:
				handleErrorOutput(event.data.output);
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

function handleStandardOutput(output: string) {
	console.log(output);
}

function handleErrorOutput(output: string) {
	console.error(output);
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

	setState((state: ControlState) => ({
		executionHistory: state.executionHistory.concat([ checkpoint ]),
		executionHistoryPosition: state.executionHistoryPosition + 1
	}));

	if (getState().executionState === 'running') {
		resumeAfterDelay(getState, setState);
	}
}

function handleExecutionWaitingForInput(): void {
	const input: string = prompt('Input:') || '';

	const encoder: TextEncoder = new TextEncoder();
	const encodedData: Uint8Array = encoder.encode(input);

	dataBuffer.set(encodedData);

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.dataAvailable);
	Atomics.notify(controlBuffer, 0);
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
	setState((state: ControlState) => ({
		pythonCodeAnalysisResult: analyzePythonCode(
			state.activePythonCode,
			state.sortingListVariableName
		)
	}));

	const state: ControlState = getState();

	state.pythonExecutionWorker.postMessage({
		type: MESSAGE_TYPES.executePythonCode,
		controlBuffer,
		dataBuffer,
		pythonCode: state.activePythonCode,
		sortingListVariableName: state.sortingListVariableName,
		sortingListSourceCodeStart: state.sortingListSourceCodeStart,
		sortingListSourceCodeEnd: state.sortingListSourceCodeEnd
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
		setState((state: ControlState) => ({
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

	Atomics.store(controlBuffer, 0, CONTROL_BUFFER_VALUES.stopExecution);
	Atomics.notify(controlBuffer, 0);
}

function resetExecution(setState: SetState): void {
	clearTimeout(resumeExecutionTimeoutIdentifier);

	setState({
		executionHistory: [],
		executionHistoryPosition: 0,
		executionState: 'stopped'
	});
}

function stepBackward(setState: SetState): void {
	setState((state: ControlState) => ({
		executionHistoryPosition: state.executionHistoryPosition - 1
	}));
}

function stepForward(getState: GetState, setState: SetState): void {
	const state: ExecutionState = getState().executionState;

	setState((state: ControlState) => ({
		executionState: state.executionState === 'stopped' ?
			'paused' : state.executionState
	}));

	if (state === 'stopped') {
		startExecution(getState, setState);
	} else if (state === 'paused' || state === 'finished') {
		resumeExecution(getState, setState);
	}
}
