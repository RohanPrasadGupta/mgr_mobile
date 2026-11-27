import * as WebBrowser from "expo-web-browser";

/** The web app hosts the legal pages (stores require a public privacy policy URL and an in-app link to it). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const PRIVACY_URL = `${WEB_URL}/privacy`;
export const DELETE_INFO_URL = `${WEB_URL}/delete-account`;

export const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL);
