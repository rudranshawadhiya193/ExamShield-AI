import { useState } from "react";
import type { FormEvent } from "react";
import api from "./api";

import type { AuthUser } from "./auth";
import {
  clearSession,
  saveSession,
} from "./auth";

import "./login.css";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

type LoginRole =
  | "ADMIN"
  | "CANDIDATE";

const DEMO_ACCOUNTS: Record<
  LoginRole,
  {
    username: string;
    password: string;
  }
> = {
  ADMIN: {
    username: "admin",
    password: "Admin@123",
  },
  CANDIDATE: {
    username: "candidate",
    password: "Candidate@123",
  },
};

export default function LoginPage({
  onLogin,
}: LoginPageProps) {
  const [selectedRole, setSelectedRole] =
    useState<LoginRole>("ADMIN");

  const [username, setUsername] =
    useState(
      DEMO_ACCOUNTS.ADMIN.username
    );

  const [password, setPassword] =
    useState(
      DEMO_ACCOUNTS.ADMIN.password
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  function selectRole(
    role: LoginRole
  ): void {
    setSelectedRole(role);
    setUsername(
      DEMO_ACCOUNTS[role].username
    );
    setPassword(
      DEMO_ACCOUNTS[role].password
    );
    setError("");
  }

  async function handleSubmit(
    event: FormEvent
  ): Promise<void> {
    event.preventDefault();
    setError("");

    if (!username.trim()) {
      setError(
        "Please enter the username."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter the password."
      );
      return;
    }

    try {
      setLoading(true);

      /*
       * Remove any previous role/session before
       * authenticating. This prevents a stale admin
       * session from opening when candidate is chosen.
       */
      clearSession();

      await api.post(
        "/auth/seed-demo-users"
      );

      const loginResponse =
        await api.post(
          "/auth/login",
          {
            username:
              username.trim(),
            password,
          }
        );

      const accessToken =
        loginResponse.data?.access_token;

      if (!accessToken) {
        throw new Error(
          "Authentication token was not returned by the backend."
        );
      }

      const meResponse =
        await api.get(
          "/auth/me",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const user =
        meResponse.data as AuthUser;

      if (
        user.role !== "ADMIN" &&
        user.role !== "CANDIDATE"
      ) {
        throw new Error(
          "The backend returned an unsupported account role."
        );
      }

      if (user.role !== selectedRole) {
        throw new Error(
          `This username belongs to the ${user.role} account. Select that role and sign in again.`
        );
      }

      saveSession(
        accessToken,
        user
      );

      onLogin(user);
    } catch (requestError) {
      const errorObject =
        requestError as {
          response?: {
            data?: {
              detail?: string;
            };
          };
          message?: string;
        };

      /*
       * Demo fallback:
       * Render can sleep or be temporarily unreachable.
       * The two documented demo accounts can still open
       * the correct role-controlled UI so the hackathon
       * prototype remains usable.
       *
       * Real accounts never use this fallback.
       */
      const networkUnavailable =
        !errorObject.response;

      const expectedAccount =
        username.trim() ===
          DEMO_ACCOUNTS[selectedRole].username &&
        password ===
          DEMO_ACCOUNTS[selectedRole].password;

      if (
        networkUnavailable &&
        expectedAccount
      ) {
        const demoUser: AuthUser =
          selectedRole === "ADMIN"
            ? {
                id: 1,
                username: "admin",
                full_name:
                  "ExamShield Administrator",
                role: "ADMIN",
                is_active: true,
              }
            : {
                id: 2,
                username: "candidate",
                full_name:
                  "Demo Candidate",
                role: "CANDIDATE",
                is_active: true,
              };

        saveSession(
          `demo-local-${selectedRole.toLowerCase()}`,
          demoUser
        );

        onLogin(demoUser);
        return;
      }

      setError(
        errorObject.response?.data?.detail ||
        errorObject.message ||
        "Login failed. Please verify the account and backend connection."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-background-glow glow-one" />
      <div className="login-background-glow glow-two" />

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            ES
          </div>

          <div>
            <div className="login-brand-title">
              ExamShield AI
            </div>

            <div className="login-brand-subtitle">
              Resilient & Trustworthy Online Assessment
            </div>
          </div>
        </div>

        <div className="login-heading">
          Secure Examination Portal
        </div>

        <div className="login-description">
          Choose the account type below. Both
          administrator and candidate access use
          this same login screen.
        </div>

        <div className="role-selector">
          <button
            type="button"
            className={
              "role-card " +
              (
                selectedRole === "ADMIN"
                  ? "selected"
                  : ""
              )
            }
            onClick={() =>
              selectRole("ADMIN")
            }
            disabled={loading}
          >
            <span className="role-card-title">
              Administrator
            </span>

            <span className="role-card-copy">
              Operations, AI monitoring,
              incidents, audit and trust
              reporting.
            </span>
          </button>

          <button
            type="button"
            className={
              "role-card " +
              (
                selectedRole === "CANDIDATE"
                  ? "selected"
                  : ""
              )
            }
            onClick={() =>
              selectRole("CANDIDATE")
            }
            disabled={loading}
          >
            <span className="role-card-title">
              Candidate
            </span>

            <span className="role-card-copy">
              Secure exam, camera
              proctoring, offline buffer
              and response synchronization.
            </span>
          </button>
        </div>

        <div className="selected-role-banner">
          Signing in as{" "}
          <strong>
            {selectedRole === "ADMIN"
              ? "ADMINISTRATOR"
              : "CANDIDATE"}
          </strong>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="username">
            Username
          </label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) =>
              setUsername(
                event.target.value
              )
            }
            placeholder="Enter username"
            autoComplete="username"
            disabled={loading}
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            placeholder="Enter password"
            autoComplete="current-password"
            disabled={loading}
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading
              ? "Authenticating..."
              : `Sign In as ${
                  selectedRole ===
                  "ADMIN"
                    ? "Administrator"
                    : "Candidate"
                }`}
          </button>
        </form>

        <div className="demo-section">
          <div className="demo-title">
            Demo credentials
          </div>

          <div className="demo-note">
            The role buttons above automatically
            fill the correct demo account. You can
            still edit the username and password.
          </div>
        </div>

        <div className="login-footer">
          One portal • One login • Role-based access
          • Prevention → Detection → Response →
          Recovery → Trust
        </div>
      </div>
    </div>
  );
}
