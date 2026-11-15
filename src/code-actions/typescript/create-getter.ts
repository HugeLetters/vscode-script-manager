import * as Effect from "effect/Effect";
import {
	type GetAccessorDeclaration,
	type PropertyAssignment,
	ScriptKind,
	type SetAccessorDeclaration,
	type ShorthandPropertyAssignment,
	SyntaxKind,
} from "ts-morph";
import { CodeActionKind, Range, WorkspaceEdit } from "vscode";
import { TsMorph } from "$/service/tsmorph";
import { CodeAction } from "$/vscode/code-action";
import { Language } from "$/vscode/language";

export const CreateGetter = new CodeAction({
	title: "Convert to getter",
	kind: CodeActionKind.RefactorRewrite,
	task: Effect.fn(function* ({ action, document, range }) {
		const sourceFile = yield* TsMorph.with((project) =>
			project.createSourceFile("getter-file", document.getText(), {
				overwrite: true,
				scriptKind: getScriptKind(document.languageId),
			}),
		);

		const cursorOffset = document.offsetAt(range.start);
		const node = sourceFile.getDescendantAtPos(cursorOffset);
		if (!node) {
			return null;
		}

		const property = node.getFirstAncestor((ancestor) => {
			return (
				ancestor.isKind(SyntaxKind.ShorthandPropertyAssignment) ||
				ancestor.isKind(SyntaxKind.PropertyAssignment)
			);
		});

		if (!property) {
			return null;
		}

		if (!isCursorOnName(property, cursorOffset)) {
			return null;
		}

		const data = getPropertyGetterReplacement(property);
		if (!data) {
			return null;
		}

		const start = property.getStart();
		const end = property.getEnd();
		const editRange = new Range(
			document.positionAt(start),
			document.positionAt(end),
		);

		const edit = new WorkspaceEdit();
		edit.replace(document.uri, editRange, data);
		action.edit = edit;

		return action;
	}, Effect.provide(TsMorph.inMemory)),
});

export const CreateGetterAndSetter = new CodeAction({
	title: "Convert to get/set",
	kind: CodeActionKind.RefactorRewrite,
	task: Effect.fn(function* ({ action, document, range }) {
		const sourceFile = yield* TsMorph.with((project) =>
			project.createSourceFile("getter-setter-file", document.getText(), {
				overwrite: true,
				scriptKind: getScriptKind(document.languageId),
			}),
		);

		const cursorOffset = document.offsetAt(range.start);
		const node = sourceFile.getDescendantAtPos(cursorOffset);
		if (!node) {
			return null;
		}

		const property = node.getFirstAncestor((ancestor) => {
			return (
				ancestor.isKind(SyntaxKind.ShorthandPropertyAssignment) ||
				ancestor.isKind(SyntaxKind.PropertyAssignment)
			);
		});

		if (!property) {
			return null;
		}

		if (!isCursorOnName(property, cursorOffset)) {
			return null;
		}

		const data = getPropertyGetterAndSetterReplacement(property);
		if (!data) {
			return null;
		}

		const start = property.getStart();
		const end = property.getEnd();
		const editRange = new Range(
			document.positionAt(start),
			document.positionAt(end),
		);

		const edit = new WorkspaceEdit();
		edit.replace(document.uri, editRange, data);
		action.edit = edit;

		return action;
	}, Effect.provide(TsMorph.inMemory)),
});

