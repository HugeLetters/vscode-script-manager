import * as Path from "@effect/platform/Path";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { Position, Selection, TextEditor as VsTextEditor } from "vscode";
import { asError } from "$/utils/error";
import { effectify } from "$/utils/promise";
import { CurrentDirectory } from "../service/directory";

interface TextEditorLiveConfig {
	/** @private */
	readonly service: VsTextEditor;
}

export class TextEditor extends Effect.Service<TextEditor>()(
	"script-manager/editor/TextEditor",
	{
		effect(editor: VsTextEditor) {
			return Effect.succeed<TextEditorLiveConfig>({ service: editor });
		},
	},
) {
	use = Effect.fn("use")(
		<T>(run: (editor: VsTextEditor) => Thenable<T> | PromiseLike<T> | T) => {
			return Effect.tryPromise({
				try: async () => {
					return run(this.service);
				},
				catch(error) {
					return new TextEditorError({ cause: error });
				},
			});
		},
	);

	// TODO master | should fail on result = false instead | by Evgenii Perminov at Mon, 06 Apr 2026 20:48:50 GMT
	edit = Effect.fn("edit")(
		effectify(
			this.service.edit,
			(error) => new TextEditorError({ cause: error }),
		),
	);

	insert = Effect.fn("insert")(
		(
			location: Position,
			value: string,
			options?: Parameters<VsTextEditor["edit"]>[1],
		) => {
			return this.edit((b) => {
				b.insert(location, value);
			}, options);
		},
	);

	get selection() {
		return this.service.selection;
	}
	setSelection(selection: Selection) {
		this.service.selection = selection;
	}
}

export namespace TextEditor {
	export const CurrentDirectoryLive = Layer.effect(
		CurrentDirectory,
		Effect.gen(function* () {
			const editor = yield* TextEditor;
			const path = yield* Path.Path;
			const editorPath = editor.service.document.uri.fsPath;
			return path.dirname(editorPath);
		}),
	);
}

export class TextEditorError extends Data.TaggedError("TextEditorError")<{
	cause: unknown;
}> {
	override message = asError(this.cause).message;
}
