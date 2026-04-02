import * as Path from "@effect/platform/Path";
import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import {
	type NewExpression,
	type ObjectLiteralExpression,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";
import { CommandPrefix } from "$/config";
import { TsMorph } from "$/service/tsmorph";
import { StringUtils } from "$/utils/string";
import type { VsCommand } from "$/vscode/command";
import type { CommandDeclaration } from "./package-json";

const CommandsVariable = "Commands";

interface CommandVariable {
	readonly name: string;
	readonly value: NewExpression;
}

export const ExtractCommandDeclaration = Effect.gen(function* () {
	const tsMorph = yield* TsMorph;
	const path = yield* Path.Path;

	const commandsDir = path.resolve(import.meta.dir, "..", "commands");
	const commandsPath = path.join(commandsDir, "index.ts");

	const commandElements = yield* tsMorph.addSourceFile(commandsPath).pipe(
		Effect.map((source) =>
			source
				.getVariableDeclarations()
				.find((_) => _.getName() === CommandsVariable),
		),
		Effect.flatMap((variable) => {
			if (!variable) {
				return Effect.fail(
					new Error(
						`${commandsPath} does not contain a variable declaration '${CommandsVariable}'`,
					),
				);
			}

			return Effect.succeed(variable);
		}),
		Effect.flatMap((variable) => {
			const initializer = variable.getInitializer();
			if (!initializer) {
				const location = TsMorph.getNodeLocation(variable);
				return Effect.fail(
					new Error(
						`Variable declaration '${CommandsVariable}' at ${location} does not have an initializer`,
					),
				);
			}

			if (!initializer.isKind(SyntaxKind.ArrayLiteralExpression)) {
				const location = TsMorph.getNodeLocation(initializer);
				return Effect.fail(
					new Error(
						`Variable declaration '${CommandsVariable}' initializer at ${location} is not an array literal`,
					),
				);
			}

			return Effect.succeed(initializer.getElements());
		}),
	);

	const commandInitializers = yield* pipe(
		commandElements,
		Arr.map(
			Effect.fnUntraced(function* (element) {
				const name = TsMorph.getNodeName(element);

				if (element.isKind(SyntaxKind.NewExpression)) {
					const result: CommandVariable = {
						name,
						value: element,
					};
					return [result];
				}

				if (element.isKind(SyntaxKind.Identifier)) {
					const expressions = pipe(
						element.getDefinitionNodes(),
						Iterable.filter((node) =>
							node.isKind(SyntaxKind.VariableDeclaration),
						),
						Iterable.map(getVariableNewExpression),
						Iterable.getSomes,
						Iterable.map(
							(expression): CommandVariable => ({
								name,
								value: expression,
							}),
						),
						Arr.fromIterable,
					);

					if (Arr.isNonEmptyReadonlyArray(expressions)) {
						return expressions;
					}
				}

				const location = TsMorph.getNodeLocation(element);
				const errMessage = StringUtils.concat(
					`Invalid command declaration ${name} at ${location}\n`,
					"Only direct imports of variables with initializers or inline initializers are supported",
				);
				return yield* Effect.fail(new Error(errMessage));
			}),
		),
		Effect.allWith({ concurrency: "unbounded" }),
		Effect.map(Iterable.flatten<CommandVariable>),
	);

	return yield* pipe(
		commandInitializers,
		(items) => HashSet.make(...items),
		Iterable.map(getCommandMetadata),
		Effect.allWith({ concurrency: "unbounded" }),
	);
});

function getVariableNewExpression(variable: VariableDeclaration) {
	return Option.fromNullable(variable.getInitializer()).pipe(
		Option.filter((initializer) =>
			initializer.isKind(SyntaxKind.NewExpression),
		),
	);
}

const getCommandMetadata = Effect.fn("getCommandMetadata")(function* (
	command: CommandVariable,
) {
	const prefix = yield* CommandPrefix;
	return yield* pipe(
		command.value.getArguments(),
		Arr.get(0),
		Effect.catchTag("NoSuchElementException", () => {
			return Effect.fail(
				new Error("Command is missing first argument with a declaration"),
			);
		}),
		Effect.flatMap((arg) => {
			if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
				return Effect.fail(
					new Error("First argument is not an object literal"),
				);
			}

			return Effect.succeed(arg);
		}),
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

type CommandProperty = keyof VsCommand.AnyCommand;

const getStringLiteralProperty = Effect.fn("getStringLiteralProperty ")(
	function* <T extends string>(node: ObjectLiteralExpression, key: T) {
		return yield* getOptionalStringLiteralProperty(node, key).pipe(
			Effect.flatMap(
				Option.match({
					onNone() {
						const name = TsMorph.getNodeName(node);
						const location = TsMorph.getNodeLocation(node);
						return Effect.fail(
							new Error(`${name} at ${location} has no property '${key}'`),
						);
					},
					onSome(value) {
						return Effect.succeed(value);
					},
				}),
			),
		);
	},
);

const getOptionalStringLiteralProperty = Effect.fn(
	"getOptionalStringLiteralProperty",
)(function* <T extends string>(node: ObjectLiteralExpression, key: T) {
	const value = node.getProperty(key);
	if (!value) {
		return yield* Effect.succeed(Option.none<string>());
	}

	if (!value.isKind(SyntaxKind.PropertyAssignment)) {
		const location = TsMorph.getNodeLocation(value);
		return yield* Effect.fail(
			new Error(
				`Property '${key}' at ${location} is not a property assignment`,
			),
		);
	}

	const init = value.getInitializer();
	if (!init) {
		const location = TsMorph.getNodeLocation(value);
		return yield* Effect.fail(
			new Error(`Property '${key}' at ${location} has no initializer`),
		);
	}

	if (!init.isKind(SyntaxKind.StringLiteral)) {
		const location = TsMorph.getNodeLocation(init);
		return yield* Effect.fail(
			new Error(`Property '${key}' at ${location} is not a string literal`),
		);
	}

	return Option.some(init.getLiteralValue());
});

class CommandMetaError extends Data.TaggedError("CommandMetaError")<{
	readonly command: CommandVariable;
	readonly cause: Error;
}> {
	override message =
		`${this.command.name} from ${TsMorph.getNodeLocation(this.command.value)} has an error`;
}
