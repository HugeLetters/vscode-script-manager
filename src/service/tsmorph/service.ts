import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Function_ from "effect/Function";
import * as Layer from "effect/Layer";
import { Project, type ProjectOptions } from "ts-morph";
import { TsMorphError } from "./errors";

/**
 * One ts-morph `Project`. Every ts-morph call goes through {@link TsMorph.with}, so throws become
 * {@link TsMorphError}.
 *
 * ```ts
 * TsMorph.addSourceFile(path).pipe(Effect.provide(TsMorph.layer({ tsConfigFilePath })));
 * ```
 */
export class TsMorph extends Context.Service<TsMorph>()(
	"script-manager/tsmorph/TsMorph",
	{
		make: Effect.fn("TsMorph.make")(function* (options: ProjectOptions = {}) {
			const project = yield* Effect.try({
				try: () => new Project(options),
				catch: TsMorphError.fromUnknown,
			});

			return {
				project,
				/** Runs `run` against the project; throws and rejections become {@link TsMorphError}. */
				with<T>(run: (project: Project) => T | PromiseLike<T>) {
					return Effect.tryPromise({
						try: async () => run(project),
						catch: TsMorphError.fromUnknown,
					});
				},
			};
		}),
	},
) {
	/** A project built from the given options, e.g. `{ tsConfigFilePath }`. */
	static layer = Function_.flow(TsMorph.make, Layer.effect(TsMorph));

	/** An empty project on an in-memory file system. */
	static inMemory = TsMorph.layer({ useInMemoryFileSystem: true });

	static with<T>(run: (project: Project) => T | PromiseLike<T>) {
		return TsMorph.use((tsMorph) => tsMorph.with(run));
	}

	static addSourceFile(filePath: string) {
		return TsMorph.with((project) => project.addSourceFileAtPath(filePath));
	}
}
