
import { type LineNumber, type Range } from '../common.ts';
import { type Functions } from '../code-analysis/codeAnalysis.ts';

import { type SortingList } from './SortingList.ts';

export default class ExecutionCheckpoint {

	public readonly lineRange: Range<LineNumber> | null = null;
	public readonly scopeLocals: { [variableName: string]: unknown } = {};
	public readonly stackLevel: number = -1;
	public readonly functionIdentifier: string = '';
	public readonly frameIdentifier: string = '';
	public readonly parentFrameIdentifier: string = '';
	public readonly parentCheckpoint: ExecutionCheckpoint | null = null;
	public readonly sortingList: SortingList = [];
	public readonly sortingElementLevels: number[] = [];

	public constructor(
		dataObject: object,
		executionHistory: ExecutionHistory,
		functions: Functions
	) {
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

		if (this.sortingList == null) {
			return;
		}

		this.sortingElementLevels = this.parentCheckpoint == null ?
			Array(this.sortingList.length).fill(0) :
			this.parentCheckpoint.sortingElementLevels.slice();

		if (
			!(this.functionIdentifier in functions) ||
			functions[this.functionIdentifier].divideRanges.length === 0
		) {
			return;
		}

		for (const range of functions[this.functionIdentifier].divideRanges) {
			const startValue: unknown = this.scopeLocals[range.start];
			const endValue: unknown = this.scopeLocals[range.end];

			if (!Number.isInteger(startValue) || !Number.isInteger(endValue)) {
				continue;
			}

			const start: number = Math.max(startValue as number, 0);
			const end: number = Math.min(endValue as number, this.sortingList.length - 1);

			for (let i = start ; i <= end ; i++) {
				this.sortingElementLevels[i]--;
			}
		}

		for (let i = 0 ; i < this.sortingElementLevels.length ; i++) {
			this.sortingElementLevels[i]++;
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
