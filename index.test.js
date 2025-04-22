import { autoLink } from "./index";
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

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
  ];

  // Run parameterized tests
  testCases.forEach(({ name, firstOccuranceOnly, input, expected }) => {
    it(`should handle ${name}`, async () => {
      // Set up the test-specific settings
      mockLogseq.settings.autoLinkFirstOccuranceOnly = firstOccuranceOnly;

      // Create test block
      const block = {
        uuid: "test-uuid",
        content: input,
      };

      // Run the function
      const result = await autoLink(block, allPagesSorted);

      // Check result
      expect(result.content).toBe(expected);
      expect(mockLogseq.Editor.updateBlock).toHaveBeenCalledWith(
        block.uuid,
        expected,
      );
    });
  });

  // Special case for empty block
  it("should handle block without content", async () => {
    const block = { uuid: "test-uuid" };
    const result = await autoLink(block, allPagesSorted);
    expect(result).toBeUndefined();
    expect(mockLogseq.Editor.updateBlock).not.toHaveBeenCalled();
  });
});
