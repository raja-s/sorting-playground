
import {
	type ASTNodeUnion,
	type Assign,
	type Attribute,
	type Call,
	type Constant,
	type Name,
	type Tuple,
	iterChildNodes
} from 'py-ast';

import BaseNodeVisitor from './BaseNodeVisitor.ts';

import { countOccurrences } from './common.ts';

export default class NodeEndsSetterVisitor extends BaseNodeVisitor {

	constructor(sourceCode: string) {
		super(sourceCode);
	}

	visit(node: ASTNodeUnion): void {
		super.visit(node);

		let children = null;

		if (!('end_lineno' in node)) {
			children = [ ...iterChildNodes(node) ];
			if (children.length !== 0) {
				node.end_lineno = children[children.length - 1].end_lineno;
			}
		}

		if (!('end_col_offset' in node)) {
			if (children == null) {
				children = [ ...iterChildNodes(node) ];
			}
			if (children.length !== 0) {
				node.end_col_offset = children[children.length - 1].end_col_offset;
			}
		}
	}

	visitAssign(assignNode: Assign): void {
		this.genericVisit(assignNode);

		copyEnds(assignNode.value, assignNode);
	}

	visitAnnAssign(assignNode: Assign): void {
		this.visitAssign(assignNode);
	}

	visitName(nameNode: Name): void {
		nameNode.end_lineno = nameNode.lineno;
		nameNode.end_col_offset = nameNode.col_offset + nameNode.id.length;
	}

	visitAttribute(attributeNode: Attribute): void {
		this.genericVisit(attributeNode);

		const { endLineNumber, endColumnOffset } =
			this.getEndsForClosingSymbol(attributeNode.value, attributeNode.attr);

		attributeNode.end_lineno = endLineNumber;
		attributeNode.end_col_offset = endColumnOffset;
	}

	visitList(listNode: ASTNodeUnion): void {
		this.genericVisit(listNode);

		const { endLineNumber, endColumnOffset } =
			listNode.elts.length === 0 ?
				this.getEndsForClosingSymbolFromPosition(
					listNode.lineno,
					listNode.col_offset,
					']'
				) :
				this.getEndsForClosingSymbol(listNode.elts[listNode.elts.length - 1], ']');

		listNode.end_lineno = endLineNumber;
		listNode.end_col_offset = endColumnOffset;
	}

	visitConstant(constantNode: Constant): void {
		switch (typeof(constantNode.value)) {
			case 'boolean': {
				constantNode.end_lineno = constantNode.lineno;
				constantNode.end_col_offset = constantNode.col_offset + (constantNode.value ? 4 : 5);
				break;
			}

			case 'number': {
				constantNode.end_lineno = constantNode.lineno;
				constantNode.end_col_offset = constantNode.col_offset + `${constantNode.value}`.length;
				break;
			}

			case 'string': {
				const lineBreakCount: number = countOccurrences('\n', constantNode.value);
				constantNode.end_lineno = constantNode.lineno + lineBreakCount;
				constantNode.end_col_offset =
					lineBreakCount === 0 ?
						constantNode.col_offset + constantNode.value.length + constantNode.kind.length * 2 :
						this.sourceCodeLines[constantNode.end_lineno - 1].indexOf(constantNode.kind) +
							constantNode.kind.length;
				break;
			}
		}
	}

	visitTuple(tupleNode: Tuple): void {
		this.genericVisit(tupleNode);

		if (
			tupleNode.elts.length !== 0 &&
			tupleNode.col_offset === tupleNode.elts[0].col_offset
		) {
			copyEnds(tupleNode.elts[tupleNode.elts.length - 1], tupleNode);
			return;
		}

		const { endLineNumber, endColumnOffset } =
			tupleNode.elts.length === 0 ?
				this.getEndsForClosingSymbolFromPosition(tupleNode.lineno, tupleNode.col_offset, ')') :
				this.getEndsForClosingSymbol(tupleNode.elts[tupleNode.elts.length - 1], ')');

		tupleNode.end_lineno = endLineNumber;
		tupleNode.end_col_offset = endColumnOffset;
	}

	visitCall(callNode: Call): void {
		this.genericVisit(callNode);

		const { endLineNumber, endColumnOffset } =
			callNode.args.length === 0 ?
				this.getEndsForClosingSymbolFromPosition(
					callNode.func.end_lineno,
					callNode.func.end_col_offset,
					')'
				) :
				this.getEndsForClosingSymbol(callNode.args[callNode.args.length - 1], ')');

		callNode.end_lineno = endLineNumber;
		callNode.end_col_offset = endColumnOffset;
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: ASTNodeUnion): void {
		this.genericVisit(ifNode);

		const { endLineNumber, endColumnOffset } =
			this.getEndsForClosingSymbol(ifNode.test, ':');

		ifNode.end_lineno = endLineNumber;
		ifNode.end_col_offset = endColumnOffset;
	}

	visitCompare(compareNode: ASTNodeUnion): void {
		this.genericVisit(compareNode);

		copyEnds(compareNode.comparators[compareNode.comparators.length - 1], compareNode);
	}

	visitSubscript(subscriptNode: ASTNodeUnion): void {
		this.genericVisit(subscriptNode);

		const { endLineNumber, endColumnOffset } =
			this.getEndsForClosingSymbol(subscriptNode.slice, ']');

		subscriptNode.end_lineno = endLineNumber;
		subscriptNode.end_col_offset = endColumnOffset;
	}

	visitFor(forNode: ASTNodeUnion): void {
		this.genericVisit(forNode);

		const { endLineNumber, endColumnOffset } =
			this.getEndsForClosingSymbol(forNode.iter, ':');

		forNode.end_lineno = endLineNumber;
		forNode.end_col_offset = endColumnOffset;
	}

	visitWhile(whileNode: ASTNodeUnion): void {
		this.genericVisit(whileNode);

		const { endLineNumber, endColumnOffset } =
			this.getEndsForClosingSymbol(whileNode.test, ':');

		whileNode.end_lineno = endLineNumber;
		whileNode.end_col_offset = endColumnOffset;
	}

	getEndsForClosingSymbol(
		lastNestedElement: ASTNodeUnion,
		closingSymbol: string
	): { endLineNumber: number, endColumnOffset: number } {
		return this.getEndsForClosingSymbolFromPosition(
			lastNestedElement.end_lineno,
			lastNestedElement.end_col_offset,
			closingSymbol
		);
	}

	getEndsForClosingSymbolFromPosition(
		lineNumber: number,
		columnOffset: number,
		closingSymbol: string
	): { endLineNumber: number, endColumnOffset: number } {
		const absolutePosition: number = this.getAbsolutePosition(lineNumber, columnOffset);

		const closingSymbolIndex: number =
			this.sourceCode.indexOf(closingSymbol, absolutePosition);

		const sourceCodeSlice: string =
			this.sourceCode.slice(absolutePosition, closingSymbolIndex);
		const lineBreakCount: number = countOccurrences('\n', sourceCodeSlice);

		const endLineNumber: number = lineNumber + lineBreakCount;
		let endColumnOffset: number =
			lineBreakCount === 0 ? columnOffset + sourceCodeSlice.length :
				this.sourceCodeLines[endLineNumber - 1].indexOf(closingSymbol);
		endColumnOffset += closingSymbol.length;

		return { endLineNumber, endColumnOffset };
	}

}

function copyEnds(sourceNode: ASTNodeUnion, targetNode: ASTNodeUnion): void {
	targetNode.end_lineno = sourceNode.end_lineno;
	targetNode.end_col_offset = sourceNode.end_col_offset;
}
