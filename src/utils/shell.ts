import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { StringUtils } from "$/utils/string";

export class CommandError extends Data.TaggedError("CommandError")<{
	readonly command: ChildProcess.Command;
	readonly exitCode: ChildProcessSpawner.ExitCode;
}> {
	override readonly message =
		`Command '${CommandUtils.format(this.command)}' exited with code ${this.exitCode}`;
}

export namespace CommandUtils {
	export const format = Match.type<ChildProcess.Command>().pipe(
		Match.tag("PipedCommand", (piped): string => {
			return `${format(piped.left)} | ${format(piped.right)}`;
		}),
		Match.tag("StandardCommand", (command) => {
			if (Arr.isReadonlyArrayEmpty(command.args)) {
				return command.command;
			}

			return `${command.command} ${command.args.join(" ")}`;
		}),
		Match.exhaustive,
	);

	export const execute = Effect.fn("execute")(function* (
		command: ChildProcess.Command,
	) {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const process = yield* spawner.spawn(command);

		yield* Effect.gen(function* () {
			const logStdout = process.stdout.pipe(
				Stream.decodeText(),
				Stream.map(Str.trim),
				Stream.mapEffect(Effect.logInfo),
				Stream.runDrain,
			);

			let firstChunk = true;
			const logStderr = process.stderr.pipe(
				Stream.decodeText(),
				Stream.map(Str.trim),
				Stream.mapEffect((chunk) => {
					if (firstChunk) {
						firstChunk = false;

						// bun output run scripts to stderr
						if (chunk.startsWith("$")) {
							return Effect.logInfo(chunk);
						}
					}

					return Effect.logError(chunk);
				}),
				Stream.runDrain,
			);

			yield* Effect.all([logStdout, logStderr], { concurrency: "unbounded" });
		}).pipe(
			Console.withGroup({
				label: StringUtils.template`${Bun.color("yellow", "ansi")}${format(command)}${Bun.color("white", "ansi")}`,
			}),
			Effect.forkScoped,
		);

		const exitCode = yield* process.exitCode;
		if (exitCode !== 0) {
			return yield* new CommandError({ command, exitCode });
		}
	});
}
