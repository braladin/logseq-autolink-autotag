export async function autoTag(block, pagesToTagsMap, isDbGraph = false) {
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
  const tags = pages.flatMap((page) =>
    Object.hasOwn(pagesToTagsMap, page) ? (pagesToTagsMap[page] ?? []) : [],
  );

  const uniqueTags = [...new Set(tags)];
  // Slash-delimited tag hierarchies are specific to Markdown graphs.
  const cleanedUpTags = isDbGraph
    ? [...new Map(tags.map((tag) => [tag.uuid, tag])).values()]
    : uniqueTags.filter((tag) => !uniqueTags.some((t) => t.includes(tag + "/")));

  // Return early if no tags were found
  if (!cleanedUpTags?.length) {
    if (logseq.settings.enableConsoleLogging === true)
      console.debug("logseq-autolink-autotag: tags: []");
    return;
  }

  const tagNames = cleanedUpTags.map((tag) => (isDbGraph ? tag.title : tag));
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(`logseq-autolink-autotag: tags: ${tagNames.join(", ")}`);

  if (isDbGraph) {
    for (const { id, uuid } of cleanedUpTags) {
      const alreadyTagged = block.tags?.some((tag) =>
        typeof tag === "object"
          ? tag?.uuid === uuid || (id != null && tag?.id === id)
          : tag === uuid || tag === id,
      );
      if (!alreadyTagged) await logseq.Editor.addBlockTag(block.uuid, uuid);
    }
    return;
  }

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
  if (!tagsString) return;
  if (logseq.settings?.tagInTheBeginning) {
    const todoRegexWithPriority =
      /^(TODO|LATER|NOW|DOING|IN-PROGRESS|DONE|CANCELED|CANCELLED|WAITING|WAIT)?(?:\s)?(\[#[A-C]\])?/i;
    const [, state, priority] = content.match(todoRegexWithPriority);
    content = content.replace(todoRegexWithPriority, "").trim();
    const taskState = state ? `${state} ` : "";
    const taskPrio = priority ? `${priority} ` : "";
    content = `${taskState}${taskPrio}${tagsString} ${content}`;
  } else {
    content = `${content} ${tagsString}`;
  }

  // Update block with new content
  await logseq.Editor.updateBlock(block.uuid, content);

  if (logseq.settings.enableConsoleLogging === true)
    console.info(
      `logseq-autolink-autotag: Auto-tagged block with tags: ${tagNames.join(", ")}`,
    );
}

export async function autoLink(block, allPagesSorted, pageUuids) {
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
    // Skip page if it is found in pagesToExclude setting
    if (logseq.settings?.pagesToExclude.includes(page)) continue;
    // Skip page if it is not found in content
    if (!content.toLowerCase().includes(page.toLowerCase())) continue;
    if (logseq.settings?.doNotAutolinkSelf === true) {
      // Skip page if the current block is inside it
      const blockPage = await logseq.Editor.getPage(block.page.id);
      const blockPageName = blockPage.originalName || blockPage.name;
      if (blockPageName?.toLowerCase() === page.toLowerCase()) continue;
    }
    // Add text exclusion markers
    const textToExclude = new RegExp(logseq.settings?.textToExclude, "g");
    content = content.replace(textToExclude, (match) => `︿${match}﹀`);
    // Create a regex pattern from the page name, escaping special characters
    const pageName = page.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Look for the page name surrounded by word boundaries
    const plural = logseq.settings?.autoLinkPlurals
      ? "(?=\\b|s\\b|es\\b)"
      : "\\b";
    const regex = new RegExp(`\\b${pageName}${plural}(?![^︿]*﹀)`, "gi");
    const linkTarget = pageUuids?.[page] ?? page;
    const link = `[[${linkTarget}]]`;
    const beforeLinking = content;
    // Only replace first occurrence if setting is enabled
    if (logseq.settings?.autoLinkFirstOccuranceOnly) {
      // Replace only the first occurrence
      if (
        !content.includes(`[${page}]`) &&
        !content.includes(`[${linkTarget}]`)
      ) {
        let replacementCount = 0;
        content = content.replace(regex, (match) => {
          if (replacementCount === 0) {
            replacementCount++;
            return link;
          } else {
            return `︿${match}﹀`;
          }
        });
      }
    } else {
      // Replace all occurrences
      content = content.replace(regex, () => link);
    }
    if (
      pageUuids &&
      content !== beforeLinking &&
      logseq.settings.enableConsoleLogging === true
    ) {
      console.debug(
        `logseq-autolink-autotag: DB autolink target ${JSON.stringify(page)} -> ${linkTarget}`,
      );
    }
  }

  // Remove text exclusion markers
  content = content.replace(/[︿﹀]/g, "");

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
  const pageName = newPageEntity.originalName || newPageEntity.name;
  // Check if the page already exists in the sorted list and return early if it does
  if (allPagesSorted.includes(pageName)) {
    if (logseq.settings.enableConsoleLogging === true)
      console.debug(
        `logseq-autolink-autotag: ${pageName} already exists in AllPagesSorted`,
      );
    return;
  }
  // Find the correct position to insert the new page based on name length
  const newPageLength = pageName?.length || 0;
  if (newPageLength === 0) return;
  let insertIndex = 0;
  while (
    insertIndex < allPagesSorted.length &&
    allPagesSorted[insertIndex].length > newPageLength
  ) {
    insertIndex++;
  }

  // Insert the new page at the correct position
  allPagesSorted.splice(insertIndex, 0, pageName);
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(
      `logseq-autolink-autotag: Added ${pageName} to AllPagesSorted`,
    );
}

function getEntityName(entity) {
  if (typeof entity === "string") return entity.trim();
  return entity?.originalName || entity?.name || entity?.title;
}

function normalizeTagNames(tags) {
  const values = Array.isArray(tags) ? tags : [tags];
  return values
    .map(getEntityName)
    .filter((tag) => typeof tag === "string" && tag.length > 0)
    .map((tag) => tag.replace(/[#\[\]]/g, ""));
}

export async function getIsDbGraph() {
  try {
    return await logseq.App.checkCurrentIsDbGraph();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Not existed method #checkCurrentIsDbGraph"))
      return false;
    throw error;
  }
}

function isSupportedPage(page) {
  const pageName = page.originalName || page.name;
  const isPageType =
    !page.type || page.type === "page" || page.type === "journal";
  return Boolean(
    pageName &&
    isPageType &&
    page["journal?"] !== true &&
    page.type !== "journal",
  );
}

async function isUsedAsTag(page) {
  const references = await logseq.Editor.getPageLinkedReferences(page.uuid);
  return Boolean(
    references?.some(([, blocks]) =>
      blocks.some((block) =>
        block.content?.includes(`#${page.originalName || page.name}`),
      ),
    ),
  );
}

export function updatePagesToTagsMap(block, page, pagesToTagsMap) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting updatePagesToTagsMap");
  const pageName = page.originalName || page.name;
  if (!pageName) return;

  const propertyTags = page.properties?.tags;
  const tags =
    propertyTags !== undefined
      ? normalizeTagNames(propertyTags)
      : (block?.content?.match(/tags::\s*(.*)/)?.[1] || "")
          .split(",")
          .map((tag) => tag.trim().replace(/[#\[\]]/g, ""))
          .filter((tag) => tag.length > 0);
  pagesToTagsMap[pageName] = tags;
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(
      `logseq-autolink-autotag: Updated page ${pageName} with tags ${tags}`,
    );
}

async function getDbPagesToTagsMap() {
  // getAllPages() does not pull the native tag or alias relationships.
  const pages = await logseq.DB.datascriptQuery(`[:find [(pull ?page
    [:block/uuid :block/title :block/journal-day
     {:block/tags [:db/id :db/ident :block/uuid :block/title]}
     {:block/alias [:block/uuid :block/title]}]) ...]
    :where
    [?page :block/name]
    (not [?page :logseq.property/deleted-at])
    [(get-else $ ?page :logseq.property/hide? false) ?hidden]
    [(false? ?hidden)]]`);
  const pagesToTagsMap = Object.create(null);
  const pageUuids = Object.create(null);
  const aliases = [];
  const internalTags = new Set([
    ":logseq.class/Page",
    ":logseq.class/Tag",
    ":logseq.class/Journal",
    ":logseq.class/Property",
  ]);

  for (const page of pages ?? []) {
    if (!page.uuid || !page.title || page["journal-day"]) continue;
    const nativeTags = page.tags ?? [];
    if (
      nativeTags.some(
        ({ ident }) =>
          ident === ":logseq.class/Property" || ident === ":logseq.class/Journal",
      )
    ) {
      continue;
    }

    const tags = nativeTags.filter(
      ({ ident, uuid }) => uuid && !internalTags.has(ident),
    );
    const isTag = nativeTags.some(({ ident }) => ident === ":logseq.class/Tag");
    pagesToTagsMap[page.uuid] = tags;
    if (!isTag || !Object.hasOwn(pagesToTagsMap, page.title)) {
      pagesToTagsMap[page.title] = tags;
    }
    if (!logseq.settings.doNotAutolinkTags || !isTag) {
      if (!isTag || !Object.hasOwn(pageUuids, page.title)) {
        pageUuids[page.title] = page.uuid;
      }
    }
    for (const alias of page.alias ?? []) {
      aliases.push({ alias, tags, isTag });
    }
  }

  for (const { alias, tags, isTag } of aliases) {
    if (alias.uuid) pagesToTagsMap[alias.uuid] = tags;
    if (!alias.title) continue;
    pagesToTagsMap[alias.title] = tags;
    if (alias.uuid && (!logseq.settings.doNotAutolinkTags || !isTag)) {
      // Link to the alias itself so Logseq displays its title, not the source title.
      pageUuids[alias.title] = alias.uuid;
    }
  }

  return {
    allPagesSorted: Object.keys(pageUuids).sort((a, b) => b.length - a.length),
    pagesToTagsMap,
    pageUuids,
  };
}

export async function getPagesToTagsMap(isDbGraph = false) {
  if (isDbGraph) return getDbPagesToTagsMap();

  const pageEntities = await logseq.Editor.getAllPages();
  const pagesToTagsMap = {};
  const supportedPages = pageEntities.filter(isSupportedPage);
  const pages = logseq.settings.doNotAutolinkTags
    ? (
        await Promise.all(
          supportedPages.map(async (page) => ({
            page,
            isTag: await isUsedAsTag(page),
          })),
        )
      )
        .filter(({ isTag }) => !isTag)
        .map(({ page }) => page)
    : supportedPages;

  for (const page of pages) {
    const pageName = page.originalName || page.name;
    // Store page names and tags
    pagesToTagsMap[pageName] = normalizeTagNames(page.properties?.tags);
  }

  // Process aliases in a separate loop to avoid overwriting tags
  for (const page of pages) {
    // Store alias names with the tags of the pages they point to
    const aliases = page.properties?.alias ?? page.properties?.aliases;
    const aliasList = Array.isArray(aliases) ? aliases : [aliases];
    for (const aliasValue of aliasList) {
      const alias = getEntityName(aliasValue);
      if (alias)
        pagesToTagsMap[alias] = normalizeTagNames(page.properties?.tags);
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
  isDbGraph = false,
  pageUuids,
) {
  if (logseq.settings.enableConsoleLogging === true)
    console.debug("logseq-autolink-autotag: Starting autoLinkAutoTagCallback");
  if (!block?.uuid) return;
  block = await logseq.Editor.getBlock(block.uuid);
  // Skip if block is empty
  if (!block?.content) return;
  // Skip if block is excluded by user settings
  if (new RegExp(logseq.settings.blocksToExclude).test(block.content)) return;
  if (logseq.settings.enableConsoleLogging === true)
    console.debug(
      `logseq-autolink-autotag: Running on current block with content "${block.content}"`,
    );
  if (logseq.settings?.enableAutoLink) {
    block = await autoLink(block, allPagesSorted, pageUuids);
  }
  if (logseq.settings?.enableAutoTag) {
    await autoTag(block, pagesToTagsMap, isDbGraph);
  }
  block = undefined;
}
