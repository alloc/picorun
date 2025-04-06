#!/usr/bin/env node
import * as ordana from 'ordana'

// Parse command line arguments
const command = ordana.parse(process.argv.slice(2), {
  name: 'picorun',
  defaultSubcommand: 'run',
  subcommands: {
    run: {
      description: 'Run commands in parallel',
      positionals: { minimum: 1 },
      arguments: {
        names: {
          description: 'Custom names for commands',
          type: 'string',
        },
        filter: {
          description: 'Filter tasks by name',
          type: 'string',
          multiple: true,
          placeholder: 'pattern',
        },
      },
    },
  },
})

if (command.type === 'help') {
  console.log(ordana.generateHelpMessage(command))
} else {
  const picorun = await import('./index')
  const options = command.values
  const names = options.names?.split(',')
  await picorun.default(
    command.positionals.map((cmd, index) => ({
      cmd,
      name: names?.[index],
    })),
    {
      padTaskNames: true,
      filter: options.filter,
    }
  )
}
