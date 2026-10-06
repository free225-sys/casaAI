import { api } from "./apiClient";
import { DISCOVERY_KEY } from "../utils/discoveryRegistry";

/** Lecture publique des liens de la découverte : sans authentification, jamais mise en cache côté frontend (le serveur répond en no-store).
 * La réponse est typée `unknown` : elle est validée contre le registre avant d'être consommée. */
export const discoveryService = {
  getLinks: () => api.get<unknown>(`/api/discoveries/${DISCOVERY_KEY}/links`),
};
