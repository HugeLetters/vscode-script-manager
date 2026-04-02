import * as Effect from "effect/Effect";
import { GetCommands } from "./commands";
import type { Contributes } from "./schema";

export const GetContributes = Effect.gen(function* () {
	const commands = yield* GetCommands;

	yield* Effect.log(
		"Declared commands",
		commands.map((command) => command.title),
	);

	const out: Contributes = { commands };
	return out;
});
