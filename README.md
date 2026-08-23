# `viola-publish-lints`

<div align="center" style="text-align: center;">

[![JSR](https://jsr.io/badges/@hiisi/viola-publish-lints)](https://jsr.io/@hiisi/viola-publish-lints)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/viola-publish-lints.svg)](https://github.com/hiisi-digital/viola-publish-lints/issues)
![License](https://img.shields.io/github/license/hiisi-digital/viola-publish-lints?color=%23009689)

> Lints for the metadata a package needs before a registry will take it, across
> jsr, npm and crates.io.

</div>

A publish is a bad time to find out the manifest is missing a licence. The
registry tells you, but it tells you at the end, after the version bump and the
tag and the whole ceremony, and then you get to do it again.

These lints ask the same questions earlier, as part of the run you already do.
Is there a description. Is there a licence. Does the repository field point
anywhere. Are the keywords inside the limits the registry actually enforces, and
do they break its character rules. If the package ships a command, is that
command declared and reachable on every runtime the package claims to support.

It reads whichever manifests a project has, `deno.json`, `package.json` and
`Cargo.toml`, so a repo publishing to more than one registry gets one lint
rather than one per ecosystem.

## Installation

```bash
deno add jsr:@hiisi/viola-publish-lints
```

## Usage

```ts
import { viola } from "@hiisi/viola";
import publishLints from "@hiisi/viola-publish-lints";

export default viola()
  .use(publishLints());
```

That's the whole setup. The plugin brings its own default rules, so a package
that has never thought about its manifest gets useful findings straight away,
and you can override any of them with an ordinary rule after the `.use(...)`.

## What it checks

| Issue | What it means |
| ----- | ------------- |
| `missing-required` | a field the registry refuses to publish without is absent |
| `missing-recommended` | a field nothing enforces and every reader wants is absent |
| `invalid-keyword` | a keyword breaks the registry's rules and will be refused at publish |
| `too-many` | more keywords or categories than the registry accepts |
| `docs-rs-default-features-only` | a crate with features documents only its default surface on docs.rs |
| `deprecated-field` | a manifest field the ecosystem has deprecated |

The split between required and recommended is the registry's, not ours.
`missing-required` means the publish gets refused; `missing-recommended` means
it goes through and nobody can find your package. Both are worth knowing and
they're different problems, so they're different issues you can weigh
differently:

```ts
import { report, viola, when } from "@hiisi/viola";
import publishLints from "@hiisi/viola-publish-lints";

export default viola()
  .use(publishLints())
  // a refused publish is a build failure. a findability problem is not, yet.
  .rule(report.error, when.linter("publish-metadata"))
  .rule(report.warn, when.kind("publish-metadata/missing-recommended"));
```

## Reading manifests yourself

The manifest reader is exported, since it turned out useful outside the lint:

```ts
import { packageTable, readManifests, shipsABinary } from "@hiisi/viola-publish-lints";

const manifests = await readManifests(".");
for (const m of manifests) {
  console.log(m.ecosystem, m.name, m.version, shipsABinary(m));
}
console.log(packageTable(manifests));
```

`shipsABinary` is the one worth knowing about. A package that exports a `cli.ts`
and never says so in a `bin` field has shipped the machinery and not the
install, and that gap is invisible from inside the repository, where the tool
works fine the whole time you're writing it.

## Limitations

The registry rules are encoded from each registry's own documentation rather
than discovered by asking it, so a rule that changes upstream goes stale here
until somebody notices. If a publish is refused for something this passed, that
is worth an issue: it means the encoded rule is wrong and everyone using this
has the same hole.

crates.io categories are checked against the fixed list, which means the list
lives in this package and has to be kept current. Keywords are checked
structurally, which is cheap and correct.

Nothing here checks whether the package actually installs. That is a real gap
and a harder problem, and it wants a different tool than a linter.

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license
> [here](https://github.com/hiisi-digital/viola-publish-lints/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
