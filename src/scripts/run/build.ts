import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { Build } from "../build";

const build = Command.make(
	"build",
	{
		watch: Flag.boolean("watch"),
		release: Flag.boolean("release"),
	},
	({ watch, release }) => Build({ watch, release }),
);

build.pipe(
	Command.run({ version: "v1.0.0" }),
	Effect.provide(BunServices.layer),
	Effect.scoped,
	BunRuntime.runMain,
);
