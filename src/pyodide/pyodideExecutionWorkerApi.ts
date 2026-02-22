
export const MESSAGE_TYPES = {
	// For messages to the worker
	executePythonCode: 'EXECUTE_PYTHON_CODE',
	// For messages from the worker
	environmentInitialized: 'ENVIRONMENT_INITIALIZED',
	standardOutput: 'STDOUT',
	errorOutput: 'STDERR',
	executionFinished: 'EXECUTION_FINISHED',
	executionCheckpoint: 'EXECUTION_CHECKPOINT',
	waitingForInput: 'WAITING_FOR_INPUT'
};

export const CONTROL_BUFFER_VALUES = {
	stopExecution: -1,
	waitingForData: 0,
	dataAvailable: 1
}
