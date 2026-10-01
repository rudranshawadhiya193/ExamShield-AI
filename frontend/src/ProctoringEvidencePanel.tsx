import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Video,
} from "lucide-react";

import {
  getProctoringEvidence,
  type ProctoringEvent,
} from "./api";

interface ProctoringEvidencePanelProps {
  candidateId: string;
}

type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

function loadLocalProctoringEvents(
  candidateId: string
): ProctoringEvent[] {
  try {
    const raw =
      localStorage.getItem(
        `examshield_proctoring_events_${candidateId}`
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw) as Array<{
        id: string;
        time: string;
        type: string;
        severity: RiskLevel;
        message: string;
      }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((event) => ({
      id: event.id,
      candidate_id: candidateId,
      exam_id: "EXAM-DEMO-2026",
      type: event.type,
      severity: event.severity,
      message: event.message,
      time: event.time,
    }));
  } catch {
    return [];
  }
}

function getLatestRisk(
  events: ProctoringEvent[]
): RiskLevel {
  const event =
    events.find(
      (item) =>
        item.type ===
        "PROCTORING_RISK"
    );

  return event?.severity ?? "LOW";
}

function getLatestEvent(
  events: ProctoringEvent[]
): ProctoringEvent | null {
  return events[0] ?? null;
}

function riskColor(
  risk: RiskLevel
): string {
  if (risk === "HIGH") {
    return "#b91c1c";
  }

  if (risk === "MEDIUM") {
    return "#a16207";
  }

  return "#047857";
}

function formatTime(
  value: string | null
): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleTimeString();
}

