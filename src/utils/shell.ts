import * as Command from "@effect/platform/Command";
import type * as CommandExecutor from "@effect/platform/CommandExecutor";
import * as Arr from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { StringUtils } from "$/utils/string";

export class CommandError extends Data.TaggedError("CommandError")<{
	readonly command: Command.Command;
	readonly exitCode: CommandExecutor.ExitCode;
}> {
	override readonly message =
		`Command '${CommandUtils.format(this.command)}' exited with code ${this.exitCode}`;
}

export namespace CommandUtils {
	export const format = Match.type<Command.Command>().pipe(
		Match.tag("PipedCommand", (piped): string => {
			return `${format(piped.left)} | ${format(piped.right)}`;
		}),
		Match.tag("StandardCommand", (command) => {
			if (Arr.isEmptyReadonlyArray(command.args)) {
				return command.command;
			}

			return `${command.command} ${command.args.join(" ")}`;
		}),
		Match.exhaustive,
	);

	export const execute = Effect.fn("execute")(function* (
		command: Command.Command,
	) {
		return yield* Command.start(command).pipe(
			Effect.flatMap((process) => {
				const decoder = new TextDecoder();

				const logStdout = process.stdout.pipe(
					Stream.map((chunk) => decoder.decode(chunk)),
					Stream.map(Str.trim),
					Stream.mapEffect(Effect.logInfo),
					Stream.runDrain,
				);

				let firstChunk = true;
				const logStderr = process.stderr.pipe(
					Stream.map((chunk) => decoder.decode(chunk)),
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
				const log = Effect.all([logStdout, logStderr], {
					concurrency: "unbounded",
				}).pipe(Effect.fork);

				return Effect.zipLeft(process.exitCode, log, { concurrent: true });
			}),
			Effect.flatMap((exitCode) => {
				if (exitCode !== 0) {
					return new CommandError({ command, exitCode });
				}

				return Effect.void;
			}),
			Console.withGroup({
				label: StringUtils.template`${Bun.color("yellow", "ansi")}${format(command)}${Bun.color("white", "ansi")}`,
			}),
		);
	});
}
