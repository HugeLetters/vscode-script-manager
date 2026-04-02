import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import {
	type ArgumentedNode,
	type Expression,
	type Node,
	type ObjectLiteralExpression,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";
import { TsMorph } from "$/service/tsmorph";
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
				return Effect.fail(
					new Error(
						`${path} does not contain a variable declaration '${name}'`,
					),
				);
			}

			return Effect.succeed(variable);
		}),
		Effect.flatMap((variable) => {
			const initializer = variable.getInitializer();
			if (!initializer) {
				return Effect.fail(
					new Error(`${getNodeLocator(variable)} does not have an initializer`),
				);
			}

			return Effect.succeed(initializer);
		}),
	);
});

export const getVariableArrayElements = Effect.fn("getVariableArrayElements")(
	function* (variable: Expression) {
		if (!variable.isKind(SyntaxKind.ArrayLiteralExpression)) {
			return yield* Effect.fail(
				new Error(`${getNodeLocator(variable)} is not an array literal`),
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

		if (Arr.isNonEmptyReadonlyArray(expressions)) {
			return expressions;
		}
	}

	const errMessage = StringUtils.concat(
		`Invalid declaration ${getNodeLocator(element)}\n`,
		"Only direct imports of variables with initializers or inline initializers are supported",
	);
	return yield* Effect.fail(new Error(errMessage));
});

export const getOptionalPropertyValue = Effect.fn("getOptionalPropertyValue")(
	function* <T extends string>(node: ObjectLiteralExpression, key: T) {
		const value = node.getProperty(key);
		if (!value) {
			return Option.none<Expression>();
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

		return Option.some(init);
	},
);

export const getPropertyValue = Effect.fn("getPropertyValue")(function* <
	T extends string,
>(node: ObjectLiteralExpression, key: T) {
	const value = yield* getOptionalPropertyValue(node, key);
	return yield* Option.match(value, {
		onNone() {
			return Effect.fail(
				new Error(`${getNodeLocator(node)} has no property '${key}'`),
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
	return Option.fromNullable(variable.getInitializer()).pipe(
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

	return yield* Effect.fail(
		new Error(`${getNodeLocator(node)} is not a literal string`),
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
			Effect.catchTag("NoSuchElementException", () => {
				return Effect.fail(
					new Error(`${getNodeLocator(node)} is missing first argument`),
				);
			}),
			Effect.flatMap((arg) => {
				if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
					return Effect.fail(
						new Error(
							`First argument ${getNodeLocator(arg)} is not an object literal`,
						),
					);
				}

				return Effect.succeed(arg);
			}),
		);
	},
);
