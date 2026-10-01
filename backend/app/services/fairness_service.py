from typing import Dict, List, Tuple


def calculate_disruption_impact(
    duration_ms: int,
    affected_questions: int,
    pending_responses: int,
    recovered_responses: int
) -> Tuple[
    float,
    str,
    str,
    List[str]
]:
    """
    Calculates an explainable technical-disruption
    impact score.

    This is decision support only.
    It does not automatically grant extra time,
    cancel an exam, or order a re-exam.
    """

    score = 0.0
    evidence: List[str] = []

    duration_seconds = (
        duration_ms / 1000
    )

    # Connectivity / disruption duration
    if duration_seconds >= 300:
        score += 40
        evidence.append(
            "DISRUPTION_OVER_5_MINUTES"
        )

    elif duration_seconds >= 120:
        score += 30
        evidence.append(
            "DISRUPTION_OVER_2_MINUTES"
        )

    elif duration_seconds >= 60:
        score += 20
        evidence.append(
            "DISRUPTION_OVER_1_MINUTE"
        )

    elif duration_seconds > 0:
        score += 10
        evidence.append(
            "SHORT_DISRUPTION_DETECTED"
        )

    # Questions affected
    if affected_questions >= 10:
        score += 30
        evidence.append(
            "MANY_QUESTIONS_AFFECTED"
        )

    elif affected_questions >= 5:
        score += 20
        evidence.append(
            "SEVERAL_QUESTIONS_AFFECTED"
        )

    elif affected_questions >= 1:
        score += 10
        evidence.append(
            "QUESTIONS_AFFECTED"
        )

    # Pending response impact
    if pending_responses >= 10:
        score += 20
        evidence.append(
            "LARGE_RESPONSE_QUEUE"
        )

    elif pending_responses >= 5:
        score += 15
        evidence.append(
            "MULTIPLE_PENDING_RESPONSES"
        )

    elif pending_responses >= 1:
        score += 5
        evidence.append(
            "PENDING_RESPONSE_EXISTS"
        )

    # Recovery quality
    if pending_responses > 0:

        recovery_ratio = (
            recovered_responses
            / pending_responses
        )

        if recovery_ratio < 0.5:
            score += 20
            evidence.append(
                "LOW_RESPONSE_RECOVERY_RATE"
            )

        elif recovery_ratio < 1.0:
            score += 10
            evidence.append(
                "PARTIAL_RESPONSE_RECOVERY"
            )

        else:
            evidence.append(
                "ALL_PENDING_RESPONSES_RECOVERED"
            )

    score = min(
        score,
        100.0
    )

    # Impact classification
    if score >= 80:
        impact_level = "SEVERE"

    elif score >= 60:
        impact_level = "HIGH"

    elif score >= 35:
        impact_level = "MEDIUM"

    elif score > 0:
        impact_level = "LOW"

    else:
        impact_level = "NONE"

    # Decision-support recommendation
    if impact_level == "SEVERE":
        recommendation = (
            "PRIORITY_REVIEW_FOR_RESTORATION_OR_CONTROLLED_REEXAM"
        )

    elif impact_level == "HIGH":
        recommendation = (
            "REVIEW_FOR_TIME_ADJUSTMENT_OR_OTHER_FAIRNESS_MEASURE"
        )

    elif impact_level == "MEDIUM":
        recommendation = (
            "REVIEW_DISRUPTION_IMPACT"
        )

    elif impact_level == "LOW":
        recommendation = (
            "RECORD_EVENT_AND_REVIEW_IF_NEEDED"
        )

    else:
        recommendation = (
            "NO_IMMEDIATE_FAIRNESS_ACTION_INDICATED"
        )

    if not evidence:
        evidence.append(
            "NO_SIGNIFICANT_DISRUPTION_SIGNAL"
        )

    return (
        score,
        impact_level,
        recommendation,
        evidence
    )


def build_fairness_summary(
    events: List
) -> Dict:

    if not events:
        return {
            "total_disruptions": 0,
            "average_impact_score": 0,
            "maximum_impact_score": 0,
            "severe_disruptions": 0,
            "high_impact_disruptions": 0,
            "total_affected_questions": 0,
            "total_recovered_responses": 0,
        }

    scores = [
        float(event.impact_score)
        for event in events
    ]

    severe = sum(
        1
        for event in events
        if event.impact_level
        == "SEVERE"
    )

    high = sum(
        1
        for event in events
        if event.impact_level
        in {
            "HIGH",
            "SEVERE",
        }
    )

    affected_questions = sum(
        event.affected_questions
        for event in events
    )

    recovered_responses = sum(
        event.recovered_responses
        for event in events
    )

    return {
        "total_disruptions": len(events),
        "average_impact_score": round(
            sum(scores) / len(scores),
            2
        ),
        "maximum_impact_score": max(
            scores
        ),
        "severe_disruptions": severe,
        "high_impact_disruptions": high,
        "total_affected_questions": (
            affected_questions
        ),
        "total_recovered_responses": (
            recovered_responses
        ),
    }