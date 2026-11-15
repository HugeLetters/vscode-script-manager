import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { Build } from "../build";

const build = Command.make(
	"build",
	{
		watch: Flag.Boolean("watch").pipe(Flag.withDefault(false)),
		release: Flag.Boolean("release").pipe(Flag.withDefault(false)),
	},
	({ watch, release }) => Build({ watch, release }),
);

build.pipe(
	Command.run({ version: "v1.0.0" }),
	Effect.provide(BunServices.layer),
	Effect.scoped,
	BunRuntime.runMain,
);
