
export type SortingElement = {
	identifier: number,
	value: number
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

	let minimum: number = sortingList[0].value;
	let maximum: number = sortingList[0].value;

	for (const element of sortingList) {
		if (!Number.isFinite(element.value)) {
			return null;
		}

		if (element.value < minimum) {
			minimum = element.value;
		}
		if (element.value > maximum) {
			maximum = element.value;
		}
	}

	return { minimum , maximum };
}
