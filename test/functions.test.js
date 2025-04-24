import { autoLink, autoTag, updatePagesToTagsMap } from "../src/functions.js";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock logseq object for testing
const mockLogseq = {
  settings: {
    enableConsoleLogging: false,
    enableAutoLink: true,
    autoLinkFirstOccuranceOnly: false,
    pagesToExclude: [],
  },
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

const allPagesSorted = ["Mango juice", "Alice", "Mango", "Bob"];

describe("autoLink function", () => {
  // Reset mocks and settings before each test. TODO: remove this at next refactoring
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "basic functionality",
      firstOccuranceOnly: false, //TODO: group into a settings object. Keep only settings with non-default values
      input: "Alice and bob like to drink mango juice.",
      expected: "[[Alice]] and [[Bob]] like to drink [[Mango juice]].",
    },
    {
      name: "with firstOccuranceOnly set to false",
      firstOccuranceOnly: false,
      input: "What's better than mango juice? Mango juice is the best!",
      expected:
        "What's better than [[Mango juice]]? [[Mango juice]] is the best!",
    },
    {
      name: "with firstOccuranceOnly set to true",
      firstOccuranceOnly: true,
      input: "Bob sent an email. Later, bob replied to another email.",
      expected: "[[Bob]] sent an email. Later, bob replied to another email.",
    },
    {
      name: "with excluded page",
      firstOccuranceOnly: false,
      excludePages: ["Mango"],
      input: "I love Mango and I also like Alice.",
      expected: "I love Mango and I also like [[Alice]].",
    },
    {
      name: "with multiple excluded pages",
      firstOccuranceOnly: false,
      excludePages: ["Mango", "Alice"],
      input: "I love Mango and I also like Alice, but Bob is my best friend.",
      expected:
        "I love Mango and I also like Alice, but [[Bob]] is my best friend.",
    },
    {
      name: "with special characters in text",
      firstOccuranceOnly: false,
      input:
        "Alice (with parentheses) and Bob.with.dots and Mango[with brackets]",
      expected:
        "[[Alice]] (with parentheses) and [[Bob]].with.dots and Mango[with brackets]",
    },
    {
      name: "with no matches",
      firstOccuranceOnly: false,
      input: "This text has no page names to link.",
      expected: "This text has no page names to link.",
      expectNoUpdate: true,
    },
    {
      name: "with all pages excluded",
      firstOccuranceOnly: false,
      excludePages: ["Alice", "Bob", "Mango", "Mango juice"],
      input: "Alice, Bob, and Mango juice are all in the excluded list.",
      expected: "Alice, Bob, and Mango juice are all in the excluded list.",
      expectNoUpdate: true,
    },
  ];

  // Run parameterized tests
  testCases.forEach(
    ({
      name,
      firstOccuranceOnly,
      excludePages,
      input,
      expected,
      expectNoUpdate,
    }) => {
      it(`should handle ${name}`, async () => {
        // Set up the test-specific settings
        mockLogseq.settings.autoLinkFirstOccuranceOnly = firstOccuranceOnly;

        // Set excluded pages if provided
        if (excludePages) {
          mockLogseq.settings.pagesToExclude = excludePages;
        } else {
          mockLogseq.settings.pagesToExclude = [];
        }

        // Create test block
        const block = {
          uuid: "test-uuid",
          content: input,
        };

        // Run the function
        const result = await autoLink(block, allPagesSorted);

        // Check result
        if (result) {
          expect(result.content).toBe(expected);
        }

        if (expectNoUpdate) {
          expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
        } else {
          expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
            block.uuid,
            expected,
          );
        }
      });
    },
  );
});

const pagesToTagsMap = {
  Alice: ["friend"],
  Bob: ["friend", "colleague"],
  Mango: ["fruit"],
  "Mango juice": ["drink", "fruit juice"],
};

describe("autoTag function", () => {
  // Reset mocks and settings before each test. TODO: remove this at next refactoring
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "tagging a block with single-word tags",
      tagAsLink: false, //TODO: group into a settings object. Keep only settings with non-default values
      tagInTheBeginning: false,
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. #friend #fruit",
    },
    {
      name: "tagging a block with multi-word tags",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "[[Bob]] likes [[Mango juice]].",
      expected:
        "[[Bob]] likes [[Mango juice]]. #friend #colleague #drink #[[fruit juice]]",
    },
    {
      name: "tagging with [[tag]] when tagAsLink is enabled",
      tagAsLink: true,
      tagInTheBeginning: false,
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. [[friend]] [[fruit]]",
    },
    {
      name: "inserting tags when tagInTheBeginning is enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "[[Alice]] likes [[Mango]].",
      expected: "#friend #fruit [[Alice]] likes [[Mango]].",
    },
    {
      name: "tagging a todo block when tagInTheBeginning is enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "DOING Tell [[Alice]] to bring some [[Mango]].",
      expected: "DOING #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "tagging a todo block with prio when tagInTheBeginning is enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "TODO [#B] Tell [[Alice]] to bring some [[Mango]].",
      expected:
        "TODO [#B] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "tagging a block with prio when tagInTheBeginning is enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "[#A] Tell [[Alice]] to bring some [[Mango]].",
      expected: "[#A] #friend #fruit Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "not tagging a block with no links",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "Alice likes mango juice.",
      expectNoUpdate: true,
    },
    {
      name: "not tagging a block with links to non-existing page",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "[[John]] likes [[Mango]].",
      expected: "[[John]] likes [[Mango]]. #fruit",
    },
  ];

  // Run parameterized tests
  testCases.forEach(
    ({
      name,
      tagAsLink,
      tagInTheBeginning,
      input,
      expected,
      expectNoUpdate,
    }) => {
      it(`should handle ${name}`, async () => {
        // Set up the test-specific settings
        mockLogseq.settings.tagAsLink = tagAsLink;
        mockLogseq.settings.tagInTheBeginning = tagInTheBeginning;

        // Create test block
        const block = {
          uuid: "test-uuid",
          content: input,
        };

        // Run the function
        await autoTag(block, pagesToTagsMap);

        if (expectNoUpdate) {
          expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
        } else {
          expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
            block.uuid,
            expected,
          );
        }
      });
    },
  );
});

describe("updatePagesToTagsMap function", () => {
  // Reset mocks and settings before each test. TODO: remove this at next refactoring
  beforeEach(() => {
    jest.clearAllMocks();
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
      // Create a fresh copy of pagesToTagsMap for this test
      const testMap = JSON.parse(JSON.stringify(pagesToTagsMap));

      // Run the function
      updatePagesToTagsMap(input.block, input.page, testMap);

      // Verify the result
      expect(testMap[input.page.originalName]).toEqual(expected);
    });
  });
});
