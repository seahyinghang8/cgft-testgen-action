import * as core from '@actions/core'
import { spawn } from 'child_process'
import { context, getOctokit } from '@actions/github'

interface User {
  login: string
  id: number
  node_id: string
  type: string
}

interface Reactions {
  url: string
  total_count: number
  '+1': number
  '-1': number
  laugh: number
  confused: number
  heart: number
  hooray: number
  eyes: number
  rocket: number
}

interface Comment {
  id: number
  node_id: string
  body: string
  user: User
  created_at: string
  updated_at: string
  author_association: string
  reactions: Reactions
  performed_via_github_app: null | {
    id: number
    name: string
  }
}

/**
 * Apply test results.
 * @returns {Promise<void>} Resolves when the tests are applied.
 */
export async function applyTests(): Promise<void> {
  core.info('Applying tests')
  const octokit = getOctokit(core.getInput('token'))
  // List all comments in the PR that are generated by the action
  const response = await octokit.rest.issues.listComments({
    ...context.repo,
    issue_number: context.issue.number
  })

  const comments = response.data as Comment[]
  core.info(`Total comments fetched: ${comments.length}`)

  // Filter out comments that are not generated by our testgen action
  const ourBotComments = comments.filter(
    (comment: Comment) =>
      comment.performed_via_github_app?.name === 'GitHub Actions'
  )
  core.info(`Total testgencomments: ${ourBotComments.length}`)

  // Get all the tests with +1 reactions
  const acceptedTestComments = ourBotComments.filter(
    (comment: Comment) => comment.reactions['+1'] > 0
  )
  core.info(`Total accepted test comments: ${acceptedTestComments.length}`)

  // Get all the accepted test patches grouped by filename
  const filenameToPatches = acceptedTestComments.reduce<
    Record<string, Patch[]>
  >((acc, comment) => {
    const patch = parseCommentToPatch(comment)
    if (!patch) return acc
    if (!acc[patch.filename]) {
      acc[patch.filename] = []
    }
    acc[patch.filename].push(patch)
    return acc
  }, {})
  core.info(`Total files to patch: ${Object.keys(filenameToPatches).length}`)

  // Apply the test patches grouped by filename
  for (const [filename, patches] of Object.entries(filenameToPatches)) {
    core.info(`Applying patches for file: ${filename}`)
    if (patches.length == 0) continue
    if (patches.length == 1) {
      await applyGitPatch(patches[0].text)
      core.info(`Applied single patch for file: ${filename}`)
    } else {
      const combinedPatch = combinePatches(patches)
      await applyGitPatch(combinedPatch.text, false, true)
    }
  }
  core.info('Finished applying tests')
}

interface Patch {
  filename: string
  text: string
}

