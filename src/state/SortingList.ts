
export type SortingElement = {
	identifier: number,
	value: unknown
};

export type SortingList = SortingElement[];

export type SortingListBounds = {
	minimum: number,
	maximum: number
};

export function determineBounds(sortingList: SortingList): SortingListBounds | null {
	if (sortingList.length === 0) {
		return { minimum : 0 , maximum : 0 };
	}

	if (!Number.isFinite(sortingList[0].value)) {
		return null;
	}

	let minimum: number = sortingList[0].value as number;
	let maximum: number = sortingList[0].value as number;

	for (const element of sortingList) {
		if (!Number.isFinite(element.value)) {
			return null;
		}

		const value: number = element.value as number;

		if (value < minimum) {
			minimum = value;
		}
		if (value > maximum) {
			maximum = value;
		}
	}

	return { minimum , maximum };
}
