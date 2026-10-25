import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const out = resolve(process.argv[2] ?? 'screenshot.png')
const electron = resolve('node_modules/.bin/electron')
const child = spawn(electron, ['.', '--no-sandbox'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PAINT_SCREENSHOT: out,
    PAINT_SCREENSHOT_DELAY: process.env.PAINT_SCREENSHOT_DELAY ?? '2500'
  }
})
child.on('exit', (code) => process.exit(code ?? 0))
