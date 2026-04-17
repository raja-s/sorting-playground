
import * as React from 'react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { EditorView, ViewUpdate, keymap } from '@codemirror/view';
import { type ChangeSpec, EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { python } from '@codemirror/lang-python';

import CodeMirrorEditor from '@uiw/react-codemirror';

import { useApplicationStore } from '../../../state/useApplicationStore.ts';
import { type ExecutionState } from '../../../state/ApplicationState.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../../state/ExecutionCheckpoint.ts';

import {
	type Variable,
	type CodeAnalysisResult
} from '../../../code-analysis/codeAnalysis.ts';
import { findSortingList } from '../../../code-analysis/sortingListLocation.ts';

import {
	setExecutionStartLine,
	setExecutingLine,
	setExecutionEndLine,
	clearExecutionLine,
	executingLineField,
	simulationAnnotationPlugin
} from './decorations.ts';
import { getCodeEditorTheme } from './theme.ts';

import { useTheme, type Theme as MuiTheme } from '@mui/material/styles';

type State = {
	lineCount: number,
	longestLineLength: number
};

const startingSortingList: number[] = [3, 7, 1, 5, 2, 8, 9, 4, 6];

export default function CodeEditor() {
	const muiTheme: MuiTheme = useTheme();

	const editorViewRef: RefObject<EditorView> = useRef(null as unknown as EditorView);

	const setSortingListData = useApplicationStore(state => state.setSortingListData);
	const activePythonCode = useApplicationStore(state => state.activePythonCode);
	const setActivePythonCode = useApplicationStore(state => state.setActivePythonCode);
	const editorReloadCodeTriggerValue = useApplicationStore(state => state.editorReloadCodeTriggerValue);
	const bumpEditorReloadCodeTriggerValue = useApplicationStore(state => state.bumpEditorReloadCodeTriggerValue);
	const pythonCodeAnalysisResult = useApplicationStore(state => state.pythonCodeAnalysisResult);
	const executionHistory = useApplicationStore(state => state.executionHistory);
	const executionHistoryPosition = useApplicationStore(state => state.executionHistoryPosition);
	const executionState = useApplicationStore(state => state.executionState);

	const translate = useTranslation().t;

	const startingSortingListVariableName: string = translate('code.starting_list_variable_name');
	const startingCode: string = `${startingSortingListVariableName} = [${startingSortingList.join(', ')}] #l#

n = len(${startingSortingListVariableName}) #t#

${translate('code.to_do_comment')}
`;

	const startingCodeLines: string[] = startingCode.split('\n');

	const [state, setState] = useState<State>({
		lineCount: startingCodeLines.length,
		longestLineLength: Math.max(...startingCodeLines.map(line => line.length))
	});

	const updateListener: Extension =
		EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
			handleViewUpdate(
				viewUpdate,
				executionState,
				setActivePythonCode,
				setState,
				setSortingListData
			);
		});

	useEffect(() => {
		if (activePythonCode === '') {
			setActivePythonCode(startingCode);
			setSortingListData(startingSortingListVariableName, startingSortingList);
		}
	}, []);

	useEffect(() => {
		handleExecutionUpdate(
			editorViewRef.current,
			activePythonCode,
			pythonCodeAnalysisResult,
			executionState,
			executionHistory,
			executionHistoryPosition
		);
	}, [ executionHistory, executionHistoryPosition, executionState ]);

	useEffect(() => {
		setEntireEditorCode(editorViewRef.current, activePythonCode);
	}, [ editorReloadCodeTriggerValue ]);

	const extensions = useMemo(() => [
		python(),
		indentUnit.of('    '),
		keymap.of(defaultKeymap),
		getCodeEditorTheme(muiTheme, state.lineCount, state.longestLineLength),
		updateListener,
		executingLineField,
		simulationAnnotationPlugin,
		EditorView.editorAttributes.of({
			class: executionState !== 'stopped' ? 'is-executing' : ''
		})
	], [muiTheme, state, executionState]);

	return (
		<CodeMirrorEditor
			onCreateEditor={view => {
				editorViewRef.current = view;
				bumpEditorReloadCodeTriggerValue();
			}}
			value={startingCode}
			readOnly={executionState !== 'stopped'}
			editable={executionState === 'stopped'}
			basicSetup={{ foldGutter : false }}
			extensions={extensions}

			style={{ maxHeight: '100%' }}
		/>
	);
}

