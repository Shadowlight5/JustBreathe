// Breathing patterns offered in the picker. Data only; timing logic lives in breathing.js.

export const PATTERNS = [
  { id: 'slow-exhale', name: 'Slow exhale', timing: '4 in and 6 out', tag: 'Best before an event',
    why: 'Six slow breaths a minute with a longer out-breath and no holds. Slow breathing at this rate has the broadest evidence of any pattern here: five minutes of it eased anxiety in people new to breathing exercises, and it raises the body\'s calming signal within one session. The longer out-breath is a comfortable way to slow down, not a proven extra. Keep each breath gentle rather than deep.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Exhale', seconds: 6, from: 1, to: 0 } ] },
  { id: 'coherent', name: 'Coherent breathing', timing: '5 in and 5 out', tag: null,
    why: 'The same slow rate with even breaths, and the pattern the NHS teaches for stress. The evidence cannot separate it from Slow exhale, so pick whichever feels easier. Five minutes is enough to raise heart rate variability. Good if counting two different lengths is one thing too many.',
    phases: [ { label: 'Inhale', seconds: 5, from: 0, to: 1 }, { label: 'Exhale', seconds: 5, from: 1, to: 0 } ] },
  { id: 'sigh', name: 'Physiological sigh', timing: 'two in through the nose, one long out through the mouth', tag: null,
    why: 'A full breath in, a short top-up breath, then a long slow breath out through the mouth. The double inhale reopens the lungs. In the one month-long trial it calmed about as well as Box breathing and meditation, and did more for mood than meditation. Short bursts have mixed results, so give it the full session.',
    phases: [ { label: 'Inhale', seconds: 3, from: 0, to: 0.75 }, { label: 'Inhale again', seconds: 1, from: 0.75, to: 1 }, { label: 'Exhale', seconds: 6, from: 1, to: 0 } ] },
  { id: 'box', name: 'Box breathing', timing: '4 in, hold 4, 4 out, hold 4', tag: null,
    why: 'Equal sides, like tracing a square. Used by the military to steady focus under pressure. Five minutes of it before a stress test kept anxiety flat while it rose in people breathing normally, and it calmed about as well as the sigh in a month-long trial. Unlike slow breathing, it has not been shown to raise heart rate variability, and the holds can feel hard when you are already short of breath.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Hold', seconds: 4, from: 1, to: 1 }, { label: 'Exhale', seconds: 4, from: 1, to: 0 }, { label: 'Hold', seconds: 4, from: 0, to: 0 } ] },
  { id: 'four-seven-eight', name: '4-7-8', timing: '4 in, hold 7, 8 out', tag: null, cycles: 4,
    why: 'Dr Weil\'s wind-down pattern, taught for stress and sleep. It is the least studied pattern here: one small study saw heart rate and blood pressure fall, no trial has compared it with the others, and nothing shows the seven-second hold adds anything. The hold can leave you lightheaded at first, so this one stops after four breaths, as its originator advises. A poor fit when you are already short of breath.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Hold', seconds: 7, from: 1, to: 1 }, { label: 'Exhale', seconds: 8, from: 1, to: 0 } ] },
];
export const DEFAULT_PATTERN_ID = 'slow-exhale';
export function getPattern(id) { return PATTERNS.find((p) => p.id === id) ?? PATTERNS.find((p) => p.id === DEFAULT_PATTERN_ID); }
