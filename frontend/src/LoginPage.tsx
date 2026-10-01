import { useState } from "react";
import type { FormEvent } from "react";
import api from "./api";

import type { AuthUser } from "./auth";
import { saveSession } from "./auth";

import "./login.css";


interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}


export default function LoginPage({
  onLogin
}: LoginPageProps) {

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");

    if (!username.trim()) {
      setError(
        "Please enter your username."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );
      return;
    }

    try {
      setLoading(true);

      const loginResponse =
        await api.post(
          "/auth/login",
          {
            username: username.trim(),
            password
          }
        );

      const accessToken =
        loginResponse.data?.access_token;

      if (!accessToken) {
        throw new Error(
          "Authentication token was not returned."
        );
      }

      const meResponse =
        await api.get(
          "/auth/me",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`
            }
          }
        );

      const user =
        meResponse.data as AuthUser;

      if (
        user.role !== "ADMIN" &&
        user.role !== "CANDIDATE"
      ) {
        throw new Error(
          "Unsupported user role."
        );
      }

      saveSession(
        accessToken,
        user
      );

      onLogin(user);

    } catch (requestError) {

      if (requestError instanceof Error) {
        setError(requestError.message || "Login failed. Please check the backend server.");

      } else {

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Login failed."
        );
      }

    } finally {
      setLoading(false);
    }
  }


  function fillAdminCredentials() {
    setUsername("admin");
    setPassword("Admin@123");
    setError("");
  }


  function fillCandidateCredentials() {
    setUsername("candidate");
    setPassword("Candidate@123");
    setError("");
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
              Resilient & Trustworthy
              Online Assessment
            </div>
          </div>

        </div>


        <div className="login-heading">
          Secure Examination Portal
        </div>

        <div className="login-description">
          Sign in to access the
          ExamShield AI ecosystem.
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
              : "Sign In"}
          </button>

        </form>


        <div className="demo-section">

          <div className="demo-title">
            Hackathon Demo Accounts
          </div>


          <button
            type="button"
            className="demo-account"
            onClick={
              fillAdminCredentials
            }
            disabled={loading}
          >
            <span>
              ADMIN
            </span>

            <small>
              admin / Admin@123
            </small>
          </button>


          <button
            type="button"
            className="demo-account"
            onClick={
              fillCandidateCredentials
            }
            disabled={loading}
          >
            <span>
              CANDIDATE
            </span>

            <small>
              candidate / Candidate@123
            </small>
          </button>

        </div>


        <div className="login-footer">
          Prevention → Detection →
          Response → Recovery → Trust
        </div>

      </div>

    </div>
  );
}