# picorun

Run commands in parallel, with labels and colors, from CLI or JS. Automatically finds executables in `./node_modules/.bin`.

```sh
pnpm add picorun
```

## CLI Usage

```sh
picorun "cmd1" "cmd2" --names=name1,name2 --filter "name1"
```

Options:

- `--names`: Comma-separated list of custom names for each command.
- `--filter`: Run only tasks matching the given name pattern (can be used multiple times). Wildcards (`*`) are supported.

## API Usage

```js
import picorun from 'picorun'

const tasks = picorun(
  // Tasks definition
  [
    { cmd: 'cmd1', name: 'Task 1' },
    { cmd: 'cmd2', name: 'Task 2' },
    { cmd: 'cmd3', name: 'Another Task' },
  ],
  // Options
  {
    // Only run tasks named 'Task 1' or 'Task 2'
    filter: ['Task 1', 'Task 2'],
  }
)

tasks[0].name // => 'Task 1'
tasks[0].subprocess // => [object ChildProcess]

// Wait for one task to complete
await tasks[0]

// Wait for all tasks to complete
await tasks
```

## Prior Art

- [tinyrun](https://github.com/microlinkhq/tinyrun)
