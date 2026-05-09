import { describe, it, expect } from 'vitest';
import { classifyArtefact, mimeTypeFromPath } from '../classifyArtefact';

describe('classifyArtefact', () => {
  it('classifies primary artefacts by filename', () => {
    expect(classifyArtefact('specs/191-spec-navigator/spec.md')).toBe('spec');
    expect(classifyArtefact('specs/191-spec-navigator/plan.md')).toBe('plan');
    expect(classifyArtefact('specs/191-spec-navigator/tasks.md')).toBe('tasks');
    expect(classifyArtefact('specs/191-spec-navigator/research.md')).toBe('research');
    expect(classifyArtefact('specs/191-spec-navigator/data-model.md')).toBe('data-model');
    expect(classifyArtefact('specs/191-spec-navigator/quickstart.md')).toBe('quickstart');
  });

  it('classifies contracts and evidence folders by location', () => {
    expect(classifyArtefact('specs/191-spec-navigator/contracts/schema.json')).toBe('contract');
    expect(classifyArtefact('specs/191-spec-navigator/evidence/screenshot.png')).toBe(
      'evidence-image',
    );
    expect(classifyArtefact('specs/191-spec-navigator/evidence/test-summary.md')).toBe(
      'evidence-doc',
    );
  });

  it('classifies loose images as evidence-image', () => {
    expect(classifyArtefact('specs/191-spec-navigator/screenshots/mobile.png')).toBe(
      'evidence-image',
    );
  });

  it('falls back to other for unrecognised files', () => {
    expect(classifyArtefact('specs/191-spec-navigator/notes.txt')).toBe('other');
  });
});

describe('mimeTypeFromPath', () => {
  it('maps markdown', () => {
    expect(mimeTypeFromPath('foo.md')).toBe('text/markdown');
  });
  it('maps json / yaml / images', () => {
    expect(mimeTypeFromPath('foo.json')).toBe('application/json');
    expect(mimeTypeFromPath('foo.yaml')).toBe('application/yaml');
    expect(mimeTypeFromPath('foo.png')).toBe('image/png');
    expect(mimeTypeFromPath('foo.jpg')).toBe('image/jpeg');
    expect(mimeTypeFromPath('foo.gif')).toBe('image/gif');
  });
});
