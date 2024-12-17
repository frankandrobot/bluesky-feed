import dotenv from 'dotenv'
import { AtpAgent } from '@atproto/api'
import { ids } from '../src/lexicon/lexicons'
import inquirer from 'inquirer'
import { z } from 'zod'
import { feedShortNames } from '../src/algos'

const run = async () => {
  dotenv.config()

  const envSchema = z.object({
    accountEmail: z.string().email().describe('account email'),
    accountAppPassword: z.string().nonempty().describe('account app password'),
    feedShortName: z
      .enum(feedShortNames)
      .describe('the name of a predefined algo in src/algos'),
    customPdsService: z.string().nonempty().optional(),
  })

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'feedShortName',
      message: 'Enter the feed short name:',
      required: true,
    },
    {
      type: 'input',
      name: 'service',
      message: 'Optionally, enter a custom PDS service to sign in with:',
      default: 'https://bsky.social',
      required: false,
    },
    {
      type: 'confirm',
      name: 'confirm',
      message:
        'Are you sure you want to delete this record? Any likes that your feed has will be lost:',
      default: false,
    },
  ])

  const env = envSchema.parse({
    accountEmail: process.env.PUBLISH_EMAIL,
    accountAppPassword: process.env.PUBLISH_PASSWORD,
    feedShortName: answers.feedShortName,
    customPdsService: answers.service,
  } as z.infer<typeof envSchema>)

  if (!answers.confirm) {
    console.log('Aborting...')
    return
  }

  // only update this if in a test environment
  const agent = new AtpAgent({
    service: env.customPdsService ?? 'https://bsky.social',
  })
  await agent.login({
    identifier: env.accountEmail,
    password: env.accountAppPassword,
  })

  await agent.api.com.atproto.repo.deleteRecord({
    repo: agent.session?.did ?? '',
    collection: ids.AppBskyFeedGenerator,
    rkey: env.feedShortName,
  })

  console.log('All done 🎉')
}

run()
