import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { TsMorph } from "$/service/tsmorph";

/** A {@link TsMorph} project built from the repo's `tsconfig.json`. */
export const TsMorphProjectLive = Layer.unwrap(
	Effect.gen(function* () {
		yield* Effect.log("Initializing ts-morph service");

		const path = yield* Path.Path;
		const tsConfigFilePath = path.resolve(
			import.meta.dir,
			"..",
			"..",
			"..",
			"..",
			"tsconfig.json",
		);

		return TsMorph.layer({ tsConfigFilePath });
	}),
);
