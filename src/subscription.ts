import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  private eventQueue: RepoEvent[] = []
  private isProcessing = false

  async handleEvent(evt: RepoEvent) {
    // Add the event to the queue
    this.eventQueue.push(evt)
    
    // If we're not already processing events, start processing
    if (!this.isProcessing) {
      await this.processQueue()
    }
  }

  private async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      while (this.eventQueue.length > 0) {
        const evt = this.eventQueue.shift()!
        await this.processEvent(evt)
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async processEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        // only alf-related posts
        return create.record.text.toLowerCase().includes('alf')
      })
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
