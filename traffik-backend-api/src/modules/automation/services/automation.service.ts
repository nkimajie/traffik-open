import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FilesService } from "../../files/services/files.service";

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly filesService: FilesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupUnusedFiles() {
    try {
      this.logger.log("Starting cleanup of unused files...");
      await this.filesService.cleanupUnusedFiles();
      this.logger.log("Cleanup of unused files completed");
    } catch (error) {
      this.logger.error(`Error in cleanup job: ${error.message}`);
    }
  }

  // Add other cron jobs here as needed
  // Example:
  // @Cron(CronExpression.EVERY_WEEK)
  // async weeklyReport() {
  //   // Weekly report generation logic
  // }
}
