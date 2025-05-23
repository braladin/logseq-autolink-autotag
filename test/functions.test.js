import * as functions from "../src/functions.js";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Default logseq settings to use for each test
const DEFAULT_SETTINGS = {
  enableConsoleLogging: true,
  enableAutoLink: true,
  enableAutoTag: true,
  autoLinkFirstOccuranceOnly: false,
  pagesToExclude: "card",
  blocksToExclude: "\\w+::|^#\\+|^```",
  textToExclude: "{{.*?}}|\\[.*?\\]|`[^`]+`",
  tagAsLink: false,
  tagInTheBeginning: false,
};

// Mock logseq object for testing
const mockLogseq = {
  settings: { ...DEFAULT_SETTINGS },
  Editor: {
    updateBlock: jest.fn(),
    getCurrentBlock: jest.fn(),
    getBlock: jest.fn(),
  },
  useSettingsSchema: jest.fn(),
  ready: (fn) => Promise.resolve(fn()),
  App: {
    registerCommandShortcut: jest.fn(),
  },
  DB: {
    onChanged: jest.fn(),
  },
};

global.logseq = mockLogseq;

const allPagesSorted = [
  "Person/Crystal Clear",
  "Mango juice",
  "Crystal",
  "Alice",
  "Mango",
  "Bob",
  "Box",
];

describe("autoLink function", () => {
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogseq.settings = { ...DEFAULT_SETTINGS };
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "auto-linking pages",
      input: {
        uuid: "test-uuid",
        content: "Alice and bob like to drink mango juice and to eat mangos.",
      },
      expected:
        "[[Alice]] and [[Bob]] like to drink [[Mango juice]] and to eat mangos.",
    },
    {
      name: "auto-linking plurals",
      settings: { autoLinkPlurals: true },
      input: {
        uuid: "test-uuid",
        content: "Alice and bob eat boxes of mangos, so they are mangoslovers",
      },
      expected:
        "[[Alice]] and [[Bob]] eat [[Box]]es of [[Mango]]s, so they are mangoslovers",
    },
    {
      name: "auto-linking pages with namespaces",
      settings: { enableConsoleLogging: false },
      input: {
        uuid: "test-uuid",
        content: "Person/Crystal Clear likes crystal clear jewelry.",
      },
      expected: "[[Person/Crystal Clear]] likes [[Crystal]] clear jewelry.",
    },
    {
      name: "auto-linking pages occurring multiple times",
      input: {
        uuid: "test-uuid",
        content: "What's better than mango juice? Mango juice is the best!",
      },
      expected:
        "What's better than [[Mango juice]]? [[Mango juice]] is the best!",
    },
    {
      name: "auto-linking only the first occurrence when autoLinkFirstOccuranceOnly is true",
      settings: { autoLinkFirstOccuranceOnly: true },
      input: {
        uuid: "test-uuid",
        content: "Bob sent an email. Later, bob replied to another email.",
      },
      expected: "[[Bob]] sent an email. Later, bob replied to another email.",
    },
    {
      name: "auto-linking pages with punctuation",
      input: {
        uuid: "test-uuid",
        content:
          "(Alice) and Alice's friend Bob.with.dots and Mango(with brackets) and Mango juice!",
      },
      expected:
        "([[Alice]]) and [[Alice]]'s friend [[Bob]].with.dots and [[Mango]](with brackets) and [[Mango juice]]!",
    },
    {
      name: "not auto-linking an excluded pages",
      settings: { pagesToExclude: ["Mango"] },
      input: {
        uuid: "test-uuid",
        content: "I love Mango and I also like Alice.",
      },
      expected: "I love Mango and I also like [[Alice]].",
    },
    {
      name: "not auto-linking multiple excluded pages",
      settings: { pagesToExclude: ["Mango", "Alice"] },
      input: {
        uuid: "test-uuid",
        content:
          "I love Mango and I also like Alice, but Bob is my best friend.",
      },
      expected:
        "I love Mango and I also like Alice, but [[Bob]] is my best friend.",
    },
    {
      name: "not auto-linking a block with no pages",
      input: {
        uuid: "test-uuid",
        content: "This text has no page names to link.",
      },
    },
    {
      name: "not auto-linking a page inside double square brackets",
      input: {
        uuid: "test-uuid",
        content: "[[ This Bob ]] and [[ this Bob ]] should not be linked",
      },
    },
    {
      name: "not auto-linking a page inside inline code",
      input: {
        uuid: "test-uuid",
        content: "This Bob should be linked, `The Bob not`, this Bob should.",
      },
      expected:
        "This [[Bob]] should be linked, `The Bob not`, this [[Bob]] should.",
    },
    {
      name: "not auto-linking a page inside template definition",
      input: {
        uuid: "test-uuid",
        content: "{{This bob should not be linked}}",
      },
    },
    {
      name: "not auto-linking a block with all pages excluded",
      settings: { pagesToExclude: ["Alice", "Bob", "Mango", "Mango juice"] },
      input: {
        uuid: "test-uuid",
        content: "Alice, Bob, and Mango juice are all in the excluded list.",
      },
    },
    {
      name: "not linking a block with no content",
      input: {
        uuid: "test-uuid",
      },
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Run the function
      const result = await functions.autoLink(input, allPagesSorted);

      // Check result
      if (expected) {
        expect(result.content).toBe(expected);
        expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
          input.uuid,
          expected,
        );
      } else {
        expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
      }
    });
  });
});

