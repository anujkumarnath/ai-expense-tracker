// Background service worker: the right-click → "log selection as expense"
// flow. Sends the selected text to the AI parser and shows the result as a
// notification, so you never leave the page you're on.

import { api } from "./shared.js";

const MENU_ID = "expense-log-selection";

chrome.runtime.onInstalled.addListener(() => {
  // onInstalled also fires on updates/reloads — recreate instead of duplicating.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Log "%s" as expense',
      contexts: ["selection"],
    });
  });
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title,
    message,
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || "").trim();
  if (!text) return;
  try {
    const reply = await api.parse(text);
    notify("Expense logged", reply.replace(/\s+/g, " ").trim().slice(0, 300));
  } catch (e) {
    notify("Couldn't log expense", e.message);
  }
});
