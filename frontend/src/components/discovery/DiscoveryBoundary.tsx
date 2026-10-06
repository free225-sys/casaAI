import { Component, type ReactNode } from "react";

/** Capte l'échec de chargement du module de simulation comme son échec d'exécution et affiche le repli texte, qui vit dans le bundle principal.
 * Ce n'est pas une garantie « sans JavaScript » : l'application reste une SPA. */
export class DiscoveryBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* aucune télémétrie par défaut */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
