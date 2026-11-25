import "@testing-library/react-native/matchers";

// In-memory SecureStore (the real one needs the native keychain).
const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  deleteItemAsync: jest.fn(async (k: string) => { mockStore.delete(k); }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

beforeEach(() => mockStore.clear());
(globalThis as { __secureStore?: Map<string, string> }).__secureStore = mockStore;

afterEach(() => { const g = globalThis as { __queryClients?: { clear(): void }[] }; g.__queryClients?.splice(0).forEach((c) => c.clear()); });

// Native-only modules: lightweight stand-ins so screens render under Jest (tests that exercise them override these).
jest.mock("react-native-webview", () => ({ WebView: () => null }));
jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn(async () => ({})) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })) }));
