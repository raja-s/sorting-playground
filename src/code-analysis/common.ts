
export type TextCoordinates = {
	lineNumber: number,
	columnOffset: number
};

export type AbsolutePositionRange = {
	start: number,
	end: number
};

export type LineNumberRange = {
	start: number,
	end: number
};

export function countOccurrences(matchString: string, text: string): number {
	let count = 0;
	let index = text.indexOf(matchString);

	while (index !== -1) {
		count++;
		index = text.indexOf(matchString, index + matchString.length)
	}

	return count;
}
