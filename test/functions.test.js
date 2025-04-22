import { autoLink } from "../src/functions.js";
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
