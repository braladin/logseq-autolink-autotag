function main() {
  logseq.UI.showMsg("Hello from logseq-plugin!");
  console.info("logseq-plugin loaded successfully");
}

logseq.ready(main).catch(console.error);
