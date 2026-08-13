import * as Arr from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import type { ExtensionContext } from "vscode";
import { RegisterCodeActionProviders } from "./code-actions";
import { RegisterCommands } from "./commands";
import { SharedRuntimeLive } from "./runtime";

// TODO master | unit/e2e tests? maybe | by Evgenii Perminov at Mon, 06 Apr 2026 21:21:04 GMT
const RegisterAll = Effect.all(
	// TODO master | more aggressively disclose register failure | by Evgenii Perminov at Mon, 06 Apr 2026 21:04:52 GMT
	[RegisterCommands, RegisterCodeActionProviders],
	{ concurrency: "unbounded" },
).pipe(Effect.map(Arr.flatten));

export function activate(context: ExtensionContext) {
	return Effect.gen(function* () {
		yield* Effect.log("Activated");

		const deferredDisposables =
			yield* Deferred.make<Effect.Success<typeof RegisterAll>>();

		// TODO master | this fiber is only killed on process exit, not when deactive requested explicitly | by Evgenii Perminov at Mon, 06 Apr 2026 21:13:25 GMT
		yield* RegisterAll.pipe(
			Effect.flatMap((v) => Deferred.succeed(deferredDisposables, v)),
			Effect.andThen(Effect.never),
			Effect.scoped,
			Effect.tapCause(Effect.logFatal),
			Effect.forkDetach,
		);

		const commands = yield* Deferred.await(deferredDisposables);
		context.subscriptions.push(...commands);
	}).pipe(
		Effect.provide(SharedRuntimeLive),
		Effect.tapCause(Effect.logFatal),
		Effect.runPromise,
	);
}

export function deactivate() {}
