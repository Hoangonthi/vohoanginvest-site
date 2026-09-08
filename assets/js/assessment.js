import { initRealityCheck } from "./investment-reality-check.js";
import { initInvestorProfileAssessment } from "./investor-profile-assessment.js";
import { initAssessmentConversion } from "./assessment-conversion.js";

export function initAssessment() {
  initRealityCheck();
  initInvestorProfileAssessment();
  initAssessmentConversion();
}
