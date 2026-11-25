import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const getIsDbGraph = jest.fn();
const getPagesToTagsMap = jest.fn();
const autoLinkAutoTagCallback = jest.fn();

jest.unstable_mockModule("../src/functions.js", () => ({
  getIsDbGraph,
  getPagesToTagsMap,
  autoLinkAutoTagCallback,
}));

const block = { uuid: "block", content: "Alpha" };
const graphData = {
  allPagesSorted: ["Alpha"],
  pagesToTagsMap: { Alpha: ["Topic"] },
  pageUuids: { Alpha: "page-alpha" },
};
const nextGraphData = {
  allPagesSorted: ["Beta"],
  pagesToTagsMap: { Beta: ["Other topic"] },
  pageUuids: { Beta: "page-beta" },
};

let api;
let parent;
let debug;
let info;
let error;

beforeEach(() => {
  getIsDbGraph.mockReset().mockResolvedValue(false);
  getPagesToTagsMap.mockReset().mockResolvedValue(graphData);
  autoLinkAutoTagCallback.mockReset().mockResolvedValue(undefined);

  api = {
    settings: {
      keybinding: "mod+alt+l",
      runUponPressingEnter: true,
      enableConsoleLogging: false,
    },
    useSettingsSchema: jest.fn(),
    ready: jest.fn(async (start) => start()),
    UI: { showMsg: jest.fn() },
    Editor: {
      registerSlashCommand: jest.fn(),
      getCurrentBlock: jest.fn().mockResolvedValue(block),
      checkEditing: jest.fn().mockResolvedValue(true),
      getPage: jest.fn().mockResolvedValue(null),
    },
    App: {
      onCurrentGraphChanged: jest.fn(),
      registerCommandShortcut: jest.fn(),
    },
    DB: { onChanged: jest.fn() },
  };
  parent = {
    requestIdleCallback: jest.fn(),
    document: { addEventListener: jest.fn() },
  };
  globalThis.logseq = api;
  globalThis.window = { parent };
  debug = jest.spyOn(console, "debug").mockImplementation(() => {});
  info = jest.spyOn(console, "info").mockImplementation(() => {});
  error = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete globalThis.logseq;
  delete globalThis.window;
  jest.restoreAllMocks();
});

async function loadMain() {
  await jest.isolateModulesAsync(async () => {
    await import("../src/main.js");
  });
}

async function boot() {
  await loadMain();
  await api.ready.mock.results[0].value;
  return {
    idle: parent.requestIdleCallback.mock.calls[0][0],
    graphChanged: api.App.onCurrentGraphChanged.mock.calls[0][0],
    slash: api.Editor.registerSlashCommand.mock.calls[0][1],
    shortcut: api.App.registerCommandShortcut.mock.calls[0][1],
    keyup: parent.document.addEventListener.mock.calls[0][1],
    dbChanged: api.DB.onChanged.mock.calls[0][0],
  };
}

function expectProcessedBlock(data, isDbGraph = false, processedBlock = block) {
  expect(autoLinkAutoTagCallback).toHaveBeenLastCalledWith(
    processedBlock,
    data.allPagesSorted,
    data.pagesToTagsMap,
    isDbGraph,
    data.pageUuids,
  );
}

const enter = { code: "Enter", key: "Enter" };
const letter = { code: "KeyA", key: "a" };

