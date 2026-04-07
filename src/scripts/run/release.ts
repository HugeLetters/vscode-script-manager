import * as BunContext from "@effect/platform-bun/BunContext";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Build } from "../build";
import { TsMorphProjectLive } from "../package-json/utils/tsmorph";
import { Release } from "../release";

Build({
	release: false,
	watch: false,
}).pipe(
	Effect.andThen(Release.Full),
	Effect.provide([Layer.provideMerge(TsMorphProjectLive, BunContext.layer)]),
	Effect.scoped,
	BunRuntime.runMain,
);
