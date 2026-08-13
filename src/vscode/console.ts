import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type OutputChannel as VsOutputChannel, window } from "vscode";
import { ConsoleUtils } from "$/utils/console";

// TODO master | leaky lifecycle, should be created in activation event | by Evgenii Perminov at Mon, 06 Apr 2026 20:53:56 GMT
export const MainOutputChannel = window.createOutputChannel("Script Manager");

export class OutputChannel extends Context.Service<OutputChannel>()(
	"script-manager/logger/OutputChannel",
	{
		make: Effect.succeed(MainOutputChannel),
	},
) {
	static readonly Default = Layer.effect(OutputChannel, OutputChannel.make);
}

function outputChannelConsole(channel: VsOutputChannel): Console.Console {
	const console = ConsoleUtils.createConsole((message) =>
		channel.append(message),
	);
	return Object.assign(console, {
		clear() {
			channel.clear();
		},
	});
}

export const VsConsoleLive = Layer.succeed(
	Console.Console,
	outputChannelConsole(MainOutputChannel),
);
