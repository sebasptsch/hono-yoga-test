import { createSchema, createYoga } from "graphql-yoga";
import { Hono, type Context } from "hono";
import { createBunWebSocket } from "hono/bun";
import { cors } from "hono/cors";
import { setTimeout as setTimeout$ } from 'node:timers/promises'
import type { ServerWebSocket } from "bun";
import { makeGraphQLWsMiddleware } from "./honoGraphqlWs";
import { graphql } from "graphql";
import gql from "graphql-tag";


const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>()

const app = new Hono().use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST"],
}));

const schema = createSchema<{ c: Context }>({
    typeDefs: gql`
        type Query {
            hello(header: String!): String
        }
        type Subscription {
        countdown(from: Int!): Int!
        countup(to: Int!): Int!
      }
    `,
    resolvers: {
        Query: {
            hello: (s, { header }, { c }) => c.req.header(header)
        },
        Subscription: {
            countdown: {
                // This will return the value on every 1 sec until it reaches 0
                subscribe: async function* (_, { from }) {
                    for (let i = from; i >= 0; i--) {
                        await setTimeout$(100)
                        yield { countdown: i }
                    }
                }
            },
            countup: {
                // This will return the value on every 1 sec until it reaches 0
                subscribe: async function* (_, { to }, {c}) {
                    // console.log(test)
                    console.log(c.req.header('sec-websocket-protocol'))
                    for (let i = 0; i <= to; i++) {
                        await setTimeout$(1000)
                        yield { countup: i }
                    }
                }
            }
        }
    },
})

const graphqlWs = makeGraphQLWsMiddleware({
    schema,
    upgradeWebSocket,
    context: ({ extra: {c} }) => ({ c})
})

const yoga = createYoga<{ c: Context }>({
    graphiql: {
        subscriptionsProtocol: "WS"
    },
    schema,
})

app.on(["GET", "POST"], yoga.graphqlEndpoint, graphqlWs, (c) => yoga.fetch(c.req.raw, { c }))

export default {
    fetch: app.fetch,
    websocket
}