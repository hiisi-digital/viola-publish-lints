# `viola-publish-lints`

[![JSR](https://jsr.io/badges/@hiisi/viola-publish-lints)](https://jsr.io/@hiisi/viola-publish-lints)

> Lints for the metadata a package needs before a registry will take it, across jsr, npm and crates.io.

A registry tells you a manifest is missing a licence at the end of a publish, after the version bump and the tag. These lints ask the same questions earlier, as part of the viola run you already do, such as whether there is a description and a licence, whether the repository field points anywhere, whether the keywords are inside the limits the registry enforces and obey its character rules, and whether a command the package ships is declared and reachable on every runtime it claims to support. They read whichever of `deno.json`, `package.json` and `Cargo.toml` a project has, so a repo publishing to more than one registry gets one lint and not one per ecosystem.

## Usage

```bash
deno add jsr:@hiisi/viola-publish-lints
```

```ts
import { viola } from "@hiisi/viola";
import publishLints from "@hiisi/viola-publish-lints";

export default viola()
  .use(publishLints());
```

The plugin brings its own default rules, which an ordinary rule after the `.use(...)` overrides. The issues it reports are `missing-required` for a field the registry refuses to publish without, `missing-recommended` for one nothing enforces and every reader wants, `invalid-keyword`, `too-many` for more keywords or categories than the registry accepts, `docs-rs-default-features-only` for a crate with features that documents only its default surface on docs.rs, and `deprecated-field`. The split between required and recommended is the registry's, and they are different problems that can be weighed differently.

```ts
import { report, viola, when } from "@hiisi/viola";
import publishLints from "@hiisi/viola-publish-lints";

export default viola()
  .use(publishLints())
  // a refused publish is a build failure. a findability problem is not, yet.
  .rule(report.error, when.linter("publish-metadata"))
  .rule(report.warn, when.kind("publish-metadata/missing-recommended"));
```

The manifest reader is exported as well.

```ts
import { packageTable, readManifests, shipsABinary } from "@hiisi/viola-publish-lints";

const manifests = await readManifests(".");
for (const m of manifests) {
  console.log(m.ecosystem, m.name, m.version, shipsABinary(m));
}
console.log(packageTable(manifests));
```

`shipsABinary` catches a package that exports a `cli.ts` and never declares it in a `bin` field, which is invisible from inside the repository because the tool works fine there.

## Limitations

The registry rules are encoded from each registry's documentation and not discovered by asking it, so a rule that changes upstream goes stale here, and a publish refused for something this passed is worth an issue. The crates.io category list lives in this package and has to be kept current, while keywords are checked structurally. Nothing here checks whether the package actually installs.

## License

> The project is licensed under the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`

> You can check out the full license [here](https://github.com/hiisi-digital/viola-publish-lints/blob/main/LICENSE)
