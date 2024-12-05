import * as core from '@actions/core'
import { postTestResults } from './post-tests'
import { applyTests } from './apply-tests'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const action = core.getInput('action')
    switch (action) {
      case 'post-tests':
        await postTestResults()
        break
      case 'apply-tests':
        await applyTests()
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
