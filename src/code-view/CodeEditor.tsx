
import * as React from 'react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import {
	Decoration,
	EditorView,
	GutterMarker,
	ViewUpdate,
	keymap,
	lineNumberMarkers
} from '@codemirror/view';
import { type ChangeSpec, EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { python } from '@codemirror/lang-python';

import ReactCodeEditor from '@uiw/react-codemirror';

import {
	type ExecutionCheckpoint,
	type ExecutionState,
	useControlStore
} from '../state/useControlStore.ts';

import {
	type TrackedVariable,
	type CodeAnalysisResult
} from '../pyodide/code-analysis/codeAnalysis.ts';

import { useTheme, type Theme as MuiTheme } from '@mui/material/styles';

const executionStartLineDecoration = Decoration.line({
	attributes: { class: 'cm-executionStartLine' }
});
const executingLineDecoration = Decoration.line({
	attributes: { class: 'cm-executingLine' }
});
const executionEndLineDecoration = Decoration.line({
	attributes: { class: 'cm-executionEndLine' }
});

const executionStartLineGutterMarker = new (class extends GutterMarker {
	elementClass = 'cm-executionStartLineGutter';
})();
const executingLineGutterMarker = new (class extends GutterMarker {
	elementClass = 'cm-executingLineGutter';
})();
const executionEndLineGutterMarker = new (class extends GutterMarker {
	elementClass = 'cm-executionEndLineGutter';
})();

const setExecutionStartLine = StateEffect.define({
	map: (range, change) => ({
		from: change.mapPos(range.from),
		to: change.mapPos(range.to)
	})
});
const setExecutingLine = StateEffect.define({
	map: (range, change) => ({
		from: change.mapPos(range.from),
		to: change.mapPos(range.to)
	})
});
const setExecutionEndLine = StateEffect.define({
	map: (position, change) => change.mapPos(position)
});
const clearExecutionLine = StateEffect.define();

const initialExecutingLineFieldState = {
	decoration: Decoration.none,
	gutter: RangeSet.empty
};

const executingLineField = StateField.define({
	create() {
		return initialExecutingLineFieldState;
	},
	update(current, transaction) {
		const fieldValue = {
			decoration: current.decoration.map(transaction.changes),
			gutter: current.gutter.map(transaction.changes)
		};

		if (transaction.effects.length === 0) {
			return fieldValue;
		}

		// Warning: We assume there is only one effect!!! (Which might
		//          not be the case in the future if we add more features)
		const effect = transaction.effects[0];

		if (effect.is(clearExecutionLine)) {
			return initialExecutingLineFieldState;
		}

		let decoration = null;
		let gutter = null;

		// Range effects
		if (effect.is(setExecutionStartLine) || effect.is(setExecutingLine)) {
			if (effect.is(setExecutionStartLine)) {
				decoration = executionStartLineDecoration;
				gutter = executionStartLineGutterMarker;
			} else if (effect.is(setExecutingLine)) {
				decoration = executingLineDecoration;
				gutter = executingLineGutterMarker;
			}

			const { from, to } = effect.value;
			const decorationRanges = [];
			const gutterRanges = [];

			for (let position = from ; position <= to ; ) {
				const line = transaction.state.doc.lineAt(position);

				decorationRanges.push(decoration.range(line.from));
				gutterRanges.push(gutter.range(line.from));

				position = line.to + 1;
			}

			fieldValue.decoration = Decoration.set(decorationRanges);
			fieldValue.gutter = RangeSet.of(gutterRanges);
		}
		// Single-line effects
		else if (effect.is(setExecutionEndLine)) {
			decoration = executionEndLineDecoration;
			gutter = executionEndLineGutterMarker;

			const line = transaction.state.doc.lineAt(effect.value);
			fieldValue.decoration = Decoration.set([ decoration.range(line.from) ]);
			fieldValue.gutter = RangeSet.of([ gutter.range(line.from) ]);
		}

		return fieldValue;
	},
	provide: field => [
		EditorView.decorations.from(field, value => value.decoration),
		lineNumberMarkers.from(field, value => value.gutter)
	]
});

type CodeEditorProps = {
	startingList: number[],
	startingListVariableName: string,
	startingCode: string,
	startingCodeLines: string[],
};

type State = {
	sortingListVariableName: string,
	sortingList: number[],
	lineCount: number,
	longestLineLength: number
};

export function CodeEditor(props: CodeEditorProps) {
	const muiTheme: MuiTheme = useTheme();

	const editorViewRef: RefObject<EditorView> = useRef(null as unknown as EditorView);

	const setSortingListData = useControlStore(state => state.setSortingListData);
	const activePythonCode = useControlStore(state => state.activePythonCode);
	const setActivePythonCode = useControlStore(state => state.setActivePythonCode);
	const fileOpenTriggerValue = useControlStore(state => state.fileOpenTriggerValue);
	const pythonCodeAnalysisResult = useControlStore(state => state.pythonCodeAnalysisResult);
	const executionHistory = useControlStore(state => state.executionHistory);
	const executionHistoryPosition = useControlStore(state => state.executionHistoryPosition);
	const executionState = useControlStore(state => state.executionState);

	const [state, setState] = useState<State>({
		sortingListVariableName: props.startingListVariableName,
		sortingList: props.startingList,
		lineCount: props.startingCodeLines.length,
		longestLineLength: Math.max(...props.startingCodeLines.map(line => line.length))
	});

	useEffect(() => {
		setActivePythonCode(props.startingCode);
	}, []);

	useEffect(
		() => {
			if ([...state.sortingList].every(element => Number.isFinite(element))) {
				setSortingListData(state.sortingListVariableName, state.sortingList);
			}
		},
		[ state.sortingListVariableName, state.sortingList ]
	);

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
	}, [ fileOpenTriggerValue ]);

	const extensions = useMemo(() => [
		python(),
		indentUnit.of('    '),
		keymap.of(defaultKeymap),
		getCodeEditorTheme(muiTheme, state),
		EditorView.updateListener.of((viewUpdate: ViewUpdate) => {
			handleCodeEditorChange(viewUpdate, executionState, setActivePythonCode, setState);
		}),
		executingLineField,
		EditorView.editorAttributes.of({
			class: executionState !== 'stopped' ? 'is-executing' : ''
		})
	], [muiTheme, state, executionState]);

	return (
		<ReactCodeEditor
			onCreateEditor={view => {
				editorViewRef.current = view;
			}}
			value={props.startingCode}
			readOnly={executionState !== 'stopped'}
			editable={executionState === 'stopped'}
			basicSetup={{ foldGutter : false }}
			extensions={extensions}

			style={{ maxHeight: '100%' }}
		/>
	);
}

