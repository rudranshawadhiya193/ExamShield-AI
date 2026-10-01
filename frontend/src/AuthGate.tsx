import { useEffect, useMemo, useState } from "react";
import api from "./api";

import App from "./App";
import LoginPage from "./LoginPage";
import ProctoringPanel from "./ProctoringPanel";

import type { AuthUser } from "./auth";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  isLocalDemoSession,
} from "./auth";

import "./login.css";


interface Question {
  id: string;
  text: string;
  options: string[];
}


interface PendingResponse {
  response_id: string;
  exam_id: string;
  candidate_id: string;
  question_id: string;
  encrypted_response: string;
  response_hash: string;
  answered_at: string;
}


interface IncidentResponse {
  status: string;
  message: string;
  incident: {
    id: number;
    type: string;
    severity: string;
    message: string;
    status: string;
    created_at: string | null;
    resolved_at: string | null;
  };
}


const QUESTIONS: Question[] = [
  {
    id: "Q1",
    text: "Which HTTP status code indicates a successful request?",
    options: [
      "200 OK",
      "404 Not Found",
      "500 Server Error",
      "401 Unauthorized",
    ],
  },
  {
    id: "Q2",
    text: "Which technology is commonly used to create an API?",
    options: [
      "FastAPI",
      "Photoshop",
      "Figma",
      "Excel",
    ],
  },
  {
    id: "Q3",
    text: "Which algorithm is used in ExamShield for response integrity verification?",
    options: [
      "SHA-256",
      "MD5",
      "ROT13",
      "Caesar Cipher",
    ],
  },
  {
    id: "Q4",
    text: "What does AES-GCM provide for buffered exam responses?",
    options: [
      "Authenticated encryption",
      "Image compression",
      "Database indexing",
      "Password guessing",
    ],
  },
  {
    id: "Q5",
    text: "What should an anomaly risk signal represent in ExamShield?",
    options: [
      "A signal for human review",
      "An automatic cheating verdict",
      "An exam result",
      "A final disciplinary decision",
    ],
  },
];


function arrayBufferToBase64(
  buffer: ArrayBuffer | Uint8Array<ArrayBuffer>
): string {
  const bytes =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}


function base64ToUint8Array(
  value: string
): Uint8Array<ArrayBuffer> {
  const binary = atob(value);

  const bytes = new Uint8Array(
    binary.length
  );

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}


async function getEncryptionKey(): Promise<CryptoKey> {
  const storageKey =
    "examshield_demo_aes_key";

  const storedKey =
    sessionStorage.getItem(storageKey);

  if (storedKey) {
    const rawKey =
      base64ToUint8Array(storedKey);

    return crypto.subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-GCM",
      },
      false,
      ["encrypt"]
    );
  }

  const key =
    await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );

  const rawKey =
    await crypto.subtle.exportKey(
      "raw",
      key
    );

  sessionStorage.setItem(
    storageKey,
    arrayBufferToBase64(rawKey)
  );

  return key;
}


async function encryptAnswer(
  answer: string
): Promise<string> {
  const key =
    await getEncryptionKey();

  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );

  const encodedAnswer =
    new TextEncoder().encode(answer);

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedAnswer
    );

  return JSON.stringify({
    algorithm: "AES-256-GCM",
    iv: arrayBufferToBase64(iv),
    ciphertext:
      arrayBufferToBase64(encrypted),
  });
}


async function calculateHash(
  value: string
): Promise<string> {
  const encoded =
    new TextEncoder().encode(value);

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  const hashBytes =
    new Uint8Array(hashBuffer);

  return Array.from(hashBytes)
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


function getPendingStorageKey(
  candidateId: string
): string {
  return `examshield_pending_${candidateId}`;
}


function loadPendingResponses(
  candidateId: string
): PendingResponse[] {
  const raw =
    localStorage.getItem(
      getPendingStorageKey(candidateId)
    );

  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as PendingResponse[];
  } catch {
    return [];
  }
}


function savePendingResponses(
  candidateId: string,
  responses: PendingResponse[]
): void {
  localStorage.setItem(
    getPendingStorageKey(candidateId),
    JSON.stringify(responses)
  );
}


