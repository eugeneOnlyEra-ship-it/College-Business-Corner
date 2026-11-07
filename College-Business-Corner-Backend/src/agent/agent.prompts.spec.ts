import { describe, expect, it } from 'vitest';
import { SYSTEM_INSTRUCTION } from './agent.prompt.js';
import { ownerInstruction } from './owner-agent.prompt.js';

// These do not prove the AI behaves; they stop the important rules being deleted by accident.
describe('shopping assistant instructions', () => {
  it('lets the student hand the decision over, and explains the pick against the alternatives', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/HANDING IT TO YOU/);
    for (const phrase of ['choose for me', 'just do it', "I'll just pay"]) expect(SYSTEM_INSTRUCTION).toContain(phrase);
    expect(SYSTEM_INSTRUCTION).toMatch(/other options you found/);
    expect(SYSTEM_INSTRUCTION).toMatch(/why your pick beat them/);
  });
  it('still never pays, and delegating never loosens the safety rules', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/NEVER pay, approve, or confirm/);
    expect(SYSTEM_INSTRUCTION).toMatch(/never lets you pay, skip a confirmation, or go over a budget or limit/);
  });
  it('asks which one when several fit and nothing was delegated', () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/SEVERAL fit/);
    expect(SYSTEM_INSTRUCTION).toMatch(/do NOT call request_checkout yet/);
  });
});

describe('business assistant instructions', () => {
  const text = ownerInstruction('2026-11-06');
  it('offers starter resources once, and only from the checked list', () => {
    expect(text).toMatch(/STARTER RESOURCES/);
    expect(text).toMatch(/get_starter_resources/);
    expect(text).toMatch(/Never invent or recall other books/);
    expect(text).toMatch(/never write a web address yourself/);
    expect(text).toMatch(/never push or repeat the offer/);
  });
});