function handleCodeEditorChange(
	viewUpdate: ViewUpdate,
	executionState: ExecutionState,
	setActivePythonCode: (code: string) => void,
	setState: React.Dispatch<React.SetStateAction<State>>
): void {
	if (!viewUpdate.docChanged) {
		return;
	}

	if (executionState === 'stopped') {
		setActivePythonCode(viewUpdate.state.doc.toString());
	}

	setState((previousState: State) => {
		const lineCount: number = viewUpdate.state.doc.lines;
		let longestLineLength: number = 0;

		for (let i = 1 ; i <= lineCount ; i++) {
			const lineLength = viewUpdate.state.doc.line(i).length;
			if (lineLength > longestLineLength) {
				longestLineLength = lineLength;
			}
		}

		const sourceCode: string = viewUpdate.state.doc.toString();

		const sortingListSourceCodeStart: number = sourceCode.indexOf('[');

		if (sortingListSourceCodeStart === -1) {
			return { sortingListVariableName: '', sortingList: [], lineCount, longestLineLength };
		}

		let sortingListSourceCodeEnd: number = sourceCode.indexOf(']', sortingListSourceCodeStart);

		if (sortingListSourceCodeEnd === -1) {
			return { sortingListVariableName: '', sortingList: [], lineCount, longestLineLength };
		}

		sortingListSourceCodeEnd++;

		let sortingList: unknown[];

		try {
			sortingList = eval(sourceCode.slice(sortingListSourceCodeStart, sortingListSourceCodeEnd));
		} catch (error) {
			// We ignore the error (for now)
			sortingList = previousState.sortingList;
		}

		const equalSignIndex: number = sourceCode.lastIndexOf('=', sortingListSourceCodeStart);

		if (equalSignIndex === -1) {
			return { sortingListVariableName: '', sortingList, lineCount, longestLineLength };
		}

		const lineStart: number = Math.max(sourceCode.lastIndexOf('\n', equalSignIndex), 0);
		const sortingListVariableName: string =
			sourceCode.slice(lineStart, equalSignIndex).replaceAll('=', '').trim();

		return { sortingListVariableName, sortingList, lineCount, longestLineLength };
	});
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
	executionHistory: ExecutionCheckpoint[],
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

	let executionCheckpoint: ExecutionCheckpoint =
		executionHistoryPosition === 0 ? executionHistory[0] :
			executionHistory[executionHistoryPosition - 1];

	const executionAnnotationsChanges = getExecutionAnnotationsChanges(
		editorView,
		activePythonCode,
		pythonCodeAnalysisResult,
		executionCheckpoint
	);
	const transaction = editorView.state.update({ changes: executionAnnotationsChanges });

	let effectPosition;
	let effect;

	if (executionHistoryPosition === 0) {
		effectPosition = {
			from: transaction.state.doc.line(executionCheckpoint.startLineNumber).from,
			to: transaction.state.doc.line(executionCheckpoint.endLineNumber).to
		};
		effect = setExecutionStartLine;
	} else {
		if (executionCheckpoint.startLineNumber == null) {
			effectPosition = transaction.state.doc.line(editorView.state.doc.lines).from;
			effect = setExecutionEndLine;
		} else {
			effectPosition = {
				from: transaction.state.doc.line(executionCheckpoint.startLineNumber).from,
				to: transaction.state.doc.line(executionCheckpoint.endLineNumber).to
			};
			effect = setExecutingLine;
		}
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
	executionCheckpoint: ExecutionCheckpoint
): ChangeSpec {
	const resetChange = editorView.state.changes({
		from: 0,
		to: editorView.state.doc.length,
		insert: activePythonCode
	});

	const cleanState = EditorState.create({ doc: activePythonCode });

	if (executionCheckpoint.startLineNumber == null) {
		return resetChange;
	}

	const annotationChanges =
		cleanState.changes(
			pythonCodeAnalysisResult.trackedVariableMap[executionCheckpoint.startLineNumber]
				.map((trackedVariable: TrackedVariable) => ({
					from: cleanState.doc.line(trackedVariable.definitionLineNumberRange.end).to,
					insert: ` # ${trackedVariable.name} = ${
						executionCheckpoint.scopeLocals[trackedVariable.name]}`
							.replaceAll('\n', '\\n')
				}))
		);

	return resetChange.compose(annotationChanges);
}

function getCodeEditorTheme(muiTheme: MuiTheme, state: State) {
	const codeFontSize =
		Math.max(
			Math.min(
				Math.ceil(80 - Math.sqrt(62 * state.longestLineLength)),
				Math.ceil(56 - Math.sqrt(40 * state.lineCount)),
				48
			),
			16
		);
	const lineNumberFontSize = Math.round(12 + codeFontSize / 4);
	const lineNumberPaddingRight = Math.round(6 + codeFontSize / 2);

	return EditorView.theme({
		'&': { maxHeight: '100%' },
		'&.cm-focused': { outline: 'none' },
		'.cm-scroller': { outline: 'none' },
		'.cm-gutters': {
			backgroundColor: '#fff',

			fontSize: `${lineNumberFontSize}px`,
			fontFamily: '"JetBrains Mono", monospace',
			fontOpticalSizing: 'auto',
			fontWeight: 'normal',
			fontStyle: 'normal',
			fontVariantLigatures: 'none'
		},
		'.cm-gutters.cm-gutters-before': {
			borderRightWidth: 0
		},
		'.cm-gutterElement': {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			color: '#ccc'
		},
		'.cm-lineNumbers .cm-gutterElement': {
			paddingRight: `${lineNumberPaddingRight}px`
		},
		'.cm-content': {
			fontSize: `${codeFontSize}px`,
			fontFamily: '"JetBrains Mono", monospace',
			fontOpticalSizing: 'auto',
			fontWeight: 'normal',
			fontStyle: 'normal',
			fontVariantLigatures: 'none'
		},
		'.cm-activeLine,.cm-activeLineGutter': {
			backgroundColor: `${muiTheme.palette.primary.main}11`
		},
		'.cm-executionStartLine,.cm-executionStartLineGutter': {
			boxShadow: `inset 0 2px 0 0 ${muiTheme.palette.primary.main}`
		},
		'.cm-executingLine,.cm-executingLineGutter': {
			backgroundColor: `${muiTheme.palette.primary.main}33`
		},
		'.cm-executionEndLine,.cm-executionEndLineGutter': {
			boxShadow: `inset 0 -2px 0 0 ${muiTheme.palette.primary.main}`
		},
		'&.is-executing .cm-activeLine:not(.cm-executingLine)': {
			backgroundColor: 'transparent'
		},
		'&.is-executing .cm-activeLineGutter:not(.cm-executingLineGutter)': {
			backgroundColor: 'transparent'
		}
	});
}
