/** The account fields needed to issue and email a verification code. */
export interface IOtpAccount {
  _id: string;
  email: string;
  firstName: string;
}
