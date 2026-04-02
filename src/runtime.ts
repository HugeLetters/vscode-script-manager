import * as NodeContext from "@effect/platform-node/NodeContext";
import * as Effect from "effect/Effect";
import * as FiberSet from "effect/FiberSet";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { OutputChannel, VsConsoleLive } from "$/vscode/console";

export const SharedRuntimeLive = Layer.mergeAll(
	Logger.pretty,
	VsConsoleLive,
	NodeContext.layer,
).pipe(Layer.provideMerge(OutputChannel.Default));

export type SharedRuntimeContext = Layer.Layer.Success<
	typeof SharedRuntimeLive
>;

export const Runtime = FiberSet.makeRuntime<SharedRuntimeContext>().pipe(
	Effect.map(
		(run) =>
			<T>(effect: Effect.Effect<T, unknown, SharedRuntimeContext>) =>
				effect.pipe(
					Effect.tapErrorCause(Effect.logFatal),
					run,
					Effect.runPromise,
				),
	),
);

export type Runtime = Effect.Effect.Success<typeof Runtime>;
