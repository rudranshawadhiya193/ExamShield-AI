import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Video,
} from "lucide-react";

interface ProctoringEvidencePanelProps {
  candidateId: string;
}

type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

interface ProctoringEvent {
  id: string;
  time: string;
  type: string;
  severity: RiskLevel;
  message: string;
}

const STORAGE_PREFIX =
  "examshield_proctoring_events_";

function getStorageKey(
  candidateId: string
): string {
  return (
    STORAGE_PREFIX +
    candidateId
  );
}

function loadEvents(
  candidateId: string
): ProctoringEvent[] {
  try {
    const raw =
      localStorage.getItem(
        getStorageKey(candidateId)
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as ProctoringEvent[];
  } catch {
    return [];
  }
}

function getLatestRisk(
  events: ProctoringEvent[]
): RiskLevel {
  const latestRisk =
    events.find(
      (event) =>
        event.type ===
        "PROCTORING_RISK"
    );

  return (
    latestRisk?.severity ??
    "LOW"
  );
}

function getRiskColor(
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

export default function ProctoringEvidencePanel({
  candidateId,
}: ProctoringEvidencePanelProps) {
  const [events, setEvents] =
    useState<ProctoringEvent[]>(
      () =>
        loadEvents(
          candidateId
        )
    );

  const refresh =
    useCallback(() => {
      setEvents(
        loadEvents(
          candidateId
        )
      );
    }, [candidateId]);

  useEffect(() => {
    refresh();

    const interval =
      setInterval(
        refresh,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [refresh]);

  useEffect(() => {
    const handler =
      (event: StorageEvent) => {
        if (
          event.key ===
          getStorageKey(
            candidateId
          )
        ) {
          refresh();
        }
      };

    window.addEventListener(
      "storage",
      handler
    );

    return () =>
      window.removeEventListener(
        "storage",
        handler
      );
  }, [
    candidateId,
    refresh,
  ]);

  const latestRisk =
    getLatestRisk(
      events
    );

  const highCount =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.severity ===
            "HIGH"
        ).length,
      [events]
    );

  const mediumCount =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.severity ===
            "MEDIUM"
        ).length,
      [events]
    );

  const cameraStarted =
    events.some(
      (event) =>
        event.type ===
        "CAMERA_STARTED"
    );

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
          alignItems:
            "center",
          gap: 12,
          flexWrap:
            "wrap",
          marginBottom:
            16,
        }}
      >
        <div>
          <p className="eyebrow">
            PROCTORING EVIDENCE
          </p>

          <h3
            style={{
              marginBottom: 4,
            }}
          >
            AI Camera Proctoring Review
          </h3>

          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: 12,
            }}
          >
            Browser-side vision signals for
            authorized human review.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={refresh}
        >
          <RefreshCw
            size={16}
          />

          Refresh
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div
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
            Candidate
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 15,
              color: "#0f172a",
            }}
          >
            {candidateId}
          </strong>
        </div>

        <div
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
            Camera
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 15,
              color:
                cameraStarted
                  ? "#047857"
                  : "#64748b",
            }}
          >
            {cameraStarted
              ? "ACTIVE"
              : "NOT STARTED"}
          </strong>
        </div>

        <div
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
            Latest Risk
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 20,
              color:
                getRiskColor(
                  latestRisk
                ),
            }}
          >
            {latestRisk}
          </strong>
        </div>

        <div
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
            Review Signals
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 15,
              color: "#0f172a",
            }}
          >
            {highCount +
              mediumCount}
          </strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: 12,
          marginTop: 14,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background:
              "#fffbeb",
            border:
              "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 8,
              color:
                "#92400e",
              fontWeight:
                700,
              fontSize:
                12,
            }}
          >
            <AlertTriangle
              size={17}
            />
            Attention Signals
          </div>

          <strong
            style={{
              display:
                "block",
              marginTop:
                7,
              fontSize:
                23,
              color:
                "#a16207",
            }}
          >
            {mediumCount}
          </strong>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background:
              "#fef2f2",
            border:
              "1px solid #fecaca",
          }}
        >
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 8,
              color:
                "#991b1b",
              fontWeight:
                700,
              fontSize:
                12,
            }}
          >
            <ShieldAlert
              size={17}
            />
            High-Risk Signals
          </div>

          <strong
            style={{
              display:
                "block",
              marginTop:
                7,
              fontSize:
                23,
              color:
                "#b91c1c",
            }}
          >
            {highCount}
          </strong>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          marginBottom: 9,
          display:
            "flex",
          alignItems:
            "center",
          gap: 7,
          fontSize: 12,
          fontWeight: 700,
          color:
            "#334155",
        }}
      >
        <Video
          size={17}
        />

        Recent Camera Signals
      </div>

      <div
        style={{
          display:
            "grid",
          gap: 7,
        }}
      >
        {events
          .slice(0, 8)
          .map(
            (event) => (
              <div
                key={
                  event.id
                }
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "80px 150px 70px 1fr",
                  alignItems:
                    "center",
                  gap: 9,
                  padding:
                    "9px 0",
                  borderBottom:
                    "1px solid #e2e8f0",
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    color:
                      "#64748b",
                  }}
                >
                  {event.time}
                </span>

                <strong
                  style={{
                    color:
                      "#334155",
                  }}
                >
                  {event.type}
                </strong>

                <strong
                  style={{
                    color:
                      getRiskColor(
                        event.severity
                      ),
                  }}
                >
                  {event.severity}
                </strong>

                <span
                  style={{
                    color:
                      "#475569",
                  }}
                >
                  {event.message}
                </span>
              </div>
            )
          )}

        {events.length ===
          0 && (
          <div
            style={{
              padding: 15,
              borderRadius:
                9,
              background:
                "#f8fafc",
              color:
                "#64748b",
              fontSize: 11,
            }}
          >
            No camera evidence recorded yet.
            Run the candidate examination in
            another tab/session and refresh.
          </div>
        )}
      </div>

      <div
        style={{
          marginTop:
            12,
          padding:
            11,
          borderRadius:
            9,
          background:
            "#f8fafc",
          border:
            "1px solid #e2e8f0",
          fontSize:
            10,
          lineHeight:
            1.5,
          color:
            "#64748b",
        }}
      >
        <CheckCircle2
          size={13}
          style={{
            verticalAlign:
              "middle",
            marginRight: 5,
          }}
        />

        Video is processed locally in this MVP.
        Risk signals are evidence for authorized
        human review and are not an automatic
        cheating verdict.
      </div>
    </section>
  );
}