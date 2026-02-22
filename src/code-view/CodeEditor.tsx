
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
} from '../pyodide/codeAnalysis.ts';

import { useTheme, type Theme as MuiTheme } from '@mui/material/styles';

type State = {
	sortingListVariableName: string,
	sortingListSourceCodeStart: number,
	sortingListSourceCodeEnd: number,
	sortingList: number[],
	lineCount: number,
	longestLineLength: number
};

const startingListVariableName: string = 'values';
const startingList: number[] = [1, 8, 2, 5, 3, 9, 6, 4, 7];

const startingCode: string = `# The first statement must define a
# variable as a list (of int or str)
${startingListVariableName} = ${codify(startingList)}

# Sort the list here...
`;

const initialState: State = {
	sortingListVariableName: '',
	sortingListSourceCodeStart: -1,
	sortingListSourceCodeEnd: -1,
	sortingList: [],
	lineCount: 1,
	longestLineLength: 0
};

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
	map: (position, change) => change.mapPos(position)
});
const setExecutingLine = StateEffect.define({
	map: (position, change) => change.mapPos(position)
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

		if (effect.is(setExecutionStartLine)) {
			decoration = executionStartLineDecoration;
			gutter = executionStartLineGutterMarker;
		} else if (effect.is(setExecutingLine)) {
			decoration = executingLineDecoration;
			gutter = executingLineGutterMarker;
		} else if (effect.is(setExecutionEndLine)) {
			decoration = executionEndLineDecoration;
			gutter = executionEndLineGutterMarker;
		}

		if (decoration != null && gutter != null) {
//			const linePosition: number = effect.value as unknown as number;
			const actualLine = transaction.state.doc.lineAt(effect.value);
			fieldValue.decoration = Decoration.set([ decoration.range(actualLine.from) ]);
			fieldValue.gutter = RangeSet.of([ gutter.range(actualLine.from) ]);
		}

		return fieldValue;
	},
	provide: field => [
		EditorView.decorations.from(field, value => value.decoration),
		lineNumberMarkers.from(field, value => value.gutter)
	]
});

export function CodeEditor() {
	const muiTheme: MuiTheme = useTheme();

	const editorViewRef: RefObject<EditorView> = useRef(null as unknown as EditorView);

	const setSortingListData = useControlStore(state => state.setSortingListData);
	const activePythonCode = useControlStore(state => state.activePythonCode);
	const setActivePythonCode = useControlStore(state => state.setActivePythonCode);
	const pythonCodeAnalysisResult = useControlStore(state => state.pythonCodeAnalysisResult);
	const executionHistory = useControlStore(state => state.executionHistory);
	const executionHistoryPosition = useControlStore(state => state.executionHistoryPosition);
	const executionState = useControlStore(state => state.executionState);

	const [state, setState] = useState<State>(initialState);

	useEffect(() => {
		setInitialState(setActivePythonCode, setState);
	}, []);

	useEffect(
		() => {
			if ([...state.sortingList].every(element => Number.isFinite(element))) {
				setSortingListData(
					state.sortingListVariableName,
					state.sortingListSourceCodeStart,
					state.sortingListSourceCodeEnd,
					state.sortingList
				);
			}
		},
		[
			state.sortingListVariableName,
			state.sortingListSourceCodeStart,
			state.sortingListSourceCodeEnd,
			state.sortingList
		]
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
			value={startingCode}
			readOnly={executionState !== 'stopped'}
			editable={executionState === 'stopped'}
			basicSetup={{ foldGutter : false }}
			extensions={extensions}

			style={{ maxHeight: '100%' }}
		/>
	);
}

