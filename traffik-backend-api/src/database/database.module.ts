import { Module } from "@nestjs/common";
import { MongooseProvider } from "./mongoose.providers";

@Module({
  imports: [MongooseProvider],
  exports: [MongooseProvider],
})
export class DatabaseModule {}
