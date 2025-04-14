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
  for (const page of pages) {
    const pageEntity = await logseq.Editor.getPage(page);
    if (pageEntity && pageEntity.properties && pageEntity.properties.tags) {
      // Handle different formats of tags (array or single value)
      const pageTags = Array.isArray(pageEntity.properties.tags)
        ? pageEntity.properties.tags
        : [pageEntity.properties.tags];
      tags.push(...pageTags);
    }
  }

  // Remove duplicate tags
  const uniqueTags = [...new Set(tags)];

  // Log found tags
  if (!uniqueTags || uniqueTags.length === 0) {
    console.debug("logseq-auto-tagger: autoTag: tags=[]");
    return;
  }

  console.debug(`logseq-auto-tagger: autoTag: tags=${uniqueTags.join(", ")}`);

  // Update content with tags
  isUpdated = false;
  for (const tag of uniqueTags) {
    if (content.includes(`#[[${tag}]]`) || content.includes(`#${tag}`))
      continue;
    content += ` ${tag.includes(" ") ? `#[[${tag}]]` : `#${tag}`}`;
    isUpdated = true;
  }
  if (isUpdated) logseq.Editor.updateBlock(block.uuid, content);
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
    content.replaceAll(page.name);
  }

  if (content !== block.content) {
    await logseq.Editor.updateBlock(block.uuid, content);
  }
}

async function main() {
  const allPages = await logseq.Editor.getAllPages();

  logseq.Editor.registerSlashCommand("Auto tag", () => {
    console.debug("logseq-auto-tagger: main: slash command Auto tag");
    return autoTag(currentBlock);
  });

  logseq.Editor.registerSlashCommand("Auto link", () => {
    console.debug("logseq-auto-tagger: main: slash command Auto link");
    return autoLink(currentBlock, allPages);
  });

  logseq.DB.onChanged(({ blocks, txData, txMeta }) => {
    if (txMeta?.["skipRefresh?"] === true) return;
    if (txMeta.outlinerOp == "insert-blocks") {
      console.debug("logseq-auto-tagger: main: block inserted (ENTER pressed)");
      autoLink(currentBlock, allPages).then(async () => {
        const updatedBlock = await logseq.Editor.getBlock(currentBlock.uuid);
        autoTag(updatedBlock);
      });
    } else {
      console.debug("logseq-auto-tagger: main: db changed");
      currentBlock = blocks.find((block) => !block.file);
    }
  });

  console.debug("logseq-auto-tagger: main: plugin loaded");
}

let currentBlock;
logseq.ready(main).catch(console.error);
