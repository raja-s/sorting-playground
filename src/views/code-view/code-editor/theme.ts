
import { EditorView } from '@codemirror/view';

import { type Theme as MuiTheme } from '@mui/material/styles';

export function getCodeEditorTheme(
	muiTheme: MuiTheme,
	lineCount: number,
	longestLineLength: number
) {
	const codeFontSize =
		Math.max(
			Math.min(
				Math.ceil(80 - Math.sqrt(62 * longestLineLength)),
				Math.ceil(56 - Math.sqrt(40 * lineCount)),
				48
			),
			16
		);
	const lineNumberFontSize = Math.round(12 + codeFontSize / 4);
	const lineNumberPaddingRight = Math.round(6 + codeFontSize / 2);

	return EditorView.theme({
		'&': { maxHeight: '100%' },
		'&.cm-focused': { outline: 'none' },
		'.cm-scroller': {
			display: 'block',
			outline: 'none',

			fontFamily: '"JetBrains Mono", monospace',
			fontOpticalSizing: 'auto',
			fontWeight: 'normal',
			fontStyle: 'normal',
			fontVariantLigatures: 'none'
		},
		'.cm-gutters': {
			position: 'absolute',
			left: 0,
			backgroundColor: '#fff',

			fontSize: `${lineNumberFontSize}px`
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
		'.cm-lineNumbers .cm-gutterElement:not([style*="height: 0px"])': {
			height: 'auto !important',
			paddingRight: `${lineNumberPaddingRight}px`
		},
		'.cm-content': {
			fontSize: `${codeFontSize}px`
		},
		'.cm-line': {
			display: 'flow-root',
			boxSizing: 'border-box',
			contain: 'layout'
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
		},
		'& .cm-simulationAnnotation > span': {
			color: muiTheme.palette.primary.main
		},
		'& .cm-simulationAnnotation > .cm-matchingBracket > span': {
			color: '#009046'
		}
	});
}
