import { ChildProcess, SpawnOptions } from 'node:child_process'

// https://nodejs.org/docs/latest/api/util.html#foreground-colors
export type ForegroundColor =
  | 'black'
  | 'blackBright'
  | 'blue'
  | 'blueBright'
  | 'cyan'
  | 'cyanBright'
  | 'gray'
  | 'green'
  | 'greenBright'
  | 'grey'
  | 'magenta'
  | 'magentaBright'
  | 'red'
  | 'redBright'
  | 'white'
  | 'whiteBright'
  | 'yellow'
  | 'yellowBright'

export interface Task {
  /** Command to execute */
  cmd: string
  /** Optional name for the task (defaults to index) */
  name?: string
  /** Optional color for the task name */
  color?: ForegroundColor
}

export interface PreparedTask extends Task {
  /** Formatted task name */
  name: string
  /** Buffer of task output */
  buffer: string
  /** The last stream to write to */
  stream: NodeJS.WritableStream | null
}

export interface ExecutionResult {
  /** Exit code from the process */
  exitCode: number | null
  /** Signal code if the process was terminated by a signal */
  signalCode: string | null
  /** Duration of execution in milliseconds */
  duration: number
}

export interface Options {
  /** Options to pass to child_process.spawn */
  childOptions?: Omit<SpawnOptions, 'shell'>
  /** Stream to write stdout to (defaults to process.stdout) */
  stdout?: NodeJS.WritableStream
  /** Stream to write stderr to (defaults to process.stderr) */
  stderr?: NodeJS.WritableStream
  /** Colors to cycle through for task names */
  colors?: ForegroundColor[]
  /** Whether to pad task names to the same length */
  padTaskNames?: boolean
  /** Callback when a task starts */
  onStart?: (subprocess: any, task: Task) => void
  /** Callback when a task exits */
  onExit?: (result: ExecutionResult, task: Task) => void
  /** Function to format task names */
  formatTaskName?: (task: Task & { name: string }, index: number) => string
  /** Function to format durations */
  formatDuration?: (ms: number) => string
}

export type PrepareTasksOptions = Pick<
  Options,
  'padTaskNames' | 'colors' | 'formatTaskName'
>

export interface TaskExecution extends PromiseLike<ExecutionResult> {
  /** Task name */
  name: string
  /** Subprocess reference */
  subprocess: ChildProcess
}
