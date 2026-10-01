import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, FileCheck2, RefreshCw, ShieldAlert } from "lucide-react";

import { getAccessToken } from "./auth";


type JsonRecord = Record<string, unknown>;

interface TrustReportResponse extends JsonRecord {
  status?: string;
  report_type?: string;
  generated_at?: string;
  scope?: JsonRecord;
  operational_summary?: JsonRecord;
  prediction_summary?: JsonRecord;
  anomaly_summary?: JsonRecord;
  fairness_summary?: JsonRecord;
  response_integrity?: JsonRecord;
  audit_integrity?: JsonRecord;
  overall_trust_status?: string;
}


function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}


function readText(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not available";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}


function pickText(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return readText(record[key]);
    }
  }

  return "Not available";
}


function pickNumber(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}


function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const trusted =
    normalized.includes("TRUST") ||
    normalized.includes("VERIFIED") ||
    normalized.includes("PASS") ||
    normalized.includes("HEALTHY");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "7px 11px",
        borderRadius: "999px",
        border: `1px solid ${
          trusted
            ? "rgba(52,211,153,0.35)"
            : "rgba(248,113,113,0.35)"
        }`,
        background: trusted
          ? "rgba(52,211,153,0.10)"
          : "rgba(127,29,29,0.15)",
        color: trusted ? "#9cf3d4" : "#ffc4cb",
        fontWeight: 750,
        fontSize: "12px",
        letterSpacing: "0.03em",
      }}
    >
      {trusted ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
      {status}
    </span>
  );
}


function EvidenceCard({
  title,
  icon,
  data,
}: {
  title: string;
  icon: ReactNode;
  data: JsonRecord;
}) {
  const rows = useMemo(
    () =>
      Object.entries(data).filter(
        ([, value]) =>
          value !== undefined && value !== null && typeof value !== "object"
      ),
    [data]
  );

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.028)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
          }}
        >
          {icon}
          <strong>{title}</strong>
        </div>

        <span
          style={{
            fontSize: "11px",
            color: "#8196ae",
          }}
        >
          Evidence
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            color: "#8fa4bd",
            fontSize: "12px",
          }}
        >
          No scalar evidence returned.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "9px",
          }}
        >
          {rows.slice(0, 8).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: "10px",
                borderRadius: "9px",
                background: "rgba(0,0,0,0.12)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "#7d91aa",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {key.replaceAll("_", " ")}
              </div>
              <strong
                style={{
                  fontSize: "13px",
                  wordBreak: "break-word",
                }}
              >
                {readText(value)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function TrustReportPanel() {
  const [report, setReport] = useState<TrustReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setError("Secure admin session is unavailable.");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await fetch("/backend/reports/trust", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Trust report request failed.");
      }

      const data = (await response.json()) as TrustReportResponse;
      setReport(data);
    } catch (requestError) {
      console.error(requestError);
      setError("Trust report could not be loaded from the backend.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const operational = asRecord(report?.operational_summary);
  const prediction = asRecord(report?.prediction_summary);
  const anomaly = asRecord(report?.anomaly_summary);
  const fairness = asRecord(report?.fairness_summary);
  const responseIntegrity = asRecord(report?.response_integrity);
  const auditIntegrity = asRecord(report?.audit_integrity);
  const scope = asRecord(report?.scope);

  const responseCount = pickNumber(responseIntegrity, [
    "total_responses",
    "synced_responses",
    "response_count",
  ]);

  const invalidResponses = pickNumber(responseIntegrity, [
    "invalid_hashes",
    "invalid_responses",
    "mismatches",
  ]);

  const auditEvents = pickNumber(auditIntegrity, [
    "total_events",
    "event_count",
  ]);

  const auditBrokenLinks = pickNumber(auditIntegrity, [
    "broken_links",
    "invalid_links",
    "chain_breaks",
  ]);

  const trustStatus = report?.overall_trust_status ?? "UNKNOWN";

  return (
    <section className="panel" style={{ marginTop: "18px" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">POST-EXAM TRUST</p>
          <h3>Trust & Evidence Report</h3>
        </div>

        <button
          className="refresh-button"
          type="button"
          disabled={refreshing || loading}
          onClick={() => {
            setRefreshing(true);
            void loadReport();
          }}
        >
          <RefreshCw size={15} />
          {refreshing ? "Refreshing..." : "Refresh Report"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(248,113,113,0.25)",
            background: "rgba(127,29,29,0.12)",
            color: "#ffc4cb",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "18px 0", color: "#8fa4bd" }}>
          Generating trust evidence summary...
        </div>
      ) : report ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.3fr) minmax(250px, 0.7fr)",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "18px",
                borderRadius: "12px",
                border: "1px solid rgba(56,189,248,0.18)",
                background: "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(255,255,255,0.02))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#8fa4bd",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Overall trust status
                  </div>
                  <div style={{ marginTop: "9px" }}>
                    <StatusBadge status={trustStatus} />
                  </div>
                </div>

                <FileCheck2 size={27} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "10px",
                  marginTop: "18px",
                }}
              >
                <div>
                  <div style={{ color: "#8196ae", fontSize: "11px" }}>Responses</div>
                  <strong style={{ fontSize: "23px" }}>
                    {responseCount ?? "—"}
                  </strong>
                </div>

                <div>
                  <div style={{ color: "#8196ae", fontSize: "11px" }}>Invalid</div>
                  <strong style={{ fontSize: "23px" }}>
                    {invalidResponses ?? "0"}
                  </strong>
                </div>

                <div>
                  <div style={{ color: "#8196ae", fontSize: "11px" }}>Audit events</div>
                  <strong style={{ fontSize: "23px" }}>
                    {auditEvents ?? "—"}
                  </strong>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "18px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.028)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ color: "#8fa4bd", fontSize: "11px" }}>REPORT SCOPE</div>
              <div style={{ marginTop: "9px", lineHeight: 1.7, fontSize: "13px" }}>
                <div><strong>Type:</strong> {readText(report.report_type)}</div>
                <div><strong>Generated:</strong> {readText(report.generated_at)}</div>
                <div><strong>Exam:</strong> {pickText(scope, ["exam_id", "exam"] )}</div>
                <div><strong>Candidate:</strong> {pickText(scope, ["candidate_id", "candidate"] )}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              marginTop: "14px",
            }}
          >
            <EvidenceCard title="Operational" icon={<FileCheck2 size={17} />} data={operational} />
            <EvidenceCard title="Prediction" icon={<FileCheck2 size={17} />} data={prediction} />
            <EvidenceCard title="Anomaly Review" icon={<ShieldAlert size={17} />} data={anomaly} />
            <EvidenceCard title="Fairness" icon={<CheckCircle2 size={17} />} data={fairness} />
            <EvidenceCard title="Response Integrity" icon={<FileCheck2 size={17} />} data={responseIntegrity} />
            <EvidenceCard title="Audit Integrity" icon={<FileCheck2 size={17} />} data={auditIntegrity} />
          </div>

          <div
            style={{
              marginTop: "14px",
              padding: "12px 14px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.025)",
              color: "#8196ae",
              fontSize: "11px",
              lineHeight: 1.6,
            }}
          >
            Audit chain status: {auditBrokenLinks ?? 0} broken link(s) reported by the backend. This panel surfaces evidence for authorized review; it does not itself certify legal validity of examination results.
          </div>
        </>
      ) : null}
    </section>
  );
}
