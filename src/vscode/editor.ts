import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type { Position, Selection, TextEditor as VsTextEditor } from "vscode";
import { asError } from "$/utils/error";
import { CurrentDirectory } from "../service/directory";

type TextEditorEditParams = Parameters<VsTextEditor["edit"]>;
type TextEditorEditOptions = TextEditorEditParams[1];

export class TextEditor extends Context.Service<TextEditor, VsTextEditor>()(
	"script-manager/editor/TextEditor",
	{},
) {
	static readonly make = Layer.succeed(TextEditor);

	static with = Effect.fn("with")(function* <T>(
		run: (editor: VsTextEditor) => PromiseLike<T> | T,
	) {
		const editor = yield* TextEditor;
		return yield* Effect.tryPromise({
			try: async () => {
				return run(editor);
			},
			catch(error) {
				return new TextEditorError({ cause: error });
			},
		});
	});

	static edit = Effect.fn("edit")(function* (...args: TextEditorEditParams) {
		const result = yield* TextEditor.with((editor) => editor.edit(...args));
		if (result) {
			return;
		}

		return yield* new TextEditorError({ cause: "Failed to apply edits" });
	});

	static insert = Effect.fn("insert")(
		(location: Position, value: string, options?: TextEditorEditOptions) => {
			return TextEditor.edit((b) => {
				b.insert(location, value);
			}, options);
		},
	);

	static Selection = Effect.gen(function* () {
		const editor = yield* TextEditor;
		return editor.selection;
	});

	static setSelection = Effect.fn(function* (selection: Selection) {
		const editor = yield* TextEditor;
		editor.selection = selection;
	});
}

export namespace TextEditor {
	export const CurrentDirectoryLive = Layer.effect(
		CurrentDirectory,
		Effect.gen(function* () {
			const editor = yield* TextEditor;
			const path = yield* Path.Path;
			const editorPath = editor.document.uri.fsPath;
			return path.dirname(editorPath);
		}),
	);
}

export class TextEditorError extends Data.TaggedError("TextEditorError")<{
	cause: unknown;
}> {
	override message = asError(this.cause).message;
}
