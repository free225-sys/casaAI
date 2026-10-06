import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "../components/AppLink";
import { useAuth } from "../stores/authStore";
import { ApiError } from "../services/apiClient";
import { RevealSection } from "../components/RevealSection";
import { AccountCreatedError, RegistrationUnconfirmedError } from "../utils/registration";
import { readReturnCourseId, resolveReturnDestination } from "../utils/returnCourse";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Seul l'identifiant du cours choisi est porté ; la destination est reconstruite et revalidée après l'inscription.
  const returnCourseId = readReturnCourseId(location.state);
  const loginState = returnCourseId ? { return_course_id: returnCourseId } : undefined;
  const [accountCreated, setAccountCreated] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      const me = await register({ first_name: firstName, last_name: lastName, email, password });
      if (returnCourseId) {
        const outcome = await resolveReturnDestination(me.role, returnCourseId);
        navigate(outcome.path, { replace: true, state: outcome.notice ? { returnNotice: outcome.notice } : undefined });
      } else {
        navigate("/app/dashboard", { replace: true });
      }
    } catch (err) {
      if (err instanceof AccountCreatedError) {
        // Création confirmée : ne jamais la rejouer. Le mot de passe saisi n'est pas conservé pour une nouvelle tentative automatique.
        setAccountCreated(true);
        setPassword("");
        setError(null);
      } else if (err instanceof RegistrationUnconfirmedError) {
        setUnconfirmed(true);
        setError(err.message);
      } else if (err instanceof ApiError && err.status === 409) {
        setError("Cet email est déjà utilisé.");
      } else {
        setError(err instanceof ApiError ? err.detail : "Une erreur est survenue.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <RevealSection as="div">
        <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Créer un compte</h1>
        <p style={{ marginBottom: 32 }}>
          Découvrez, apprenez, expérimentez, certifiez — à votre rythme.
        </p>

        {accountCreated ? (
          <div className="card" role="status" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <p><strong>Compte créé : connectez-vous.</strong></p>
            <p>Votre compte existe, mais la connexion automatique n’a pas abouti. Aucun second compte ne sera créé.{returnCourseId ? " Votre cours choisi sera vérifié après la connexion." : ""}</p>
            <Link to="/login" state={loginState} className="btn btn-primary">Se connecter</Link>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="firstName">Prénom</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="lastName">Nom</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>8 caractères minimum</span>
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}
          {unconfirmed && <Link to="/login" state={loginState}>Aller à la connexion</Link>}

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        )}

        <p style={{ marginTop: 20, fontSize: "0.9rem" }}>
          Déjà inscrit ?{" "}
          <Link to="/login" state={loginState} style={{ color: "var(--color-accent-blue)", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Se connecter
          </Link>
        </p>
      </RevealSection>
    </div>
  );
}
