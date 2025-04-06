// src/index.ts
import { ChildProcess, spawn } from 'node:child_process'
import path from 'node:path'
import { styleText } from 'node:util'
import {
  ExecutionResult,
  ForegroundColor,
  Options,
  PreparedTask,
  PrepareTasksOptions,
  Task,
  TaskExecution,
} from './types'

export type * from './types'

/**
 * Format a duration in milliseconds to a human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${Math.round(seconds)}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(2)}s`
}

/**
 * Create a function that writes task output to a stream
 */
function createStreamHandler(stream: NodeJS.WritableStream) {
  return (data: Buffer | string, task: PreparedTask): void => {
    if (stream !== task.stream) {
      task.stream = stream

      // Drop incomplete line from previous stream
      task.buffer = ''
    }

    const lines = (task.buffer += data.toString()).split('\n')
    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]
        stream.write(`${task.name}${line ? ` ${line}` : ''}\n`)
      }
      task.buffer = lines[lines.length - 1]
    }
  }
}

/**
 * Default colors for task names
 */
export const DEFAULT_COLORS = [
  'yellow',
  'blue',
  'magenta',
  'cyan',
] satisfies ForegroundColor[]

/**
 * Get color for a task based on its index
 */
export function getColor(
  index: number,
  colors: ForegroundColor[] = DEFAULT_COLORS
): ForegroundColor {
  return colors[index % colors.length]
}

/**
 * Format task name with optional coloring
 */
export function formatTaskName(
  task: Task & { name: string },
  index: number,
  colors: ForegroundColor[]
): string {
  const color = task.color || getColor(index, colors)
  return styleText(color, task.name)
}

function getDefaultTaskName(task: Task, index: number, tasks: Task[]): string {
  const name = task.cmd.match(/^[^\s]+/)?.[0]
  return !name || tasks.some(t => t.name === name) ? `[${index}]` : name
}

/**
 * Normalize and prepare tasks for execution
 */
function prepareTasks(
  tasks: Task[],
  options: PrepareTasksOptions = {}
): PreparedTask[] {
  const nameFilter = options.filter?.map(
    pattern =>
      new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i')
  )
  const maxNameLength = options.padTaskNames
    ? Math.max(...tasks.map(task => task.name?.length ?? 0))
    : 0

  const preparedTasks: PreparedTask[] = []

  tasks.forEach((input, index) => {
    const task = (
      input.name
        ? input
        : {
            ...input,
            name: getDefaultTaskName(input, index, tasks),
          }
    ) as PreparedTask

    if (
      nameFilter?.length &&
      !nameFilter.some(filter => filter.test(task.name))
    ) {
      return
    }

    task.name = (options.formatTaskName || formatTaskName)(
      task,
      index,
      options.colors || DEFAULT_COLORS
    )

    if (options.padTaskNames) {
      task.name = task.name.padStart(maxNameLength)
    }

    task.buffer = ''
    task.stream = null

    preparedTasks.push(task)
  })

  return preparedTasks
}

/**
 * Default handler for task start events
 */
export function defaultStartHandler(
  subprocess: ChildProcess,
  task: Task
): void {
  console.log(
    `${task.name} ${styleText('gray', `started pid=${subprocess.pid}`)}`
  )
}

/**
 * Default handler for task exit events
 */
export function defaultExitHandler(result: ExecutionResult, task: Task): void {
  const color = result.exitCode === 0 ? 'gray' : 'red'
  console.log(
    `${task.name} ${styleText(
      color,
      `cmd='${task.cmd}' exitCode=${result.exitCode} signalCode=${result.signalCode} duration=${formatDuration(result.duration)}`
    )}`
  )
}

/**
 * Forward signals from parent process to child process
 */
export function forwardSignals(subprocess: ChildProcess): void {
  for (const signal of [
    'SIGINT',
    'SIGTERM',
    'SIGHUP',
    'SIGQUIT',
  ] satisfies NodeJS.Signals[]) {
    process.on(signal, () => subprocess.kill(signal))
  }
}

export class TaskExecutionArray
  extends Array<TaskExecution>
  implements PromiseLike<ExecutionResult[]>
{
  private promise?: Promise<ExecutionResult[]>

  constructor(tasks: Task[], options: Options = {}) {
    super()

    const {
      childOptions,
      onStart = defaultStartHandler,
      onExit = defaultExitHandler,
    } = options

    const stdoutHandler = createStreamHandler(options.stdout || process.stdout)
    const stderrHandler = createStreamHandler(options.stderr || process.stderr)

    prepareTasks(tasks, options).forEach((task, index) => {
      const startTime = Date.now()
      const subprocess = spawn(task.cmd, {
        ...childOptions,
        shell: true,
        env: {
          ...process.env,
          ...childOptions?.env,
          PATH: `${path.resolve('node_modules/.bin')}:${
            childOptions?.env?.PATH ?? process.env.PATH
          }`,
        },
      })

      onStart(subprocess, task)

      subprocess.stdout?.on('data', data => stdoutHandler(data, task))
      subprocess.stderr?.on('data', data => stderrHandler(data, task))

      subprocess.stdout?.on('end', () => stdoutHandler('', task))
      subprocess.stderr?.on('end', () => stderrHandler('', task))

      let promise: Promise<ExecutionResult> | undefined
      let result: ExecutionResult | undefined

      subprocess.on('exit', (exitCode, signalCode) => {
        if (task.buffer) {
          stdoutHandler(task.buffer + '\n', task)
        }
        const duration = Date.now() - startTime
        result = { exitCode, signalCode, duration }
        onExit(result, task)
      })

      forwardSignals(subprocess)

      this.push({
        name: task.name || String(index),
        subprocess,
        then(onfulfilled, onrejected) {
          return (promise ||= result
            ? Promise.resolve(result)
            : new Promise(resolve =>
                subprocess.on('exit', () => resolve(result!))
              )).then(onfulfilled, onrejected)
        },
      })
    })
  }

  then<TResult1 = ExecutionResult[], TResult2 = never>(
    onfulfilled?:
      | ((value: ExecutionResult[]) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ): PromiseLike<TResult1 | TResult2> {
    return (this.promise ||= Promise.all(this as TaskExecution[])).then(
      onfulfilled,
      onrejected
    )
  }
}

export default function picorun(
  tasks: (Task | false | null | undefined)[],
  options?: Options
): TaskExecutionArray {
  return new TaskExecutionArray(tasks.filter(Boolean) as Task[], options)
}
