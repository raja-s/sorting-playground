
import {
	type ASTNodeUnion,
	type ClassDef,
	type For,
	type FunctionDef,
	type If,
	type Match,
	type While,
	type With
} from 'py-ast';

import SourceCode from './SourceCode.ts';

import BaseNodeVisitor from './BaseNodeVisitor.ts';

import { type TextCoordinates } from '../common.ts';
import { countOccurrences } from './common.ts';

const HEADER_END_SYMBOL = ':';

export default class CodeBlockEndsSetterVisitor extends BaseNodeVisitor {

	constructor(sourceCode: SourceCode) {
		super(sourceCode);
	}

	visitClassDef(classNode: ClassDef): void {
		this.genericVisit(classNode);

		// WARNING: Class headers may contain colons in the type parameter list or
		//          in the base class list, so this might fail for complex classes.
		classNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbolFromPosition(
				HEADER_END_SYMBOL,
				classNode.lineno as number,
				classNode.col_offset as number
			);
	}

	visitFunctionDef(functionNode: FunctionDef): void {
		this.genericVisit(functionNode);

		functionNode.codeBlockHeaderEnd =
			functionNode.args.args.length > 0 ?
				this.getEndForClosingSymbol(
					HEADER_END_SYMBOL,
					functionNode.args.args[functionNode.args.args.length - 1]
				) :
				this.getEndForClosingSymbolFromPosition(
					HEADER_END_SYMBOL,
					functionNode.lineno as number,
					functionNode.col_offset as number
				);
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: If): void {
		this.genericVisit(ifNode);

		ifNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbol(HEADER_END_SYMBOL, ifNode.test);
	}

	visitMatch(matchNode: Match): void {
		this.genericVisit(matchNode);

		matchNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbol(HEADER_END_SYMBOL, matchNode.subject);
	}

	visitWith(withNode: With): void {
		this.genericVisit(withNode);

		withNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbol(
				HEADER_END_SYMBOL,
				withNode.items[withNode.items.length - 1]
			);
	}

	visitFor(forNode: For): void {
		this.genericVisit(forNode);

		forNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbol(HEADER_END_SYMBOL, forNode.iter);
	}

	visitWhile(whileNode: While): void {
		this.genericVisit(whileNode);

		whileNode.codeBlockHeaderEnd =
			this.getEndForClosingSymbol(HEADER_END_SYMBOL, whileNode.test);
	}

	getEndForClosingSymbol(
		closingSymbol: string,
		lastNestedElement: ASTNodeUnion
	): TextCoordinates {
		return this.getEndForClosingSymbolFromPosition(
			closingSymbol,
			lastNestedElement.end_lineno as number,
			lastNestedElement.end_col_offset
		);
	}

	getEndForClosingSymbolFromPosition(
		closingSymbol: string,
		lineNumber: number,
		columnOffset: number
	): TextCoordinates {
		const coordinates: TextCoordinates =
			this.findSymbolFromPosition(closingSymbol, lineNumber, columnOffset);

		return {
			lineNumber: coordinates.lineNumber,
			columnOffset: coordinates.columnOffset + closingSymbol.length
		};
	}

	findSymbolFromPosition(
		searchSymbol: string,
		lineNumber: number,
		columnOffset: number
	): TextCoordinates {
		const absolutePosition: number = this.getAbsolutePosition(lineNumber, columnOffset);

		const symbolIndex: number =
			this.sourceCode.content.indexOf(searchSymbol, absolutePosition);

		const sourceCodeSlice: string =
			this.sourceCode.content.slice(absolutePosition, symbolIndex);
		const lineBreakCount: number = countOccurrences('\n', sourceCodeSlice);

		const symbolLineNumber: number = lineNumber + lineBreakCount;

		return {
			lineNumber: symbolLineNumber,
			columnOffset: lineBreakCount === 0 ? columnOffset + sourceCodeSlice.length :
				this.sourceCode.lines[symbolLineNumber - 1].indexOf(searchSymbol)
		};
	}

}
