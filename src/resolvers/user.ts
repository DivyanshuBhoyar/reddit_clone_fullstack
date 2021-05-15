import { MyContext } from "src/types";
import {
  Resolver,
  Mutation,
  InputType,
  Field,
  Arg,
  Ctx,
  ObjectType,
} from "type-graphql";
import { User } from "../entities/User";
import argon from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";

@InputType()
class UserNamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
} //another way to deal with Args() ; by predefining as a class

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true }) //explicity passing field types as we need nullable : true
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  //register mutation
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UserNamePasswordInput, //type graphql automatically infers "options" type ??check
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2)
      return {
        errors: [
          {
            field: "username",
            message: "username length",
          },
        ],
      };
    if (options.password.length <= 3)
      return {
        errors: [
          {
            field: "password",
            message: "password length",
          },
        ],
      };
    const hashedPassword = await argon.hash(options.password);
    let user;
    try {
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: options.username,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");
      user = result[0];
    } catch (error) {
      console.log("err", error);

      if (error.code === "23505")
        return {
          errors: [
            {
              field: "username",
              message: "the username already exists",
            },
          ],
        };
    }
    console.log("user__", user);
    req.session.userId = user.id; //auto login after registration
    return { user };
  }

  //login mutation
  @Mutation(() => UserResponse)
  async login(
    @Arg("options") options: UserNamePasswordInput, //type graphql automatically infers "options" type ??check
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [{ field: "username", message: "that username doesnt exist" }],
      };
    }
    const valid = await argon.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "incorrect password",
          },
        ],
      };
    }
    req.session.userId = user.id;
    console.log(req.session);

    return { user };
  }
}
