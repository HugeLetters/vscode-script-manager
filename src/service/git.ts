import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type SimpleGit, simpleGit } from "simple-git";
import { asError } from "../utils/error";
import { CurrentDirectory } from "./directory";

export class Git extends Context.Service<Git>()("script-manager/git/Git", {
	make: Effect.gen(function* () {
		const dirname = yield* CurrentDirectory;
		yield* Effect.log("Initiating git service", { dirname });

		const service = yield* Effect.try({
			try() {
				return simpleGit({ baseDir: dirname });
			},
			catch(error) {
				return new GitError({ cause: error });
			},
		});

		return service;
	}),
}) {
	static readonly Default = Layer.effect(Git, Git.make);

	static with = Effect.fn("with")(function* <T>(
		run: (git: SimpleGit) => PromiseLike<T> | T,
	) {
		const git = yield* Git;
		return yield* Effect.tryPromise({
			try: async () => {
				return run(git);
			},
			catch(error) {
				return new GitError({ cause: error });
			},
		});
	});

	static Branch = Git.with((git) => git.branch()).pipe(Effect.option);
}

export class GitError extends Data.TaggedError("GitError")<{
	cause: unknown;
}> {
	override message = asError(this.cause).message;
}
