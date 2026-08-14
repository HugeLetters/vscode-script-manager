import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Selection } from "vscode";
import { Git } from "$/service/git";
import { StringUtils } from "$/utils/string";
import { Command } from "$/vscode/command";
import { TextEditor } from "$/vscode/editor";

export const InsertTodoComment = new Command.TextCommand({
	id: "insert-todo-comment",
	name: "Todo Comment",
	task: Effect.gen(function* () {
		yield* Effect.log("Inserting todo comment");

		const selection = yield* TextEditor.Selection;
		const position = selection.start;
		const lineStartPosition = position.with(undefined, 0);

		yield* TextEditor.insert(lineStartPosition, "\n", {
			undoStopBefore: false,
			undoStopAfter: false,
		});

		yield* TextEditor.setSelection(
			new Selection(lineStartPosition, lineStartPosition),
		);

		const now = yield* DateTime.nowAsDate;
		const branch = yield* Git.Branch.pipe(
			Effect.map(Option.map((b) => `${b.current} `)),
			Effect.map(Option.getOrElse(() => null)),
		);
		const preDescrptionChunk = StringUtils.template`TODO ${branch}| `;
		yield* TextEditor.insert(
			lineStartPosition,
			`${preDescrptionChunk} | by Evgenii Perminov at ${now.toUTCString()}`,
			{
				undoStopBefore: false,
				undoStopAfter: false,
			},
		);

		const descriptionPosition = lineStartPosition.with(
			undefined,
			preDescrptionChunk.length,
		);
		yield* TextEditor.setSelection(
			new Selection(descriptionPosition, descriptionPosition),
		);

		yield* Command.execute("editor.action.addCommentLine");
	}).pipe(Effect.provide([Git.Default])),
});
