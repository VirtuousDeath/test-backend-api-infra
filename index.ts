'use strict'

import Fastify from 'fastify'
import mercurius from 'mercurius'
import cron from 'node-cron'
import { MemCache } from './cache'
import { v4 as uuid } from 'uuid'

const app = Fastify()

const schema = `
type Human {
  id: ID!
  name: String
  heartbeat: Float
}

input HumanInput {
  id: ID
  name: String!
  heartbeat: Float!
}

type Query {
  human(id: ID!): Human
  humans: [Human]
}

type Mutation {
  saveHuman(human: HumanInput!): Human
  deleteHuman(id: ID!): Boolean
}

type Subscription {
  humans: [Human]
}
`

const resolvers = {
  Query: {
    human: async (_, { id }, ctx) => {
      try {
        let human = (<Array<any>>MemCache.Instance().get('humans')).find(src => src.id === id)
        if (!human) throw new Error('human not found.')
        return human
      } catch (err) {
        console.error(err.message)
        return err
      }
    },
    humans: async () => {
      try {
        return MemCache.Instance().get('humans') || []
      } catch (err) {
        console.error(err.message)
        return err
      }
    }
  },
  Mutation: {
    saveHuman: async (_, { human }, { pubsub }) => {
      try {
        let humans = (<Array<any>>MemCache.Instance().get('humans')) || []

        if (human.id && !humans.find(src => src.id === human.id)) throw new Error('human not found.')

        if (!human.id) human['id'] = uuid()
        MemCache.Instance().set('humans', [...humans, { ...human }], 0)

        await pubsub.publish({
          topic: 'HUMAN_HEARTBEAT',
          payload: {
            humans: (<Array<any>>MemCache.Instance().get('humans')) || []
          }
        })

        return human
      } catch (err) {
        console.error(err.message)
        return err
      }
    },
    deleteHuman: async (_, { id }, { pubsub }) => {
      try {
        let humans = (<Array<any>>MemCache.Instance().get('humans')) || []
        humans.splice(humans.findIndex(src => id === src.id), 1)
        MemCache.Instance().set('humans', humans, 0)

        await pubsub.publish({
          topic: 'HUMAN_HEARTBEAT',
          payload: {
            humans: (<Array<any>>MemCache.Instance().get('humans')) || []
          }
        })

        return true

      } catch (err) {
        console.error(err.message)
        return err
      }
    }
  },
  Subscription: {
    humans: {
      subscribe: async (root, args, { pubsub }) => {
        return await pubsub.subscribe('HUMAN_HEARTBEAT')
      }
    }
  }
}

app.register(mercurius, {
  schema,
  resolvers,
  subscription: true,
  graphiql: 'playground',
})

app.get('/', async function (req, reply) {
  return reply.send(true)
})

cron.schedule('*/1 * * * * *', async () => {
  let humans = (<Array<any>>MemCache.Instance().get('humans')) || []
  let newHumans = humans.map(elem => {
    return { ...elem, heartbeat: Math.random() * 140 }
  })
  MemCache.Instance().set('humans', newHumans, 0)

  await app.graphql.pubsub.publish({
    topic: 'HUMAN_HEARTBEAT',
    payload: {
      humans: MemCache.Instance().get('humans') || []
    }
  })
  console.info('heartbeat update')
}, { scheduled: true }).start()

app.listen(8000, (err, addr) => {
  if (!err) console.info(`server started at ${addr}`)
  if (err) console.error(err)
})