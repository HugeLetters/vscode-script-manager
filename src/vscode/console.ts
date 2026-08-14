import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type OutputChannel as VsOutputChannel, window } from "vscode";
import { ConsoleUtils } from "$/utils/console";

export class OutputChannel extends Context.Service<OutputChannel>()(
	"script-manager/logger/OutputChannel",
	{
		make: Effect.sync(() => window.createOutputChannel("Script Manager")),
	},
) {
	static readonly Default = Layer.effect(OutputChannel, OutputChannel.make);
}

export function createChannelConsole(
	channel: VsOutputChannel,
): Console.Console {
	const console = ConsoleUtils.createConsole((message) =>
		channel.append(message),
	);
	console.clear = () => channel.clear();
	return console;
}

export const ChannelConsole = Layer.effect(
	Console.Console,
	Effect.map(OutputChannel, createChannelConsole),
);
