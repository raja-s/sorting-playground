
export const MESSAGE_TYPES = {
	// For messages to the worker
	executePythonCode: 'EXECUTE_PYTHON_CODE',
	// For messages from the worker
	environmentInitialized: 'ENVIRONMENT_INITIALIZED',
	standardOutput: 'STDOUT',
	incomingInputPrompt: 'INCOMING_INPUT_PROMPT',
	waitingForInput: 'WAITING_FOR_INPUT',
	errorOutput: 'STDERR',
	executionFinished: 'EXECUTION_FINISHED',
	executionCheckpoint: 'EXECUTION_CHECKPOINT'
};

export const CONTROL_BUFFER_VALUES = {
	stopExecution: -1,
	waitingForData: 0,
	dataAvailable: 1
}

export const INTERRUPT_BUFFER_VALUES = {
	continue: 0,
	interrupt: 2
}
