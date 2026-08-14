import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import type { NewExpression } from "ts-morph";
import { CommandPrefix } from "$/config";
import { TsMorph } from "$/service/tsmorph";
import type { Command } from "$/vscode/command";
import type { CommandDeclaration } from "./schema";
import {
	getNodeLocator,
	getNodeNewExpressionInitializers,
	getObjectLiteralFirstArg,
	getOptionalStringLiteralProperty,
	getStringLiteralProperty,
	getVariableArrayElements,
	getVariableValue,
} from "./utils/tsmorph";

const CommandsVariable = "Commands";

export const GetCommands = Effect.gen(function* () {
	const path = yield* Path.Path;

	// we resort to this cause commands/etc import 'vscode' module which doesnt exist for us
	const commandsDir = path.resolve(import.meta.dir, "..", "..", "commands");
	const commandsPath = path.join(commandsDir, "index.ts");

	const source = yield* TsMorph.addSourceFile(commandsPath);
	const commandsVar = yield* getVariableValue(source, CommandsVariable);
	const commandElements = yield* getVariableArrayElements(commandsVar);

	const commandInitializers = yield* pipe(
		commandElements,
		Arr.map(getNodeNewExpressionInitializers),
		(effects) => Effect.all(effects, { concurrency: "unbounded" }),
		Effect.map(Iterable.flatten<NewExpression>),
	);

	return yield* pipe(
		commandInitializers,
		Arr.dedupe,
		Iterable.map(getCommandMetadata),
		(effects) => Effect.all(effects, { concurrency: "unbounded" }),
	);
});

const getCommandMetadata = Effect.fn("getCommandMetadata")(function* (
	command: NewExpression,
) {
	const prefix = yield* CommandPrefix;
	return yield* pipe(
		getObjectLiteralFirstArg(command),
		Effect.flatMap(
			Effect.fnUntraced(function* (arg) {
				const id = yield* getStringLiteralProperty<CommandProperty>(arg, "id");
				const name = yield* getStringLiteralProperty<CommandProperty>(
					arg,
					"name",
				);
				const when = yield* getOptionalStringLiteralProperty<CommandProperty>(
					arg,
					"when",
				);

				const result: CommandDeclaration = {
					command: `${prefix}.${id}`,
					title: name,
					enablement: Option.getOrUndefined(when),
				};

				return result;
			}),
		),
		Effect.mapError((cause) => new CommandMetaError({ command, cause })),
	);
});

type CommandProperty = keyof Command.AnyCommand;

class CommandMetaError extends Data.TaggedError("CommandMetaError")<{
	readonly command: NewExpression;
	readonly cause: Error;
}> {
	override message = `${getNodeLocator(this.command)} has an error`;
}
