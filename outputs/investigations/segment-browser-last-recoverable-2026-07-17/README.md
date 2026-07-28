# Last recoverable Segment browser source

This folder preserves the last locally recoverable pre-Jitsu ClickFunnels
browser-tracking source.

## Provenance

- Git commit: `1cc776131402662d70e2b349c172c0136b1c4428`
- Commit time: July 17, 2026 at 21:10:26 HST
- Browser entry point: `clickfunnels/src/index.js`
- Browser loader: `clickfunnels/src/segment-loader.js`
- Segment identity helper: `clickfunnels/src/segment-user.js`
- Segment event transport: `clickfunnels/src/segment-track.js`

The last Cloudflare Worker deployment recorded before the July 21 Jitsu
migration is:

- Worker: `boom-bookkeeping-segment-proxy`
- Version: `6a05652c-590c-4586-a65f-91807959e69e`
- Created: July 18, 2026 at 16:40:16 HST

The ClickFunnels browser bundle was published separately to the R2 object
`assets/cf-sh-seg`. That object was overwritten in place and no historical R2
object version is available in this workspace. Therefore this folder is the
last recoverable source snapshot, not a byte-for-byte download of the former
production R2 object.

## Included material

- The complete historical `clickfunnels` source folder.
- The corresponding Worker `src/index.ts`.
- The R2 publishing script and package files.
- A reference browser bundle built from the preserved source at
  `reference-build/cf-sh-seg.js`.

Reference bundle SHA-256:

```text
bf7c333b70a8cfddfb190a4d3991fe66c7de291d53b710efd7a595a4eccd0867
```

Nothing in this folder should be deployed directly. It is an investigation
reference for comparing Segment-era behavior with the Jitsu implementation.
