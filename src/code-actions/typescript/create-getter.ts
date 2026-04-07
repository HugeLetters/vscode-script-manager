import * as Effect from "effect/Effect";
import {
	type PropertyAssignment,
	ScriptKind,
	type ShorthandPropertyAssignment,
	SyntaxKind,
} from "ts-morph";
import { CodeActionKind, Range, WorkspaceEdit } from "vscode";
import { TsMorph } from "$/service/tsmorph";
import { CodeAction } from "$/vscode/code-action";
import { Language } from "$/vscode/language";

export const CreateGetter = new CodeAction({
	title: "Convert property to getter",
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

		if (!isCursorOnPropertyKey(property, cursorOffset)) {
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
	}, Effect.provide(TsMorph.Default)),
});

function isCursorOnPropertyKey(
	node: ShorthandPropertyAssignment | PropertyAssignment,
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
		return `get ${name}() { return ${name}; }`;
	}

	const name = node.getNameNode().getText();
	const initializer = node.getInitializer();
	if (!initializer) {
		return null;
	}

	return `get ${name}() { return ${initializer.getText()}; }`;
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