export default function ProctoringEvidencePanel({
  candidateId,
}: ProctoringEvidencePanelProps) {
  const [events, setEvents] =
    useState<ProctoringEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [lastRefresh, setLastRefresh] =
    useState<string>("");

  const [usingLocalFallback, setUsingLocalFallback] =
    useState(false);

  const refresh = useCallback(
    async () => {
      try {
        setError(null);

        const response =
          await getProctoringEvidence(
            candidateId
          );

        setEvents(
          response.events ?? []
        );

        setUsingLocalFallback(false);

        setLastRefresh(
          new Date().toLocaleTimeString()
        );
      } catch (requestError) {
        console.error(requestError);

        /*
         * Same-origin tabs share localStorage. This lets
         * the admin review the candidate's computer-vision
         * signals even while the hosted backend is down.
         */
        const localEvents =
          loadLocalProctoringEvents(
            candidateId
          );

        setEvents(localEvents);
        setUsingLocalFallback(true);
        setError(null);

        setLastRefresh(
          new Date().toLocaleTimeString()
        );
      } finally {
        setLoading(false);
      }
    },
    [candidateId]
  );

  useEffect(() => {
    void refresh();

    const interval =
      setInterval(() => {
        void refresh();
      }, 2000);

    return () =>
      clearInterval(interval);
  }, [refresh]);

  const latestEvent =
    getLatestEvent(events);

  const latestRisk =
    getLatestRisk(events);

  const riskEvents =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.type ===
            "PROCTORING_RISK"
        ),
      [events]
    );

  const highCount =
    useMemo(
      () =>
        riskEvents.filter(
          (event) =>
            event.severity ===
            "HIGH"
        ).length,
      [riskEvents]
    );

  const mediumCount =
    useMemo(
      () =>
        riskEvents.filter(
          (event) =>
            event.severity ===
            "MEDIUM"
        ).length,
      [riskEvents]
    );

  const statusEvent =
    useMemo(
      () =>
        events.find(
          (event) =>
            event.type ===
            "PROCTORING_STATUS"
        ),
      [events]
    );

  const lifecycleEvent =
    useMemo(
      () =>
        events.find(
          (event) =>
            event.type ===
              "CAMERA_STARTED" ||
            event.type ===
              "CAMERA_UNAVAILABLE"
        ),
      [events]
    );

  const cameraState =
    lifecycleEvent?.type ===
    "CAMERA_STARTED"
      ? "ACTIVE"
      : lifecycleEvent?.type ===
          "CAMERA_UNAVAILABLE"
        ? "UNAVAILABLE"
        : "NOT STARTED";

  const lastSignalAgeMs =
    latestEvent?.time
      ? Math.max(
          0,
          Date.now() -
            new Date(
              latestEvent.time
            ).getTime()
        )
      : Number.POSITIVE_INFINITY;

  const signalIsLive =
    cameraState === "ACTIVE" &&
    lastSignalAgeMs < 10000;

  return (
    <section
      className="panel"
      style={{
        marginTop: 18,
        padding: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <p className="eyebrow">
            LIVE SERVER-SIDE AI PROCTORING
          </p>

          <h3
            style={{
              marginBottom: 5,
            }}
          >
            Candidate Camera Monitor
          </h3>

          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Browser-side computer vision sends
            structured signals to the backend.
            The administrator sees the latest
            camera state, face-count signal,
            head orientation, and review flags.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={() =>
            void refresh()
          }
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {usingLocalFallback && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong>LOCAL BROWSER FALLBACK:</strong>{" "}
          Backend is unreachable, so camera signals
          are being read from the candidate's
          same-origin browser storage. Open Admin
          and Candidate in separate tabs of the same
          browser for live demo evidence.
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            border:
              "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(5, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {[
          {
            label: "Candidate",
            value: candidateId,
            color: "#0f172a",
          },
          {
            label: "Camera",
            value: signalIsLive
              ? "ACTIVE"
              : cameraState,
            color: signalIsLive
              ? "#047857"
              : cameraState ===
                  "UNAVAILABLE"
                ? "#b91c1c"
                : "#a16207",
          },
          {
            label: "Latest Risk",
            value: latestRisk,
            color: riskColor(
              latestRisk
            ),
          },
          {
            label: "High Flags",
            value: String(
              highCount
            ),
            color: "#b91c1c",
          },
          {
            label: "Medium Flags",
            value: String(
              mediumCount
            ),
            color: "#a16207",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: 14,
              borderRadius: 11,
              background:
                "#f8fafc",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#64748b",
              }}
            >
              {item.label}
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 4,
                fontSize:
                  item.label ===
                  "Candidate"
                    ? 13
                    : 19,
                color: item.color,
              }}
            >
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        <div
          style={{
            padding: 13,
            borderRadius: 10,
            background:
              "#ffffff",
            border:
              "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 7,
              alignItems:
                "center",
              color: "#475569",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Video size={14} />
            Camera State
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 8,
              color:
                signalIsLive
                  ? "#047857"
                  : "#64748b",
              fontSize: 15,
            }}
          >
            {signalIsLive
              ? "LIVE SIGNALS"
              : cameraState}
          </strong>
        </div>

        <div
          style={{
            padding: 13,
            borderRadius: 10,
            background:
              "#ffffff",
            border:
              "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 7,
              alignItems:
                "center",
              color: "#475569",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <ShieldAlert size={14} />
            Latest Detection
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 8,
              color:
                latestEvent
                  ? "#0f172a"
                  : "#64748b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {latestEvent?.message ??
              "No camera signal recorded yet."}
          </strong>
        </div>

        <div
          style={{
            padding: 13,
            borderRadius: 10,
            background:
              "#ffffff",
            border:
              "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 7,
              alignItems:
                "center",
              color: "#475569",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Clock3 size={14} />
            Signal Freshness
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 8,
              color:
                signalIsLive
                  ? "#047857"
                  : "#64748b",
              fontSize: 13,
            }}
          >
            {latestEvent
              ? `Last event ${formatTime(
                  latestEvent.time
                )}`
              : "Waiting for first event"}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 10,
              color: "#64748b",
            }}
          >
            Refreshed: {lastRefresh || "—"}
          </span>
        </div>
      </div>

      {statusEvent && (
        <div
          style={{
            marginTop: 12,
            padding: 13,
            borderRadius: 10,
            background:
              "#f8fafc",
            border:
              "1px solid #e2e8f0",
            color: "#334155",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <strong>
            Latest live camera status:{" "}
          </strong>
          {statusEvent.message}
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 11,
          background:
            latestRisk === "HIGH"
              ? "#fef2f2"
              : latestRisk === "MEDIUM"
                ? "#fffbeb"
                : "#f0fdf4",
          border:
            latestRisk === "HIGH"
              ? "1px solid #fecaca"
              : latestRisk === "MEDIUM"
                ? "1px solid #fde68a"
                : "1px solid #bbf7d0",
          display: "flex",
          gap: 10,
          alignItems:
            "flex-start",
        }}
      >
        {latestRisk === "LOW" ? (
          <CheckCircle2
            size={18}
            color="#047857"
          />
        ) : (
          <AlertTriangle
            size={18}
            color={riskColor(
              latestRisk
            )}
          />
        )}

        <div>
          <strong
            style={{
              color:
                riskColor(
                  latestRisk
                ),
              fontSize: 12,
            }}
          >
            {latestRisk ===
            "HIGH"
              ? "High-severity camera signal"
              : latestRisk ===
                  "MEDIUM"
                ? "Medium-severity camera signal"
                : "Camera monitoring active"}
          </strong>

          <div
            style={{
              marginTop: 4,
              color: "#475569",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            AI signals support authorized
            human review; they are not an
            automatic cheating verdict.
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 760,
            borderCollapse:
              "collapse",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding:
                    "9px 8px",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                Time
              </th>

              <th
                style={{
                  textAlign: "left",
                  padding:
                    "9px 8px",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                Event
              </th>

              <th
                style={{
                  textAlign: "left",
                  padding:
                    "9px 8px",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                Severity
              </th>

              <th
                style={{
                  textAlign: "left",
                  padding:
                    "9px 8px",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                Detection Evidence
              </th>
            </tr>
          </thead>

          <tbody>
            {events
              .slice(0, 10)
              .map((event) => (
                <tr key={event.id}>
                  <td
                    style={{
                      padding:
                        "10px 8px",
                      borderTop:
                        "1px solid #e2e8f0",
                      color:
                        "#64748b",
                      fontSize: 11,
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {formatTime(
                      event.time
                    )}
                  </td>

                  <td
                    style={{
                      padding:
                        "10px 8px",
                      borderTop:
                        "1px solid #e2e8f0",
                      color:
                        "#0f172a",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {event.type}
                  </td>

                  <td
                    style={{
                      padding:
                        "10px 8px",
                      borderTop:
                        "1px solid #e2e8f0",
                      color:
                        riskColor(
                          event.severity
                        ),
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {event.severity}
                  </td>

                  <td
                    style={{
                      padding:
                        "10px 8px",
                      borderTop:
                        "1px solid #e2e8f0",
                      color:
                        "#475569",
                      fontSize: 11,
                    }}
                  >
                    {event.message}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading &&
          events.length === 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 14,
                borderRadius: 9,
                background:
                  "#f8fafc",
                color: "#64748b",
                fontSize: 11,
              }}
            >
              <AlertTriangle
                size={15}
                style={{
                  verticalAlign:
                    "middle",
                  marginRight: 6,
                }}
              />
              No camera evidence has reached
              the server yet. Open the Candidate
              role in another tab/browser and
              allow camera access.
            </div>
          )}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          color: "#64748b",
          fontSize: 10,
          lineHeight: 1.55,
        }}
      >
        <ShieldAlert size={14} />

        <span>
          Camera footage is not stored or
          uploaded by this MVP. Only structured
          computer-vision detection signals are
          persisted for authorized review.
        </span>
      </div>
    </section>
  );
}
