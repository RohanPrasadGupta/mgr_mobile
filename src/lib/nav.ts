import { router } from "expo-router";

/** Close a modal/form. On a cold start or web reload there is no history to go back to, so land on Home instead of doing nothing. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
