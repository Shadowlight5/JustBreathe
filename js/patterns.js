// Breathing patterns offered in the picker. Data only; timing logic lives in breathing.js.

export const PATTERNS = [
  { id: 'slow-exhale', name: 'Slow exhale', timing: '4 in and 6 out', tag: 'Best before an event',
    why: 'Six slow breaths a minute, with the out-breath longer than the in-breath. This rate has the strongest evidence for lowering anxiety and switching on the body\'s calming response within five minutes, and there are no holds to fight. Keep each breath gentle rather than deep.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Exhale', seconds: 6, from: 1, to: 0 } ] },
  { id: 'coherent', name: 'Coherent breathing', timing: '5 in and 5 out', tag: null,
    why: 'The same slow rate with even breaths. It is the most studied pacing for raising heart rate variability, and even a minute or two may help you feel steadier. Good if counting two different lengths is one thing too many.',
    phases: [ { label: 'Inhale', seconds: 5, from: 0, to: 1 }, { label: 'Exhale', seconds: 5, from: 1, to: 0 } ] },
  { id: 'sigh', name: 'Physiological sigh', timing: 'two in through the nose, one long out through the mouth', tag: 'Fastest reset',
    why: 'A full breath in, a short top-up breath, then a long slow breath out through the mouth. The double inhale reopens the lungs and the long exhale eases arousal, and you may feel calmer after one or two. The trial behind it used five minutes a day.',
    phases: [ { label: 'Inhale', seconds: 3, from: 0, to: 0.75 }, { label: 'Inhale again', seconds: 1, from: 0.75, to: 1 }, { label: 'Exhale', seconds: 6, from: 1, to: 0 } ] },
  { id: 'box', name: 'Box breathing', timing: '4 in, hold 4, 4 out, hold 4', tag: null,
    why: 'Equal sides, like tracing a square. Used by the military to steady focus under pressure. It calmed about as well as sighing in a head-to-head study, but did less for heart rate variability than slow breathing, and the holds can feel hard when you are already short of breath.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Hold', seconds: 4, from: 1, to: 1 }, { label: 'Exhale', seconds: 4, from: 1, to: 0 }, { label: 'Hold', seconds: 4, from: 0, to: 0 } ] },
  { id: 'four-seven-eight', name: '4-7-8', timing: '4 in, hold 7, 8 out', tag: null, cycles: 4,
    why: 'Dr Weil\'s wind-down pattern. The long exhale is probably what does the work. The seven-second hold makes it the hardest here and can leave you lightheaded at first, so this one stops itself after four breaths. Its originator teaches it for stress and sleep; the long hold makes it a poor fit when you are already short of breath.',
    phases: [ { label: 'Inhale', seconds: 4, from: 0, to: 1 }, { label: 'Hold', seconds: 7, from: 1, to: 1 }, { label: 'Exhale', seconds: 8, from: 1, to: 0 } ] },
];
export const DEFAULT_PATTERN_ID = 'slow-exhale';
export function getPattern(id) { return PATTERNS.find((p) => p.id === id) ?? PATTERNS.find((p) => p.id === DEFAULT_PATTERN_ID); }
