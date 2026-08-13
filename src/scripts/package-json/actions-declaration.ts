import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import {
	type NewExpression,
	type ObjectLiteralExpression,
	SyntaxKind,
} from "ts-morph";
import { TsMorph } from "$/service/tsmorph";
import type { CodeAction } from "$/vscode/code-action";
import {
	asStringLiteral,
	getNodeLocator,
	getNodeNewExpressionInitializers,
	getObjectLiteralFirstArg,
	getOptionalPropertyValue,
	getOptionalStringLiteralProperty,
	getStringLiteralProperty,
	getVariableArrayElements,
	getVariableValue,
} from "./utils/tsmorph";

const CodeActionProvidersVariable = "CodeActionProviders";

export interface ActionDeclaration {
	readonly id: string;
	readonly languages: ReadonlyArray<string>;
}

export const GetActionDeclarations = Effect.gen(function* () {
	const path = yield* Path.Path;

	const providersPath = path.resolve(
		import.meta.dir,
		"..",
		"..",
		"code-actions",
		"index.ts",
	);

	const source = yield* TsMorph.addSourceFile(providersPath);
	const providersVar = yield* getVariableValue(
		source,
		CodeActionProvidersVariable,
	);
	const providerElements = yield* getVariableArrayElements(providersVar);

	const providerInitializers = yield* pipe(
		providerElements,
		Arr.map(getNodeNewExpressionInitializers),
		(effects) => Effect.all(effects, { concurrency: "unbounded" }),
		Effect.map(Iterable.flatten<NewExpression>),
	);

	return yield* pipe(
		providerInitializers,
		(items) => HashSet.make(...items),
		Iterable.map(getActionProviderMetadata),
		(effects) => Effect.all(effects, { concurrency: "unbounded" }),
	);
});

const getActionProviderMetadata = Effect.fn("getActionProviderMetadata")(
	function* (provider: NewExpression) {
		return yield* pipe(
			getObjectLiteralFirstArg(provider),
			Effect.flatMap(
				Effect.fnUntraced(function* (arg) {
					const id = yield* getStringLiteralProperty<ProviderProperty>(
						arg,
						"id",
					);
					const languages = yield* getSelectorLanguages(arg, "selector");

					const result: ActionDeclaration = {
						id,
						languages,
					};

					return result;
				}),
			),
			Effect.mapError((cause) => new ActionMetaError({ provider, cause })),
		);
	},
);

type ProviderProperty = keyof CodeAction.Provider;

const getSelectorLanguages = Effect.fn("getSelectorLanguages")(function* (
	node: ObjectLiteralExpression,
	key: ProviderProperty,
) {
	const optValue = yield* getOptionalPropertyValue(node, key);
	if (Option.isNone(optValue)) {
		return yield* Effect.fail(
			new Error(`${getNodeLocator(node)} has no property '${key}'`),
		);
	}

	const elements = yield* getVariableArrayElements(optValue.value);

	const values = yield* pipe(
		elements,
		Arr.map(
			Effect.fnUntraced(function* (element) {
				const stringVal = yield* asStringLiteral(element).pipe(Effect.option);
				if (Option.isSome(stringVal)) {
					return [stringVal.value];
				}

				if (element.isKind(SyntaxKind.ObjectLiteralExpression)) {
					const language = yield* getOptionalStringLiteralProperty(
						element,
						"language",
					);
					return Option.match(language, {
						onNone: Arr.empty,
						onSome: (value) => [value],
					});
				}

				return yield* Effect.fail(
					new Error(
						`Unsupported selector declaration ${getNodeLocator(element)}`,
					),
				);
			}),
		),
		(effects) => Effect.all(effects, { concurrency: "unbounded" }),
		Effect.map(Iterable.flatten<string>),
	);

	return Array.from(new Set(values));
});

class ActionMetaError extends Data.TaggedError("ActionMetaError")<{
	readonly provider: NewExpression;
	readonly cause: Error;
}> {
	override message = `${getNodeLocator(this.provider)} has an error`;
}
