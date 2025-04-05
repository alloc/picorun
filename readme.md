# picorun

Run commands in parallel, with labels and colors, from CLI or JS.

```sh
pnpm add picorun
```

## CLI Usage

```sh
picorun "cmd1" "cmd2" --names=name1,name2
```

## API Usage

```js
import picorun from 'picorun'

const tasks = picorun({
  tasks: [{ cmd: 'cmd1', name: 'Task 1' }, { cmd: 'cmd2' }],
})

tasks[0].name // => 'Task 1'
tasks[0].subprocess // => [object ChildProcess]

// Wait for one task to complete
await tasks[0]

// Wait for all tasks to complete
await tasks
```
