import { beforeEach, expect, it, jest } from "@jest/globals";
import {
  autoLink,
  autoLinkAutoTagCallback,
  autoTag,
  getIsDbGraph,
  getPagesToTagsMap,
  updateAllPagesSorted,
  updatePagesToTagsMap,
} from "../src/functions.js";

beforeEach(() => {
  globalThis.logseq = {
    settings: { enableConsoleLogging: false },
    App: { checkCurrentIsDbGraph: jest.fn() },
    DB: { datascriptQuery: jest.fn() },
    Editor: {
      addBlockTag: jest.fn(),
      getAllPages: jest.fn(),
      getBlock: jest.fn(),
      getPageLinkedReferences: jest.fn(),
      updateBlock: jest.fn(),
    },
  };
});

it.each([undefined, "Plain text", "[[Unknown]]", "[[Untagged]]"])(
  "leaves the block alone when there are no tags to add (%s)",
  async (content) => {
    await autoTag({ uuid: "block", content }, { Untagged: [] });
    expect(logseq.Editor.updateBlock).not.toHaveBeenCalled();
    expect(logseq.Editor.addBlockTag).not.toHaveBeenCalled();
  },
);

it("leaves an empty block alone when autolinking", async () => {
  await autoLink({ uuid: "block", content: "" }, ["Alice"]);
  expect(logseq.Editor.updateBlock).not.toHaveBeenCalled();
});

it("does not re-add native tags stored as UUIDs or numeric entity IDs", async () => {
  const tags = [
    { id: 1, uuid: "topic-uuid", title: "Topic" },
    { id: 2, uuid: "person-uuid", title: "Person" },
    { id: 3, uuid: "place-uuid", title: "Place" },
  ];
  await autoTag(
    { uuid: "block", content: "[[Page]]", tags: ["topic-uuid", 2] },
    { Page: tags },
    true,
  );
  expect(logseq.Editor.addBlockTag.mock.calls).toEqual([["block", "place-uuid"]]);
});

it("surfaces unexpected graph detection errors unchanged", async () => {
  const failure = "Graph connection closed";
  logseq.App.checkCurrentIsDbGraph.mockRejectedValue(failure);
  await expect(getIsDbGraph()).rejects.toBe(failure);
});

it.each([true, false])("does not insert a duplicate page (logging: %s)", (logging) => {
  logseq.settings.enableConsoleLogging = logging;
  const pages = ["Alice", "Bob"];
  updateAllPagesSorted({ name: "Alice" }, pages);
  expect(pages).toEqual(["Alice", "Bob"]);
});

it("inserts a page even when console logging is disabled", () => {
  const pages = ["Alice"];
  updateAllPagesSorted({ name: "Bob" }, pages);
  expect(pages).toEqual(["Alice", "Bob"]);
});

it("ignores nameless metadata and accepts a single tag value", () => {
  const tags = { Alice: ["Previous"] };
  updatePagesToTagsMap(null, {}, tags);
  expect(tags).toEqual({ Alice: ["Previous"] });

  updatePagesToTagsMap(null, { name: "Alice", properties: { tags: " #Person " } }, tags);
  expect(tags).toEqual({ Alice: ["Person"] });
});

it("retains Markdown pages with no hashtag references when tag exclusion is enabled", async () => {
  logseq.settings.doNotAutolinkTags = true;
  logseq.Editor.getAllPages.mockResolvedValue([
    { uuid: "tag", name: "Fruit" },
    { uuid: "page", originalName: "Alice" },
    { uuid: "unused", name: "Garden" },
  ]);
  logseq.Editor.getPageLinkedReferences
    .mockResolvedValueOnce([[{}, [{ content: "I like #Fruit" }]]])
    .mockResolvedValueOnce([[{}, [{}, { content: "I met [[Alice]]" }]]]);

  const result = await getPagesToTagsMap();
  expect(result.allPagesSorted).toEqual(["Garden", "Alice"]);
  expect(result.pagesToTagsMap).toEqual({ Garden: [], Alice: [] });
});

it("returns an empty DB index when the query returns no result", async () => {
  expect(await getPagesToTagsMap(true)).toEqual({
    allPagesSorted: [],
    pagesToTagsMap: {},
    pageUuids: {},
  });
});

it("keeps the ordinary DB page as the title target when a tag has the same title", async () => {
  const topic = { uuid: "topic", title: "Topic" };
  logseq.DB.datascriptQuery.mockResolvedValue([
    { uuid: "regular", title: "Shared", tags: [topic] },
    {
      uuid: "tag",
      title: "Shared",
      tags: [{ uuid: "tag-class", ident: ":logseq.class/Tag" }],
      alias: [{ title: "Missing reference" }, { uuid: "untitled-alias" }],
    },
  ]);

  const result = await getPagesToTagsMap(true);
  expect(result.allPagesSorted).toEqual(["Shared"]);
  expect(result.pageUuids.Shared).toBe("regular");
  expect(result.pagesToTagsMap.Shared).toEqual([topic]);
  expect(result.pagesToTagsMap.tag).toEqual([]);
});

it("excludes aliases of DB tag pages from autolinking without losing their tags", async () => {
  const topic = { uuid: "topic", title: "Topic" };
  logseq.settings.doNotAutolinkTags = true;
  logseq.DB.datascriptQuery.mockResolvedValue([
    {
      uuid: "tag",
      title: "Person",
      tags: [topic, { uuid: "tag-class", ident: ":logseq.class/Tag" }],
      alias: [{ title: "People", uuid: "alias" }],
    },
  ]);

  const result = await getPagesToTagsMap(true);
  expect(result.allPagesSorted).toEqual([]);
  expect(result.pagesToTagsMap.alias).toEqual([topic]);
});

it("skips a block that was deleted before the callback refetched it", async () => {
  await autoLinkAutoTagCallback({ uuid: "deleted" }, ["Alice"], {});
  expect(logseq.Editor.getBlock).toHaveBeenCalledWith("deleted");
  expect(logseq.Editor.updateBlock).not.toHaveBeenCalled();
  expect(logseq.Editor.addBlockTag).not.toHaveBeenCalled();
});
