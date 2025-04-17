async function autoTag(block, pagesToTagsMap) {
  if (!block?.content) {
    console.error(
      "logseq-autolink-autotag: Current block is empty. Type something and try again.",
    );
    return;
  }

  console.debug("logseq-autolink-autotag: Auto-tag");
  let content = block.content;

  // Log block details
  console.debug(`logseq-autolink-autotag: block.content: ${content}`);

  // Extract linked pages from content
  const pages = content
    .match(/(?<!#)\[\[([^\]]+)\]\]/g)
    ?.map((page) => page.slice(2, -2));

  if (!pages || pages.length === 0) {
    console.debug("logseq-autolink-autotag: pages: []");
    return;
  }

  console.debug(`logseq-autolink-autotag: pages: ${pages.join(", ")}`);

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
    console.debug("logseq-autolink-autotag: tags: []");
    return;
  }

  console.debug(`logseq-autolink-autotag: tags: ${cleanedUpTags.join(", ")}`);

  // Update content with tags
  let isUpdated = false;
  for (const tag of cleanedUpTags) {
    // Skip tag if already added
    if (content.includes(`[[${tag}]]`) || content.includes(`#${tag}`)) continue;
    const hashtag = logseq.settings?.useHashtag ? "#" : "";
    if (logseq.settings?.insertTags) {
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
    console.info(
      `logseq-autolink-autotag: Auto-tagged block with tags: ${cleanedUpTags.join(", ")}`,
    );
    await logseq.Editor.updateBlock(block.uuid, content);
  }
}

async function autoLink(block, allPagesSorted) {
  if (!block?.content) {
    console.error(
      "logseq-autolink-autotag: Current block is empty. Type something and try again.",
    );
    return;
  }
  console.debug("logseq-autolink-autotag: Auto-link");
  let content = block.content;

  // Log block details
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
    console.info(
      `logseq-autolink-autotag: Auto-linked pages in block: ${content}`,
    );
    await logseq.Editor.updateBlock(block.uuid, content);
  }
}

function updateAllPagesSorted(newPageEntity, allPagesSorted) {
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

function isBlockToExclude({ content }) {
  if (
    logseq.settings?.blocksToExclude &&
    new RegExp(logseq.settings.blocksToExclude).test(content)
  ) {
    console.debug(
      "logseq-autolink-autotag: block skipped as it matches blocksToExclude setting",
    );
    return true;
  }
  return false;
}

async function main() {
  let { allPagesSorted, pagesToTagsMap } = await getPagesToTagsMap();
  let currentBlock;

  logseq.Editor.registerSlashCommand("Auto tag", async () => {
    console.debug("logseq-autolink-autotag: Auto tag slash command called");
    await autoTag(currentBlock, pagesToTagsMap);
  });

  logseq.Editor.registerSlashCommand("Auto link", async () => {
    console.debug("logseq-autolink-autotag: Auto link slash command called");
    await autoLink(currentBlock, allPagesSorted);
  });

  window.parent.document.addEventListener("keyup", async (event) => {
    // Only process keyup events that occur when editing blocks
    if (
      event?.target?.tagName.toLowerCase() !== "textarea" ||
      !event.target.getAttribute("aria-label") === "editing block"
    )
      return;

    if (event.code === "Enter" && currentBlock) {
      console.debug("logseq-autolink-autotag: Enter pressed");
      try {
        currentBlock = await logseq.Editor.getBlock(currentBlock.uuid);
        if (isBlockToExclude(currentBlock)) return;
        if (logseq.settings?.autoLinkOnEnter) {
          await autoLink(currentBlock, allPagesSorted);
        }
        currentBlock = await logseq.Editor.getBlock(currentBlock.uuid);
        if (logseq.settings?.autoTagOnEnter) {
          await autoTag(currentBlock, pagesToTagsMap);
        }
      } catch (error) {
        console.error("Error processing block:", error);
      } finally {
        currentBlock = undefined;
      }
    } else {
      console.debug("logseq-autolink-autotag: Current block updated");
      currentBlock = await logseq.Editor.getCurrentBlock();
    }
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

  console.info("logseq-autolink-autotag: Plugin loaded");
}

const settings = [
  {
    key: "autoLinkKeybinding",
    description: "Keybinding to auto-link pages in current block",
    type: "string",
    default: "mod+shift+l",
    title: "Auto-link keybinding",
  },
  {
    key: "autoLinkOnEnter",
    description: "Auto-link pages in current block on enter",
    type: "boolean",
    default: true,
    title: "Enable auto-link on enter",
  },
  {
    key: "autoLinkFirstOccuranceOnly",
    description:
      "Auto-link only the first occurance of a page in current block",
    type: "boolean",
    default: true,
    title: "Auto-link first occurance only",
  },
  {
    key: "autoTagKeybinding",
    description: "Keybinding to auto-tag current block",
    type: "string",
    default: "mod+shift+t",
    title: "Auto-tag keybinding",
  },
  {
    key: "autoTagOnEnter",
    description: "Auto-tag current block on enter",
    type: "boolean",
    default: true,
    title: "Enable auto-tag on enter",
  },
  {
    key: "useHashtag",
    description: "Auto-tag with #tag instead of [[tag]]",
    type: "boolean",
    default: false,
    title: "Use hashtag",
  },
  {
    key: "insertTags",
    description: "Insert tags instead of appending",
    type: "boolean",
    default: false,
    title: "Insert tags",
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
      "Regex pattern of blocks to exclude from auto-linking and auto-tagging on enter",
    type: "string",
    default: "(\w+::)|{{.*}}",
    title: "Blocks to exclude from auto-linking and auto-tagging on enter",
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
- [ ] auto-tag by keybinding
- [x] auto-link pages by pressing enter
- [x] auto-link by slash command
- [ ] auto-link by keybinding
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

fix
- [x] add guards to process keyup events only when editing a block
- [x] auto-link newly created pages
- [x] remove #Parent tag if #[[Parent/Child]] tag was added
- [x] do not auto-link deleted pages
- [x] skip blocks with {{*}} or *::
- [ ] plugin continues auto-tagging with obsolete tags after they are renamed
- [ ] new pages added as aliases to existing pages cannot be not detected

perf
- [x] use promise.all to fetch pages in parallel
- [x] use keyup event instead of logseq.db.onchange to improve responsiveness
- [x] use pre-constructed data structures of page names and tags instead of fetching data every time
- [ ] make logging conditional

*/
