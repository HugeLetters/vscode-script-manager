import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { commands } from "vscode";
import { CommandPrefix } from "$/config";
import type { SharedRuntimeContext } from "$/runtime";
import { Runtime } from "$/runtime";
import type { CurrentDirectory } from "$/service/directory";
import { asError } from "$/utils/error";
import { TextEditor } from "$/vscode/editor";

export namespace Command {
	interface CommandConfig<C = never> {
		readonly id: string;
		readonly name: string;
		readonly when?: string;
		readonly task: Effect.Effect<void, unknown, SharedRuntimeContext | C>;
	}

	export class Command extends Data.TaggedClass("Command")<CommandConfig> {}

	/** Unlike regular {@link Command} this command has access to active {@link TextEditor} and such */
	export class TextCommand extends Data.TaggedClass("TextCommand")<
		CommandConfig<CurrentDirectory | TextEditor>
	> {}

	export type AnyCommand = Command | TextCommand;

	export const registerCommand = Effect.fn("registerCommand")(function* (
		command: Command,
	) {
		const run = yield* Runtime;
		const prefix = yield* CommandPrefix;

		return yield* tryPromise(() => {
			return commands.registerCommand(`${prefix}.${command.id}`, () =>
				command.task.pipe(run),
			);
		});
	});

	export const registerTextCommand = Effect.fn("registerTextCommand")(
		function* (command: TextCommand) {
			const run = yield* Runtime;
			const prefix = yield* CommandPrefix;

			return yield* tryPromise(() => {
				return commands.registerTextEditorCommand(
					`${prefix}.${command.id}`,
					(editor) => {
						const EditorLayer = Layer.provideMerge(
							TextEditor.CurrentDirectoryLive,
							TextEditor.Default(editor),
						);
						return command.task.pipe(Effect.provide([EditorLayer]), run);
					},
				);
			});
		},
	);

	export const execute = Effect.fn("execute")((command: string) => {
		return Effect.tryPromise({
			try() {
				return commands.executeCommand(command);
			},
			catch(error) {
				return new CommandError({ cause: error });
			},
		});
	});

	const tryPromise = Effect.fn("tryPromise")(
		<R>(run: () => R | PromiseLike<R>) => {
			return Effect.tryPromise({
				try: async () => run(),
				catch(error) {
					return new CommandError({ cause: error });
				},
			});
		},
	);
}

export class CommandError extends Data.TaggedError("CommandError")<{
	cause: unknown;
}> {
	override message = asError(this.cause).message;
}
