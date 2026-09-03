
import {
	type ASTNodeUnion,
	type Assign,
	type Attribute,
	type Break,
	type Call,
	type Constant,
	type Continue,
	type ExprNode,
	type FormattedValue,
	type JoinedStr,
	type Match,
	type Name,
	type Pass,
	type Raise,
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

	override visit(node: ASTNodeUnion): void {
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

	override visitAssign(assignNode: Assign): void {
		this.genericVisit(assignNode);

		copyEnds(assignNode.value, assignNode);
	}

	override visitAnnAssign(assignNode: Assign): void {
		this.visitAssign(assignNode);
	}

	override visitName(nameNode: Name): void {
		nameNode.end_lineno = nameNode.lineno;
		nameNode.end_col_offset = nameNode.col_offset + nameNode.id.length;
	}

	override visitAttribute(attributeNode: Attribute): void {
		this.genericVisit(attributeNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(attributeNode.attr, attributeNode.value);

		attributeNode.end_lineno = endCoordinates.lineNumber;
		attributeNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitList(listNode: ASTNodeUnion): void {
		this.genericVisit(listNode);

		const endCoordinates: TextCoordinates =
			listNode.elts.length === 0 ?
				this.getEndForClosingSymbolFromPosition(']', listNode.lineno, listNode.col_offset) :
				this.getEndForClosingSymbol(']', listNode.elts[listNode.elts.length - 1]);

		listNode.end_lineno = endCoordinates.lineNumber;
		listNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitConstant(constantNode: Constant): void {
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

				// WARNING: In some cases, like a string pattern in a match case, this "kind" field,
				//          which is supposed to represent the string delimiter, is not even defined
				//          on the node, resulting in an incorrect end_col_offset. Still, we must
				//          fall back to empty delimiter here because JoinedStr represents the inner
				//          string parts as Constant nodes of this type.
				const delimiter: string = constantNode.kind || '';

				constantNode.end_lineno = constantNode.lineno + lineBreakCount;
				constantNode.end_col_offset =
					lineBreakCount === 0 ?
						constantNode.col_offset + constantNode.value.length + delimiter.length * 2 :
						this.sourceCode.lines[constantNode.end_lineno - 1].indexOf(delimiter) +
							delimiter.length;
				break;
			}
		}
	}

	override visitJoinedStr(joinedStrNode: JoinedStr): void {
		const delimiter: string = joinedStrNode.kind.slice(1);

		const values: ExprNode[] = joinedStrNode.values;

		let previousValue: ExprNode | null = null;

		for (const value of values) {
			if (value.nodeType === 'Constant') {
				this.visitConstant(value);
			} else if (value.nodeType === 'FormattedValue') {
				this.visitFormattedValue(
					value,
					previousValue || {
						end_lineno: joinedStrNode.lineno,
						end_col_offset: joinedStrNode.col_offset + 1 + delimiter.length
					}
				);
			}

			previousValue = value;
		}

		if (previousValue == null) {
			joinedStrNode.end_lineno = joinedStrNode.lineno;
			joinedStrNode.end_col_offset =
				joinedStrNode.col_offset + 1 + delimiter.length * 2;
		} else {
			joinedStrNode.end_lineno = previousValue.end_lineno;
			joinedStrNode.end_col_offset = previousValue.end_col_offset + delimiter.length;
		}
	}

	visitFormattedValue(
		formattedValueNode: FormattedValue,
		previousValue: ExprNode
	): void {
		formattedValueNode.lineno = previousValue.end_lineno;
		formattedValueNode.col_offset = previousValue.end_col_offset;

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbolFromPosition(
				'}',
				formattedValueNode.lineno,
				formattedValueNode.col_offset
			);

		formattedValueNode.end_lineno = endCoordinates.lineNumber;
		formattedValueNode.end_col_offset = endCoordinates.columnOffset;

		this.genericVisit(formattedValueNode);
	}

	override visitTuple(tupleNode: Tuple): void {
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

	override visitCall(callNode: Call): void {
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

	override visitClassDef(classNode: ASTNodeUnion): void {
		this.genericVisit(classNode);

		// WARNING: Class headers may contain colons in the type parameter list or
		//          in the base class list, so this might fail for complex classes.
		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbolFromPosition(':', classNode.lineno, classNode.col_offset)

		classNode.end_lineno = endCoordinates.lineNumber;
		classNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitFunctionDef(functionNode: ASTNodeUnion): void {
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

	override visitArguments(argumentsNode: ASTNodeUnion): void {
		this.genericVisit(argumentsNode);

		const endCoordinates: TextCoordinates =
			argumentsNode.args.length === 0 ?
				this.getEndForClosingSymbolFromPosition(')', argumentsNode.lineno, argumentsNode.col_offset) :
				this.getEndForClosingSymbol(')', argumentsNode.args[argumentsNode.args.length - 1]);

		argumentsNode.end_lineno = endCoordinates.lineNumber;
		argumentsNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitArg(argNode: ASTNodeUnion): void {
		argNode.end_lineno = argNode.lineno;
		argNode.end_col_offset = argNode.col_offset + argNode.arg.length;
	}

	override visitTypeVar(typeVarNode: ASTNodeUnion): void {
		typeVarNode.end_lineno = typeVarNode.lineno;
		typeVarNode.end_col_offset = typeVarNode.col_offset + typeVarNode.name.length;
	}

	/**
	 * WARNING: `ifNode` could also be the if of an elif.
     */
	override visitIf(ifNode: ASTNodeUnion): void {
		this.genericVisit(ifNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', ifNode.test);

		ifNode.end_lineno = endCoordinates.lineNumber;
		ifNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitMatch(matchNode: Match): void {
		this.genericVisit(matchNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', matchNode.subject);

		matchNode.end_lineno = endCoordinates.lineNumber;
		matchNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitCompare(compareNode: ASTNodeUnion): void {
		this.genericVisit(compareNode);

		copyEnds(compareNode.comparators[compareNode.comparators.length - 1], compareNode);
	}

	override visitSubscript(subscriptNode: ASTNodeUnion): void {
		this.genericVisit(subscriptNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(']', subscriptNode.slice);

		subscriptNode.end_lineno = endCoordinates.lineNumber;
		subscriptNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitFor(forNode: ASTNodeUnion): void {
		this.genericVisit(forNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', forNode.iter);

		forNode.end_lineno = endCoordinates.lineNumber;
		forNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitWhile(whileNode: ASTNodeUnion): void {
		this.genericVisit(whileNode);

		const endCoordinates: TextCoordinates =
			this.getEndForClosingSymbol(':', whileNode.test);

		whileNode.end_lineno = endCoordinates.lineNumber;
		whileNode.end_col_offset = endCoordinates.columnOffset;
	}

	override visitReturn(returnNode: ASTNodeUnion): void {
		this.genericVisit(returnNode);

		if (returnNode.value == null) {
			returnNode.end_lineno = returnNode.lineno;
			returnNode.end_col_offset = returnNode.col_offset + 6;
		}
	}

	override visitPass(passNode: Pass): void {
		this.genericVisit(passNode);

		passNode.end_lineno = passNode.lineno;
		passNode.end_col_offset = passNode.col_offset + 4;
	}

	override visitBreak(breakNode: Break): void {
		this.genericVisit(breakNode);

		breakNode.end_lineno = breakNode.lineno;
		breakNode.end_col_offset = breakNode.col_offset + 5;
	}

	override visitContinue(continueNode: Continue): void {
		this.genericVisit(continueNode);

		continueNode.end_lineno = continueNode.lineno;
		continueNode.end_col_offset = continueNode.col_offset + 8;
	}

	override visitRaise(raiseNode: Raise): void {
		this.genericVisit(raiseNode);

		if (raiseNode.exc == null) {
			raiseNode.end_lineno = raiseNode.lineno;
			raiseNode.end_col_offset = raiseNode.col_offset + 5;
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
