
export type Sorter<T> = Generator<T[], T[], void>;

export type SorterCreator<T> = (
	elements: T[],
	getRank: (element: T) => number
) => Sorter<T>;

function exchange<T>(elements: T[], i: number, j: number): void {
	[ elements[i], elements[j] ] = [ elements[j], elements[i] ];
}

function reinsert<T>(elements: T[], i: number, j: number): void {
	elements.splice(j, 0, elements.splice(i, 1)[0]);
}

export function* createBubbleSorter<T>(
	elements: T[],
	getRank: (element: T) => number
): Sorter<T> {
	const n = elements.length;
	const sortingArray = [ ...elements ];

	for (let i = n - 1 ; i > 0 ; i--) {
		for (let j = 0 ; j < i ; j++) {
			if (getRank(sortingArray[j + 1]) < getRank(sortingArray[j])) {
				exchange(sortingArray, j, j + 1);
				yield sortingArray;
			}
		}
	}

	return sortingArray;
}

export function* createSelectionSorter<T>(
	elements: T[],
	getRank: (element: T) => number
): Sorter<T> {
	const n = elements.length;
	const sortingArray = [ ...elements ];

	for (let i = 0 ; i < n - 1 ; i++) {
		let minimumIndex = i;
		for (let j = i + 1 ; j < n ; j++) {
			if (getRank(sortingArray[j]) < getRank(sortingArray[minimumIndex])) {
				minimumIndex = j;
			}
		}
		if (minimumIndex !== i) {
			exchange(sortingArray, i, minimumIndex);
			yield sortingArray;
		}
	}

	return sortingArray;
}

export function* createInsertionSorter<T>(
	elements: T[],
	getRank: (element: T) => number
): Sorter<T> {
	const n = elements.length;
	const sortingArray = [ ...elements ];

	for (let i = 1 ; i < n ; i++) {
		let insertionIndex = i;
		for (let j = i - 1 ; j >= 0 ; j--) {
			if (getRank(sortingArray[j]) > getRank(sortingArray[i])) {
				insertionIndex = j;
			} else {
				break;
			}
		}
		if (insertionIndex !== i) {
			reinsert(sortingArray, i, insertionIndex);
			yield sortingArray;
		}
	}

	return sortingArray;
}

export function* createQuickSorter<T>(
	elements: T[],
	getRank: (element: T) => number
): Sorter<T> {
	const n = elements.length;
	const sortingArray = [ ...elements ];

	function* partition(
		start: number,
		end: number
	): Generator<T[], number, void> {
		let pivotIndex = start;
		for (let j = start ; j < end ; j++) {
			if (getRank(sortingArray[j]) <= getRank(sortingArray[end])) {
				if (pivotIndex !== j) {
					exchange(sortingArray, pivotIndex, j);
					yield sortingArray;
				}
				pivotIndex++;
			}
		}
		if (pivotIndex !== end) {
			exchange(sortingArray, pivotIndex, end);
			yield sortingArray;
		}

		return pivotIndex;
	}

	function* quickSort(
		start: number,
		end: number
	): Generator<T[], void, void> {
		if (start < end) {
			const pivotIndex = yield* partition(start, end);
			yield* quickSort(start, pivotIndex - 1);
			yield* quickSort(pivotIndex + 1, end);
		}
	}

	yield* quickSort(0, n - 1);

	return sortingArray;
}