function parseCommentToPatch(comment: Comment): Patch | null {
  const bodyNormalized = comment.body.replaceAll('\r\n', '\n')
  const diff = bodyNormalized.match(/```diff\n(.*)\n```/s)?.[1]
  if (!diff) return null

  const filename = bodyNormalized.match(/```\n(.*)\n<\/details>/)?.[1]
  if (!filename) return null

  return {
    filename,
    text: `--- a/${filename}\n+++ b/${filename}\n${diff}`
  }
}

export function combinePatches(patches: Patch[], check: boolean = true): Patch {
  if (patches.length == 0) {
    throw new Error('No patches to combine')
  }
  // Filter out patches that cannot be applied in isolation
  const validPatches = check
    ? patches.filter(patch => applyGitPatch(patch.text, true))
    : patches
  if (validPatches.length == 0) {
    throw new Error('No valid patches to apply')
  }
  const deletedLines = new Map<number, string>()
  const addedLines = new Map<number, string[]>()

  for (const patch of validPatches) {
    const lines = patch.text.split('\n').map(line => line + '\n')
    if (lines[lines.length - 1] === '\n') lines.pop()
    const codeLines = lines.slice(2)
    let linesLeft = 0
    let currentLineNum = -2
    // Iterate through the code lines and update the deletedLines and addedLines maps
    for (const line of codeLines) {
      if (line.startsWith('+')) {
        if (addedLines.has(currentLineNum)) {
          addedLines.get(currentLineNum)!.push(line)
        } else {
          addedLines.set(currentLineNum, [line])
        }
      } else if (linesLeft === 0) {
        const [beforeStartLine, beforeNumLines] = parseHeader(line)
        linesLeft = beforeNumLines
        currentLineNum = beforeStartLine
      } else {
        if (line.startsWith('-')) {
          deletedLines.set(currentLineNum, line)
        }
        currentLineNum++
        linesLeft--
      }
    }
  }

  const filename = patches[0].filename
  const diffText = createDiffTextFromDiffLines(deletedLines, addedLines)
  return {
    filename,
    text: `--- a/${filename}\n+++ b/${filename}\n${diffText}`
  }
}

function parseHeader(header: string): [number, number] {
  const match = header.match(/@@ -(\d+)(,\d+)? \+\d+,?\d* @@/)
  if (!match) {
    throw new Error(`Invalid git header format. Received header "${header}"`)
  }
  const beforeStartLine = parseInt(match[1], 10)
  let beforeNumLines = 1
  if (match[2]) {
    beforeNumLines = parseInt(match[2].slice(1), 10)
  }
  return [beforeStartLine, beforeNumLines]
}

function createDiffTextFromDiffLines(
  deletedLines: Map<number, string>,
  addedLines: Map<number, string[]>
): string {
  const allLineNums = [...deletedLines.keys(), ...addedLines.keys()]
  const uniqueLineNums = Array.from(new Set(allLineNums)).sort((a, b) => a - b)

  // Group the lines into contiguous chunks based on their line numbers
  let diffText = ''
  // Initialize to a value that will not be consecutive to any other line number
  let currentStartLine = -2
  let prevLineNum = -2
  let numAddedLines = 0
  let numDeletedLines = 0
  let currentLines: string[] = []
  let totalAddedLines = 0
  let totalDeletedLines = 0

  function updateDiffTextAndReset() {
    if (currentLines.length == 0) return
    const beforeStartLine = currentStartLine
    const afterStartLine =
      currentStartLine + totalAddedLines - totalDeletedLines
    diffText += `@@ -${beforeStartLine},${numDeletedLines} +${afterStartLine},${numAddedLines} @@\n${currentLines.join('')}`
    totalAddedLines += numAddedLines
    totalDeletedLines += numDeletedLines
    numAddedLines = 0
    numDeletedLines = 0
    currentLines = []
  }

  for (const lineNum of uniqueLineNums) {
    const deletedLine = deletedLines.get(lineNum)
    const addedLineArray = addedLines.get(lineNum)

    if (lineNum > prevLineNum + 1) {
      updateDiffTextAndReset()
      currentStartLine = lineNum
    }
    if (addedLineArray) {
      currentLines.push(...addedLineArray)
      numAddedLines += addedLineArray.length
      prevLineNum = lineNum - 1
    }
    if (deletedLine) {
      currentLines.push(deletedLine)
      numDeletedLines++
      prevLineNum = lineNum
    }
  }

  updateDiffTextAndReset()

  return diffText
}

async function applyGitPatch(
  patch: string,
  check: boolean = false,
  unidiffZero: boolean = false
): Promise<void> {
  const args = ['apply']
  if (check) {
    args.push('--check')
  }
  if (unidiffZero) {
    args.push('--unidiff-zero')
  }
  return new Promise((resolve, reject) => {
    const gitApply = spawn('git', args, {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: process.env.GITHUB_WORKSPACE
    })

    // Write the patch string to the stdin of the process
    gitApply.stdin.write(patch)
    gitApply.stdin.end()

    // Handle process events
    gitApply.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`git apply exited with code ${code}`))
      }
    })

    gitApply.on('error', err => {
      reject(err)
    })
  })
}
