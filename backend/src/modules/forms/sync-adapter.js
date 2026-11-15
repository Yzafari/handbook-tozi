export default {
  FormDraft(payload) {
    return Boolean(payload && typeof payload === 'object' && !Array.isArray(payload)
      && typeof payload.formType === 'string' && payload.formType.length >= 1 && payload.formType.length <= 128
      && payload.values && typeof payload.values === 'object' && !Array.isArray(payload.values)
      && JSON.stringify(payload.values).length <= 200000);
  },
};
