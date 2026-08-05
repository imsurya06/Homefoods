// Lightweight frontend EventBus for event-driven synchronization
class EventBus {
  private target = new EventTarget();
  private listenersMap = new Map<string, Map<any, any>>();

  on(event: string, callback: (detail: any) => void) {
    const wrappedCallback = (e: any) => callback(e.detail);
    if (!this.listenersMap.has(event)) {
      this.listenersMap.set(event, new Map());
    }
    this.listenersMap.get(event)!.set(callback, wrappedCallback);
    this.target.addEventListener(event, wrappedCallback);
  }

  off(event: string, callback: (detail: any) => void) {
    const wrappedMap = this.listenersMap.get(event);
    if (wrappedMap && wrappedMap.has(callback)) {
      const wrappedCallback = wrappedMap.get(callback);
      this.target.removeEventListener(event, wrappedCallback);
      wrappedMap.delete(callback);
    }
  }

  emit(event: string, detail?: any) {
    const customEvent = new CustomEvent(event, { detail });
    this.target.dispatchEvent(customEvent);
  }
}

export const syncBus = new EventBus();
