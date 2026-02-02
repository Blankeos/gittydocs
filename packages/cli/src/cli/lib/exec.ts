import { spawn } from "node:child_process"
import readline from "node:readline"
import { fail } from "./errors"

export async function runCommand(input: {
  cwd: string
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
}) {
  try {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: "inherit",
    })

    const code: number = await new Promise((resolve, reject) => {
      child.on("error", reject)
      child.on("close", (c) => resolve(c ?? 0))
    })

    if (code !== 0) {
      fail(`Command failed (${code}): ${input.command} ${input.args.join(" ")}`)
    }
  } catch (error) {
    fail(`Failed to run command: ${input.command} ${input.args.join(" ")}\n${String(error)}`)
  }
}

export function spawnLongRunning(input: {
  cwd: string
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  prefix: string
  onStdoutLine?: (line: string) => void
}) {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: ["inherit", "pipe", "pipe"],
  })

  const stdout = child.stdout
  const stderr = child.stderr
  if (!stdout || !stderr) {
    return child
  }

  const forward = (line: string) => {
    process.stdout.write(`[${input.prefix}] ${line}\n`)
    input.onStdoutLine?.(line)
  }

  readline.createInterface({ input: stdout }).on("line", forward)
  readline.createInterface({ input: stderr }).on("line", (line) => {
    process.stderr.write(`[${input.prefix}] ${line}\n`)
  })

  child.on("error", (err) => {
    fail(`Failed to start ${input.command}: ${String(err)}`)
  })

  return child
}
