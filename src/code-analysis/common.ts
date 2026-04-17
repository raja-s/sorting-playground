
export function countOccurrences(matchString: string, text: string): number {
	let count = 0;
	let index = text.indexOf(matchString);

	while (index !== -1) {
		count++;
		index = text.indexOf(matchString, index + matchString.length)
	}

	return count;
}
