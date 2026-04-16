
import {
	Decoration,
	type DecorationSet,
	EditorView,
	GutterMarker,
	MatchDecorator,
	ViewPlugin,
	ViewUpdate,
	lineNumberMarkers
} from '@codemirror/view';
import { RangeSet, StateEffect, StateField } from '@codemirror/state';

import { SIMULATION_ANNOTATION_REGEX } from '../../pyodide/code-analysis/SimulationAnnotation.ts';

/*
	Executing Line Decorations
*/

const executionStartLineDecoration = Decoration.line({
	attributes: { class: 'cm-executionStartLine' }
});
const executingLineDecoration = Decoration.line({
	attributes: { class: 'cm-executingLine' }
});
const executionEndLineDecoration = Decoration.line({
	attributes: { class: 'cm-executionEndLine' }
});

const simulationAnnotationDecoration = Decoration.mark({
	class: 'cm-simulationAnnotation'
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

export const setExecutionStartLine = StateEffect.define({
	map: (range, change) => ({
		from: change.mapPos(range.from),
		to: change.mapPos(range.to)
	})
});

export const setExecutingLine = StateEffect.define({
	map: (range, change) => ({
		from: change.mapPos(range.from),
		to: change.mapPos(range.to)
	})
});

export const setExecutionEndLine = StateEffect.define({
	map: (position, change) => change.mapPos(position)
});

export const clearExecutionLine = StateEffect.define();

const initialExecutingLineFieldState = {
	decoration: Decoration.none,
	gutter: RangeSet.empty
};

export const executingLineField = StateField.define({
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

/*
	Simulation Annotation Decoration
*/

const simulationAnnotationDecorator = new MatchDecorator({
	regexp: SIMULATION_ANNOTATION_REGEX,
	decoration: simulationAnnotationDecoration
});

class SimulationAnnotationPlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = simulationAnnotationDecorator.createDeco(view);
	}

	update(update: ViewUpdate) {
		this.decorations = simulationAnnotationDecorator.updateDeco(update, this.decorations);
	}
}

export const simulationAnnotationPlugin: ViewPlugin<SimulationAnnotationPlugin> =
	ViewPlugin.fromClass(
		SimulationAnnotationPlugin,
		{ decorations: (plugin: SimulationAnnotationPlugin) => plugin.decorations }
	);
