import type { Dict } from './de'

export const en: Dict = {
  nav: { workout: 'Workout', stats: 'Statistics', history: 'History', body: 'Body', more: 'More' },
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    back: 'Back', search: 'Search', ok: 'OK', close: 'Close', none: 'None', all: 'All',
    yes: 'Yes', no: 'No', confirmDelete: 'Really delete?', sets: 'Sets', reps: 'Reps', weight: 'Weight',
    notes: 'Note', today: 'Today', loading: 'Loading …', empty: 'Nothing here yet.', min: 'min',
  },
  workout: {
    title: 'Workout', routines: 'Routines', newRoutine: 'New routine', startEmpty: 'Start empty workout',
    resume: 'Workout in progress – resume', lastDone: 'Last', never: 'Never', noRoutines: 'Create your first routine or start an empty workout.',
    routineName: 'Routine name', color: 'Color', weekday: 'Weekday', addExercise: 'Add exercise',
    targetSets: 'Sets', targetReps: 'Reps', rest: 'Rest (s)', superset: 'Superset with next exercise',
    finish: 'Finish', discard: 'Discard', discardConfirm: 'Discard workout? All entries will be lost.',
    addSet: 'Add set', previous: 'Previous', set: 'Set', kg: 'kg', lb: 'lb', rpe: 'RPE',
    warmup: 'Warm-up', normal: 'Normal', drop: 'Drop set', failure: 'To failure',
    removeExercise: 'Remove exercise', note: 'Note', summary: 'Workout complete', duration: 'Duration',
    volume: 'Volume', newPr: 'New record', repeat: 'Repeat', emptyName: 'Workout', noSets: 'No set checked – the workout will not be saved.',
    saveAsRoutine: 'Save as routine', tapToCheck: 'Check a set to start the rest timer',
  },
  rest: { title: 'Rest', skip: 'Skip', next: 'Next', plus: '+10 s', minus: '−10 s', done: 'Rest over' },
  exercises: {
    title: 'Exercises', filter: 'Filter', muscle: 'Muscle', equipment: 'Equipment', onlyMachines: 'Machines only', favorites: 'Favorites',
    custom: 'Custom exercise', create: 'Create custom exercise', name: 'Name', primary: 'Primary muscle', secondary: 'Secondary muscles',
    instructions: 'Instructions', noInstructions: 'No instructions available.', pick: 'Pick exercise', results: 'results',
    category: 'Category', level: 'Level', mechanic: 'Type', force: 'Movement', history: 'Your history', noHistory: 'No data yet.',
    bestSet: 'Best set', est1rm: 'Estimated 1RM', fallbackEn: 'Instructions in English',
  },
  muscle: {
    abdominals: 'Abs', abductors: 'Abductors', adductors: 'Adductors', biceps: 'Biceps', calves: 'Calves',
    chest: 'Chest', forearms: 'Forearms', glutes: 'Glutes', hamstrings: 'Hamstrings', lats: 'Lats',
    'lower back': 'Lower back', 'middle back': 'Middle back', neck: 'Neck', quadriceps: 'Quadriceps',
    shoulders: 'Shoulders', traps: 'Traps', triceps: 'Triceps',
  },
  equip: {
    barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', 'body only': 'Bodyweight',
    kettlebells: 'Kettlebell', bands: 'Resistance band', 'medicine ball': 'Medicine ball', 'exercise ball': 'Exercise ball',
    'foam roll': 'Foam roller', 'e-z curl bar': 'EZ bar', other: 'Other', none: 'None',
  },
  category: {
    strength: 'Strength', stretching: 'Stretching', plyometrics: 'Plyometrics', powerlifting: 'Powerlifting',
    'olympic weightlifting': 'Olympic lifting', strongman: 'Strongman', cardio: 'Cardio',
  },
  history: { title: 'History', empty: 'No completed workouts yet.', delete: 'Delete workout', repeat: 'Repeat workout', setsDone: 'sets' },
  stats: {
    title: 'Statistics', week: 'Week', m1: '1 M', m3: '3 M', y1: '1 Y', all: 'All', workouts: 'Workouts', time: 'Time',
    volume: 'Volume', sets: 'Sets', reps: 'Reps', avg: 'Avg', max: 'Max', sum: 'Total', trend: 'Trend', muscles: 'Muscle distribution',
    volumeOverTime: 'Volume per week', records: 'Records', noData: 'No workouts in this period.',
  },
  body: {
    title: 'Body', weight: 'Body weight', height: 'Height', chest: 'Chest', waist: 'Waist', hips: 'Hips', bicepsL: 'Biceps left',
    bicepsR: 'Biceps right', thighL: 'Thigh left', thighR: 'Thigh right', neck: 'Neck', shoulders: 'Shoulders',
    newEntry: 'New entry', history: 'History', bmi: 'BMI', date: 'Date', empty: 'No entries yet.', cm: 'cm',
  },
  more: {
    title: 'More', exercises: 'Exercises', oneRm: '1RM calculator', plates: 'Plate calculator', stopwatch: 'Stopwatch',
    settings: 'Settings', knowledge: 'Knowledge', advisor: 'Advisor', calculators: 'Tools', about: 'About Fit',
  },
  tools: {
    oneRmTitle: '1RM calculator', oneRmHint: 'Enter weight and reps of one set.', est1rm: 'Estimated 1RM', percent: '%',
    platesTitle: 'Plate calculator', target: 'Target weight', bar: 'Bar', perSide: 'Per side', remainder: 'Remainder', exact: 'Exact match',
    stopwatchTitle: 'Stopwatch', start: 'Start', stop: 'Stop', reset: 'Reset', lap: 'Lap',
  },
  settings: {
    title: 'Settings', language: 'Language', units: 'Units', theme: 'Appearance', system: 'System', light: 'Light', dark: 'Dark',
    restDefault: 'Default rest (s)', backup: 'Backup', export: 'Export backup', import: 'Import backup',
    importDone: 'Backup imported.', importError: 'Could not read the file.', data: 'Data',
    advisorKey: 'OpenRouter API key', advisorModel: 'Model', advisorHint: 'The key stays on this device only.',
    exercisesLoaded: 'Exercises in database', sources: 'Exercise data sources',
  },
  pwa: { offlineReady: 'Ready to work offline', update: 'New version available' },
}
