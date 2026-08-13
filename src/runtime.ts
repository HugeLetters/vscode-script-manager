import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FiberSet from "effect/FiberSet";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { OutputChannel, VsConsoleLive } from "$/vscode/console";

export const SharedRuntimeLive = Layer.mergeAll(
	Logger.layer([Logger.consolePretty()]),
	VsConsoleLive,
	NodeServices.layer,
).pipe(Layer.provideMerge(OutputChannel.Default));

export type SharedRuntimeContext = Layer.Success<typeof SharedRuntimeLive>;

export const Runtime = FiberSet.makeRuntime<SharedRuntimeContext>().pipe(
	Effect.map(
		(run) =>
			<T>(effect: Effect.Effect<T, unknown, SharedRuntimeContext>) =>
				effect.pipe(
					Effect.tapCause(Effect.logFatal),
					run,
					Fiber.join,
					Effect.runPromise,
				),
	),
);

export type Runtime = Effect.Success<typeof Runtime>;
