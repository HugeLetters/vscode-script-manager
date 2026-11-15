import * as Effect from "effect/Effect";
import { Command } from "$/vscode/command";
import { RenameTab } from "./rename-tab";
import { InsertTodoComment } from "./todo";

const Commands: ReadonlyArray<Command.AnyCommand> = [
	InsertTodoComment,
	RenameTab,
];

export const RegisterCommands = Effect.gen(function* () {
	const registered = yield* Effect.partition(
		Commands,
		(command) => {
			return Command.registerAnyCommand(command).pipe(
				Effect.tapError((error) =>
					Effect.logError(`Failed to register command ${command.id}`, error),
				),
				Effect.map((disposable) => {
					return { command, disposable };
				}),
			);
		},
		{ concurrency: "unbounded" },
	).pipe(Effect.map(([registered]) => registered));

	yield* Effect.log(
		"Registered commands",
		registered.map(({ command }) => command.id),
	);

	return registered.map(({ disposable }) => disposable);
});
