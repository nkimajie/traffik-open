import { MongooseModule } from "@nestjs/mongoose";
import { Config } from "../config/configuration";

export const MongooseProvider = MongooseModule.forRootAsync({
  useFactory: () => ({
    uri: Config.getValue("MONGODB_URI"),
  }),
});
