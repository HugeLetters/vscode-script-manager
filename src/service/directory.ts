import * as Context from "effect/Context";

export class CurrentDirectory extends Context.Service<
	CurrentDirectory,
	string
>()("script-manager/utils/directory/CurrentDirectory") {}
