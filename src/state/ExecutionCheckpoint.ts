
import { type LineNumber, type Range } from '../common.ts';

import { type SortingList } from './SortingList.ts';

export default class ExecutionCheckpoint {

	public readonly lineRange: Range<LineNumber> | null = null;
	public readonly scopeLocals: object = {};
	public readonly stackLevel: number = -1;
	public readonly functionIdentifier: string = '';
	public readonly frameIdentifier: string = '';
	public readonly parentFrameIdentifier: string = '';
	public readonly parentCheckpoint: ExecutionCheckpoint | null = null;
	public readonly sortingList: SortingList = [];

	public constructor(dataObject: object, executionHistory: ExecutionHistory) {
		Object.assign(this, dataObject);

		if (executionHistory.length === 0) {
			this.stackLevel = 0;
			this.parentCheckpoint = null;
			return;
		}

		let i: number = executionHistory.length - 1;

		while (i >= 0) {
			if (this.frameIdentifier === executionHistory[i].frameIdentifier) {
				this.stackLevel = executionHistory[i].stackLevel;
				this.parentCheckpoint = executionHistory[i].parentCheckpoint;
				break;
			} else if (this.parentFrameIdentifier === executionHistory[i].frameIdentifier) {
				this.stackLevel = executionHistory[i].stackLevel + 1;
				this.parentCheckpoint = executionHistory[i];
				break;
			}

			i--;
		}
	}

	public squashExecutionStack(): ExecutionStack {
		const seenFunctionIdentifiers: Set<string> = new Set();
		const squashedStack: ExecutionStack = [];

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let frameCheckpoint: ExecutionCheckpoint | null = this;

		while (frameCheckpoint != null) {
			if (!seenFunctionIdentifiers.has(frameCheckpoint.functionIdentifier)) {
				squashedStack.push(frameCheckpoint);
				seenFunctionIdentifiers.add(frameCheckpoint.functionIdentifier);
			}

			frameCheckpoint = frameCheckpoint.parentCheckpoint;
		}

		return squashedStack.reverse();
	}

};

export type ExecutionHistory = ExecutionCheckpoint[];

export type ExecutionStack = ExecutionCheckpoint[];
