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


function getLatestRisk(
  events: ProctoringEvent[]
): RiskLevel {
  const latestRisk = events.find(
    (event) =>
      event.type === "PROCTORING_RISK"
  );

  return latestRisk?.severity ?? "LOW";
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


export default function ProctoringEvidencePanel({
  candidateId,
}: ProctoringEvidencePanelProps) {
  const [events, setEvents] =
    useState<ProctoringEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  const refresh = useCallback(
    async () => {
      try {
        setError(null);

        const response =
          await getProctoringEvidence(
            candidateId
          );

        setEvents(
          response.events
        );
      } catch (requestError) {
        console.error(requestError);

        setError(
          "Unable to load server-side camera evidence."
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
      setInterval(
        () => {
          void refresh();
        },
        2000
      );

    return () =>
      clearInterval(interval);
  }, [refresh]);


  const latestRisk =
    getLatestRisk(events);

  const cameraStarted =
    events.some(
      (event) =>
        event.type === "CAMERA_STARTED"
    );

  const highCount =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.severity === "HIGH"
        ).length,
      [events]
    );

  const mediumCount =
    useMemo(
      () =>
        events.filter(
          (event) =>
            event.severity === "MEDIUM"
        ).length,
      [events]
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
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <p className="eyebrow">
            SERVER-SIDE PROCTORING EVIDENCE
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
            Live vision signals persisted by the backend
            for authorized human review.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>


      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
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
            "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
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
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
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
              color: cameraStarted
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
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
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
              color: riskColor(latestRisk),
            }}
          >
            {latestRisk}
          </strong>
        </div>


        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
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
            {highCount + mediumCount}
          </strong>
        </div>
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 14,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#92400e",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <AlertTriangle size={17} />
            Attention Signals
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 7,
              fontSize: 23,
              color: "#a16207",
            }}
          >
            {mediumCount}
          </strong>
        </div>


        <div
          style={{
            padding: 14,
            borderRadius: 11,
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#991b1b",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <ShieldAlert size={17} />
            High-Risk Signals
          </div>

          <strong
            style={{
              display: "block",
              marginTop: 7,
              fontSize: 23,
              color: "#b91c1c",
            }}
          >
            {highCount}
          </strong>
        </div>
      </div>


      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 11,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
            color: "#334155",
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          <Video size={17} />
          Recent Camera Signals
        </div>

        {events
          .slice(0, 8)
          .map((event) => (
            <div
              key={event.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "125px 150px 1fr",
                gap: 10,
                alignItems: "center",
                padding: "8px 0",
                borderBottom:
                  "1px solid #e2e8f0",
                fontSize: 11,
              }}
            >
              <span
                style={{
                  color: "#64748b",
                }}
              >
                {event.time
                  ? new Date(
                      event.time
                    ).toLocaleTimeString()
                  : "—"}
              </span>

              <strong
                style={{
                  color: riskColor(
                    event.severity
                  ),
                }}
              >
                {event.type}
              </strong>

              <span
                style={{
                  color: "#475569",
                }}
              >
                {event.message}
              </span>
            </div>
          ))}

        {events.length === 0 && (
          <div
            style={{
              padding: 10,
              color: "#64748b",
              fontSize: 11,
            }}
          >
            {loading
              ? "Waiting for camera evidence..."
              : "No camera evidence recorded yet."}
          </div>
        )}
      </div>


      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: 10,
          lineHeight: 1.5,
          color: "#64748b",
        }}
      >
        <CheckCircle2 size={14} />
        <span>
          Camera footage is not stored. The system stores
          structured computer-vision risk signals only,
          for authorized human review.
        </span>
      </div>
    </section>
  );
}
