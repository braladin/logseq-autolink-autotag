async function autoTag(block, pagesToTagsMap) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting autoTag");
  if (!block?.content) {
    if (logseq.settings.enableConsoleLogging === true)
      console.error(
        "logseq-autolink-autotag: Current block is empty. Type something and try again.",
      );
    return;
  }

  let content = block.content;

  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: block content: "${content}"`);

  // Extract linked pages from content
  const pages = content
    .match(/(?<!#)\[\[([^\]]+)\]\]/g)
    ?.map((page) => page.slice(2, -2));

  // Return early if no pages were found in the content
  if (!pages?.length) {
    if (logseq.settings.enableConsoleLogging === true)
      console.debug("logseq-autolink-autotag: linked pages: []");
    return;
  }

  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: linked pages: ${pages.join(", ")}`);

  // Collect tags from all linked pages
  const tags = pages
    .filter((page) => pagesToTagsMap[page] !== undefined)
    .flatMap((page) => pagesToTagsMap[page]);

  // Remove duplicate tags
  const uniqueTags = [...new Set(tags)];

  // Remove #Parent tag if a child tag #[[Parent/Child]] is present
  const cleanedUpTags = uniqueTags.filter(
    (tag) => uniqueTags.filter((t) => t.includes(tag + "/")).length === 0,
  );

  // Log found tags
  if (!cleanedUpTags || cleanedUpTags.length === 0) {
    if (logseq.settings.enableConsoleLogging === true)
      console.debug("logseq-autolink-autotag: tags: []");
    return;
  }

  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: tags: ${cleanedUpTags.join(", ")}`);

  // Update content with tags
  let isUpdated = false;
  for (const tag of cleanedUpTags) {
    // Skip tag if already added
    if (content.includes(`[[${tag}]]`) || content.includes(`#${tag}`)) continue;
    const hashtag = logseq.settings?.tagAsLink ? "" : "#";
    if (logseq.settings?.tagInTheBeginning) {
      content = `${hashtag}[[${tag}]] ${content}`;
    } else {
      content =
        tag.includes(" ") || hashtag === ""
          ? `${content} ${hashtag}[[${tag}]]`
          : `${content} ${hashtag}${tag}`;
    }
    isUpdated = true;
  }
  if (isUpdated) {
    if (logseq.settings.enableConsoleLogging === true)
      console.info(
        `logseq-autolink-autotag: Auto-tagged block with tags: ${cleanedUpTags.join(", ")}`,
      );
    await logseq.Editor.updateBlock(block.uuid, content);
  }
}

async function autoLink(block, allPagesSorted) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting autoLink");
  if (!block?.content) {
    if (logseq.settings.enableConsoleLogging === true)
      console.error(
        "logseq-autolink-autotag: Current block is empty. Type something and try again.",
      );
    return;
  }
  let content = block.content;

  // Log block details
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: block.content: ${content}`);

  for (const page of allPagesSorted) {
    // Skip page if it found in pagesToExclude setting
    if (logseq.settings?.pagesToExclude.includes(page)) continue;
    // Create a regex pattern from the page name, escaping special characters
    const pageName = page.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Look for the page name surrounded by word boundaries (spaces, punctuation, start/end of text)
    const regex = new RegExp(`(?<=^|\\s)${pageName}(?=\\s|$|[,.;:!?)])`, "gi");
    // Only replace first occurrence if setting is enabled
    if (logseq.settings?.autoLinkFirstOccuranceOnly) {
      // Replace only the first occurrence
      const match = content.match(regex);
      if (match) {
        content = content.replace(match[0], `[[${page}]]`);
      }
    } else {
      // Replace all occurrences
      content = content.replace(regex, `[[${page}]]`);
    }
  }

  if (content !== block.content) {
    if (logseq.settings.enableConsoleLogging === true)
      console.info(
        `logseq-autolink-autotag: Auto-linked pages in block: ${content}`,
      );
    await logseq.Editor.updateBlock(block.uuid, content);
    block.content = content;
  }
  return block;
}

function updateAllPagesSorted(newPageEntity, allPagesSorted) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting updateAllPagesSorted");
  // Find the correct position to insert the new page based on name length
  const newPageLength = newPageEntity.originalName?.length || 0;

  let insertIndex = 0;
  while (
    insertIndex < allPagesSorted.length &&
    (allPagesSorted[insertIndex].name?.length || 0) > newPageLength
  ) {
    insertIndex++;
  }

  // Insert the new page at the correct position
  allPagesSorted.splice(insertIndex, 0, newPageEntity.originalName);
}

function updatePagesToTagsMap(tagsBlock, taggedPage, pagesToTagsMap) {
  const tagsContent = tagsBlock.content.replace(/^tags::/, "").trim();
  const tags = tagsContent
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag.length > 0);

  pagesToTagsMap[taggedPage.originalName] = tags;
}

async function getPagesToTagsMap() {
  const pageEntities = await logseq.Editor.getAllPages();
  const pagesToTagsMap = {};

  for (const page of pageEntities) {
    // Skip journal pages
    if (page["journal?"] === true) continue;

    // Store the page name and tags
    pagesToTagsMap[page.originalName] = page.properties?.tags
      ? page.properties?.tags
      : undefined;

    // Store page aliases and assign them the same tags as the page
    if (page.properties?.alias) {
      for (const alias of page.properties.alias) {
        pagesToTagsMap[alias] = page.properties?.tags
          ? page.properties?.tags
          : undefined;
      }
    }
  }

  // Sort pages by length in descending order so that e.g. a page "Software development"
  // gets auto-linked before a page "Software"
  allPagesSorted = Object.keys(pagesToTagsMap).sort(
    (a, b) => b.length - a.length,
  );

  return { allPagesSorted, pagesToTagsMap };
}

async function autoLinkAutoTagCallback(block, allPagesSorted, pagesToTagsMap) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting autoLinkAutoTagCallback");
  if (!block?.uuid) return;
  block = await logseq.Editor.getBlock(block.uuid);
  // Skip if block is empty
  if (!block.content) return;
  // Skip if block is excluded by user settings
  if (new RegExp(logseq.settings.blocksToExclude).test(block.content)) return;
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(
      `logseq-autolink-autotag: Running on current block with content "${block.content}"`,
    );
  if (logseq.settings?.enableAutoLink) {
    block = await autoLink(block, allPagesSorted);
  }
  if (logseq.settings?.enableAutoTag) {
    await autoTag(block, pagesToTagsMap);
  }
  block = undefined;
}

async function main() {
  let { allPagesSorted, pagesToTagsMap } = await getPagesToTagsMap();
  let currentBlock;

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
logseq.useSettingsSchema(settings);

logseq.ready(main).catch(console.error);

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
- [ ] plugin continues auto-tagging with obsolete tags after tags are renamed
- [ ] Non-existing pages directly added as aliases to existing pages cannot be detected
- [ ] plugin unaware of graph switch

perf
- [x] use promise.all to fetch pages in parallel
- [x] use keyup event instead of logseq.db.onchange to improve responsiveness
- [x] use pre-constructed data structures of page names and tags instead of fetching data every time
- [x] make logging conditional

*/
