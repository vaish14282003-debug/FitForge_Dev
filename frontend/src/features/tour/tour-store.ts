// Lets any page (e.g. Profile → "Take the tour again") start the welcome tour.
const listeners = new Set<() => void>();

export const tourStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  start() {
    listeners.forEach((listener) => listener());
  },
};
