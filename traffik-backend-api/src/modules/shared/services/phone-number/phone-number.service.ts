import { Injectable } from "@nestjs/common";
import {
  formatNigerianBidirectional,
  formatNigerianToE164,
} from "src/common/utils/ng-phone.util";

/**
 * Injectable wrapper around Nigerian phone utils (E.164 / BVN local / bidirectional).
 */
@Injectable()
export class PhoneNumberService {
  /** @see formatNigerianToE164 */
  validateAndFormat(phoneNumber: string): string {
    return formatNigerianToE164(phoneNumber);
  }


  /** @see formatNigerianBidirectional */
  validateAndFormatInReverse(phoneNumber: string): string {
    return formatNigerianBidirectional(phoneNumber);
  }
}
