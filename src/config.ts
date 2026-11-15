import * as Config from "effect/Config";

export const CommandPrefix = Config.String("command-prefix").pipe(
	Config.withDefault("script-manager"),
);
