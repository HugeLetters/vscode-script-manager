import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { Command } from "$/vscode/command";
import { InsertTodoComment } from "./todo";

const Commands: ReadonlyArray<Command.AnyCommand> = [InsertTodoComment];

export const RegisterCommands = Effect.gen(function* () {
	const registered = yield* pipe(
		Commands,
		Arr.map((command) =>
			pipe(
				command,
				(command) => {
					if (command._tag === "TextCommand") {
						return Command.registerTextCommand(command);
					}

					return Command.registerCommand(command);
				},
				Effect.tapError((cause) =>
					Effect.logError(`Failed to register command ${command.id}`, cause),
				),
				Effect.map((disposable) => {
					return { command, disposable };
				}),
			),
		),
		Effect.allWith({ concurrency: "unbounded", mode: "either" }),
		Effect.map(Arr.getRights),
	);

	yield* Effect.log(
		"Registered commands",
		registered.map(({ command }) => command.id),
	);

	return registered.map(({ disposable }) => disposable);
});
