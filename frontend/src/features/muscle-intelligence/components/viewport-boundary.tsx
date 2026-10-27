"use client";

import { Component, type ReactNode } from "react";

/** Contains a 3D crash to the viewport, so the rest of the page (and app) keeps working. */
export class ViewportBoundary extends Component<{ fallback: (retry: () => void) => ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

/** True when the browser can create a WebGL context. */
export function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
