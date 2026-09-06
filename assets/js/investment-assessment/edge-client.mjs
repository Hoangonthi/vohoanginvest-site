import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseClient } from '../supabase-client.js';

const EDGE_FUNCTION_NAME = 'investment-assessment';
const CONTROLLED_STATUS = new Set([400, 401, 403, 404, 409, 422]);

export class InvestmentAssessmentEdgeError extends Error {
  constructor({ status, code, message, details, hint }) {
    super(message || 'Investment assessment request failed.');
    this.name = 'InvestmentAssessmentEdgeError';
    this.status = status;
    this.code = code || 'EDGE_REQUEST_FAILED';
    this.details = details || null;
    this.hint = hint || null;
    this.isControlled = CONTROLLED_STATUS.has(Number(status));
  }
}

export function investmentAssessmentEndpoint(baseUrl = SUPABASE_URL) {
  return `${String(baseUrl || '').replace(/\/$/, '')}/functions/v1/${EDGE_FUNCTION_NAME}`;
}

export async function callInvestmentAssessmentEdge(action, payload = {}, options = {}) {
  const deps = {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    supabase: options.supabase || supabaseClient,
    baseUrl: options.baseUrl || SUPABASE_URL,
    publishableKey: options.publishableKey || SUPABASE_PUBLISHABLE_KEY,
  };

  if (typeof deps.fetchImpl !== 'function') {
    throw new InvestmentAssessmentEdgeError({
      status: 0,
      code: 'FETCH_UNAVAILABLE',
      message: 'Browser fetch is not available.',
    });
  }

  const session = await getCurrentSession(deps.supabase);
  const bearer = session?.access_token || deps.publishableKey;
  const response = await deps.fetchImpl(investmentAssessmentEndpoint(deps.baseUrl), {
    method: 'POST',
    headers: {
      apikey: deps.publishableKey,
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: String(action || '').toUpperCase(), ...payload }),
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw normalizeEdgeError(response.status, data);
  }

  return data;
}

export function startInvestmentAssessment(options = {}) {
  const payload = {};
  if (options.customerId) payload.customer_id = options.customerId;
  return callInvestmentAssessmentEdge('START', payload, options);
}

export function loadInvestmentAssessment({ assessmentId, accessToken } = {}, options = {}) {
  return callInvestmentAssessmentEdge('LOAD', accessPayload(assessmentId, accessToken), options);
}

export function saveInvestmentAssessmentDraft({ assessmentId, accessToken, input } = {}, options = {}) {
  return callInvestmentAssessmentEdge('SAVE_DRAFT', {
    ...accessPayload(assessmentId, accessToken),
    input: input || {},
  }, options);
}

export function confirmInvestmentAssessment({ assessmentId, accessToken } = {}, options = {}) {
  return callInvestmentAssessmentEdge('CONFIRM', accessPayload(assessmentId, accessToken), options);
}


export function runInvestmentAssessmentScenario({ assessmentId, accessToken, scenarioInput } = {}, options = {}) {
  return callInvestmentAssessmentEdge('RUN_SCENARIO', {
    ...accessPayload(assessmentId, accessToken),
    scenario_input_json: scenarioInput || {},
  }, options);
}

export function claimInvestmentAssessment({ assessmentId, accessToken } = {}, options = {}) {
  return callInvestmentAssessmentEdge('CLAIM', accessPayload(assessmentId, accessToken), options);
}

export function listInvestmentAssessmentHistory({ customerId } = {}, options = {}) {
  const payload = {};
  if (customerId) payload.customer_id = customerId;
  return callInvestmentAssessmentEdge('LIST_HISTORY', payload, options);
}
async function getCurrentSession(supabase) {
  const result = await supabase?.auth?.getSession?.();
  return result?.data?.session || null;
}

function accessPayload(assessmentId, accessToken) {
  const payload = { assessment_id: assessmentId };
  if (accessToken) payload.access_token = accessToken;
  return payload;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeEdgeError(status, data) {
  const error = data?.error && typeof data.error === 'object' ? data.error : {};
  return new InvestmentAssessmentEdgeError({
    status,
    code: error.code || `HTTP_${status}`,
    message: error.message || 'Investment assessment request failed.',
    details: error.details,
    hint: error.hint,
  });
}
