# Changelog

## [1.1.3](https://github.com/braladin/logseq-autolink-autotag/compare/v1.1.2...v1.1.3) (2025-04-22)


### Bug Fixes

* change plugin entry ([0d265f2](https://github.com/braladin/logseq-autolink-autotag/commit/0d265f2c8716f3adbf034848fb53adf2e61d959f))
* change plugin entry ([1412ba4](https://github.com/braladin/logseq-autolink-autotag/commit/1412ba40c075ef5546179ed86d063fe295b5c8ad))

## [1.1.2](https://github.com/braladin/logseq-autolink-autotag/compare/v1.1.1...v1.1.2) (2025-04-20)


### Bug Fixes

* prevent overwriting alias tags ([a55ba1e](https://github.com/braladin/logseq-autolink-autotag/commit/a55ba1e5e817dfac1ef93173d8ec8b748a843a3f))

## [1.1.1](https://github.com/braladin/logseq-autolink-autotag/compare/v1.1.0...v1.1.1) (2025-04-19)


### Bug Fixes

* inserting tags at the beginning of a block breaks tasks ([33bea47](https://github.com/braladin/logseq-autolink-autotag/commit/33bea4784b63f6f5f1238b43b06c5aa4970ac80d))
* typo in blocksToExclude setting's default value ([5a32c00](https://github.com/braladin/logseq-autolink-autotag/commit/5a32c00ca9d4c43d90cca02cb45733c3d4099d32))


### Performance Improvements

* make console logging optional ([b288c67](https://github.com/braladin/logseq-autolink-autotag/commit/b288c67e16462f04e0062e3c9495386c4df66342))
* use pre-constructed data structures of page names and tags instead of fetching data every time ([821f810](https://github.com/braladin/logseq-autolink-autotag/commit/821f8105343a3ed14f4d309880092c211330a18b))

## [1.1.0](https://github.com/braladin/logseq-autolink-autotag/compare/v1.0.0...v1.1.0) (2025-04-17)


### Features

* add 9 settings ([fe49de3](https://github.com/braladin/logseq-autolink-autotag/commit/fe49de39bd5762d955ca34db09a1ab4686411b90))
* add auto-link only first occurance ([d30bea0](https://github.com/braladin/logseq-autolink-autotag/commit/d30bea0acbff6a27844c30a99d0dfbda4cbd919f))
* add autoTagOnEnter, autoLinkOnEnter, pagesToSkip, blocksToSkip, useHashtag, insertTags logic ([7eb43a6](https://github.com/braladin/logseq-autolink-autotag/commit/7eb43a6f49107957986cb5cad89d2aadcccf9a00))
* auto-tag with [[tag]] instead of #tag ([d26c2c9](https://github.com/braladin/logseq-autolink-autotag/commit/d26c2c90c531f797804a75e2a72f900ee49f5367))


### Bug Fixes

* add empty block check to prevent errors ([38f918d](https://github.com/braladin/logseq-autolink-autotag/commit/38f918d2123b3a8bac8e98dc21e5df5e47d57759))
* auto-link newly created pages ([5320fb3](https://github.com/braladin/logseq-autolink-autotag/commit/5320fb3b6d6751c8e5754f53e20fffd245479e7e))
* do not auto-link deleted pages ([addff53](https://github.com/braladin/logseq-autolink-autotag/commit/addff538d9db248fa04ed9b7eba4b1512eba81a2))
* remove #Parent tag if #[[Parent/Child]] tag was added ([92b1246](https://github.com/braladin/logseq-autolink-autotag/commit/92b124634a7eaa932478d230738aa7a8a17faf7c))
* skip blocks with {{*}} or *:: ([4554a58](https://github.com/braladin/logseq-autolink-autotag/commit/4554a5898d83bbd1548ca505359f93c6ea53e510))

## 1.0.0 (2025-04-15)


### Features

* auto-link pages ([6a7c243](https://github.com/braladin/logseq-autolink-autotag/commit/6a7c2437da03d8af15a30bbb3c09dc70337917c2))
* auto-tag blocks based on linked pages ([5216668](https://github.com/braladin/logseq-autolink-autotag/commit/5216668fd8ea5d1a62517d42a9a5d49b2356d8c7))


### Bug Fixes

* add guards to process keyup events only when editing a block ([7b1cb7d](https://github.com/braladin/logseq-autolink-autotag/commit/7b1cb7d8f80a19a1a8a316ef676d35544d4e2eaa))


### Performance Improvements

* use keyup event instead of logseq.db.onchange to improve responsiveness ([50b851f](https://github.com/braladin/logseq-autolink-autotag/commit/50b851f2a7d83b91f4d10e59232442ea7eea4a63))
* use promise.all to fetch pages in parallel ([ca993a6](https://github.com/braladin/logseq-autolink-autotag/commit/ca993a6b233593145a0655bd5c87ecb185f80042))
