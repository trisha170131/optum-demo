import { eventBus } from '../eventbus/EventBus.js';
import { makeTaskRequest } from '../../../shared/schemas.js';

/**
 * Lightweight Agent Interop layer. Any agent (this intake agent, a Prior Auth agent, an
 * Eligibility agent, etc.) publishes/subscribes `TaskRequestEnvelope`s on these two topics.
 * Today there's only `priorAuthAgent.js` on the other end, but it's wired as if it were a
 * separate service reachable only through this bus — that's the pattern being proven.
 *
 * Production swap: replace the underlying `eventBus` calls with real cross-agent transport —
 * MCP-style tool calls between agents, a proper event bus (Kafka/SNS/EventBridge), or a shared
 * task-queue service. Callers of `publishTaskRequest`/`onTaskRequest` would not need to change.
 */
const REQUEST_TOPIC = 'agent.task_request';
const RESPONSE_TOPIC = 'agent.task_response';

/** @type {Map<string, import('../../../shared/schemas.js').TaskRequestEnvelope>} */
const envelopes = new Map();

export function publishTaskRequest(taskType, patientId, appointmentId, requestedBy, payload) {
  const envelope = makeTaskRequest(taskType, patientId, appointmentId, requestedBy, payload);
  envelopes.set(envelope.task_id, envelope);
  eventBus.publish(REQUEST_TOPIC, envelope);
  return envelope;
}

export function onTaskRequest(handler) {
  return eventBus.subscribe(REQUEST_TOPIC, handler);
}

export function respondToTaskRequest(taskId, status, result) {
  const envelope = envelopes.get(taskId);
  if (!envelope) return null;
  envelope.status = status;
  envelope.result = result;
  envelope.updatedAt = new Date().toISOString();
  eventBus.publish(RESPONSE_TOPIC, envelope);
  return envelope;
}

export function onTaskResponse(handler) {
  return eventBus.subscribe(RESPONSE_TOPIC, handler);
}

export function listTaskRequests() {
  return Array.from(envelopes.values());
}
