import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { CodeAction } from "$/vscode/code-action";
import { TypescriptCodeActions } from "./typescript";

const CodeActionProviders: ReadonlyArray<CodeAction.Provider> = [
	TypescriptCodeActions,
];

export const RegisterCodeActionProviders = Effect.gen(function* () {
	const registered = yield* pipe(
		CodeActionProviders,
		Arr.map((provider) =>
			pipe(
				provider,
				CodeAction.Provider.registerCodeProvider,
				Effect.tapError((cause) =>
					Effect.logError(
						`Failed to register code action provider ${provider.id}`,
						cause,
					),
				),
				Effect.map((disposable) => {
					return { provider, disposable };
				}),
			),
		),
		Effect.allWith({ concurrency: "unbounded", mode: "either" }),
		Effect.map(Arr.getRights),
	);

	yield* Effect.log(
		"Registered code action providers",
		registered.map(({ provider }) => provider.id),
	);

	return registered.map(({ disposable }) => disposable);
});
