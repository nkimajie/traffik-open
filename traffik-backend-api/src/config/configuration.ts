import { config } from "dotenv";
import { EnvironmentVariableKeys } from "./keys";
import { ServerEnvironments } from "../modules/shared/enums/server_environments.enum";

// environment
const environment = process.env.NODE_ENV || ServerEnvironments.DEVELOPMENT;
console.log(`Loading environment: .env.${environment}`);
const result = config({ path: `.env.${environment}` });
if (result.error) {
  console.error(`Error loading .env.${environment}:`, result.error);
} else {
  console.log(`.env.${environment} loaded successfully`);
}

export class Config {
  /**
   * @description get value
   * @param key
   * @returns
   */
  static getValue(key: EnvironmentVariableKeys): string {
    const env = process.env;
    const value = env[key];
    return value;
  }
}
