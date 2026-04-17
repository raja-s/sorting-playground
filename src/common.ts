
export type AbsolutePosition = number;
export type LineNumber = number;
export type ColumnOffset = number;

export type TextCoordinates = {
	lineNumber: LineNumber,
	columnOffset: ColumnOffset
};

export type Range<T> = {
	start: T,
	end: T
};
