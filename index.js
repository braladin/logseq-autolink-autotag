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

  // Log found tags
  if (!uniqueTags || uniqueTags.length === 0) {
    console.debug("logseq-auto-tagger: autoTag: tags=[]");
    return;
  }

  console.debug(`logseq-auto-tagger: autoTag: tags=${uniqueTags.join(", ")}`);

  // Update content with tags
  let isUpdated = false;
  for (const tag of uniqueTags) {
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

async function main() {
  const allPages = await logseq.Editor.getAllPages();
  let currentBlock;

  logseq.Editor.registerSlashCommand("Auto tag", async () => {
    console.debug("logseq-auto-tagger: main: slash command Auto tag");
    await autoTag(currentBlock);
  });

  logseq.Editor.registerSlashCommand("Auto link", async () => {
    console.debug("logseq-auto-tagger: main: slash command Auto link");
    await autoLink(currentBlock, allPages);
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
        await autoLink(currentBlock, allPages);
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

  console.debug("logseq-auto-tagger: main: plugin loaded");
}
// TODO skjeri
logseq.ready(main).catch(console.error);

/* TODO

ci
- [x] add release-please github action

feat
- [x] auto-tag blocks based on linked pages by pressing enter
- [x] auto-tag by slash command
- [ ] auto-tag by keybinding
- [x] auto-link pages by pressing enter
- [x] auto-link by slash command
- [ ] auto-link by keybinding
- [ ] auto-link first occurance only

fix
- [x] add guards to process keyup events only when editing a block
- [ ] auto-link newly created pages
- [ ] remove parent tags if child tags are present

perf
- [x] use promise.all to fetch pages in parallel
- [x] use keyup event instead of logseq.db.onchange to improve responsiveness

*/
