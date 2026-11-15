/** AST lookups that fail with {@link TsMorphNodeError} instead of returning `undefined`. */
import { getSyntaxKindName } from "@ts-morph/common";
import * as Array_ from "effect/Array";
import * as Effect from "effect/Effect";
import * as Function_ from "effect/Function";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import {
	type ArgumentedNode,
	type Expression,
	type ModuledNode,
	type NewExpression,
	type Node,
	type ObjectLiteralExpression,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";
import { TsMorphNodeError } from "./errors";

/** The node's text on one line, cut to `maxLength`. */
export function getNormalizedText(node: Node, maxLength = 30) {
	return node
		.getText()
		.replaceAll("\n", " ")
		.replaceAll(/\s{2,}/g, " ")
		.slice(0, maxLength);
}

/** The node's symbol name, or its normalized text when it has none. */
export function getNodeName(node: Node) {
	return node.getSymbol()?.getName() ?? getNormalizedText(node);
}

/** `/abs/path.ts:line:column` of the node's start. */
export function getNodeLocation(node: Node) {
	const source = node.getSourceFile();
	const { line, column } = source.getLineAndColumnAtPos(node.getStart());
	return `${source.getFilePath()}:${line}:${column}`;
}

/** `name at /abs/path.ts:line:column`, for error messages. */
export function getNodeLocator(node: Node) {
	return `${getNodeName(node)} at ${getNodeLocation(node)}`;
}

export function getFirstDescendantByKind<TKind extends SyntaxKind>(
	node: Node,
	kind: TKind,
) {
	return Array_.get(node.getDescendantsOfKind(kind), 0).pipe(
		Effect.fromOption,
		Effect.mapError(
			() =>
				new TsMorphNodeError({
					node,
					detail: `does not contain ${getSyntaxKindName(kind)}`,
				}),
		),
	);
}

export function getExportedDeclaration(
	module: ModuledNode & Node,
	name: string,
) {
	return Option.fromNullishOr(module.getExportedDeclarations().get(name)).pipe(
		Option.flatMap(Array_.get(0)),
		Effect.fromOption,
		Effect.mapError(
			() =>
				new TsMorphNodeError({
					node: module,
					detail: `does not export ${name}`,
				}),
		),
	);
}

/** The initializer of the top-level variable `name` in `source`. */
export const getVariableValue = Effect.fn("getVariableValue")(function* (
	source: SourceFile,
	name: string,
) {
	const variable = source.getVariableDeclaration(name);
	if (!variable) {
		return yield* new TsMorphNodeError({
			detail: `${source.getFilePath()} does not contain a variable declaration '${name}'`,
		});
	}

	const initializer = variable.getInitializer();
	if (!initializer) {
		return yield* new TsMorphNodeError({
			node: variable,
			detail: "does not have an initializer",
		});
	}

	return initializer;
});

export const getVariableArrayElements = Effect.fn("getVariableArrayElements")(
	function* (variable: Expression) {
		if (!variable.isKind(SyntaxKind.ArrayLiteralExpression)) {
			return yield* new TsMorphNodeError({
				node: variable,
				detail: "is not an array literal",
			});
		}

		return variable.getElements();
	},
);

/**
 * The `new X(...)` expressions behind `element`: the element itself, or the initializers of the
 * variables an identifier points to.
 */
export const getNodeNewExpressionInitializers = Effect.fn(
	"getNodeNewExpressionInitializers",
)(function* (element: Node) {
	if (element.isKind(SyntaxKind.NewExpression)) {
		return Array_.of<NewExpression>(element);
	}

	if (element.isKind(SyntaxKind.Identifier)) {
		const expressions = Function_.pipe(
			element.getDefinitionNodes(),
			Iterable.filter((node) => node.isKind(SyntaxKind.VariableDeclaration)),
			Iterable.map(getVariableNewExpression),
			Iterable.getSomes,
			Array_.fromIterable,
		);

		if (Array_.isReadonlyArrayNonEmpty(expressions)) {
			return expressions;
		}
	}

	return yield* new TsMorphNodeError({
		node: element,
		detail:
			"is not a supported declaration: only direct imports of variables with initializers or inline initializers are supported",
	});
});

function getVariableNewExpression(variable: VariableDeclaration) {
	return Option.fromNullishOr(variable.getInitializer()).pipe(
		Option.filter((initializer) =>
			initializer.isKind(SyntaxKind.NewExpression),
		),
	);
}

/** The value of property `key`, or `None` when the object has no such property. */
export const getOptionalPropertyValue = Effect.fn("getOptionalPropertyValue")(
	function* (node: ObjectLiteralExpression, key: string) {
		const property = node.getProperty(key);
		if (!property) {
			return Option.none<Expression>();
		}

		if (!property.isKind(SyntaxKind.PropertyAssignment)) {
			return yield* new TsMorphNodeError({
				node: property,
				detail: "is not a property assignment",
			});
		}

		const initializer = property.getInitializer();
		if (!initializer) {
			return yield* new TsMorphNodeError({
				node: property,
				detail: "has no initializer",
			});
		}

		return Option.some(initializer);
	},
);

export const getPropertyValue = Effect.fn("getPropertyValue")(function* (
	node: ObjectLiteralExpression,
	key: string,
) {
	const value = yield* getOptionalPropertyValue(node, key);
	if (Option.isNone(value)) {
		return yield* new TsMorphNodeError({
			node,
			detail: `has no property '${key}'`,
		});
	}

	return value.value;
});

/** A string literal, or any expression whose type is a single string literal. */
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

	return yield* new TsMorphNodeError({
		node,
		detail: "is not a literal string",
	});
});

export const getOptionalStringLiteralProperty = Effect.fn(
	"getOptionalStringLiteralProperty",
)(function* (node: ObjectLiteralExpression, key: string) {
	const value = yield* getOptionalPropertyValue(node, key);
	if (Option.isNone(value)) {
		return Option.none<string>();
	}

	return Option.some(yield* asStringLiteral(value.value));
});

export const getStringLiteralProperty = Effect.fn("getStringLiteralProperty")(
	function* (node: ObjectLiteralExpression, key: string) {
		return yield* asStringLiteral(yield* getPropertyValue(node, key));
	},
);

/** The first argument of a call or `new`, which must be an object literal. */
export const getObjectLiteralFirstArg = Effect.fn("getObjectLiteralFirstArg")(
	function* (node: ArgumentedNode & Node) {
		const arg = node.getArguments()[0];
		if (!arg) {
			return yield* new TsMorphNodeError({
				node,
				detail: "is missing its first argument",
			});
		}

		if (!arg.isKind(SyntaxKind.ObjectLiteralExpression)) {
			return yield* new TsMorphNodeError({
				node: arg,
				detail: "(first argument) is not an object literal",
			});
		}

		return arg;
	},
);