function handleViewUpdate(
	viewUpdate: ViewUpdate,
	executionState: ExecutionState,
	setActivePythonCode: (code: string) => void,
	setState: React.Dispatch<React.SetStateAction<State>>,
	setSortingListData: (name: string, list: unknown[]) => void
): void {
	if (!viewUpdate.docChanged || executionState !== 'stopped') {
		return;
	}

	setActivePythonCode(viewUpdate.state.doc.toString());

	setStateFromViewUpdate(viewUpdate, setState);

	const data = findSortingList(syntaxTree(viewUpdate.state), viewUpdate.state.doc.toString());

	if (data == null) {
		setSortingListData('', []);
	} else if (!data.invalidList) {
		setSortingListData(data.sortingListVariableName, data.sortingList);
	}
}

function setStateFromViewUpdate(
	viewUpdate: ViewUpdate,
	setState: React.Dispatch<React.SetStateAction<State>>
): void {
	const lineCount: number = viewUpdate.state.doc.lines;
	let longestLineLength: number = 0;

	for (let i = 1 ; i <= lineCount ; i++) {
		const lineLength = viewUpdate.state.doc.line(i).length;
		if (lineLength > longestLineLength) {
			longestLineLength = lineLength;
		}
	}

	setState({ lineCount, longestLineLength });
}

function setEntireEditorCode(
	editorView: EditorView | null,
	code: string
): void {
	if (editorView == null) {
		return;
	}

	editorView.dispatch({
		effects: clearExecutionLine.of(null),
		changes: {
			from: 0,
			to: editorView.state.doc.length,
			insert: code
		}
	});
}

function handleExecutionUpdate(
	editorView: EditorView | null,
	activePythonCode: string,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionState: ExecutionState,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number
): void {
	if (editorView == null) {
		return;
	}

	if (executionState === 'stopped') {
		setEntireEditorCode(editorView, activePythonCode);
		return;
	}

	if (executionHistory.length === 0) {
		return;
	}

	const executionCheckpoint: ExecutionCheckpoint =
		executionHistory[Math.max(executionHistoryPosition - 1, 0)];

	const executionAnnotationsChanges = getExecutionAnnotationsChanges(
		editorView,
		activePythonCode,
		pythonCodeAnalysisResult,
		executionCheckpoint,
		executionHistory,
		executionHistoryPosition
	);

	const transaction = editorView.state.update({ changes: executionAnnotationsChanges });

	let effectPosition;
	let effect;

	if (executionCheckpoint.lineRange == null) {
		effectPosition = transaction.state.doc.line(editorView.state.doc.lines).from;
		effect = setExecutionEndLine;
	} else if (executionHistoryPosition === 0) {
		effectPosition = {
			from: transaction.state.doc.line(executionCheckpoint.lineRange.start).from,
			to: transaction.state.doc.line(executionCheckpoint.lineRange.end).to
		};
		effect = setExecutionStartLine;
	} else {
		effectPosition = {
			from: transaction.state.doc.line(executionCheckpoint.lineRange.start).from,
			to: transaction.state.doc.line(executionCheckpoint.lineRange.end).to
		};
		effect = setExecutingLine;
	}

	editorView.dispatch({
		changes: executionAnnotationsChanges,
		effects: effect.of(effectPosition)
	});
}

function getExecutionAnnotationsChanges(
	editorView: EditorView,
	activePythonCode: string,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionCheckpoint: ExecutionCheckpoint,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number
): ChangeSpec {
	const resetChange = editorView.state.changes({
		from: 0,
		to: editorView.state.doc.length,
		insert: activePythonCode
	});

	const cleanState = EditorState.create({ doc: activePythonCode });

	let effectiveCheckpoint: ExecutionCheckpoint = executionCheckpoint;

	if (executionCheckpoint.lineRange == null) {
		if (executionHistoryPosition < 2) {
			return resetChange;
		} else {
			effectiveCheckpoint = executionHistory[executionHistoryPosition - 2];
		}
	}

	const annotationChanges =
		cleanState.changes(
			effectiveCheckpoint.squashExecutionStack().flatMap((checkpoint: ExecutionCheckpoint) =>
				pythonCodeAnalysisResult.trackedVariableMap[checkpoint.lineRange.start]
					.map((variable: Variable) => ({
						from: cleanState.doc.line(variable.definitionLineRange.end).to,
						insert: ` # ${variable.name} = ${
							checkpoint.scopeLocals[variable.name]}`.replaceAll('\n', '\\n')
					}))
			)
		);

	return resetChange.compose(annotationChanges);
}
