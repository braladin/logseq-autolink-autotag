async function autoTag(block = undefined) {
  // Get the block's UUID and content
  const { uuid, content } = block
    ? { uuid: block.uuid, content: block.content }
    : await logseq.Editor.getCurrentBlock();

  // Log block details
  console.debug(`logseq-auto-tagger: Block UUID: ${uuid}`);
  console.debug(`logseq-auto-tagger: Block content: ${content}`);

  // Extract linked pages from content
  const pages = content
    .match(/(?<!#)\[\[([^\]]+)\]\]/g)
    ?.map((page) => page.slice(2, -2));

  if (!pages || pages.length === 0) {
    console.debug("logseq-auto-tagger: No block pages found");
    return;
  }

  console.debug(
    `logseq-auto-tagger: Found ${pages.length} pages: ${pages.join(", ")}`,
  );

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
    console.debug("logseq-auto-tagger: No block tags found");
    return;
  }

  console.debug(
    `logseq-auto-tagger: Found ${uniqueTags.length} tags: ${uniqueTags.join(", ")}`,
  );

  // Update content with tags
  let newContent = content;
  for (const tag of uniqueTags) {
    if (content.includes(`#[[${tag}]]`) || content.includes(`#${tag}`))
      continue;
    newContent += ` ${tag.includes(" ") ? `#[[${tag}]]` : `#${tag}`}`;
  }
  if (newContent != content) logseq.Editor.updateBlock(uuid, newContent);
}

function main() {
  logseq.Editor.registerSlashCommand("Auto tag", () => {
    return autoTag();
  });

  logseq.DB.onChanged(({ blocks, txData, txMeta }) => {
    if (txMeta?.["skipRefresh?"] === true) return;
    if (txMeta.outlinerOp == "insert-blocks") {
      console.debug(
        "logseq-auto-tagger: Block insert detected (ENTER pressed)",
      );
      autoTag(currentBlock);
    } else {
      console.debug("logseq-auto-tagger: DB change detected");
      currentBlock = blocks.find((block) => !block.file);
    }
  });

  console.debug("logseq-auto-tagger: plugin loaded");
}

let currentBlock;
logseq.ready(main).catch(console.error);
