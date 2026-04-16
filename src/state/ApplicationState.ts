
import { type CodeAnalysisResult } from '../pyodide/code-analysis/codeAnalysis.ts';

import { type ConsoleContent } from './useApplicationStore.ts';
import { type ExecutionHistory } from './ExecutionCheckpoint.ts';
import { type SortingList } from './SortingList.ts';

export type ExecutionState = 'stopped' | 'paused' | 'running' | 'finished';

export default interface ApplicationState {
	sortingListVariableName: string;
	sortingList: SortingList;
	setSortingListData: (name: string, list: unknown[]) => void;

	pythonExecutionWorkerReady: boolean;
	pythonExecutionWorker: Worker;

	readyToExecuteCode: boolean;

	activePythonCode: string;
	annotatedActivePythonCode: string;
	setActivePythonCode: (code: string) => void;

	editorReloadCodeTriggerValue: number;
	bumpEditorReloadCodeTriggerValue: () => void;

	consoleContent: ConsoleContent[];
	appendToConsole: (content: ConsoleContent) => void;

	pythonCodeAnalysisResult: CodeAnalysisResult;

	executionHistory: ExecutionHistory;
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

	generateShareLink: () => string;
}
