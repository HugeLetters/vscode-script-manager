import * as Effect from "effect/Effect";
import { CodeAction } from "$/vscode/code-action";
import { TypescriptCodeActions } from "./typescript";

const CodeActionProviders: ReadonlyArray<CodeAction.Provider> = [
	TypescriptCodeActions,
];

export const RegisterCodeActionProviders = Effect.gen(function* () {
	const registered = yield* Effect.partition(
		CodeActionProviders,
		(provider) => {
			return CodeAction.Provider.registerCodeProvider(provider).pipe(
				Effect.tapError((error) => {
					return Effect.logError(
						`Failed to register code action provider ${provider.id}`,
						error,
					);
				}),
				Effect.map((disposable) => {
					return { provider, disposable };
				}),
			);
		},
		{ concurrency: "unbounded" },
	).pipe(Effect.map(([registered]) => registered));

	yield* Effect.log(
		"Registered code action providers",
		registered.map(({ provider }) => provider.id),
	);

	return registered.map(({ disposable }) => disposable);
});
