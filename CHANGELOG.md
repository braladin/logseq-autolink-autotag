# Changelog

## 1.0.0 (2025-04-15)


### Features

* auto-link pages ([6a7c243](https://github.com/braladin/logseq-autolink-autotag/commit/6a7c2437da03d8af15a30bbb3c09dc70337917c2))
* auto-tag blocks based on linked pages ([5216668](https://github.com/braladin/logseq-autolink-autotag/commit/5216668fd8ea5d1a62517d42a9a5d49b2356d8c7))


### Bug Fixes

* add guards to process keyup events only when editing a block ([7b1cb7d](https://github.com/braladin/logseq-autolink-autotag/commit/7b1cb7d8f80a19a1a8a316ef676d35544d4e2eaa))


### Performance Improvements

* use keyup event instead of logseq.db.onchange to improve responsiveness ([50b851f](https://github.com/braladin/logseq-autolink-autotag/commit/50b851f2a7d83b91f4d10e59232442ea7eea4a63))
* use promise.all to fetch pages in parallel ([ca993a6](https://github.com/braladin/logseq-autolink-autotag/commit/ca993a6b233593145a0655bd5c87ecb185f80042))
