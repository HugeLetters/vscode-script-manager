import * as Arr from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type { ExtensionContext } from "vscode";
import { RegisterCodeActionProviders } from "./code-actions";
import { RegisterCommands } from "./commands";
import { SharedRuntimeLive } from "./runtime";

const RegisterAll = Effect.all(
	[RegisterCommands, RegisterCodeActionProviders],
	{ concurrency: "unbounded" },
).pipe(Effect.map(Arr.flatten));

export function activate(context: ExtensionContext) {
	return Effect.gen(function* () {
		yield* Effect.log("Activated");

		const deferredDisposables =
			yield* Deferred.make<Effect.Effect.Success<typeof RegisterAll>>();

		yield* RegisterAll.pipe(
			Effect.flatMap((v) => Deferred.succeed(deferredDisposables, v)),
			Effect.andThen(Effect.never),
			Effect.scoped,
			Effect.tapErrorCause(Effect.logFatal),
			Effect.forkDaemon,
		);

		const commands = yield* Deferred.await(deferredDisposables);
		context.subscriptions.push(...commands);
	}).pipe(
		Effect.provide(SharedRuntimeLive),
		Effect.tapErrorCause(Effect.logFatal),
		Effect.runPromise,
	);
}

export function deactivate() {}
