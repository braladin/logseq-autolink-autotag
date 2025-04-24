export async function autoTag(block, pagesToTagsMap) {
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

  // Return early if no tags were found
  if (!cleanedUpTags?.length) {
    if (logseq.settings.enableConsoleLogging === true)
      console.debug("logseq-autolink-autotag: tags: []");
    return;
  }

  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: tags: ${cleanedUpTags.join(", ")}`);

  // Update content with tags
  let tagsString = "";
  for (let tag of cleanedUpTags) {
    // Skip tag if already exists in block content
    if (content.includes(`[[${tag}]]`) || content.includes(`#${tag}`)) continue;
    // Add [[ ]] if tag contains space or tagAsLink is true
    if (tag.includes(" ") || logseq.settings?.tagAsLink === true)
      tag = `[[${tag}]]`;
    // Add # if tagAsLink is false
    if (logseq.settings?.tagAsLink === false) tag = `#${tag}`;
    // Add tag to tagsString
    tagsString += tag + " ";
  }
  tagsString = tagsString.trim();
  if (logseq.settings?.tagInTheBeginning) {
    const todoRegexWithPriority =
      /^(TODO|LATER|NOW|DOING|IN-PROGRESS|DONE|CANCELED|CANCELLED|WAITING|WAIT)?(?:\s)?(\[#[A-C]\])?/i;
    const match = content.match(todoRegexWithPriority);
    if (match) {
      content = content.replace(todoRegexWithPriority, "").trim();
      const taskState = match[1] ? `${match[1]} ` : "";
      const taskPrio = match[2] ? `${match[2]} ` : "";
      content = `${taskState}${taskPrio}${tagsString} ${content}`;
    }
  } else {
    content = `${content} ${tagsString}`;
  }

  // Update block with new content
  await logseq.Editor.updateBlock(block.uuid, content);

  if (logseq.settings.enableConsoleLogging === true)
    console.info(
      `logseq-autolink-autotag: Auto-tagged block with tags: ${cleanedUpTags.join(", ")}`,
    );
}

export async function autoLink(block, allPagesSorted) {
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
    const regex = new RegExp(
      `(?<=^|\\s|['("])${pageName}(?=\\s|$|[,.;:!?)'"])`,
      "gi",
    );
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

export function updateAllPagesSorted(newPageEntity, allPagesSorted) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting updateAllPagesSorted");
  // Find the correct position to insert the new page based on name length
  const newPageLength = newPageEntity.originalName?.length || 0;

  let insertIndex = 0;
  while (
    insertIndex < allPagesSorted.length &&
    (allPagesSorted[insertIndex].length || 0) > newPageLength
  ) {
    insertIndex++;
  }

  // Insert the new page at the correct position
  allPagesSorted.splice(insertIndex, 0, newPageEntity.originalName);
}

export function updatePagesToTagsMap(block, page, pagesToTagsMap) {
  const tagsRegex = /tags::\s*(.*)/;
  const tagsString = block.content.match(tagsRegex)?.[1] || "";
  const tags = tagsString
    .split(",")
    .map((tag) => tag.trim().replace(/[#\[\]]/g, ""))
    .filter((tag) => tag.length > 0);
  pagesToTagsMap[page.originalName] = tags;
}

export async function getPagesToTagsMap() {
  const pageEntities = await logseq.Editor.getAllPages();
  const pagesToTagsMap = {};

  // Process pages
  for (const page of pageEntities) {
    // Skip journal pages
    if (page["journal?"] === true) continue;

    // Store page names and tags
    pagesToTagsMap[page.originalName] = page.properties?.tags
      ? page.properties?.tags
      : undefined;
  }

  // Process aliases in a separate loop to avoid overwriting tags
  for (const page of pageEntities) {
    // Skip journal pages
    if (page["journal?"] === true) continue;

    // Store alias names with the tags of the pages they point to
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
  const allPagesSorted = Object.keys(pagesToTagsMap).sort(
    (a, b) => b.length - a.length,
  );

  return { allPagesSorted, pagesToTagsMap };
}

export async function autoLinkAutoTagCallback(
  block,
  allPagesSorted,
  pagesToTagsMap,
) {
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
