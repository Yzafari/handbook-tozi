export default {
  NotebookEntry(payload) {
    return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload)
      && typeof payload.title === 'string' && payload.title.trim().length >= 1 && payload.title.length <= 120
      && typeof payload.body === 'string' && payload.body.length <= 100000);
  },
};
