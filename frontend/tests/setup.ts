import { vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("../src/hooks/useScrollReveal", () => ({
  useScrollReveal: () => ({ ref: { current: null }, visible: true }),
}));
