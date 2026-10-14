
import i18n from 'i18next';

import { type ApplicationState } from './ApplicationState.ts';
import { useApplicationStore } from './useApplicationStore.ts';

const startingSortingList: number[] = [3, 7, 1, 5, 2, 8, 9, 4, 6];

function getStartingSortingListVariableName(): string {
	return i18n.t('code.starting_list_variable_name');
}

function getStartingActivePythonCode(): string {
	const startingSortingListVariableName: string = getStartingSortingListVariableName();
	const todoComment: string = i18n.t('code.to_do_comment');

	return `${startingSortingListVariableName} = [${startingSortingList.join(', ')}] #l#

n = len(${startingSortingListVariableName}) #t#

${todoComment}
`;
}

function handleHydrationFromUrlComplete(state: ApplicationState): void {
	if (i18n.isInitialized) {
		setActivePythonCodeAndReloadEditorCode(state);
	} else {
		i18n.on('initialized', () => {
			setActivePythonCodeAndReloadEditorCode(state);
		});
	}
}

function setActivePythonCodeAndReloadEditorCode(state: ApplicationState): void {
	if (state.activePythonCode === '') {
		state.setActivePythonCode(getStartingActivePythonCode());
		state.setSortingListData(getStartingSortingListVariableName(), startingSortingList);
	}

	state.bumpEditorReloadCodeTriggerValue();
}

/*
	Execution
*/

if (useApplicationStore.persist.hasHydrated()) {
	handleHydrationFromUrlComplete(useApplicationStore.getState());
} else {
	useApplicationStore.persist.onFinishHydration((state: ApplicationState) => {
		handleHydrationFromUrlComplete(state);
	});
}