function getActiveIncidentStorageKey(
  candidateId: string
): string {
  return `examshield_active_incident_${candidateId}`;
}


function loadActiveIncidentId(
  candidateId: string
): number | null {
  const raw = sessionStorage.getItem(
    getActiveIncidentStorageKey(candidateId)
  );

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}


function saveActiveIncidentId(
  candidateId: string,
  incidentId: number
): void {
  sessionStorage.setItem(
    getActiveIncidentStorageKey(candidateId),
    String(incidentId)
  );
}


function clearActiveIncidentId(
  candidateId: string
): void {
  sessionStorage.removeItem(
    getActiveIncidentStorageKey(candidateId)
  );
}


function SessionBar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <div className="session-bar">

      <span className="session-user">
        Signed in as{" "}
        <strong>
          {user.full_name}
        </strong>
      </span>

      <span
        className={
          "session-role " +
          (
            user.role === "ADMIN"
              ? "admin"
              : "candidate"
          )
        }
      >
        {user.role}
      </span>

      <button
        type="button"
        className="session-logout"
        onClick={onLogout}
      >
        Logout
      </button>

    </div>
  );
}


function CandidatePortal({
  user,
}: {
  user: AuthUser;
}) {
  const candidateId =
    "CANDIDATE-001";

  const examId =
    "EXAM-DEMO-001";


  const [answers, setAnswers] =
    useState<Record<string, string>>({});


  const [pendingResponses, setPendingResponses] =
    useState<PendingResponse[]>(
      () =>
        loadPendingResponses(candidateId)
    );


  const [syncedCount, setSyncedCount] =
    useState(0);


  const [simulatedOnline, setSimulatedOnline] =
    useState(
      () => navigator.onLine
    );


  const [syncing, setSyncing] =
    useState(false);


  const [activeIncidentId, setActiveIncidentId] =
    useState<number | null>(
      () => loadActiveIncidentId(candidateId)
    );


  const [eventStatus, setEventStatus] =
    useState(
      () =>
        loadActiveIncidentId(candidateId)
          ? "Network disruption is being tracked by ExamShield."
          : "Exam session is operating normally."
    );


  const totalAnswered =
    useMemo(
      () =>
        Object.keys(answers).length,
      [answers]
    );


  async function refreshSyncedCount(): Promise<void> {
    const token =
      getAccessToken();

    if (!token) {
      return;
    }

    try {
      const response =
        await api.get(
          `/exam/responses/${candidateId}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const count =
        Number(
          response.data
            ?.total_synced_responses ?? 0
        );

      setSyncedCount(count);

    } catch {
      // Candidate can continue locally.
    }
  }


  async function syncResponse(
    response: PendingResponse
  ): Promise<boolean> {
    const token =
      getAccessToken();

    if (!token) {
      return false;
    }

    try {
      await api.post(
        "/exam/responses/sync",
        response,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      return true;

    } catch {
      return false;
    }
  }


  async function createNetworkIncident(): Promise<boolean> {
    const token = getAccessToken();

    if (!token) {
      setEventStatus(
        "Secure session token unavailable; disruption event was not registered."
      );
      return false;
    }

    const existingIncidentId =
      activeIncidentId ?? loadActiveIncidentId(candidateId);

    if (existingIncidentId) {
      setActiveIncidentId(existingIncidentId);
      setEventStatus(
        `Network disruption is already tracked as incident #${existingIncidentId}.`
      );
      return true;
    }

    try {
      const response = await api.post<IncidentResponse>(
        "/candidate-disruptions/network",
        {
          exam_id: examId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const incidentId = response.data.incident.id;

      saveActiveIncidentId(candidateId, incidentId);
      setActiveIncidentId(incidentId);
      setEventStatus(
        `Network disruption registered as HIGH incident #${incidentId}.`
      );

      return true;
    } catch {
      setEventStatus(
        "Offline mode enabled, but backend incident registration failed."
      );
      return false;
    }
  }


  async function resolveNetworkIncident(): Promise<void> {
    const token = getAccessToken();
    const incidentId =
      activeIncidentId ?? loadActiveIncidentId(candidateId);

    if (!incidentId) {
      return;
    }

    if (!token) {
      setEventStatus(
        `Responses are synchronized, but incident #${incidentId} could not be resolved without a secure session.`
      );
      return;
    }

    try {
      await api.patch(
        `/candidate-disruptions/network/${incidentId}/resolve`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      clearActiveIncidentId(candidateId);
      setActiveIncidentId(null);
      setEventStatus(
        `Network incident #${incidentId} resolved after response synchronization.`
      );
    } catch {
      setEventStatus(
        `Responses synchronized, but incident #${incidentId} still needs resolution.`
      );
    }
  }


  async function flushPending(): Promise<void> {
    if (!simulatedOnline) {
      return;
    }

    if (pendingResponses.length === 0) {
      await refreshSyncedCount();
      await resolveNetworkIncident();
      return;
    }

    setSyncing(true);

    const remaining: PendingResponse[] = [];

    for (const response of pendingResponses) {
      const success = await syncResponse(response);

      if (!success) {
        remaining.push(response);
      }
    }

    savePendingResponses(candidateId, remaining);
    setPendingResponses(remaining);
    await refreshSyncedCount();

    if (remaining.length === 0) {
      await resolveNetworkIncident();
    } else {
      setEventStatus(
        `${remaining.length} encrypted response${
          remaining.length === 1 ? "" : "s"
        } still pending synchronization.`
      );
    }

    setSyncing(false);
  }


  async function answerQuestion(
    question: Question,
    answer: string
  ): Promise<void> {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: answer,
    }));

    const encryptedResponse =
      await encryptAnswer(answer);

    const responseHash =
      await calculateHash(
        encryptedResponse
      );

    const response: PendingResponse = {
      response_id:
        crypto.randomUUID(),
      exam_id:
        examId,
      candidate_id:
        candidateId,
      question_id:
        question.id,
      encrypted_response:
        encryptedResponse,
      response_hash:
        responseHash,
      answered_at:
        new Date().toISOString(),
    };


    if (simulatedOnline) {
      const success = await syncResponse(response);

      if (success) {
        await refreshSyncedCount();
        setEventStatus("Response synchronized successfully.");
        return;
      }

      await createNetworkIncident();
      setSimulatedOnline(false);
    } else {
      await createNetworkIncident();
    }


    const existing =
      loadPendingResponses(
        candidateId
      );

    const updated =
      [...existing, response];

    savePendingResponses(
      candidateId,
      updated
    );

    setPendingResponses(updated);
    setEventStatus(
      `Response encrypted and buffered locally. ${updated.length} response${
        updated.length === 1 ? "" : "s"
      } waiting for synchronization.`
    );
  }


  useEffect(() => {
    void refreshSyncedCount();

    const handleOnline =
      () => {
        setSimulatedOnline(true);
      };

    const handleOffline =
      () => {
        setSimulatedOnline(false);
      };

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);


  useEffect(() => {
    void flushPending();
  }, [simulatedOnline]);


  useEffect(() => {
    savePendingResponses(
      candidateId,
      pendingResponses
    );
  }, [pendingResponses]);


  return (
    <div className="candidate-portal">

      <div className="candidate-container">

        <div className="candidate-header">

          <div>
            <h1 className="candidate-title">
              Secure Examination
            </h1>

            <div className="candidate-subtitle">
              Candidate:{" "}
              {user.full_name}
              {" · "}
              {examId}
            </div>
          </div>


          <div
            className={
              "connection-status " +
              (
                simulatedOnline
                  ? "online"
                  : "offline"
              )
            }
          >
            {simulatedOnline
              ? "● ONLINE"
              : "● OFFLINE BUFFERING"}
          </div>

        </div>


        <div className="candidate-stats">

          <div className="candidate-stat">
            <div className="candidate-stat-label">
              Answered
            </div>

            <div className="candidate-stat-value">
              {totalAnswered}/{QUESTIONS.length}
            </div>
          </div>


          <div className="candidate-stat">
            <div className="candidate-stat-label">
              Pending Sync
            </div>

            <div className="candidate-stat-value">
              {pendingResponses.length}
            </div>
          </div>


          <div className="candidate-stat">
            <div className="candidate-stat-label">
              Synced
            </div>

            <div className="candidate-stat-value">
              {syncedCount}
            </div>
          </div>

        </div>


        <ProctoringPanel
          candidateId={candidateId}
          examId={examId}
        />


        {QUESTIONS.map(
          (question, index) => (
            <div
              className="exam-question"
              key={question.id}
            >

              <div className="exam-question-title">
                {index + 1}.{" "}
                {question.text}
              </div>


              {question.options.map(
                (option) => (
                  <button
                    type="button"
                    key={option}
                    className={
                      "answer-option " +
                      (
                        answers[question.id] ===
                        option
                          ? "selected"
                          : ""
                      )
                    }
                    onClick={() =>
                      void answerQuestion(
                        question,
                        option
                      )
                    }
                  >
                    {option}
                  </button>
                )
              )}

            </div>
          )
        )}


        <div
          style={{
            marginTop: 20,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #dbe3ec",
            background: "#f8fafc",
            color: "#475569",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong>Event Status:</strong>{" "}
          {eventStatus}
          {activeIncidentId && (
            <span>
              {" "}
              Backend incident #{activeIncidentId} is being tracked.
            </span>
          )}
        </div>


        <div className="simulation-bar">

          <div className="simulation-text">
            <strong>
              Resilience Demo
            </strong>
            <br />

            Simulate a network failure.
            Responses remain encrypted
            locally and synchronize after
            reconnect.
          </div>


          <button
            type="button"
            className={
              "simulation-button " +
              (
                simulatedOnline
                  ? ""
                  : "reconnect"
              )
            }
            onClick={() => {
              if (simulatedOnline) {
                void createNetworkIncident().finally(() => {
                  setSimulatedOnline(false);
                });
                return;
              }

              setSimulatedOnline(true);
            }}
          >
            {simulatedOnline
              ? "SIMULATE NETWORK FAILURE"
              : (
                syncing
                  ? "SYNCHRONIZING..."
                  : "RECONNECT & SYNC"
              )}
          </button>

        </div>


        <div
          style={{
            marginTop: 14,
            textAlign: "center",
            color: "#64748b",
            fontSize: 11,
          }}
        >
          Responses are encrypted
          with AES-GCM and integrity
          checked with SHA-256 before
          synchronization.
        </div>

      </div>

    </div>
  );
}


export default function AuthGate() {
  const [user, setUser] =
    useState<AuthUser | null>(
      getStoredUser()
    );


  const [checkingSession, setCheckingSession] =
    useState(
      () => Boolean(getAccessToken())
    );


  useEffect(() => {
    async function verifySession(): Promise<void> {
      const token =
        getAccessToken();

      if (!token) {
        setCheckingSession(false);
        return;
      }

      /*
       * A local demo session is intentionally accepted
       * without a backend round-trip. This keeps the
       * public hackathon demo usable while Render is
       * sleeping or temporarily unreachable.
       */
      if (isLocalDemoSession()) {
        setCheckingSession(false);
        return;
      }

      try {
        const response =
          await api.get(
            "/auth/me",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setUser(
          response.data as AuthUser
        );

      } catch {
        clearSession();
        setUser(null);

      } finally {
        setCheckingSession(false);
      }
    }

    void verifySession();
  }, []);


  function handleLogout(): void {
    clearSession();
    setUser(null);
  }


  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07111f",
          color: "#cbd5e1",
          fontFamily:
            "Inter, system-ui, sans-serif",
        }}
      >
        Validating secure session...
      </div>
    );
  }


  if (!user) {
    return (
      <LoginPage
        onLogin={setUser}
      />
    );
  }


  if (user.role === "ADMIN") {
    return (
      <>
        <SessionBar
          user={user}
          onLogout={handleLogout}
        />

        <App />
      </>
    );
  }


  return (
    <>
      <SessionBar
        user={user}
        onLogout={handleLogout}
      />

      <CandidatePortal
        user={user}
      />
    </>
  );
}