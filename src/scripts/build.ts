import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import * as BunContext from "@effect/platform-bun/BunContext";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SynchronizedRef from "effect/SynchronizedRef";
import { context, type Plugin } from "esbuild";
import { TsMorphProjectLive } from "./package-json/utils/tsmorph";
import { makePlugin } from "./plugin";
import { Release } from "./release";

const Outdir = "dist";

const ReleasePlugin = makePlugin({
	name: "release",
	onStart: Release.Prebuild.pipe(
		Effect.provide([Layer.provideMerge(TsMorphProjectLive, BunContext.layer)]),
	),
	onEnd: () => Release.Postbuild,
});

const BuildTimePlugin = Effect.fn("BuildTimePlugin ")(function* () {
	const now = yield* DateTime.now;
	const startTime = yield* SynchronizedRef.make(now);

	return yield* makePlugin({
		name: "build-time",
		onStart: Effect.gen(function* () {
			const now = yield* DateTime.now;
			yield* SynchronizedRef.set(startTime, now);
			yield* Effect.logInfo("Build started");
		}),
		onEnd: Effect.fnUntraced(function* () {
			const start = yield* startTime;
			const now = yield* DateTime.now;
			const elapsed = now.epochMillis - start.epochMillis;
			// TODO master | more noticeable message | by Evgenii Perminov at Mon, 06 Apr 2026 20:47:37 GMT
			yield* Effect.logInfo(`Build completed in ${elapsed}ms`);
		}),
	});
});

const ProblemMatcherPlugin = makePlugin({
	name: "problem-matcher",
	onStart: Console.log("[watch] build started"),
	onEnd: Effect.fnUntraced(function* (result) {
		yield* Effect.all(
			result.errors.map(
				Effect.fnUntraced(function* ({ text, location }) {
					yield* Console.error(`✘ [ERROR] ${text}`);

					if (location) {
						yield* Console.error(
							`    ${location.file}:${location.line}:${location.column}:`,
						);
					}
				}),
			),
			{ concurrency: "unbounded" },
		);

		yield* Console.log("[watch] build finished");
	}),
});

interface BuildConfig {
	watch: boolean;
	release: boolean;
}

export const Build = Effect.fn("Build")(function* ({
	watch,
	release,
}: BuildConfig) {
	const Plugins: Array<Plugin> = [];

	if (release) {
		const plugin = yield* ReleasePlugin;
		Plugins.push(plugin);
	}

	if (watch) {
		const plugin = yield* ProblemMatcherPlugin;
		Plugins.push(plugin);
	}

	const plugin = yield* BuildTimePlugin();
	Plugins.push(plugin);

	const path = yield* Path.Path;
	const ctx = yield* Effect.tryPromise(() => {
		return context({
			entryPoints: ["src/index.ts"],
			bundle: true,
			format: "cjs",
			minify: !watch,
			sourcemap: watch,
			sourcesContent: false,
			platform: "node",
			outfile: path.join(Outdir, "index.js"),
			external: ["vscode"],
			logLevel: "info",
			plugins: Plugins,
		});
	});

	if (watch) {
		yield* Effect.tryPromise(() => ctx.watch());
		return yield* Effect.never;
	}

	const fs = yield* FileSystem.FileSystem;
	yield* Effect.logInfo("Puriging build directory").pipe(
		Effect.annotateLogs("dir", Outdir),
	);
	yield* fs.remove(Outdir, { force: true, recursive: true });

	yield* Effect.tryPromise(() => ctx.rebuild());
	yield* Effect.tryPromise(() => ctx.dispose());
});