export const CreateSetterFromGetter = new CodeAction({
	title: "Convert to get/set",
	kind: CodeActionKind.RefactorRewrite,
	task: Effect.fn(function* ({ action, document, range }) {
		const sourceFile = yield* TsMorph.with((project) =>
			project.createSourceFile(
				"getter-to-getter-setter-file",
				document.getText(),
				{
					overwrite: true,
					scriptKind: getScriptKind(document.languageId),
				},
			),
		);

		const cursorOffset = document.offsetAt(range.start);
		const node = sourceFile.getDescendantAtPos(cursorOffset);
		if (!node) {
			return null;
		}

		const getter = node.getFirstAncestorByKind(SyntaxKind.GetAccessor);
		if (!getter) {
			return null;
		}

		if (!isCursorOnName(getter, cursorOffset)) {
			return null;
		}

		if (hasSiblingSetter(getter)) {
			return null;
		}

		const data = getGetterAndSetterReplacement(getter);
		if (!data) {
			return null;
		}

		const start = getter.getStart();
		const end = getter.getEnd();
		const editRange = new Range(
			document.positionAt(start),
			document.positionAt(end),
		);

		const edit = new WorkspaceEdit();
		edit.replace(document.uri, editRange, data);
		action.edit = edit;

		return action;
	}, Effect.provide(TsMorph.inMemory)),
});

function isCursorOnName(
	node:
		| ShorthandPropertyAssignment
		| PropertyAssignment
		| GetAccessorDeclaration
		| SetAccessorDeclaration,
	cursorOffset: number,
) {
	const nameNode = node.getNameNode();

	const start = nameNode.getStart();
	const end = nameNode.getEnd();

	return cursorOffset >= start && cursorOffset <= end;
}

function getPropertyGetterReplacement(
	node: ShorthandPropertyAssignment | PropertyAssignment,
) {
	if (node.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
		const name = node.getName();
		return makeGetter(name, name);
	}

	const name = node.getNameNode().getText();
	const initializer = node.getInitializer();
	if (!initializer) {
		return null;
	}

	return makeGetter(name, initializer.getText());
}

function getPropertyGetterAndSetterReplacement(
	node: ShorthandPropertyAssignment | PropertyAssignment,
) {
	if (node.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
		const name = node.getName();
		return makeGetSet(name, name);
	}

	const name = node.getNameNode().getText();
	const initializer = node.getInitializer();
	if (!initializer) {
		return null;
	}

	const target = initializer.getText();
	return makeGetSet(name, target);
}

function makeGetter(key: string, value: string) {
	return `get ${key}() { return ${value}; }`;
}
function makeSetter(key: string, value: string) {
	return `set ${key}(v) { ${value} = v; }`;
}
function makeGetSet(key: string, value: string, sep = ",") {
	return `${makeGetter(key, value)}${sep}${makeSetter(key, value)}`;
}

function getGetterAndSetterReplacement(node: GetAccessorDeclaration) {
	const returnExpression = getGetterReturnExpressionText(node);
	if (!returnExpression) {
		return null;
	}

	const name = node.getNameNode().getText();
	const separator = node.getParent().isKind(SyntaxKind.ObjectLiteralExpression)
		? ", "
		: " ";

	return makeGetSet(name, returnExpression, separator);
}

function getGetterReturnExpressionText(node: GetAccessorDeclaration) {
	const body = node.getBody();
	if (!body || !body.isKind(SyntaxKind.Block)) {
		return null;
	}

	const statements = body.getStatements();
	if (statements.length !== 1) {
		return null;
	}

	const statement = statements[0];
	if (!statement?.isKind(SyntaxKind.ReturnStatement)) {
		return null;
	}

	const expression = statement.getExpression();
	if (!expression) {
		return null;
	}

	return expression.getText();
}

function hasSiblingSetter(node: GetAccessorDeclaration) {
	const parent = node.getParent();
	const name = node.getNameNode().getText();

	return parent
		.getChildrenOfKind(SyntaxKind.SetAccessor)
		.some((accessor) => accessor.getNameNode().getText() === name);
}

function getScriptKind(languageId: string) {
	switch (languageId) {
		case Language.ts:
			return ScriptKind.TS;
		case Language.tsx:
			return ScriptKind.TSX;
		case Language.js:
			return ScriptKind.JS;
		case Language.jsx:
			return ScriptKind.JSX;
		default:
			return ScriptKind.Deferred;
	}
}