describe("plugin startup", () => {
  it("does not initialize outside Logseq", async () => {
    delete globalThis.logseq;
    delete globalThis.window;
    await loadMain();
    expect(getIsDbGraph).not.toHaveBeenCalled();
  });

  it("registers settings and callbacks, then loads metadata at idle", async () => {
    api.settings.enableConsoleLogging = true;
    let resolveMetadata;
    getPagesToTagsMap.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMetadata = resolve;
      }),
    );

    const { idle, shortcut } = await boot();
    expect(api.useSettingsSchema).toHaveBeenCalledTimes(1);
    const [schema] = api.useSettingsSchema.mock.calls[0];
    const settings = Object.fromEntries(
      schema.map(({ key, type, default: value }) => [key, [type, value]]),
    );
    expect(schema).toHaveLength(Object.keys(settings).length);
    expect(settings).toEqual({
      keybinding: ["string", "mod+shift+b"],
      enableAutoLink: ["boolean", true],
      enableAutoTag: ["boolean", true],
      autoLinkFirstOccuranceOnly: ["boolean", false],
      autoLinkPlurals: ["boolean", false],
      doNotAutolinkTags: ["boolean", false],
      doNotAutolinkSelf: ["boolean", false],
      runUponPressingEnter: ["boolean", true],
      tagAsLink: ["boolean", false],
      tagInTheBeginning: ["boolean", false],
      pagesToExclude: ["string", "card"],
      blocksToExclude: ["string", "\\w+::|^#\\+|^```"],
      textToExclude: ["string", "{{.*?}}|\\[[^\\[]*?\\]|`[^`]+`|\\w+:\\/\\/\\S+"],
      enableConsoleLogging: ["boolean", false],
    });
    expect(api.ready).toHaveBeenCalledWith(expect.any(Function));
    expect(api.App.onCurrentGraphChanged).toHaveBeenCalledWith(expect.any(Function));
    expect(api.Editor.registerSlashCommand).toHaveBeenCalledWith(
      "Auto-link Auto-tag",
      expect.any(Function),
    );
    expect(api.App.registerCommandShortcut).toHaveBeenCalledWith(
      { binding: "mod+alt+l" },
      shortcut,
    );
    expect(parent.document.addEventListener).toHaveBeenCalledWith(
      "keyup",
      expect.any(Function),
    );
    expect(api.DB.onChanged).toHaveBeenCalledWith(expect.any(Function));
    expect(info).toHaveBeenCalledWith("logseq-autolink-autotag: Plugin loaded");
    expect(getIsDbGraph).not.toHaveBeenCalled();

    const initializing = idle();
    await Promise.resolve();
    expect(getPagesToTagsMap).toHaveBeenCalledWith(false);
    expect(api.UI.showMsg).not.toHaveBeenCalled();
    resolveMetadata(graphData);
    await initializing;
    expect(api.UI.showMsg).toHaveBeenCalledWith("Plugin Auto-link Auto-tag ready");
  });

  it("reports a rejected Logseq ready promise", async () => {
    const failure = new Error("Logseq did not become ready");
    api.ready.mockRejectedValueOnce(failure);
    await loadMain();
    expect(error).toHaveBeenCalledWith(failure);
    expect(parent.requestIdleCallback).not.toHaveBeenCalled();
  });

  it("loads metadata on demand before idle and replaces it on graph changes", async () => {
    const { slash, shortcut, graphChanged } = await boot();
    expect(info).not.toHaveBeenCalled();
    await slash();
    expectProcessedBlock(graphData);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(1);

    getIsDbGraph.mockResolvedValue(true);
    getPagesToTagsMap.mockResolvedValue(nextGraphData);
    await graphChanged();
    expect(getPagesToTagsMap).toHaveBeenLastCalledWith(true);

    const nextBlock = { uuid: "next-block", content: "Beta" };
    api.Editor.getCurrentBlock.mockResolvedValue(nextBlock);
    await shortcut();
    expectProcessedBlock(nextGraphData, true, nextBlock);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(2);
  });
});

describe("keyup", () => {
  it("ignores key releases outside editing", async () => {
    const { keyup } = await boot();
    api.Editor.checkEditing.mockResolvedValue(false);
    await keyup(letter);
    expect(api.Editor.getCurrentBlock).not.toHaveBeenCalled();
    expect(autoLinkAutoTagCallback).not.toHaveBeenCalled();
  });

  it.each([
    ["Alt held", { altKey: true }],
    ["Control held", { ctrlKey: true }],
    ["Meta held", { metaKey: true }],
    ["Shift held", { shiftKey: true }],
    ...["Shift", "Control", "Alt", "AltGraph", "Meta"].map((key) => [
      `${key} released`,
      { key },
    ]),
  ])("ignores modified events: %s", async (_label, event) => {
    const { keyup } = await boot();
    await keyup({ ...letter, ...event });
    expect(api.Editor.getCurrentBlock).not.toHaveBeenCalled();
    expect(autoLinkAutoTagCallback).not.toHaveBeenCalled();
  });

  it.each([true, false])("processes the previous block on Enter with logging %s", async (logging) => {
    api.settings.enableConsoleLogging = logging;
    const { keyup } = await boot();
    await keyup(letter);
    api.Editor.getCurrentBlock.mockResolvedValue({ uuid: "new-block" });
    await keyup(enter);
    expectProcessedBlock(graphData);
    expect(api.Editor.getCurrentBlock).toHaveBeenCalledTimes(1);
    if (logging) {
      expect(debug).toHaveBeenCalledWith("logseq-autolink-autotag: Enter pressed");
    } else {
      expect(debug).not.toHaveBeenCalled();
    }
  });

  it("captures the current block instead of processing Enter when no previous block exists", async () => {
    const { keyup } = await boot();
    await keyup(enter);
    expect(api.Editor.getCurrentBlock).toHaveBeenCalledTimes(1);
    expect(autoLinkAutoTagCallback).not.toHaveBeenCalled();
  });

  it.each([
    ["disabled", { runUponPressingEnter: false }],
    ["unavailable", undefined],
  ])("does not process Enter when the setting is %s", async (_label, settings) => {
    const { keyup } = await boot();
    await keyup(letter);
    api.settings = settings;
    await keyup(enter);
    expect(api.Editor.getCurrentBlock).toHaveBeenCalledTimes(2);
    expect(autoLinkAutoTagCallback).not.toHaveBeenCalled();
  });
});

