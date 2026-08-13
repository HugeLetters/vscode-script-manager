import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Iterable from "effect/Iterable";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import {
	type ArgumentedNode,
	type Expression,
	type Node,
	type ObjectLiteralExpression,
	Project,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";
import { TsMorph, TsMorphError } from "$/service/tsmorph";
import { StringUtils } from "$/utils/string";

export const getVariableValue = Effect.fn("getVariableValue")(function* (
	source: SourceFile,
	name: string,
) {
	const path = source.getFilePath();

	return yield* Effect.succeed(source).pipe(
		Effect.map((source) =>
			source.getVariableDeclarations().find((_) => _.getName() === name),
		),
		Effect.flatMap((variable) => {
			if (!variable) {
				return new TsMorphParseError(
					`${path} does not contain a variable declaration '${name}'`,
				);
			}

			return Effect.succeed(variable);
		}),
		Effect.flatMap((variable) => {
			const initializer = variable.getInitializer();
			if (!initializer) {
				return new TsMorphParseError(
					`${getNodeLocator(variable)} does not have an initializer`,
				);
			}

			return Effect.succeed(initializer);
		}),
	);
});

export const getVariableArrayElements = Effect.fn("getVariableArrayElements")(
	function* (variable: Expression) {
		if (!variable.isKind(SyntaxKind.ArrayLiteralExpression)) {
			return yield* new TsMorphParseError(
				`${getNodeLocator(variable)} is not an array literal`,
			);
		}

		return variable.getElements();
	},
);

export const getNodeNewExpressionInitializers = Effect.fn(
	"getNodeNewExpressionInitializers",
)(function* (element: Node) {
	if (element.isKind(SyntaxKind.NewExpression)) {
		return [element];
	}

	if (element.isKind(SyntaxKind.Identifier)) {
		const expressions = pipe(
			element.getDefinitionNodes(),
			Iterable.filter((node) => node.isKind(SyntaxKind.VariableDeclaration)),
			Iterable.map(getVariableNewExpression),
			Iterable.getSomes,
			Arr.fromIterable,
		);

		if (Arr.isReadonlyArrayNonEmpty(expressions)) {
			return expressions;
		}
	}

	const errMessage = StringUtils.concat(
		`Invalid declaration ${getNodeLocator(element)}\n`,
		"Only direct imports of variables with initializers or inline initializers are supported",
	);
	return yield* new TsMorphParseError(errMessage);
});

export const getOptionalPropertyValue = Effect.fn("getOptionalPropertyValue")(
	function* <T extends string>(node: ObjectLiteralExpression, key: T) {
		const value = node.getProperty(key);
		if (!value) {
			return Option.none<Expression>();
		}

		if (!value.isKind(SyntaxKind.PropertyAssignment)) {
			const location = TsMorph.getNodeLocation(value);
			return yield* new TsMorphParseError(
				`Property '${key}' at ${location} is not a property assignment`,
			);
		}

		const init = value.getInitializer();
		if (!init) {
			const location = TsMorph.getNodeLocation(value);
			return yield* new TsMorphParseError(
				`Property '${key}' at ${location} has no initializer`,
			);
		}

		return Option.some(init);
	},
);

export const getPropertyValue = Effect.fn("getPropertyValue")(function* <
	T extends string,
>(node: ObjectLiteralExpression, key: T) {
	const value = yield* getOptionalPropertyValue(node, key);
	return yield* Option.match(value, {
		onNone() {
			return new TsMorphParseError(
				`${getNodeLocator(node)} has no property '${key}'`,
			);
		},
		onSome(value) {
			return Effect.succeed(value);
		},
	});
});

export const getOptionalStringLiteralProperty = Effect.fn(
	"getOptionalStringLiteralProperty",
)(function* <T extends string>(node: ObjectLiteralExpression, key: T) {
	const init = yield* getOptionalPropertyValue(node, key);
	if (Option.isNone(init)) {
		return Option.none<string>();
	}

	const value = yield* asStringLiteral(init.value);
	return Option.some(value);
});

export const getStringLiteralProperty = Effect.fn("getStringLiteralProperty")(
	function* <T extends string>(node: ObjectLiteralExpression, key: T) {
		const init = yield* getPropertyValue(node, key);
		const value = yield* asStringLiteral(init);
		return value;
	},
);

function getVariableNewExpression(variable: VariableDeclaration) {
	return Option.fromNullishOr(variable.getInitializer()).pipe(
		Option.filter((initializer) =>
			initializer.isKind(SyntaxKind.NewExpression),
		),
	);
}

export const asStringLiteral = Effect.fn("asStringLiteral")(function* (
	node: Expression,
) {
	if (node.isKind(SyntaxKind.StringLiteral)) {
		return node.getLiteralValue();
	}

	const literalValue = node.getType().getLiteralValue();
	if (typeof literalValue === "string") {
		return literalValue;
	}

	return yield* new TsMorphParseError(
		`${getNodeLocator(node)} is not a literal string`,
	);
});

export function getNodeLocator(node: Node) {
	const name = TsMorph.getNodeName(node);
	const location = TsMorph.getNodeLocation(node);
	return `${name} at ${location}`;
}

export const getObjectLiteralFirstArg = Effect.fn("getObjectLiteralFirstArg")(
	function* (node: ArgumentedNode & Node) {
		return yield* pipe(
			node.getArguments(),
			Arr.get(0),
			Option.match({
				onNone() {
					return new TsMorphParseError(
						`${getNodeLocator(node)} is missing first argument`,
					);
				},
				onSome(arg) {
					if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
						return new TsMorphParseError(
							`First argument ${getNodeLocator(arg)} is not an object literal`,
						);
					}

					return Effect.succeed(arg);
				},
			}),
		);
	},
);

export const TsMorphProjectLive = Layer.effect(
	TsMorph,
	Effect.gen(function* () {
		yield* Effect.log("Initializing ts-morph service");

		const path = yield* Path.Path;

		const tsConfig = path.resolve(
			import.meta.dir,
			"..",
			"..",
			"..",
			"..",
			"tsconfig.json",
		);
		const project = yield* Effect.try({
			try() {
				return new Project({
					tsConfigFilePath: tsConfig,
				});
			},
			catch(error) {
				return new TsMorphError({ cause: error });
			},
		});

		return {
			_tag: "script-manager/tsmorph/TsMorph",
			project,
		};
	}),
);

class TsMorphParseError extends Data.TaggedError("TsMorphParseError")<{
	readonly message: string;
}> {
	constructor(message: string) {
		super({ message });
	}
}
