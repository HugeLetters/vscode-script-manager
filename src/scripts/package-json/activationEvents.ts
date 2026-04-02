import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { GetActionDeclarations } from "./actions-declaration";

export const GetActivationEvents = Effect.gen(function* () {
	const commands = yield* Effect.all(
		[
			GetActionDeclarations.pipe(
				Effect.map(
					Arr.flatMap((action) =>
						action.languages.map((language) => `onLanguage:${language}`),
					),
				),
			),
		],
		{ concurrency: "unbounded" },
	).pipe(Effect.map(Arr.flatten));

	const activationEvents = pipe(
		commands,
		(events) => new Set(events),
		Arr.fromIterable,
		Arr.sortBy(Order.string),
	);

	yield* Effect.log("Declared activation events", activationEvents);

	return activationEvents;
});
