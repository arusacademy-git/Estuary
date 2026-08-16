const startupLines = [
  'Estuary worker scaffold ready.',
  'Next phase: poll JobQueue, dispatch OutboxEvent, and record SystemEvent outcomes.',
];

for (const line of startupLines) {
  console.log(line);
}

export {};
