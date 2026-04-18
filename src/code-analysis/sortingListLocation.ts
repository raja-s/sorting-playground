
import { type SyntaxNode, Tree, TreeCursor } from '@lezer/common';

import { type AbsolutePosition, type Range } from '../common.ts';

export type MinimalSortingListData = {
	assignmentRange: Range<AbsolutePosition>,
	sortingListVariableName: string,
	sortingList: unknown[],
	invalidList: boolean
};

export function findSortingList(
	tree: Tree,
	sourceCode: string
): MinimalSortingListData | null {
	const cursor: TreeCursor = tree.cursor();
	let done = false;

	while (!done) {
		if (cursor.name === 'Script') {
			done = !cursor.next();
			continue;
		}

		if (cursor.name === 'AssignStatement') {
			let assignStatementLastLineEnd: number = sourceCode.indexOf('\n', cursor.to);

			if (assignStatementLastLineEnd === -1) {
				assignStatementLastLineEnd = sourceCode.length;
			}

			const regex = new RegExp(`.{0,${assignStatementLastLineEnd - cursor.from}}#l#`, 'sy');
			regex.lastIndex = cursor.from;

			if (regex.test(sourceCode)) {
				return createSortingListData(cursor.node, sourceCode);
			}
		}

		if (!cursor.nextSibling()) {
			done = !cursor.parent() || !cursor.nextSibling();
		}
	}

	return null;
}

function createSortingListData(
	assignStatementNode: SyntaxNode,
	sourceCode: string
): MinimalSortingListData | null {
	let sortingListVariableName: string | null = null;
	let sortingList: unknown[] | null = null;
	let invalidList: boolean = false;

	const cursor: TreeCursor = assignStatementNode.cursor();
	cursor.next();

	do {
		switch (cursor.name) {
			case 'VariableName': {
				if (sortingListVariableName !== null) {
					return null;
				}

				sortingListVariableName = sourceCode.slice(cursor.from, cursor.to);
				break;
			}

			case 'ArrayExpression': {
				try {
					sortingList = eval(sourceCode.slice(cursor.from, cursor.to).replace(/#.*/g, ''));

					if ([...sortingList].some(element => !Number.isFinite(element))) {
						sortingList = null;
						invalidList = true;
					}
				} catch (error) {
					// We ignore the error (for now)
					sortingList = null;
					invalidList = true;
				}

				break;
			}

			case ',':
			case 'AssignOp':
				break;

			default:
				return null;
		}
	} while (cursor.nextSibling());

	if (sortingListVariableName == null || (sortingList == null && !invalidList)) {
		return null;
	}

	return {
		assignmentRange: {
			start: assignStatementNode.from,
			end: assignStatementNode.to
		},
		sortingListVariableName,
		sortingList: sortingList == null ? [] : sortingList,
		invalidList
	};
}
