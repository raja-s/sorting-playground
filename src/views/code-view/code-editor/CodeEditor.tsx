
import * as React from 'react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import { shallow } from 'zustand/shallow';

import { useTranslation } from 'react-i18next';

import { EditorView, ViewUpdate, keymap } from '@codemirror/view';
import { type ChangeSpec, EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { python } from '@codemirror/lang-python';

import CodeMirrorEditor from '@uiw/react-codemirror';

import { useApplicationStore } from '../../../state/useApplicationStore.ts';
import type { ApplicationState, ExecutionOperationState } from '../../../state/ApplicationState.ts';
import ExecutionCheckpoint, { type ExecutionHistory } from '../../../state/ExecutionCheckpoint.ts';

import type {
	Variable,
	CodeAnalysisResult
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

export default function CodeEditor() {
	const muiTheme: MuiTheme = useTheme();

	const editorViewRef: RefObject<EditorView> = useRef(null as unknown as EditorView);

	const setSortingListData = useApplicationStore(state => state.setSortingListData);
	const setActivePythonCode = useApplicationStore(state => state.setActivePythonCode);
	const bumpEditorReloadCodeTriggerValue = useApplicationStore(state => state.bumpEditorReloadCodeTriggerValue);
	const executionOperationState = useApplicationStore(state => state.executionOperationState);

	const [state, setState] = useState<State>({
		lineCount : 1,
		longestLineLength : 0
	});

	const updateListener: Extension =
		EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
			handleViewUpdate(
				viewUpdate,
				executionOperationState,
				setActivePythonCode,
				setState,
				setSortingListData
			);
		});

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
			state => state.editorReloadCodeTriggerValue,
			() => {
				setEntireEditorCode(
					editorViewRef.current,
					useApplicationStore.getState().activePythonCode
				);
			}
		);
		return unsubscribe;
	}, []);

	useEffect(() => {
		const unsubscribe = useApplicationStore.subscribe(
			state => [
				state.executionHistory,
				state.executionHistoryPosition,
				state.executionOperationState
			] as const,
			([
				executionHistory,
				executionHistoryPosition,
				executionOperationState
			]) => {
				const state: ApplicationState = useApplicationStore.getState();

				handleExecutionUpdate(
					editorViewRef.current,
					state.activePythonCode,
					state.pythonCodeAnalysisResult,
					executionOperationState,
					executionHistory,
					executionHistoryPosition
				);
			},
			{ equalityFn: shallow }
		);
		return unsubscribe;
	}, []);

	const extensions = useMemo(() => [
		python(),
		indentUnit.of('    '),
		keymap.of(defaultKeymap),
		getCodeEditorTheme(muiTheme, state.lineCount, state.longestLineLength),
		updateListener,
		executingLineField,
		simulationAnnotationPlugin,
		EditorView.editorAttributes.of({
			class: executionOperationState !== 'stopped' ? 'is-executing' : ''
		})
	], [ muiTheme, state, executionOperationState ]);

	return (
		<CodeMirrorEditor
			data-guided-tour-target-element='code-editor'
			onCreateEditor={view => {
				editorViewRef.current = view;
				bumpEditorReloadCodeTriggerValue();
			}}
			readOnly={executionOperationState !== 'stopped'}
			editable={executionOperationState === 'stopped'}
			basicSetup={{ foldGutter : false }}
			extensions={extensions}

			style={{
				minHeight: 0,
				overflowY: 'auto'
			}}
		/>
	);
}

function handleViewUpdate(
	viewUpdate: ViewUpdate,
	executionOperationState: ExecutionOperationState,
	setActivePythonCode: (code: string) => void,
	setState: React.Dispatch<React.SetStateAction<State>>,
	setSortingListData: (name: string, list: unknown[]) => void
): void {
	if (!viewUpdate.docChanged || executionOperationState !== 'stopped') {
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

	setTimeout(() => {
		editorView.dispatch({
			effects: clearExecutionLine.of(null),
			changes: {
				from: 0,
				to: editorView.state.doc.length,
				insert: code
			}
		});
	}, 0);
}

function handleExecutionUpdate(
	editorView: EditorView | null,
	activePythonCode: string,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionOperationState: ExecutionOperationState,
	executionHistory: ExecutionHistory,
	executionHistoryPosition: number
): void {
	if (editorView == null) {
		return;
	}

	if (executionOperationState === 'stopped') {
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
		executionCheckpoint
	);

	const transaction = editorView.state.update({ changes: executionAnnotationsChanges });

	let effectPosition;
	let effect;
	let executingLinePosition;

	if (executionCheckpoint.lineRange == null) {
		effectPosition = transaction.state.doc.line(transaction.state.doc.lines).from;
		effect = setExecutionEndLine;

		executingLinePosition =
			transaction.state.doc.line(transaction.state.doc.lines).from;
	} else {
		effectPosition = {
			from: transaction.state.doc.line(executionCheckpoint.lineRange.start).from,
			to: transaction.state.doc.line(
				executionHistoryPosition === 0 ?
					executionCheckpoint.lineRange.start : executionCheckpoint.lineRange.end
			).to
		};

		effect = executionHistoryPosition === 0 ?
			setExecutionStartLine : setExecutingLine;

		executingLinePosition =
			transaction.state.doc.line(executionCheckpoint.lineRange.start).from;
	}

	editorView.dispatch(
		{
			changes: executionAnnotationsChanges,
			effects: [
				effect.of(effectPosition),
				EditorView.scrollIntoView(
					executingLinePosition,
					{ x : 'start', y : 'nearest' }
				)
			]
		}
	);
}

function getExecutionAnnotationsChanges(
	editorView: EditorView,
	activePythonCode: string,
	pythonCodeAnalysisResult: CodeAnalysisResult,
	executionCheckpoint: ExecutionCheckpoint
): ChangeSpec {
	const resetChange = editorView.state.changes({
		from: 0,
		to: editorView.state.doc.length,
		insert: activePythonCode
	});

	const cleanState = EditorState.create({ doc: activePythonCode });

	const annotationChanges =
		cleanState.changes(
			executionCheckpoint.squashExecutionStack().flatMap((checkpoint: ExecutionCheckpoint) =>
				pythonCodeAnalysisResult.trackedVariableMap[checkpoint.lineRange?.start || -1]
					.map((variable: Variable) => ({
						from: cleanState.doc.line(variable.definitionLineRange.end).to,
						insert: ` # ${variable.name} = ${
							checkpoint.scopeLocals[variable.name]}`.replaceAll('\n', '\\n')
					}))
			)
		);

	return resetChange.compose(annotationChanges);
}
