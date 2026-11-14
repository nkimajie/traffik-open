import { redirect } from "next/navigation";

export default function AuthSignUpRedirect() {
  redirect("/vendors/sign-up");
}
