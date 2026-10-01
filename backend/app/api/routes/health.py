from datetime import datetime, timezone

import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident


router = APIRouter(
    prefix="/health",
    tags=["Health Monitoring"]
)


CPU_WARNING = 70
CPU_CRITICAL = 90

MEMORY_WARNING = 80
MEMORY_CRITICAL = 90

DISK_WARNING = 80
DISK_CRITICAL = 90


@router.get("/")
async def health_check(db: Session = Depends(get_db)):
    cpu = psutil.cpu_percent(interval=0.5)
    memory = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent

    detected_incidents = []

    # CPU monitoring
    if cpu >= CPU_CRITICAL:
        detected_incidents.append({
            "type": "CPU_OVERLOAD",
            "severity": "CRITICAL",
            "message": "CPU usage is critically high"
        })
    elif cpu >= CPU_WARNING:
        detected_incidents.append({
            "type": "CPU_OVERLOAD",
            "severity": "WARNING",
            "message": "CPU usage is high"
        })

    # Memory monitoring
    if memory >= MEMORY_CRITICAL:
        detected_incidents.append({
            "type": "MEMORY_OVERLOAD",
            "severity": "CRITICAL",
            "message": "Memory usage is critically high"
        })
    elif memory >= MEMORY_WARNING:
        detected_incidents.append({
            "type": "MEMORY_OVERLOAD",
            "severity": "WARNING",
            "message": "Memory usage is high"
        })

    # Disk monitoring
    if disk >= DISK_CRITICAL:
        detected_incidents.append({
            "type": "DISK_USAGE",
            "severity": "CRITICAL",
            "message": "Disk usage is critically high"
        })
    elif disk >= DISK_WARNING:
        detected_incidents.append({
            "type": "DISK_USAGE",
            "severity": "WARNING",
            "message": "Disk usage is high"
        })

    status = "healthy"

    if any(
        incident["severity"] == "CRITICAL"
        for incident in detected_incidents
    ):
        status = "critical"
    elif detected_incidents:
        status = "warning"

    saved_incidents = []

    # Duplicate prevention
    for incident_data in detected_incidents:

        existing_incident = (
            db.query(Incident)
            .filter(
                Incident.type == incident_data["type"],
                Incident.status == "OPEN"
            )
            .order_by(Incident.id.desc())
            .first()
        )

        if existing_incident:
            # Existing OPEN incident found.
            # Update its latest severity/message instead
            # of creating another duplicate record.
            existing_incident.severity = incident_data["severity"]
            existing_incident.message = incident_data["message"]

            saved_incidents.append({
                "id": existing_incident.id,
                "type": existing_incident.type,
                "severity": existing_incident.severity,
                "message": existing_incident.message,
                "status": existing_incident.status,
                "action": "EXISTING_INCIDENT_UPDATED"
            })

        else:
            # No OPEN incident of this type exists.
            # Create a new incident.
            new_incident = Incident(
                type=incident_data["type"],
                severity=incident_data["severity"],
                message=incident_data["message"],
                status="OPEN"
            )

            db.add(new_incident)
            db.flush()

            saved_incidents.append({
                "id": new_incident.id,
                "type": new_incident.type,
                "severity": new_incident.severity,
                "message": new_incident.message,
                "status": new_incident.status,
                "action": "NEW_INCIDENT_CREATED"
            })

    if detected_incidents:
        db.commit()

    return {
        "status": status,
        "service": "ExamShield AI Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": {
            "cpu_percent": cpu,
            "memory_percent": memory,
            "disk_percent": disk
        },
        "incidents": saved_incidents
    }