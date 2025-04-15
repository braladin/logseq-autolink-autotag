async function autoTag(block) {
  let content = block.content;

  // Log block details
  console.debug(`logseq-auto-tagger: autoTag: block.content=${content}`);

  // Extract linked pages from content
  const pages = content
    .match(/(?<!#)\[\[([^\]]+)\]\]/g)
    ?.map((page) => page.slice(2, -2));

  if (!pages || pages.length === 0) {
    console.debug("logseq-auto-tagger: autoTag: pages=[]");
    return;
  }

  console.debug(`logseq-auto-tagger: autoTag: pages=${pages.join(", ")}`);

  // Loop over pages and extract tags
  const tags = [];
  const tagPromises = pages.map((page) => logseq.Editor.getPage(page));
  const pageEntities = await Promise.all(tagPromises);
  for (const pageEntity of pageEntities) {
    if (pageEntity?.properties?.tags) {
      // Handle different formats of tags (array or single value)
      const pageTags = Array.isArray(pageEntity.properties.tags)
        ? pageEntity.properties.tags
        : [pageEntity.properties.tags];
      tags.push(...pageTags);
    }
  }

  // Remove duplicate tags
  const uniqueTags = [...new Set(tags)];

  // Remove #Parent tag if a child tag #[[Parent/Child]] is present
  const cleanedUpTags = uniqueTags.filter(
    (tag) => uniqueTags.filter((t) => t.includes(tag + "/")).length === 0,
  );

  // Log found tags
  if (!cleanedUpTags || cleanedUpTags.length === 0) {
    console.debug("logseq-auto-tagger: autoTag: tags=[]");
    return;
  }

  console.debug(
    `logseq-auto-tagger: autoTag: tags=${cleanedUpTags.join(", ")}`,
  );

  // Update content with tags
  let isUpdated = false;
  for (const tag of cleanedUpTags) {
    if (content.includes(`#[[${tag}]]`) || content.includes(`#${tag}`))
      continue;
    content += ` ${tag.includes(" ") ? `#[[${tag}]]` : `#${tag}`}`;
    isUpdated = true;
  }
  if (isUpdated) await logseq.Editor.updateBlock(block.uuid, content);
}

async function autoLink(block, allPages) {
  let content = block.content;

  // Log block details
  console.debug(`logseq-auto-tagger: autoLink: block.content=${content}`);

  const sortedPages = [...allPages].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0),
  );

  for (const page of sortedPages) {
    // Create a regex pattern from the page name, escaping special characters
    const pageName = page.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Look for the page name surrounded by word boundaries (spaces, punctuation, start/end of text)
    const regex = new RegExp(`(?<=^|\\s)${pageName}(?=\\s|$|[,.;:!?)])`, "gi");
    content = content.replace(regex, `[[${page.name}]]`);
  }

  if (content !== block.content) {
    await logseq.Editor.updateBlock(block.uuid, content);
  }
}

function insertNewPage(newPage, allPagesSorted) {
  // Find the correct position to insert the new page based on name length
  const newPageLength = newPage.name?.length || 0;

  let insertIndex = 0;
  while (
    insertIndex < allPagesSorted.length &&
    (allPagesSorted[insertIndex].name?.length || 0) > newPageLength
  ) {
    insertIndex++;
  }

  // Insert the new page at the correct position
  allPagesSorted.splice(insertIndex, 0, newPage);
  return allPagesSorted;
}

async function getAllPagesSorted() {
  const allPages = await logseq.Editor.getAllPages();

  // Sort pages by name length to ensure that e.g. a page called
  // "Software development" gets processed before a page called "Software"
  return [...allPages].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0),
  );
}

function removePage(pageToRemove, pages) {
  return pages.filter((p) => p.uuid !== pageToRemove.uuid);
}

async function main() {
  let allPagesSorted = await getAllPagesSorted();
  let currentBlock;

  logseq.Editor.registerSlashCommand("Auto tag", async () => {
    console.debug("logseq-auto-tagger: main: slash command Auto tag");
    await autoTag(currentBlock);
  });

  logseq.Editor.registerSlashCommand("Auto link", async () => {
    console.debug("logseq-auto-tagger: main: slash command Auto link");
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
      console.debug(
        "logseq-auto-tagger: main: Enter pressed, processing block",
      );
      try {
        currentBlock = await logseq.Editor.getBlock(currentBlock.uuid);
        await autoLink(currentBlock, allPagesSorted);
        const updatedBlock = await logseq.Editor.getBlock(currentBlock.uuid);
        await autoTag(updatedBlock);
      } catch (error) {
        console.error("Error processing block:", error);
      } finally {
        currentBlock = undefined;
      }
    } else {
      console.debug("logseq-auto-tagger: main: Block updated");
      currentBlock = await logseq.Editor.getCurrentBlock();
    }
  });

  logseq.DB.onChanged(async ({ blocks, txData, txMeta }) => {
    // Ignore changes that are not relevant to the plugin
    if (txMeta?.["skipRefresh?"] === true) return;

    // Handle page creation
    if (txMeta?.outlinerOp === "create-page") {
      allPagesSorted = insertNewPage(blocks[0], allPagesSorted);
      return;
    }

    // Handle page deletion
    const deletedPages = blocks?.filter(
      (block) => block.parent === undefined && block.originalName !== undefined,
    );

    if (!deletedPages || deletedPages.length === 0) return;

    // Process each potentially deleted page
    for (const page of deletedPages) {
      try {
        const pageEntity = await logseq.Editor.getPage(page.uuid);
        if (!pageEntity) {
          console.debug(`logseq-auto-tagger: main: Page ${page.name} deleted`);
          allPagesSorted = removePage(page, allPagesSorted);
        }
      } catch (error) {
        console.error(`Error checking if page was deleted:`, error);
        // If we can't verify the page exists, assume it's deleted to be safe
        allPagesSorted = removePage(page, allPagesSorted);
      }
    }
  });

  console.debug("logseq-auto-tagger: main: plugin loaded");
}

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
- [ ] auto-link first occurance only
- [ ] setting to enable/disable auto-linking by pressing enter
- [ ] setting to enable/disable auto-tagging by pressing Enter
- [ ] setting to enable/disable auto-linking first occurance only
- [ ] setting to set a custom property to auto-tag on

fix
- [x] add guards to process keyup events only when editing a block
- [x] auto-link newly created pages
- [x] remove #Parent tag if #[[Parent/Child]] tag was added
- [x] do not auto-link deleted pages
- [ ] keep track of tag rename and auto-tag with the latest tag

perf
- [x] use promise.all to fetch pages in parallel
- [x] use keyup event instead of logseq.db.onchange to improve responsiveness

*/
