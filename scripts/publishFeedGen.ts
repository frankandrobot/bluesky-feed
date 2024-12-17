import dotenv from 'dotenv'
import inquirer from 'inquirer'
import { AtpAgent, BlobRef } from '@atproto/api'
import { z } from 'zod'
import fs from 'fs'
import { feedShortNames } from '../src/algos'
import { ids } from '../src/lexicon/lexicons'

const run = async () => {
  dotenv.config()

  if (!process.env.FEEDGEN_SERVICE_DID && !process.env.FEEDGEN_HOSTNAME) {
    throw new Error('Please provide a hostname in the .env file')
  }

  const envSchema = z.object({
    accountEmail: z.string().email().describe('account email'),
    accountAppPassword: z.string().nonempty().describe('account app password'),
    feedShortName: z
      .enum(feedShortNames)
      .describe('the name of a predefined algo in src/algos'),
    displayName: z.string().nonempty().optional(),
    description: z.string().nonempty().optional(),
    avatar: z
      .string()
      .nonempty()
      .refine((value) => /\.(png|jpe?g)$/.test(value), {
        message: 'Avatar must end in .png, .jpg, or .jpeg',
      })
      .optional(),
    customPdsService: z.string().nonempty().optional(),
  })

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'feedShortName',
      message: `Enter a short name for the feed (max 15 chars).
This must be one of ${feedShortNames.join(', ')}. 
(See src/algos.)
Also, the short name will be shown in the feed's URL:`,
      required: true,
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Enter a display name for your feed:',
      required: true,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Optionally, enter a brief description of your feed:',
      required: false,
    },
    {
      type: 'input',
      name: 'avatar',
      message:
        'Optionally, enter a local path to an avatar that will be used for the feed:',
      required: false,
    },
    {
      type: 'input',
      name: 'service',
      message: 'Optionally, enter a custom PDS service to sign in with:',
      default: 'https://bsky.social',
      required: false,
    },
  ])

  const env = envSchema.parse({
    accountEmail: process.env.PUBLISH_EMAIL,
    accountAppPassword: process.env.PUBLISH_PASSWORD,
    feedShortName: answers.feedShortName,
    displayName: answers.displayName,
    description: answers.description,
    avatar: answers.avatar,
    customPdsService: answers.service,
  } as z.infer<typeof envSchema>)

  const feedGenDid =
    process.env.FEEDGEN_SERVICE_DID ?? `did:web:${process.env.FEEDGEN_HOSTNAME}`

  // only update this if in a test environment
  const agent = new AtpAgent({
    service: env.customPdsService ?? 'https://bsky.social',
  })
  await agent.login({
    identifier: env.accountEmail,
    password: env.accountAppPassword,
  })

  let avatarRef: BlobRef | undefined
  if (env.avatar) {
    let encoding: string
    if (env.avatar.endsWith('png')) {
      encoding = 'image/png'
    } else if (env.avatar.endsWith('jpg') || env.avatar.endsWith('jpeg')) {
      encoding = 'image/jpeg'
    } else {
      throw new Error('expected png or jpeg')
    }
    const img = fs.readFileSync(env.avatar)
    const blobRes = await agent.api.com.atproto.repo.uploadBlob(img, {
      encoding,
    })
    avatarRef = blobRes.data.blob
  }

  await agent.api.com.atproto.repo.putRecord({
    repo: agent.session?.did ?? '',
    collection: ids.AppBskyFeedGenerator,
    rkey: env.feedShortName,
    record: {
      did: feedGenDid,
      displayName: env.displayName,
      description: env.description,
      avatar: avatarRef,
      createdAt: new Date().toISOString(),
    },
  })

  console.log('All done 🎉')
}

run()
