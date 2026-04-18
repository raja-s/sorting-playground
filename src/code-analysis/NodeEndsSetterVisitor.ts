
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

import SourceCode from './SourceCode.ts';

import BaseNodeVisitor from './BaseNodeVisitor.ts';

import { type TextCoordinates } from '../common.ts';
import { countOccurrences } from './common.ts';

export default class NodeEndsSetterVisitor extends BaseNodeVisitor {

	constructor(sourceCode: SourceCode) {
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

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(attributeNode.attr, attributeNode.value);

		attributeNode.end_lineno = endCoordinates.lineNumber;
		attributeNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitList(listNode: ASTNodeUnion): void {
		this.genericVisit(listNode);

		const endCoordinates: TextCoordinates =
			listNode.elts.length === 0 ?
				this.getEndForClosingSymbolFromPosition(']', listNode.lineno, listNode.col_offset) :
				this.getEndForClosingSymbol(']', listNode.elts[listNode.elts.length - 1]);

		listNode.end_lineno = endCoordinates.lineNumber;
		listNode.end_col_offset = endCoordinates.columnOffset;
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
						this.sourceCode.lines[constantNode.end_lineno - 1].indexOf(constantNode.kind) +
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

		const endCoordinates: TextCoordinates =
			tupleNode.elts.length === 0 ?
				this.getEndForClosingSymbolFromPosition(')', tupleNode.lineno, tupleNode.col_offset) :
				this.getEndForClosingSymbol(')', tupleNode.elts[tupleNode.elts.length - 1]);

		tupleNode.end_lineno = endCoordinates.lineNumber;
		tupleNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitCall(callNode: Call): void {
		this.genericVisit(callNode);

		const endCoordinates: TextCoordinates =
			callNode.args.length === 0 ?
				this.getEndForClosingSymbolFromPosition(
					')',
					callNode.func.end_lineno,
					callNode.func.end_col_offset
				) :
				this.getEndForClosingSymbol(')', callNode.args[callNode.args.length - 1]);

		callNode.end_lineno = endCoordinates.lineNumber;
		callNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitClassDef(classNode: ASTNodeUnion): void {
		this.genericVisit(classNode);

		// WARNING: Class headers may contain colons in the type parameter list or
		//          in the base class list, so this might fail for complex classes.
		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbolFromPosition(':', classNode.lineno, classNode.col_offset)

		classNode.end_lineno = endCoordinates.lineNumber;
		classNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitFunctionDef(functionNode: ASTNodeUnion): void {
		const argumentsStartCoordinates: TextCoordinates =
			this.findSymbolFromPosition('(', functionNode.lineno, functionNode.col_offset);

		functionNode.args.lineno = argumentsStartCoordinates.lineNumber;
		functionNode.args.col_offset = argumentsStartCoordinates.columnOffset;

		this.genericVisit(functionNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', functionNode.args);

		functionNode.end_lineno = endCoordinates.lineNumber;
		functionNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitArguments(argumentsNode: ASTNodeUnion): void {
		this.genericVisit(argumentsNode);

		const endCoordinates: TextCoordinates =
			argumentsNode.args.length === 0 ?
				this.getEndForClosingSymbolFromPosition(')', argumentsNode.lineno, argumentsNode.col_offset) :
				this.getEndForClosingSymbol(')', argumentsNode.args[argumentsNode.args.length - 1]);

		argumentsNode.end_lineno = endCoordinates.lineNumber;
		argumentsNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitArg(argNode: ASTNodeUnion): void {
		argNode.end_lineno = argNode.lineno;
		argNode.end_col_offset = argNode.col_offset + argNode.arg.length;
	}

	visitTypeVar(typeVarNode: ASTNodeUnion): void {
		typeVarNode.end_lineno = typeVarNode.lineno;
		typeVarNode.end_col_offset = typeVarNode.col_offset + typeVarNode.name.length;
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	visitIf(ifNode: ASTNodeUnion): void {
		this.genericVisit(ifNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', ifNode.test);

		ifNode.end_lineno = endCoordinates.lineNumber;
		ifNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitCompare(compareNode: ASTNodeUnion): void {
		this.genericVisit(compareNode);

		copyEnds(compareNode.comparators[compareNode.comparators.length - 1], compareNode);
	}

	visitSubscript(subscriptNode: ASTNodeUnion): void {
		this.genericVisit(subscriptNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(']', subscriptNode.slice);

		subscriptNode.end_lineno = endCoordinates.lineNumber;
		subscriptNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitFor(forNode: ASTNodeUnion): void {
		this.genericVisit(forNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', forNode.iter);

		forNode.end_lineno = endCoordinates.lineNumber;
		forNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitWhile(whileNode: ASTNodeUnion): void {
		this.genericVisit(whileNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', whileNode.test);

		whileNode.end_lineno = endCoordinates.lineNumber;
		whileNode.end_col_offset = endCoordinates.columnOffset;
	}

	visitReturn(returnNode: ASTNodeUnion): void {
		this.genericVisit(returnNode);

		if (returnNode.value == null) {
			returnNode.end_lineno = returnNode.lineno;
			returnNode.end_col_offset = returnNode.col_offset + 6;
		}
	}

	getEndForClosingSymbol(
		closingSymbol: string,
		lastNestedElement: ASTNodeUnion
	): TextCoordinates {
		return this.getEndForClosingSymbolFromPosition(
			closingSymbol,
			lastNestedElement.end_lineno,
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

function copyEnds(sourceNode: ASTNodeUnion, targetNode: ASTNodeUnion): void {
	targetNode.end_lineno = sourceNode.end_lineno;
	targetNode.end_col_offset = sourceNode.end_col_offset;
}
