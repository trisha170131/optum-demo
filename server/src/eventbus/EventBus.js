import { EventEmitter } from 'node:events';

/**
 * EventBus interface. `InMemoryEventBus` below is the demo implementation; production should
 * swap this for a real broker (Kafka / AWS SNS+SQS / EventBridge) or, for real-world EHR
 * triggering, Epic's CDS Hooks. Nothing outside this file should know which one is in use —
 * callers only ever see `publish`/`subscribe`.
 */
export class EventBus {
  publish(_topic, _payload) {
    throw new Error('not implemented');
  }
  subscribe(_topic, _handler) {
    throw new Error('not implemented');
  }
}

export class InMemoryEventBus extends EventBus {
  constructor() {
    super();
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  publish(topic, payload) {
    this.emitter.emit(topic, payload);
  }

  /** @returns {() => void} unsubscribe function */
  subscribe(topic, handler) {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }
}

// Single shared instance for the whole demo process. In production this would be a client
// connecting out to the real broker rather than a singleton in-process object.
export const eventBus = new InMemoryEventBus();
