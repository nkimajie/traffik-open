import { Injectable } from "@nestjs/common";
import mongoose from "mongoose";

@Injectable()
export class UtilsService {
  /**
   * @description Returns the current date and time, optionally adjusted by a specified number of hours.
   * @param minusHour Optional number of hours to subtract from the current time.
   * @returns The adjusted Date object.
   */
  getCurrentDate(minusHour?: number): Date {
    const date = new Date();
    if (minusHour) {
      date.setHours(date?.getHours() + minusHour);
    }
    return date;
  }

  /**
   * @description Converts a string representation of a Mongoose ObjectId to its ObjectId representation.
   * @param value The string representation of the ObjectId to convert.
   * @returns The ObjectId representation of the string.
   */
  objectIdFromString(value: string): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId(value);
  }

  /**
   * @description Converts a Mongoose ObjectId to its string representation.
   * @param value The ObjectId to convert.
   * @returns The string representation of the ObjectId.
   */
  objectIdToString(value: mongoose.Types.ObjectId): string {
    return value.toString();
  }
}
