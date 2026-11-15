import { pipe } from "effect";
import * as Array_ from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import { GetActionDeclarations } from "./actions-declaration";

export const GetActivationEvents = Effect.gen(function* () {
	const commands = yield* Effect.all(
		[
			GetActionDeclarations.pipe(
				Effect.map(
					Array_.flatMap((action) =>
						action.languages.map((language) => `onLanguage:${language}`),
					),
				),
			),
		],
		{ concurrency: "unbounded" },
	).pipe(Effect.map(Array_.flatten));

	const activationEvents = pipe(
		commands,
		(events) => new Set(events),
		Array_.fromIterable,
		Array_.sortBy(Order.String),
	);

	yield* Effect.log("Declared activation events", activationEvents);

	return activationEvents;
});
