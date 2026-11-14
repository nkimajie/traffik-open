import * as Joi from "joi";
import { KycStatus } from "../enums/vendor-kyc.enum";

export const SubmitVendorKycValidation = Joi.object({
  bankName: Joi.string().required(),
  accountNumber: Joi.string().required(),
  dob: Joi.string().required(),
  bvn: Joi.string().length(11).required(),
});

export const UpdateKycStatusValidation = Joi.object({
  status: Joi.string()
    .valid(KycStatus.APPROVED, KycStatus.REJECTED)
    .required(),
  notes: Joi.string().optional().allow(null, ""),
});
