import { pipe } from "effect";
import * as Arr from "effect/Array";
import * as Iterable from "effect/Iterable";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Str from "effect/String";

export namespace StringUtils {
	export function template(
		template: TemplateStringsArray,
		...chunks: ReadonlyArray<string | null>
	) {
		return pipe(
			chunks,
			Arr.zipWith(template, (chunk, template) =>
				Predicate.isNotNull(chunk) ? `${template}${chunk}` : template,
			),
			Arr.join(""),
			Str.concat(Arr.last(template).pipe(Option.getOrElse(() => ""))),
		);
	}

	export function concat(...chunks: ReadonlyArray<string | null>) {
		return pipe(chunks, Iterable.filter(Predicate.isNotNull), Arr.join(""));
	}
}
