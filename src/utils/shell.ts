import * as Array_ from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import type * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";
import * as String_ from "effect/String";
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
			if (Array_.isReadonlyArrayEmpty(command.args)) {
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
				Stream.map(String_.trim),
				Stream.mapEffect(Effect.logInfo),
				Stream.runDrain,
			);

			let firstChunk = true;
			const logStderr = process.stderr.pipe(
				Stream.decodeText(),
				Stream.map(String_.trim),
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
