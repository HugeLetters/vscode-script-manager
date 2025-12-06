import { pipe } from "effect";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type OutputChannel as VsOutputChannel, window } from "vscode";
import { ConsoleUtils } from "$/utils/console";

export const MainOutputChannel = window.createOutputChannel("Script Manager");

export class OutputChannel extends Effect.Service<OutputChannel>()(
	"script-manager/logger/OutputChannel",
	{ succeed: MainOutputChannel },
) {}

function outputChannelConsole(channel: VsOutputChannel): Console.UnsafeConsole {
	const console = ConsoleUtils.createConsole((message) =>
		channel.append(message),
	);
	return {
		...console,
		clear() {
			channel.clear();
		},
	};
}

export const VsConsoleLive = OutputChannel.pipe(
	Effect.map((channel) =>
		pipe(
			channel,
			outputChannelConsole,
			ConsoleUtils.fromUnsafe,
			Console.setConsole,
		),
	),
	Layer.unwrapEffect,
);
