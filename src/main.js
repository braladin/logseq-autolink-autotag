import {
  updateAllPagesSorted,
  updatePagesToTagsMap,
  getPagesToTagsMap,
  autoLinkAutoTagCallback,
} from "./functions.js";

async function main() {
  let allPagesSorted = [];
  let pagesToTagsMap = {};
  let currentBlock;

  // Initialize data during idle time to reduce plugin loading time
  window.parent.requestIdleCallback(async () => {
    const result = await getPagesToTagsMap();
    allPagesSorted = result.allPagesSorted;
    pagesToTagsMap = result.pagesToTagsMap;
  });

  logseq.Editor.registerSlashCommand("Auto-link Auto-tag", async () => {
    await autoLinkAutoTagCallback(currentBlock, allPagesSorted, pagesToTagsMap);
  });

  logseq.App.registerCommandShortcut(
    {
      binding: logseq.settings?.keybinding,
    },
    async () => {
      autoLinkAutoTagCallback(currentBlock, allPagesSorted, pagesToTagsMap);
    },
  );

  window.parent.document.addEventListener("keyup", async (event) => {
    // Skip keyup events that do not occur when editing blocks
    // or when modifier keys are pressed
    if (
      event?.target?.tagName.toLowerCase() !== "textarea" ||
      !event.target.getAttribute("aria-label") === "editing block" ||
      event.altKey === true ||
      event.ctrlKey === true ||
      event.metaKey === true ||
      event.shiftKey === true ||
      ["Shift", "Control", "Alt", "Meta"].includes(event.key)
    )
      return;
    if (
      event.code === "Enter" &&
      logseq.settings?.runUponPressingEnter === true &&
      currentBlock
    ) {
      if (logseq.settings.enableConsoleLogging === true)
        console.debug("logseq-autolink-autotag: Enter pressed");
      autoLinkAutoTagCallback(currentBlock, allPagesSorted, pagesToTagsMap);
      return;
    }
    if (logseq.settings.enableConsoleLogging === true)
      console.debug("logseq-autolink-autotag: Current block updated");
    currentBlock = await logseq.Editor.getCurrentBlock();
  });

  logseq.DB.onChanged(async ({ blocks, txData, txMeta }) => {
    // Ignore changes that are not relevant to the plugin
    if (txMeta?.["skipRefresh?"] === true) return;

    // Detect page creation and update allPagesSorted
    if (txMeta?.outlinerOp === "create-page") {
      updateAllPagesSorted(blocks[0], allPagesSorted);
      return;
    }

    // Detect tag change and update pagesToTagsMap
    if (txMeta?.outlinerOp === "save-block") {
      if (blocks[0].content && blocks[0].content.startsWith("tags::"))
        updatePagesToTagsMap(blocks[0], blocks[1], pagesToTagsMap);
      return;
    }

    const potentiallyDeletedPages = blocks?.filter(
      (block) =>
        block.parent === undefined &&
        block.originalName !== undefined &&
        block["journal?"] === false,
    );
    if (!potentiallyDeletedPages || potentiallyDeletedPages.length === 0)
      return;
    // Process each potentially deleted page
    for (const page of potentiallyDeletedPages) {
      // Get the page to check if it still exists
      const pageEntity = await logseq.Editor.getPage(page.uuid);
      // If page exits skip to next page in loop
      if (pageEntity) continue;

      const pageNameToRemove = page.originalName;
      allPagesSorted = allPagesSorted.filter(
        (pageName) => pageName !== pageNameToRemove,
      );
      delete pagesToTagsMap[pageNameToRemove];
    }
  });

  if (logseq.settings.enableConsoleLogging === true)
    console.info("logseq-autolink-autotag: Plugin loaded");
}

