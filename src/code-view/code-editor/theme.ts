
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
		},
		'& .cm-simulationAnnotation > span': {
			color: '#18a85e'
		},
		'& .cm-simulationAnnotation > .cm-matchingBracket > span': {
			color: '#009046'
		}
	});
}
