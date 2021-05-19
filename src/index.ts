import "reflect-metadata";
import { COOKIE_NAME, __prod__ } from "./constants";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import { createConnection } from "typeorm";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
import path from "path";
import { Updoot } from "./entities/Updoot";

const main = async () => {
  const conn = await createConnection({
    type: "postgres",
    database: "li_reddit2",
    username: "postgres",
    password: "postgres",
    logging: true,
    synchronize: true,
    entities: [Post, User, Updoot],
    migrations: [path.join(__dirname, "./migrations/*")],
  });
  await conn.runMigrations();
  const app = express();
  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),

      cookies: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: "lax", ///csrf
        secure: false,
        domain: "127.0.0.1",
      },
      saveUninitialized: false,
      secret: "hello redis",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    playground: true,
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ req, res, redis }), //req, res passed to access session
  });

  apolloServer.applyMiddleware({
    app,
    cors: false, //cors handled by different package
  });

  app.listen(4000, () => console.log("Server up and running on port 4000"));
  //   await orm.em.persistAndFlush(post);
  //   console.log("hello world");
};
main().catch((err) => console.error(err));
//0542
