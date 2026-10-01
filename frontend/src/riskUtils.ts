export function getRiskClass(
  riskLevel: string
): string {
  switch (riskLevel.toUpperCase()) {
    case "REVIEW_REQUIRED":
      return "ai-risk-review";

    case "HIGH":
      return "ai-risk-high";

    case "MEDIUM":
      return "ai-risk-medium";

    case "LOW":
      return "ai-risk-low";

    default:
      return "ai-risk-normal";
  }
}


export function getRiskLabel(
  riskLevel: string
): string {
  switch (riskLevel.toUpperCase()) {
    case "REVIEW_REQUIRED":
      return "REVIEW REQUIRED";

    case "HIGH":
      return "HIGH RISK";

    case "MEDIUM":
      return "MEDIUM";

    case "LOW":
      return "LOW";

    default:
      return "NORMAL";
  }
}


export function getRiskDescription(
  riskLevel: string
): string {
  switch (riskLevel.toUpperCase()) {
    case "REVIEW_REQUIRED":
      return "Unusual signals detected. Human review recommended.";

    case "HIGH":
      return "Multiple unusual signals detected.";

    case "MEDIUM":
      return "Some unusual behaviour signals detected.";

    case "LOW":
      return "Minor unusual signal detected.";

    default:
      return "No unusual signal detected.";
  }
}