function setInitialState(
	setActivePythonCode: (code: string) => void,
	setState: React.Dispatch<React.SetStateAction<State>>
): void {
	setActivePythonCode(startingCode);

	const lines: string[] = startingCode.split('\n');

	setState({
		sortingListVariableName: startingListVariableName,
		sortingListSourceCodeStart: startingCode.indexOf('['),
		sortingListSourceCodeEnd: startingCode.indexOf(']') + 1,
		sortingList: startingList,
		lineCount: lines.length,
		longestLineLength: Math.max(...lines.map(line => line.length))
	});
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

	const code: string = viewUpdate.state.doc.toString();

	if (executionState === 'stopped') {
		setActivePythonCode(code);
	}

	setState((previousState: State) => {
		let {
			sortingListVariableName,
			sortingListSourceCodeStart,
			sortingListSourceCodeEnd,
			sortingList
		} = previousState;

		if (
			sortingListSourceCodeStart === -1 ||
			sortingListSourceCodeEnd === -1 ||
			viewUpdate.changes.touchesRange(sortingListSourceCodeStart, sortingListSourceCodeEnd)
		) {
			sortingListSourceCodeStart = code.indexOf('[');
			sortingListSourceCodeEnd = code.indexOf(']');

			if (sortingListSourceCodeEnd !== -1) {
				sortingListSourceCodeEnd++;
			}

			if (sortingListSourceCodeStart === -1 || sortingListSourceCodeEnd === -1) {
				sortingList = [];
			} else {
				const lineStart =
					Math.max(code.lastIndexOf('\n', sortingListSourceCodeStart), 0);
				sortingListVariableName =
					code.slice(lineStart, sortingListSourceCodeStart).replaceAll('=', '').trim();

				try {
					sortingList = eval(code.slice(sortingListSourceCodeStart, sortingListSourceCodeEnd));
				} catch (error) {
					// We ignore the error (for now)
				}
			}
		}

		let longestLineLength = 0;

		for (let i = 1 ; i <= viewUpdate.state.doc.lines ; i++) {
			const lineLength = viewUpdate.state.doc.line(i).length;
			if (lineLength > longestLineLength) {
				longestLineLength = lineLength;
			}
		}

		return {
			sortingListVariableName,
			sortingListSourceCodeStart,
			sortingListSourceCodeEnd,
			sortingList,
			lineCount: viewUpdate.state.doc.lines,
			longestLineLength
		};
	});
}

function handleExecutionUpdate(
	editorView: EditorView,
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
		editorView.dispatch({
			effects: clearExecutionLine.of(null),
			changes: {
				from: 0,
				to: editorView.state.doc.length,
				insert: activePythonCode
			}
		});
		return;
	}

	if (executionHistory.length === 0) {
		return;
	}

	let executionCheckpoint: ExecutionCheckpoint;
	let lineNumber: number;
	let effectLineNumber: number;
	let effect;

	if (executionHistoryPosition === 0) {
		executionCheckpoint = executionHistory[0];
		lineNumber = executionCheckpoint.lineNumber;
		effectLineNumber = lineNumber;
		effect = setExecutionStartLine;
	} else {
		executionCheckpoint = executionHistory[executionHistoryPosition - 1];
		lineNumber = executionCheckpoint.lineNumber;
		if (lineNumber === -1) {
			effectLineNumber = editorView.state.doc.lines;
			effect = setExecutionEndLine;
		} else {
			effectLineNumber = lineNumber;
			effect = setExecutingLine;
		}
	}

	const executionAnnotationsChanges = getExecutionAnnotationsChanges(
		editorView,
		activePythonCode,
		pythonCodeAnalysisResult,
		executionCheckpoint,
		lineNumber
	);
	const transaction = editorView.state.update({ changes: executionAnnotationsChanges });
	const effectPosition = transaction.state.doc.line(effectLineNumber).from;

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
	lineNumber: number
): ChangeSpec {
	const resetChange = editorView.state.changes({
		from: 0,
		to: editorView.state.doc.length,
		insert: activePythonCode
	});

	const cleanState = EditorState.create({ doc: activePythonCode });

	if (lineNumber === -1) {
		return resetChange;
	}

	const annotationChanges =
		cleanState.changes(
			pythonCodeAnalysisResult.trackedVariableMap[lineNumber]
				.map((trackedVariable: TrackedVariable) => ({
					from: cleanState.doc.line(trackedVariable.definitionLineNumber).to,
					insert: ` # ${trackedVariable.name} = ${
						executionCheckpoint.scopeLocals[trackedVariable.name]}`
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

function codify(list: number[]): string {
	return `[${list.join(', ')}]`;
}
