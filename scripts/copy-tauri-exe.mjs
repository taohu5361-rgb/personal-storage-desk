import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetDir = process.env.CARGO_TARGET_DIR ? path.resolve(projectDir, process.env.CARGO_TARGET_DIR) : path.join(projectDir, 'src-tauri', 'target')
const source = path.join(targetDir, 'release', 'script-collection.exe')
const outputDir = path.join(projectDir, 'release')
const target = path.join(outputDir, '个人收纳台.exe')

mkdirSync(outputDir, { recursive: true })
copyFileSync(source, target)

const sizeMb = (statSync(target).size / 1024 / 1024).toFixed(2)
console.log(`Tauri 成品已生成：${target}（${sizeMb} MB）`)
