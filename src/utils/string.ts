import { pipe } from "effect";
import * as Array_ from "effect/Array";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as String_ from "effect/String";

export namespace StringUtils {
	export function template(
		template: TemplateStringsArray,
		...chunks: ReadonlyArray<string | null>
	) {
		return pipe(
			chunks,
			Array_.zipWith(template, (chunk, template) =>
				Predicate.isNotNull(chunk) ? `${template}${chunk}` : template,
			),
			Array_.join(""),
			String_.concat(Array_.last(template).pipe(Option.getOrElse(() => ""))),
		);
	}

	export function concat(...chunks: ReadonlyArray<string | null>) {
		return pipe(chunks, Iterable.filter(Predicate.isNotNull), Array_.join(""));
	}
}
