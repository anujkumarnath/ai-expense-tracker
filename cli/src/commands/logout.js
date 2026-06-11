import { logout } from "./login.js";

export const meta = {
  name: "logout",
  aliases: ["signout"],
  summary: "Forget the saved session/token.",
  usage: "exp logout",
};

export const run = () => logout();
