import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Copy,
  Fingerprint,
  Link2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  getAuditEvents,
  verifyAuditChain,
  type AuditEvent,
  type AuditVerificationResponse,
} from "./api";

import "./trust-panels.css";


function shortenHash(
  hash: string
): string {
  if (hash.length <= 22) {
    return hash;
  }

  return `${hash.slice(
    0,
    10
  )}...${hash.slice(-10)}`;
}


function AuditPanel() {
  const [events, setEvents] =
    useState<AuditEvent[]>([]);

  const [verification, setVerification] =
    useState<AuditVerificationResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState<string | null>(null);


  const loadAudit =
    useCallback(async () => {
      try {
        setError(null);

        const [
          eventsData,
          verificationData,
        ] = await Promise.all([
          getAuditEvents(),
          verifyAuditChain(),
        ]);

        setEvents(
          eventsData.events
        );

        setVerification(
          verificationData
        );
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load audit trail."
        );
      } finally {
        setLoading(false);
      }
    }, []);


  useEffect(() => {
    loadAudit();

    const interval =
      setInterval(
        loadAudit,
        5000
      );

    return () =>
      clearInterval(interval);
  }, [loadAudit]);


  const copyHash =
    async (
      hash: string
    ) => {
      try {
        await navigator.clipboard.writeText(
          hash
        );

        setCopied(hash);

        setTimeout(
          () => setCopied(null),
          1500
        );
      } catch {
        setCopied(null);
      }
    };


  if (loading) {
    return (
      <section className="trust-panel">
        <div className="trust-loading">
          <RefreshCw
            size={20}
            className="spin"
          />

          <span>
            Loading audit trail...
          </span>
        </div>
      </section>
    );
  }


  if (error) {
    return (
      <section className="trust-panel">
        <div className="trust-error">
          <XCircle size={20} />

          <span>
            {error}
          </span>

          <button
            className="trust-button"
            onClick={loadAudit}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }


  const isValid =
    verification?.audit_verification.valid ===
    true;


  return (
    <section className="trust-panel">

      <div className="trust-header">

        <div>

          <p className="eyebrow">
            TRUST & AUDIT
          </p>

          <h3>
            Tamper-Evident Audit Trail
          </h3>

          <p className="trust-subtitle">
            Chained event hashes preserve the
            integrity of important examination
            operations.
          </p>

        </div>


        <div
          className={
            isValid
              ? "chain-status-valid"
              : "chain-status-invalid"
          }
        >

          {isValid ? (
            <CheckCircle2 size={17} />
          ) : (
            <XCircle size={17} />
          )}

          <span>
            {isValid
              ? "CHAIN VERIFIED"
              : "CHAIN INVALID"}
          </span>

        </div>

      </div>


      <div className="trust-metrics">

        <div className="trust-metric">
          <Fingerprint size={20} />

          <span>
            Audit Events
          </span>

          <strong>
            {events.length}
          </strong>
        </div>


        <div className="trust-metric trust-success">
          <CheckCircle2 size={20} />

          <span>
            Verification
          </span>

          <strong
            style={{
              fontSize:
                "17px",
            }}
          >
            {isValid
              ? "VALID"
              : "FAILED"}
          </strong>
        </div>


        <div className="trust-metric">
          <Link2 size={20} />

          <span>
            Hash Chain
          </span>

          <strong
            style={{
              fontSize:
                "17px",
            }}
          >
            SHA-256
          </strong>
        </div>


        <div className="trust-metric">
          <ShieldCheck size={20} />

          <span>
            Latest Chain Event
          </span>

          <strong>
            {events.length > 0
              ? `#${events[0].id}`
              : "—"}
          </strong>
        </div>

      </div>


      {verification && (
        <div
          className={
            isValid
              ? "verification-box verification-valid"
              : "verification-box verification-invalid"
          }
        >

          {isValid ? (
            <CheckCircle2
              size={22}
            />
          ) : (
            <XCircle
              size={22}
            />
          )}


          <div>

            <strong>
              {
                verification.audit_verification
                  .message
              }
            </strong>

            <p>
              Total verified events:
              {" "}
              {
                verification.audit_verification
                  .total_events
              }
            </p>

          </div>

        </div>
      )}


      <div className="audit-events">

        <div className="trust-section-title">
          <Fingerprint size={18} />

          <span>
            Recent Audit Events
          </span>
        </div>


        {events.length === 0 ? (

          <div className="trust-empty">
            <CheckCircle2 size={22} />

            <span>
              No audit events recorded yet.
            </span>
          </div>

        ) : (

          events.map(
            (event) => (
              <div
                className="audit-event"
                key={event.id}
              >

                <div className="audit-event-index">
                  #{event.id}
                </div>


                <div className="audit-event-main">

                  <div className="audit-event-title">
                    <strong>
                      {event.event_type}
                    </strong>

                    <span>
                      {event.actor}
                    </span>
                  </div>


                  <div className="audit-entity">
                    {event.entity_type}
                    {" → "}
                    {event.entity_id}
                  </div>


                  <div className="hash-row">

                    <div>
                      <span>
                        Previous:
                      </span>

                      <code>
                        {shortenHash(
                          event.previous_hash
                        )}
                      </code>
                    </div>


                    <div>
                      <span>
                        Event:
                      </span>

                      <code>
                        {shortenHash(
                          event.event_hash
                        )}
                      </code>

                      <button
                        className="copy-button"
                        title="Copy event hash"
                        onClick={() =>
                          copyHash(
                            event.event_hash
                          )
                        }
                      >
                        {copied ===
                        event.event_hash ? (
                          <CheckCircle2
                            size={13}
                          />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                  </div>

                </div>


                <div className="audit-event-date">
                  {event.created_at
                    ? new Date(
                        event.created_at
                      ).toLocaleString()
                    : "—"}
                </div>

              </div>
            )
          )
        )}

      </div>


      <div className="trust-policy">
        <ShieldCheck size={15} />

        <span>
          Audit records are intended to provide
          traceability and evidence for authorized
          examination operations.
        </span>
      </div>

    </section>
  );
}


export default AuditPanel;