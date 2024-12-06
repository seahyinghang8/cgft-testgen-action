import * as core from '@actions/core'
import * as fs from 'fs'
import { context, getOctokit } from '@actions/github'
import gitDiff from 'git-diff'

interface GeneratedTest {
  status: 'PASS' | 'FAIL'
  test: {
    test_behavior: string
    test_name: string
  }
  original_test_file: string
  processed_test_file: string
}

interface DisplayedTest {
  name: string
  filename: string
  behavior: string
  diff: string
}

type GeneratedTestResults = Record<string, GeneratedTest[]>

export async function postTestResults(
  generatedTestFilename: string = 'test_results.json'
): Promise<void> {
  // Get generated test results
  const fullGeneratedTestFilename = `${process.env.GITHUB_WORKSPACE}/${generatedTestFilename}`
  // Check if the file exists
  if (!fs.existsSync(fullGeneratedTestFilename)) {
    throw new Error(`${generatedTestFilename} file not found`)
  }
  // Read the file contents
  const testResults: GeneratedTestResults = JSON.parse(
    fs.readFileSync(fullGeneratedTestFilename, 'utf8')
  )
  core.info(`Loaded test results from ${generatedTestFilename}`)

  const displayedTests: DisplayedTest[] = []

  for (const [filename, generatedTests] of Object.entries(testResults)) {
    core.info(`Processing test file: ${filename}`)
    for (const generatedTest of generatedTests) {
      if (generatedTest.status === 'FAIL') continue
      // Get the diff
      const diff = gitDiff(
        generatedTest.original_test_file,
        generatedTest.processed_test_file
      )
      if (!diff) continue
      displayedTests.push({
        name: generatedTest.test.test_name,
        filename,
        behavior: generatedTest.test.test_behavior,
        diff
      })
    }
  }

  core.info(`Total displayed tests: ${displayedTests.length}`)

  const octokit = getOctokit(core.getInput('token'))

  core.info('Octokit created')

  for (const [i, displayedTest] of displayedTests.entries()) {
    core.info(
      `Creating comment for test ${i + 1}: ${displayedTest.name.trim()}`
    )
    // TODO: Add a link to the test file
    const body = `<details open>
<summary><h3>Test ${i + 1}: ${displayedTest.name.trim()}</h3></summary>
${displayedTest.behavior}
\`\`\`diff
${displayedTest.diff}
\`\`\`
${displayedTest.filename}
</details>
`
    core.info(body)
    // Display the tests in PR with a comment for each test
    core.info(
      `Posting comment for test ${i + 1} on issue ${context.issue.number}`
    )
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.issue.number,
      body: 'Testing 123'
    })
  }
  core.info('Finished posting test results')
}
