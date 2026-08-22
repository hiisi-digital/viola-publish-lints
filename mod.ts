/**
 * @module
 * Publish-metadata lints for the Viola convention linter.
 *
 * Checks that a package says what its registry needs before a publish finds out
 * for you: a description, a licence, the repository, keywords and categories,
 * and, where the package ships a command, that the command is actually
 * declared and reachable on every runtime the package claims.
 *
 * It reads whichever manifests a project has, `deno.json`, `package.json` and
 * `Cargo.toml`, so one lint covers a repo that publishes to more than one
 * registry rather than one lint per ecosystem.
 *
 * @example
 * ```ts
 * import { viola } from "@hiisi/viola";
 * import publishLints from "@hiisi/viola-publish-lints";
 *
 * export default viola()
 *   .use(publishLints());
 * ```
 */

export { type Ecosystem, type Manifest, packageTable, readManifests, shipsABinary } from "./src/manifest.ts";
export { PublishMetadataLinter, publishMetadataLinter } from "./src/publish-metadata.ts";

import type { ViolaPlugin } from "@hiisi/viola";
import { publishMetadataLinter } from "./src/publish-metadata.ts";

/**
 * The plugin, for `viola().use(publishLints())`.
 *
 * A `ViolaPlugin`, which is the object form `use()` has accepted since 0.3.0:
 * a `build` that puts this package's linters on the builder it is handed. The
 * `{ name, linters }` form reads more declaratively and is not available here,
 * because it landed after 0.3.0 and this package should work against what is
 * actually published rather than against an unreleased sibling.
 *
 * A factory rather than a bare object, matching the sibling plugins, so that a
 * later option bag is an argument here instead of a breaking change at every
 * call site.
 */
export function publishLints(): ViolaPlugin {
  return {
    build(builder: Parameters<ViolaPlugin["build"]>[0]): void {
      builder.add(publishMetadataLinter);
    },
  };
}

export default publishLints;
