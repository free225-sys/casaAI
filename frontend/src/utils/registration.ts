/** Création du compte confirmée par le serveur, mais connexion automatique en échec : la création ne doit jamais être rejouée. */
export class AccountCreatedError extends Error {
  constructor() { super("Compte créé : connectez-vous."); this.name = "AccountCreatedError"; }
}

/** Réponse de création perdue ou incertaine (réseau, 5xx) : on ne prétend pas que le compte existe et on ne répète pas la création seul. */
export class RegistrationUnconfirmedError extends Error {
  constructor() { super("Création non confirmée : essayez de vous connecter."); this.name = "RegistrationUnconfirmedError"; }
}
