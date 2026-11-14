import logoImage from "@/public/image/traffik-logo-black.png";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { IoMdCheckmark } from "react-icons/io";

export const CREATE_BUSINESS_STEPS = [
  {
    sublabel: "Confirm your email address with the code we send you",
    label: "Email verification",
    path: "/create-business/step0",
  },
  {
    sublabel: "Please provide your business details",
    label: "Business details",
    path: "/create-business/step1",
  },
  {
    sublabel:
      "A Traffik agent will verify your store — explore the dashboard while you wait",
    label: "Store verification",
    path: "/create-business/step2",
  },
] as const;

type SideBarProps = {
  currentPath: string;
  completedSteps: string[];
  stepSublabels?: Record<string, string>;
};

export const Sidebar = ({
  currentPath,
  completedSteps,
  stepSublabels = {},
}: SideBarProps) => {
  const currentIndex = CREATE_BUSINESS_STEPS.findIndex(
    (step) => step.path === currentPath,
  );

  return (
    <>
      <aside className="hidden w-1/3 bg-gray-100 p-8 md:flex flex-col text-left overflow-y-auto">
        <div className="mb-11 ml-5">
          <Image src={logoImage} height={100} width={200} alt="Logo Image" />
        </div>

        <div className="space-y-6">
          {CREATE_BUSINESS_STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.path);
            const isCurrent = currentPath === step.path;
            const isAccessible =
              isCompleted || isCurrent || completedSteps.length >= index;

            return (
              <div key={step.path}>
                <div className="p-5">
                  {isAccessible ? (
                    <Link
                      href={step.path}
                      className="step flex items-center gap-5 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-traffik-pink rounded-md"
                    >
                      <StepIndicator isCompleted={isCompleted} isCurrent={isCurrent} />
                      <StepHeading isCompleted={isCompleted} isCurrent={isCurrent}>
                        {step.label}
                      </StepHeading>
                    </Link>
                  ) : (
                    <div className="step flex items-center gap-5 mb-2 opacity-60">
                      <StepIndicator isCompleted={isCompleted} isCurrent={isCurrent} />
                      <StepHeading isCompleted={isCompleted} isCurrent={isCurrent}>
                        {step.label}
                      </StepHeading>
                    </div>
                  )}
                  <p
                    className={`text-sm text-left ml-11 ${
                      isCompleted || isCurrent ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {stepSublabels[step.path] ?? step.sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 md:hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Step {Math.max(currentIndex + 1, 1)} of {CREATE_BUSINESS_STEPS.length}
        </p>
        <p className="text-sm font-medium text-gray-900">
          {CREATE_BUSINESS_STEPS[Math.max(currentIndex, 0)]?.label ??
            "Business details"}
        </p>
      </div>
    </>
  );
};

function StepIndicator({
  isCompleted,
  isCurrent,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
}) {
  return (
    <div
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
        isCompleted
          ? "border-green-500 bg-green-500"
          : isCurrent
            ? "border-blue-500 bg-blue-500"
            : "border-gray-400"
      }`}
    >
      {isCompleted ? (
        <IoMdCheckmark className="text-white" />
      ) : isCurrent ? (
        <div className="w-2 h-2 rounded-full bg-white" />
      ) : (
        <IoMdCheckmark className="text-gray-400" />
      )}
    </div>
  );
}

function StepHeading({
  isCompleted,
  isCurrent,
  children,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  children: ReactNode;
}) {
  return (
    <h2
      className={`text-lg ${
        isCompleted
          ? "text-gray-900 font-semibold"
          : isCurrent
            ? "text-gray-900 font-bold"
            : "text-gray-500"
      }`}
    >
      {children}
    </h2>
  );
}