describe("DB graph changes", () => {
  it("batches page creation and metadata changes until the next run", async () => {
    getIsDbGraph.mockResolvedValue(true);
    const { idle, dbChanged, slash } = await boot();
    await idle();
    getPagesToTagsMap.mockResolvedValue(nextGraphData);

    await dbChanged({});
    await dbChanged({
      txMeta: { outlinerOp: "save-block" },
      txData: [[1, ":block/content"]],
    });
    await slash();
    expectProcessedBlock(graphData, true);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(1);

    await dbChanged({ txMeta: { outlinerOp: "create-page" } });
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(1);
    await slash();
    expectProcessedBlock(nextGraphData, true);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(2);

    getPagesToTagsMap.mockResolvedValue(graphData);
    await dbChanged({ txData: [[1, ":block/tags"]] });
    await dbChanged({ txData: [[1, ":block/alias"]] });
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(2);
    await slash();
    expectProcessedBlock(graphData, true);
    await slash();
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(3);
  });
});

describe("Markdown graph changes", () => {
  it("ignores skipped transactions and ordinary block saves", async () => {
    const { idle, dbChanged } = await boot();
    await idle();
    await dbChanged({ txMeta: { "skipRefresh?": true, outlinerOp: "create-page" } });
    await dbChanged({});
    await dbChanged({
      txMeta: { outlinerOp: "save-block" },
      txData: [[1, ":block/content"]],
      blocks: [{ parent: 1 }, { parent: 1, content: "ordinary text" }],
    });
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(1);
    expect(api.Editor.getPage).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
  });

  it.each([
    ["page creation", { txMeta: { outlinerOp: "create-page" } }, "Detected page creation"],
    ["property changes", { txData: [[1, ":block/Properties"]] }, "Refreshing page metadata"],
    [
      "saved metadata",
      {
        txMeta: { outlinerOp: "save-block" },
        blocks: [{ content: "Aliases:: Other Name" }],
      },
      "Refreshing page metadata",
    ],
  ])("refreshes immediately for %s and honors the logging setting", async (_label, change, message) => {
    const { idle, dbChanged, slash } = await boot();
    await idle();
    getPagesToTagsMap.mockResolvedValue(nextGraphData);
    await dbChanged(change);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(2);
    expect(debug).not.toHaveBeenCalled();
    await slash();
    expectProcessedBlock(nextGraphData);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(2);

    api.settings.enableConsoleLogging = true;
    await dbChanged(change);
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(3);
    expect(debug).toHaveBeenCalledWith(`logseq-autolink-autotag: ${message}`);
  });

  it("removes only deleted pages from cached names and tags", async () => {
    const pageUuids = { Alpha: "existing" };
    getPagesToTagsMap.mockResolvedValueOnce({
      allPagesSorted: ["Remove Me", "Remove Me Too", "Alpha"],
      pagesToTagsMap: { "Remove Me": ["Old"], "Remove Me Too": ["Old"], Alpha: ["Keep"] },
      pageUuids,
    });
    api.Editor.getPage.mockResolvedValueOnce({ uuid: "existing" });
    const { idle, dbChanged, slash } = await boot();
    await idle();
    await dbChanged({
      blocks: [
        { uuid: "child", parent: 1, originalName: "Child", type: "page" },
        { uuid: "unnamed", type: "page" },
        { uuid: "journal", name: "Journal", "journal?": true },
        { uuid: "existing", originalName: "Alpha", "journal?": false },
        { uuid: "deleted", originalName: "Remove Me", name: "remove me", "journal?": false },
        { uuid: "deleted-by-name", name: "Remove Me Too", type: "page" },
      ],
    });
    expect(api.Editor.getPage.mock.calls).toEqual([
      ["existing"],
      ["deleted"],
      ["deleted-by-name"],
    ]);
    await slash();
    expectProcessedBlock({
      allPagesSorted: ["Alpha"],
      pagesToTagsMap: { Alpha: ["Keep"] },
      pageUuids,
    });
    expect(getPagesToTagsMap).toHaveBeenCalledTimes(1);
  });
});