const pagesToTagsMap = {
  Alice: ["friend"],
  John: undefined,
  Bob: ["friend", "colleague"],
  Mango: ["fruit"],
  "Mango juice": ["drink", "fruit juice"],
};

describe("autoTag function", () => {
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogseq.settings = { ...DEFAULT_SETTINGS };
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "auto-tagging a block with single-word tags",
      input: {
        uuid: "test-uuid",
        content: "[[Alice]] likes [[Mango]].",
      },
      expected: "[[Alice]] likes [[Mango]]. #friend #fruit",
    },
    {
      name: "auto-tagging a block with multi-word tags",
      settings: { enableConsoleLogging: false },
      input: {
        uuid: "test-uuid",
        content: "[[Bob]] likes [[Mango juice]].",
      },
      expected:
        "[[Bob]] likes [[Mango juice]]. #friend #colleague #drink #[[fruit juice]]",
    },
    {
      name: "auto-tagging with [[tag]] when tagAsLink is enabled",
      settings: { tagAsLink: true },
      input: {
        uuid: "test-uuid",
        content: "[[Alice]] likes [[Mango]].",
      },
      expected: "[[Alice]] likes [[Mango]]. [[friend]] [[fruit]]",
    },
    {
      name: "inserting tags when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: {
        uuid: "test-uuid",
        content: "[[Alice]] likes [[Mango]].",
      },
      expected: "#friend #fruit [[Alice]] likes [[Mango]].",
    },
    {
      name: "auto-tagging a todo block when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: {
        uuid: "test-uuid",
        content: "DOING Tell [[Alice]] to bring some [[Mango]].",
      },
      expected: "DOING #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "auto-tagging a todo block with prio when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: {
        uuid: "test-uuid",
        content: "TODO [#B] Tell [[Alice]] to bring some [[Mango]].",
      },
      expected:
        "TODO [#B] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "auto-tagging a block with prio when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: {
        uuid: "test-uuid",
        content: "[#A] Tell [[Alice]] to bring some [[Mango]].",
      },
      expected: "[#A] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "not auto-tagging a block with no links",
      input: {
        uuid: "test-uuid",
        content: "Alice likes mango juice.",
      },
    },
    {
      name: "not auto-tagging a block with links to non-existing page",
      input: {
        uuid: "test-uuid",
        content: "[[John]] likes [[Mango]].",
      },
      expected: "[[John]] likes [[Mango]]. #fruit",
    },
    {
      name: "not auto-tagging a broken block",
      input: {
        uuid: "test-uuid",
      },
    },
    {
      name: "not auto-tagging a block with a link to a page with no tags",
      input: {
        uuid: "test-uuid",
        content: "[[John]] is tall.",
      },
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Run the function
      await functions.autoTag(input, pagesToTagsMap);

      if (expected) {
        expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
          input.uuid,
          expected,
        );
      } else {
        expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
      }
    });
  });
});

describe("updatePagesToTagsMap function", () => {
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "updating a page containing a single tag",
      input: {
        block: { content: "tags:: person" },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: ["person"],
    },
    {
      name: "updating a page containing multiple tags",
      input: {
        block: {
          content: "tags:: #person, [[friend]], [[co worker]], #[[big family]]",
        },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: ["person", "friend", "co worker", "big family"],
    },
    {
      name: "updating a page containing tags then aliases",
      input: {
        block: {
          content: "tags:: #person\naliases:: Al",
        },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: ["person"],
    },
    {
      name: "updating a page containing aliases then tags",
      input: {
        block: {
          content: "aliases:: Al\ntags:: #person",
        },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: ["person"],
    },
    {
      name: "not updating a page containing aliases and no tags",
      input: {
        block: {
          content: "aliases:: Al",
        },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: [],
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Create a fresh copy of pagesToTagsMap for this test
      const testMap = JSON.parse(JSON.stringify(pagesToTagsMap));

      // Run the function
      functions.updatePagesToTagsMap(input.block, input.page, testMap);

      // Verify the result
      expect(testMap[input.page.originalName]).toEqual(expected);
    });
  });
});

describe("updateAllPagesSorted function", () => {
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "adding a new page",
      input: {
        page: { originalName: "John" },
        allPagesSorted: ["Alice", "Bob"],
      },
      expected: ["Alice", "John", "Bob"],
    },
    {
      name: "adding a first page in a graph",
      input: {
        page: { originalName: "John" },
        allPagesSorted: [],
      },
      expected: ["John"],
    },
    {
      name: "adding a page with the longest name in the beginning",
      input: {
        page: { originalName: "John" },
        allPagesSorted: ["Bob", "Lu"],
      },
      expected: ["John", "Bob", "Lu"],
    },
    {
      name: "adding a page with the shortest name in the end",
      input: {
        page: { originalName: "Lu" },
        allPagesSorted: ["John", "Bob"],
      },
      expected: ["John", "Bob", "Lu"],
    },
    {
      name: "not adding a page with no name",
      input: {
        page: { originalName: "" },
        allPagesSorted: ["John", "Bob"],
      },
      expected: ["John", "Bob"],
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Create a fresh copy of allPagesSorted for this test
      const testAllPagesSorted = [...input.allPagesSorted];

      // Run the function
      functions.updateAllPagesSorted(input.page, testAllPagesSorted);

      // Verify the result
      expect(testAllPagesSorted).toEqual(expected);
    });
  });
});