const settings = [
  {
    key: "keybinding",
    description: "Keybinding to run plugin on the last edited block",
    type: "string",
    default: "mod+shift+b",
    title: "Keybinding",
  },
  {
    key: "enableAutoLink",
    description: "Enable automatic linking",
    type: "boolean",
    default: true,
    title: "Enable auto-link",
  },
  {
    key: "enableAutoTag",
    description: "Enable automatic tagging",
    type: "boolean",
    default: true,
    title: "Enable auto-tag",
  },
  {
    key: "autoLinkFirstOccuranceOnly",
    description:
      "Auto-link only the first occurance of a page in the last edited block",
    type: "boolean",
    default: false,
    title: "Auto-link first occurance only",
  },
  {
    key: "runUponPressingEnter",
    description: "Run plugin upon pressing enter on the last edited block",
    type: "boolean",
    default: true,
    title: "Run upon pressing enter",
  },
  {
    key: "tagAsLink",
    description: "Auto-tag with [[tag]] instead of #tag",
    type: "boolean",
    default: false,
    title: "Tag as link",
  },
  {
    key: "tagInTheBeginning",
    description: "Insert tags in the beginning of block",
    type: "boolean",
    default: false,
    title: "Tag in the beginning",
  },
  {
    key: "pagesToExclude",
    description: "List of comma-separated pages to exclude from auto-linking",
    type: "string",
    default: "card",
    title: "Pages to exclude from auto-linking",
  },
  {
    key: "blocksToExclude",
    description:
      "Regex pattern of blocks to exclude from auto-linking and auto-tagging",
    type: "string",
    default: "(\\w+::)|{{.*}}",
    title: "Blocks to exclude from auto-linking and auto-tagging",
  },
  {
    key: "enableConsoleLogging",
    description: "Enables console logging",
    type: "boolean",
    default: false,
    title: "Enable console logging",
  },
];

// Only initialize the plugin if we're in the Logseq environment
if (typeof logseq !== "undefined") {
  logseq.useSettingsSchema(settings);
  logseq.ready(main).catch(console.error);
}

/* TODO

ci
- [x] add release-please github action
- [x] update release-please workflow with steps to create and attach a release zip

feat
- [x] auto-tag blocks based on linked pages by pressing enter
- [x] auto-tag by slash command
- [ ] ~~auto-tag by keybinding~~
- [x] auto-link pages by pressing enter
- [x] auto-link by slash command
- [ ] ~~auto-link by keybinding~~
- [x] add auto-link first occurance only
- [x] auto-tag with [[tag]] instead of #tag
- [x] add autoTagOnEnter, autoLinkOnEnter, pagesToExclude, blocksToExclude, useHashtag, insertTags logic
- [x] add setting to enable/disable auto-link by pressing enter
- [x] add setting to set auto-link keybinding
- [x] add setting to enable/disable auto-link first occurance only
- [x] add setting to enable/disable auto-tag by pressing enter
- [x] add setting to set auto-tag keybinding
- [x] add setting to use #tag/[[tag]] tag format
- [x] add setting to insert/append tags
- [x] add setting to set blocks to skip
- [x] add setting to set pages to skip
- [ ] add setting to set property to auto-tag on i.e. other than tags::
- [x] run plugin by keybinding

fix
- [x] add guards to process keyup events only when editing a block
- [x] auto-link newly created pages
- [x] remove #Parent tag if #[[Parent/Child]] tag was added
- [x] do not auto-link deleted pages
- [x] skip blocks with {{*}} or *::
- [x] inserting tags at the beginning of a block breaks tasks
- [ ] plugin continues auto-tagging with obsolete tags after tags are renamed
- [ ] Non-existing pages directly added as aliases to existing pages cannot be detected
- [ ] plugin unaware of graph switch
- [x] pressing enter to select a todo priority triggers the plugin
- [x] prevent overwriting alias tags

perf
- [x] use promise.all to fetch pages in parallel
- [x] use keyup event instead of logseq.db.onchange to improve responsiveness
- [x] use pre-constructed data structures of page names and tags instead of fetching data every time
- [x] make logging conditional
- [x] lazy load plugin data to reduce plugin loading time

*/
