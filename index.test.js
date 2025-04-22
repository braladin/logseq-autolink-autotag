import { autoLink } from "./index.js";
import { jest } from "@jest/globals";

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
  useSettingsSchema: jest.fn(), // Add mock for useSettingsSchema
  ready: (fn) => Promise.resolve(fn()), // Add mock for ready function
  App: {
    registerCommandShortcut: jest.fn(),
  },
  DB: {
    onChanged: jest.fn(),
  },
};

global.logseq = mockLogseq;

import { test, expect } from "@jest/globals";

const allPagesSorted = ["Mango juice", "Alice", "Mango", "Bob"];

// Test autoLink
test("autoLink", async () => {
  // Create a block object with content as expected by the function
  const block = {
    uuid: "test-uuid",
    content: "Alice and bob like to drink mango juice.",
  };

  // Call autoLink with the block object and sorted pages
  const result = await autoLink(block, allPagesSorted);

  // Expect the block's content to have been updated with links
  expect(result.content).toBe(
    "[[Alice]] and [[Bob]] like to drink [[Mango juice]].",
  );
});