describe("getPagesToTagsMap function", () => {
  // Reset mocks
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Setup mock data
  const getAllPagesMockData = [
    {
      originalName: "John",
      properties: {
        tags: ["tag1", "tag2"],
      },
    },
    {
      originalName: "Alice",
      properties: {
        tags: ["tag3", "tag4"],
        alias: ["Al"],
      },
    },
    {
      originalName: "Thursday, 24.04.2025",
      "journal?": true,
    },
    {
      originalName: "Bob",
      properties: {
        tags: ["tag5"],
      },
    },
  ];

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "adding a new page",
      mock: {
        getAllPages: getAllPagesMockData,
      },
      expected: {
        allPagesSorted: ["Alice", "John", "Bob", "Al"],
        pagesToTagsMap: {
          Alice: ["tag3", "tag4"],
          John: ["tag1", "tag2"],
          Bob: ["tag5"],
          Al: ["tag3", "tag4"],
        },
      },
    },
  ];

  // Run tests cases
  testCases.forEach(({ name, mock, expected }) => {
    it(`should handle ${name}`, async () => {
      // Mock logseq.Editor.getAllPages()
      mockLogseq.Editor.getAllPages = jest
        .fn()
        .mockResolvedValue(mock.getAllPages);

      // Run the function
      const result = await functions.getPagesToTagsMap();

      // Verify the result
      expect(result).toMatchObject(expected);
    });
  });
});

describe("autoLinkAutoTagCallback function", () => {
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogseq.settings = { ...DEFAULT_SETTINGS };
  });

  // Setup test cases
  const testCases = [
    {
      name: "not auto-linking a block when enableAutoLink is false",
      input: {
        block: {
          uuid: "test-uuid",
          content: "[[Alice]] likes Mango.",
        },
      },
      settings: {
        enableAutoLink: false,
      },
      expected: true,
    },
    {
      name: "not auto-tagging a block when enableAutoTag is false",
      input: {
        block: {
          uuid: "test-uuid",
          content: "Alice likes Mango.",
        },
      },
      settings: {
        enableAutoTag: false,
      },
      expected: true,
    },
    {
      name: "not processing a block when enableAutoLink and enableAutoTag are false",
      input: {
        block: {
          uuid: "test-uuid",
          content: "Alice likes Mango.",
        },
      },
      settings: {
        enableAutoTag: false,
        enableAutoLink: false,
      },
    },
    {
      name: "processing a block with pages",
      settings: {
        enableConsoleLogging: false,
      },
      input: {
        block: {
          uuid: "test-uuid",
          content: "Alice likes Mango.",
        },
      },
      expected: true,
    },
    {
      name: "not processing a block excluded by blocksToExclude setting",
      input: {
        block: {
          uuid: "test-uuid",
          content: "tags:: person",
        },
      },
    },
    {
      name: "not processing a quote block",
      input: {
        uuid: "test-uuid",
        content: "#+BEGIN_QUOTE\nThis bob should not be linked\n#+END_QUOTE",
      },
    },
    {
      name: "not processing a code block",
      input: {
        uuid: "test-uuid",
        content: "```\nThis bob should not be linked\n```",
      },
    },
  ];

  // Run tests cases
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Mock logseq.editor.getBlock
      mockLogseq.Editor.getBlock = jest.fn().mockResolvedValue(input.block);

      // Run the function
      await functions.autoLinkAutoTagCallback(
        input.block,
        allPagesSorted,
        pagesToTagsMap,
      );

      // Verify the result
      if (!expected) {
        expect(logseq.Editor.updateBlock).not.toHaveBeenCalled();
        return;
      }
      if (
        mockLogseq.settings.enableAutoLink &&
        mockLogseq.settings.enableAutoTag
      ) {
        expect(logseq.Editor.updateBlock).toHaveBeenCalledTimes(2);
      } else if (
        mockLogseq.settings.enableAutoLink ||
        mockLogseq.settings.enableAutoTag
      ) {
        expect(logseq.Editor.updateBlock).toHaveBeenCalledTimes(1);
      } else {
        expect(logseq.Editor.updateBlock).not.toHaveBeenCalled();
      }
    });
  });
});
