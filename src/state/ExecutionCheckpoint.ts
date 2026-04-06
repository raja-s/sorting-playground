
import { type SortingList } from './SortingList.ts';

export type ExecutionCheckpoint = {
	startLineNumber: number,
	endLineNumber: number,
	scopeLocals: object,
	stackLevel: number,
	frameIdentifier: string,
	parentFrameIdentifier: string,
	parentCheckpoint: ExecutionCheckpoint | null,
	sortingList: SortingList
};

export type ExecutionHistory = ExecutionCheckpoint[];
