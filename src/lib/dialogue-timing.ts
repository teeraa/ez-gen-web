const thaiGraphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });
const thaiLetter = /(?=\p{Script=Thai})\p{Letter}/u;
const latinWords = /\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*/gu;

function dialogueUnits(dialogue: string) {
  let thaiUnits = 0;
  for (const { segment } of thaiGraphemes.segment(dialogue)) {
    if (thaiLetter.test(segment)) thaiUnits++;
  }
  const mixedWords = dialogue.match(latinWords)?.length ?? 0;
  return { thaiUnits, mixedWords };
}

// These deliberately rough weights flag clearly dense scripts; they are not
// measured speech rates or syllable counts.
/** Rough speaking time in seconds (0 for empty dialogue). */
export function estimateDialogueSeconds(dialogue: string): number {
  const { thaiUnits, mixedWords } = dialogueUnits(dialogue);
  return thaiUnits / 8 + mixedWords / 2.5;
}

// A one-second margin avoids marginal warnings.
export function mayExceedThaiDialogueDuration(dialogue: string, durationSeconds: number): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  const { thaiUnits, mixedWords } = dialogueUnits(dialogue);
  if (thaiUnits === 0) return false;
  return thaiUnits / 8 + mixedWords / 2.5 > durationSeconds + 1;
}
