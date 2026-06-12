// Command registry: maps every name and alias to its module.

import * as list from "./list.js";
import * as parse from "./parse.js";
import * as neu from "./new.js";
import * as edit from "./edit.js";
import * as rm from "./rm.js";
import * as chart from "./chart.js";
import * as report from "./report.js";
import * as login from "./login.js";
import * as logout from "./logout.js";
import * as whoami from "./whoami.js";
import * as config from "./config.js";
import * as home from "./home.js";
import * as help from "./help.js";
import * as tui from "./tui.js";

const modules = [list, parse, neu, edit, rm, chart, report, login, logout, whoami, config, home, help, tui];

export const registry = {};
for (const mod of modules) {
  registry[mod.meta.name] = mod;
  for (const alias of mod.meta.aliases || []) registry[alias] = mod;
}
