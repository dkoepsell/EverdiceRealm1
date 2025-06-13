
// Simplified and fixed buildPrompt with safe sessionHistory access
export function buildEnhancedPrompt({ sessionHistory }) {
  const recentSessions = (sessionHistory || []).slice(-5);
  let prompt = "You are a DM. Summarize recent sessions:
";
  for (const session of recentSessions) {
    prompt += `Session ${session.session_number}: ${session.narrative}
`;
  }
  return prompt;
}
