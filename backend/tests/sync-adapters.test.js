import test from 'node:test';
import assert from 'node:assert/strict';
import notebook from '../src/modules/notebook/sync-adapter.js';
import forms from '../src/modules/forms/sync-adapter.js';

test('notebook sync adapter validates title/body payloads and bounds text size', () => {
  assert.equal(notebook.NotebookEntry({ entryId: 'e1', title: 'عنوان', body: 'متن' }), true);
  assert.equal(notebook.NotebookEntry({ entryId: 'e1', title: '', body: 'متن' }), false);
  assert.equal(notebook.NotebookEntry({ entryId: 'e1', title: 'عنوان', body: 'x'.repeat(100001) }), false);
});

test('forms sync adapter validates formType/values payloads and bounds JSON size', () => {
  assert.equal(forms.FormDraft({ draftId: 'f1', formType: 'inspection', values: { voltage: 20 } }), true);
  assert.equal(forms.FormDraft({ draftId: 'f1', formType: '', values: {} }), false);
  assert.equal(forms.FormDraft({ draftId: 'f1', formType: 'inspection', values: 'invalid' }), false);
  assert.equal(forms.FormDraft({ draftId: 'f1', formType: 'inspection', values: { text: 'x'.repeat(200001) } }), false);
});
