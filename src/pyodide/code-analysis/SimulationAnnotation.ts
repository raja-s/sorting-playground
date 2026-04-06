
import SourceCode from './SourceCode.ts';

const MODIFIER_ARGUMENT_DESCRIPTOR: string = '[a-zA-Z0-9_:]+';
const MODIFIER_DESCRIPTOR: string = `[dlstv](?:\\(${MODIFIER_ARGUMENT_DESCRIPTOR}(?:,${MODIFIER_ARGUMENT_DESCRIPTOR})*\\))?`;

export const MODIFIER_REGEX: RegExp = new RegExp(MODIFIER_DESCRIPTOR, 'g');
export const SIMULATION_ANNOTATION_REGEX: RegExp = new RegExp(`#(?:${MODIFIER_DESCRIPTOR})+#`, 'g');

export type ModifierKind = 'divide' | 'list' | 'skip' | 'track' | 'visualize';

const SPECIFIER_MODIFIER_KIND_MAPPING: { [specifier: string]: ModifierKind } = {
	d: 'divide',
	l: 'list',
	s: 'skip',
	t: 'track',
	v: 'visualize'
};

export class Modifier {

	public readonly kind: ModifierKind;
	public readonly modifierArguments: string[];

	constructor(
		kind: ModifierKind,
		modifierArguments: string[]
	) {
		this.kind = kind;
		this.modifierArguments = modifierArguments;
	}

	static parse(modifierString: string): Modifier | null {
		if (!(modifierString[0] in SPECIFIER_MODIFIER_KIND_MAPPING)) {
			return null;
		}

		return new Modifier(
			SPECIFIER_MODIFIER_KIND_MAPPING[modifierString[0]],
			modifierString.length > 1 ? modifierString.slice(2, -1).split(',') : []
		);
	}

}

export default class SimulationAnnotation {

	public readonly lineNumber: number;
	public readonly modifiers: Modifier[];

	constructor(lineNumber: number, modifiers: Modifier[]) {
		this.lineNumber = lineNumber;
		this.modifiers = modifiers;
	}

	static extractAll(sourceCode: SourceCode): SimulationAnnotation[] {
		const annotations: SimulationAnnotation[] = [];

		for (let i = 0 ; i < sourceCode.lines.length ; i++) {
			const lineNumber: number = i + 1;
			const line: string = sourceCode.lines[i];

			const matches: RegExpMatchArray | null = line.match(SIMULATION_ANNOTATION_REGEX);

			if (matches == null) {
				continue;
			}

			annotations.push(SimulationAnnotation.parse(matches[0], lineNumber));
		}

		return annotations;
	}

	static parse(annotationString: string, lineNumber: number): SimulationAnnotation {
		const modifierMatches: RegExpMatchArray =
			annotationString.match(MODIFIER_REGEX) as RegExpMatchArray;

		return new SimulationAnnotation(
			lineNumber,
			modifierMatches.map(Modifier.parse).filter(modifier => modifier != null)
		);
	}

	static stripAll(sourceCode: string): string {
		return sourceCode.replaceAll(SIMULATION_ANNOTATION_REGEX, '')
			.split('\n')
			.map(line => line.trimEnd())
			.join('\n');
	}

}
