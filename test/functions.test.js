import { autoLink, autoTag } from "../src/functions.js";
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
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "basic functionality",
      firstOccuranceOnly: false,
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
  // Reset mocks and settings before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test cases as an array of objects for parameterized testing
  const testCases = [
    {
      name: "a block with links to pages with a single tag",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. #friend #fruit",
    },
    {
      name: "a block with links to pages with multiple tags",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "[[Bob]] likes [[Mango juice]].",
      expected:
        "[[Bob]] likes [[Mango juice]]. #friend #colleague #drink #[[fruit juice]]",
    },
    {
      name: "tagAsLink enabled",
      tagAsLink: true,
      tagInTheBeginning: false,
      input: "[[Alice]] likes [[Mango]].",
      expected: "[[Alice]] likes [[Mango]]. [[friend]] [[fruit]]",
    },
    {
      name: "tagInTheBeginning enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "[[Alice]] likes [[Mango]].",
      expected: "#fruit #friend [[Alice]] likes [[Mango]].",
    },
    {
      name: "task block & tagInTheBeginning enabled",
      tagAsLink: false,
      tagInTheBeginning: true,
      input: "TODO [#B] Tell [[Alice]] to bring some [[Mango]].",
      expected:
        "TODO [#B] #fruit #friend Tell [[Alice]] to bring some [[Mango]].",
    },
    {
      name: "a block with no links",
      tagAsLink: false,
      tagInTheBeginning: false,
      input: "Alice likes mango juice.",
      expectNoUpdate: true,
    },
    {
      name: "a block with a link to a non existing page",
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
