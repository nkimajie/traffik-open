import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AutomationService } from "./services/automation.service";
import { FilesModule } from "../files/files.module";

@Module({
  imports: [ScheduleModule.forRoot(), FilesModule],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
