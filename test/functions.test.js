import { autoLink, autoTag, updatePagesToTagsMap } from "../src/functions.js";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Default logseq settings to use for each test
const DEFAULT_SETTINGS = {
  enableConsoleLogging: false,
  enableAutoLink: true,
  autoLinkFirstOccuranceOnly: false,
  pagesToExclude: [],
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
  "Mango juice",
  "Alice",
  "Mango",
  "Bob",
  "Person/Crystal Clear",
  "Crystal",
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
      input: "Alice and bob like to drink mango juice.",
      expected: "[[Alice]] and [[Bob]] like to drink [[Mango juice]].",
    },
    {
      name: "auto-linking pages with namespaces",
      input: "Person/Crystal Clear likes crystal clear jewelry.",
      expected: "[[Person/Crystal Clear]] likes [[Crystal]] clear jewelry.",
    },
    {
      name: "auto-linking pages occurring multiple times",
      input: "What's better than mango juice? Mango juice is the best!",
      expected:
        "What's better than [[Mango juice]]? [[Mango juice]] is the best!",
    },
    {
      name: "auto-linking only the first occurrence when autoLinkFirstOccuranceOnly is true",
      settings: { autoLinkFirstOccuranceOnly: true },
      input: "Bob sent an email. Later, bob replied to another email.",
      expected: "[[Bob]] sent an email. Later, bob replied to another email.",
    },
    {
      name: "not auto-linking an excluded pages",
      settings: { pagesToExclude: ["Mango"] },
      input: "I love Mango and I also like Alice.",
      expected: "I love Mango and I also like [[Alice]].",
    },
    {
      name: "not auto-linking multiple excluded pages",
      settings: { pagesToExclude: ["Mango", "Alice"] },
      input: "I love Mango and I also like Alice, but Bob is my best friend.",
      expected:
        "I love Mango and I also like Alice, but [[Bob]] is my best friend.",
    },
    {
      name: "auto-linking pages with punctuation",
      input:
        "(Alice) and Alice's friend Bob.with.dots and Mango[with brackets] and Mango juice!",
      expected:
        "([[Alice]]) and [[Alice]]'s friend [[Bob]].with.dots and Mango[with brackets] and [[Mango juice]]!",
    },
    {
      name: "with no matches",
      input: "This text has no page names to link.",
    },
    {
      name: "with all pages excluded",
      settings: { pagesToExclude: ["Alice", "Bob", "Mango", "Mango juice"] },
      input: "Alice, Bob, and Mango juice are all in the excluded list.",
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Create test block
      const block = {
        uuid: "test-uuid",
        content: input,
      };

      // Run the function
      const result = await autoLink(block, allPagesSorted);

      // Check result
      if (expected) {
        expect(result.content).toBe(expected);
        expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
          block.uuid,
          expected,
        );
      } else {
        expect(result.content).toBe(input);
        expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
      }
    });
  });
});

const pagesToTagsMap = {
  Alice: ["friend"],
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
      name: "tagging a block with single-word tags",
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. #friend #fruit",
    },
    {
      name: "tagging a block with multi-word tags",
      input: "[[Bob]] likes [[Mango juice]].",
      expected:
        "[[Bob]] likes [[Mango juice]]. #friend #colleague #drink #[[fruit juice]]",
    },
    {
      name: "tagging with [[tag]] when tagAsLink is enabled",
      settings: { tagAsLink: true },
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. [[friend]] [[fruit]]",
    },
    {
      name: "inserting tags when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: "[[Alice]] likes [[Mango]].",
      expected: "#friend #fruit [[Alice]] likes [[Mango]].",
    },
    {
      name: "tagging a todo block when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: "DOING Tell [[Alice]] to bring some [[Mango]].",
      expected: "DOING #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "tagging a todo block with prio when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: "TODO [#B] Tell [[Alice]] to bring some [[Mango]].",
      expected:
        "TODO [#B] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "tagging a block with prio when tagInTheBeginning is enabled",
      settings: { tagInTheBeginning: true },
      input: "[#A] Tell [[Alice]] to bring some [[Mango]].",
      expected: "[#A] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "not tagging a block with no links",
      input: "Alice likes mango juice.",
    },
    {
      name: "not tagging a block with links to non-existing page",
      input: "[[John]] likes [[Mango]].",
      expected: "[[John]] likes [[Mango]]. #fruit",
    },
  ];

  // Run parameterized tests
  testCases.forEach(({ name, settings, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Create test block
      const block = {
        uuid: "test-uuid",
        content: input,
      };

      // Run the function
      await autoTag(block, pagesToTagsMap);

      if (expected) {
        expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
          block.uuid,
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
    mockLogseq.settings = { ...DEFAULT_SETTINGS };
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "updating a page containing a single tag",
      settings: {},
      input: {
        block: { content: "tags:: person" },
        page: { originalName: "Alice" },
        pagesToTagsMap: pagesToTagsMap,
      },
      expected: ["person"],
    },
    {
      name: "updating a page containing multiple tags",
      settings: {},
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
      settings: {},
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
      settings: {},
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
      settings: {},
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
      // Apply test settings if provided
      if (settings) {
        mockLogseq.settings = { ...DEFAULT_SETTINGS, ...settings };
      }

      // Create a fresh copy of pagesToTagsMap for this test
      const testMap = JSON.parse(JSON.stringify(pagesToTagsMap));

      // Run the function
      updatePagesToTagsMap(input.block, input.page, testMap);

      // Verify the result
      expect(testMap[input.page.originalName]).toEqual(expected);
    });
  });
});
